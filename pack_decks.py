"""
pack_decks: roll the built-in decks and the master list into one deck pack.
A deck pack is one CSV with a deck column: deck,acronym,full_name,description. Each row
carries its deck's label; the master list's rows are labeled (master). The web version
loads and saves packs, and unpack_decks.py splits one back into the deck files.
Run it with  py pack_decks.py  (the pack goes to Downloads) or  py pack_decks.py <file>.
"""
import csv
import os
import sys
from datetime import datetime

from mez_common import BUILTIN_DECKS, csv_path
from mez_cards import FIELDS, MASTER_FILE, read_rows

PACK_FIELDS = ["deck"] + FIELDS                                             # the pack's header
MASTER_LABEL = "(master)"                                                   # the master list's label in a pack
PACK_PREFIX = "mezmerize_decks"                                             # packs are named mezmerize_decks....csv


# 1. pack_folder()
# 2. pack_rows()
# 3. write_pack(path, rows)
# 4. Main program


# 1. Where packs go and come from: Downloads, where the web version saves them too
def pack_folder():
    """Return the Downloads folder, or the current folder if there isn't one."""
    downloads = os.path.join(os.path.expanduser("~"), "Downloads")
    return downloads if os.path.isdir(downloads) else os.getcwd()


# 2. Every row of the pack: the decks in menu order, then the master list
def pack_rows():
    """Return (rows, counts): the pack's rows, and how many came from each label."""
    rows, counts = [], {}
    sources = list(BUILTIN_DECKS) + [(MASTER_LABEL, MASTER_FILE)]
    for label, filename in sources:
        if not os.path.exists(csv_path(filename)):
            print(f"Skipped {filename}: file not found.")
            continue
        cards = read_rows(filename)
        cards.sort(key=lambda card: card["acronym"].casefold())
        rows.extend(dict(card, deck=label) for card in cards)
        counts[label] = len(cards)
    return rows, counts


# 3. Write the pack (with a byte-order mark, so Excel shows every character right)
def write_pack(path, rows):
    """Write the rows to path as a deck pack."""
    with open(path, mode="w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=PACK_FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


# 4. Main program
def main():
    """Pack the decks and say what was written."""
    if len(sys.argv) > 1:
        path = os.path.abspath(sys.argv[1])
    else:
        stamp = datetime.now().strftime("%Y-%m-%d_%H%M")
        path = os.path.join(pack_folder(), f"{PACK_PREFIX}_{stamp}.csv")   # a new name each time: never overwrites
    if os.path.exists(path):
        print(f"{path} already exists. Choose another name.")
        return
    rows, counts = pack_rows()
    write_pack(path, rows)
    print(f"Packed {len(rows)} rows into {path}")
    for label, count in counts.items():
        print(f"  {label:<16}{count:>5}")


# This runs the program when you type: py pack_decks.py
if __name__ == "__main__":
    main()
