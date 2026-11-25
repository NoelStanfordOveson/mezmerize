/*
 * mezmerize.js: the web version of mezmerize (study, lookup, and changing cards).
 * The ClearDay decks come from decks.js, which export_decks.py writes from the data folder.
 * Anyone can load their own decks instead (a deck pack, or plain deck files): up to 8 at
 * once, kept in this browser, and saved back to a deck pack file. Cards are added, edited,
 * deleted, copied, and moved in My decks, by the PowerShell app's rules; the ClearDay decks
 * are shared and never change here (a change first makes My decks from them).
 * Opened as ?mode=quick (launcher.js, Alt+M on a hub page) it's the quick reference: lookups
 * and cards only, in a pop-up window or docked in a panel; anything else opens the main window.
 * Every screen works with the keys from the PowerShell app (ENTER, ESC, +, numbers,
 * letters) and with clicks or taps.
 *
 * 1. Settings and data
 * 1a. fold(text)
 * 1b. versionOf(card)
 * 1c. cardsFor(label)
 * 1d. decksWithAcronym(acronym)
 * 1e. decksWithVersion(card)
 * 1f. deckNotes(card)
 * 1g. mergeIdentical(cards)
 * 1h. studyCards(label)
 * 1i. clearDaySet()
 * 1j. useSet(set)
 * 1k. parseCsv(text)
 * 1l. labelFromFilename(name)
 * 1m. readDeckFile(name, text, into)
 * 1n. sortCards(cards)
 * 1o. makeSet(name, decks, master)
 * 1p. packCsv(set)
 * 1q. fileFor(label)
 * 1r. findRow(cards, card)
 * 1s. deckByLabel(label)
 * 1t. entryOf(card)
 * 1u. commitChanges()
 * 1v. updateMaster(oldCard, newEntry)
 * 2. Kept in this browser only
 * 2a. loadRecent()
 * 2b. saveRecent(acronym)
 * 2c. loadMine()
 * 2d. saveMine(set)
 * 2e. saveUsing(kind), loadUsing()
 * 3. Drawing helpers
 * 3a. esc(text), plural(count, word)
 * 3b. banner(major, minor)
 * 3c. keyButton(key, words, main)
 * 3d. cardHtml(card, options)
 * 3e. show(html, keys)
 * 3f. cautionHtml(sections, entry, labels, holds, title, caution)
 * 3g. resultHtml(word, text, more), labelsHtml(labels, holds), underHtml(text), deckWord(label)
 * 3h. askOrCancel(o)
 * 4. Screens
 * 4a. showHome(), setLine()
 * 4b. showDeckMenu(label, note)
 * 4c. startStudy(label, mode)
 * 4d. showStudyCard()
 * 4e. startLookup(label, origin)
 * 4f. recentsHtml(), markRecents(), showLookup()
 * 4g. runLookup(query)
 * 4h. leaveLookup()
 * 4i. showFinder(card, from)
 * 4j. showDecks(message), pickFiles()
 * 4k. loadFiles(files), finishLoad(name, decks, master, problems)
 * 4l. showPick(name, decks, master, problems)
 * 4m. saveDecks()
 * 4n. closeQuick(), tellHub(what), windowPlace(), openMain(query, action)
 * 5. Changing cards
 * 5a. onMine(action)
 * 5b. navAfter(back, card), keptNote(kept), missingFrom(card, labels), cantResult(verb, card, label),
 *     cantScreen(back, title, verb, card, label)
 * 5c. askInLookup(html, keys), chooseScope(verb, then), pickFromMatches(numbered, verb, allowAll, then)
 * 5d. formRows(prompts, values), wireForm(onDone, onCancel)
 * 5e. startAdd(), chooseTargetDeck(back, acronym), addForm(back, label, acronym), addNav(back),
 *     nothingAdded(), checkAdd(back, label, entry), confirmAdd(back, label, entry)
 * 5f. startEdit(), editForm(back, card, labels), confirmEdits(back, card, entry, labels)
 * 5g. startDelete(), confirmDelete(back, card, labels), confirmRemovalInMaster(back, card)
 * 5h. chooseDestination(back, card, verb, doing, then), oneOfEachVersion(matches)
 * 5i. startCopy(), confirmCopy(back, card, label)
 * 5j. startMove(), confirmMove(back, card, label)
 * 6. Keys and clicks
 * 6a. keyName(event)
 * 6b. onKey(event)
 * 6c. onLookupKey(event)
 * 6d. onClick(event)
 * 7. Fitting inside another page (iframe height)
 * 8. Start
 */
