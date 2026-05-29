# Flutter Recon

<p align="center">
  <img src="https://img.shields.io/badge/Chrome-Extension-blue?style=for-the-badge">
  <img src="https://img.shields.io/badge/Manifest-V3-green?style=for-the-badge">
  <img src="https://img.shields.io/badge/Flutter-Web%20Recon-54C5F8?style=for-the-badge">
</p>

A powerful Chrome extension for performing reconnaissance on Flutter Web applications.

Flutter Recon automatically detects Flutter-powered websites, scans publicly accessible resources, analyzes source maps, fingerprints third-party packages, and provides a detailed breakdown of the technologies used within a Flutter Web application.

Designed for developers, security researchers, bug bounty hunters, and learners who want deeper visibility into Flutter Web deployments.

---

## Features

### Flutter Web Detection

Detect Flutter applications using multiple indicators:

* `main.dart.js`
* `flutter.js`
* `flutter_bootstrap.js`
* `flutter_service_worker.js`
* CanvasKit artifacts
* Flutter DOM elements
* Flutter runtime signatures

The extension continuously monitors pages and confirms Flutter presence using multiple detection signals.

---

### Package Fingerprinting

Automatically identifies Flutter and Dart packages from publicly exposed assets.

Current fingerprint database includes detection for:

* Firebase
* Riverpod
* GetX
* Dio
* Hive
* Supabase
* Sentry
* OneSignal
* Bloc
* Provider
* Go Router
* Shared Preferences
* HTTP
* Cached Network Image
* Image Picker
* Google Fonts
* URL Launcher
* Intl
* Path Provider
* Lottie
* Animations
* Sqflite
* Connectivity Plus
* Permission Handler
* Flutter SVG
* Freezed
* Json Serializable
* RxDart
* Drift

Each package includes:

* Confidence score
* Detection signatures
* Source location
* Direct Pub.dev package link

---

### Source Map Analysis

Automatically discovers and analyzes:

```text
*.map
sourceMappingURL
main.dart.js.map
```

Capabilities:

* Extract Dart package references
* Identify Flutter dependencies
* Detect framework usage
* Recover publicly exposed metadata

---

### Asset Discovery

Scans Flutter resources including:

```text
AssetManifest.json
flutter_service_worker.js
main.dart.js
```

Extracts useful information from publicly accessible assets and build artifacts.

---

### Resource Enumeration

Collects and categorizes:

* JavaScript resources
* Source maps
* Flutter assets
* Service worker files
* Runtime resources

Useful for understanding Flutter application structure.

---

### Smart URL Filtering

To improve accuracy, Flutter Recon automatically ignores:

* Google Analytics
* Google Tag Manager
* DoubleClick
* Facebook tracking
* Twitter tracking
* Hotjar
* Segment
* Cookie consent frameworks
* Other unrelated third-party scripts

Only Flutter-relevant resources are scanned.

---

### Live Debug Console

Built-in debugging interface with categorized events:

| Event   | Description           |
| ------- | --------------------- |
| INIT    | Initialization        |
| FLUTTER | Flutter detection     |
| SCAN    | Resource scanning     |
| MAP     | Source map processing |
| ASSET   | Asset discovery       |
| PKG     | Package detection     |
| HOOK    | Runtime hooks         |
| SKIP    | Ignored resources     |
| ERR     | Errors                |
| INFO    | General information   |

Provides real-time visibility into extension activity.

---

### Confidence-Based Detection

Each detected package receives a confidence score based on:

* Number of matches
* Signature quality
* Detection source
* Multiple verification signals

This reduces false positives and improves accuracy.

---

### Browser Badge Integration

The extension badge updates automatically:

| Badge  | Meaning                                      |
| ------ | -------------------------------------------- |
| …      | Scanning in progress                         |
| Number | Packages detected                            |
| ✓      | Flutter detected with no additional packages |
| Empty  | Not a Flutter application                    |

---

### Desktop Notifications

Receive notifications when:

* Flutter Web is detected
* Package scanning begins
* Recon results become available

---

## Installation

### Clone Repository

```bash
git clone https://github.com/Sheth007/Flutter-Recon.git
```

### Load Extension

1. Open Chrome
2. Navigate to:

```text
chrome://extensions
```

3. Enable Developer Mode
4. Click **Load Unpacked**
5. Select the repository folder

The extension is now installed.

---

## Usage

1. Open any website.
2. Click the Flutter Recon icon.
3. Wait for scanning to complete.
4. Review:

   * Flutter status
   * Detected packages
   * Confidence scores
   * Asset information
   * Source map discoveries
   * Debug logs

---

## Architecture

```text
Flutter Recon
│
├── manifest.json
├── background.js
├── content.js
├── inject.js
│
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
│
├── assets/
│   └── AssetManifest.json
│
└── icons/
```

### Core Components

#### inject.js

Primary reconnaissance engine.

Responsible for:

* Flutter detection
* Resource collection
* Package fingerprinting
* Source map analysis
* Asset scanning

#### content.js

Bridge between webpage and extension.

Responsible for:

* Receiving scan results
* Storing data
* Updating popup state

#### background.js

Background service worker.

Responsible for:

* Notifications
* Badge management
* Tab handling
* Extension lifecycle events

#### popup.js

User interface logic.

Responsible for:

* Displaying results
* Rendering package cards
* Debug console
* Theme management

---

## Use Cases

### Developers

* Understand Flutter deployments
* Verify production builds
* Inspect package usage

### Security Researchers

* Analyze exposed resources
* Discover source maps
* Enumerate Flutter dependencies

### Bug Bounty Hunters

* Identify technology stack
* Discover information leakage
* Analyze client-side exposure

### Students

* Learn Flutter Web internals
* Explore build structures
* Study package ecosystems

---

## Limitations

Flutter Recon can only analyze resources that are publicly accessible from the browser.

It cannot:

* Access server-side code
* Bypass authentication
* Retrieve hidden resources
* Decompile protected backends

---

## Roadmap

Planned improvements:

* Flutter version detection
* State-management identification improvements
* Export results as JSON
* Scan history
* Package statistics
* Dark/Light theme enhancements
* Additional Flutter package fingerprints
* Advanced source map analysis

---

## Disclaimer

This project is intended for:

* Education
* Research
* Development
* Authorized security testing

Always obtain proper authorization before analyzing applications you do not own.

---

If you find Flutter Recon useful, consider giving the repository a ⭐.
