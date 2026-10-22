"""
Compare a master acronym list to the merged built-in flashcard decks.

Put this file next to flashcards.py (the CSV decks live in the data folder), then run:
    py manage_decks.py
    py manage_decks.py master.csv
    py manage_decks.py --master master.csv

Expected CSV columns (same as flashcards.py):
    acronym, full_name, description
"""
import argparse
import csv
import os
import shutil
import textwrap
from collections import defaultdict

from mez_common import BUILTIN_DECKS, clear_screen, csv_path, print_mode_banner, read_key, say_goodbye

REQUIRED_COLUMNS = ("acronym", "full_name", "description")
DECK_CHECK_WIDTH = 96                                       # widest the report gets, even in a big window
ACRONYM_COLUMN = 8                                          # width of the acronym column in the report


def report_width():
    """The window's width, capped at DECK_CHECK_WIDTH"""
    columns = shutil.get_terminal_size(fallback=(DECK_CHECK_WIDTH, 24)).columns
    return min(columns - 1, DECK_CHECK_WIDTH)

def wrap_row(row, width):
    """Turn one report row into the screen lines it needs (long lines wrap)."""
    lines = []
    for part in row.split("\n"):
        indent = " " * (len(part) - len(part.lstrip()) + 4)
        lines.extend(textwrap.wrap(part, width, subsequent_indent=indent) or [""])
    return lines

def make_pages(blocks, room):
    """
    Pack blocks of lines into pages of at most 'room' lines each.
    A block stays on one page unless it is taller than a whole page.
    """
    pages = [[]]
    for block in blocks:
        if pages[-1] and len(pages[-1]) + len(block) > room:
            pages.append([])                                # block won't fit: start a new page
        for line in block:
            if len(pages[-1]) == room:
                pages.append([])                            # block longer than a page: spill over
            pages[-1].append(line)
    return pages

def show_pages(banner, heading, rows, last=False):
    """
    Show rows one window-full at a time, with the banner at the top of every page.
    Returns 'enter' (go on), 'esc' (back), or 'q' (quit).
    """
    width = report_width()
    height = shutil.get_terminal_size(fallback=(DECK_CHECK_WIDTH, 24)).lines
    top_lines = 3 + (2 if heading else 0)                   # bannner, plus heading and its rule
    room = max(height - top_lines - 2, 1)                   # minus a blank line and the prompt

    pages = make_pages([wrap_row(row, width) for row in rows], room)

    for page_number, page in enumerate(pages, start=1):
        clear_screen(margin=False)
        print_mode_banner(banner, width)
        if heading:
            print(heading + ("  (continued)" if page_number > 1 else ""))
            print("-" * width)
        for line in page:
            print(line)
        print()

        if page_number < len(pages):
            prompt = "ENTER = more     ESC = back     Q = quit"
        elif last:
            prompt = "ENTER or ESC = back     Q = quit"
        else:
            prompt = "ENTER = next section     ESC = back     Q = quit"
        print(prompt, end="", flush=True)

        action = read_key(("enter", "esc", "q"))
        if action != "enter":
            return action
    return "enter"

def norm(text):
    """Strip leftover spaces so ' CIA ' and 'CIA' count as the same."""
    return (text or "").strip()

def key_of(acronym):
    """Compare acronyms case-insensitively: 'Cia' == 'CIA'."""
    return norm(acronym).casefold()

def load_csv(filename, source_label):
    """
    Load one CSV into a list of card dicts.

    Each card keeps:
      - the three fields flashcards.py uses
      - source: which file it came from (for the report)
      - line: spreadsheet row number (header is line 1)
    """
    path = csv_path(filename)
    if not os.path.exists(path):
        return [], f"missing file: {filename}"

    cards = []
    with open(path, mode="r", encoding="utf-8-sig", newline="") as file:
        # utf-8-sig eats a BOM if Excel saved the file
        reader = csv.DictReader(file)
        if reader.fieldnames is None:
            return [], f"empty or unreadable: {filename}"

        headers = [norm(name) for name in reader.fieldnames]
        missing_cols = [col for col in REQUIRED_COLUMNS if col not in headers]
        if missing_cols:
            return [], (
                f"{filename} is missing columns: {', '.join(missing_cols)}. "
                f"Found: {', '.join(headers)}"
            )

        for line_number, row in enumerate(reader, start=2):
            acronym = norm(row.get("acronym", ""))
            full_name = norm(row.get("full_name", ""))
            description = norm(row.get("description", ""))
            if not acronym and not full_name and not description:
                continue  # skip totally blank rows
            cards.append({
                "acronym": acronym,
                "full_name": full_name,
                "description": description,
                "source": source_label,
                "line": line_number,
            })
    return cards, None

def index_by_acronym(cards):
    """
    Group cards by normalized acronym.

    One acronym can appear more than once (duplicate in one file,
    or the same term living in two decks).
    """
    grouped = defaultdict(list)
    for card in cards:
        grouped[key_of(card["acronym"])].append(card)
    return grouped

def first_nonempty(cards, field):
    for card in cards:
        if card[field]:
            return card[field]
    return ""

