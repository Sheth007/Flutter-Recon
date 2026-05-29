chrome.runtime.onInstalled.addListener(() => {
  console.log("[Flutter Recon] Installed");
  // Clear badge on install
  chrome.action.setBadgeText({ text: "" });
});

/*
|--------------------------------------------------------------------------
| BADGE HELPERS
|--------------------------------------------------------------------------
*/

function setBadge(tabId, text, color) {
  chrome.action.setBadgeText({ tabId, text: String(text) });
  chrome.action.setBadgeBackgroundColor({ tabId, color });
}

function clearBadge(tabId) {
  chrome.action.setBadgeText({ tabId, text: "" });
}

/*
|--------------------------------------------------------------------------
| MESSAGE HANDLER
|--------------------------------------------------------------------------
*/

chrome.runtime.onMessage.addListener((message, sender) => {
  const tabId = sender.tab?.id;

  // ── Flutter first detected → notification ──
  if (message.type === "FLUTTER_DETECTED") {
    const pkgs = message.pkgCount || 0;
    chrome.notifications.create({
      type:     "basic",
      iconUrl:  chrome.runtime.getURL("icons/icon48.png"),
      title:    "Flutter Web Detected 🐦",
      message:  pkgs > 0
        ? `Found ${pkgs} package${pkgs === 1 ? "" : "s"} on this Flutter site.`
        : "This site is built with Flutter Web. Scanning packages…",
      priority: 1,
    });
  }

  // ── Update icon badge on every data push ──
  if (message.type === "UPDATE_BADGE" && tabId) {
    if (!message.isFlutter) {
      // Not Flutter yet — clear or show nothing
      if (message.scanComplete) {
        clearBadge(tabId);
      }
      return;
    }

    const count = message.pkgCount || 0;

    if (!message.scanComplete) {
      // Scanning: show animated-style badge — pulsing "..." would need canvas;
      // instead show current count with a different color while scanning
      setBadge(tabId, count > 0 ? String(count) : "…", "#54C5F8");
    } else {
      // Done: green badge with package count
      if (count > 0) {
        setBadge(tabId, String(count), "#3FB950");
      } else {
        // Flutter confirmed but no packages beyond core
        setBadge(tabId, "✓", "#3FB950");
      }
    }
  }

  // ── Open a tab without closing the popup ──
  if (message.type === "OPEN_TAB") {
    chrome.tabs.create({ url: message.url, active: true });
  }
});

/*
|--------------------------------------------------------------------------
| CLEAR BADGE WHEN TAB NAVIGATES AWAY
|--------------------------------------------------------------------------
*/

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    clearBadge(tabId);
    // Also wipe stored data so the popup doesn't show stale results
    chrome.storage.local.remove("flutterReconData");
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  // Re-apply badge from storage when switching tabs
  chrome.storage.local.get("flutterReconData", (stored) => {
    const data = stored.flutterReconData;
    if (!data || !data.isFlutter) {
      clearBadge(tabId);
      return;
    }
    const pkgs = Math.max(0,
      Object.keys(data.detections || {}).length - (data.detections?.flutter ? 1 : 0)
    );
    if (data.scanComplete) {
      setBadge(tabId, pkgs > 0 ? String(pkgs) : "✓", "#3FB950");
    } else {
      setBadge(tabId, pkgs > 0 ? String(pkgs) : "…", "#54C5F8");
    }
  });
});
