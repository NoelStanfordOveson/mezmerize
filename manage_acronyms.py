"""
manage_acronyms: look up, add, edit, and delete acronyms.
A program floor: the screens, prompts, and keys for managing cards. The card
logic itself (reading, comparing, writing) lives in mez_cards, one floor down.
"""
import ctypes
from ctypes import wintypes

from mez_common import (BUILTIN_DECKS, clear_screen, print_mode_banner, print_wrapped,
                        CARD_WIDTH, overwrite_line, read_key, input_or_esc, say_goodbye,
                        load_all_builtin, COLUMN_GAP, ORANGE, BLUE, colored, color_keys,
                        color_words, menu_key)
from mez_cards import (MASTER_FILE, BACKUP_FILE, FIELDS, read_rows, write_sorted, deck_file_for,
                       version_of, find_row, decks_with_acronym, decks_with_version, update_master)

RESULT_LEAD = colored("RESULT:  ", BLUE)                                # every RESULT line starts with this
NO_CHANGES = colored("NO CHANGES", BLUE)                                # as in "NO CHANGES were made."


# 1. Pre-filled typing (Windows console)
# 1a. Windows keystroke records (classes)
# 1b. prefill
# 1c. input_prefilled

# 2. choose_target_deck

# 3. Interactive
# 3a. ask_for_entry
# 3b. ok_to_add
# 3c. confirm_add
# 3d. save_entry
# 3e. add_to_deck
# 3f. add_another
# 3g. add_from_lookup
# 3h. add_acronyms

# 4. Manage Elements
# 4a. show_full_card
# 4b. show_caution
# 4c. ask_or_cancel
# 4d. lookup_acronym
# 4e. lookup_all_decks
# 4f. wrap_choices
# 4g. choose_edit_scope
# 4h. pick_from_matches
# 4i. ask_this_or_all
# 4j. print_decks
# 4k. list_labels

# 5. Edit
# 5a. ask_for_edits
# 5b. confirm_edits
# 5c. edit_card

# 6. Delete
# 6a. confirm_delete
# 6b. type_to_confirm
# 6c. confirm_removal_in_master
# 6d. delete_card

# 7. Copy
# 7a. choose_destination
# 7b. confirm_copy
# 7c. copy_card

# 8. Move
# 8a. confirm_move
# 8b. move_card

# 9. Main program loop


# 1. Pre-filled typing (Windows console)
# 1a. Windows keystroke records (used to pre-fill the console line editor)
class KEY_EVENT_RECORD(ctypes.Structure):
    _fields_ = [("bKeyDown", wintypes.BOOL), ("wRepeatCount", wintypes.WORD),
                ("wVirtualKeyCode", wintypes.WORD), ("wVirtualScanCode", wintypes.WORD),
                ("uChar", wintypes.WCHAR), ("dwControlKeyState", wintypes.DWORD)]

class EVENT_UNION(ctypes.Union):
    _fields_ = [("KeyEvent", KEY_EVENT_RECORD)]

class INPUT_RECORD(ctypes.Structure):
    _fields_ = [("EventType", wintypes.WORD), ("Event", EVENT_UNION)]

# 1b. Put text into the console's typing buffers if it has been typed
def prefill(text):
    """Make the next input() start with this text already typed in."""
    records = (INPUT_RECORD * (len(text) *2))()
    for i, ch in enumerate(text):
        for j, down in enumerate((True, False)):                        # key down, then key up
            record = records[i * 2 + j]
            record.EventType = 0x0001                                   # KEY_EVENT
            record.Event.KeyEvent.bKeyDown = down
            record.Event.KeyEvent.wRepeatCount = 1
            record.Event.KeyEvent.uChar = ch
    handle = ctypes.windll.kernel32.GetStdHandle(-10)                   # the keyboard input
    written = wintypes.DWORD()
    ctypes.windll.kernel32.WriteConsoleInputW(handle, records, len(records), ctypes.byref(written))

# 1c. Type a line with the old text already filled in, in the console's own editor
def input_prefilled(prompt, default):
    """
    Show the prompt with the old text already typed in, ready to edit.
    Arrows, Home, End and Backspace all work. Returns the edited text.
    """
    prefill(default.replace("\n", " "))
    return input(prompt).strip()


# 2. Choose which deck gets the new acronym
def choose_target_deck():
    """
    Show the built-in decks.
    Returns (label, filename), 'back' for ESC, or 'quit' for Q.
    """
    deck_keys = [str(number) for number in range(1, len(BUILTIN_DECKS) + 1)]

    clear_screen()
    print_mode_banner("ADD AN ACRONYM - Deck List")
    print("\nWhich deck gets the new acronym?\n")
    for number, (label, filename) in enumerate(BUILTIN_DECKS, start=1):
        print(f"{menu_key(number)} {label}")
    print()
    print(color_keys("ESC = back    Q = quit"), end="", flush=True)

    choice = read_key(deck_keys + ["esc", "q"])
    if choice == "esc":
        return "back"
    if choice == "q":
        return "quit"
    return BUILTIN_DECKS[int(choice) -1]


# 3. Interactive
# 3a. Ask for the new acronym's details
def ask_for_entry(label, acronym=None):
    """
    Show the deck, then ask for acronym, full name, and
    description.
    If an acronym is passed in (from a lookup), show it instead of asking.
    Returns a dict, or None if ESC was pressed at any prompt.
    """
    print(color_keys("\nEnter the new acronym.     (ESC = back to the deck list)\n"))

    print_decks([label], holds=False)                                   # not in this deck yet
    if acronym is None:
        acronym = input_or_esc("Acronym:     ", required=True)
        if acronym is None:
            return None
    else:
        print(f"Acronym:     {acronym}")

    full_name = input_or_esc("Full name:   ", width=CARD_WIDTH)
    if full_name is None:
        return None

    description = input_or_esc("Description: ", width=CARD_WIDTH)
    if description is None:
        return None

    return {
        "acronym": acronym.strip(),
        "full_name": full_name.strip(),
        "description": description.strip(),
    }

