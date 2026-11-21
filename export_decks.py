"""
export_decks: copy the built-in decks into the web app.
Reads every built-in deck in the data folder and writes web/decks.js, the file the
web page loads its cards from. Run it after cards change: py export_decks.py
"""
import json
import os
from datetime import date

from mez_common import BUILTIN_DECKS, csv_path, load_flashcards, program_folder
from mez_cards import FIELDS

WEB_FOLDER = "web"                                                          # the web app's folder
DECKS_FILE = "decks.js"                                                     # the file the web page loads


# 1. build_decks()
# 2. write_decks(decks)
# 3. Main program


# 1. Gather every built-in deck, in menu order
def build_decks():
    """Return a list of {"label", "cards"}; each card holds just the three FIELDS."""
    decks = []
    for label, filename in BUILTIN_DECKS:
        if not os.path.exists(csv_path(filename)):
            print(f"Skipped {filename}: file not found.")
            continue
        cards = [{field: card[field] for field in FIELDS} for card in load_flashcards(filename, label)]
        cards.sort(key=lambda card: card["acronym"].casefold())
        decks.append({"label": label, "cards": cards})
    return decks

# 2. Write the decks as a JavaScript file the web page can load
def write_decks(decks):
    """Write web/decks.js and return its full path."""
    path = os.path.join(program_folder(), WEB_FOLDER, DECKS_FILE)
    data = {"exported": date.today().isoformat(), "decks": decks}
    with open(path, mode="w", encoding="utf-8", newline="\n") as file:
        file.write("// Made by export_decks.py from the data folder. Don't edit by hand:\n")
        file.write("// change the cards, then run  py export_decks.py  again.\n")
        file.write("window.MEZ_DECKS = ")
        json.dump(data, file, ensure_ascii=False, indent=1)
        file.write(";\n")
    return path


# 3. Main program
def main():
    """Export the decks and say what was written."""
    decks = build_decks()
    path = write_decks(decks)
    total = sum(len(deck["cards"]) for deck in decks)
    print(f"Wrote {total} cards from {len(decks)} decks to {path}")


# This runs the program when you type: py export_decks.py
if __name__ == "__main__":
    main()
