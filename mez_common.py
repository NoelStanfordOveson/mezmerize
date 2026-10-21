"""
mez_common: the shared toolbox for the mezmerize programs.

This is the foundation floor. It may import Python's own modules,
but never any mezmerize file, so nothing can import in a circle.
"""

import csv
import os
import textwrap

CARD_WIDTH = 60                                                     # Width of the flashcard display
TOP_MARGIN = 2                                                      # Number of blank lines at the top of the screen
DATA_FOLDER = "data"                                                # Folder containing category decks

BUILTIN_DECKS = [
    ("AI Security", "ai.csv"),
    ("Certifications", "certs.csv"),
    ("Cloud Security", "cloud.csv"),
    ("Cybersecurity", "cybersec.csv"),
    ("DevSecOps", "devsec.csv"),
    ("GRC/Frameworks", "grc.csv"),
    ("IS Engineering", "engineer.csv"),
    ("IS Management", "mgmt.csv"),
]


# 1a. print_wrapped
# 1b. clear_screen
# 1c. print_mode_banner
# 1d. overwrite_line
# 1e. read_enter_or_esc
# 1f. program_folder
# 1g. csv_path
# 1h. get_key
# 1i. read_key
# 1j. input_or_esc
# 2. Loading decks
# 2a. load_flashcards
# 2b. load_all_builtin
# 3. say_goodbye


# 1. Helper functions
# 1a. Create a whole-word text wrapping function
def print_wrapped(label, text, width=CARD_WIDTH):
    """Print label + text. Long text wraps by whole words, lined up under the text."""
    wrapper = textwrap.TextWrapper(
        width=width,
        initial_indent=label,                                       # first line starts with the label
        subsequent_indent=" " * len(label),                         # extra lines line up under the text
        break_long_words=True,                                      # only if one word is longer than the line
        break_on_hyphens=True,                                      # may break after a hyphen already in the word
    )
    print(wrapper.fill(text) or label)

# 1b. Clear the terminal screen
def clear_screen(margin=True):
    """Erase the terminal, then leave a little space at the top."""
    os.system('cls' if os.name == 'nt' else 'clear')
    if margin:
        print("\n" * TOP_MARGIN)                                    # leave a little space at the top of the screen

# 1c. Print a banner for the choices
def print_mode_banner(title, width=CARD_WIDTH):
    """Print a banner for the mode the user has chosen."""
    print("=" * width)
    print(f" {title} ".center(width, "="))
    print("=" * width)

# 1d. Clear the hint line
def overwrite_line(text):
    """Print text, stay on the line, then erase it after the keypress."""
    print(text, end="", flush=True)
    action = read_enter_or_esc()
    print("\r" + " " * len(text) + "\r", end="", flush=True)
    return action

# 1e. Enter to continue or Esc to go back to menu
def read_enter_or_esc():
    """Wait for ENTER or ESC. Returns 'enter' or 'esc'. Other keys are ignored."""
    return read_key(("enter", "esc"))

# 1f. Find the folder this program lives in
def program_folder():
    """Return the folder where the program is located."""
    return os.path.dirname(os.path.abspath(__file__))

# 1g. Open CSVs from the data folder
def csv_path(filename):
    """
    Return the full path to a CSV file.
    A plain name means a file in the data folder; a full path comes back unchanged.
    """
    if os.path.isabs(filename):
        return filename
    return os.path.join(program_folder(), DATA_FOLDER, filename)

# 1h. Wait for one key and report which key it was
def get_key():
    """
    Wait for one keypress and return it.
    Returns 'enter', 'esc', or 'backspace' for those keys,
    otherwise the character typed (for example 'q' or '3').
    """
    try:
        import msvcrt                                               # Windows
        while True:
            ch = msvcrt.getwch()
            if ch in ("\x00", "\xe0"):                              # arrow/function keys send two codes
                msvcrt.getwch()                                     # throw away the second code
                continue                                            # and keep waiting for a real key
            break

    except ImportError:
        import sys, tty, termios                                    # mac0S / Linux
        fd = sys.stdin.fileno()
        old = termios.tcgetattr(fd)
        try:
            tty.setraw(fd)
            ch = sys.stdin.read(1)
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, old)

    if ch in ("\r", "\n"):
        return "enter"
    if ch == "\x1b":
        return "esc"
    if ch in ("\b", "\x7f"):                                        # backspace: Windows sends \b, macOS/Linux \x7f
        return "backspace"
    if ch == "\x03":                                                # Ctrl+C
        raise KeyboardInterrupt
    return ch

