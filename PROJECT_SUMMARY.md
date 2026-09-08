# PROJECT_SUMMARY: elysium-browser

> **Machine-Readable & Human-Readable Architecture & Codebase Summary**  
> Generated for AI context parsing, developer onboarding, and system analysis.

---

## 1. Metadata & Project Overview

- **Project Name:** elysium-browser (elysium-browser)
- **Version:** 1.5.0
- **Application Type:** Desktop Web Browser (Windows Portable)
- **Primary Runtime:** Electron 44.2.0 (Chromium engine)
- **Architectural Style:** Multi-process Electron app using WebContentsView (separated UI shell and external content)
- **License:** Apache-2.0 (Source code). Copyright © 2026 Heaven Technology Group Co., Ltd. and Heaven Technologies. Custom copyrighted assets for Character/Brand (CHERRY : BODY ZERO & CYRVOR)
- **Local Profile Location:** %APPDATA%/elysium-browser (Storage file: elysium-data.json, Schema v5; legacy Cherry profile auto-migrated on first launch)
- **Target OS:** Windows 10/11 (x64)

---

## 2. Core Technical Stack & Dependencies

`yaml
Runtime:
  Node.js: Built-in with Electron 44.2.0
  Framework: Electron 44.2.0
  UI Rendering: Vanilla JS / HTML5 / CSS3 (No heavy frontend framework like React/Vue)
Packaging & Build:
  Packager: electron-builder 26.15.3
  Packaging Target: Windows Portable (.exe) & Unpacked Directory
Testing & Quality:
  Syntax Checking: node --check
  Unit Tests: node:test (Node native test runner)
  E2E Testing: @playwright/test 1.63.0
  Image Processing: sharp 0.35.4 (DevDependency for icon/asset exports)
`

---

## 3. System Architecture & Process Model

`
+-------------------------------------------------------------------------+
|                              MAIN PROCESS                               |
|                            (src/main.js)                                |
|                                                                         |
|  - Window & LifeCycle Management (BrowserWindow)                        |
|  - WebContentsView Manager (Tabs, Split View, Memory Saver)             |
|  - Session Management (Default Partition: 'persist:cherry-web',         |
|                        Private Partition: in-memory)                    |
|  - Security & Credentials (safeStorage encryption for API keys/tokens)  |
|  - Native IPC Router & Event Dispatcher                                 |
|  - Windows Notifications (Calendar alerts, Reminders)                   |
|  - Custom User-Agent Injection: elysium-browser/<version>           |
+-------------------------------------------------------------------------+
                                    |
                    IPC via ContextBridge (src/preload.js)
            (Restricted API: window.elysium, no direct Node.js access)
                                    |
                                    v
+-------------------------------------------------------------------------+
|                            RENDERER PROCESS                             |
|                        (src/index.html & UI Scripts)                    |
|                                                                         |
|  - Shell & Chrome UI (Sidebar, Address Bar, Command Palette Ctrl+K)     |
|  - Local Store Sync & State Rendering (src/renderer.js, src/core.js)    |
|  - Calendar Management (src/calendar-ui.js, src/calendar.js)            |
|  - Theme Studio & Visual System (src/theme-studio.js, src/themes.js)     |
|  - Non-LLM Reader & Content Extractor (src/page-extraction.js)          |
|  - CSP Enforcement: connect-src 'none', object-src 'none'               |
+-------------------------------------------------------------------------+
                                    |
                    Renders web content safely via
                                    v
+-------------------------------------------------------------------------+
|                           WEBCONTENTSVIEWS                              |
|             (Isolated external websites, tabs, and sessions)            |
+-------------------------------------------------------------------------+
`

---

## 4. Key Functional Modules

### 4.1. Web Browsing & Navigation
- **Tabs & Workspaces:** Full tab lifecycle management (Open, Close, Reorder, Pin, Mute, Reopen closed tabs, Private mode). Tabs are categorized into configurable **Workspaces**.
  - **Split View:** Real split-screen rendering allowing two independent WebContentsView instances with adjustable ratio.
  - **Download Hub:** Real download lifecycle (destination, progress, pause/resume/cancel). Finished records in normal mode persist in elysium-data.json across restarts; private downloads are excluded.
