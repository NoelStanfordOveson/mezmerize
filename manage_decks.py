"""
Compare a master acronym list to the merged built-in flashcard decks.

Put this file next to study_flashcards.py (the CSV decks live in the data folder), then run:
    py manage_decks.py
    py manage_decks.py master.csv
    py manage_decks.py --master master.csv

Expected CSV columns (same as study_flashcards.py):
    acronym, full_name, description
"""
import argparse
import csv
import datetime
import os
import shutil
import textwrap
from collections import defaultdict

from mez_common import (BLUE, BUILTIN_DECKS, HELPER, ORANGE, clear_screen, color_keys, color_words,
                        colored, csv_path, print_mode_banner, read_key, say_goodbye)
from mez_cards import closest_version, version_of

REQUIRED_COLUMNS = ("acronym", "full_name", "description")
DECK_CHECK_WIDTH = 96                                       # widest the report gets, even in a big window
ACRONYM_COLUMN = 8                                          # width of the acronym column in the report
ACRONYM_DIVIDER = "-" * 68                                  # between acronyms in section 3
VERSION_DIVIDER = " " * 6 + "." * 62                        # between versions of one acronym, under the labels
REPORT_LABELS = ("TRULY LOST", "CHANGED", "INFORMATION ONLY")   # words colored BLUE in the report
GOOD_UPKEEP = 0.05                                          # GOOD: backlog + incomplete under 5% of rows
POOR_CLEAN = 0.80                                           # POOR: fewer than 80% of rows clean
HEALTH_LEAD = "HEALTH OF DATA:  "                           # the Result page's last line starts with this
RATING_COLORS = {                                           # a traffic light, on the rating word only
    "GOOD": "\x1b[38;5;28m",                                # deeper green, unlike the key green
    "NEEDS ATTENTION": "\x1b[38;5;220m",                    # yellow
    "POOR": "\x1b[38;5;196m",                               # red
}


# 1. Report pages on screen
# 1a. report_width()
# 1b. wrap_row(row, width)
# 1c. make_pages(blocks, room)
# 1d. show_pages(banner, heading, rows, last=False)
# 1e. color_line(line)

# 2. Loading and grouping cards
# 2a. norm(text)
# 2b. key_of(acronym)
# 2c. load_csv(filename, source_label)
# 2d. index_by_acronym(cards)
# 2e. group_by_version(cards)
# 2f. place_of(card)

# 3. compare(master_cards, deck_cards)
# 4. parse_args()

# 5. The Result page
# 5a. health_of(report, rows_checked)
# 5b. how_many(count, noun)
# 5c. next_step(report)
# 5d. result_lines(report, master_cards, deck_cards)

# main()


# 1. Report pages on screen
# 1a. How wide the report can be
def report_width():
    """The window's width, capped at DECK_CHECK_WIDTH"""
    columns = shutil.get_terminal_size(fallback=(DECK_CHECK_WIDTH, 24)).columns
    return min(columns - 1, DECK_CHECK_WIDTH)

# 1b. Wrap one report row to the width
def wrap_row(row, width):
    """Turn one report row into the screen lines it needs (long lines wrap)."""
    lines = []
    for part in row.split("\n"):
        bar = part.find("  |  ")
        if bar >= 0:
            indent = " " * (bar + 5)
        else:
            indent = " " * (len(part) - len(part.lstrip()) + 6)
        lines.extend(textwrap.wrap(part, width, subsequent_indent=indent) or [""])
    return lines

# 1c. Pack the lines into pages
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

# 1d. Show the report one window-full at a time
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
            print(color_line(heading + ("  (continued)" if page_number > 1 else "")))
            print("-" * width)
        for line in page:
            print(color_line(line))
        print()

        if page_number < len(pages):
            prompt = "ENTER = more    ESC = back    Q = quit"
        elif last:
            prompt = "ENTER or ESC = back    Q = quit"
        else:
            prompt = "ENTER = next section    ESC = back    Q = quit"
        print(color_keys(prompt), end="", flush=True)

        action = read_key(("enter", "esc", "q"))
        if action != "enter":
            return action
    return "enter"

