/*
|--------------------------------------------------------------------------
| THEME TOGGLE
|--------------------------------------------------------------------------
*/

const html = document.documentElement;

// Load saved theme or default to dark
const savedTheme = localStorage.getItem("flutterReconTheme") || "dark";
html.setAttribute("data-theme", savedTheme);

document.getElementById("theme-toggle").addEventListener("click", () => {
  const current = html.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  html.setAttribute("data-theme", next);
  localStorage.setItem("flutterReconTheme", next);
});

/*
|--------------------------------------------------------------------------
| TAB SWITCHING
|--------------------------------------------------------------------------
*/

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('tab--active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    btn.classList.add('tab--active');
    document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden');
  });
});

/*
|--------------------------------------------------------------------------
| RESULTS DOM REFS
|--------------------------------------------------------------------------
*/

const badge        = document.getElementById("flutter-badge");
const badgeText    = badge.querySelector(".badge-text");
const headerUrl    = document.getElementById("header-url");

const stateInitial = document.getElementById("state-initial");
const stateNotFlut = document.getElementById("state-not-flutter");
const stateLoading = document.getElementById("state-loading");
const stateResults = document.getElementById("state-results");

const resultsBanner    = document.getElementById("results-banner");
const packagesList     = document.getElementById("packages-list");
const resourcesList    = document.getElementById("resources-list");
const pkgCount         = document.getElementById("pkg-count");
const resCount         = document.getElementById("res-count");
const liveCountLoading = document.getElementById("live-count-loading");

/*
|--------------------------------------------------------------------------
| DEBUG DOM REFS
|--------------------------------------------------------------------------
*/

const dbgLog      = document.getElementById("dbg-log");
const dbgRaw      = document.getElementById("dbg-raw");
const dUrls       = document.getElementById("d-urls");
const dPkgs       = document.getElementById("d-pkgs");
const dRes        = document.getElementById("d-res");
const dDone       = document.getElementById("d-done");
const dbgFilter   = document.getElementById("dbg-filter");

document.getElementById("clear-log-btn").addEventListener("click", () => {
  dbgLog.innerHTML = '<div class="dbg-empty">Log cleared — reload the page to re-scan</div>';
});

document.getElementById("copy-raw-btn").addEventListener("click", () => {
  navigator.clipboard.writeText(dbgRaw.textContent).catch(() => {});
});

dbgFilter.addEventListener("change", () => {
  if (lastData) renderDebugLog(lastData.debugLog || []);
});

/*
|--------------------------------------------------------------------------
| OPEN LINKS VIA BACKGROUND (prevents popup from closing on link click)
|--------------------------------------------------------------------------
*/

// Intercept all clicks on pub.dev links — open via chrome.tabs.create
// so the popup doesn't close (a direct <a target="_blank"> closes the popup in MV3)
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[href]");
  if (!a) return;
  e.preventDefault();
  e.stopPropagation();
  chrome.tabs.create({ url: a.href, active: true });
});

/*
|--------------------------------------------------------------------------
| TAG CONFIG
|--------------------------------------------------------------------------
*/

const TAG_CONFIG = {
  INIT:    { cls: "dbg-tag-info",    label: "INIT"    },
  FLUTTER: { cls: "dbg-tag-detect",  label: "FLUTTER" },
  SCAN:    { cls: "dbg-tag-scan",    label: "SCAN"    },
  MAP:     { cls: "dbg-tag-map",     label: "MAP"     },
  ASSET:   { cls: "dbg-tag-asset",   label: "ASSET"   },
  PKG:     { cls: "dbg-tag-pkg",     label: "PKG"     },
  HOOK:    { cls: "dbg-tag-hook",    label: "HOOK"    },
  SKIP:    { cls: "dbg-tag-skip",    label: "SKIP"    },
  NOSIG:   { cls: "dbg-tag-nosig",   label: "NOSIG"   },
  NOPKG:   { cls: "dbg-tag-nosig",   label: "NOPKG"   },
  ERR:     { cls: "dbg-tag-err",     label: "ERR"     },
  INFO:    { cls: "dbg-tag-info",    label: "INFO"    },
};

