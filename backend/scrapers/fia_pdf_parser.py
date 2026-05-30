"""
FIA PDF Parser — extracts structured precedent data from steward decision PDFs.

Pipeline:
  1. Walk all PDFs in data/fia_pdfs/ organised by year/event/
  2. Extract raw text using PyMuPDF (fitz)
  3. Send to Groq Llama via the structured prompt we designed
  4. Validate the JSON response
  5. Append to data/precedents.jsonl

Each JSONL line contains the source_file path and an array of driver objects.
This way multi-driver documents produce multiple searchable records.
"""

import json
import os
import time
from pathlib import Path

import fitz  # PyMuPDF
from backend.config import FIA_PDFS_DIR, PRECEDENTS_FILE
from backend.services.llm_client import extraction_completion

# Rate limiting — 3s between calls keeps us well under free tier token limits
# for the 8b model (~150k input tokens/min = ~75 PDFs/min with avg 2k tokens)
CALL_DELAY_SECONDS = 1.5

# Retry settings for 429 (rate limit exceeded)
MAX_RETRIES = 3
RETRY_BASE_DELAY = 30  # Start with 30s backoff

# Track which PDFs we've already processed so we can resume cleanly
# We load this set once at startup and check before each parse
PROCESSED_SOURCES: set[str] | None = None

SYSTEM_PROMPT = (
    "You are an FIA Formula 1 steward document parser. Extract structured data "
    "from the following FIA steward decision document.\n\n"
    "Return ONLY a valid JSON array of objects. Each object represents one "
    "driver involved. If a document involves only one driver, return an array "
    "with one object. If multiple drivers are involved, include all of them.\n\n"
    "Keys for each object:\n"
    "- driver_name (full name, or \"N/A\")\n"
    "- driver_number (string like \"1\", \"44\", or \"N/A\")\n"
    "- breach (short description of the alleged breach, or \"N/A\")\n"
    "- breach_category (one of: \"Causing a collision\", \"Forcing off track\", "
    "\"Impeding\", \"Pit lane infringement\", \"Yellow flag infringement\", "
    "\"Technical non-compliance\", \"False start\", \"DRS infringement\", "
    "\"Safety car procedure\", \"Other\", \"N/A\")\n"
    "- circuit (Grand Prix name)\n"
    "- year (4-digit number)\n"
    "- session (one of: \"Race\", \"Qualifying\", \"Sprint\", \"Practice\", \"N/A\")\n"
    "- penalty_type (one of: \"Time penalty\", \"Grid penalty\", \"Reprimand\", "
    "\"Fine\", \"Warning\", \"Disqualification\", \"Penalty points\", \"None\", "
    "\"Other\", \"N/A\")\n"
    "- penalty_value (e.g. \"5 seconds\", \"3 grid places\", \"$5000\", or \"N/A\")\n"
    "- decision (summary of the stewards' decision regarding this driver)\n"
    "- reasoning (full stewards' reasoning — keep paragraph structure intact, "
    "or \"N/A\" if not applicable)\n"
    "- articles_cited (comma-separated list of FIA articles, or \"N/A\")\n"
    "- is_infringement (boolean — true if an infringement was found for this "
    "driver, false otherwise)\n\n"
    "Rules:\n"
    "- If a field is not clearly stated in the document, use \"N/A\" — do NOT "
    "infer or guess values.\n"
    "- Documents titled \"Summons\" or \"Right of Review\" are still valuable "
    "precedent data. Extract what's available.\n"
    "- If the document lists no driver name but uses a car number like \"Car 44\", "
    "set driver_name to \"N/A\" and driver_number to \"44\".\n"
    "- Do NOT wrap the JSON in markdown code blocks. Return raw JSON only.\n\n"
    "Document:\n{text}"
)


