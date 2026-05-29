console.log("[Flutter Recon] Advanced Recon Started");

/*
|--------------------------------------------------------------------------
| STORAGE
|--------------------------------------------------------------------------
*/

const collectedResources = [];
const detections         = {};
const scannedUrls        = new Set();
let   isFlutterSite      = false;

/*
|--------------------------------------------------------------------------
| DEBUG LOG
|--------------------------------------------------------------------------
*/

const debugLog = [];

function dbg(tag, msg, extra) {
  const entry = { ts: Date.now(), tag, msg, extra: extra || null };
  debugLog.push(entry);
  if (debugLog.length > 500) debugLog.shift();
  broadcastData();
}

/*
|--------------------------------------------------------------------------
| URL ALLOW-LIST — only scan URLs that could plausibly be Flutter/Dart
|--------------------------------------------------------------------------
*/

const BLOCKED_URL_PATTERNS = [
  /googletagmanager\.com/,
  /google-analytics\.com/,
  /gstatic\.com/,
  /doubleclick\.net/,
  /facebook\.com/,
  /twitter\.com/,
  /analytics\./,
  /gtm\.js/,
  /cookie_consent/,
  /cookiebot/,
  /intercom\.io/,
  /hotjar\.com/,
  /segment\.com/,
  /sentry\.io\/api/,       // sentry reporting endpoint (not pkg)
  /cdn\.jsdelivr\.net\/npm\/(?!flutter)/,  // jsdelivr non-flutter
  /unpkg\.com\/(?!flutter)/,
  /ajax\.googleapis\.com/,
  /maps\.googleapis\.com/,
  /client\.js$/,           // generic analytics client scripts
  /recaptcha/,
  /cloudflare\.com\/ajax/,
];

// Must match at least one of these to be considered scannable
const FLUTTER_URL_HINTS = [
  /main\.dart\.js/,
  /flutter\.js/,
  /flutter_bootstrap\.js/,
  /flutter_service_worker\.js/,
  /canvaskit/,
  /\.dart\.js/,
  /\/assets\//,
  /pub\.dev/,
  /pub\.dartlang\.org/,
  /firebaseapp\.com/,
  /supabase\.co/,
];

function shouldScanUrl(url) {
  if (!url || typeof url !== "string") return false;

  // Always skip data URIs and blob URLs
  if (url.startsWith("data:") || url.startsWith("blob:")) return false;

  // Block known 3rd-party analytics/tag-manager scripts
  for (const pattern of BLOCKED_URL_PATTERNS) {
    if (pattern.test(url)) {
      dbg("SKIP", `Blocked 3rd-party URL: ${shorten(url)}`);
      return false;
    }
  }

  // Same-origin scripts are always scannable
  try {
    const u = new URL(url);
    if (u.origin === location.origin) return true;
  } catch (_) {
    return false;
  }

  // Cross-origin: only scan if it looks Flutter-related
  for (const hint of FLUTTER_URL_HINTS) {
    if (hint.test(url)) return true;
  }

  dbg("SKIP", `Non-Flutter cross-origin URL: ${shorten(url)}`);
  return false;
}

/*
|--------------------------------------------------------------------------
| FLUTTER CORE SIGNALS
|--------------------------------------------------------------------------
*/

const FLUTTER_CORE_SIGNALS = [
  "main.dart.js",
  "_flutter",
  "flutter.js",
  "flt-glass-pane",
  "canvaskit",
  "flutter_service_worker",
  "FlutterLoader",
  "flutter_bootstrap.js",
];

/*
|--------------------------------------------------------------------------
| PACKAGE FINGERPRINTS
|--------------------------------------------------------------------------
*/