- **Address Bar & Omnibox:** Supports quick search (Google, DuckDuckGo, Bing) and internal navigation schemas (elysium://home, elysium://calendar, elysium://themes, etc.).
- **Command Palette (Ctrl+K):** Fast fuzzy search across open tabs, history, bookmarks, and browser commands.
- **Memory Saver:** Detects idle tabs based on user inactivity threshold (default: 20 min) and suspends their WebContents to free RAM, with auto-resume on focus. Protects tabs with audio, pinned state, split-view, or pending downloads.

### 4.2. Local Productivity Suite (Offline-First)
- **Calendar (elysium://calendar):**
  - Stored locally in elysium-data.json.
  - Monthly views, category color coding, start/end date-times, multi-day support.
  - Native Windows Notifications trigger before events (configurable intervals).
- **Notes & Post-it:**
  - Fast offline note-taking with source URL tracking.
  - Post-it style boards (5 pastel colors) and pin support.
- **Web Clipper & Reader Mode:**
  - Heuristic text and article extractor without external AI/network dependencies.
  - Root selection scores article/main/content containers by text density and link density, skipping nav/sidebar/chrome blocks.
- **Auto-Update (src/updater.js):**
  - electron-updater against GitHub Releases (Heaven-Technology-Group-Co-Ltd/elysium-browser).
  - Manual check + opt-in 30s post-launch check from Settings; Setup builds install via quitAndInstall, Portable/dev fall back to the releases page.

### 4.3. AI Provider Integration (Privacy-First)
- **Supported Providers:**
  1. Local Ollama (http://127.0.0.1:11434)
  2. OpenAI-Compatible API (https://<host>/v1)
  3. OpenAI-Compatible with OAuth 2.0 (Authorization Code + PKCE)
- **Security Design:**
  - Explicit user consent required before sending selected text or page snippet.
  - Never scrapes or transmits passwords, form fields, cookies, or full session DOMs.
  - Secrets stored using Windows safeStorage (never in localStorage or plain files).

### 4.4. Theme Studio & Brand
- 24 Pre-configured themes (12 featuring original artwork from CYRVOR / CHERRY : BODY ZERO).
- Accent colors, dark/light contrast modes, reduced motion switches, and custom wallpaper importing.

---

## 5. Repository File Map & Navigation

`
elysium-browser/
├── package.json               # Manifest, script definitions, dependencies
├── README.md                  # Detailed Thai user & developer manual
├── TEST_REPORT.md             # Verification test runs & validation matrix
├── Start-Elysium.cmd           # Windows batch launcher script
│
├── src/                       # Core application source code
│   ├── main.js                # Electron main process (lifecycle, IPC, window management)
│   ├── preload.js             # ContextBridge IPC security layer
│   ├── index.html             # Main browser shell UI entry point
│   ├── renderer.js            # Main browser UI event handler & view updates
│   ├── core.js                # State management, data schemas, migrations, resolveAddress
│   ├── calendar.js            # Calendar event normalization & reminder math
│   ├── calendar-ui.js         # Calendar DOM interface & interaction logic
│   ├── themes.js              # Theme definitions & novel visual metadata
│   ├── theme-studio.js        # Theme Studio modal & selector interface
│   ├── providers.js           # AI & Weather API integration logic
│   ├── oauth.js               # OAuth PKCE flow & safe token exchange
│   ├── page-extraction.js     # DOM heuristics for Reader mode & Memory saver check
│   ├── window-drag.js         # Window dragging helper for frameless UI
│   ├── icons.js               # In-memory SVG icon library
│   └── *.css                  # Modular styling (styles, brand, calendar, novel-themes, etc.)
│
├── tests/                     # Test Suites
│   ├── core.test.js           # Schema migration, URL resolution, store unit tests
│   ├── calendar.test.js       # Calendar date calculation tests
│   ├── themes.test.js         # Theme verification tests
│   ├── browser.spec.js        # Playwright E2E browser automation tests
│   └── calendar.spec.js       # Playwright E2E calendar tests
│
├── scripts/                   # Tooling & Verification Scripts
│   ├── build-app-icon.js      # Multi-resolution ICO builder
│   ├── export-anime-assets.js # Asset extraction from artwork-source
│   ├── smoke-online.js        # Smoke test against live internet
│   └── test-native-lifecycle.js # Native lifecycle test without CDP interference
│
└── docs/                      # Architectural & asset documentation
    ├── APP_ICON.md
    ├── ARTWORK.md
    └── NOVEL_THEMES.md
`

---

## 6. Key Data Schemas (elysium-data.json)

The configuration and personal data file adheres to **Schema Version 5**:

`json
{
  "schemaVersion": 5,
  "bookmarks": [
    { "id": "uuid", "title": "string", "url": "https://...", "createdAt": 1700000000000 }
  ],
  "downloads": [
    { "id": "uuid", "filename": "file.zip", "url": "https://...", "path": "C:/...", "received": 1024, "total": 2048, "state": "completed", "createdAt": 1700000000000 }
  ],
  "history": [
    { "id": "uuid", "title": "string", "url": "https://...", "visitedAt": 1700000000000 }
  ],
  "workspaces": [
    { "id": "personal", "name": "Personal", "color": "#2f6bff" }
  ],
  "activeWorkspace": "personal",
  "calendarEvents": [
    {
      "id": "uuid",
      "title": "string",
      "start": "YYYY-MM-DDTHH:mm",
      "end": "YYYY-MM-DDTHH:mm",
      "allDay": false,
      "color": "blue",
      "reminder": "15m",
      "location": "string",
      "details": "string"
    }
  ],
  "notes": [],
  "postIts": [],
  "settings": {
    "searchEngine": "google",
    "restoreTabs": true,
    "compactSidebar": false,
    "memorySaver": false,
    "suspendMinutes": 20,
    "theme": {
      "variant": "midnight",
      "character": "cherry",
      "background": "city",
      "graphics": true,
      "motion": true,
      "glow": 45,
      "art": 100
    },
    "ai": { "provider": "none", "endpoint": "", "model": "" },
    "weather": { "provider": "none", "city": "" }
  }
}
`

---

## 7. Operational Guidelines for LLMs / AI Agents

When interacting with or editing this codebase:
1. **Preserve Native JavaScript:** The codebase does not use TypeScript, Babel, or Webpack/Vite bundlers. Write clean, vanilla CommonJS in Node/Main and ESM/native scripts in Renderer.
2. **Strict Security Model:**
   - Do NOT bypass src/preload.js or enable 
odeIntegration: true in BrowserWindow.
   - Never store unencrypted secrets in BrowserStore.data. Always use safeStorage in main.js.
   - Respect Content Security Policy in src/index.html.
3. **Data Schema Migration:**
   - If adding fields to BrowserStore, update defaults() in src/core.js and maintain backwards-compatibility checks for older schemas.
4. **Verification Commands:**
   - Syntax validation: 
pm run check
   - Unit tests: 
pm test
   - E2E tests: 
pm run test:e2e
