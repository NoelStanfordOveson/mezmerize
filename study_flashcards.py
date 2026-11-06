"""
study_flashcards: study a deck, one card at a time.
A program floor: look up a card, review a deck in order, or quiz by acronym or
by full name. Each card starts with its answers blank and fills in on ENTER.
+ shows which decks hold the card, and a number switches to that deck.
"""
import os
import random
import shutil
import textwrap

from mez_common import (BUILTIN_DECKS, CARD_WIDTH, DATA_FOLDER, clear_screen, csv_path,
                        input_or_esc, load_all_builtin, load_flashcards, overwrite_line,
                        print_mode_banner, print_wrapped, read_key, say_goodbye, ORANGE,
                        color_keys, menu_key, SAVE_CURSOR, RESTORE_CURSOR, ERASE_BELOW)
from mez_cards import FIELDS
from manage_acronyms import lookup_acronym, show_deck_finder

VALUE_COLUMN = 13                                                           # a card's values start here
BANNER_LINES = 3                                                            # height of the study banner


# 1. Show the cards
# 1a. draw_card(card, number, total, hidden=())
# 1b. card_height(card)
# 1c. show_card(card, number, total, hidden)
# 1d. ask_next()
# 1e. study_cards(cards, banner, hidden)
# 2. resolve_csv_path(name)
# 3. choose_deck()
# 4. Main program loop


# 1. Show the cards
# 1a. Draw one card
def draw_card(card, number, total, hidden=()):
    """Print the whole card. Any field named in hidden stays blank."""
    shown = {field: "" if field in hidden else card[field] for field in FIELDS}
    print(f" Card {number} of {total} ".center(CARD_WIDTH, "="))
    print_wrapped("DECK:        ", card.get("deck", ""), lead_color=ORANGE, text_color=ORANGE)
    print(f"ACRONYM:     {shown['acronym']}")
    print_wrapped("FULL NAME:   ", shown["full_name"])
    print_wrapped("DESCRIPTION: ", shown["description"])
    print("=" * CARD_WIDTH)

# 1b. Measure a card at its full size
def card_height(card):
    """Return how many screen lines the card takes once every field is filled in."""
    lines = 3                                                               # the two rules and ACRONYM:
    for text in (card.get("deck", ""), card["full_name"], card["description"]):
        lines += len(textwrap.wrap(text, CARD_WIDTH - VALUE_COLUMN)) or 1   # a blank field still takes a line
    return lines

# 1c. Show one card, then fill it in on ENTER
def show_card(card, number, total, hidden):
    """Show the card with its hidden fields blank; ENTER fills them in, ESC goes back to the menu."""
    print(SAVE_CURSOR, end="")
    draw_card(card, number, total, hidden)
    if overwrite_line("ENTER = reveal    ESC = menu") == "esc":
        return "esc"

    print(RESTORE_CURSOR + ERASE_BELOW, end="")
    draw_card(card, number, total)
    return ask_next()

# 1d. Ask what's next, once the card is filled in
def ask_next():
    """Return 'enter', '+', or 'esc', and erase the key line."""
    keys = "ENTER = next card    + = decks    ESC = menu"
    print(color_keys(keys), end="", flush=True)
    action = read_key(("enter", "+", "esc"))
    print("\r" + " " * len(keys) + "\r", end="", flush=True)
    return action

# 1e. Run through the cards, stacking them down the screen
def study_cards(cards, banner, hidden):
    """
    Stack the cards down the screen; when the next one won't fit, start a new screen.
    Return None when done or on ESC, 'quit' for Q, or the (label, filename) picked with +.
    """
    window_lines = shutil.get_terminal_size(fallback=(CARD_WIDTH, 24)).lines
    lines_used = window_lines                                               # forces a new screen for the first card
    for number, card in enumerate(cards, start=1):
        height = card_height(card)
        if lines_used + height + 1 > window_lines:
            clear_screen(margin=False)
            print_mode_banner(banner)
            lines_used = BANNER_LINES
        action = show_card(card, number, len(cards), hidden)
        while action == "+":
            picked = show_deck_finder(card, card["deck"], "STUDY MODE - Deck Finder")
            if picked != "back":
                return picked
            clear_screen(margin=False)
            print_mode_banner(banner)
            lines_used = BANNER_LINES
            draw_card(card, number, len(cards))
            action = ask_next()
        if action == "esc":
            return None
        lines_used += height
    return None

# 2. Turn what the user typed into a full path to a CSV file
def resolve_csv_path(name):
    """Turn what the user typed into a full path to a CSV"""
    name = name.strip().strip('"')                                          # Remove whitespace and quotes
    if not name.lower().endswith(".csv"):
        name = name + ".csv"
    if os.path.isabs(name):
        return name
    return csv_path(name)