const fingerprints = {
  firebase:     ["firebase", "firestore.googleapis.com", "firebaseapp.com"],
  get:          ["GetMaterialApp", "GetBuilder", "GetX", "get/get.dart"],
  riverpod:     ["ProviderScope", "riverpod", "flutter_riverpod"],
  dio:          ["DioMixin", "QueuedInterceptor", "package:dio"],
  hive:         ["HiveBox", "package:hive", "hive_flutter"],
  supabase:     ["supabase.co", "package:supabase"],
  sentry:       ["sentry.io", "package:sentry_flutter"],
  onesignal:    ["onesignal.com", "package:onesignal_flutter"],
  bloc:         ["package:flutter_bloc", "BlocProvider", "BlocBuilder"],
  provider:     ["package:provider", "ChangeNotifierProvider"],
  go_router:    ["package:go_router", "GoRouter", "GoRoute"],
  shared_prefs: ["shared_preferences", "package:shared_preferences"],
  http:         ["package:http", "http.get", "http.post"],
  cached_image: ["package:cached_network_image", "CachedNetworkImage"],
  image_picker: ["package:image_picker", "ImagePicker"],
  google_fonts: ["package:google_fonts", "GoogleFonts"],
  url_launcher: ["package:url_launcher", "launchUrl"],
  intl:         ["package:intl", "DateFormat", "NumberFormat"],
  path_provider:["package:path_provider", "getApplicationDocumentsDirectory"],
  lottie:       ["package:lottie", "Lottie.asset"],
  animations:   ["package:animations", "OpenContainer", "FadeScaleTransition"],
  sqflite:      ["package:sqflite", "openDatabase"],
  connectivity: ["package:connectivity_plus", "ConnectivityResult"],
  permission:   ["package:permission_handler", "Permission."],
  flutter_svg:  ["package:flutter_svg", "SvgPicture"],
  freezed:      ["package:freezed", "package:freezed_annotation"],
  json_serial:  ["package:json_serializable", "JsonSerializable"],
  rxdart:       ["package:rxdart", "BehaviorSubject", "PublishSubject"],
  drift:        ["package:drift", "DriftDatabase"],
  staggered:    ["package:flutter_staggered_grid_view", "StaggeredGrid"],
};

/*
|--------------------------------------------------------------------------
| DETECTION HELPERS
|--------------------------------------------------------------------------
*/

function addDetection(packageName, signature, sourceUrl, confidence = 50) {
  if (!detections[packageName]) {
    detections[packageName] = {
      package:    packageName,
      confidence: 0,
      matches:    [],
      pubUrl:     `https://pub.dev/packages/${packageName}`,
    };
  }
  detections[packageName].confidence = Math.min(
    100,
    detections[packageName].confidence + confidence
  );
  const alreadyHas = detections[packageName].matches.some(
    m => m.signature === signature && m.sourceUrl === sourceUrl
  );
  if (!alreadyHas) {
    detections[packageName].matches.push({ signature, sourceUrl, confidence });
  }
}

function checkFlutterCore(content, url) {
  const lower = content.toLowerCase();
  let hits = [];
  for (const sig of FLUTTER_CORE_SIGNALS) {
    if (lower.includes(sig.toLowerCase())) {
      hits.push(sig);
      if (!isFlutterSite) {
        isFlutterSite = true;
        dbg("FLUTTER", `Confirmed via "${sig}" in ${shorten(url)}`);
        broadcastData();
      }
      addDetection("flutter", sig, url, 30);
    }
  }
  if (hits.length === 0) {
    dbg("NOSIG", `No Flutter core signals in ${shorten(url)} (${fmtSize(content.length)})`);
  }
}

function detectFingerprints(content, url) {
  if (!content) return;
  const lower = content.toLowerCase();
  let found = 0;
  for (const [name, signatures] of Object.entries(fingerprints)) {
    for (const sig of signatures) {
      if (lower.includes(sig.toLowerCase())) {
        addDetection(name, sig, url, 25);
        dbg("PKG", `${name} — matched "${sig}"`, shorten(url));
        found++;
      }
    }
  }
  if (found === 0) {
    dbg("NOPKG", `No package fingerprints matched in ${shorten(url)}`);
  }
}

/*
|--------------------------------------------------------------------------
| SOURCE MAP PROCESSING
|--------------------------------------------------------------------------
*/

async function processSourceMap(mapUrl) {
  if (!shouldScanUrl(mapUrl)) return;

  dbg("MAP", `Fetching source map: ${shorten(mapUrl)}`);
  try {
    const mapResponse = await fetch(mapUrl);
    if (!mapResponse.ok) {
      dbg("ERR", `Source map fetch failed: HTTP ${mapResponse.status} — ${shorten(mapUrl)}`);
      return;
    }
    const mapText = await mapResponse.text();
    dbg("MAP", `Source map loaded (${fmtSize(mapText.length)}): ${shorten(mapUrl)}`);

    detectFingerprints(mapText, mapUrl);
    checkFlutterCore(mapText, mapUrl);

    collectedResources.push({ url: mapUrl, type: "sourcemap", preview: mapText.slice(0, 1500) });

    const dartPackages = mapText.match(/package:([a-zA-Z0-9_]+)/g);
    if (dartPackages) {
      const unique = [...new Set(dartPackages)];
      dbg("MAP", `Found ${unique.length} dart package refs in source map`);
      for (const match of unique) {
        const packageName = match.replace("package:", "");
        if (packageName === "flutter" || packageName === "dart") continue;
        addDetection(packageName, "SourceMap", mapUrl, 90);
        dbg("PKG", `dart package: ${packageName}`, "via source map");
      }
    } else {
      dbg("MAP", `No "package:xxx" refs found in source map — minified or obfuscated?`);
    }
  } catch (e) {
    dbg("ERR", `Source map error: ${e.message}`);
  }
}

