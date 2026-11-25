# mezmerize-win bookmarks

The plan, decisions, branch order, and someday list for the web version of mezmerize.

## Goal

A web version of mezmerize with its own home that other sites can call. Colleagues only:
it's reached through the hub (on cleardaysystems.net), behind the Microsoft 365 sign-in,
from the CDS Colleague Academy SharePoint site. Every colleague gets it; not a premium
offering.

## Decisions

- 2026-11-19: Work happens in `mezmerize-win` only (a clone of the mezmerize repo, branch
  `web`). `mezmerize` (daily PowerShell use) and `mezmerize-use` (working copy) stay
  untouched.
- 2026-11-19: Site address: `https://mezmerize.learn.cleardaysystems.net` (.net, not .com).
- 2026-11-19: Colleagues only. Called by the hub on cleardaysystems.net; colleagues reach
  it from `https://cleardaysystems.sharepoint.com/sites/CDSColleagueAcademy`.
- 2026-11-19: The app checks sign-in itself (Microsoft Entra ID, our tenant only), since
  "only linked from the hub" doesn't stop someone from typing the address.
- 2026-11-19: The hub is its own website on cleardaysystems.net (not a SharePoint hub
  site). Same site as mezmerize.learn.cleardaysystems.net, so framing it in the hub
  doesn't run into third-party cookie blocking.
- 2026-11-19: The hub is Joomla on hosting.com (cPanel), behind Cloudflare Access (Entra
  sign-in, Colleagues group) with an origin guard. Its notes: OneDrive
  `DATA\CDS\WebDev\HANDOFF-2026-11-17.md`. Mezmerize uses the same Access protection
  instead of sign-in code of its own (replaces the Entra-in-the-app decision above).
- 2026-11-19: No extra hosting cost: the hosting.com plan allows unlimited domains.
- 2026-11-19: Everything is managed in GitHub; this folder stays in Documents\GitHub.
- 2026-11-19: Goal: callable from the CDS Colleague Academy SharePoint site. For now, the
  easiest start: a page on the hub. Portability rule: the web app is one self-contained
  folder (HTML, CSS, JavaScript, decks as JSON) with nothing that depends on Joomla or
  PHP. Joomla only gives it a page and a tile, so it can later move to its own address
  or into SharePoint without a rewrite.
- 2026-11-19: Later SharePoint routes, easiest first: (1) a link or Quick Links button on
  the Academy site (works with no changes); (2) an Embed web part (needs the allowed
  domain, a frame-ancestors header, and a test of Cloudflare Access inside a SharePoint
  frame); (3) an SPFx web part reusing the same JavaScript (needs the app catalog).

- 2026-11-25: Colleagues edit cards on the web too (not just Alex). Proposed design, pending
  Alex's answers: every web save is one commit on GitHub `main` (deck + master.csv together,
  the colleague as author), so GitHub stays the one true copy; a small PHP file on the hub
  hands the page its cards straight from GitHub (behind the guard, so the decks stay
  private and no export/upload is needed after card changes); a second PHP file saves,
  checking who's signed in (the Cloudflare token's email) and applying the same rules as
  the PowerShell app. Alex creates a GitHub token limited to this repo and stores it on
  the server outside the website (never in chat).
- 2026-11-25: Alex's ideal replaces that design: bring-your-own decks. Up to 8 decks loaded
  at a time; anyone can load their own decks and edit them. One compact file holds all of
  a person's decks (a "deck pack"); the start screen offers to change out the decks; at the
  end the pack is saved, and a utility can split it into the standard 8 deck files for the
  Python app. The deck's label travels inside the file. Proposed (pending Alex): edits stay
  in that person's browser and their pack file, so no server saving, GitHub token, or editor
  list is needed; the ClearDay decks stay the shared starting set.