# 3. Flashcard deck chooser
def choose_deck():
    """
    Let the user choose a built-in deck, all decks, or their own CSV.
    Returns (label, cards), or 'back' for ESC, or 'quit' for Q.
    """
    deck_keys = [str(number) for number in range(1, len(BUILTIN_DECKS) + 1)]

    while True:
        clear_screen()
        print_mode_banner("STUDY MODE - Deck List")
        print("\nWhich deck do you want to study?\n")

        for number, (label, filename) in enumerate(BUILTIN_DECKS, start=1):
            exists = " " if os.path.exists(csv_path(filename)) else " (file not found yet)"
            print(f"{menu_key(number)} {label}{exists}")

        print(f"{menu_key('A')} All Built-in Decks")
        print(f"{menu_key('C')} Load a custom deck")
        print()
        print(color_keys("ESC = back    Q = quit"), end="", flush=True)

        choice = read_key(deck_keys + ["a", "c", "esc", "q"])

        if choice == "esc":
            return "back"
        if choice == "q":
            return "quit"

        if choice in deck_keys:
            label, filename = BUILTIN_DECKS[int(choice) - 1]
            if not os.path.exists(csv_path(filename)):
                print(f"\nCreate {filename} in the {DATA_FOLDER} folder first?")
                input("Press Enter to continue...")
                continue
            return label, load_flashcards(filename, label)

        if choice == "a":
            cards, missing = load_all_builtin()
            if missing:
                print("\nSkipped missing files:", ", ".join(missing))
                input("Press ENTER to continue...")
            if not cards:
                print("No decks found yet.")
                input("Press ENTER to continue...")
                continue
            return "ALL DECKS", cards

        if choice == "c":
            print(f"\nType a deck name from the {DATA_FOLDER} folder (.csv is appended for you),")
            print(color_keys("or a full path such as C:\\Decks\\mine.csv     (ESC = cancel)"))

            name = input_or_esc("Deckname or Full Pathname: ")
            if name is None or not name.strip():
                continue

            path = resolve_csv_path(name)
            if not os.path.exists(path):
                print(f"File not found: {path}")
                input("Press ENTER to continue...")
                continue

            deck_label = os.path.basename(path)
            return deck_label, load_flashcards(path, deck_label)


# 4. Main program loop
def main():
    """Run the flashcards app. Return 'back' (ESC) or 'quit' (Q)."""
    while True:                                                             # deck loop
        result = choose_deck()
        if result in ("back", "quit"):
            return result
        deck_name, flashcards = result

        if not flashcards:
            print("That deck has no cards yet.")
            input("Press ENTER to continue...")
            continue

        while True:                                                         # mode loop for this deck
            clear_screen()
            print_mode_banner("STUDY MODE - Menu")

            print(f"\nDeck: {deck_name}")
            print(f"Loaded {len(flashcards)} flashcards! 🎉\n")
            print("What would you like to do?")
            print(f"{menu_key(1)} Look up a specific acronym")
            print(f"{menu_key(2)} Review all cards in order")
            print(f"{menu_key(3)} Random quiz by acronym")
            print(f"{menu_key(4)} Random quiz by full name")
            print()
            print(color_keys("ESC = Choose a different deck    Q = quit"), end="", flush=True)

            choice = read_key(("1", "2", "3", "4", "esc", "q"))

            went = None                                                     # where the user went from here
            if choice == "1":
                went = lookup_acronym(flashcards, deck_name)

            elif choice == "2":
                went = study_cards(flashcards, "STUDY MODE - Review", ("full_name", "description"))

            elif choice == "3":
                quiz_cards = random.sample(flashcards, len(flashcards))     # shuffle the cards
                went = study_cards(quiz_cards, "STUDY MODE - Quiz by Acronym", ("full_name", "description"))

            elif choice == "4":
                named_cards = [card for card in flashcards if card["full_name"]]    # skip any with no full name
                quiz_cards = random.sample(named_cards, len(named_cards))   # shuffle the cards
                went = study_cards(quiz_cards, "STUDY MODE - Quiz by Full Name", ("acronym", "description"))

            elif choice == "esc":
                break                                                       # back to the deck loop

            elif choice == "q":
                return "quit"                                               # leave main() entirely

            if went == "quit":
                return "quit"
            if went not in (None, "back"):                                  # the user changed decks with +
                deck_name, filename = went
                flashcards = load_flashcards(filename, deck_name)


# This runs the program when you type: py study_flashcards.py
if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:                                               # Ctrl-C: skip the traceback, exit cleanly
        pass
    say_goodbye()