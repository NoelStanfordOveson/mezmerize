# CLAUDE.md

Guidance for Claude when working in this repository.

## Overview

mezmerize: a command-line flashcard app for learning acronyms. Pure Python standard library
(no dependencies, no build step, no test suite). Runs on Windows in PowerShell 7;
editing an existing card is Windows-only (it uses the console's own line editor).

## Commands

```bash
py mezmerize.py          # main menu: study, look up/add/edit/delete/copy/move, check deck health
py flashcards.py         # study only (review, random quiz, lookup)
py manage_acronyms.py    # look up, add, edit, delete, copy, or move acronyms
py manage_decks.py       # deck health: audit data/master.csv against the decks
```

## Architecture (floors: each file imports only from floors below it)

- `mez_common.py` (bottom): shared constants (CARD_WIDTH = 60, COLUMN_GAP, DATA_FOLDER, BUILTIN_DECKS,
  the colors) and helpers used by more than one program (screen, keys, input, CSV paths,
  loading decks, color: colored, color_keys, color_words, menu_key).
- `mez_cards.py` (middle): card logic, no screens. Reads and writes the CSVs (read_rows,
  write_sorted), identifies cards and finds them in decks (version_of, find_row,
  decks_with_version, decks_with_acronym), and keeps master.csv current (update_master).
- `manage_acronyms.py`: the screens for lookup, add, edit, delete, copy, and move.
  show_caution draws every CAUTION box.
- `flashcards.py` and `manage_decks.py`: flashcards imports lookup_acronym from manage_acronyms,
  so every lookup in the app is the same function.
- `mezmerize.py` (top): the menu that calls each program's main().
- Two-test rule for mez_common: code goes there only if (1) more than one program needs it
  and (2) it depends on nothing else of ours.
- Code that reads, writes, or compares cards without printing a screen goes in mez_cards.
  Anything that prints is screen code and stays upstairs.
- Names in code: `label` is a deck label ("Cybersecurity"), `filename` its CSV
  ("cybersec.csv"), and `decks` a list of (label, filename) pairs, as in BUILTIN_DECKS.
  Lists are `labels` and `filenames`. `lead` is the text in front of a wrapped line
  (print_wrapped, wrap_choices).

## Data rules

- Decks are CSVs in `data/` with the header `acronym,full_name,description`.
  Read with utf-8-sig; written sorted by acronym, utf-8, LF line endings.
- A card's **version** is (acronym, full name, description). Acronym and full name are
  compared ignoring capitals; description must match exactly.
- The same version can live in several decks. Editing and deleting ask: one deck
  (a number, or D = this deck only) or every deck with that identical version (A =
  all decks).
- `master.csv` holds every version in use, plus a backlog not yet in any deck.
  After an edit: add the new version if missing; remove the old version only if no deck
  still uses it. Never remove backlog entries.
- Deleting is written step by step: each confirmed step is written before the next
  question. ENTER on PENDING DELETE writes the decks and shows their RESULT. If that left
  the card orphaned (in no deck, only in master.csv), the RESULT says so (`It's now left
  orphaned in the master list, making it a backlog card. ... That choice comes next.`)
  and `ENTER = continue to the master list` is the only key. Then the master screen:
  R + typing the acronym exactly (capitals included; friendly hints, retry until it
  matches) removes it; K, ESC, or ESC while typing keeps it as backlog. Each answer gets
  its own RESULT: `Kept. ZZT stays in the master list as backlog.` or `Removed. ZZT was
  erased from the master list` / `(copied first to master.bak).`
- Adding (from the menu or from any lookup's A = add) refuses only the exact same version
  already in the chosen deck ("<acronym> already in <deck>, exactly as entered."). These
  are shown first, then "Add anyway?  Y = yes     N or ESC = no": the exact version in
  other decks (listed in two columns; a Tip points to C = copy from a lookup), the same
  acronym + full name with a different description (descriptions listed), or the same
  acronym with a different full name (full names listed). master.csv gets the version
  only if it lacks it; a master row with the same acronym + full name and a blank
  description (backlog) gets filled in instead of a second row.
- Copying puts a card, exactly as it is, into one other built-in deck. Decks that already
  hold that exact version can't be picked; a deck with a different version can (that
  version is shown in the VERSION CONFLICT card). master.csv gets the version only if it
  lacks it.
- Moving copies a card into one other built-in deck, then removes it from its own deck
  (target written first, then the source). Same deck-pick rules as copying
  (choose_destination). master.csv is never touched by a move. After a move, a
  single-deck lookup drops the card from its list; an all-decks lookup keeps it with
  its new deck label.
- Every write to master.csv first copies it to data/master.bak (one step of undo;
  *.bak is in .gitignore).
- Lookup matches on acronym only.
- Single-deck lookup (as in flashcards) also checks the other built-in decks, by acronym.
  Found here: `Also in:` the other decks, then `(N total)` counting this deck, plus
  `, N identical` when one card was found and other decks hold that exact version.
  Not found here: `Found in:` the other decks, then `(N total)`.
  All-decks lookup skips this.
- Data changes and code changes go in separate commits.
- Two folders: `mezmerize` (build: branches, code, testing) and `mezmerize-use` (a second
  clone that stays on main). Card work (add, edit, copy, move, delete) happens in
  mezmerize-use and its data commits go straight to main; pull it before each session and
  after each merge. The build folder never commits data: card changes made while testing
  get discarded. Someday the decks may move out of the repo altogether.

## UI conventions

- Nothing wider than CARD_WIDTH. Choice prompts wrap between choices (wrap_choices),
  never splitting a key from its name.
- The last key line before a keypress prints with `end="", flush=True`, so the cursor
  waits at the end of that line.
- Key bars sit flush left. Navigation lines (lookup, after a result, Deck Lists, menus,
  the study card) use 4 spaces between choices; confirm-screen key lines and `Add anyway?`
  use 5 (`ENTER = save it     ESC = forget it`). manage_decks still uses 5 (later).
  Exception: the D / A scope prompt ("You chose Delete.") is indented 5 on purpose.
- Deck labels in a wrapped list use non-breaking spaces ("\u00a0") so a name never
  splits across lines.
- Q quits completely; ESC goes back one level.
- Result lines start `RESULT:` followed by two spaces.
- ALL CAPS is a record; Initial Caps is a request. Field labels on cards are ALL CAPS
  (DECK:, ACRONYM:, FULL NAME:, DESCRIPTION:); bare typing prompts are Initial Caps
  (Acronym:, Full name:, Description:). DECK: is always ALL CAPS, even on a typing
  screen: it's set for you and never typed into. Edit's typing screen stays ALL CAPS
  because it's drawn inside a card.
- Screens never address the user as "you".
- Confirm questions have one shape: action + this card + from/to/in + deck + now?
  The action is what's about to happen at that point in the flow:
  `Add this card to Cybersecurity now?`, `Copy this card from Cybersecurity to
  GRC/Frameworks now?`, `Move this card from ... to ... now?` (from / to: the card's
  journey), `Delete this card from Cybersecurity now?`. Edit is the one exception: its question comes after the typing,
  so it asks to save: `Save edits to Cybersecurity now?`. No "deck" before a single deck
  name. With several decks the question gives the count and the card's DECKS: line names
  them: `Save edits to (2) decks now?`.
- A count shown with a label goes in parentheses: `(2) decks`, `(3) decks`.
- Lists of deck labels under a message are two columns, indented 2, filled across
  (1 2 / 3 4); the gap after the longest label is COLUMN_GAP (mez_common).
- A message that can run past CARD_WIDTH (a long acronym or deck name in it) is printed
  with print_wrapped("", text), with its blank line from a separate print() first.
- Confirm screens (before saving, deleting, copying, or moving) have at most two cards:
  - the existing card on top (show_full_card, === lines, titled), if there is one;
  - one CAUTION card below it (show_caution, *** lines), with no blank line between them.
    It holds the proposed outcome (or, for a copy/move conflict, the version already
    there): DECK / DECKS line, the card's fields, a blank line, then one or more file
    headings, each with the files it affects (show_caution takes a list of
    (heading, files) sections). With no top card, it sits right under the banner's
    blank line. The caller prints its own question and keys after it.
- CAUTION card titles are just the text; show_caution puts ⚠️ on both sides.
  PENDING WRITE (add and edit), PENDING DELETE (delete), PENDING FINAL
  DELETE (master removal), PENDING COPY (copy), PENDING MOVE (move), VERSION CONFLICT
  (copy or move into a deck with a different version).
- Banners name the task; the cards name the decks. Format `MAJOR - Minor`: the task in
  capitals, a dash, then the step or focus in Title Case (`ADD AN ACRONYM - Deck List`,
  `DELETE AN ACRONYM - Master`, `DECK HEALTH - Summary`, `DECK HEALTH - Problem`). One
  exception, kept in capitals so the user sees where they are: `DECK HEALTH - SECTION n
  OF m`.
- Every value in a card lines up at column 13. Field labels and file headings are 12
  characters or fewer. DECK: for one deck, DECKS: for several (labels comma-separated,
  wrapped like DESCRIPTION).
- File headings list the work in the order it happens (a move shows COPY TO: above
  REMOVE FROM:, since the target is written first), while questions follow the card's
  journey (from / to).
- File headings are instructions before the card is answered and after ESC, and past
  tense after ENTER: WRITE TO: / WRITTEN TO: (add, edit), DELETE FROM: / ERASED FROM:
  (delete, master), COPY TO: / COPIED TO: (copy), COPY TO: + REMOVE FROM: / MOVED TO: +
  MOVED FROM: (move). Master K shows KEPT IN: master.csv (master isn't touched).
- Top cards keep their titles until ENTER (CURRENT, COPYING FROM, MOVING FROM), then
  become PREVIOUS (edit, move) or COPIED FROM (copy). After a move, PREVIOUS shows the
  source deck with `ACRONYM: (not found)` and blank fields: the deck's point of view.
- Once a CAUTION card is answered (ENTER, ESC, R, or K), the whole screen is redrawn:
  draw(state) with state "ask" (waiting), "confirmed" (ENTER, or R + typed acronym),
  "cancelled" (ESC), or "kept" (K). The card's titled line becomes plain stars, and the question, keys,
  and any typing are replaced by a blank line, the RESULT, a blank line, then the
  navigation line. On ESC the RESULT is `RESULT:  Nothing was saved.` (or deleted /
  copied / moved), then `NO CHANGES were made.`; on success the caller writes the files and
  prints it.
- ENTER / ESC confirm screens (add, edit, delete, copy, move) define their own draw(state)
  and end with `return ask_or_cancel(draw, question, keys, verb)`: the caller decides
  what (screen, question, keys, verb), the helper does how (draw, ask, redraw, ESC
  RESULT). Questions are passed without surrounding newlines. The master screen
  (R / K / ESC plus typing) keeps its own code.
- Success RESULTs say what happened to the acronym and end in a colon, then list the
  deck labels one per line at column 11, 2 in from the RESULT text (list_labels):
  `RESULT:  Saved. PII was edited and re-sorted in:`. Follow-up sentences sit at
  column 9, under the first word: Delete's `It's still in:` (with labels), `It was also
  erased from the master list` / `(copied first to master.bak).`, or `It stays in the
  master list as backlog.`; Move's `to:` (with the label) and `Both decks were re-sorted.`
- Each verb gets its own preposition: `added to and re-sorted in:`, `relocated from:`
  ... `to:`.
- The CAUTION card's file list shows filenames; RESULT shows deck labels.
- Words on screen: decks are "decks"; master.csv is "the master list" in every prompt,
  hint, and message, and `master.csv` only on a card's file line. No "CSV" in menus or
  messages; only the custom-deck prompt mentions .csv, since it asks for the file.
- The master screen (PENDING FINAL DELETE) opens with a hint under the banner while the
  question is up: the card is orphaned (only in the master list), keep it as backlog or
  remove it, a removal can't be undone, and R asks for the acronym to be typed first.
  Question: `Remove this card from the master list now?`; keys `R = remove it     K or
  ESC = keep it (backlog)` (the deck delete is already done, so ESC can only mean keep).
  The redraw after an answer drops the hint.
- Key lines are actions on top, navigation below. Lookup: `A = add` always (found or
  not), plus `E = edit    D = delete    C = copy    M = move` for found built-in cards,
  then `ENTER = look up another    ESC = menu    Q = quit`. After an edit, delete, copy,
  or move from a lookup: `ENTER = back to lookup    ESC = menu    Q = quit` (next_step).
  After adding from a lookup: `A = add another` above that same line. ESC = menu leaves
  the lookup. Navigation keys are in capitals.
- Printed prompts don't say "sync"; code names can.
- Use `...` in examples to stand for other text that's on the screen.

## Colors

- Three color families, each with one job. Constants in mez_common: ORANGE (palette 208),
  BLUE (palette 39, reports), GREEN (bright, keys), CHOICE_COLOR (sage green, palette 71,
  menu choices). Change a color in one line; `""` means plain (colored() leaves text alone).
  Palette colors are written `\x1b[38;5;Nm` (N = 0-255); GREEN still uses the old short
  code `\x1b[92m`. A bare short number is not a palette number (`\x1b[39m` = default color).
- Color is a highlight, never a whole line. Measure, wrap, and pad the plain text first;
  color last. print_wrapped takes lead_color, text_color (commas stay plain), and
  words= / words_color (color_words: labels inside wrapped text). overwrite_line and
  input_or_esc color their keys themselves and measure the plain text.
- **Orange = a deck that holds this card right now.** The `DECK:` / `DECKS:` lead is always
  orange; deck names are orange only where the card lives. `holds=` on print_decks,
  list_labels, show_full_card (default True) and show_caution (default False).
  While a question is up, cards show where the card is now; after ENTER the redraw shows
  the new truth (deleted deck plain, Add/Copy/Move targets orange, Move's PREVIOUS card
  plain); after ESC nothing changes. RESULT lists: Delete's `removed from:` and Move's
  `from:` plain, the rest orange. Names in sentences and questions are colored with
  `words=` (the source deck, never the target). Lookup `Found in:` / `Also in:` orange.
- **Blue = things reported** (cyan looked too close to green): RESULT_LEAD (every
  `RESULT:`), NO_CHANGES, `Can't edit` / `Can't delete` / `Can't move`, and the Copy/Move
  Deck List notes.
- **Green = a key to press:** color_keys() colors just the key (ENTER, ESC, Q, A, E, ...),
  never `or` or the words after `=`. Menu choices (`1.`, `A.`, and `1 = Cybersecurity`)
  use CHOICE_COLOR through menu_key() and NUMBER_PATTERN.
- manage_decks has no color yet (it comes with its print routines). The printer
  (later) gets plain text.

## How to work with me

- I'm learning Python and type every code change myself. Don't edit code files directly.
- Claude writes and maintains this CLAUDE.md. I review each change and commit it.
- For a big new or contiguous block, show the whole block first, then break it into
  snippets, outermost bracket first.
- For each snippet: first show it in context (the whole function if it's not huge,
  otherwise about 10 lines either side) so placement and indentation are clear, then
  ask "Questions?" and stop. The in-context step is just the code: no recap of what the
  existing code already does (that was explained when it was written). Then show the snippets themselves one by one and explain
  them part by part, pausing again. I type every character myself (no copy/paste),
  so expect the odd typo.
- In explanations, give variables extra attention: where each one comes from (parameter,
  assignment, loop, enclosing function, import), where it is first assigned, what it
  holds, and where it is used.
- When pointing at code, give the function name, index number, line number, and a
  search phrase.
- Break replies into small chunks. End each with a pause for my questions or comments,
  shown as `ENTER = continue`. ENTER (or a single `.` if the app won't send an empty
  message) means go on: no "tell me when you're ready" or "ok, done" back-and-forth.
- Before anything needing approval, say first whether it is new or a change.
- Label each snippet: **New** (lines that don't exist yet; say where to insert them),
  **Change** (existing lines edited or replaced: Before is exactly what's in the file
  now, After is what should be there), or **Delete** (lines removed with nothing in
  their place). For a change, say explicitly which lines to delete, by line number.
  Show whole units in Before/After (a whole docstring, not part of one).
- When several spots in a file change, give them highest line numbers first, so the
  numbers above stay right while I type (say "highest line numbers first", not
  "bottom-up"). Inside one code box, list lines in file order. Give new import lines
  first (they don't move other lines, and Pylance stops flagging names).
- Name the file at the top of each part. Before and After go in separate code boxes,
  with nothing (markers, notes) to the right of the code: long lines scroll off.
- After I type a change, check the file: compile it, read it, and run it on a scratch
  copy of the data before moving on.
- Test plans: a two-column table, Step | Expected result.
- Tell me when to commit, with a GitHub Desktop summary and description.
  One commit = one thing. I commit and push in GitHub Desktop.
- Each new feature gets its own branch: branch, build, test, then merge into main.
- Each file has a numbered index at the top; keep it matching the section headers,
  with a blank line before each numbered section (manage_acronyms does; the other
  files will follow).
- No blank line after a module docstring.
- Imports in three groups with a blank line between: standard library, third-party, ours.
- Two blank lines before each numbered section header (# 1., # 2., ...) and after
  the imports and constants at the top; one blank line between other functions
  and lettered sub-sections.
- Cosmetic changes (anything that changes what the screen shows: spacing, wording,
  layout) get their own commit. Comments, the index, and other internal tidy-ups
  aren't cosmetic; they go in with the code change they belong to.
- Git on Windows converts line endings (autocrlf). CRLF/LF differences seen from Claude's
  side aren't real changes; check with `GIT_OPTIONAL_LOCKS=0` and `-c core.autocrlf=true`.
- The plan, decisions, branch order, and someday list are kept in the project's
  claude/bookmarks.md, not here.