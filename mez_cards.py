"""
mez_cards: the card logic for the mezmerize programs.

This is the middle floor. It reads, compares, and writes cards; it has no menus,
prompts, or keypresses. It imports only Python's own modules and mez_common
(the floor below), so nothing can import in a circle.
"""

import csv
import shutil

from mez_common import BUILTIN_DECKS, csv_path

MASTER_FILE = "master.csv"
BACKUP_FILE = "master.bak"
FIELDS = ["acronym", "full_name", "description"]

# 1a. read_rows
# 1b. write_sorted
# 2a. deck_file_for
# 2b. version_of
# 2c. find_row
# 2d. decks_with_version
# 3. update_master


# 1. Deck files
# # 1a. Read every row of a deck file
def read_rows(filename):
    """Read a CSV from the data folder. Return a list of row dictionaries."""
    rows = []
    with open(csv_path(filename), mode="r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        for row in reader:
            acronym = (row.get("acronym") or "").strip()
            full_name = (row.get("full_name") or "").strip()
            description = (row.get("description") or "").strip()

            extra = row.get(None)                                       # unquoted commas split the description
            if extra:
                description = ",".join([description] + extra).strip().strip('"')
                print(f"Repaired {filename} line {reader.line_num}: "
                      f"{acronym} description had unquoted commas.")

            if not acronym and not full_name and not description:
                continue                                                # skip empty rows
            rows.append({
                "acronym": acronym,
                "full_name": full_name,
                "description": description,
            })
    return rows

# 1b. Sort rows by acronym and save them back to the file
def write_sorted(filename, rows):
    """
    Sort rows by acronym (ignoring capitals), then write the file with its header.
    Before master.csv is written, copy it to master.bak (one step of undo).
    """
    rows.sort(key=lambda row: row["acronym"].casefold())
    if filename == MASTER_FILE:
        shutil.copy2(csv_path(MASTER_FILE), csv_path(BACKUP_FILE))      # back up master first
    with open(csv_path(filename), mode="w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)

# 2. Card identity
# 2a. Find the CSV file for a built-in deck label
def deck_file_for(label):
    """Return the file name for a built-in deck label, or None if it isn't a built-in deck."""
    for deck_label, filename in BUILTIN_DECKS:
        if deck_label == label:
            return filename
    return None

# 2b. A card's identity: its acronym, full name, and description together
def version_of(card):
    """Return the tuple that identifies this exact version of a card."""
    return (card["acronym"].casefold(), card["full_name"].casefold(), card["description"])

# 2c. Find which row in a file holds this exact version of the card
def find_row(rows, card):
    """Return the position of the first row with this exact version, or None if no row matches."""
    for position, row in enumerate(rows):
        if version_of(row) == version_of(card):
            return position
    return None

# 2d. Find every built-in deck that holds this exact version of the card
def decks_with_version(card):
    """Return (label, filename) for every built-in deck that has this exact version."""
    found = []
    for label, filename in BUILTIN_DECKS:
        if find_row(read_rows(filename), card) is not None:
            found.append((label, filename))
    return found

# 3. Update master.csv: add the new version, drop the old one only if no deck still uses it
def update_master(old_entry, new_entry):
    """Apply the version rule to master.csv after the decks have been saved."""
    master_rows = read_rows(MASTER_FILE)

    position = find_row(master_rows, new_entry)
    if position is None:
        master_rows.append(new_entry)                                   # new version: add it
    else:
        master_rows[position] = new_entry                               # already there: take the new spelling

    if not decks_with_version(old_entry):                               # no deck uses the old version anymore
        position = find_row(master_rows, old_entry)
        if position is not None:
            master_rows.pop(position)

    write_sorted(MASTER_FILE, master_rows)