function fmtTs(ms) {
  const d = new Date(ms);
  return d.toLocaleTimeString('en', { hour12: false });
}

/*
|--------------------------------------------------------------------------
| RENDER DEBUG LOG
|--------------------------------------------------------------------------
*/

function renderDebugLog(log) {
  if (!log || !log.length) {
    dbgLog.innerHTML = '<div class="dbg-empty">No events yet — open a website with the extension loaded</div>';
    return;
  }

  const filter = dbgFilter.value;
  const filtered = filter === "all" ? log : log.filter(e => e.tag === filter);

  if (!filtered.length) {
    dbgLog.innerHTML = `<div class="dbg-empty">No "${filter}" events yet</div>`;
    return;
  }

  const atBottom = dbgLog.scrollHeight - dbgLog.scrollTop - dbgLog.clientHeight < 40;

  dbgLog.innerHTML = filtered.map(e => {
    const cfg = TAG_CONFIG[e.tag] || TAG_CONFIG.INFO;
    const extra = e.extra ? `<span class="dbg-extra">${e.extra}</span>` : "";
    return `<div class="dbg-line">
      <span class="dbg-ts">${fmtTs(e.ts)}</span>
      <span class="dbg-tag ${cfg.cls}">${cfg.label}</span>
      <span class="dbg-msg">${e.msg}${extra}</span>
    </div>`;
  }).join("");

  if (atBottom) dbgLog.scrollTop = dbgLog.scrollHeight;
}

/*
|--------------------------------------------------------------------------
| RESULTS HELPERS
|--------------------------------------------------------------------------
*/

function showOnly(panel) {
  [stateInitial, stateNotFlut, stateLoading, stateResults].forEach(p =>
    p.classList.add("hidden")
  );
  panel.classList.remove("hidden");
}

function setBadge(type) {
  badge.className = `badge badge--${type}`;
  if (type === "flutter")          badgeText.textContent = "Flutter";
  else if (type === "not-flutter") badgeText.textContent = "Not Flutter";
  else                             badgeText.textContent = "Scanning";
}

function inferSource(matches) {
  if (!matches || !matches.length) return "fingerprint";
  const sigs = matches.map(m => (m.signature || "").toLowerCase());
  if (sigs.some(s => s === "sourcemap"))     return "sourcemap";
  if (sigs.some(s => s === "assetmanifest")) return "asset";
  return "fingerprint";
}

function sourceTagHTML(source) {
  const map = {
    sourcemap:   ["tag--sourcemap",   "Source Map"],
    asset:       ["tag--asset",       "Asset Manifest"],
    fingerprint: ["tag--fingerprint", "Fingerprint"],
    flutter:     ["tag--flutter",     "Core"],
  };
  const [cls, label] = map[source] || map.fingerprint;
  return `<span class="pkg-source-tag ${cls}">${label}</span>`;
}

function confClass(pct) {
  if (pct >= 75) return "conf-fill--high";
  if (pct >= 40) return "conf-fill--medium";
  return "conf-fill--low";
}

function buildPackageCard(name, info) {
  const pct = Math.min(100, info.confidence);
  const source = inferSource(info.matches);
  const uniqueSigs = [...new Set((info.matches || []).map(m => m.signature))].slice(0, 4);
  const sigsHTML = uniqueSigs.map(s =>
    `<span class="sig-chip" title="${s}">${s}</span>`
  ).join("");
  // Use data-href attribute — real click handled by the global delegated listener above
  const nameHTML = name === "flutter"
    ? `<span class="pkg-name">${name}</span>`
    : `<span class="pkg-name"><a href="${info.pubUrl}" data-href="${info.pubUrl}">${name}</a></span>`;
  return `
    <div class="pkg-card">
      <div class="pkg-card-top">${nameHTML}${sourceTagHTML(source)}</div>
      <div class="conf-row">
        <span class="conf-label">Confidence</span>
        <div class="conf-track">
          <div class="conf-fill ${confClass(pct)}" style="width:${pct}%"></div>
        </div>
        <span class="conf-pct">${pct}%</span>
      </div>
      ${sigsHTML ? `<div class="pkg-sigs">${sigsHTML}</div>` : ""}
    </div>`;
}