(function () {
  "use strict";

  // 1. Settings and data
  const RECENT_COUNT = 25;                                // how many recent lookups to keep
  const RECENT_KEY = "mezmerize.recent";                  // where this browser keeps them
  const ALL = "ALL DECKS";                                 // the label for every built-in deck at once
  const STUDY_MODES = {
    review:   { banner: "Review",            hidden: ["full_name", "description"], shuffle: false },
    acronym:  { banner: "Quiz by Acronym",   hidden: ["full_name", "description"], shuffle: true },
    fullname: { banner: "Quiz by Full Name", hidden: ["acronym", "description"],   shuffle: true },
  };

  const MAX_DECKS = 8;                                     // decks in use at once (keys 1-8)
  const MASTER_LABEL = "(master)";                         // the master list's label in a deck pack
  const PACK_FIELDS = ["deck", "acronym", "full_name", "description"];
  const FIELDS = ["acronym", "full_name", "description"];
  const PARAMS = new URLSearchParams(location.search);
  const QUICK = PARAMS.get("mode") === "quick";            // the quick reference: lookups and cards only
  const DOCKED = QUICK && PARAMS.get("docked") === "1";    // ... docked in a panel on a hub page
  const FROM_HUB = PARAMS.get("from") === "hub";           // ... opened by launcher.js, which can take it as a panel
  const MAIN_NAME = "mezmerize-main";                      // the main window's name, so it's reused
  const PLACE_KEY = "mezmerize.window";                    // where the pop-up last was (launcher.js reads it)
  const MINE_KEY = "mezmerize.mydecks";                    // this browser's copy of the user's own decks
  const USING_KEY = "mezmerize.using";                     // "mine" or "clearday": the set last in use

  let SET = null;                                          // the deck set in use: see clearDaySet()
  let DECKS = [];                                          // its decks; each card knows its deck
  let MASTER = [];                                         // its master list

  const app = document.getElementById("app");
  let S = {};                                             // what's on screen now
  let handlers = {};                                      // key name -> what it does on this screen

  // 1a. Compare text ignoring capitals
  function fold(text) {
    return (text || "").toLowerCase();
  }

  // 1b. A card's identity: acronym and full name ignoring capitals, description exactly
  function versionOf(card) {
    return [fold(card.acronym), fold(card.full_name), card.description].join("\u0001");
  }

  // 1c. The cards in one deck, or in every deck (sorted by acronym, deck order kept for ties)
  function cardsFor(label) {
    if (label !== ALL) {
      const deck = DECKS.find(function (d) { return d.label === label; });
      return deck ? deck.cards.slice() : [];
    }
    const cards = [].concat.apply([], DECKS.map(function (d) { return d.cards; }));
    return cards.sort(function (a, b) {
      const x = fold(a.acronym), y = fold(b.acronym);
      return x < y ? -1 : x > y ? 1 : 0;
    });
  }

  // 1d. Labels of the decks that have this acronym (any version)
  function decksWithAcronym(acronym) {
    const wanted = fold(acronym.trim());
    return DECKS.filter(function (d) {
      return d.cards.some(function (card) { return fold(card.acronym) === wanted; });
    }).map(function (d) { return d.label; });
  }

  // 1e. Labels of the decks that hold this exact version
  function decksWithVersion(card) {
    const wanted = versionOf(card);
    return DECKS.filter(function (d) {
      return d.cards.some(function (other) { return versionOf(other) === wanted; });
    }).map(function (d) { return d.label; });
  }

  // 1f. What each deck holds compared with this card; each other card counts once, as its closest match
  function deckNotes(card) {
    const wanted = fold(card.acronym), name = fold(card.full_name), version = versionOf(card);
    const notes = {};
    DECKS.forEach(function (d) {
      const found = [];
      d.cards.forEach(function (row) {
        if (fold(row.acronym) !== wanted) return;
        let note;
        if (versionOf(row) === version) {
          if (d.label === card.deck) return;              // the card itself isn't a match
          note = "identical";
        } else if (fold(row.full_name) === name) {
          note = "same acronym & name";
        } else {
          note = "same acronym";
        }
        if (found.indexOf(note) < 0) found.push(note);
      });
      notes[d.label] = found;
    });
    return notes;
  }

  // 1g. Keep one copy of each exact version, with every deck that holds it (All decks study)
  function mergeIdentical(cards) {
    const merged = {}, order = [];
    cards.forEach(function (card) {
      const key = versionOf(card);
      if (merged[key]) {
        merged[key].decks.push(card.deck);
      } else {
        merged[key] = Object.assign({}, card, { decks: [card.deck] });
        order.push(key);
      }
    });
    return order.map(function (key) { return merged[key]; });
  }

  // 1h. The cards a study session uses: All decks shows each identical card once
  function studyCards(label) {
    return label === ALL ? mergeIdentical(cardsFor(ALL)) : cardsFor(label);
  }

  // 1i. The ClearDay decks, from decks.js
  function clearDaySet() {
    const data = window.MEZ_DECKS || {};
    return { kind: "clearday", name: "ClearDay decks", date: data.exported || "",
             decks: data.decks || [], master: data.master || [], changed: false };
  }

  // 1j. Put a deck set in use
  function useSet(set) {
    SET = set;
    DECKS = set.decks.map(function (deck) {
      return { label: deck.label, cards: deck.cards.map(function (card) {
        return Object.assign({}, card, { deck: deck.label });
      }) };
    });
    MASTER = set.master;
    saveUsing(set.kind);
  }

  // 1k. Split CSV text into rows of fields (quotes, commas, and line breaks inside quotes)
  function parseCsv(text) {
    text = text.replace(/^﻿/, "");                    // a byte-order mark isn't data
    const rows = [];
    let row = [], field = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch !== '"') field += ch;
        else if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else if (ch === '"') {
        quoted = true;
      } else if (ch === ",") {
        row.push(field); field = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(field); rows.push(row); row = []; field = "";
      } else {
        field += ch;
      }
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  // 1l. A deck's label from a plain deck file's name: is_engineering.csv -> Is Engineering
  function labelFromFilename(name) {
    let label = name.replace(/\.[^.]*$/, "").replace(/_/g, " ").trim();
    if (label === label.toLowerCase()) {
      label = label.replace(/\b\w/g, function (ch) { return ch.toUpperCase(); });
    }
    return label;
  }

  // 1m. Read one file: a deck pack (with a deck column) or a plain deck (acronym,full_name,description)
  // Adds its cards to into: { decks: {key: {label, cards}}, order: [keys], master: [] or null, problems: [] }
  function readDeckFile(name, text, into) {
    const rows = parseCsv(text).filter(function (row) { return row.some(function (f) { return f.trim(); }); });
    if (!rows.length) { into.problems.push(name + ": the file is empty."); return; }
    const header = rows[0].map(function (f) { return f.trim().toLowerCase(); });
    const isPack = header.indexOf("deck") >= 0;
    const needed = isPack ? PACK_FIELDS : FIELDS;
    const missing = needed.filter(function (f) { return header.indexOf(f) < 0; });
    if (missing.length) {
      into.problems.push(name + ": isn't a deck file (the first line needs " + needed.join(",") + ").");
      return;
    }
    const at = {};
    needed.forEach(function (f) { at[f] = header.indexOf(f); });
    const last = header.length - 1;
    rows.slice(1).forEach(function (row, i) {
      if (row.length > header.length && at.description === last) {  // unquoted commas split the description
        row = row.slice(0, last).concat([row.slice(last).join(",")]);
      }
      const card = {};
      FIELDS.forEach(function (f) { card[f] = (row[at[f]] || "").trim(); });
      if (!card.acronym && !card.full_name && !card.description) return;
      const label = isPack ? (row[at.deck] || "").trim() : labelFromFilename(name);
      if (!label) { into.problems.push(name + " line " + (i + 2) + ": " + card.acronym + " has no deck label."); return; }
      const key = fold(label);
      if (key === MASTER_LABEL) { (into.master = into.master || []).push(card); return; }
      if (!into.decks[key]) { into.decks[key] = { label: label, cards: [] }; into.order.push(key); }
      into.decks[key].cards.push(card);
    });
  }

  // 1n. Sort a deck's cards by acronym, ignoring capitals
  function sortCards(cards) {
    return cards.sort(function (a, b) {
      const x = fold(a.acronym), y = fold(b.acronym);
      return x < y ? -1 : x > y ? 1 : 0;
    });
  }

  // 1o. A deck set from chosen decks. A master list in the file is kept exactly as it is;
  // with none, one is built from the decks (every version once).
  function makeSet(name, decks, master) {
    let list = master ? master.slice() : [];
    if (!master) {
      const known = {};
      decks.forEach(function (deck) {
        deck.cards.forEach(function (card) {
          if (!known[versionOf(card)]) { list.push(card); known[versionOf(card)] = true; }
        });
      });
    }
    return { kind: "mine", name: name, date: new Date().toISOString().slice(0, 10),
             decks: decks.map(function (deck) { return { label: deck.label, cards: sortCards(deck.cards.slice()) }; }),
             master: sortCards(list), changed: false };
  }

  // 1p. A deck set as deck pack text: the decks in order, then the master list
  function packCsv(set) {
    const quote = function (text) {
      return /[",\r\n]|^\s|\s$/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
    };
    const lines = [PACK_FIELDS.join(",")];
    const add = function (label, card) {
      lines.push([label, card.acronym, card.full_name, card.description].map(quote).join(","));
    };
    set.decks.forEach(function (deck) { deck.cards.forEach(function (card) { add(deck.label, card); }); });
    set.master.forEach(function (card) { add(MASTER_LABEL, card); });
    return "﻿" + lines.join("\n") + "\n";
  }

  // 1q. A deck's file name, by the usual rule: GRC/Frameworks -> grc_frameworks.csv
  function fileFor(label) {
    return label.toLowerCase().replace(/[ /]/g, "_") + ".csv";
  }

  // 1r. Where this exact version sits in a list of cards, or -1
  function findRow(cards, card) {
    const wanted = versionOf(card);
    for (let i = 0; i < cards.length; i++) {
      if (versionOf(cards[i]) === wanted) return i;
    }
    return -1;
  }

  // 1s. The deck in use with this label, or null
  function deckByLabel(label) {
    return DECKS.find(function (deck) { return deck.label === label; }) || null;
  }

  // 1t. A card's three fields only (no deck)
  function entryOf(card) {
    return { acronym: card.acronym, full_name: card.full_name, description: card.description };
  }

  // 1u. Keep changes: re-sort, mark My decks changed, and keep them in this browser
  function commitChanges() {
    DECKS.forEach(function (deck) { sortCards(deck.cards); });
    sortCards(MASTER);
    SET.decks = DECKS.map(function (deck) { return { label: deck.label, cards: deck.cards.map(entryOf) }; });
    SET.master = MASTER;
    SET.changed = true;
    return saveMine(SET);
  }

  // 1v. The versions rule for the master list after an edit
  function updateMaster(oldCard, newEntry) {
    const position = findRow(MASTER, newEntry);
    if (position < 0) MASTER.push(entryOf(newEntry));            // new version: add it
    else MASTER[position] = entryOf(newEntry);                    // already there: take the new spelling
    if (!decksWithVersion(oldCard).length) {                      // no deck uses the old version anymore
      const old = findRow(MASTER, oldCard);
      if (old >= 0) MASTER.splice(old, 1);
    }
  }


  // 2. Kept in this browser only: Recents and the user's own decks
  // 2a. Read the recent lookups, newest first
  function loadRecent() {
    try {
      const saved = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      return Array.isArray(saved) ? saved.slice(0, RECENT_COUNT) : [];
    } catch (e) {
      return [];
    }
  }

  // 2b. Put an acronym at the front (no repeats) and save
  function saveRecent(acronym) {
    const recent = loadRecent().filter(function (item) { return item !== acronym; });
    recent.unshift(acronym);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, RECENT_COUNT)));
    } catch (e) { /* a convenience: never stop a lookup over it */ }
  }

  // 2c. The user's own decks as this browser last kept them, or null
  function loadMine() {
    try {
      const mine = JSON.parse(localStorage.getItem(MINE_KEY) || "null");
      return mine && Array.isArray(mine.decks) && Array.isArray(mine.master) ? mine : null;
    } catch (e) {
      return null;
    }
  }

  // 2d. Keep the user's own decks in this browser; false if the browser wouldn't keep them
  function saveMine(set) {
    try {
      localStorage.setItem(MINE_KEY, JSON.stringify(set));
      return true;
    } catch (e) {
      return false;
    }
  }

  // 2e. Remember which set was last in use ("mine" or "clearday")
  function saveUsing(kind) {
    try { localStorage.setItem(USING_KEY, kind); } catch (e) { /* a convenience */ }
  }

  function loadUsing() {
    try { return localStorage.getItem(USING_KEY) || "clearday"; } catch (e) { return "clearday"; }
  }


  // 3. Drawing helpers
  // 3a. Make text safe to put inside HTML
  function esc(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  // A word for a count: " card" for 1, " cards" otherwise
  function plural(count, word) {
    return word + (count === 1 ? "" : "s");
  }

  // 3b. The banner: MAJOR - Minor
  function banner(major, minor) {
    return '<header class="banner"><span class="mark" aria-hidden="true"></span><h1>' + esc(major) +
      (minor ? ' - <span class="minor">' + esc(minor) + "</span>" : "") + "</h1>" +
      (QUICK ? '<button type="button" class="close" data-close title="Close (Alt+M)" aria-label="Close">✕</button>' : "") +
      "</header>";
  }

  // 3c. One key on the key bar: the key in green, then what it does
  function keyButton(key, words, main) {
    return '<button type="button" class="key' + (main ? " main" : "") + '" data-key="' + esc(key.toLowerCase()) +
      '"><kbd>' + esc(key) + "</kbd>" + esc(words) + "</button>";
  }

  // 3d. A card: DECK (or DECKS), ACRONYM, FULL NAME, DESCRIPTION. Hidden fields stay blank, one line each.
  function cardHtml(card, options) {
    options = options || {};
    const hidden = options.hidden || [];
    const fields = options.short ? ["acronym", "full_name"] : ["acronym", "full_name", "description"];
    const names = { acronym: "ACRONYM", full_name: "FULL NAME", description: "DESCRIPTION" };
    const labels = options.labels || card.decks || [card.deck];
    const holds = options.holds !== false;                      // names orange only where the card lives
    let rows = !labels.length ? "" : '<dt class="holds">' + (labels.length > 1 ? "DECKS" : "DECK") +
      '</dt><dd class="' + (holds ? "holds" : "") + '">' + labels.map(function (label) {
        return '<span class="nowrap">' + esc(label) + "</span>";
      }).join(", ") + "</dd>";
    if (options.fieldsHtml) {                                   // typing screens: inputs in place of the fields
      rows += options.fieldsHtml;
    } else {
      fields.forEach(function (field) {
        const blank = hidden.indexOf(field) >= 0;
        const text = blank ? "" : (card[field] || options.empty || "");
        rows += "<dt>" + names[field] + '</dt><dd class="' + (field === "acronym" ? "acronym " : "") +
          (blank ? "blank" : "") + '">' + esc(text) + "</dd>";
      });
    }
    rows += options.rows || "";
    const classes = ["card"];
    if (hidden.length) classes.push("hidden-answers");
    if (options.extraClass) classes.push(options.extraClass);
    return '<article class="' + classes.join(" ") + '"' + (options.attrs || "") + ">" +
      (options.title ? '<div class="card-title">' + esc(options.title) + "</div>" : "") +
      '<dl class="fields">' + rows + "</dl>" + (options.after || "") + "</article>";
  }

  // 3e. Put a screen up, and set what each key does on it
  function show(html, keys) {
    app.innerHTML = html;
    handlers = keys || {};
    window.scrollTo(0, 0);
    reportHeight();
  }

  // 3f. The CAUTION card: the card's fields, then each file heading with the files it affects.
  // caution=false drops the title once the card is answered.
  function cautionHtml(sections, entry, labels, holds, title, caution) {
    let rows = '<dd class="gap"></dd>';
    sections.forEach(function (section) {
      rows += "<dt>" + esc(section[0]) + "</dt><dd>" + section[1].map(esc).join("<br>") + "</dd>";
    });
    return cardHtml(entry, { labels: labels, holds: holds, empty: "(blank)", rows: rows,
      extraClass: "caution", title: caution ? "⚠️  " + title + "  ⚠️" : "" });
  }

  // 3g. A RESULT: "RESULT:  Saved. PII was ..." with its word in blue, then lines under the text
  function resultHtml(word, text, more) {
    return '<div class="result"><span class="report">RESULT:</span><div class="body"><p>' +
      (word ? '<span class="report">' + esc(word) + "</span> " : "") + text + "</p>" + (more || "") + "</div></div>";
  }

  // Deck labels under a RESULT, one per line, 2 in from its text; orange where the card lives now
  function labelsHtml(labels, holds) {
    return '<ul class="labels">' + labels.map(function (label) {
      return "<li" + (holds === false ? "" : ' class="holds"') + ">" + esc(label) + "</li>";
    }).join("") + "</ul>";
  }

  // A sentence under a RESULT's first word
  function underHtml(text) {
    return '<p class="under">' + text + "</p>";
  }

  // A deck label in a sentence, kept whole, orange
  function deckWord(label) {
    return '<span class="holds nowrap">' + esc(label) + "</span>";
  }

  // 3h. A confirm screen: draw it, ask, then redraw it answered, with the RESULT.
  // o: { banner: [major, minor], hint, draw(state) -> html, question (html), enter (words for ENTER),
  //      verb ("saved", ...), onEnter() -> { html, card, only: {bar, keys} }, nav(card) -> {bar, keys} }
  // After ENTER the keys are o.nav(card), or only the result's own keys when it gives them.
  function askOrCancel(o) {
    const keys = {
      enter: function () {
        const result = o.onEnter();
        answered("confirmed", result.html, result.only || o.nav(result.card));
      },
      esc: function () {
        answered("cancelled", resultHtml("", "Nothing was " + esc(o.verb) + ".",
          underHtml('<span class="report">NO CHANGES</span> were made.')), o.nav(null));
      },
    };
    show(banner(o.banner[0], o.banner[1]) + (o.hint || "") + o.draw("ask") +
      '<p class="question">' + o.question + "</p>" +
      '<div class="keys">' + keyButton("ENTER", o.enter, true) + keyButton("ESC", "forget it") + "</div>", keys);

    function answered(state, result, next) {
      show(banner(o.banner[0], o.banner[1]) + o.draw(state) + result + next.bar, next.keys);
    }
  }


  // 4. Screens
  // 4a. The deck list (the start screen)
  function showHome() {
    S = { screen: "home" };
    const keys = {};
    let rows = "";
    DECKS.forEach(function (deck, i) {
      const n = String(i + 1);
      keys[n] = function () { showDeckMenu(deck.label); };
      rows += '<li><button type="button" class="choice" data-key="' + n + '"><span class="num">' + n +
        '</span><span class="what">' + esc(deck.label) + '</span><span class="count">' +
        deck.cards.length + plural(deck.cards.length, " card") + "</span></button></li>";
    });
    keys.a = function () { showDeckMenu(ALL); };
    keys.l = function () { startLookup(ALL, "home"); };
    rows += '<li><button type="button" class="choice" data-key="a"><span class="num">A</span>' +
      '<span class="what">' + (SET.kind === "clearday" ? "All Built-in Decks" : "All My Decks") +
      '</span><span class="count">' + studyCards(ALL).length + plural(studyCards(ALL).length, " card") +
      "</span></button></li>";
    rows += '<li><button type="button" class="choice" data-key="l"><span class="num">L</span>' +
      '<span class="what">Look up an acronym in all decks</span></button></li>';
    keys.d = showDecks;
    rows += '<li><button type="button" class="choice" data-key="d"><span class="num">D</span>' +
      '<span class="what">Change decks</span><span class="count">load, save, or switch</span></button></li>';

    show(banner("Study Mode", "Deck List") + "<h2>Which deck to study?</h2>" +
      '<p class="sub">' + setLine() + "</p>" +
      '<ul class="menu">' + rows + "</ul>", keys);
  }

  // What's in use, in one line: "ClearDay decks, as of 2026-11-23" or "My decks: <file>, loaded ..."
  function setLine() {
    if (SET.kind === "clearday") return "ClearDay decks" + (SET.date ? ", as of " + esc(SET.date) : "");
    return "My decks: " + esc(SET.name) + ", loaded " + esc(SET.date) +
      (SET.changed ? ' <span class="report">(changes not yet saved to a file)</span>' : "");
  }

  // 4b. One deck's menu: look up, review, or quiz
  function showDeckMenu(label, note) {
    S = { screen: "menu", deck: label };
    const cards = studyCards(label);
    const keys = {
      "1": function () { startLookup(label, "menu"); },
      "2": function () { startStudy(label, "review"); },
      "3": function () { startStudy(label, "acronym"); },
      "4": function () { startStudy(label, "fullname"); },
      esc: showHome,
    };
    const choices = [
      ["1", "Look up a specific acronym"],
      ["2", "Review all cards in order"],
      ["3", "Random quiz by acronym"],
      ["4", "Random quiz by full name"],
    ];
    let rows = "";
    choices.forEach(function (c) {
      rows += '<li><button type="button" class="choice" data-key="' + c[0] + '"><span class="num">' + c[0] +
        '</span><span class="what">' + c[1] + "</span></button></li>";
    });
    show(banner("Study Mode", "Menu") +
      "<h2>Deck: " + (label === ALL ? (SET.kind === "clearday" ? "All Built-in Decks" : "All My Decks") : '<span class="holds">' + esc(label) + "</span>") + "</h2>" +
      '<p class="sub">' + cards.length + " flashcards</p>" +
      (note ? '<p class="note">' + esc(note) + "</p>" : "") +
      '<ul class="menu">' + rows + "</ul>" +
      '<div class="keys">' + keyButton("ESC", "choose a different deck") + "</div>", keys);
  }

  // 4c. Start reviewing or quizzing a deck
  function startStudy(label, mode) {
    const settings = STUDY_MODES[mode];
    let cards = studyCards(label);
    if (mode === "fullname") cards = cards.filter(function (card) { return card.full_name; });
    if (settings.shuffle) {
      for (let i = cards.length - 1; i > 0; i--) {         // shuffle the cards
        const j = Math.floor(Math.random() * (i + 1));
        const t = cards[i]; cards[i] = cards[j]; cards[j] = t;
      }
    }
    if (!cards.length) {
      showDeckMenu(label, "That deck has no cards for this yet.");
      return;
    }
    S = { screen: "study", deck: label, mode: mode, cards: cards, index: 0, revealed: false };
    showStudyCard();
  }

  // 4d. Show the current card: answers blank until ENTER, then ENTER = next card
  function showStudyCard(animate) {
    const settings = STUDY_MODES[S.mode];
    const card = S.cards[S.index];
    const number = S.index + 1, total = S.cards.length;
    const toMenu = function () { showDeckMenu(S.deck); };
    let keys, bar;
    if (!S.revealed) {
      const reveal = function () { S.revealed = true; showStudyCard(true); };
      keys = { enter: reveal, esc: toMenu, card: reveal };
      bar = keyButton("ENTER", "reveal", true) + keyButton("ESC", "menu");
    } else {
      const next = function () {
        if (S.index + 1 >= S.cards.length) {
          showDeckMenu(S.deck, "Finished: all " + total + " cards.");
          return;
        }
        S.index += 1;
        S.revealed = false;
        showStudyCard();
      };
      keys = { enter: next, "+": function () { showFinder(card, "study"); }, esc: toMenu };
      bar = keyButton("ENTER", number < total ? "next card" : "finish", true) + keyButton("+", "decks") +
        keyButton("ESC", "menu");
    }
    show(banner("Study Mode", settings.banner) +
      cardHtml(card, {
        title: "Card " + number + " of " + total,
        hidden: S.revealed ? [] : settings.hidden,
        extraClass: (S.revealed ? "" : "study") + (animate ? " reveal" : ""),
        attrs: S.revealed ? "" : ' data-key="card" title="Reveal"',
      }) +
      '<div class="keys">' + bar + "</div>", keys);
  }

  // 4e. Start a lookup in one deck (or all); origin is where ESC goes back to
  function startLookup(label, origin) {
    S = { screen: "lookup", deck: label, origin: origin, query: "", place: -1,
          result: null, lastCard: null, visited: null };
    showLookup();
  }

  // 4f. The lookup screen: Recents, the typing line, and any result
  // The Recents line: newest first, the one being rested on highlighted
  function recentsHtml() {
    const recent = loadRecent();
    let html = '<div class="recents"><div class="recents-line"><span class="lead">Recents:</span>';
    if (!recent.length) return html + "<span>(none)</span></div></div>";
    html += '<div class="chips">';
    recent.forEach(function (acronym, i) {
      html += '<button type="button" class="chip' + (i === S.place ? " on" : "") + '" data-recent="' + i + '">' +
        esc(acronym) + "</button>";
    });
    return html + '</div></div><div class="recents-hint">(<kbd>↑</kbd> = earlier' +
      (S.place >= 0 ? '&nbsp;&nbsp;&nbsp;<span class="side">←&nbsp;&nbsp;→</span>' : "") +
      "&nbsp;&nbsp;&nbsp;<kbd>↓</kbd> = more recent)</div></div>";
  }

  // Redraw just the Recents (the typing line keeps its focus and text)
  function markRecents() {
    const box = app.querySelector(".recents");
    box.outerHTML = recentsHtml();
    const on = app.querySelector(".chip.on");
    if (on) on.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function showLookup() {
    let html = banner("Lookup", S.deck === ALL ? "All Decks" : S.deck);
    html += recentsHtml();                                // Recents: newest first; up moves into the list

    html += '<form class="ask" autocomplete="off"><label for="mez-q">Acronym to look up:</label>' +
      '<input id="mez-q" name="q" spellcheck="false" autocapitalize="characters" value="' + esc(S.query) + '">' +
      keyButton("ENTER", "look up", true) + "</form>";

    const keys = { esc: leaveLookup };
    let bar = "";
    if (S.result) {
      const r = S.result;
      html += '<div class="message" aria-live="polite">' + r.message + "</div>";
      r.matches.forEach(function (card, i) {
        html += cardHtml(card, {
          title: "Match " + (i + 1) + " of " + r.matches.length,
          after: '<div class="match-tools"><button type="button" class="key" data-finder="' + i +
            '"><kbd>+</kbd>decks</button></div>',
        });
      });
      keys.enter = function () { S.query = ""; S.result = null; showLookup(); };
      bar += keyButton("ENTER", "new lookup", true);
    }
    const finderCard = S.result && S.result.matches.length ? S.result.matches[0] : S.lastCard;
    if (finderCard) {
      keys["+"] = function () { showFinder(finderCard, "lookup"); };
      bar += keyButton("+", "decks");
    }
    if (QUICK) {                                          // the quick reference: the main window does the rest
      keys.w = function () { openMain(S.result ? S.query : "", ""); };
      bar += keyButton("W", "main window");
      if (DOCKED) {
        keys.p = function () { tellHub("popout"); };
        bar += keyButton("P", "pop out");
      } else if (FROM_HUB && window.opener) {
        keys.p = function () { tellHub("dock"); window.close(); };
        bar += keyButton("P", "panel");
      }
      bar += keyButton("ESC", S.visited ? "all decks" : "close");
    } else {
      bar += keyButton("ESC", "menu");
    }

    let actions = "";                                     // actions on top, navigation below
    if (S.result) {
      const act = function (key, start) {                 // in the quick reference, changes open the main window
        return QUICK ? function () { openMain(S.query, key); } : function () { onMine(start); };
      };
      keys.a = act("a", startAdd);
      actions += keyButton("A", "add");
      if (S.result.matches.length) {
        keys.e = act("e", startEdit);
        keys.d = act("d", startDelete);
        keys.c = act("c", startCopy);
        keys.m = act("m", startMove);
        actions += keyButton("E", "edit") + keyButton("D", "delete") + keyButton("C", "copy") + keyButton("M", "move");
      }
    }
    if (S.ask) {                                          // a question under the cards replaces the key bars
      html += S.ask.html;
      show(html, S.ask.keys);
    } else {
      html += (actions ? '<div class="keys">' + actions + "</div>" : "") + '<div class="keys">' + bar + "</div>";
      show(html, keys);
    }
    const input = document.getElementById("mez-q");
    input.addEventListener("keydown", onLookupKey);
    input.addEventListener("input", function () { S.query = input.value; });
    if (!S.result) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  // 4g. Look up what was typed in this deck; also check the other decks by acronym
  function runLookup(query) {
    query = query.trim();
    if (!query) return;
    const upper = query.toUpperCase();
    const matches = cardsFor(S.deck).filter(function (card) {
      return card.acronym.trim().toUpperCase() === upper;
    });
    const elsewhere = S.deck === ALL ? [] :
      decksWithAcronym(query).filter(function (label) { return label !== S.deck; });
    if (matches.length || elsewhere.length) saveRecent(matches.length ? matches[0].acronym : query);

    const decks = function (labels) {
      return '<span class="holds">' + labels.map(esc).join(", ") + "</span>";
    };
    let message;
    if (!matches.length) {
      if (elsewhere.length) {
        message = "<p>No card found for “" + esc(query) + "” in this deck.</p>" +
          '<p class="where"><span class="lead holds">Found in:</span>' + decks(elsewhere) + "</p>" +
          '<p class="count-line">(' + elsewhere.length + " total)</p>";
      } else {
        message = "<p>No card found for “" + esc(query) + "”.</p>";
      }
    } else {
      if (S.deck === ALL) message = "<p>Found " + matches.length + " card(s) for " + esc(upper) + ".</p>";
      else if (matches.length === 1) message = "<p>Found " + esc(upper) + ".</p>";
      else message = "<p>Found " + matches.length + " cards for " + esc(upper) + ".</p>";
      if (elsewhere.length) {
        let counts = (elsewhere.length + 1) + " total";
        if (matches.length === 1) {
          const identical = decksWithVersion(matches[0]).length;
          if (identical > 1) counts += ", " + identical + " identical";
        }
        message += '<p class="where"><span class="lead holds">Also in:</span>' + decks(elsewhere) + "</p>" +
          '<p class="count-line">(' + counts + ")</p>";
      }
    }
    S.query = query;
    S.place = -1;
    S.result = { matches: matches, message: message };
    if (matches.length) S.lastCard = null;
    showLookup();
  }

  // 4h. ESC from a lookup: to the deck last visited, else back where it started
  function leaveLookup() {
    if (QUICK) {                                          // quick reference: back to all decks, then close
      if (S.visited) startLookup(ALL, "quick");
      else closeQuick();
      return;
    }
    if (S.visited) showDeckMenu(S.visited);
    else if (S.origin === "menu") showDeckMenu(S.deck);
    else showHome();
  }

  // 4n. The quick reference's ways out: close, tell the hub page, or open the main window
  function closeQuick() {
    if (DOCKED) tellHub("close");
    else window.close();
  }

  function tellHub(what) {
    const hub = DOCKED ? window.parent : window.opener;
    if (hub) hub.postMessage({ mezmerize: what, query: S.query || "", place: DOCKED ? null : windowPlace() }, "*");
  }

  // Where the pop-up window is on the screen, and its size, so it can come back there
  function windowPlace() {
    return { x: window.screenX, y: window.screenY, w: window.innerWidth, h: window.innerHeight };
  }

  // The full app in its own window (always the same one), at a lookup; action = a, e, d, c, or m to start
  function openMain(query, action) {
    const url = location.origin + location.pathname + "?lookup=" + encodeURIComponent(query || "") +
      (action ? "&do=" + action : "");
    const main = window.open(url, MAIN_NAME);
    if (main) main.focus();
  }

  // 4i. The deck finder: the card's top, then every deck and what it holds
  function showFinder(card, from) {
    const back = S;                                       // the screen to go back to
    const here = from === "lookup" && back.deck !== ALL ? back.deck : card.deck;
    const notes = deckNotes(card);
    const keys = {};
    let rows = "";
    DECKS.forEach(function (deck, i) {
      const n = String(i + 1);
      const looking = deck.label === here;
      let lines = notes[deck.label].map(function (note) { return "(" + note + ")"; });
      if (deck.label === card.deck && !looking) lines = ["(this card)"].concat(lines);
      if (looking) lines = ["(looking from here)"].concat(lines);
      const inner = '<span class="' + (looking ? "" : "num") + '">' + (looking ? "" : n) + "</span>" +
        '<span class="label' + (lines.length ? " holds" : "") + '">' + esc(deck.label) + "</span>" +
        '<span class="notes">' + lines.map(function (l) { return "<span>" + esc(l) + "</span>"; }).join("") + "</span>";
      if (looking) {
        rows += '<div class="deckrow">' + inner + "</div>";
      } else {
        keys[n] = function () { visit(deck.label); };
        rows += '<button type="button" class="deckrow" data-key="' + n + '">' + inner + "</button>";
      }
    });

    function goBack() {
      S = back;
      if (S.screen === "study") showStudyCard();
      else showLookup();
    }

    function visit(label) {
      if (from === "study") {
        showDeckMenu(label);
        return;
      }
      S = back;                                           // the visited deck becomes the one being looked at
      S.deck = label;
      S.visited = label;
      S.lastCard = card;
      runLookup(S.query || card.acronym);
    }

    keys["+"] = goBack;
    keys.esc = goBack;
    S = { screen: "finder" };
    show(banner(from === "study" ? "Study Mode" : "Lookup", "Deck Finder") +
      '<div class="finder">' + cardHtml(card, { short: true }) +
      '<div class="panel">' + rows + "</div></div>" +
      '<div class="keys"><span class="key hint"><kbd>1-' + DECKS.length + "</kbd>visit</span>" +
      keyButton("+", "back to card") + keyButton("ESC", "back to card") + "</div>", keys);
  }

  // 4j. Change decks: load a deck pack or deck files, save these decks, or switch sets
  function showDecks(message) {
    S = { screen: "decks" };
    const mine = loadMine();
    const keys = { esc: showHome, l: pickFiles, s: saveDecks };
    const choices = [
      ["L", "Load a deck pack or deck files", "from this computer"],
      ["S", "Save these decks to a file", "one deck pack, to Downloads"],
    ];
    if (SET.kind === "mine") {
      keys.c = function () { useSet(clearDaySet()); showDecks("Now using the ClearDay decks."); };
      choices.push(["C", "Use the ClearDay decks", "My decks stay kept here"]);
    } else if (mine) {
      keys.m = function () { useSet(mine); showDecks("Now using My decks: " + esc(mine.name) + "."); };
      choices.push(["M", "Use My decks", mine.name]);
    }
    let rows = "";
    choices.forEach(function (c) {
      rows += '<li><button type="button" class="choice" data-key="' + c[0].toLowerCase() + '"><span class="num">' +
        c[0] + '</span><span class="what">' + esc(c[1]) + '</span><span class="count">' + esc(c[2]) +
        "</span></button></li>";
    });
    show(banner("Decks", "Change Decks") +
      "<h2>In use: " + (SET.kind === "clearday" ? "ClearDay decks" : "My decks") + "</h2>" +
      '<p class="sub">' + setLine() + "</p>" +
      (message ? '<div class="note">' + message + "</div>" : "") +
      '<ul class="menu">' + rows + "</ul>" +
      '<div class="drop" data-key="l">Or drop deck files here. A deck pack holds up to ' + MAX_DECKS +
      ' decks and the master list (<code>deck,acronym,full_name,description</code>); a plain deck file ' +
      "(<code>acronym,full_name,description</code>) takes its name from the file.</div>" +
      '<p class="foot">My decks are kept in this browser between visits. Save them to a file to keep them ' +
      "safe, to use them on another computer, or to split them back into deck files with " +
      "<code>py unpack_decks.py</code>.</p>" +
      '<input type="file" id="mez-file" accept=".csv,text/csv" multiple hidden>' +
      '<div class="keys">' + keyButton("ESC", "deck list") + "</div>", keys);
    document.getElementById("mez-file").addEventListener("change", function (event) {
      loadFiles(event.target.files);
    });
  }

  // Open the file picker
  function pickFiles() {
    const input = document.getElementById("mez-file");
    if (input) input.click();
  }

  // 4k. Read the chosen files; up to 8 decks load at once, more go to the pick screen
  function loadFiles(files) {
    files = Array.prototype.slice.call(files || []);
    if (!files.length) return;
    if (SET.kind === "mine" && SET.changed &&
        !window.confirm("My decks have changes not yet saved to a file. Load other decks anyway?")) return;
    const into = { decks: {}, order: [], master: null, problems: [] };
    Promise.all(files.map(function (file) {
      return file.text().then(function (text) { readDeckFile(file.name, text, into); });
    })).then(function () {
      const decks = into.order.map(function (key) { return into.decks[key]; });
      const name = files.length === 1 ? files[0].name : files.length + " files";
      const problems = into.problems.length ?
        '<p class="report">' + into.problems.map(esc).join("<br>") + "</p>" : "";
      if (!decks.length) {
        showDecks('<p class="report">No decks found.</p>' + problems);
      } else if (decks.length > MAX_DECKS) {
        showPick(name, decks, into.master, problems);
      } else {
        finishLoad(name, decks, into.master, problems);
      }
    });
  }

  // Put the loaded decks in use and keep them in this browser
  function finishLoad(name, decks, master, problems) {
    const set = makeSet(name, decks, master);
    const kept = saveMine(set);
    useSet(set);
    let note = "<p>Loaded " + decks.length + " deck" + (decks.length > 1 ? "s" : "") + " from " + esc(name) + ".</p>";
    if (!master) note += "<p>No master list in the file: one was made from the decks.</p>";
    if (!kept) note += '<p class="report">This browser wouldn\'t keep them: save them to a file before leaving.</p>';
    showDecks(note + (problems || ""));
  }

  // 4l. More than 8 decks: choose which to load
  function showPick(name, decks, master, problems) {
    const chosen = decks.map(function (deck, i) { return i < MAX_DECKS; });
    function draw() {
      S = { screen: "pick" };
      const count = chosen.filter(Boolean).length;
      const keys = { esc: function () { showDecks("Nothing was loaded."); } };
      let rows = "";
      decks.forEach(function (deck, i) {
        const n = String(i + 1);
        const toggle = function () { chosen[i] = !chosen[i]; draw(); };
        if (i < 9) keys[n] = toggle;
        keys["pick" + i] = toggle;
        rows += '<li><button type="button" class="choice' + (chosen[i] ? " on" : "") + '" data-key="' +
          (i < 9 ? n : "pick" + i) + '" aria-pressed="' + chosen[i] + '"><span class="num">' +
          (i < 9 ? n : "") + '</span><span class="what">' + esc(deck.label) + '</span><span class="count">' +
          deck.cards.length + plural(deck.cards.length, " card") + (chosen[i] ? " ✓" : "") + "</span></button></li>";
      });
      const ready = count > 0 && count <= MAX_DECKS;
      if (ready) keys.enter = function () {
        finishLoad(name, decks.filter(function (deck, i) { return chosen[i]; }), master, problems);
      };
      show(banner("Decks", "Choose Decks") +
        "<h2>" + esc(name) + " has " + decks.length + " decks</h2>" +
        '<p class="sub">Choose up to ' + MAX_DECKS + ". " +
        '<span class="' + (ready ? "" : "report") + '">' + count + " chosen.</span></p>" +
        '<ul class="menu">' + rows + "</ul>" +
        '<div class="keys">' + (ready ? keyButton("ENTER", "load these", true) : "") +
        keyButton("ESC", "cancel") + "</div>", keys);
    }
    draw();
  }

  // 4m. Save the decks in use as one deck pack (the browser puts it in Downloads)
  function saveDecks() {
    const now = new Date();
    const pad = function (n) { return String(n).padStart(2, "0"); };
    const name = "mezmerize_decks_" + now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()) +
      "_" + pad(now.getHours()) + pad(now.getMinutes()) + ".csv";
    const url = URL.createObjectURL(new Blob([packCsv(SET)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    if (SET.kind === "mine") { SET.changed = false; saveMine(SET); }
    showDecks("<p>Saved " + SET.decks.length + " decks and the master list as " + esc(name) + ".</p>");
  }


  // 5. Changing cards: add, edit, delete, copy, move (My decks only; the ClearDay decks stay as they are)
  // 5a. Run a change on My decks; from the ClearDay decks, offer to make My decks from them first
  function onMine(action) {
    if (SET.kind === "mine") { action(); return; }
    const back = S;
    const mine = loadMine();
    let note = "<p>The ClearDay decks are shared, so they don't change here. Changes go into My decks: " +
      "a copy of the ClearDay decks, kept in this browser and saved to a file with S on Change decks.</p>";
    if (mine) {
      note += '<p class="report">This replaces My decks kept here now (' + esc(mine.name) + ")" +
        (mine.changed ? ", which have changes not yet saved to a file" : "") + ".</p>";
    }
    show(banner("My Decks", "Make a Copy") + '<div class="message">' + note + "</div>" +
      '<p class="question">Make My decks from the ClearDay decks now?</p>' +
      '<div class="keys">' + keyButton("ENTER", "make My decks", true) + keyButton("ESC", "back") + "</div>", {
        enter: function () {
          const clearday = clearDaySet();
          const set = makeSet("copy of ClearDay decks", clearday.decks, clearday.master);
          saveMine(set);
          useSet(set);
          S = back;
          action();
        },
        esc: function () { S = back; showLookup(); },
      });
  }

  // 5b. The keys after a change: ENTER = new lookup, + = decks (when there's a card), ESC = menu
  function navAfter(back, card) {
    const keys = {
      enter: function () {
        S = back; S.query = ""; S.result = null; S.lastCard = null; S.place = -1; S.ask = null;
        showLookup();
      },
      esc: function () { S = back; S.ask = null; leaveLookup(); },
    };
    let bar = keyButton("ENTER", "new lookup", true);
    if (card) {
      keys["+"] = function () {
        S = back; S.query = ""; S.result = null; S.lastCard = card; S.ask = null;
        showFinder(card, "lookup");
      };
      bar += keyButton("+", "decks");
    }
    bar += keyButton("ESC", "menu");
    return { bar: '<div class="keys">' + bar + "</div>", keys: keys };
  }

  // A note when the browser wouldn't keep a change
  function keptNote(kept) {
    return kept ? "" : '<p class="report">This browser wouldn\'t keep the change: save My decks to a file ' +
      "(S on Change decks) before leaving.</p>";
  }

  // The first of these decks that no longer holds the card (changed in another window), or null
  function missingFrom(card, labels) {
    for (let i = 0; i < labels.length; i++) {
      const deck = deckByLabel(labels[i]);
      if (!deck || findRow(deck.cards, card) < 0) return labels[i];
    }
    return null;
  }

  // The RESULT when a confirmed change can't be made: the card or deck is gone
  function cantResult(verb, card, label) {
    return { html: resultHtml("", '<span class="report">Can\'t ' + verb + ".</span> " + esc(card.acronym) +
      " is no longer in " + esc(label) + ".", underHtml('<span class="report">NO CHANGES</span> were made.')) };
  }

  // "Can't edit. PII is no longer in Cybersecurity." (the decks changed since the lookup)
  function cantScreen(back, title, verb, card, label) {
    show(banner(title[0], title[1]) + resultHtml("", '<span class="report">Can\'t ' + verb + ".</span> " +
      esc(card.acronym) + " is no longer in " + esc(label) + ".",
      underHtml('<span class="report">NO CHANGES</span> were made.')) + navAfter(back, null).bar,
      navAfter(back, null).keys);
  }

  // 5c. Ask below the lookup's cards (like the PowerShell prompt under them); ESC cancels
  function askInLookup(html, keys) {
    const back = S;
    keys.esc = function () { back.ask = null; S = back; showLookup(); };
    S.ask = { html: html, keys: keys };
    showLookup();
  }

  // Which card, and which decks: "Edit which?  1 = Cybersecurity ..." or "You chose Edit.  D / A"
  // then(card, labels) runs with the card and the deck labels the change applies to.
  function chooseScope(verb, then) {
    const matches = S.result.matches;
    if (matches.length > 1) {
      pickFromMatches(matches.map(function (card, i) { return [i + 1, card]; }), verb, true, function (card, labels) {
        S.ask = null; then(card, labels);
      });
      return;
    }
    const card = matches[0];
    const decks = decksWithVersion(card);
    if (decks.length <= 1) { then(card, [card.deck]); return; }
    askInLookup('<div class="asking"><p>You chose ' + esc(verb) + ".</p>" +
      '<div class="keys indent">' + keyButton("D", "in this deck only") +
      keyButton("A", "in all decks (" + decks.length + " identical)") + keyButton("ESC", "cancel") + "</div></div>", {
        d: function () { S.ask = null; then(card, [card.deck]); },
        a: function () { S.ask = null; then(card, decks); },
      });
  }

  // Pick one of several matches by number; A = all of them when they're identical
  function pickFromMatches(numbered, verb, allowAll, then) {
    const keys = {};
    let choices = "";
    numbered.forEach(function (pair) {
      const n = String(pair[0]), card = pair[1];
      keys[n] = function () { then(card, [card.deck]); };
      choices += '<button type="button" class="key" data-key="' + n + '"><kbd>' + n + '</kbd><span class="holds">' +
        esc(card.deck) + "</span></button>";
    });
    const first = numbered[0][1];
    let extras = "";
    if (allowAll && numbered.every(function (pair) { return versionOf(pair[1]) === versionOf(first); })) {
      keys.a = function () { then(first, decksWithVersion(first)); };
      extras += keyButton("A", "all decks (identical)");
    }
    askInLookup('<div class="asking"><div class="keys"><span class="lead">' + esc(verb) + " which?</span>" +
      choices + "</div>" + '<div class="keys indent">' + extras + keyButton("ESC", "cancel") + "</div></div>", keys);
  }

  // 5d. Typing a card: the fields as inputs. ENTER goes to the next field, then on; ESC cancels.
  function formRows(prompts, values) {
    return ["acronym", "full_name", "description"].map(function (field, i) {
      const input = field === "description" ?
        '<textarea id="f-' + field + '" rows="2" spellcheck="true">' + esc(values[field] || "") + "</textarea>" :
        '<input id="f-' + field + '" value="' + esc(values[field] || "") + '" spellcheck="false"' +
          (field === "acronym" ? ' autocapitalize="characters"' : "") + ">";
      return "<dt><label for=\"f-" + field + '">' + prompts[i] + "</label></dt><dd>" + input + "</dd>";
    }).join("");
  }

  function wireForm(onDone, onCancel) {
    const ids = ["f-acronym", "f-full_name", "f-description"];
    const read = function () {
      const entry = {};
      ids.forEach(function (id) { entry[id.slice(2)] = document.getElementById(id).value.replace(/\s+/g, " ").trim(); });
      return entry;
    };
    ids.forEach(function (id, i) {
      document.getElementById(id).addEventListener("keydown", function (event) {
        if (event.key === "Escape") { event.preventDefault(); onCancel(); return; }
        if (event.key !== "Enter") return;
        event.preventDefault();
        if (i < ids.length - 1) document.getElementById(ids[i + 1]).focus();
        else onDone(read());
      });
    });
    handlers.enter = function () { onDone(read()); };
    handlers.esc = onCancel;
    const first = document.getElementById(ids[0]);
    first.focus();
    first.setSelectionRange(first.value.length, first.value.length);
  }

  // 5e. Add: pick a deck, type the card, check it, confirm, save
  function startAdd() {
    chooseTargetDeck(S, S.query);
  }

  function chooseTargetDeck(back, acronym) {
    S = { screen: "add" };
    const keys = { esc: function () { S = back; S.ask = null; showLookup(); } };
    let rows = "";
    DECKS.forEach(function (deck, i) {
      const n = String(i + 1);
      keys[n] = function () { addForm(back, deck.label, acronym); };
      rows += '<li><button type="button" class="choice" data-key="' + n + '"><span class="num">' + n +
        '</span><span class="what">' + esc(deck.label) + "</span></button></li>";
    });
    show(banner("Add an Acronym", "Deck List") + "<h2>Which deck gets the new acronym?</h2>" +
      '<ul class="menu">' + rows + "</ul>" + '<div class="keys">' + keyButton("ESC", "back") + "</div>", keys);
  }

  function addForm(back, label, acronym) {
    let start = acronym || "";
    if (start === start.toLowerCase()) start = start.toUpperCase();
    S = { screen: "form" };
    show(banner("Add an Acronym") + '<p class="hint">Enter the new acronym.</p>' +
      cardHtml({}, { labels: [label], holds: false, extraClass: "form",
        fieldsHtml: formRows(["Acronym:", "Full name:", "Description:"], { acronym: start }) }) +
      '<div class="keys">' + keyButton("ENTER", "continue", true) + keyButton("ESC", "back to the deck list") + "</div>", {});
    wireForm(function (entry) {
      if (!entry.acronym) { document.getElementById("f-acronym").focus(); return; }
      checkAdd(back, label, entry);
    }, function () { chooseTargetDeck(back, acronym); });
  }

  // The keys after an add: A = add another (same acronym, back to the deck list), then the lookup's
  function addNav(back) {
    const nav = navAfter(back, null);
    nav.keys.a = function () { chooseTargetDeck(back, back.query); };
    nav.bar = '<div class="keys">' + keyButton("A", "add another") + "</div>" + nav.bar;
    return nav;
  }

  function nothingAdded() {
    return resultHtml("", "Nothing was added.", underHtml('<span class="report">NO CHANGES</span> were made.'));
  }

  // Only the exact same version in this deck is refused; anything close is shown first
  function checkAdd(back, label, entry) {
    const deck = deckByLabel(label);
    const top = banner("Add an Acronym") + cardHtml(entry, { labels: [label], holds: false });
    const done = function (html) { const nav = addNav(back); show(top + html + nav.bar, nav.keys); };
    if (findRow(deck.cards, entry) >= 0) {
      done('<div class="message"><p>' + esc(entry.acronym) + " already in " + deckWord(label) +
        ", exactly as entered.</p></div>" + nothingAdded());
      return;
    }
    let message = "";
    const others = decksWithVersion(entry);
    if (others.length) {
      message = others.length === 1 ?
        "<p>" + esc(entry.acronym) + " already in " + deckWord(others[0]) + ", exactly as entered.</p>" :
        "<p>" + esc(entry.acronym) + " already in (" + others.length + ") decks, exactly as entered:</p>" +
          '<ul class="columns">' + others.map(function (l) { return '<li class="holds">' + esc(l) + "</li>"; }).join("") + "</ul>";
      message += '<p class="tip">Tip: use <kbd>C</kbd> = copy from a lookup next time, if applicable.</p>';
    } else {
      const acronym = fold(entry.acronym), name = fold(entry.full_name);
      const matches = MASTER.concat(deck.cards).filter(function (row) {
        return fold(row.acronym) === acronym && versionOf(row) !== versionOf(entry);
      });
      const descriptions = [], names = [];
      matches.forEach(function (row) {
        if (fold(row.full_name) === name && row.description && descriptions.indexOf(row.description) < 0) {
          descriptions.push(row.description);
        }
        if (fold(row.full_name) !== name && names.indexOf(row.full_name) < 0) names.push(row.full_name);
      });
      if (descriptions.length) {
        message = "<p>" + esc(entry.acronym) + " (" + esc(entry.full_name) + ") already exists with a different description:</p>" +
          '<ul class="dashes">' + descriptions.sort().map(function (d) { return "<li>" + esc(d) + "</li>"; }).join("") + "</ul>";
      } else if (names.length) {
        message = "<p>" + esc(entry.acronym) + " already exists with a different full name:</p>" +
          '<ul class="dashes">' + names.sort().map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul>";
      }
    }
    if (!message) { confirmAdd(back, label, entry); return; }
    S = { screen: "add" };
    show(top + '<div class="message">' + message + "</div>" + '<p class="question">Add anyway?</p>' +
      '<div class="keys">' + keyButton("Y", "yes", true) + keyButton("N", "no") + keyButton("ESC", "no") + "</div>", {
        y: function () { confirmAdd(back, label, entry); },
        n: function () { done('<div class="message">' + message + "</div>" + nothingAdded()); },
        esc: function () { done('<div class="message">' + message + "</div>" + nothingAdded()); },
      });
  }

  function confirmAdd(back, label, entry) {
    const files = [fileFor(label)];
    const masterToo = findRow(MASTER, entry) < 0;              // the master list doesn't have this version yet
    if (masterToo) files.push("master.csv");
    askOrCancel({
      banner: ["Add an Acronym"],
      draw: function (state) {
        return cautionHtml([[state === "confirmed" ? "WRITTEN TO:" : "WRITE TO:", files]], entry, [label],
          state === "confirmed", "PENDING WRITE", state === "ask");
      },
      question: "Add this card to " + '<span class="nowrap">' + esc(label) + "</span> now?",
      enter: "save it", verb: "saved",
      onEnter: function () {
        const deck = deckByLabel(label);                      // looked up now: another window may have changed My decks
        if (!deck) return cantResult("add", entry, label);
        if (findRow(deck.cards, entry) >= 0) {
          return { html: '<div class="message"><p>' + esc(entry.acronym) + " already in " + deckWord(label) +
            ", exactly as entered.</p></div>" + nothingAdded() };
        }
        deck.cards.push(Object.assign(entryOf(entry), { deck: label }));
        if (findRow(MASTER, entry) < 0) {
          const backlog = findRow(MASTER, Object.assign({}, entry, { description: "" }));
          if (backlog < 0) MASTER.push(entryOf(entry));
          else MASTER[backlog] = entryOf(entry);                // fill in the description
        }
        const kept = commitChanges();
        return { html: resultHtml("Saved.", esc(entry.acronym) + " was added to and re-sorted in:",
          labelsHtml([label])) + keptNote(kept) };
      },
      nav: function () { return addNav(back); },
    });
  }

  // 5f. Edit: one deck or every deck with the identical card; then the master list's versions rule
  function startEdit() {
    const back = S;
    chooseScope("Edit", function (card, labels) {
      const missing = missingFrom(card, labels);
      if (missing) { cantScreen(back, ["Edit an Acronym"], "edit", card, missing); return; }
      editForm(back, card, labels);
    });
  }

  function editForm(back, card, labels) {
    S = { screen: "form" };
    const editing = cardHtml(card, { labels: labels, title: "EDITING", extraClass: "form",
      fieldsHtml: formRows(["ACRONYM", "FULL NAME", "DESCRIPTION"], card) });
    show(banner("Edit an Acronym") +
      '<p class="hint">Edit each field, then ENTER. ESC cancels. Nothing is saved until it\'s approved on the next screen.</p>' +
      cardHtml(card, { title: "CURRENT", labels: labels }) + editing +
      '<div class="keys">' + keyButton("ENTER", "continue", true) + keyButton("ESC", "cancel") + "</div>", {});
    const stop = function (text) {
      const nav = navAfter(back, null);
      show(banner("Edit an Acronym") + cardHtml(card, { title: "CURRENT", labels: labels }) + text + nav.bar, nav.keys);
    };
    const cancelled = function () {
      stop(resultHtml("", "Nothing was saved.", underHtml('<span class="report">NO CHANGES</span> were made.')));
    };
    wireForm(function (entry) {
      if (!entry.acronym) { cancelled(); return; }               // a blank acronym cancels, as in PowerShell
      if (FIELDS.every(function (f) { return entry[f] === card[f]; })) {
        stop(resultHtml("", "No changes made. Nothing was saved."));
        return;
      }
      confirmEdits(back, card, entry, labels);
    }, cancelled);
  }

  function confirmEdits(back, card, entry, labels) {
    const files = labels.map(fileFor).concat(["master.csv"]);
    const where = labels.length === 1 ? deckWord(labels[0]) : "(" + labels.length + ") decks";
    askOrCancel({
      banner: ["Edit an Acronym"],
      draw: function (state) {
        const confirmed = state === "confirmed";
        return cardHtml(card, { title: confirmed ? "PREVIOUS" : "CURRENT", labels: labels }) +
          cautionHtml([[confirmed ? "WRITTEN TO:" : "WRITE TO:", files]], entry, labels, true, "PENDING WRITE", state === "ask");
      },
      question: "Save edits to " + where + " now?",
      enter: "save it", verb: "saved",
      onEnter: function () {
        const missing = missingFrom(card, labels);              // checked now: another window may have changed it
        if (missing) return cantResult("edit", card, missing);
        labels.forEach(function (label) {
          const deck = deckByLabel(label);
          deck.cards[findRow(deck.cards, card)] = Object.assign(entryOf(entry), { deck: label });
        });
        updateMaster(card, entry);
        const kept = commitChanges();
        return { html: resultHtml("Saved.", esc(entry.acronym) + " was edited and re-sorted in:", labelsHtml(labels)) +
          keptNote(kept) };
      },
      nav: function () { return navAfter(back, null); },
    });
  }

  // 5g. Delete: from the decks first; if that leaves the card only in the master list, ask about it next
  function startDelete() {
    const back = S;
    chooseScope("Delete", function (card, labels) {
      const missing = missingFrom(card, labels);
      if (missing) { cantScreen(back, ["Delete an Acronym"], "delete", card, missing); return; }
      confirmDelete(back, card, labels);
    });
  }

  function confirmDelete(back, card, labels) {
    const files = labels.map(fileFor);
    const where = labels.length === 1 ? deckWord(labels[0]) : "(" + labels.length + ") decks";
    askOrCancel({
      banner: ["Delete an Acronym"],
      draw: function (state) {
        return cautionHtml([[state === "confirmed" ? "ERASED FROM:" : "DELETE FROM:", files]], card, labels,
          state !== "confirmed", "PENDING DELETE", state === "ask");
      },
      question: "Delete this card from " + where + " now?",
      enter: "delete it", verb: "deleted",
      onEnter: function () {
        const missing = missingFrom(card, labels);              // checked now: another window may have changed it
        if (missing) return cantResult("delete", card, missing);
        labels.forEach(function (label) {
          const deck = deckByLabel(label);
          deck.cards.splice(findRow(deck.cards, card), 1);
        });
        const kept = commitChanges();
        const remaining = decksWithVersion(card);
        let html = resultHtml("Deleted.", esc(card.acronym) + " was removed from:", labelsHtml(labels, false) +
          (remaining.length ? underHtml("It's still in:") + labelsHtml(remaining) : "") +
          (!remaining.length && findRow(MASTER, card) >= 0 ?
            underHtml("It's now left orphaned in the master list, making it a backlog card. " + esc(card.acronym) +
              " can remain there to work on later, or be removed. That choice comes next.") : "")) + keptNote(kept);
        if (!remaining.length && findRow(MASTER, card) >= 0) {
          return { html: html, only: {
            bar: '<div class="keys">' + keyButton("ENTER", "continue to the master list", true) + "</div>",
            keys: { enter: function () { confirmRemovalInMaster(back, card); } } } };
        }
        return { html: html };
      },
      nav: function () { return navAfter(back, null); },
    });
  }

  // The last deck copy is gone: keep the card in the master list as backlog, or remove it (typed exactly)
  function confirmRemovalInMaster(back, card) {
    S = { screen: "master" };
    const title = ["Delete an Acronym", "Master"];
    const draw = function (state) {
      const heading = state === "confirmed" ? "ERASED FROM:" : state === "kept" ? "KEPT IN:" : "DELETE FROM:";
      return banner(title[0], title[1]) +
        (state === "ask" ? '<p class="hint">' + esc(card.acronym) + " is orphaned, left only in the master list. " +
          "Keep it there as backlog, or remove it—a removal can't be undone. R will ask for " +
          esc(card.acronym) + " to be typed exactly first.</p>" : "") +
        cautionHtml([[heading, ["master.csv"]]], card, [], false, "PENDING FINAL DELETE", state === "ask");
    };
    const finish = function (state, html) {
      const nav = navAfter(back, null);
      show(draw(state) + html + nav.bar, nav.keys);
    };
    const kept = function () {
      finish("kept", resultHtml("Kept.", esc(card.acronym) + " stays in the master list as backlog."));
    };
    const typing = function () {
      show(draw("ask") + '<p class="question">Remove this card from the master list now?</p>' +
        '<form class="ask" autocomplete="off"><label for="f-type">Type ' + esc(card.acronym) +
        ' exactly, matching case:</label><input id="f-type" spellcheck="false">' +
        keyButton("ESC", "keep it") + '</form><p class="hint" id="f-hint"></p>', { esc: kept });
      const input = document.getElementById("f-type");
      input.focus();
      input.addEventListener("keydown", function (event) {
        if (event.key === "Escape") { event.preventDefault(); kept(); return; }
        if (event.key !== "Enter") return;
        event.preventDefault();
        const typed = input.value.trim(), acronym = card.acronym;
        if (typed === acronym) {
          const position = findRow(MASTER, card);
          if (position < 0) {                                    // already gone (another window)
            finish("kept", cantResult("remove", card, "the master list").html);
            return;
          }
          MASTER.splice(position, 1);
          const ok = commitChanges();
          finish("confirmed", resultHtml("Removed.", esc(acronym) + " was erased from the master list.") + keptNote(ok));
          return;
        }
        let hint;
        if (fold(typed) === fold(acronym)) hint = "Close! But the capital letters don't match. Type " + acronym + " exactly as shown.";
        else if (typed.length !== acronym.length) hint = "That's " + typed.length + " character" + (typed.length === 1 ? "" : "s") +
          "; " + acronym + " has " + acronym.length + ". Try again.";
        else hint = "Same length, but the letters aren't the same as " + acronym + ". Check typing and try again.";
        document.getElementById("f-hint").textContent = hint;
        input.select();
      });
    };
    show(draw("ask") + '<p class="question">Remove this card from the master list now?</p>' +
      '<div class="keys">' + keyButton("R", "remove it") + keyButton("K", "keep it (backlog)") +
      keyButton("ESC", "keep it (backlog)") + "</div>", { r: typing, k: kept, esc: kept });
  }

  // 5h. Copy or move: every deck, numbered only where this card can go
  function chooseDestination(back, card, verb, doing, then) {
    S = { screen: "destination" };
    const sameCard = decksWithVersion(card);
    const sameAcronym = decksWithAcronym(card.acronym);
    const keys = { esc: function () { S = back; S.ask = null; showLookup(); } };
    let rows = "";
    DECKS.forEach(function (deck, i) {
      const n = String(i + 1);
      let note = "";
      if (deck.label === card.deck) note = "(" + doing + " from here)";
      else if (sameCard.indexOf(deck.label) >= 0) note = "(already has it)";
      if (note) {
        rows += '<li><div class="choice off"><span class="num"></span><span class="what holds">' + esc(deck.label) +
          '</span><span class="count report">' + note + "</span></div></li>";
        return;
      }
      keys[n] = function () { then(deck.label); };
      rows += '<li><button type="button" class="choice" data-key="' + n + '"><span class="num">' + n +
        '</span><span class="what">' + esc(deck.label) + '</span><span class="count report">' +
        (sameAcronym.indexOf(deck.label) >= 0 ? "(has a different " + esc(card.acronym) + ")" : "") +
        "</span></button></li>";
    });
    const open = Object.keys(keys).length > 1;
    if (!open) keys.enter = keys.esc;
    show(banner(verb + " an Acronym", "Deck List") + "<h2>" + esc(verb) + " " + esc(card.acronym) + " to which deck?</h2>" +
      '<ul class="menu">' + rows + "</ul>" +
      (open ? "" : '<p class="note">' + esc(card.acronym) + " is already in every deck. There's nowhere to " +
        verb.toLowerCase() + " it.</p>") +
      '<div class="keys">' + (open ? "" : keyButton("ENTER", "back")) + keyButton("ESC", "back") + "</div>", keys);
  }

  // The first match of each version (copy offers each version once)
  function oneOfEachVersion(matches) {
    const seen = {}, versions = [];
    matches.forEach(function (card, i) {
      if (!seen[versionOf(card)]) { seen[versionOf(card)] = true; versions.push([i + 1, card]); }
    });
    return versions;
  }

  // 5i. Copy: the card, exactly as it is, into one other deck; the master list gets it only if it lacks it
  function startCopy() {
    const back = S;
    const versions = oneOfEachVersion(S.result.matches);
    const go = function (card) {
      S.ask = null;
      chooseDestination(back, card, "Copy", "copying", function (label) { confirmCopy(back, card, label); });
    };
    if (versions.length === 1) go(versions[0][1]);
    else pickFromMatches(versions, "Copy", false, function (card) { go(card); });
  }

  function confirmCopy(back, card, label) {
    const deck = deckByLabel(label);
    const different = deck.cards.filter(function (row) { return fold(row.acronym) === fold(card.acronym); });
    const masterToo = findRow(MASTER, card) < 0;
    const files = [fileFor(label)].concat(masterToo ? ["master.csv"] : []);
    askOrCancel({
      banner: ["Copy an Acronym"],
      draw: function (state) {
        const confirmed = state === "confirmed";
        const sections = [[confirmed ? "COPIED TO:" : "COPY TO:", files]];
        return cardHtml(card, { title: confirmed ? "COPIED FROM" : "COPYING FROM" }) +
          cautionHtml(sections, different.length ? different[0] : card, [label], confirmed,
            different.length ? "VERSION CONFLICT" : "PENDING COPY", state === "ask");
      },
      question: different.length ?
        "A different version of " + esc(card.acronym) + " already exists in " + '<span class="nowrap">' + esc(label) +
          "</span>. Copy anyway?" :
        "Copy this card from " + deckWord(card.deck) + " to " + '<span class="nowrap">' + esc(label) + "</span> now?",
      enter: "copy it", verb: "copied",
      onEnter: function () {
        const target = deckByLabel(label);                    // looked up now: another window may have changed it
        if (!target) return cantResult("copy", card, label);
        if (findRow(target.cards, card) >= 0) {
          return { html: resultHtml("", '<span class="report">Can\'t copy.</span> ' + esc(card.acronym) +
            " is already in " + esc(label) + ".", underHtml('<span class="report">NO CHANGES</span> were made.')) };
        }
        target.cards.push(Object.assign(entryOf(card), { deck: label }));
        if (findRow(MASTER, card) < 0) MASTER.push(entryOf(card));
        const kept = commitChanges();
        return { html: resultHtml("Copied.", esc(card.acronym) + " was added to and re-sorted in:", labelsHtml([label])) +
          keptNote(kept), card: card };
      },
      nav: function (shown) { return navAfter(back, shown); },
    });
  }

  // 5j. Move: copy into the other deck, then remove it from its own; the master list isn't touched
  function startMove() {
    const back = S;
    const go = function (card) {
      S.ask = null;
      if (missingFrom(card, [card.deck])) {
        cantScreen(back, ["Move an Acronym"], "move", card, card.deck);
        return;
      }
      chooseDestination(back, card, "Move", "moving", function (label) { confirmMove(back, card, label); });
    };
    const matches = S.result.matches;
    if (matches.length === 1) go(matches[0]);
    else pickFromMatches(matches.map(function (card, i) { return [i + 1, card]; }), "Move", false, go);
  }

  function confirmMove(back, card, label) {
    const target = deckByLabel(label), source = deckByLabel(card.deck);
    const different = target.cards.filter(function (row) { return fold(row.acronym) === fold(card.acronym); });
    askOrCancel({
      banner: ["Move an Acronym"],
      draw: function (state) {
        const confirmed = state === "confirmed";
        const sections = confirmed ?
          [["MOVED TO:", [fileFor(label)]], ["MOVED FROM:", [fileFor(card.deck)]]] :
          [["COPY TO:", [fileFor(label)]], ["REMOVE FROM:", [fileFor(card.deck)]]];
        const top = confirmed ?                                  // the source deck no longer has it
          cardHtml({ deck: card.deck, acronym: "(not found)", full_name: "", description: "" },
            { title: "PREVIOUS", holds: false }) :
          cardHtml(card, { title: "MOVING FROM" });
        return top + cautionHtml(sections, different.length ? different[0] : card, [label], confirmed,
          different.length ? "VERSION CONFLICT" : "PENDING MOVE", state === "ask");
      },
      question: different.length ?
        "A different version of " + esc(card.acronym) + " already exists in " + '<span class="nowrap">' + esc(label) +
          "</span>. Move anyway?" :
        "Move this card from " + deckWord(card.deck) + " to " + '<span class="nowrap">' + esc(label) + "</span> now?",
      enter: "move it", verb: "moved",
      onEnter: function () {
        const target = deckByLabel(label), source = deckByLabel(card.deck);   // looked up now
        if (!target) return cantResult("move", card, label);
        const missing = missingFrom(card, [card.deck]);
        if (missing) return cantResult("move", card, missing);
        target.cards.push(Object.assign(entryOf(card), { deck: label }));
        source.cards.splice(findRow(source.cards, card), 1);
        const kept = commitChanges();
        return { html: resultHtml("Moved.", esc(card.acronym) + " was relocated from:", labelsHtml([card.deck], false) +
          underHtml("to:") + labelsHtml([label]) + underHtml("Both decks were re-sorted.")) + keptNote(kept),
          card: Object.assign({}, card, { deck: label }) };
      },
      nav: function (shown) { return navAfter(back, shown); },
    });
  }


  // 6. Keys and clicks
  // 6a. A key's name as the screens use it: enter, esc, +, 1, a, ...
  function keyName(event) {
    if (event.key === "Enter") return "enter";
    if (event.key === "Escape") return "esc";
    if (event.key === "=") return "+";                    // the + key, with or without SHIFT
    if (event.key.length === 1) return event.key.toLowerCase();
    return null;
  }

  // 6b. A key pressed anywhere on the page
  function onKey(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target && /^(INPUT|TEXTAREA)$/.test(event.target.tagName)) return;  // typing lines handle their own keys
    const name = keyName(event);
    if (name === "enter" && event.target && event.target.tagName === "BUTTON") return;  // let the button click
    if (S.screen === "lookup" && S.result && !S.ask && name && name.length === 1 && !handlers[name] && /\S/.test(name)) {
      event.preventDefault();                                          // typing after a result starts a new lookup
      S.query = event.key;
      S.result = null;
      showLookup();
      return;
    }
    if (S.screen === "lookup" && !S.ask && event.key === "ArrowUp") {
      event.preventDefault();
      document.getElementById("mez-q").focus();
      return;
    }
    if (name && handlers[name]) {
      event.preventDefault();
      handlers[name]();
    }
  }

  // 6c. Keys on the lookup line: ENTER looks up; up / down / left / right move through Recents
  function onLookupKey(event) {
    const input = event.target;
    const recent = loadRecent();
    const inList = S.place >= 0;
    const redraw = markRecents;

    if (event.key === "Enter") {
      event.preventDefault();
      if (inList) {                                                    // put the highlighted entry on the line
        input.value = recent[S.place];
        S.query = input.value;
        S.place = -1;
        redraw();
      } else if (input.value.trim()) {
        runLookup(input.value);
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (inList) { S.place = -1; redraw(); }
      else leaveLookup();
      return;
    }
    if (!recent.length) return;
    if (event.key === "ArrowUp" || (inList && event.key === "ArrowRight")) {
      event.preventDefault();
      S.place = Math.min(S.place + 1, recent.length - 1);
      redraw();
      return;
    }
    if (inList && (event.key === "ArrowDown" || event.key === "ArrowLeft")) {
      event.preventDefault();
      S.place -= 1;                                                    // past the newest: back to the line
      redraw();
      return;
    }
    if (inList) {                                                      // typing or Backspace: back to the line
      S.place = -1;
      redraw();
    }
  }

  // 6d. A click or tap on a key, a choice, a recent, or a card
  function onClick(event) {
    if (event.target.closest("[data-close]")) { closeQuick(); return; }   // the quick reference's ✕
    const recentButton = event.target.closest("[data-recent]");
    if (recentButton) {
      S.query = loadRecent()[Number(recentButton.getAttribute("data-recent"))] || "";
      S.place = -1;
      runLookup(S.query);
      return;
    }
    const finderButton = event.target.closest("[data-finder]");
    if (finderButton && S.result) {
      showFinder(S.result.matches[Number(finderButton.getAttribute("data-finder"))], "lookup");
      return;
    }
    if (event.target.closest(".ask .key")) {
      const input = document.getElementById("mez-q");
      if (input.value.trim()) runLookup(input.value);
      else input.focus();
      return;
    }
    const keyed = event.target.closest("[data-key]");
    if (keyed && handlers[keyed.getAttribute("data-key")]) {
      handlers[keyed.getAttribute("data-key")]();
    }
  }


  // 7. Fitting inside another page: tell the page holding this one how tall it is
  function reportHeight() {
    if (window.parent === window) return;
    window.parent.postMessage({ mezmerize: "height", height: document.documentElement.scrollHeight }, "*");
  }


  // 8. Start: the set last in use (the user's own decks if this browser kept them), else ClearDay
  document.addEventListener("keydown", onKey);
  app.addEventListener("click", onClick);
  app.addEventListener("submit", function (event) { event.preventDefault(); });
  document.addEventListener("dragover", function (event) {
    if (S.screen === "decks") { event.preventDefault(); app.classList.add("dropping"); }
  });
  document.addEventListener("dragleave", function () { app.classList.remove("dropping"); });
  document.addEventListener("drop", function (event) {
    app.classList.remove("dropping");
    if (S.screen !== "decks") return;
    event.preventDefault();
    loadFiles(event.dataTransfer.files);
  });
  if ("ResizeObserver" in window) new ResizeObserver(reportHeight).observe(document.documentElement);

  // Another window or tab changed My decks: use the new copy here too, so neither undoes the other
  window.addEventListener("storage", function (event) {
    if (event.key !== MINE_KEY || !SET || SET.kind !== "mine") return;
    const fresh = loadMine();
    useSet(fresh || clearDaySet());                       // none left: back to the ClearDay decks
    if (S.screen === "home") showHome();
    else if (S.screen === "decks") showDecks();
  });

  // The pop-up remembers where it was when it closes, so the next Alt+M opens it there (launcher.js)
  window.addEventListener("pagehide", function () {
    if (!QUICK || DOCKED) return;
    try { localStorage.setItem(PLACE_KEY, JSON.stringify(windowPlace())); } catch (e) { /* a convenience */ }
  });

  // Alt+M closes the quick reference (the hub page's Alt+M opens it); caught before the typing line sees it
  document.addEventListener("keydown", function (event) {
    if (QUICK && event.altKey && !event.ctrlKey && !event.metaKey && event.code === "KeyM") {
      event.preventDefault();
      event.stopPropagation();
      closeQuick();
    }
  }, true);

  const mine = loadMine();
  useSet(loadUsing() === "mine" && mine ? mine : clearDaySet());
  if (QUICK) {
    app.classList.add("quick");
    document.title = "Mezmerize lookup";
    startLookup(ALL, "quick");
    if (PARAMS.get("q")) runLookup(PARAMS.get("q"));
  } else if (PARAMS.has("lookup")) {                      // from the quick reference: a lookup, maybe an action
    startLookup(ALL, "home");
    const query = PARAMS.get("lookup"), action = PARAMS.get("do");
    if (query) runLookup(query);
    history.replaceState(null, "", location.pathname);     // a reload starts fresh, without redoing the action
    if (action && /^[aedcm]$/.test(action) && handlers[action]) handlers[action]();
  } else if (DECKS.length) {
    showHome();
  } else {
    showDecks('<p class="report">No ClearDay decks found (run  py export_decks.py  to make decks.js). ' +
      "Load a deck pack or deck files to begin.</p>");
  }
})();