# 1e. Color one report line: *results* blue, *holding* orange, *candidates* HELPER, the rating.
def color_line(line):
    """Return the line with its report labels, deck labels, and file names colored. Use after wrapping."""
    line = color_words(line, REPORT_LABELS, BLUE)
    for label, filename in BUILTIN_DECKS:
        whole = label.replace(" ", "\u00a0")
        line = line.replace(f"{whole}\u00a0(", f"{colored(whole, ORANGE)}\u00a0(")
        line = line.replace(f"({filename})", f"({colored(filename, HELPER)})")
    line = line.replace("master line", f"{colored('master', HELPER)} line")
    if line.startswith(HEALTH_LEAD):
        for rating, color in RATING_COLORS.items():
            line = line.replace(f"{HEALTH_LEAD}{rating} ", f"{HEALTH_LEAD}{colored(rating, color)} ")
    return line


# 2. Loading and grouping cards
# 2a. Trim the spaces off a field
def norm(text):
    """Strip leftover spaces so ' CIA ' and 'CIA' count as the same."""
    return (text or "").strip()

# 2b. An acronym, ready to compare (capitals ignored)
def key_of(acronym):
    """Compare acronyms case-insensitively: 'Cia' == 'CIA'."""
    return norm(acronym).casefold()

# 2c. Load one CSV into a list of cards
def load_csv(filename, source_label):
    """
    Load one CSV into a list of card dicts.

    Each card keeps:
      - the three fields study_flashcards.py uses
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

# 2d. Group cards by acronym
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

# 2e. Group cards by exact version
def group_by_version(cards):
    """
    Group cards by exact version (see version_of in mez_cards).

    One version can appear more than once (a duplicate in one file,
    or the same card living in two decks).
    """
    grouped = defaultdict(list)
    for card in cards:
        grouped[version_of(card)].append(card)
    return grouped

# 2f. Say where a card lives
def place_of(card):
    """Say where a card lives: its file and line number, for the report."""
    return f"{card['source']} line {card['line']}"


# 3. Run the six health checks
def compare(master_cards, deck_cards):
    master_versions = group_by_version(master_cards)
    deck_versions = group_by_version(deck_cards)
    integrity = set()
    upkeep = set()

    # --- 1. In master, no deck uses this version ---
    missing_from_decks = []
    for card in master_cards:
        if version_of(card) not in deck_versions:
            upkeep.add(place_of(card))
            missing_from_decks.append(
                f"  {card['acronym'] or '(blank acronym)':>{ACRONYM_COLUMN}}  |  {card['full_name']}"
                f"  [master line {card['line']}]"
            )

    # --- 2. In a deck, the master list lacks this version ---
    extra_in_decks = []
    lead = f"  {'':>{ACRONYM_COLUMN}}  |  "
    for card in deck_cards:
        if version_of(card) not in master_versions:
            integrity.add(place_of(card))
            row = (f"  {card['acronym'] or '(blank acronym)':>{ACRONYM_COLUMN}}  |  {card['full_name']}"
                   f"  [{place_of(card)}]")
            closest = closest_version(card, master_cards)
            if closest is None:
                row += f"\n{lead}TRULY LOST: no card with this acronym in the master list"
            else:
                row += (f"\n{lead}CHANGED. Closest in the master list, line {closest['line']}:"
                        f"\n{lead}NAME: {closest['full_name']}"
                        f"\n{lead}DESC: {closest['description']}")
            extra_in_decks.append(row)

    # --- 3. Same acronym, more than one version (information only) ---
    multi_version = []
    all_cards = index_by_acronym(master_cards + deck_cards)
    for key in sorted(all_cards):
        versions = group_by_version(all_cards[key])
        if len(versions) > 1:
            block = [f"  {all_cards[key][0]['acronym']}"]
            for cards in versions.values():
                if len(block) > 1:
                    block.append(VERSION_DIVIDER)
                block.append(f"      NAME: {cards[0]['full_name']}")
                block.append(f"      DESC: {cards[0]['description']}")
                block.append(f"      IN:   {', '.join(place_of(card) for card in cards)}")
            if multi_version:
                block.insert(0, ACRONYM_DIVIDER)
            multi_version.append("\n".join(block))

    # --- 4. The exact same version twice in the master file ---
    master_dupes = []
    for cards in master_versions.values():
        if len(cards) > 1:
            integrity.update(place_of(card) for card in cards[1:])
            lines = ", ".join(str(card["line"]) for card in cards)
            master_dupes.append(
                f"  {cards[0]['acronym']} appears {len(cards)} times in master (lines {lines})"
            )

    # --- 5. The exact same version twice in one deck ---
    deck_dupes = []
    for cards in deck_versions.values():
        by_deck = defaultdict(list)
        for card in cards:
            by_deck[card["source"]].append(card)
        for source, copies in by_deck.items():
            if len(copies) > 1:
                integrity.update(place_of(card) for card in copies[1:])
                lines = ", ".join(str(card["line"]) for card in copies)
                deck_dupes.append(
                    f"  {copies[0]['acronym']} appears {len(copies)} times in {source} (lines {lines})"
                )

    # --- 6. Rows that are missing a field ---
    incomplete = []
    for card in master_cards + deck_cards:
        holes = [field for field in REQUIRED_COLUMNS if not card[field]]
        if holes:
            upkeep.add(place_of(card))
            incomplete.append(
                f"  {card['source']} line {card['line']}: missing {', '.join(holes)}"
                f"  (acronym={card['acronym']!r})"
            )

    return {
        "missing_from_decks": missing_from_decks,
        "extra_in_decks": extra_in_decks,
        "multi_version": multi_version,
        "master_dupes": master_dupes,
        "deck_dupes": deck_dupes,
        "incomplete": incomplete,
        "integrity": integrity,
        "upkeep": upkeep,
    }


# 4. Read the master list's filename from the command line
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


# 5. The Result page
# 5a. Rate the data: GOOD, NEEDS ATTENTION, or POOR
def health_of(report, rows_checked):
    """Return (rating, clean): the rating, and how many rows have no problem."""
    flagged = report["integrity"] | report["upkeep"]
    clean = rows_checked - len(flagged)
    if not report["integrity"] and len(report["upkeep"]) < GOOD_UPKEEP * rows_checked:
        rating = "GOOD"
    elif clean >= POOR_CLEAN * rows_checked:
        rating = "NEEDS ATTENTION"
    else:
        rating = "POOR"
    return rating, clean

# 5b. Say how many, with "is" or "are"
def how_many(count, noun):
    """Return '1 card is' or '9 cards are'."""
    if count == 1:
        return f"1 {noun} is"
    return f"{count} {noun}s are"

# 5c. Pick the first job to do
def next_step(report):
    """Return the Next step sentence, from the first section with items."""
    lost = sum("TRULY LOST" in row for row in report["extra_in_decks"])
    changed = len(report["extra_in_decks"]) - lost
    incomplete = len(report["incomplete"])
    master_dupes = len(report["master_dupes"])
    deck_dupes = len(report["deck_dupes"])
    backlog = len(report["missing_from_decks"])
    steps = [
        (lost, f"{how_many(lost, 'card')} TRULY LOST from the master list (SECTION 2)."),
        (changed, f"{how_many(changed, 'card')} CHANGED from the master list (SECTION 2)."),
        (incomplete, f"{how_many(incomplete, 'row')} missing a field (SECTION 6)."),
        (master_dupes, f"{how_many(master_dupes, 'version')} in the master list twice (SECTION 4)."),
        (deck_dupes, f"{how_many(deck_dupes, 'version')} in one deck twice (SECTION 5)."),
        (backlog, f"{how_many(backlog, 'backlog card')} in no deck (SECTION 1)."),
    ]

    for count, sentence in steps:
        if count:
            return f"Next step: {sentence}"
    return "Next step: none. All decks match the master list."

# 5d. Build the lines of the Result page
def result_lines(report, master_cards, deck_cards):
    """Return the DECK HEALTH - Result page as a list of lines."""
    now = datetime.datetime.now()
    hour = now.strftime("%I").lstrip("0")
    rows_checked = len(master_cards) + len(deck_cards)
    rating, clean = health_of(report, rows_checked)
    share = round(100 * clean / rows_checked) if rows_checked else 100
    problems = [
        ("1. Backlog, In No Deck", report["missing_from_decks"]),
        ("2. In A Deck, Missing From Master", report["extra_in_decks"]),
        ("4. Duplicates In Master", report["master_dupes"]),
        ("5. Duplicates Within A Deck", report["deck_dupes"]),
        ("6. Incomplete Rows", report["incomplete"]),
    ]

    lines = [
        f"Checked {now:%a %b} {now.day}, {now.year} at {hour}:{now:%M %p}",
        "",
        f"{'Decks checked:':<22}{len(BUILTIN_DECKS):>6}",
        f"{'Cards in decks:':<22}{len(deck_cards):>6}",
        f"{'Versions in master:':<22}{len(master_cards):>6}",
        f"{'Backlog (master only):':<22}{len(report['missing_from_decks']):>6}",
        "",
        "Problems by Section:",
    ]

    for name, items in problems:
        lines.append(f"  {name:<40}{len(items):>4}")
    lines.append("")
    lines.append(f"{'Info by Section:':<30}INFORMATION ONLY")
    lines.append(f"  {'3. Acronyms With More Than One Version':<40}{len(report['multi_version']):>4}")
    lines.append("")
    lines.append(next_step(report))
    lines.append("")
    lines.append(f"{HEALTH_LEAD}{rating}   ({clean} of {rows_checked} rows clean, {share}%)")
    return lines


# main. Run the deck check, one screen at a time
def main():
    """Run the deck check. Return 'back' (ESC, or ENTER at the end) or 'quit' (Q)."""
    args = parse_args()
    master_name = args.master_flag or args.master

    master_cards, master_error = load_csv(master_name, "master")
    if master_error:
        action = show_pages("DECK HEALTH - Problem", None, [
            f"Master file: {master_name}",
            f"Could not load master: {master_error}",
            "Put the master CSV in the data folder, or pass the path:",
            "     py manage_decks.py path\\to\\master.csv",
        ], last=True)
        return "quit" if action == "q" else "back"

    deck_cards = []
    load_errors = []
    for label, filename in BUILTIN_DECKS:
        whole = label.replace(" ", "\u00a0")
        cards, error = load_csv(filename, f"{whole}\u00a0({filename})")
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
        ("IN THE MASTER LIST, no deck uses this version", report["missing_from_decks"]),
        ("IN A DECK, this version is not in the master list", report["extra_in_decks"]),
        ("SAME ACRONYM, more than one version: INFORMATION ONLY", report["multi_version"]),
        ("DUPLICATE versions in the master list", report["master_dupes"]),
        ("DUPLICATE versions within one deck", report["deck_dupes"]),
        ("INCOMPLETE rows (blank acronym, name, or description)", report["incomplete"]),
    ]

    screens = [("DECK HEALTH - Summary", None, summary)]
    for number, (title, rows) in enumerate(sections, start=1):
        screens.append((
            f"DECK HEALTH - SECTION {number} OF {len(sections)}",
            f"{title}  ({len(rows)})",
            rows or ["None. Excellent."],
        ))

    for banner, heading, lines in screens:
        action = show_pages(banner, heading, lines)
        if action == "esc":
            return "back"
        if action == "q":
            return "quit"

    action = show_pages("DECK HEALTH - Result", None, result_lines(report, master_cards, deck_cards), last=True)
    return "quit" if action == "q" else "back"


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:                                               # Ctrl+C skip the traceback, exit cleanly
        pass
    say_goodbye()