# 3b. Check for duplicates before adding
def ok_to_add(entry, label, deck_rows, master_rows):
    """
    Return True if the entry should be added, False to skip it. Only the exact
    same version in this deck is refused; anything close is shown first.
    """
    def add_anyway():
        """Ask Y / N and leave the chosen answer on the line. Return True for Y."""
        prompt = "Add anyway?  Y = yes     N or ESC = no"
        print(color_keys(prompt), end="", flush=True)
        answer = read_key(("y", "n", "esc"))

        if answer == "y":
            chosen = "Add anyway?  Y = yes"
        else:
            chosen = "Add anyway?              N or ESC = no"
        print("\r" + " " * len(prompt) + "\r" + color_keys(chosen))

        if answer != 'y':
            print(f"\n{RESULT_LEAD}Nothing was added.")
            print(f"         {NO_CHANGES} were made.")
            return False
        return True

    acronym = entry["acronym"]
    if find_row(deck_rows, entry) is not None:                          # exact version already in this deck
        whole_label = label.replace(" ", "\u00a0")
        print()
        print_wrapped("", f"{acronym} already in {whole_label}, exactly as entered.",
                      words=[whole_label], words_color=ORANGE)
        print(f"\n{RESULT_LEAD}Nothing was added.")
        print(f"         {NO_CHANGES} were made.")
        return False

    others = [other for other, _ in decks_with_version(entry)]          # exact version in other decks
    if others:
        print()
        if len(others) == 1:
            whole_other = others[0].replace(" ", "\u00a0")
            print_wrapped("", f"{acronym} already in {whole_other}, exactly as entered.",
                          words=[whole_other], words_color=ORANGE)
        else:
            print_wrapped("", f"{acronym} already in ({len(others)}) decks, exactly as entered:")
            width = max(len(other) for other in others) + COLUMN_GAP    # longest label plus the gap
            for start in range(0, len(others), 2):                      # two labels per line
                left = others[start]
                right = others[start +1] if start + 1 < len(others) else ""
                print(f"  {colored(f'{left:<{width}}', ORANGE)}{colored(right, ORANGE)}")
        print()
        print(color_keys("Tip: use C = copy from a lookup next time, if applicable."))
        print()
        return add_anyway()

    new_acronym = acronym.casefold()
    new_name = entry["full_name"].casefold()
    matches = [row for row in master_rows + deck_rows
               if row["acronym"].casefold() == new_acronym and version_of(row) != version_of(entry)]
    descriptions = {row["description"] for row in matches
                    if row["full_name"].casefold() == new_name and row["description"]}
    full_names = {row["full_name"] for row in matches if row["full_name"].casefold() != new_name}

    if descriptions:
        print()
        print_wrapped("", f"{acronym} ({entry['full_name']}) already exists with a different description:")
        for description in sorted(descriptions):
            print_wrapped("  - ", description)
    elif full_names:
        print(f"\n{acronym} already exists with a different full name:")
        for name in sorted(full_names):
            print(f"  - {name}")
    else:
        return True                                                     # new, or only a blank backlog row to fill in
    print()
    return add_anyway()

# 3c. Show the PENDING WRITE card; ask before saving; on ESC, redraw it with the result
def confirm_add(entry, label, files):
    """
    Show what will be saved on a clean screen. Return True for ENTER. On ESC,
    redraw the screen without the CAUTION title, show the RESULT, and return False.
    """
    def draw(state):
        heading = "WRITTEN TO:" if state == "confirmed" else "WRITE TO:"
        clear_screen()
        print_mode_banner("ADD AN ACRONYM")
        print()
        show_caution([(heading, files)], entry=entry, labels=[label], holds=state == "confirmed",
                     title="PENDING WRITE", caution=state == "ask")

    whole_label = label.replace(" ", "\u00a0")                          # keep the deck name on one line
    return ask_or_cancel(draw, f"Add this card to {whole_label} now?",
                         "ENTER = save it     ESC = forget it", "saved")

# 3d. Check, confirm and save one new entry to its deck and master
def save_entry(entry, label, filename):
    """
    Check for duplicates, ask to confirm, then add the entry to its deck and master.csv.
    Return True if it was saved, False if not.
    """
    master_rows = read_rows(MASTER_FILE)
    deck_rows = read_rows(filename)

    if not ok_to_add(entry, label, deck_rows, master_rows):
        return False

    files = [filename]
    if find_row(master_rows, entry) is None:                            # master doesn't have this version yet
        files.append(MASTER_FILE)
    if not confirm_add(entry, label, files):
        return False

    deck_rows.append(entry)
    write_sorted(filename, deck_rows)
    if MASTER_FILE in files:
        backlog = find_row(master_rows, dict(entry, description=""))    # the same card with no description yet
        if backlog is None:
            master_rows.append(entry)
        else:
            master_rows[backlog] = entry                                # fill in the description
        write_sorted(MASTER_FILE, master_rows)

    print()
    print_wrapped("RESULT:  ", f"Saved. {entry['acronym']} was added to and re-sorted in:",
                  lead_color=BLUE)
    list_labels([label])
    return True

