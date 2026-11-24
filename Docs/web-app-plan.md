# mezmerize web app: plan (started 2026-11-15, idea stage)

Kept in two places, kept the same: the claude.ai project "Python - Flashcards" (claude/web-app-plan.md) and this repo (Docs/web-app-plan.md in mezmerize-win). Updated together.

Alex's idea: make mezmerize a web app and offer it to colleagues on the ClearDay Systems hub, with deck sets for several IT disciplines (his is cybersecurity), modeled on Cisco's CCNP tracks.

## What already exists (found 2026-11-23)

A web version is already being built in **mezmerize-win** (a clone of the mezmerize repo), branch `web` (0488d4f "Web version: study and lookup in the browser"), in Claude Code sessions:
- `web/` is one self-contained folder: index.html, mezmerize.css, mezmerize.js, decks.js. Study and lookup only, no editing. HTML/CSS/JavaScript in the browser, no server code.
- `export_decks.py` copies the built-in decks into `web/decks.js`; export again after cards change.
- It follows the PowerShell app's rules and keys; the four color jobs are CSS variables (--holds orange, --report blue, --key green, --choice sage); navy and gold come from the hub. It can sit in an iframe and posts its height to the page.
- mezmerize-win's CLAUDE.md and claude/bookmarks.md hold that work's own decisions.

So the "Flask" shape below was proposed (2026-11-15) before this project knew about the JavaScript version. Open: does the hub version stay static HTML/JS (study and lookup), or grow a Python (Flask) back end later for per-user data and editing?

## Where it lives (as Alex described it, 2026-11-15)

```
cleardaysystems.com           (public)
        |
portal.cleardaysystems.net    ("portal" = the entrance to the hub)
        |
Entra ID sign-in
        |
cleardaysystems.net           (the secure hub, "Colleagues Hub")
```

- Past Entra, the hub's landing page shows a card for each service. Planned services include OVE (OpenClaw Virtual Employee), a collaboration app, a small SharePoint helpdesk app, and now mezmerize.
- **No sign-in of its own:** the app trusts the hub's Entra sign-in.
- **Authorization decides what each user sees:** no contract for a service, no card.
- The hub is built in Alex's Claude Code sessions. Alex can ask that session for a HUB_BRIEF.md covering hosting, how Entra is wired, how a service gets its card, the stack, and per-user data.

## Authorization (agreed direction, 2026-11-15)

- Access leans heavily on **Entra ID security groups**; being in the matching group decides access.
- **App roles assigned to the groups** (e.g. `Mezmerize.User`, maybe `Mezmerize.Admin`, later `Decks.Enterprise`), so the app reads readable role names, not group GUIDs, and avoids the groups-claim overage (200 groups in a JWT). Microsoft recommends app roles over groups for new apps when nested groups aren't needed. Assigning *groups* to an app needs Entra ID P1 or P2: check the tenant license.
- **Nested groups don't cascade to app assignment** (Microsoft Learn): a group inside an assigned group gets no access. Nesting does work for membership, Conditional Access, and the groups claim.
- **One group per service plus a base group** (`CDS - Base`, `CDS - OVE`, `CDS - Mezmerize`, ...), each assigned directly to its apps; a customer is in every group they've bought. n services = n + 1 groups, not a group for every combination (2^n). **Fixed packages** (e.g. Bronze / Silver / Gold) can each have a group, assigned to their apps.

## Shape (proposed 2026-11-15, see "What already exists")

- Proposed then: a **Flask** web app as a new "screens" floor on top of mez_cards.py.
- **Deck sets** (the "customizable deck sets" idea): one folder per set, each with its own master list. A first slate from the CCNP tracks: Cybersecurity (Alex's, the seed), Enterprise, Security, Data Center, Service Provider, Collaboration, Automation (formerly DevNet), maybe Wireless (a training vendor reports a standalone track from March 2026; confirm on Cisco's site).
- **Per-user data:** the Entra identity could give each colleague their own progress (Recents, study position), and maybe deck sets by role.

## Order (agreed 2026-11-15, updated 2026-11-23)

1. ~~`health-report`~~ (merged 2026-11-21), then ~~`study-dedupe`~~ and ~~`result-tidy`~~ (merged 2026-11-22/23).
2. `notes` branch (in the mezmerize build folder): a new card field (below).
3. The web app, once the hub brief is in hand.

## The notes field (agreed 2026-11-15; separator and bullets 2026-11-23)

- Fourth CSV column: `acronym,full_name,description,notes`. Card label `NOTES:`, value at column 13. For external links, source citations, web pages: free form.
- **Several notes in one field, separated by `|`** (pipe; spaces around it optional). A pipe almost never appears in writing and can't appear raw in a URL (it must be `%7C`), so a split never breaks a link. The field is typed on one line.
- **On screen the pipe never shows:** every note gets its own line with a bullet `• `, even when there's only one note. A long note wraps under its text, not under the bullet:
  ```
  NOTES:       • NIST glossary https://csrc.nist.gov/glossary
               • Cisco SEG datasheet https://www.cisco.com/...
               • On the Security+ exam. Know how it differs
                 from a SWG and a CASB.
  ```
- In the CSV the field stays exactly as typed, pipes included. In the web version, notes become a real bulleted list with clickable links (export_decks.py and mezmerize.js need the new field).
- Any URL is clickable: a real link on the web, Ctrl+click in Windows Terminal. A URL is never split across lines.
- Not part of a card's identity (version_of stays acronym + full name + description). Blank is fine, not "incomplete". Edit changes notes, Copy and Move carry them, the master list keeps a copy.
- Touches: every deck file and master.csv (new header column), mez_cards read/write (FIELDS), card display, Add, Edit, deck health (REQUIRED_COLUMNS stays three), the printout (the bullet is non-ASCII, so rtf_line writes it as an RTF Unicode escape).
