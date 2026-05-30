"""
FIA Formula 1 Steward Decision PDF Scraper

Scrapes the FIA website for steward decision PDFs across multiple seasons.
Adapted from the original AI-FIA-Steward scraper approach (requests + BeautifulSoup).

How it works:
1. For each season, it fetches the season page to find event node IDs
2. For each event, it calls the FIA AJAX endpoint to get document links
3. Filters PDFs by keywords: decision, infringement, offence
4. Downloads and saves them organized by year/event_name/
"""

import os
import re
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# FIA website base URL — all document links are relative to this
BASE_URL = "https://www.fia.com"

# Spoof a browser User-Agent so the FIA server doesn't block us
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
}

# Only download PDFs whose title contains at least one of these keywords
# This filters out media releases, timetables, and other non-decision docs
KEYWORDS = ["decision", "infringement", "offence"]

# Season → FIA season page URL mapping
# These URLs are stable and point to each season's document listing
SEASONS: dict[str, str] = {
    "2026":"https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072",
    "2025": "https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071",
    "2024": "https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043",
    "2023": "https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2023-2042",
    "2022": "https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2022-2005",
    "2021": "https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2021-1108",
    "2020": "https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2020-1059",
    "2019": "https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2019-971",
    "2015": "https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2015-249",
}


def get_event_node_ids(season_url: str) -> dict[str, str]:
    """
    Parse a FIA season page to find all event (Grand Prix) node IDs.

    The FIA season page contains links like:
      /decision-document-list/nojs/12345
    where 12345 is the event's node ID. We extract these to later
    fetch the actual document list via the AJAX endpoint.

    Returns a dict: {node_id: event_name}
    """
    response = requests.get(season_url, headers=HEADERS, timeout=30)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    events: dict[str, str] = {}
    for a in soup.select("a[href*='/decision-document-list/nojs/']"):
        match = re.search(r"/decision-document-list/nojs/(\d+)", a["href"])
        if match:
            node_id = match.group(1)
            name = a.get_text(strip=True)
            events[node_id] = name

    return events


def get_pdfs_for_event(node_id: str) -> tuple[str, list[tuple[str, str]]]:
    """
    Fetch the list of PDF documents for a given event via the FIA AJAX endpoint.

    The AJAX endpoint returns JSON commands (like jQuery.append) that contain
    HTML with document links. We parse these to extract PDF URLs and titles.

    Returns: (event_name, [(pdf_url, title), ...])
    """
    url = f"{BASE_URL}/decision-document-list/ajax/{node_id}"
    response = requests.get(url, headers=HEADERS, timeout=30)
    response.raise_for_status()

    html_data = ""
    event_name = f"event_{node_id}"

    # The response is a list of jQuery-style command objects
    # We extract the HTML data from 'insert' commands and the event title
    for command in response.json():
        if command.get("command") == "insert":
            selector = command.get("selector", "")
            data = command.get("data", "")

            # The event title is hidden in a separate insert with class 'event-title'
            if "event-title" in selector:
                text = BeautifulSoup(data, "html.parser").get_text(strip=True)
                if text:
                    event_name = text

            # Document links come in the 'document-type-wrapper' inserts
            if "document-type-wrapper" in selector:
                html_data += data

    # Now parse the collected HTML to find all PDF links
    soup = BeautifulSoup(html_data, "html.parser")
    links: list[tuple[str, str]] = []
    for a in soup.find_all("a", href=True):
        href = a.get("href", "")

        # FIA PDFs follow one of these path patterns
        if "/system/files/decision-document/" in href or "/sites/default/files/decision-document/" in href:
            title = a.get_text(" ", strip=True)
            links.append((href, title))

    return event_name, links


def download_pdf(pdf_path: str, save_path: Path) -> bool:
    """
    Download a single PDF from a relative or absolute URL to a local path.
    Returns True if downloaded, False if skipped (already exists).
    """
    if save_path.exists():
        return False

    pdf_url = BASE_URL + pdf_path if pdf_path.startswith("/") else pdf_path
    response = requests.get(pdf_url, headers=HEADERS, timeout=20)
    response.raise_for_status()

    save_path.parent.mkdir(parents=True, exist_ok=True)
    save_path.write_bytes(response.content)
    return True


def scrape_season(season_year: str, season_url: str, output_dir: Path) -> dict[str, int]:
    """
    Scrape all decision PDFs for a single season.

    Steps:
      1. Get all event node IDs from the season page
      2. For each event, get the PDF list from the AJAX endpoint
      3. Filter PDFs by keywords
      4. Download each matching PDF

    Returns a summary dict: {event_name: count_of_downloaded_pdfs}
    """
    season_dir = output_dir / season_year
    season_dir.mkdir(parents=True, exist_ok=True)

    events = get_event_node_ids(season_url)
    print(f"  Found {len(events)} events: {', '.join(events.values())}")

    summary: dict[str, int] = {}

    for node_id, fallback_name in events.items():
        try:
            event_name, links = get_pdfs_for_event(node_id)
        except Exception as e:
            print(f"  [SKIP] {fallback_name} — failed to fetch PDF list: {e}")
            continue

        # Sanitise event name for use as a folder name
        safe_name = event_name.replace("/", "-").replace(" ", "_")
        event_dir = season_dir / safe_name
        event_dir.mkdir(parents=True, exist_ok=True)

        downloaded = 0
        for href, title in links:
            # Skip PDFs that don't match our keywords
            if not any(k in title.lower() for k in KEYWORDS):
                continue

            filename = href.split("/")[-1]
            save_path = event_dir / filename

            try:
                if download_pdf(href, save_path):
                    print(f"    + {filename}")
                    downloaded += 1
            except Exception as e:
                print(f"    [FAIL] {filename} — {e}")

        summary[event_name] = downloaded
        print(f"  [{event_name}] Downloaded: {downloaded}/{len(links)} matching PDFs")

    return summary


def run_scraper(output_dir: str | Path | None = None) -> None:
    """
    Entry point: scrape all configured seasons.
    """
    if output_dir is None:
        from backend.config import FIA_PDFS_DIR
        output_dir = FIA_PDFS_DIR

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    total_downloaded = 0
    for year, url in SEASONS.items():
        print(f"\n{'='*60}")
        print(f"  Season {year}")
        print(f"{'='*60}")
        summary = scrape_season(year, url, output_path)
        year_total = sum(summary.values())
        total_downloaded += year_total
        print(f"  Season {year} total: {year_total} PDFs")

    print(f"\n{'='*60}")
    print(f"  ALL DONE — Total PDFs downloaded: {total_downloaded}")
    print(f"{'='*60}")


if __name__ == "__main__":
    run_scraper()
