"""mezmerize: one menu that runs the mezmerize acronym tools."""
import flashcards
import manage_acronyms
import manage_decks

from mez_common import clear_screen, print_mode_banner, print_wrapped, read_key, say_goodbye


# Menu label and the function that runs that program
PROGRAMS = [
    ("Study Mode: Review flashcards in order or quiz at random; all decks or by category", flashcards.main),
    ("Look up and manage acronyms (all decks)", manage_acronyms.main),
    ("Manage decks and deck health", manage_decks.main),
]


def choose_program():
    """Show the menu. Return the choose program's main function, or None to quit."""
    program_keys = [str(number) for number in range(1, len(PROGRAMS) + 1)]

    clear_screen()
    print_mode_banner("MEZMERIZE")
    print("\nWhat would you like to do?\n")

    for number, (label, run) in enumerate(PROGRAMS, start=1):
        print_wrapped(f"{number}. ", label)
    print()
    print("ESC or Q = quit")

    choice = read_key(program_keys + ["esc", "q"])                          # waits for 1-3, ESC or Q
    if choice in ("esc", "q"):
        return None
    label, run = PROGRAMS[int(choice) - 1]
    return run

def main():
    """Run programs from the menu until the user quits."""
    while True:
        run = choose_program()
        if run is None:
            return
        if run() == "quit":
            return
        # anything else means ESC: show the menu again


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:                                               # Ctrl+C: skip the traceback, exit cleanly
        pass
    say_goodbye()