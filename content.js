// Inject the recon script into the page context
const script = document.createElement("script");
script.src = chrome.runtime.getURL("inject.js");
(document.head || document.documentElement).appendChild(script);

let flutterNotified = false;

/*
|--------------------------------------------------------------------------
| RECEIVE DATA FROM PAGE
|--------------------------------------------------------------------------
*/

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data.source !== "flutter-recon") return;

  const payload = event.data.payload;
  const pkgCount = Object.keys(payload.detections || {}).length;
  // Subtract 1 for the "flutter" core package — only show 3rd-party pkg count
  const thirdPartyCount = Math.max(0, pkgCount - (payload.detections?.flutter ? 1 : 0));

  // Fire notification once when Flutter is first confirmed
  if (payload.isFlutter && !flutterNotified) {
    flutterNotified = true;
    chrome.runtime.sendMessage({
      type: "FLUTTER_DETECTED",
      pkgCount: thirdPartyCount,
    });
  }

  // Always update badge (even without popup open)
  chrome.runtime.sendMessage({
    type: "UPDATE_BADGE",
    isFlutter: payload.isFlutter,
    pkgCount: thirdPartyCount,
    scanComplete: payload.scanComplete,
  });

  // Store data for popup
  chrome.storage.local.set({ flutterReconData: payload });
});