function buildResourceItem(res) {
  const type = res.type || "script";
  const shortUrl = res.url.replace(/^https?:\/\/[^/]+/, "").slice(0, 55);
  return `
    <div class="res-item">
      <span class="res-type res-type--${type}">${type}</span>
      <span class="res-url" title="${res.url}">${shortUrl || res.url}</span>
    </div>`;
}

/*
|--------------------------------------------------------------------------
| RENDER RESULTS — also renders partial results during scan
|--------------------------------------------------------------------------
*/

function renderResults(data, scanComplete) {
  const detections = data.detections || {};
  const resources  = data.resources  || [];

  packagesList.innerHTML = Object.entries(detections)
    .sort(([an, ai], [bn, bi]) => {
      if (an === "flutter") return -1;
      if (bn === "flutter") return  1;
      return bi.confidence - ai.confidence;
    })
    .map(([name, info]) => buildPackageCard(name, info))
    .join("");

  const totalPkgs = Object.keys(detections).length;
  pkgCount.textContent = totalPkgs;

  resourcesList.innerHTML = resources.slice(-8).reverse().map(buildResourceItem).join("");
  resCount.textContent = resources.length;

  resultsBanner.innerHTML =
    `Flutter Web detected${scanComplete ? "" : " — scanning…"} &nbsp;|&nbsp; ` +
    `${totalPkgs} package(s) found`;
}

/*
|--------------------------------------------------------------------------
| APPLY DATA
|--------------------------------------------------------------------------
*/

let lastData = null;

function applyData(data) {
  lastData = data;

  // Debug stats
  dUrls.textContent = data?.scannedCount ?? 0;
  dPkgs.textContent = Object.keys(data?.detections || {}).length;
  dRes.textContent  = (data?.resources || []).length;
  dDone.textContent = data?.scanComplete ? "yes" : "no";

  renderDebugLog(data?.debugLog || []);

  if (data) {
    const snap = {
      isFlutter:     data.isFlutter,
      scanComplete:  data.scanComplete,
      scannedCount:  data.scannedCount,
      packages:      Object.keys(data.detections || {}),
      resourceCount: (data.resources || []).length,
      lastResource:  (data.resources || []).slice(-1)[0]?.url || null,
      logCount:      (data.debugLog || []).length,
    };
    dbgRaw.textContent = JSON.stringify(snap, null, 2);
  }

  if (!data) {
    setBadge("scanning");
    showOnly(stateInitial);
    return;
  }

  if (data.isFlutter === false && data.scanComplete) {
    setBadge("not-flutter");
    showOnly(stateNotFlut);
    return;
  }

  if (data.isFlutter) {
    setBadge("flutter");
    const pkgCount = Object.keys(data.detections || {}).length;

    if (!data.scanComplete) {
      // Show live results in loading state
      if (pkgCount > 0) {
        liveCountLoading.textContent = `${pkgCount} found so far`;
        // Show partial results instead of skeleton when we have packages
        renderResults(data, false);
        showOnly(stateResults);
      } else {
        liveCountLoading.textContent = "Scanning…";
        showOnly(stateLoading);
      }
    } else {
      renderResults(data, true);
      showOnly(stateResults);
    }
    return;
  }

  if (!data.scanComplete) {
    setBadge("scanning");
    showOnly(stateInitial);
  } else {
    setBadge("not-flutter");
    showOnly(stateNotFlut);
  }
}

/*
|--------------------------------------------------------------------------
| INIT
|--------------------------------------------------------------------------
*/

chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
  if (tabs[0]?.url) {
    try { headerUrl.textContent = new URL(tabs[0].url).hostname; }
    catch (_) { headerUrl.textContent = tabs[0].url; }
  }
});

chrome.storage.local.get("flutterReconData", stored => {
  applyData(stored.flutterReconData || null);
});

chrome.storage.onChanged.addListener(changes => {
  if (changes.flutterReconData) {
    applyData(changes.flutterReconData.newValue);
  }
});