# 3e. Keep adding acronyms to one deck
def add_to_deck(label, filename):
    """Add acronyms to one deck. Return 'back' (ESC = deck list) or 'quit' (Q)."""
    while True:
        clear_screen()
        print_mode_banner("ADD AN ACRONYM")

        entry = ask_for_entry(label)
        if entry is None:
            return "back"                                               # ESC while typing

        save_entry(entry, label, filename)

        action = add_another()
        if action == "esc":
            return "back"
        if action == "q":
            return "quit"

# 3f. After each result: add another, or go back to the deck menu
def add_another():
    """Return 'enter' (add another), 'esc' (deck list), or 'q' (quit)."""
    print()
    print(color_keys("ENTER = add another    ESC = deck list    Q = quit"), end="", flush=True)
    return read_key(("enter", "esc", "q"))

# 3g. Add the acronym from a lookup
def add_from_lookup(acronym):
    """
    Called from the lookup (A = add), found or not.
    Pick a deck, add this one acronym, then add another or go back.
    Return (choice, added): choice is 'lookup', 'menu' or 'quit';
    added is the list of cards saved, each carrying its deck name.
    """
    added = []
    while True:                                                         # deck list loop
        result = choose_target_deck()
        if result == "back":
            return "lookup", added
        if result == "quit":
            return "quit", added

        label, filename = result
        clear_screen()
        print_mode_banner("ADD AN ACRONYM")

        entry = ask_for_entry(label, acronym)
        if entry is None:
            continue                                                    # ESC while typing: back to the deck list

        if save_entry(entry, label, filename):
            entry["deck"] = label                                       # lookup cards carry their deck name
            added.append(entry)

        print()
        print(color_keys("A = add another"))
        print(color_keys("ENTER = back to lookup    ESC = menu    Q = quit"), end="", flush=True)

        choice = read_key(("a", "enter", "esc", "q"))
        if choice == "a":
            continue                                                    # same acronym, back to the deck list
        if choice == "esc":
            return "menu", added
        if choice == "q":
            return "quit", added
        return "lookup", added

# 3h. Pick a deck, then keep adding acronyms to it
def add_acronyms():
    """Pick a deck and add acronyms to it. Return 'back' (ESC) or 'quit' (Q)"""
    while True:                                                         # deck list loop
        result = choose_target_deck()
        if result in ("back", "quit"):
            return result

        label, filename = result
        if add_to_deck(label, filename) == "quit":
            return "quit"                                               # anything else means ESC: loop back to the deck list


# 4. Manage Elements
# 4a. Show a full single card without options
def show_full_card(card, title=None, labels=None, holds=True):
    """
    Show every field at once. An optional title is centered in the top rule.
    labels lists every deck in scope; without it, the card's own deck is shown.
    holds=False shows the deck names plain (the card is no longer there).
    """
    if title:
        print(f" {title} ".center(CARD_WIDTH, "="))
    else:
        print("=" * CARD_WIDTH)
    print_decks(labels or [card.get("deck", "")], holds)
    print(f"ACRONYM:     {card['acronym']}")
    print_wrapped("FULL NAME:   ", card["full_name"])
    print_wrapped("DESCRIPTION: ", card["description"])
    print("=" * CARD_WIDTH)

# 4b. Show the CAUTION card: a titled star box with the card's fields and the files that will change
def show_caution(sections, entry=None, labels=None, holds=False, title="CAUTION", caution=True):
    """
    Print the CAUTION card. sections is a list of (heading, files) pairs: one heading,
    then its files lined up at column 13. caution=False draws a plain star line instead
    of the title (used once the card is answered). The caller prints its own question.
    holds=True colors the deck names orange (the decks hold this card right now).
    """
    if caution:
        print(f" ⚠️  {title}  ⚠️ ".center(CARD_WIDTH, "*"))
    else:
        print("*" * CARD_WIDTH)
    if labels:
        print_decks(labels, holds)
    if entry:
        print(f"ACRONYM:     {entry['acronym']}")
        print_wrapped("FULL NAME:   ", entry["full_name"] or "(blank)")
        print_wrapped("DESCRIPTION: ", entry["description"] or "(blank)")
        print()

    for heading, files in sections:
        print(f"{heading:<13}{files[0]}")
        for filename in files[1:]:
            print(f"{'':<13}{filename}")
    print("*" * CARD_WIDTH)

# 4c. Draw a confirm screen, ask, then redraw it without its title; on ESC, show the RESULT
def ask_or_cancel(draw, question, keys, verb, words=()):
    """
    Draw the screen with draw("ask"), ask the question, then redraw it with
    draw("confirmed") for ENTER, draw("cancelled") for ESC. Return True for ENTER.
    On ESC, print the "Nothing was <verb>." RESULT and return False.
    words (deck labels that hold the card) are colored orange in the question.
    """
    draw("ask")
    print()
    print_wrapped("", question, words=words, words_color=ORANGE)
    print()

    answer = overwrite_line(keys)
    draw("confirmed" if answer == "enter" else "cancelled")
    if answer == "enter":
        return True
    print(f"\n{RESULT_LEAD}Nothing was {verb}.")
    print(f"         {NO_CHANGES} were made.")
    return False

