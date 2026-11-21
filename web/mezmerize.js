/*
 * mezmerize.js: the web version of mezmerize (study and lookup; no editing yet).
 * The cards come from decks.js, which export_decks.py writes from the data folder.
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
 * 2. Recents
 * 2a. loadRecent()
 * 2b. saveRecent(acronym)
 * 3. Drawing helpers
 * 3a. esc(text)
 * 3b. banner(major, minor)
 * 3c. keyButton(key, words, main)
 * 3d. cardHtml(card, options)
 * 3e. show(html, keys)
 * 4. Screens
 * 4a. showHome()
 * 4b. showDeckMenu(label, note)
 * 4c. startStudy(label, mode)
 * 4d. showStudyCard()
 * 4e. startLookup(label, origin)
 * 4f. recentsHtml(), markRecents(), showLookup()
 * 4g. runLookup(query)
 * 4h. leaveLookup()
 * 4i. showFinder(card, from)
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

  const DECKS = ((window.MEZ_DECKS && window.MEZ_DECKS.decks) || []).map(function (deck) {
    return { label: deck.label, cards: deck.cards.map(function (card) {
      return Object.assign({}, card, { deck: deck.label });
    }) };
  });

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


  // 2. Recents (kept in this browser only)
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


  // 3. Drawing helpers
  // 3a. Make text safe to put inside HTML
  function esc(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
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

  // 3d. A card: DECK, ACRONYM, FULL NAME, DESCRIPTION. Hidden fields stay blank, one line each.
  function cardHtml(card, options) {
    options = options || {};
    const hidden = options.hidden || [];
    const fields = options.short ? ["acronym", "full_name"] : ["acronym", "full_name", "description"];
    const names = { acronym: "ACRONYM", full_name: "FULL NAME", description: "DESCRIPTION" };
    let rows = '<dt class="holds">DECK</dt><dd class="holds">' + esc(card.deck) + "</dd>";
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
        deck.cards.length + " cards</span></button></li>";
    });
    keys.a = function () { showDeckMenu(ALL); };
    keys.l = function () { startLookup(ALL, "home"); };
    rows += '<li><button type="button" class="choice" data-key="a"><span class="num">A</span>' +
      '<span class="what">All Built-in Decks</span><span class="count">' + cardsFor(ALL).length +
      " cards</span></button></li>";
    rows += '<li><button type="button" class="choice" data-key="l"><span class="num">L</span>' +
      '<span class="what">Look up an acronym in all decks</span></button></li>';

    show(banner("Study Mode", "Deck List") + "<h2>Which deck to study?</h2>" +
      '<ul class="menu">' + rows + "</ul>" +
      '<p class="foot">Cards are added and edited in the desktop version of mezmerize.' +
      (window.MEZ_DECKS && window.MEZ_DECKS.exported ? " Decks as of " + esc(window.MEZ_DECKS.exported) + "." : "") +
      "</p>", keys);
  }

  // 4b. One deck's menu: look up, review, or quiz
  function showDeckMenu(label, note) {
    S = { screen: "menu", deck: label };
    const cards = cardsFor(label);
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
      "<h2>Deck: " + (label === ALL ? "All Built-in Decks" : '<span class="holds">' + esc(label) + "</span>") + "</h2>" +
      '<p class="sub">' + cards.length + " flashcards</p>" +
      (note ? '<p class="note">' + esc(note) + "</p>" : "") +
      '<ul class="menu">' + rows + "</ul>" +
      '<div class="keys">' + keyButton("ESC", "choose a different deck") + "</div>", keys);
  }

  // 4c. Start reviewing or quizzing a deck
  function startStudy(label, mode) {
    const settings = STUDY_MODES[mode];
    let cards = cardsFor(label);
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


  // 7. Start
  document.addEventListener("keydown", onKey);
  app.addEventListener("click", onClick);
  app.addEventListener("submit", function (event) { event.preventDefault(); });
  if ("ResizeObserver" in window) new ResizeObserver(reportHeight).observe(document.documentElement);
  if (!DECKS.length) {
    show(banner("Mezmerize") + '<p class="note">No decks found. Run  py export_decks.py  to make decks.js.</p>');
  } else {
    showHome();
  }
})();