# 1i. Wait for one of a few allowed keys
def read_key(allowed):
    """
    Wait until one of the allowed keys is pressed, and return it.
    Letters come back lowercase, so 'Q' and 'q' both return 'q'.
    Any other key is ignored
    """
    while True:
        key = get_key().lower()
        if key in allowed:
            return key

# 1j. Type a line of text; ESC cancels
def input_or_esc(prompt, required=False, width=None):
    """
    Like input(), but ESC cancels.
    If width is given, long text wraps by whole words, lined up under the prompt.
    Returns the typed text when ENTER is pressed, or None for ESC
    """
    print(prompt, end="", flush=True)
    text = ""
    line_start = 0                                                  # where the current screen line starts in text
    indent = " " * len(prompt)                                      # wrapped lines line up under the typing
    while True:
        key = get_key()
        if key == "enter":
            if required and not text.strip():
                continue                                            # nothing typed yet: ignore ENTER
            print()                                                 # move down to the next line
            return text
        if key == "esc":
            print()
            return None
        if key == "backspace":
            if len(text) > line_start:                              # only erase on the current line
                text = text[:-1]                                    # drop the last character
                print("\b \b", end="", flush=True)
            continue
        if len(key) == 1 and key.isprintable():
            if width and len(indent) + len(text) - line_start + 1 > width:  # this key would go past the edge
                if key == " ":                                      # a space: just start the next line
                    text += key
                    print("\n" + indent, end="", flush=True)
                    line_start = len(text)
                    continue
                word_start = text.rfind(" ", line_start) + 1        # where the unfinished word begins
                if word_start > line_start:                         # move the unfinished word down
                    partial = text[word_start:]
                    print("\b \b" * len(partial), end="")
                    print("\n" + indent + partial, end="", flush=True)
                    line_start = word_start
                else:                                               # one huge word: just break it
                    print("\n" + indent, end="", flush=True)
                    line_start = len(text)
            text += key
            print(key, end="", flush=True)


# 2. Loading decks
# 2a. Load the flashcards from CSV
def load_flashcards(filename, deck_label=None):
    """Load one CSV. Each card remembers which deck it came from."""
    path = filename if os.path.isabs(filename) else csv_path(filename)
    if deck_label is None:
        deck_label = os.path.splitext(os.path.basename(path))[0]    # Use filename without extension as default label

    flashcards = []
    with open(path, mode="r", encoding="utf-8-sig") as file:
        reader = csv.DictReader(file)   # Reads the header row automatically
        for row in reader:
            acronym = (row.get("acronym") or "").strip()
            full_name = (row.get("full_name") or "").strip()
            description = (row.get("description") or "").strip()
            if not acronym and not full_name and not description:
                continue  # Skip empty rows
            flashcards.append({
                "acronym": acronym,
                "full_name": full_name,
                "description": description,
                "deck": deck_label,
            })
    return flashcards

# 2b. Load all flashcards from all built-in decks
def load_all_builtin():
    """Load all flashcards from all built-in decks."""
    cards = []
    missing = []
    for label, filename in BUILTIN_DECKS:
        path = csv_path(filename)
        if os.path.exists(path):
            cards.extend(load_flashcards(filename, label))
        else:
            missing.append(filename)
    cards.sort(key=lambda card: card["acronym"].casefold())
    return cards, missing


# 3. Sign off block on exit
def say_goodbye():
    """Print the exit message."""
    print()
    print()
    print("Thank you for using Mezmerize Acronym Finder! Goodbye! 👋".center(CARD_WIDTH))
    print("Made with 💭 by TristanTango73".center(CARD_WIDTH))
    print("\n\n")