# 4d. Look up a flashcard by acronym
def lookup_acronym(flashcards, deck_name):
    """
    Look up acronyms until the user leaves.
    Return 'back' for ESC or 'quit' for Q.
    """
    def next_step():
        """After an edit, delete, copy, or move: None to stay, 'back' for ESC, 'quit' for Q."""
        print()
        print(color_keys("ENTER = back to lookup    ESC = menu    Q = quit"), end="", flush=True)
        choice = read_key(("enter", "esc", "q"))
        if choice == "esc":
            return "back"
        if choice == "q":
            return "quit"
        return None

    while True:
        clear_screen(margin=False)
        print_mode_banner("LOOKUP")
        print()

        query = input_or_esc("Acronym to look up (ESC = menu): ", required=True)
        if query is None:
            return "back"
        query = query.strip()

        query_upper = query.upper()
        matches = [
            card for card in flashcards
            if card["acronym"].strip().upper() == query_upper
        ]

        elsewhere = []
        if deck_name != "ALL DECKS":
            elsewhere = [label for label in decks_with_acronym(query) if label != deck_name]

        if not matches:
            if elsewhere:
                print(f'\nNo card found for "{query}" in this deck.')
                print_wrapped("Found in: ", ", ".join(label.replace(" ", "\u00a0") for label in elsewhere),
                              lead_color=ORANGE, text_color=ORANGE)     # non-breaking spaces keep names whole
                print(f"          ({len(elsewhere)} total)")
            else:
                print(f'\nNo card found for "{query}".')
        else:
            if deck_name == "ALL DECKS":
                print(f"\nFound {len(matches)} card(s) for {query_upper}.")
            elif len(matches) == 1:
                print(f"\nFound {query_upper}.")
            else:
                print(f"\nFound {len(matches)} cards for {query_upper}.")

            if elsewhere:
                counts = f"{len(elsewhere) + 1} total"
                if len(matches) == 1:
                    identical = len(decks_with_version(matches[0]))
                    if identical > 1:
                        counts += f", {identical} identical"
                print_wrapped("Also in: ", ", ".join(label.replace(" ", "\u00a0") for label in elsewhere),
                              lead_color=ORANGE, text_color=ORANGE)
                print(f"         ({counts})")
            print()
            for number, card in enumerate(matches, start=1):
                show_full_card(card, title=f"Match {number} of {len(matches)}")

        keys = ["enter", "esc", "q", "a"]
        actions = ["A = add"]                                           # add is offered on every lookup

        if any(deck_file_for(card["deck"]) for card in matches):
            keys += ["e", "d", "c", "m"]
            actions += ["E = edit", "D = delete", "C = copy", "M = move"]

        print()
        print(color_keys("    ".join(actions)))
        print(color_keys("ENTER = look up another    ESC = menu    Q = quit"), end="", flush=True)

        action = read_key(keys)
        if action == "a":
            choice, added = add_from_lookup(query)
            for card in added:                                          # show new cards in this lookup
                if deck_name == "ALL DECKS" or card["deck"] == deck_name:
                    flashcards.append(card)
            flashcards.sort(key=lambda card: card["acronym"].casefold())
            if choice == "menu":
                return "back"
            if choice == "quit":
                return "quit"
        elif action == "e":
            scope = choose_edit_scope(matches)
            if scope is not None:
                card, decks = scope
                updated = edit_card(card, decks)
                if updated:
                    labels = [label for label, filename in decks]
                    for position, shown in enumerate(flashcards):
                        if shown["deck"] in labels and version_of(shown) == version_of(card):
                            flashcards[position] = {**updated, "deck": shown["deck"]}
                    flashcards.sort(key=lambda card: card["acronym"].casefold())
                leave = next_step()
                if leave:
                    return leave
        elif action == "d":
            scope = choose_edit_scope(matches, "Delete")
            if scope is not None:
                card, decks = scope
                if delete_card(card, decks):
                    labels = [label for label, filename in decks]
                    for shown in flashcards[:]:                         # loop over a copy, so removing is safe
                        if shown["deck"] in labels and version_of(shown) == version_of(card):
                            flashcards.remove(shown)
                leave = next_step()
                if leave:
                    return leave
        elif action == "c":
            editable = [(number, card) for number, card in enumerate(matches, start=1)
                        if deck_file_for(card["deck"])]
            if len(editable) == 1:
                card = editable[0][1]
            else:
                picked = pick_from_matches(editable, "Copy", allow_all=False)
                card = picked[0] if picked else None
            if card is not None:
                result = copy_card(card)
                if result == "quit":
                    return "quit"
                if result != "back":
                    if result and deck_name == "ALL DECKS":
                        flashcards.append({**card, "deck": result})
                        flashcards.sort(key=lambda card: card["acronym"].casefold())
                    leave = next_step()
                    if leave:
                        return leave
        elif action == "m":
            editable = [(number, card) for number, card in enumerate(matches, start=1)
                        if deck_file_for(card["deck"])]
            if len(editable) == 1:
                card = editable[0][1]
            else:
                picked = pick_from_matches(editable, "Move", allow_all=False)
                card = picked[0] if picked else None
            if card is not None:
                result = move_card(card)
                if result == "quit":
                    return "quit"
                if result != "back":
                    if result:                                          # moved: it left its old deck
                        flashcards.remove(card)
                        if deck_name == "ALL DECKS":
                            flashcards.append({**card, "deck": result})
                            flashcards.sort(key=lambda card: card["acronym"].casefold())
                    leave = next_step()
                    if leave:
                        return leave
        elif action == "esc":
            return "back"
        elif action == "q":
            return "quit"

# 4e. Look up an acronym across all built-in decks
def lookup_all_decks():
    """Load every built-in deck, then run the lookup. Return 'back' or 'quit'."""
    cards, missing = load_all_builtin()
    if missing:
        print("\nSkipped missing files:", ", ".join(missing))
        input("Press ENTER to continue...")
    return lookup_acronym(cards, "ALL DECKS")

