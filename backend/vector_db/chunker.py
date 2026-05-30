"""
Section-aware chunker for FIA steward decision precedents.

Each parsed driver record from precedents.jsonl gets split into up to 3 chunks
based on natural document sections:
  - facts: what happened (Fact, Background, Circumstances)
  - analysis: stewards' analysis (Analysis, Consideration, Discussion, Findings)
  - ruling: the decision (Decision, Ruling, Determination, Penalty)

If sections can't be identified (e.g. short reasoning or unusual format),
the full reasoning text becomes a single chunk with section_label "full".

Each chunk gets:
  - A context prefix prepended for embedding (richer semantic matching)
  - Full metadata from the parent record for ChromaDB filtering
  - A section_label to identify which part of the document it came from
"""

import json
import re
from pathlib import Path

from backend.config import PRECEDENTS_FILE

# Section header patterns found in FIA steward decision documents
# Ordered from most to least specific
SECTION_PATTERNS: dict[str, list[re.Pattern]] = {
    "facts": [
        re.compile(r"\b(Fact|Facts|Background|Circumstances)\s*[:\.]", re.IGNORECASE),
        re.compile(r"\b(The driver of Car\s+\d+|Car\s+\d+|Driver\s+\d+)", re.IGNORECASE),
        re.compile(r"\b(At\s+\d{2}:\d{2}|During\s+(Lap|the|Session|Race|Qualifying))", re.IGNORECASE),
    ],
    "analysis": [
        re.compile(r"\b(Analysis|Consideration|Discussion|Findings|The Stewards (reviewed|considered|noted|observed))", re.IGNORECASE),
        re.compile(r"\b(Having reviewed|Having considered|Having examined|On review of)", re.IGNORECASE),
        re.compile(r"\b(Telemetry|Video evidence|Data showed|Onboard footage)", re.IGNORECASE),
    ],
    "ruling": [
        re.compile(r"\b(Decision|Ruling|Determination|Penalty|Conclusion)", re.IGNORECASE),
        re.compile(r"\b(The Stewards (determine|decide|rule|impose|conclude))", re.IGNORECASE),
        re.compile(r"\b(Therefore|Consequently|In accordance with)", re.IGNORECASE),
        re.compile(r"\b(a|the)\s+\d+\s*(second|grid|place|point|penalty|fine|reprimand|warning)", re.IGNORECASE),
    ],
}

# Only split at explicit section headers, not generic keywords mid-sentence
# Matches headers like FACT, FACTS, Fact:, ANALYSIS, Analysis:, DECISION, etc.
# at the beginning of a line (after a newline or start of string)
SECTION_BOUNDARY = re.compile(
    r"(?=(?:^|\n)\s*(("
    r"Facts?|Background|Circumstances"
    r"|"
    r"Analysis|Consideration|Discussion|Findings?"
    r"|"
    r"Decision|Ruling|Determination|Penalty|Conclusion"
    r")\s*[:\.]?)\s*\n)",
    re.IGNORECASE | re.MULTILINE,
)

# Maximum characters per chunk — soft limit reached via section boundaries
# BGE-base-en-v1.5 handles up to 512 tokens, so ~2000 chars is safe
MAX_CHUNK_CHARS = 2000


def identify_section(text: str) -> str:
    """
    Given a block of text, identify which section it belongs to
    by scoring against each section's patterns.
    Returns: 'facts', 'analysis', 'ruling', or 'unknown'
    """
    scores: dict[str, int] = {"facts": 0, "analysis": 0, "ruling": 0}
    for section, patterns in SECTION_PATTERNS.items():
        for pat in patterns:
            matches = pat.findall(text)
            scores[section] += len(matches)

    best = max(scores, key=scores.get)
    if scores[best] == 0:
        return "unknown"
    return best


def build_embedding_text(driver: dict, section_text: str, section_label: str) -> str:
    """
    Build a rich context-embedded string for vector search.
    This is what gets embedded by BGE — includes metadata + section content
    so semantic search works across all dimensions.
    """
    parts = [
        f"Year: {driver.get('year', 'N/A')}",
        f"Circuit: {driver.get('circuit', 'N/A')}",
        f"Session: {driver.get('session', 'N/A')}",
        f"Driver: {driver.get('driver_name', 'N/A')}",
        f"Breach: {driver.get('breach', 'N/A')}",
        f"Penalty: {driver.get('penalty_value', 'N/A')}",
        f"Section: {section_label}",
        section_text,
        f"Decision: {driver.get('decision', 'N/A')}",
    ]
    return " | ".join(parts)


def build_chunk(
    driver: dict,
    section_text: str,
    section_label: str,
    parent_id: int,
) -> dict:
    """
    Build a single chunk dictionary ready for embedding + ChromaDB ingestion.
    """
    embedding_text = build_embedding_text(driver, section_text, section_label)

    metadata = {
        "driver_name": driver.get("driver_name", "N/A"),
        "driver_number": driver.get("driver_number", "N/A"),
        "breach_category": driver.get("breach_category", "N/A"),
        "circuit": driver.get("circuit", "N/A"),
        "year": driver.get("year", 0),
        "session": driver.get("session", "N/A"),
        "penalty_type": driver.get("penalty_type", "N/A"),
        "penalty_value": driver.get("penalty_value", "N/A"),
        "is_infringement": driver.get("is_infringement", False),
        "section_label": section_label,
        "parent_id": parent_id,
        "source_file": driver.get("_source_file", ""),
    }

    return {
        "embedding_text": embedding_text,
        "metadata": metadata,
    }


