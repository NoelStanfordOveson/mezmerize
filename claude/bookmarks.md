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

## Progress

- 2026-11-19: First web version built in `web/` (study and lookup, no editing), plus
  `export_decks.py`. Tested locally in the browser pane: deck list, deck menu, Review,
  Quiz by Acronym, Quiz by Full Name, lookup with Also in / Found in and identical counts,
  Recents with the arrow keys, deck finder, visiting, phone width. Not committed yet.

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