# 4f. Wrap key choices to the card width, never splitting a choice
def wrap_choices(lead, choices):
    """
    Put the lead text, then the choices 3 spaces apart, e.g. "1 = Cybersecurity".
    Start a new line before any choice that won't fit. Extra lines line up under the first choice.
    Return the text; the caller prints it.
    """
    indent = " " * len(lead)
    lines = [lead + choices[0]]
    for choice in choices[1:]:
        if len(lines[-1]) + 3 + len(choice) > CARD_WIDTH:               # 3 = the spaces between choices
            lines.append(indent + choice)                               # won't fit: start a new line
        else:
            lines[-1] += "   " + choice                                 # fits: add it to this line
    return "\n".join(lines)

# 4g. Decide which card to edit or delete, and which decks it applies to
def choose_edit_scope(matches, verb="Edit"):
    """
    Return (card, decks): the card to edit or delete, plus the (label, filename) decks
    the change applies to. verb ("Edit" or "Delete") is used in the prompts.
    Return None for ESC.
    """
    editable = [(number, card) for number, card in enumerate(matches, start=1)
                if deck_file_for(card["deck"])]
    if len(editable) > 1:
        return pick_from_matches(editable, verb)                        # screen 1

    card = editable[0][1]
    decks = decks_with_version(card)
    if len(decks) <= 1:
        return card, [(card["deck"], deck_file_for(card["deck"]))]      # one deck only: no question
    return ask_this_or_all(card, decks, verb)                           # screen 2

# 4h. Screen 1: several matches on screen; pick one deck, or A for all of them
def pick_from_matches(editable, verb="Edit", allow_all=True):
    """Ask which match to edit, delete, or copy, or A for all identical matches. Return (card, decks) or None."""
    choices = [f"{number} = {card['deck']}" for number, card in editable]

    keys = [str(number) for number, card in editable]
    extras = []
    first = editable[0][1]
    if allow_all and all(version_of(card) == version_of(first) for number, card in editable):
        extras.append("A = all decks (identical)")
        keys.append("a")
    extras.append("ESC = cancel")

    lead = f"{verb} which?  "
    labels = [card["deck"] for number, card in editable]
    print("\n\n" + color_keys(color_words(wrap_choices(lead, choices), labels, ORANGE)))
    print(color_keys(wrap_choices(" " * len(lead), extras)), end="", flush=True)

    choice = read_key(keys + ["esc"])
    if choice == "esc":
        return None
    if choice == "a":
        return first, decks_with_version(first)
    for number, card in editable:
        if str(number) == choice:
            return card, [(card["deck"], deck_file_for(card["deck"]))]

# 4i. Screen 2: one match on screen, copies elsewhere; D for this deck, or A for all of them
def ask_this_or_all(card, decks, verb="Edit"):
    """Confirm the choice; ask D (this deck only) or A (every deck with this identical card). Return (card, decks) or None"""
    print(f"\n\nYou chose {verb}.")
    print()
    lead = "     "
    print(color_keys(wrap_choices(lead, ["D = in this deck only", f"A = in all decks ({len(decks)} identical)"])))
    print(color_keys(wrap_choices(lead, ["ESC = cancel"])), end="", flush=True)

    choice = read_key(("d", "a", "esc"))
    if choice == "esc":
        return None
    if choice == "a":
        return card, decks
    return card, [(card["deck"], deck_file_for(card["deck"]))]

# 4j. Print the DECK: line, or DECKS: with every label when there are multiple
def print_decks(labels, holds=True):
    """
    Print DECK: <label>, or DECKS: with the labels comma-separated, each kept whole.
    The lead is always orange; the names are orange only when the decks hold the card.
    """
    names = ", ".join(label.replace(" ", "\u00a0") for label in labels)
    print_wrapped("DECK:        " if len(labels) == 1 else "DECKS:       ", names,
                  lead_color=ORANGE, text_color=ORANGE if holds else "")

# 4k. List deck labels under a RESULT, indented 2 under its text
def list_labels(labels, holds=True):
    """
    Print each deck label on its own line at column 11, 2 in from the RESULT text.
    Orange when the deck holds the card now (holds=True), plain when it doesn't.
    """
    for label in labels:
        print(f"{'':<11}{colored(label, ORANGE if holds else '')}")


# 5. Edit
# 5a. Show the edit screen and collect the new values
def ask_for_edits(card, labels):
    """
    Show the hint, the CURRENT card, and an EDITING card with each field pre-filled.
    labels are the decks being edited. Return the edited entry as a dict, or None
    if the acronym was left blank (cancel).
    """
    clear_screen()
    print_mode_banner("EDIT AN ACRONYM")
    print("Edit each field, then ENTER. ← → Home End move the cursor.")
    print("ESC clears a field. To cancel: clear ACRONYM, then ENTER.")
    print("Nothing is saved until you approve it on the next screen.")
    print()

    show_full_card(card, title="CURRENT", labels=labels)
    print(" EDITING ".center(CARD_WIDTH, "="))
    print_decks(labels)

    acronym = input_prefilled("ACRONYM:     ", card["acronym"])
    if not acronym:
        return None                                                     # blank acronym: cancel the edit
    full_name = input_prefilled("FULL NAME:   ", card["full_name"])
    description = input_prefilled("DESCRIPTION: ", card["description"])

    return {"acronym": acronym, "full_name": full_name, "description": description}