def split_reasoning_by_sections(reasoning: str) -> list[tuple[str, str]]:
    """
    Split the reasoning text into (section_label, section_text) tuples.

    Uses regex to find section boundaries, then assigns each block
    to the most likely section via pattern scoring.
    """
    if not reasoning or reasoning.strip() == "N/A" or len(reasoning.strip()) < 20:
        return []

    # Try to find explicit section boundaries first
    matches = list(SECTION_BOUNDARY.finditer(reasoning))
    if not matches:
        # No clear sections — treat as a single chunk
        label = identify_section(reasoning)
        if label == "unknown":
            label = "full"
        return [(label, reasoning.strip())]

    # Build split points from boundary matches
    split_positions = []
    for m in matches:
        start = m.start()
        split_positions.append(start)

    # Sort and deduplicate positions (fuzzy — merge positions within 5 chars)
    split_positions = sorted(set(split_positions))
    deduped: list[int] = []
    for pos in split_positions:
        if not deduped or pos - deduped[-1] > 5:
            deduped.append(pos)
    split_positions = deduped

    # Split the text into blocks
    blocks: list[str] = []
    prev = 0
    for pos in split_positions:
        if pos > prev:
            block = reasoning[prev:pos].strip()
            if block:
                blocks.append(block)
        prev = pos
    # Remaining text after the last boundary
    remaining = reasoning[prev:].strip()
    if remaining:
        blocks.append(remaining)

    if not blocks:
        return []

    # Assign each block to a section
    result: list[tuple[str, str]] = []
    for block in blocks:
        label = identify_section(block)
        if label == "unknown":
            label = "full"
        result.append((label, block))

    # Merge adjacent blocks with the same section label
    merged: list[tuple[str, str]] = []
    for label, block in result:
        if merged and merged[-1][0] == label:
            prev_label, prev_text = merged.pop()
            merged.append((label, prev_text + "\n" + block))
        else:
            merged.append((label, block))

    # Filter out very small orphaned fragments (likely noise)
    # and merge them into the nearest section
    filtered: list[tuple[str, str]] = []
    for label, block in merged:
        if len(block) < 30 and filtered:
            # Too small to be a standalone section — merge into previous
            prev_label, prev_text = filtered.pop()
            filtered.append((prev_label, prev_text + "\n" + block))
        else:
            filtered.append((label, block))

    return filtered


def chunk_precedents(
    input_path: Path | None = None,
) -> list[dict]:
    """
    Read precedents.jsonl and produce a list of chunks ready for embedding.

    Each driver record in the JSONL is processed independently.
    Multi-driver PDFs produce records that share the same source_file
    but have different parent_ids.

    Returns a list of chunk dicts with keys:
      - embedding_text: string to be embedded by BGE
      - metadata: dict for ChromaDB metadata filtering
    """
    if input_path is None:
        input_path = PRECEDENTS_FILE

    if not input_path.exists():
        print(f"FATAL: Precedents file not found at {input_path}")
        print("Run fia_pdf_parser.py first to generate precedents.jsonl")
        return []

    chunks: list[dict] = []
    parent_id_counter = 0
    total_drivers = 0
    total_large_chunks = 0

    with open(input_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue

            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue

            source_file = record.get("source_file", "N/A")
            parse_result = record.get("parse_result", [])
            if not isinstance(parse_result, list):
                continue

            for driver in parse_result:
                if not isinstance(driver, dict):
                    continue
                total_drivers += 1

                # Attach source_file to the driver for metadata
                driver["_source_file"] = source_file

                reasoning = driver.get("reasoning", "")
                sections = split_reasoning_by_sections(reasoning)

                if not sections:
                    # No reasoning text — create a minimal chunk from the decision field
                    decision_text = driver.get("decision", "")
                    if decision_text and decision_text != "N/A":
                        sections = [("full", decision_text)]
                    else:
                        continue  # Nothing useful to chunk

                for section_label, section_text in sections:
                    chunk = build_chunk(
                        driver=driver,
                        section_text=section_text,
                        section_label=section_label,
                        parent_id=parent_id_counter,
                    )

                    # Check if text exceeds max char limit
                    if len(chunk["embedding_text"]) > MAX_CHUNK_CHARS:
                        total_large_chunks += 1

                    chunks.append(chunk)

                parent_id_counter += 1

    print(f"Chunking complete:")
    print(f"  Driver records processed: {total_drivers}")
    print(f"  Chunks created: {len(chunks)} ({len(chunks)/max(total_drivers,1):.1f}x per driver)")
    print(f"  Chunks exceeding {MAX_CHUNK_CHARS} chars: {total_large_chunks}")

    return chunks


if __name__ == "__main__":
    chunks = chunk_precedents()
    if chunks:
        print("\nSample chunk:")
        print(f"  Section: {chunks[0]['metadata']['section_label']}")
        print(f"  Embedding preview: {chunks[0]['embedding_text'][:200]}...")
        print(f"  Metadata: {chunks[0]['metadata']}")
