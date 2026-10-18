# CLAUDE.md

Guidance for Claude when working in this repository.

## Overview

mezmerize: a command-line flashcard app for learning acronyms. Pure Python standard library
(no dependencies, no build step, no test suite). Runs on Windows in PowerShell 7;
editing an existing card is Windows-only (it uses the console's own line editor).

## Commands

```bash
py mezmerize.py          # main menu: study, look up/add/edit/delete, check deck health
py flashcards.py         # study only (review, random quiz, lookup)
py manage_acronyms.py    # look up, add, edit, or delete acronyms
py check_decks.py        # audit data/master.csv against the decks
```

## Architecture (floors: each file imports only from floors below it)

- `mez_common.py` (bottom): shared constants (CARD_WIDTH = 60, DATA_FOLDER, BUILTIN_DECKS)
  and helpers used by more than one program (screen, keys, input, CSV paths, loading decks).
- `manage_acronyms.py`: lookup, add, edit, and delete. Reads and writes the CSVs (read_rows, write_sorted).
- `flashcards.py` and `check_decks.py`: flashcards imports lookup_acronym from manage_acronyms.
- `mezmerize.py` (top): the menu that calls each program's main().
- Two-test rule for mez_common: code goes there only if (1) more than one program needs it
  and (2) it depends on nothing else of ours.

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
- Every write to master.csv first copies it to data/master.bak (one step of undo;
  *.bak is in .gitignore).
- Lookup matches on acronym only.
- Data changes and code changes go in separate commits.

## UI conventions

- Nothing wider than CARD_WIDTH. Choice prompts wrap between choices (wrap_choices),
  never splitting a key from its name.
- Q quits completely; ESC goes back one level.
- Result lines start `RESULT:` followed by two spaces.
- Before saving, show a CAUTION block listing every file that will be written.
- Lookup's key line is two lines: actions (A = add it / E = edit / D = delete), then a fixed
  navigation line (ENTER / ESC / Q). Navigation keys are written in capitals.
- Use `...` in examples to stand for other text that's on the screen.

## How to work with me

- I'm learning Python and type every change myself. Don't edit code files directly.
- For a big new or contiguous block, show the whole block first, then break it into
  snippets, outermost bracket first, each with a short explanation.
- Break replies into chunks and pause for questions.
- Before anything needing approval, say first whether it is new or a change.
- After I type a change, check the file: compile it, read it, and run it on a scratch
  copy of the data before moving on.
- Test plans: a two-column table, Step | Expected result.
- Tell me when to commit, with a GitHub Desktop summary and description.
  One commit = one thing. I commit and push in GitHub Desktop.
- Each file has a numbered index at the top; keep it matching the section headers.
- Two blank lines before main() (and after the imports and constants at the top);
  one blank line between other functions.
- Cosmetic changes (spacing, wording) get their own commit.
- The someday list (in priority order) is kept in Claude's memory, not here.