/*
|--------------------------------------------------------------------------
| URL ANALYZER
|--------------------------------------------------------------------------
*/

async function analyzeUrl(url) {
  // Guard: skip URLs that aren't worth scanning
  if (!shouldScanUrl(url)) return;

  try {
    if (scannedUrls.has(url)) {
      dbg("SKIP", `Already scanned: ${shorten(url)}`);
      return;
    }
    scannedUrls.add(url);
    dbg("SCAN", `Fetching: ${shorten(url)}`);

    const response = await fetch(url);
    if (!response.ok) {
      dbg("ERR", `Fetch failed: HTTP ${response.status} — ${shorten(url)}`);
      return;
    }
    const text = await response.text();
    dbg("SCAN", `Loaded ${shorten(url)} (${fmtSize(text.length)})`);

    collectedResources.push({ url, type: "script", preview: text.slice(0, 1500) });

    checkFlutterCore(text, url);
    detectFingerprints(text, url);

    // Parse sourceMappingURL — validate it looks like a real file path
    const sourceMapMatch = text.match(/\/\/# sourceMappingURL=([^\s\r\n]+)/);
    if (sourceMapMatch) {
      const mapFile = sourceMapMatch[1].trim();
      // Skip if it looks like a data URI or encoded garbage (contains spaces or %)
      if (mapFile.startsWith("data:") || mapFile.includes("%20") || mapFile.length > 300) {
        dbg("SKIP", `sourceMappingURL looks invalid, skipping`);
      } else {
        try {
          const mapUrl = mapFile.startsWith("http") ? mapFile : new URL(mapFile, url).href;
          dbg("MAP", `Source map reference found → ${shorten(mapUrl)}`);
          await processSourceMap(mapUrl);
        } catch (_) {
          dbg("SKIP", `Could not resolve sourceMappingURL: ${mapFile.slice(0, 60)}`);
        }
      }
    } else {
      dbg("SCAN", `No sourceMappingURL found in ${shorten(url)}`);
    }
  } catch (e) {
    dbg("ERR", `analyzeUrl error: ${e.message} — ${shorten(url)}`);
  }
}

/*
|--------------------------------------------------------------------------
| ASSET MANIFEST
|--------------------------------------------------------------------------
*/

async function scanAssetManifest() {
  const manifestUrl = `${location.origin}/assets/AssetManifest.json`;
  dbg("ASSET", `Checking: ${manifestUrl}`);
  try {
    const response = await fetch(manifestUrl);
    if (!response.ok) {
      // Silently skip — most sites won't have this
      dbg("ASSET", `AssetManifest.json not found (HTTP ${response.status})`);
      return;
    }
    const text = await response.text();

    // Verify it's actually JSON before processing
    let parsed;
    try { parsed = JSON.parse(text); } catch (_) {
      dbg("ASSET", `AssetManifest.json is not valid JSON — skipping`);
      return;
    }

    dbg("ASSET", `AssetManifest.json loaded (${fmtSize(text.length)})`);
    collectedResources.push({ url: manifestUrl, type: "manifest", preview: text.slice(0, 1500) });

    if (!isFlutterSite) {
      isFlutterSite = true;
      dbg("FLUTTER", "Confirmed via AssetManifest.json");
    }
    addDetection("flutter", "AssetManifest.json", manifestUrl, 80);

    const packageMatches = text.match(/packages\/([a-zA-Z0-9_]+)/g);
    if (packageMatches) {
      const unique = [...new Set(packageMatches)];
      dbg("ASSET", `Found ${unique.length} package(s) in asset paths`);
      for (const match of unique) {
        const packageName = match.replace("packages/", "");
        addDetection(packageName, "AssetManifest", manifestUrl, 80);
        dbg("PKG", `asset package: ${packageName}`);
      }
    } else {
      dbg("ASSET", "No packages/ paths in AssetManifest — no asset-based packages");
    }
  } catch (e) {
    dbg("ERR", `AssetManifest error: ${e.message}`);
  }
}

/*
|--------------------------------------------------------------------------
| SCAN EXISTING SCRIPTS
|--------------------------------------------------------------------------
*/

async function scanExistingScripts() {
  const scripts = document.querySelectorAll("script[src]");
  dbg("INIT", `Found ${scripts.length} existing <script src> tags`);
  for (const script of scripts) {
    const url = script.src;
    if (!url) continue;
    if (url.includes(".js")) {
      await analyzeUrl(url);
    } else {
      dbg("SKIP", `Skipping non-JS script: ${shorten(url)}`);
    }
  }
}

/*
|--------------------------------------------------------------------------
| SCAN PAGE HTML
|--------------------------------------------------------------------------
*/

function scanPageSource() {
  const html = document.documentElement.outerHTML;
  dbg("INIT", `Scanning page HTML (${fmtSize(html.length)})`);
  checkFlutterCore(html, location.href);
  detectFingerprints(html, location.href);
}

/*
|--------------------------------------------------------------------------
| HOOKS — only trigger analyzeUrl if the URL passes the filter
|--------------------------------------------------------------------------
*/

const originalFetch = window.fetch;
window.fetch = async function (...args) {
  const response = await originalFetch.apply(this, args);
  try {
    const url = String(typeof args[0] === "string" ? args[0] : args[0]?.url || "");
    if (url && (url.includes(".js") || url.includes(".map")) && shouldScanUrl(url)) {
      analyzeUrl(url);
    }
  } catch (e) {}
  return response;
};

const originalAppendChild = Element.prototype.appendChild;
Element.prototype.appendChild = function (element) {
  try {
    if (element.tagName === "SCRIPT" && element.src && shouldScanUrl(element.src)) {
      dbg("HOOK", `Dynamic script injected: ${shorten(element.src)}`);
      analyzeUrl(element.src);
    }
  } catch (e) {}
  return originalAppendChild.call(this, element);
};

window.addEventListener("error", event => {
  try {
    const stack = event.error?.stack || "";
    checkFlutterCore(stack, "stacktrace");
  } catch (e) {}
});

/*
|--------------------------------------------------------------------------
| UTILS
|--------------------------------------------------------------------------
*/

function shorten(url) {
  if (!url) return "(unknown)";
  try {
    const u = new URL(url);
    return u.pathname.slice(-50) || u.href.slice(-50);
  } catch (_) {
    return String(url).slice(-50);
  }
}

function fmtSize(bytes) {
  if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + " MB";
  if (bytes > 1024)        return (bytes / 1024).toFixed(1) + " KB";
  return bytes + " B";
}

/*
|--------------------------------------------------------------------------
| BROADCAST
|--------------------------------------------------------------------------
*/

function broadcastData(scanComplete) {
  window.postMessage({
    source:  "flutter-recon",
    payload: {
      isFlutter:    isFlutterSite,
      detections,
      resources:    collectedResources,
      scannedCount: scannedUrls.size,
      scanComplete: !!scanComplete,
      debugLog:     debugLog.slice(-200),
    },
  }, "*");
}

/*
|--------------------------------------------------------------------------
| INIT
|--------------------------------------------------------------------------
*/

async function init() {
  dbg("INIT", `Page: ${location.href}`);
  dbg("INIT", `User agent: ${navigator.userAgent.slice(0, 80)}`);

  scanPageSource();
  await scanExistingScripts();
  await scanAssetManifest();

  dbg("INIT", `Scan complete — isFlutter=${isFlutterSite}, packages=${Object.keys(detections).length}`);
  broadcastData(true);
}

init();

// Periodic broadcast during dynamic loading (Flutter apps load scripts lazily)
const interval = setInterval(() => broadcastData(false), 2000);
setTimeout(() => {
  clearInterval(interval);
  broadcastData(true);
}, 30000);

window.__flutterRecon = {
  resources:     collectedResources,
  getDetections() { return detections; },
  isFlutter()     { return isFlutterSite; },
  debugLog()      { return debugLog; },
  dump()          { return { isFlutterSite, detections, resources: collectedResources, debugLog }; },
};

console.log("[Flutter Recon] Advanced Engine Ready");