# 5b. Show the CURRENT and PENDING WRITE cards; ask before saving; on ESC, redraw with the result
def confirm_edits(card, new_entry, filenames, labels):
    """
    Show the CURRENT card and the PENDING WRITE card. Return True for ENTER. On ESC,
    redraw the screen without the PENDING WRITE title, show the RESULT, and return False.
    """
    def draw(state):
        confirmed = state == "confirmed"
        heading = "WRITTEN TO:" if confirmed else "WRITE TO:"
        clear_screen()
        print_mode_banner("EDIT AN ACRONYM")
        print()
        show_full_card(card, title="PREVIOUS" if confirmed else "CURRENT", labels=labels)
        show_caution([(heading, filenames + [MASTER_FILE])], entry=new_entry, labels=labels,
                     holds=True, title="PENDING WRITE", caution=state == "ask")

    where = labels[0].replace(" ", "\u00a0") if len(labels) == 1 else f"({len(labels)}) decks"
    return ask_or_cancel(draw, f"Save edits to {where} now?",
                         "ENTER = save it     ESC = forget it", "saved",
                         words=[labels[0].replace(" ", "\u00a0")])

# 5c. Edit one card in every deck in the scope, then update master.csv
def edit_card(card, decks):
    """
    Edit a built-in card in each deck in decks, a list of (label, filename) pairs.
    Then apply the versions rule to master.csv.
    Return the new entry, or None if nothing was saved.
    """
    loaded = []
    for label, filename in decks:
        rows = read_rows(filename)
        position = find_row(rows, card)
        if position is None:                                            # file changed since lookup
            cant = colored("Can't edit.", BLUE)
            print(f"\n{RESULT_LEAD}{cant} {card['acronym']} is no longer in {label}.")
            print(f"         {NO_CHANGES} were made. To find the mismatch, use")
            print("         Manage decks and deck health on the main menu.")
            return None
        loaded.append((filename, rows, position))

    labels = [label for label, filename in decks]
    new_entry = ask_for_edits(card, labels)
    if new_entry is None:
        print(f"\n{RESULT_LEAD}Nothing was saved.")
        print(f"         {NO_CHANGES} were made.")
        return None
    if all(new_entry[field] == card[field] for field in FIELDS):
        print(f"\n{RESULT_LEAD}No changes made. Nothing was saved.")
        return None

    filenames = [filename for label, filename in decks]
    if not confirm_edits(card, new_entry, filenames, labels):
        return None

    for filename, rows, position in loaded:
        rows[position] = new_entry
        write_sorted(filename, rows)
    update_master(card, new_entry)

    print()
    print_wrapped("RESULT:  ", f"Saved. {new_entry['acronym']} was edited and re-sorted in:",
                  lead_color=BLUE)
    list_labels(labels)
    return new_entry


# 6. Delete
# 6a. Show the PENDING DELETE card; ask before deleting; on ESC, redraw with the result
def confirm_delete(card, filenames, labels):
    """
    Show the PENDING DELETE card. Return True for ENTER. On ESC, redraw the
    screen without the PENDING DELETE title, show the RESULT, and return False.
    """
    def draw(state):
        heading = "ERASED FROM:" if state == "confirmed" else "DELETE FROM:"
        clear_screen()
        print_mode_banner("DELETE AN ACRONYM")
        print()
        show_caution([(heading, filenames)], entry=card, labels=labels, holds=state != "confirmed",
                     title="PENDING DELETE", caution=state == "ask")

    where = labels[0].replace(" ", "\u00a0") if len(labels) == 1 else f"({len(labels)}) decks"
    return ask_or_cancel(draw, f"Delete this card from {where} now?",
                         "ENTER = delete it     ESC = forget it", "deleted",
                         words=[labels[0].replace(" ", "\u00a0")])

# 6b. Have the acronym typed exactly; give a friendly hint and ask again until it matches
def type_to_confirm(acronym):
    """
    Keep asking until the acronym is typed exactly, letter case included.
    Return True when it matches, False for ESC.
    """
    prompt = f"Type {acronym} exactly, matching case (ESC = keep it): "
    while True:
        typed = input_or_esc(prompt, required=True)
        if typed is None:
            return False                                                # ESC: keep it
        typed = typed.strip()
        if typed == acronym:
            return True

        if typed.casefold() == acronym.casefold():
            hint = f"Close! But the capital letters don't match. Type {acronym} exactly as shown."
        elif len(typed) != len(acronym):
            chars = "character" if len(typed) == 1 else "characters"
            hint = f"That's {len(typed)} {chars}; {acronym} has {len(acronym)}. Try again."
        else:
            hint = f"Same length, but the letters aren't the same as {acronym}. Check typing and try again."
        print_wrapped("", hint)
        print()

# 6c. Last deck copy: ask whether to remove it from master.csv too, or keep it there as backlog
def confirm_removal_in_master(card):
    """
    Show the PENDING FINAL DELETE card for master.csv. Return True to remove it
    (R, then the acronym typed exactly). K or ESC keeps it as backlog; print that
    RESULT and return False.
    """
    def draw(state):
        if state == "confirmed":
            heading = "ERASED FROM:"
        elif state == "kept":
            heading = "KEPT IN:"
        else:
            heading = "DELETE FROM:"

        clear_screen()
        print_mode_banner("DELETE AN ACRONYM - Master")
        if state == "ask":                                              # the hint disappears once the question is answered
            print_wrapped("", f"{card['acronym']} is orphaned, left only in the master list. "
                          "Keep it there as backlog, or remove it\u2014a removal "
                          f"can't be undone. R\u00a0will ask for {card['acronym']} to be typed exactly first.")
        print()
        show_caution([(heading, [MASTER_FILE])], entry=card,
                     title="PENDING FINAL DELETE", caution=state == "ask")

    def kept():
        draw("kept")
        print()
        print_wrapped("RESULT:  ", f"Kept. {card['acronym']} stays in the master list as backlog.",
                      lead_color=BLUE)
        return False

    draw("ask")
    print()
    print("Remove this card from the master list now?")
    print()
    print(color_keys("R = remove it     K or ESC = keep it (backlog)"), end="", flush=True)

    if read_key(("r", "k", "esc")) != "r":
        return kept()
    print()
    print()
    if type_to_confirm(card["acronym"]):
        draw("confirmed")
        return True
    return kept()