def compare(master_cards, deck_cards):
    master_index = index_by_acronym(master_cards)
    deck_index = index_by_acronym(deck_cards)

    master_keys = set(master_index)
    deck_keys = set(deck_index)

    # --- 1. In master, not in any built-in deck ---
    missing_from_decks = []
    for key in sorted(master_keys - deck_keys):
        card = master_index[key][0]
        missing_from_decks.append(
            f"  {card['acronym'] or '(blank acronym)':>{ACRONYM_COLUMN}}  |  {card['full_name']}"
            f"  [master line {card['line']}]"
        )

    # --- 2. In a deck, not in master ---
    extra_in_decks = []
    for key in sorted(deck_keys - master_keys):
        for card in deck_index[key]:
            extra_in_decks.append(
                f"  {card['acronym'] or '(blank acronym)':>{ACRONYM_COLUMN}}  |  {card['full_name']}"
                f"  [{card['source']} line {card['line']}]"
            )

    # --- 3. Same acronym, different name or description ---
    mismatches = []
    for key in sorted(master_keys & deck_keys):
        master_card = master_index[key][0]
        # If the same acronym is in several decks, compare against each copy
        for deck_card in deck_index[key]:
            name_diff = master_card["full_name"].casefold() != deck_card["full_name"].casefold()
            desc_diff = master_card["description"].casefold() != deck_card["description"].casefold()
            if not name_diff and not desc_diff:
                continue
            mismatches.append(
                f"  {master_card['acronym']}\n"
                f"      MASTER name: {master_card['full_name']}\n"
                f"      DECK   name: {deck_card['full_name']}  ({deck_card['source']} line {deck_card['line']})\n"
                f"      MASTER desc: {master_card['description']}\n"
                f"      DECK   desc: {deck_card['description']}"
            )

    # --- 4. Duplicate acronyms inside the master file ---
    master_dupes = []
    for key, cards in master_index.items():
        if len(cards) > 1:
            lines = ", ".join(str(card["line"]) for card in cards)
            master_dupes.append(
                f"  {cards[0]['acronym']} appears {len(cards)} times in master (lines {lines})"
            )

    # --- 5. Duplicate acronyms inside the merged decks ---
    deck_dupes = []
    for key, cards in deck_index.items():
        if len(cards) > 1:
            places = ", ".join(f"{card['source']} line {card['line']}" for card in cards)
            deck_dupes.append(
                f"  {cards[0]['acronym']} appears {len(cards)} times: {places}"
            )

    # --- 6. Rows that are missing a field ---
    incomplete = []
    for card in master_cards + deck_cards:
        holes = [field for field in REQUIRED_COLUMNS if not card[field]]
        if holes:
            incomplete.append(
                f"  {card['source']} line {card['line']}: missing {', '.join(holes)}"
                f"  (acronym={card['acronym']!r})"
            )

    return {
        "missing_from_decks": missing_from_decks,
        "extra_in_decks": extra_in_decks,
        "mismatches": mismatches,
        "master_dupes": master_dupes,
        "deck_dupes": deck_dupes,
        "incomplete": incomplete,
    }

def parse_args():
    parser = argparse.ArgumentParser(
        description="Compare a master acronym CSV to the merged built-in decks."
    )
    parser.add_argument(
        "master",
        nargs="?",
        default="master.csv",
        help="Master CSV filename (default: master.csv)",
    )
    parser.add_argument(
        "--master",
        dest="master_flag",
        help="Same as the positional filename; use if you prefer --master name.csv",
    )
    return parser.parse_args()


def main():
    """Run the deck check. Return 'back' (ESC, or ENTER at the end) or 'quit' (Q)."""
    args = parse_args()
    master_name = args.master_flag or args.master

    master_cards, master_error = load_csv(master_name, "master")
    if master_error:
        action = show_pages("CHECK DECKS: Problem", None, [
            f"Master file: {master_name}",
            f"Could not load master: {master_error}",
            "Put the master CSV in the data folder, or pass the path:",
            "     py manage_decks.py path\\to\\master.csv",
        ], last=True)
        return "quit" if action == "q" else "back"

    deck_cards = []
    load_errors = []
    for label, filename in BUILTIN_DECKS:
        cards, error = load_csv(filename, f"{label} ({filename})")
        if error:
            load_errors.append(error)
        else:
            deck_cards.extend(cards)

    summary = [
        f"Master file:      {master_name}",
        f"Master rows used: {len(master_cards)}",
        f"Merged deck rows: {len(deck_cards)}",
    ]

    if load_errors:
        summary.append("Deck load notes:")
        summary.extend(f"  - {error}" for error in load_errors)

    report = compare(master_cards, deck_cards)
    sections = [
        ("IN MASTER, missing from all built-in decks", report["missing_from_decks"]),
        ("IN A DECK, but not in the master file", report["extra_in_decks"]),
        ("SAME ACRONYM, different name or description", report["mismatches"]),
        ("DUPLICATE acronyms in the master file", report["master_dupes"]),
        ("DUPLICATE acronyms in the merged decks", report["deck_dupes"]),
        ("INCOMPLETE rows (blank acronym, name, or description)", report["incomplete"]),
    ]

    problem_count = sum(len(items) for items in report.values())
    if problem_count == 0:
        verdict = "All master entries match the merged decks. Nice."
    else:
        verdict = f"Finished. {problem_count} item(s) to review."

    screens = [("CHECK DECKS: Summary", None, summary)]
    for number, (title, rows) in enumerate(sections, start=1):
        screens.append((
            f"CHECK DECKS: Section {number} of {len(sections)}",
            f"{title}  ({len(rows)})",
            rows or ["None. Good."],
        ))

    for banner, heading, lines in screens:
        action = show_pages(banner, heading, lines)
        if action == "esc":
            return "back"
        if action == "q":
            return "quit"

    action = show_pages("CHECK DECKS: Result", None, [verdict], last=True)
    return "quit" if action == "q" else "back"


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:                                               # Ctrl+C skip the traceback, exit cleanly
        pass
    say_goodbye()