- 2026-11-25: Deck pack format: one CSV with a deck column,
  `deck,acronym,full_name,description`, the deck's label on every row. The filename isn't
  stored; it comes from the label by the usual rule (`GRC/Frameworks` -> `grc_frameworks.csv`).
  A single deck is a pack with one label. (Considered and passed over: label records above
  each deck, which Excel sorting scrambles; the label inside the acronym as `Label|ABAC`,
  the same size but harder to edit. `+` can't be a separator: CySA+, MCP+I, TACACS+.)
- 2026-11-25: A pack carries the master list, as rows labeled `(master)` (a reserved label no
  deck may use). The web app keeps it current with the PowerShell rules (add a new version;
  drop the old one only if no deck uses it; never remove backlog). A pack loaded without
  master rows gets one built from its decks. A round trip (pack, web edits, split back
  into files) loses nothing, backlog included.
- 2026-11-25: Defaults (Alex can change any): a pack with more than 8 decks asks which 8 to
  load; deck labels are any text except `(master)`, and no two alike ignoring capitals;
  work is kept in the browser between visits, and Save decks downloads the pack (the
  browser copy can be lost if site data is cleared). The split utility writes the decks
  whose labels match the Python app's 8 built-in decks, plus master.csv, and lists any
  others it skipped.

## Progress

- 2026-11-19: First web version built in `web/` (study and lookup, no editing), plus
  `export_decks.py`. Tested locally in the browser pane: deck list, deck menu, Review,
  Quiz by Acronym, Quiz by Full Name, lookup with Also in / Found in and identical counts,
  Recents with the arrow keys, deck finder, visiting, phone width. Committed and published.
- 2026-11-23: All decks study shows each identical card once (DECKS: line), matching the
  PowerShell app. main merged into web; decks re-exported (317 cards, 279 in All decks).
- 2026-11-25: pack_decks.py and unpack_decks.py built (Claude builds them, like
  export_decks.py). Tested on a scratch copy: pack then unpack changes nothing; a hand-edited
  pack (no master rows, a new card with a comma, a lowercase label, an unknown deck, a row
  with no label) writes the right files and reports the rest; N writes nothing.
  Found on the way: 9 IS Engineering cards with blank descriptions (DNS, FTP, GCP, IP, OSPF,
  POP3, SMTP, SSH, Telnet) aren't in master.csv (strays, as of the 2026-11-23 data).
- 2026-11-25: Web Change decks built: load a pack or plain deck files (pick or drop), Choose
  Decks for more than 8, save a pack, switch between ClearDay decks and My decks; kept in
  the browser between visits. export_decks.py now includes the master list. Tested: the web
  save is byte-identical to pack_decks.py's pack; save, reload, save again comes back the
  same; 10-deck pack, no master rows, no-label row, plain deck file, non-deck file, phone
  width. Next: editing (add, edit, copy, move, delete) on My decks.
- 2026-11-25: Web editing built: add, edit, delete (with the orphan and master screens),
  copy, and move, on My decks, by the PowerShell rules; a change on the ClearDay decks first
  offers to make My decks from them. Tested in the browser: edit one deck of two identical
  (master keeps the old version, adds the new); add with prefill, exact-duplicate refusal,
  different-description warning and N; copy (master untouched when it has the version);
  move with the destination notes; delete from (2) decks, orphan, typed removal with each
  hint; ESC on a confirm; phone width. Not yet tested: a web-edited pack through
  unpack_decks.py into PowerShell.
- 2026-11-25: Decided with Alex: on the hub, mezmerize is a regular page (or a module on a
  page) for now; later a quick reference opened with Alt+M as a pop-up window that can be
  moved anywhere (lookups and cards only; anything else opens the main window), with a
  button to dock it into a panel on the page and back.
- 2026-11-25: Built: the two-tab fix (windows share My decks and pick up each other's
  changes; ENTER re-checks the decks), quick mode (`?mode=quick`), the main-window hand-off
  (`?lookup=...&do=...`), launcher.js (Alt+M, dock / pop out), launcher-demo.html. Tested
  in the browser pane: quick lookup, visiting, ESC back then close, W and E hand-offs, the
  main window starting the action, docking with the lookup carried over, ESC closing the
  panel, two tabs adding and editing without losing either change. Not testable in the
  pane: a real pop-up window (the pane opens it in the same tab); check in Chrome or Edge.
- 2026-11-25: Added the ✕ (closes the pop-up or the panel) and the pop-up's place: pop out
  returns it to where it was docked from, at the same size, and Alt+M reopens it where it
  was last closed. Tested in the pane (the open position and size, the ✕, saving on close);
  a real move across screens still needs a check in Chrome or Edge.
- Someday: "Forget My decks on this computer" (shared machines); a page per exam
  (`?pack=security-plus.csv` opening with that pack loaded).

## Open questions

- Deploying to the hub: the origin guard (`cf-access-guard.php`) only guards PHP pages, so
  plain files like decks.js could be fetched by someone who finds the server's real
  address. Fine if the acronyms aren't private; if they are, serve the decks through a
  small PHP file so the guard covers them.
- How the hub page holds it: the tile links straight to the app's folder, or a Joomla
  article holds it in an iframe (sized by the height message the app sends).

- Inside Joomla (a module or component on the hub) or its own small site on the
  subdomain? Joomla runs PHP, not Python.
- Does the hosting.com cPanel have "Setup Python App" and "Git Version Control"?
- How the hub shows it: inside the hub's page (iframe) or opening it as its own page.
- Web stack: Python (Flask), PHP (Joomla), or browser JavaScript with the decks as JSON.
- Who manages DNS for cleardaysystems.net (needed for the CNAME record).

## Setup checklist (when the time comes)

- DNS: a CNAME record `mezmerize.learn` in cleardaysystems.net pointing at the host's address.
- HTTPS certificate for the subdomain (most hosts issue a free one).
- Cloudflare Access: protect the new address like the hub (Entra, Colleagues group), and
  add an origin guard like the hub's `cf-access-guard.php`.
- If framed: the app allows framing only by the hub, via
  `Content-Security-Policy: frame-ancestors` with the hub's address.

## Someday

- Adding, editing, copying, moving, and deleting cards on the web (sign-in is already
  there; it would also need roles: who may edit).
- Decks out of the repo, into a database.
