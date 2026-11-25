"""
unpack_decks: split a deck pack back into the deck files and the master list.
Writes each deck whose label matches one of the 8 built-in decks, plus master.csv
(copied first to master.bak), and lists any decks it skipped. Decks missing from the
pack are left as they are. Nothing is written until the summary is answered Y.
Run it with  py unpack_decks.py  (the newest pack in Downloads) or  py unpack_decks.py <file>.
"""
import csv
import glob
import os
import sys
from datetime import datetime

from mez_common import BUILTIN_DECKS, csv_path
from mez_cards import FIELDS, MASTER_FILE, read_rows, version_of, write_sorted
from pack_decks import MASTER_LABEL, PACK_FIELDS, PACK_PREFIX, pack_folder


# 1. find_pack(argument)
# 2. read_pack(path)
# 3. plan_files(groups)
# 4. show_plan(path, writes, skipped, master_built)
# 5. Main program


# 1. The pack to split: the one named, or the newest mezmerize_decks....csv in Downloads
def find_pack(argument):
    """Return the pack's full path, or None if there isn't one."""
    if argument:
        path = os.path.abspath(argument)
        return path if os.path.exists(path) else None
    packs = glob.glob(os.path.join(pack_folder(), PACK_PREFIX + "*.csv"))
    return max(packs, key=os.path.getmtime) if packs else None


# 2. Read the pack into groups of cards, one per label (labels matched ignoring capitals)
def read_pack(path):
    """
    Return (groups, problems). groups maps each label (as first written) to its cards;
    problems lists rows that couldn't be used.
    """
    groups, names, problems = {}, {}, []
    with open(path, mode="r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        missing = [field for field in PACK_FIELDS if field not in (reader.fieldnames or [])]
        if missing:
            problems.append(f"The header needs {', '.join(PACK_FIELDS)} (missing {', '.join(missing)}).")
            return groups, problems
        for row in reader:
            card = {field: (row.get(field) or "").strip() for field in PACK_FIELDS}
            extra = row.get(None)                                           # unquoted commas split the description
            if extra:
                card["description"] = ",".join([card["description"]] + extra).strip().strip('"')
            if not any(card[field] for field in FIELDS):
                continue                                                    # skip empty rows
            if not card["deck"]:
                problems.append(f"Line {reader.line_num}: {card['acronym']} has no deck label.")
                continue
            key = card["deck"].casefold()
            label = names.setdefault(key, card["deck"])
            groups.setdefault(label, []).append({field: card[field] for field in FIELDS})
    return groups, problems


# 3. Decide what gets written: built-in decks by label, then master.csv
def plan_files(groups):
    """
    Return (writes, skipped, master_built). writes is a list of (label, filename, cards);
    skipped lists labels that aren't built-in decks; master_built is True when the pack
    had no master rows, so the master list is today's plus any versions it lacks.
    """
    builtin = {label.casefold(): (label, filename) for label, filename in BUILTIN_DECKS}
    writes, skipped, master_cards = [], [], None
    for label, cards in groups.items():
        if label.casefold() == MASTER_LABEL:
            master_cards = cards
        elif label.casefold() in builtin:
            writes.append(builtin[label.casefold()] + (cards,))
        else:
            skipped.append(label)
    writes.sort(key=lambda write: BUILTIN_DECKS.index(write[:2]))        # menu order

    master_built = master_cards is None
    if master_built:
        master_cards = read_rows(MASTER_FILE) if os.path.exists(csv_path(MASTER_FILE)) else []
        known = {version_of(card) for card in master_cards}
        for _, _, cards in writes:
            for card in cards:
                if version_of(card) not in known:
                    master_cards.append(card)
                    known.add(version_of(card))
    writes.append(("the master list", MASTER_FILE, master_cards))
    return writes, skipped, master_built


# 4. Show what would be written, with today's count beside the new one
def show_plan(path, writes, skipped, master_built):
    """Print the summary the Y / N question is about."""
    changed = datetime.fromtimestamp(os.path.getmtime(path)).strftime("%Y-%m-%d %H:%M")
    print(f"\nPack:  {path}")
    print(f"Saved: {changed}\n")
    print(f"  {'Deck':<18}{'now':>5}{'pack':>7}   File")
    for label, filename, cards in writes:
        now = len(read_rows(filename)) if os.path.exists(csv_path(filename)) else 0
        print(f"  {label:<18}{now:>5}{len(cards):>7}   {filename}")
    if master_built:
        print("\nThe pack has no master list: the master list keeps every row it has now,")
        print("plus any version in these decks that it lacks.")
    untouched = [label for label, filename in BUILTIN_DECKS
                 if filename not in [write[1] for write in writes]]
    if untouched:
        print("\nNot in the pack, left as they are: " + ", ".join(untouched))
    if skipped:
        print("\nSkipped (not one of the 8 built-in decks): " + ", ".join(skipped))
    print("\nmaster.csv is copied to master.bak first.")


# 5. Main program
def main():
    """Find the pack, show what it would write, and write it on Y."""
    path = find_pack(sys.argv[1] if len(sys.argv) > 1 else None)
    if path is None:
        where = sys.argv[1] if len(sys.argv) > 1 else f"{pack_folder()} ({PACK_PREFIX}....csv)"
        print(f"No deck pack found: {where}")
        return
    groups, problems = read_pack(path)
    for problem in problems:
        print(problem)
    if not groups:
        print("Nothing to unpack.")
        return

    writes, skipped, master_built = plan_files(groups)
    show_plan(path, writes, skipped, master_built)
    answer = input("\nWrite these files now?  Y = yes     N = no  ").strip().lower()
    if answer != "y":
        print("RESULT:  Nothing was written.")
        return
    for label, filename, cards in writes:
        write_sorted(filename, [dict(card) for card in cards])
    print(f"RESULT:  Wrote {len(writes)} files to the data folder.")


# This runs the program when you type: py unpack_decks.py
if __name__ == "__main__":
    main()
