import os
import random

from mez_common import (BUILTIN_DECKS, CARD_WIDTH, DATA_FOLDER, clear_screen, csv_path,
                        input_or_esc, load_all_builtin, load_flashcards, overwrite_line,
                        print_mode_banner, print_wrapped, read_key, say_goodbye, ORANGE,
                        color_keys, menu_key)
from manage_acronyms import lookup_acronym

# 1. show_card
# 2. resolve_csv_path
# 3. choose_deck
# 4. (Main program loop)


# 1. Show a single flashcard with the option to reveal or go back to menu
def show_card(card, number=None, total=None):
    """ Show one flashcard, reveal on ENTER, or go back to menu on ESC."""
    if number is not None and total is not None:
        print(f" Card {number} of {total} ".center(CARD_WIDTH, "="))
    else:
        print("=" * CARD_WIDTH)
    print_wrapped("DECK:        ", card.get("deck", ""), lead_color=ORANGE, text_color=ORANGE)
    print(f"ACRONYM:     {card['acronym']}")
    if overwrite_line("ENTER = reveal    ESC = menu") == "esc":
        return "esc"

    print_wrapped("FULL NAME:   ", card["full_name"])
    print_wrapped("DESCRIPTION: ", card["description"])
    print("=" * CARD_WIDTH)

    return overwrite_line("ENTER = next card    ESC = menu")


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
        print(f"{menu_key('C')} Load a custom CSV deck")
        print()
        print(color_keys("ESC = back    Q = quit"))

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
            print(f"{menu_key(1)} Review all cards in order")
            print(f"{menu_key(2)} Random quiz mode")
            print(f"{menu_key(3)} Look up a specific acronym")
            print()
            print(color_keys("ESC = Choose a different deck    Q = quit"))

            choice = read_key(("1", "2", "3", "esc", "q"))

            if choice == "1":
                clear_screen(margin=False)
                print_mode_banner("STUDY MODE - Review")
                total = len(flashcards)
                for number, card in enumerate(flashcards, start=1):
                    if show_card(card, number=number, total=total) == "esc":
                        break

            elif choice == "2":
                clear_screen(margin=False)
                print_mode_banner("STUDY MODE - Quiz")
                quiz_cards = random.sample(flashcards, len(flashcards))     # shuffle the cards
                total = len(quiz_cards)
                for number, card in enumerate(quiz_cards, start=1):
                    if show_card(card, number=number, total=total) == "esc":
                        break

            elif choice == "3":
                if lookup_acronym(flashcards, deck_name) == "quit":
                    return "quit"

            elif choice == "esc":
                break                                                       # back to the deck loop

            elif choice == "q":
                return "quit"                                               # leave main() entirely


# This runs the program when you type: py flashcards.py
if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:                                               # Ctrl-C: skip the traceback, exit cleanly
        pass
    say_goodbye()