# 6d. Delete one card from every deck in the scope; then remove it from master.csv if asked
def delete_card(card, decks):
    """
    Delete a card from each built-in deck in decks, a list of (label, filename) pairs.
    The decks are written as soon as the delete is confirmed. If that left the card
    orphaned (in no deck, only in master.csv), ask about master.csv next.
    Return True if the card was deleted, False if nothing changed.
    """
    loaded = []
    for label, filename in decks:
        rows = read_rows(filename)
        position = find_row(rows, card)
        if position is None:                                            # file changed since lookup
            cant = colored("Can't delete.", BLUE)
            print(f"\n{RESULT_LEAD}{cant} {card['acronym']} is no longer in {label}.")
            print(f"         {NO_CHANGES} were made. To find the mismatch, use")
            print("         Manage decks and deck health on the main menu.")
            return False
        loaded.append((filename, rows, position))

    filenames = [filename for label, filename in decks]
    labels = [label for label, filename in decks]
    if not confirm_delete(card, filenames, labels):
        return False

    for filename, rows, position in loaded:                             # ENTER confirmed: write the decks now
        rows.pop(position)
        write_sorted(filename, rows)

    remaining = decks_with_version(card)                                # decks that still have it
    master_rows = read_rows(MASTER_FILE)
    master_position = find_row(master_rows, card)

    print()
    print_wrapped("RESULT:  ", f"Deleted. {card['acronym']} was removed from:",
                  lead_color=BLUE)
    list_labels(labels, holds=False)
    if remaining:
        print("         It's still in:")
        list_labels([label for label, filename in remaining])
    elif master_position is not None:                                   # orphaned: only master.csv has it
        print_wrapped(" " * 9, "It's now left orphaned in the master list, making it a backlog card. "
                      f"{card['acronym']} can remain there to work on later, or be removed. "
                      "That choice comes next.")
        print()
        print(color_keys("ENTER = continue to the master list"), end="", flush=True)
        read_key(("enter",))
        if confirm_removal_in_master(card):
            master_rows.pop(master_position)
            write_sorted(MASTER_FILE, master_rows)
            print()
            print_wrapped("RESULT:  ", f"Removed. {card['acronym']} was erased from the master list",
                          lead_color=BLUE)
            print(f"         (copied first to {BACKUP_FILE}).")
    return True


# 7. Copy
# 7a. Show every built-in deck; number only the ones this card can be copied or moved to
def choose_destination(card, verb, doing):
    """
    List all built-in decks for a copy or a move. verb is "Copy" or "Move"; doing is
    "copying" or "moving". Decks that already hold this exact card get no number.
    Return (label, filename), 'back' for ESC, or 'quit' for Q.
    """
    same_card = [label for label, filename in decks_with_version(card)]
    same_acronym = decks_with_acronym(card["acronym"])

    clear_screen()
    print_mode_banner(f"{verb.upper()} AN ACRONYM - Deck List")
    print(f"\n{verb} {card['acronym']} to which deck?\n")

    choices = {}
    for label, filename in BUILTIN_DECKS:
        held = colored(f"{label:<23}", ORANGE)                          # pad first, then color
        if label == card["deck"]:
            print(f"   {held}{colored(f'({doing} from here)', BLUE)}")
        elif label in same_card:
            print(f"   {held}{colored('(already has it)', BLUE)}")
        else:
            number = str(len(choices) + 1)
            choices[number] = (label, filename)
            note = colored(f"(has a different {card['acronym']})", BLUE) if label in same_acronym else ""
            print(f"{menu_key(number)} {label:<23}{note}".rstrip())

    if not choices:
        print()
        print_wrapped("", f"{card['acronym']} is already in every deck. There's nowhere to {verb.lower()} it.")
        print()
        print(color_keys("ENTER or ESC = back    Q = quit"), end="", flush=True)
        return "quit" if read_key(("enter", "esc", "q")) == "q" else "back"

    print()
    print(color_keys("ESC = back    Q = quit"), end="", flush=True)
    choice = read_key(list(choices) + ["esc", "q"])
    if choice == "esc":
        return "back"
    if choice == "q":
        return "quit"
    return choices[choice]

# 7b. Show COPYING FROM, then PENDING COPY or VERSION CONFLICT; on ESC, redraw with the result
def confirm_copy(card, label, filename, different, master_too):
    """
    Show the COPYING FROM card, then the PENDING COPY card (or the VERSION CONFLICT
    card when the target already has a different version). Return True for ENTER.
    On ESC, redraw the screen without the title, show the RESULT, and return False.
    """
    files = [filename]
    if master_too:
        files.append(MASTER_FILE)

    def draw(state):
        confirmed = state == "confirmed"
        heading = "COPIED TO:" if confirmed else "COPY TO:"
        clear_screen()
        print_mode_banner("COPY AN ACRONYM")
        print()
        show_full_card(card, title="COPIED FROM" if confirmed else "COPYING FROM")
        if different:
            show_caution([(heading, files)], entry=different[0], labels=[label], holds=confirmed,
                         title="VERSION CONFLICT", caution=state == "ask")
        else:
            show_caution([(heading, files)], entry=card, labels=[label], holds=confirmed,
                         title="PENDING COPY", caution=state == "ask")

    whole_label = label.replace(" ", "\u00a0")                      # keep deck names on one line
    whole_source = card["deck"].replace(" ", "\u00a0")
    if different:
        question = (f"A different version of {card['acronym']} already exists in "
                    f"{whole_label}. Copy anyway?")
    else:
        question = f"Copy this card from {whole_source} to {whole_label} now?"
    return ask_or_cancel(draw, question, "ENTER = copy it     ESC = forget it", "copied",
                         words=[whole_source])

