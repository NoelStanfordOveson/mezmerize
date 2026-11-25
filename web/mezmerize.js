/*
 * mezmerize.js: the web version of mezmerize (study and lookup; no editing yet).
 * The ClearDay decks come from decks.js, which export_decks.py writes from the data folder.
 * Anyone can load their own decks instead (a deck pack, or plain deck files): up to 8 at
 * once, kept in this browser, and saved back to a deck pack file.
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
 * 5. Keys and clicks
 * 5a. keyName(event)
 * 5b. onKey(event)
 * 5c. onLookupKey(event)
 * 5d. onClick(event)
 * 6. Fitting inside another page (iframe height)
 * 7. Start
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
      (minor ? ' - <span class="minor">' + esc(minor) + "</span>" : "") + "</h1></header>";
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
    const labels = card.decks || [card.deck];
    let rows = '<dt class="holds">' + (labels.length > 1 ? "DECKS" : "DECK") + '</dt><dd class="holds">' +
      labels.map(function (label) { return '<span class="nowrap">' + esc(label) + "</span>"; }).join(", ") + "</dd>";
    fields.forEach(function (field) {
      const blank = hidden.indexOf(field) >= 0;
      rows += "<dt>" + names[field] + '</dt><dd class="' + (field === "acronym" ? "acronym " : "") +
        (blank ? "blank" : "") + '">' + (blank ? "" : esc(card[field])) + "</dd>";
    });
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
    bar += keyButton("ESC", "menu");
    html += '<div class="keys">' + bar + "</div>";

    show(html, keys);
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
    if (S.visited) showDeckMenu(S.visited);
    else if (S.origin === "menu") showDeckMenu(S.deck);
    else showHome();
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


  // 5. Keys and clicks
  // 5a. A key's name as the screens use it: enter, esc, +, 1, a, ...
  function keyName(event) {
    if (event.key === "Enter") return "enter";
    if (event.key === "Escape") return "esc";
    if (event.key === "=") return "+";                    // the + key, with or without SHIFT
    if (event.key.length === 1) return event.key.toLowerCase();
    return null;
  }

  // 5b. A key pressed anywhere on the page
  function onKey(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target && event.target.id === "mez-q") return;          // the lookup line handles its own keys
    const name = keyName(event);
    if (name === "enter" && event.target && event.target.tagName === "BUTTON") return;  // let the button click
    if (S.screen === "lookup" && S.result && name && name.length === 1 && !handlers[name] && /\S/.test(name)) {
      event.preventDefault();                                          // typing after a result starts a new lookup
      S.query = event.key;
      S.result = null;
      showLookup();
      return;
    }
    if (S.screen === "lookup" && event.key === "ArrowUp") {
      event.preventDefault();
      document.getElementById("mez-q").focus();
      return;
    }
    if (name && handlers[name]) {
      event.preventDefault();
      handlers[name]();
    }
  }

  // 5c. Keys on the lookup line: ENTER looks up; up / down / left / right move through Recents
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

  // 5d. A click or tap on a key, a choice, a recent, or a card
  function onClick(event) {
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


  // 6. Fitting inside another page: tell the page holding this one how tall it is
  function reportHeight() {
    if (window.parent === window) return;
    window.parent.postMessage({ mezmerize: "height", height: document.documentElement.scrollHeight }, "*");
  }


  // 7. Start: the set last in use (the user's own decks if this browser kept them), else ClearDay
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
  const mine = loadMine();
  useSet(loadUsing() === "mine" && mine ? mine : clearDaySet());
  if (DECKS.length) showHome();
  else showDecks('<p class="report">No ClearDay decks found (run  py export_decks.py  to make decks.js). ' +
    "Load a deck pack or deck files to begin.</p>");
})();
