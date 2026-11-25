/*
 * launcher.js: Alt+M opens the mezmerize quick reference from any page that loads this file.
 * Add one line to a hub page (or the Joomla template, for every page):
 *   <script src="/mezmerize/launcher.js" defer></script>
 * The quick reference opens in its own pop-up window, which can be dragged anywhere, even
 * onto another screen. P in the pop-up docks it into a panel on this page; P in the panel
 * pops it back out, to the same place and size it had. It also opens where it was last
 * closed. Alt+M again, the ✕, or ESC in the quick reference closes it.
 *
 * 1. Settings, lastPlace()
 * 2. quickUrl(query, docked)
 * 3. openPopup(query, fresh)
 * 4. openPanel(query), closePanel()
 * 5. Messages from the quick reference
 * 6. Alt+M
 */
(function () {
  "use strict";

  // 1. Settings
  const script = document.currentScript;
  const BASE = new URL(".", script.src).href;              // the app's folder: wherever this file lives
  const ORIGIN = new URL(BASE).origin;
  const POPUP_NAME = "mezmerize-quick";                    // one pop-up, reused
  const WIDTH = 460, HEIGHT = 700;                         // the pop-up's size the first time
  const PLACE_KEY = "mezmerize.window";                    // where the pop-up last was (it saves this itself)
  let popup = null, panel = null;
  let dockedFrom = null;                                   // where the pop-up was when it went into the panel

  // Where the pop-up should open: where it was docked from, else where it last closed, else null
  function lastPlace() {
    let place = dockedFrom;
    if (!place) {
      try { place = JSON.parse(localStorage.getItem(PLACE_KEY) || "null"); } catch (e) { place = null; }
    }
    const ok = place && [place.x, place.y, place.w, place.h].every(Number.isFinite) &&
      place.w >= 300 && place.h >= 300 && place.w <= 4000 && place.h <= 4000;
    return ok ? place : null;
  }

  // 2. The quick reference's address
  function quickUrl(query, docked) {
    return BASE + "index.html?mode=quick&from=hub" + (docked ? "&docked=1" : "") +
      (query ? "&q=" + encodeURIComponent(query) : "");
  }

  // 3. The pop-up window: back where it was (docked from, or last closed), else near the right
  // edge of this window. An open one just comes to the front, unless it's coming out of the
  // panel (fresh = true, with the panel's lookup).
  function openPopup(query, fresh) {
    closePanel();
    if (popup && !popup.closed && !fresh) { popup.focus(); return; }
    const place = lastPlace();
    const width = place ? place.w : WIDTH, height = place ? place.h : HEIGHT;
    const left = place ? place.x : Math.max(0, window.screenX + window.outerWidth - WIDTH - 40);
    const top = place ? place.y : Math.max(0, window.screenY + 90);
    popup = window.open(quickUrl(query, false), POPUP_NAME,
      "popup=yes,width=" + width + ",height=" + height + ",left=" + left + ",top=" + top);
    if (popup) popup.focus();
    dockedFrom = null;
  }

  // 4. The panel: docked on the right of this page, over its content
  function openPanel(query) {
    closePanel();
    panel = document.createElement("div");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Mezmerize lookup");
    panel.style.cssText = "position:fixed;top:16px;right:16px;bottom:16px;width:" + WIDTH + "px;max-width:calc(100vw - 32px);" +
      "z-index:2147483000;background:#fff;border:1px solid #dde6f0;border-radius:14px;" +
      "box-shadow:0 18px 48px rgba(11,31,58,.28);overflow:hidden;display:flex;flex-direction:column";
    const frame = document.createElement("iframe");
    frame.src = quickUrl(query, true);
    frame.title = "Mezmerize lookup";
    frame.style.cssText = "border:0;width:100%;flex:1";
    panel.appendChild(frame);
    document.body.appendChild(panel);
    frame.addEventListener("load", function () { frame.focus(); });
  }

  function closePanel() {
    if (panel) { panel.remove(); panel = null; }
  }

  // 5. Messages from the quick reference: dock into the panel, pop back out, or close
  window.addEventListener("message", function (event) {
    if (event.origin !== ORIGIN || !event.data || typeof event.data.mezmerize !== "string") return;
    const what = event.data.mezmerize, query = event.data.query || "";
    if (what === "dock") {
      dockedFrom = event.data.place || null;               // pop out puts it back exactly there
      openPanel(query);
    }
    else if (what === "popout") openPopup(query, true);
    else if (what === "close") closePanel();
  });

  // 6. Alt+M: open the quick reference (or close the panel when it's showing)
  document.addEventListener("keydown", function (event) {
    if (!event.altKey || event.ctrlKey || event.metaKey || event.code !== "KeyM") return;
    event.preventDefault();
    if (panel) closePanel();
    else openPopup("", false);
  });
})();
