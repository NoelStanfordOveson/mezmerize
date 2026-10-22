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
py check_decks.py        # audit data/master.csv against the decks
```

## Architecture (floors: each file imports only from floors below it)

- `mez_common.py` (bottom): shared constants (CARD_WIDTH = 60, DATA_FOLDER, BUILTIN_DECKS)
  and helpers used by more than one program (screen, keys, input, CSV paths, loading decks).
- `mez_cards.py` (middle): card logic, no screens. Reads and writes the CSVs (read_rows,
  write_sorted), identifies cards and finds them in decks (version_of, find_row,
  decks_with_version, decks_with_acronym), and keeps master.csv current (update_master).
- `manage_acronyms.py`: the screens for lookup, add, edit, delete, copy, and move.
  show_caution draws every CAUTION box.
- `flashcards.py` and `check_decks.py`: flashcards imports lookup_acronym from manage_acronyms.
- `mezmerize.py` (top): the menu that calls each program's main().
- Two-test rule for mez_common: code goes there only if (1) more than one program needs it
  and (2) it depends on nothing else of ours.
- Code that reads, writes, or compares cards without printing a screen goes in mez_cards.

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
- Deleting removes a version from master.csv only when the last deck copy goes, and only
  after R + typing the acronym exactly (capitals included; friendly hints, retry until it
  matches or ESC). K keeps it in master as backlog. Nothing is written until every question
  is answered.
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

## UI conventions

- Nothing wider than CARD_WIDTH. Choice prompts wrap between choices (wrap_choices),
  never splitting a key from its name.
- Key bars sit flush left with 5 spaces between choices (3 when a line is tight).
  Exception: the D / A scope prompt ("You chose Delete.") is indented 5 on purpose.
- Deck labels in a wrapped list use non-breaking spaces ("\u00a0") so a name never
  splits across lines.
- Q quits completely; ESC goes back one level.
- Result lines start `RESULT:` followed by two spaces.
- Confirm screens (before saving, deleting, copying, or moving) have at most two cards:
  - the existing card on top (show_full_card, === lines, titled), if there is one;
  - one CAUTION card below it (show_caution, *** lines), with no blank line between them.
    It holds the proposed outcome (or, for a copy/move conflict, the version already
    there): DECK / DECKS line, the card's fields, a blank line, then one or more file
    headings, each with the files it affects (show_caution takes a list of
    (heading, files) sections). With no top card, it sits right under the banner's
    blank line. The caller prints its own question and keys after it.
- CAUTION card titles are just the text; show_caution puts ⚠️ on both sides.
  PENDING INSERT (add), PENDING WRITE (edit), PENDING DELETE (delete), PENDING FINAL
  DELETE (master removal), PENDING COPY (copy), PENDING MOVE (move), VERSION CONFLICT
  (copy or move into a deck with a different version).
- Banners: `ADD / COPY / MOVE AN ACRONYM TO: <deck>` on confirm screens (TO: names a
  destination); `COPY / MOVE AN ACRONYM - DECK LIST` on deck-pick screens (a dash names
  a step). Edit, delete, and master banners name the task only.
- Every value in a card lines up at column 13. Field labels and file headings are 12
  characters or fewer. DECK: for one deck, DECKS: for several (labels comma-separated,
  wrapped like DESCRIPTION).
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
- Lines under a RESULT (files, notes) are indented 9 spaces, under the first word.
- The CAUTION card's file list shows filenames; RESULT lists deck labels (master.csv by
  name). Copy does this; add, edit, and delete still list filenames until they're
  switched.
- Lookup's key line is two lines: actions (A = add it / E = edit / D = delete /
  C = copy / M = move), then a fixed navigation line (ENTER / ESC / Q). Navigation keys are in capitals.
- Printed prompts don't say "sync"; code names can.
- Use `...` in examples to stand for other text that's on the screen.

## How to work with me

- I'm learning Python and type every code change myself. Don't edit code files directly.
- Claude writes and maintains this CLAUDE.md. I review each change and commit it.
- For a big new or contiguous block, show the whole block first, then break it into
  snippets, outermost bracket first.
- For each snippet: first show it in context (the whole function if it's not huge,
  otherwise about 10 lines either side) so placement and indentation are clear, then
  ask "Questions?" and stop. Then show the snippets themselves one by one and explain
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
- After I type a change, check the file: compile it, read it, and run it on a scratch
  copy of the data before moving on.
- Test plans: a two-column table, Step | Expected result.
- Tell me when to commit, with a GitHub Desktop summary and description.
  One commit = one thing. I commit and push in GitHub Desktop.
- Each new feature gets its own branch: branch, build, test, then merge into main.
- Each file has a numbered index at the top; keep it matching the section headers.
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
- The someday list (in priority order) is kept in Claude's memory, not here.