# 7c. Copy one card, exactly as it is, into another built-in deck
def copy_card(card):
    """
    Pick a deck, confirm, then copy the card there. Add it to master.csv only if master lacks it.
    Return the deck label it went to, None if cancelled at CAUTION, 'back' for ESC, or 'quit' for Q.
    """
    target = choose_destination(card, "Copy", "copying")
    if target in ("back", "quit"):
        return target
    label, filename = target

    rows = read_rows(filename)
    wanted = card["acronym"].casefold()
    different = [row for row in rows if row["acronym"].casefold() == wanted]
    master_rows = read_rows(MASTER_FILE)
    master_too = find_row(master_rows, card) is None

    if not confirm_copy(card, label, filename, different, master_too):
        return None

    entry = {field: card[field] for field in FIELDS}
    rows.append(entry)
    write_sorted(filename, rows)
    if master_too:
        master_rows.append(entry)
        write_sorted(MASTER_FILE, master_rows)

    print()
    print_wrapped("RESULT:  ", f"Copied. {card['acronym']} was added to and re-sorted in:",
                  lead_color=BLUE)
    list_labels([label])
    return label


# 8. Move
# 8a. Show MOVING FROM, then PENDING MOVE or VERSION CONFLICT; ask; redraw with the result
def confirm_move(card, label, filename, source_file, different):
    """
    Show the MOVING FROM card, then the PENDING MOVE card (or the VERSION CONFLICT
    card when the target already has a different version). Return True for ENTER.
    On ESC, redraw the screen without the title, show the RESULT, and return False.
    """
    def draw(state):
        confirmed = state == "confirmed"
        if confirmed:
            sections = [("MOVED TO:", [filename]), ("MOVED FROM:", [source_file])]
        else:
            sections = [("COPY TO:", [filename]), ("REMOVE FROM:", [source_file])]

        clear_screen()
        print_mode_banner("MOVE AN ACRONYM")
        print()
        if confirmed:                                                   # the source deck no longer has it
            gone = {"deck": card["deck"], "acronym": "(not found)", "full_name": "", "description": ""}
            show_full_card(gone, title="PREVIOUS", holds=False)
        else:
            show_full_card(card, title="MOVING FROM")
        if different:
            show_caution(sections, entry=different[0], labels=[label], holds=confirmed,
                         title="VERSION CONFLICT", caution=state == "ask")
        else:
            show_caution(sections, entry=card, labels=[label], holds=confirmed,
                         title="PENDING MOVE", caution=state == "ask")

    whole_target = label.replace(" ", "\u00a0")                         # keep deck names on one line
    whole_source = card["deck"].replace(" ", "\u00a0")
    if different:
        question = (f"A different version of {card['acronym']} already exists in "
                    f"{whole_target}. Move anyway?")
    else:
        question = f"Move this card from {whole_source} to {whole_target} now?"
    return ask_or_cancel(draw, question, "ENTER = move it     ESC = forget it", "moved",
                         words=[whole_source])

# 8b. Move one card, exactly as it is, from its deck into another built-in deck
def move_card(card):
    """
    Pick a deck, confirm, then add the card there and remove it from its own deck.
    master.csv is not touched: the version still lives in a deck. Return
    the deck label it went to, None if not moved, 'back' for ESC, or 'quit' for Q.
    """
    target = choose_destination(card, "Move", "moving")
    if target in ("back", "quit"):
        return target
    label, filename = target

    source_file = deck_file_for(card["deck"])
    source_rows = read_rows(source_file)
    position = find_row(source_rows, card)
    if position is None:                                                # file changed since lookup
        cant = colored("Can't move.", BLUE)
        print(f"\n{RESULT_LEAD}{cant} {card['acronym']} is no longer in {card['deck']}.")
        print(f"         {NO_CHANGES} were made. To find the mismatch, use")
        print("         Manage decks and deck health on the main menu.")
        return None

    rows = read_rows(filename)
    wanted = card["acronym"].casefold()
    different = [row for row in rows if row["acronym"].casefold() == wanted]

    if not confirm_move(card, label, filename, source_file, different):
        return None

    rows.append({field: card[field] for field in FIELDS})
    write_sorted(filename, rows)
    source_rows.pop(position)
    write_sorted(source_file, source_rows)

    print()
    print_wrapped("RESULT:  ", f"Moved. {card['acronym']} was relocated from:",
                  lead_color=BLUE)
    list_labels([card["deck"]], holds=False)
    print("         to:")
    list_labels([label])
    print("         Both decks were re-sorted.")
    return label


# 9. Main program loop
def main():
    """Show the manage-acronyms menu. Return 'back' (ESC) or 'quit' (Q)."""
    while True:
        clear_screen()
        print_mode_banner("MANAGE ACRONYMS")
        print("\nWhat would you like to do?\n")
        print(f"{menu_key(1)} Look up and manage acronyms (all decks)")
        print(f"{menu_key(2)} Add acronyms to a deck")
        print()
        print(color_keys("ESC = back    Q = quit"), end="", flush=True)

        choice = read_key(("1", "2", "esc", "q"))
        if choice == "esc":
            return "back"
        if choice == "q":
            return "quit"

        if choice == "1":
            result = lookup_all_decks()
        else:
            result = add_acronyms()
        if result == "quit":
            return "quit"                                               # anything else means ESC: show this menu again

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:                                           # Ctrl+C: skip the traceback, exit cleanly
        pass
    say_goodbye()