def _load_processed_sources() -> set[str]:
    """
    Read the existing JSONL file and build a set of already-processed source_file paths.
    This lets us resume after interruptions without re-parsing everything.
    """
    global PROCESSED_SOURCES
    if PROCESSED_SOURCES is not None:
        return PROCESSED_SOURCES

    sources: set[str] = set()
    if PRECEDENTS_FILE.exists():
        with open(PRECEDENTS_FILE, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                    src = record.get("source_file", "")
                    if src:
                        sources.add(src)
                except json.JSONDecodeError:
                    continue

    PROCESSED_SOURCES = sources
    return sources


def extract_text_from_pdf(pdf_path: Path) -> str:
    """
    Extract all text from a PDF using PyMuPDF.
    Returns an empty string if the PDF has no extractable text.
    """
    text_parts: list[str] = []
    try:
        with fitz.open(pdf_path) as doc:
            for page in doc:
                extracted = page.get_text()
                if extracted:
                    text_parts.append(extracted)
    except Exception as e:
        print(f"    [FITZ ERROR] {pdf_path.name}: {e}")
        return ""

    return "\n".join(text_parts)


def call_llm_extraction(raw_text: str) -> list[dict] | None:
    """
    Send the raw PDF text to the LLM (Groq or Gemini) and parse the JSON response.
    Handles rate limits with exponential backoff retry.
    Returns the parsed list of driver objects, or None if parsing failed.
    """
    user_prompt = SYSTEM_PROMPT.format(text=raw_text)

    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = extraction_completion(raw_text, SYSTEM_PROMPT)
            content = response.choices[0].message.content.strip()
            break
        except Exception as e:
            error_str = str(e).lower()
            if "429" in error_str or "rate" in error_str or "quota" in error_str or "resource exhausted" in error_str:
                wait = RETRY_BASE_DELAY * attempt
                print(f"    [RATE LIMITED] attempt {attempt}/{MAX_RETRIES} — "
                      f"waiting {wait}s...")
                time.sleep(wait)
            else:
                print(f"    [LLM ERROR] attempt {attempt}/{MAX_RETRIES}: {e}")
                if attempt < MAX_RETRIES:
                    time.sleep(5)
                else:
                    return None
            last_error = e
    else:
        print(f"    [LLM ERROR] All {MAX_RETRIES} attempts failed. "
              f"Last error: {last_error}")
        return None

    # The LLM sometimes wraps JSON in markdown code blocks — strip them
    if content.startswith("```"):
        content = content.strip("`")
        if content.startswith("json"):
            content = content[4:]
        content = content.strip()

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as e:
        print(f"    [JSON ERROR] Failed to parse LLM response: {e}")
        print(f"    Response preview: {content[:300]}")
        return None

    if not isinstance(parsed, list):
        print(f"    [STRUCT ERROR] Expected JSON array, got {type(parsed).__name__}")
        return None

    return parsed


def parse_pdf(pdf_path: Path) -> bool:
    """
    Parse a single PDF: extract text, call LLM, validate, and write to JSONL.
    Returns True if the document was successfully parsed and appended.
    """
    processed = _load_processed_sources()
    abs_path = str(pdf_path.resolve())

    if abs_path in processed:
        return False  # Already done — skip silently

    raw_text = extract_text_from_pdf(pdf_path)
    if not raw_text.strip():
        print(f"    [SKIP] {pdf_path.name} — no extractable text")
        return False

    parsed_data = call_llm_extraction(raw_text)
    if parsed_data is None:
        return False

    # Rate limiting delay — avoids hitting Groq's free tier ceiling
    # Applied after successful calls only (retries handle their own delays)
    time.sleep(CALL_DELAY_SECONDS)

    # Build the JSONL record with source tracking
    record = {
        "source_file": abs_path,
        "parse_result": parsed_data,
    }

    with open(PRECEDENTS_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")

    # Update the in-memory set so we don't re-check the file system
    PROCESSED_SOURCES.add(abs_path)
    return True


def run_parser(pdf_root: Path | None = None) -> None:
    """
    Walk all PDFs in the FIA PDF directory and parse each one.
    Skips PDFs that are already recorded in precedents.jsonl.
    """
    if pdf_root is None:
        pdf_root = FIA_PDFS_DIR

    if not pdf_root.exists():
        print(f"FATAL: PDF root not found at {pdf_root}")
        print("Run fia_scraper.py first to download PDFs.")
        return

    # Make sure the output directory exists
    PRECEDENTS_FILE.parent.mkdir(parents=True, exist_ok=True)

    # Collect all PDF files first so we can show progress
    all_pdfs = sorted(pdf_root.rglob("*.pdf"))
    processed = _load_processed_sources()
    total = len(all_pdfs)
    skipped = sum(1 for p in all_pdfs if str(p.resolve()) in processed)
    new_count = 0
    fail_count = 0

    print(f"Found {total} PDFs total ({skipped} already processed)")
    print(f"Output: {PRECEDENTS_FILE}\n")

    # Tracking for ETA
    to_process = total - skipped
    if to_process > 0:
        est_seconds = to_process * (CALL_DELAY_SECONDS + 2)  # 2s buffer for extraction
        print(f"Estimated time: {est_seconds // 60} min {est_seconds % 60}s "
              f"(~{CALL_DELAY_SECONDS + 2}s per PDF with rate limiting)\n")

    start_time = time.time()
    for i, pdf_path in enumerate(all_pdfs, start=1):
        # Show relative path for cleaner output
        rel = pdf_path.relative_to(pdf_root.parent)
        print(f"[{i}/{total}] {rel}")

        if parse_pdf(pdf_path):
            new_count += 1
            print(f"  -> Parsed OK")
        else:
            # parse_pdf returns False for skips AND failures
            # Check if it was actually a failure or already-processed
            if str(pdf_path.resolve()) not in _load_processed_sources():
                fail_count += 1
                print(f"  -> FAILED")

        # Show ETA every 20 files
        if new_count > 0 and new_count % 20 == 0:
            elapsed = time.time() - start_time
            rate = new_count / elapsed
            remaining = to_process - new_count - fail_count
            eta_secs = remaining / rate if rate > 0 else 0
            print(f"  [PROGRESS] {new_count + fail_count}/{to_process} done | "
                  f"{rate:.1f} PDFs/min | ETA: {eta_secs // 60:.0f}m {eta_secs % 60:.0f}s")

    print(f"\n{'='*60}")
    print(f"  DONE — Parsed: {new_count} new, Failed: {fail_count}, "
          f"Already done: {skipped}")
    print(f"  Total precedents in JSONL: {len(_load_processed_sources())}")
    print(f"{'='*60}")


if __name__ == "__main__":
    run_parser()
