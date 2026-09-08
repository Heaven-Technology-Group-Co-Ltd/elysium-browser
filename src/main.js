const { app, BrowserWindow, WebContentsView, ipcMain, session, Menu, dialog, shell, safeStorage, nativeImage, Notification } = require('electron');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { BrowserStore, resolveAddress, isWebURL, hostnameOf, rememberZoom, sanitizePrivacy, sanitizeChromeHosts, stockChromeUA, hintBrands, buildCompatShim, isChromeModeRequest, shouldAutoChromeMode, parseBookmarksHTML, INTERNAL_PAGES, SEARCH_ENGINES, POST_IT_COLORS, SCHEMA_VERSION, FINISHED_DOWNLOAD_STATES, filterExistingDownloads, sanitizeTheme, computeLayout } = require('./core');
const { checkProvider, requestAI, getWeather, providerURL } = require('./providers');
const { createOAuthAttempt, exchangeAuthorizationCode, oauthFingerprint, refreshAccessToken, safeStateEqual, validateOAuthConfig } = require('./oauth');
const { EXTRACT_PAGE, CAN_SUSPEND } = require('./page-extraction');
const { normalizeEvent, reminderAt, dueEvents } = require('./calendar');
const { get: getNovelTheme } = require('./themes');
const updater = require('./updater');

if (process.env.ELYSIUM_TEST_PROFILE) app.setPath('userData', process.env.ELYSIUM_TEST_PROFILE);
app.setName('elysium-browser');
// Accept-Language and formatting follow the OS locale like stock Chrome does.
try { app.commandLine.appendSwitch('lang', app.getLocale()); } catch { /* Keep the Electron default locale. */ }
if (process.platform === 'win32') app.setAppUserModelId('com.elysium.browser');
const UI_FILE = path.join(__dirname, 'index.html');
const UI_URL = pathToFileURL(UI_FILE).href;
const YOUTUBE_FULLSCREEN_CSS = `
html:fullscreen, html:-webkit-full-screen,
html:fullscreen body, html:-webkit-full-screen body {
  margin: 0 !important;
  overflow: hidden !important;
  background: #000 !important;
}
html:fullscreen body *, html:-webkit-full-screen body * {
  visibility: hidden !important;
}
html:fullscreen #movie_player, html:fullscreen #movie_player *,
html:-webkit-full-screen #movie_player, html:-webkit-full-screen #movie_player * {
  visibility: visible !important;
}
html:fullscreen #movie_player, html:-webkit-full-screen #movie_player {
  position: fixed !important;
  inset: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  min-width: 100vw !important;
  min-height: 100vh !important;
  max-width: none !important;
  max-height: none !important;
  margin: 0 !important;
  border-radius: 0 !important;
  background: #000 !important;
  transform: none !important;
  z-index: 2147483647 !important;
}
`;
const PAGE_TITLES = { home: 'New Tab', bookmarks: 'บุ๊กมาร์ก', history: 'ประวัติการเข้าชม', downloads: 'ดาวน์โหลด', settings: 'การตั้งค่า', workspaces: 'My Workspace', themes: 'Theme Studio', notes: 'Notes & Clip', memory: 'Memory Saver', calendar: 'Calendar · ปฏิทิน' };
const ELYSIUM_BROWSER_NAME = 'elysium-browser';
const elysiumUserAgent = () => `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36 elysium-browser/${app.getVersion()}`;
let win;
let store;
let browserSession;
let privateSession;
let tabs = [];
let activeId;
let downloads = [];
let lastDownloadPrune = 0;
let publishTimer;
let closing = false;
const grantedPermissions = new Set();
const ui = { panel: null, overlay: false, split: null, ratio: 0.5 };
const closedTabs = [];
let lastFind = '';
// Auto Chrome mode: hosts already tried this session + pending timers, so one
// stuck verification page enables the mode once instead of looping reloads.
const autoChromeTried = new Set();
const autoChromePending = new Set();
const AUTO_CHROME_DELAY_MS = Number(process.env.ELYSIUM_AUTO_CHROME_MS) || 9000;
let reader = null;
let aiPreview = null;
let aiResult = '';
let aiBusy = false;
let weather = null;
let memoryTimer;
let reminderTimer;
let lastLayout;
let providerStatus = '';
let oauthServer = null;
let cancelOAuth = null;
let htmlFullscreenTabId = null;
let htmlFullscreenLayoutTimer = null;
let htmlFullscreenTransitioning = false;
let htmlFullscreenOwnsWindow = false;
const htmlFullscreenCSSKeys = new Map();

function activeTab() { return tabs.find(tab => tab.id === activeId); }
function workspaceTabs() { return tabs.filter(tab => tab.workspaceId === store.data.activeWorkspace); }
// Drop persisted download records whose file was deleted/renamed outside the
// app so the list mirrors the filesystem. Live downloads are never pruned.
function pruneMissingDownloads() {
  const live = downloads.filter(d => d.item);
  const kept = filterExistingDownloads(downloads.filter(d => !d.item));
  if (live.length + kept.length === downloads.length) return;
  downloads = [...live, ...kept];
  store.data.downloads = kept.map(({ item, paused, canResume, ...record }) => record);
  store.save();
}
function snapshot() {
  if (store && Date.now() - lastDownloadPrune > 30000) { lastDownloadPrune = Date.now(); pruneMissingDownloads(); }
  const oauth = oauthSummary();
  const activeContents = activeTab()?.view?.webContents;
  const zoomLevel = activeContents && !activeContents.isDestroyed() ? activeContents.getZoomLevel() : 0;
  return {
    tabs: tabs.map(({ view, navigation, ...tab }) => ({
      ...tab,
      canGoBack: !!view && !view.webContents.isDestroyed() && view.webContents.navigationHistory.canGoBack(),
      canGoForward: !!view && !view.webContents.isDestroyed() && view.webContents.navigationHistory.canGoForward(),
    })),
    activeId,
    bookmarks: store.data.bookmarks,
    history: store.data.history,
    settings: store.data.settings,
    workspaces: store.data.workspaces, activeWorkspace: store.data.activeWorkspace,
    notes: store.data.notes, postIts: store.data.postIts, reminders: store.data.reminders, todos: store.data.todos, shortcuts: store.data.shortcuts,
    calendarEvents: store.data.calendarEvents,
    notificationsSupported: Notification.isSupported(),
    permissions: store.data.permissions, hasAIKey: !!store.data.secrets.aiKey, aiOAuth: oauth,
    ui: { ...ui, htmlFullscreen: !!htmlFullscreenTabId, bounds: lastLayout }, reader, aiPreview, aiResult, aiBusy, weather, providerStatus,
    customBackground: store.data.customBackground ? pathToFileURL(path.join(app.getPath('userData'), 'themes', store.data.customBackground)).href : '',
    downloads: downloads.map(({ item, lastSample, ...download }) => download),
    zoomLevel,
    browserName: ELYSIUM_BROWSER_NAME, version: app.getVersion(), runtime: process.versions.chrome,
    update: updater.status,
    storageError: store.writeError,
  };
}

function publish() {
  if (closing || publishTimer) return;
  publishTimer = setTimeout(() => {
    publishTimer = null;
    if (win && !win.isDestroyed()) win.webContents.send('elysium:state', snapshot());
  }, 20);
}

function sameBounds(a, b) {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

function placeView(view, visible, bounds) {
  if (visible && bounds && !sameBounds(view.getBounds(), bounds)) view.setBounds(bounds);
  if (view.getVisible() !== visible) view.setVisible(visible);
}

function layout() {
  if (!win || win.isDestroyed()) return;
  const [width, height] = win.getContentSize();
  lastLayout = computeLayout(width, height, { compact: store.data.settings.compactSidebar, panel: !!ui.panel, split: !!ui.split, ratio: ui.ratio });
  const fullscreenTab = tabs.find(tab => tab.id === htmlFullscreenTabId && tab.view && !tab.view.webContents.isDestroyed());
  if (fullscreenTab) {
    // Keep the guest at its existing bounds until the page receives its own
    // fullscreenchange event. Resizing earlier leaves YouTube's player in its
    // normal watch-page layout even though the window is already fullscreen.
    if (htmlFullscreenTransitioning) return;
    for (const tab of tabs) {
      if (!tab.view) continue;
      placeView(tab.view, tab === fullscreenTab, tab === fullscreenTab ? { x: 0, y: 0, width, height } : null);
    }
    return;
  }
  const visibleIds = ui.split || [activeId];
  for (const tab of tabs) {
    if (!tab.view) continue;
    const visible = !ui.overlay && visibleIds.includes(tab.id) && tab.workspaceId === store.data.activeWorkspace && !tab.error;
    placeView(tab.view, visible, ui.split?.[1] === tab.id ? lastLayout.right : lastLayout.left);
  }
}

function cancelHtmlFullscreenLayout() {
  clearTimeout(htmlFullscreenLayoutTimer);
  htmlFullscreenLayoutTimer = null;
  htmlFullscreenTransitioning = false;
}

function removeHtmlFullscreenCSS(contents) {
  if (!contents || contents.isDestroyed()) return;
  contents.executeJavaScript(`(() => {
    if (typeof window.__elysiumYoutubeFullscreenCleanup === 'function') window.__elysiumYoutubeFullscreenCleanup();
    delete window.__elysiumYoutubeFullscreenCleanup;
  })()`).catch(() => {});
  const key = htmlFullscreenCSSKeys.get(contents.id);
  htmlFullscreenCSSKeys.delete(contents.id);
  if (key) contents.removeInsertedCSS(key).catch(() => {});
}

function applyHtmlFullscreenCSS(contents) {
  let hostname;
  try { hostname = new URL(contents.getURL()).hostname; } catch { return; }
  if (hostname !== 'youtube.com' && !hostname.endsWith('.youtube.com')) return;
  removeHtmlFullscreenCSS(contents);
  contents.executeJavaScript(`(() => {
    const exitFromButton = event => {
      const button = event.target instanceof Element ? event.target.closest('.ytp-fullscreen-button') : null;
      if (!button || !document.fullscreenElement) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      document.exitFullscreen().catch(() => {});
    };
    document.addEventListener('click', exitFromButton, true);
    window.__elysiumYoutubeFullscreenCleanup = () => document.removeEventListener('click', exitFromButton, true);
  })()`).catch(() => {});
  contents.insertCSS(YOUTUBE_FULLSCREEN_CSS, { cssOrigin: 'user' }).then(key => {
    if (contents.isDestroyed() || htmlFullscreenTabId !== tabs.find(tab => tab.view?.webContents === contents)?.id) {
      if (!contents.isDestroyed()) contents.removeInsertedCSS(key).catch(() => {});
      return;
    }
    htmlFullscreenCSSKeys.set(contents.id, key);
  }).catch(() => {});
}

function scheduleHtmlFullscreenLayout(tabId) {
  cancelHtmlFullscreenLayout();
  htmlFullscreenTransitioning = true;
  htmlFullscreenLayoutTimer = setTimeout(() => {
    htmlFullscreenLayoutTimer = null;
    if (htmlFullscreenTabId !== tabId) return;
    // Guest views opt out of Electron's automatic host-window resize. This
    // gives sites time to finish their fullscreenchange handler before the
    // Windows window and the WebContentsView are resized.
    if (htmlFullscreenOwnsWindow && !win.isFullScreen()) win.setFullScreen(true);
    htmlFullscreenTransitioning = false;
    layout();
    publish();
  }, 120);
}

function exitHtmlFullscreen() {
  if (!htmlFullscreenTabId) return;
  const tab = tabs.find(item => item.id === htmlFullscreenTabId);
  htmlFullscreenTabId = null;
  cancelHtmlFullscreenLayout();
  const exitWindow = htmlFullscreenOwnsWindow;
  htmlFullscreenOwnsWindow = false;
  if (tab?.view && !tab.view.webContents.isDestroyed()) {
    removeHtmlFullscreenCSS(tab.view.webContents);
    tab.view.webContents.executeJavaScript('document.fullscreenElement ? document.exitFullscreen() : undefined').catch(() => {});
  }
  if (exitWindow && win.isFullScreen()) win.setFullScreen(false);
  layout();
  publish();
}

function saveTabs() {
  store.data.savedTabs = tabs.filter(tab => !tab.private && isWebURL(tab.url)).map(tab => tab.url).slice(0, 30);
  store.data.sessionTabs = tabs.filter(tab => !tab.private).map(tab => ({ id: tab.id, url: tab.url, title: tab.title, workspaceId: tab.workspaceId, pinned: tab.pinned, autoSuspend: tab.autoSuspend })).slice(0, 200);
  store.save();
}

function focusAddress() {
  exitHtmlFullscreen();
  win.webContents.focus();
  win.webContents.send('elysium:focus-address');
}

function notifyToast(message) {
  if (win && !win.isDestroyed() && typeof message === 'string' && message) win.webContents.send('elysium:toast', message);
}

// When a bot-verification interstitial is still showing after a grace period,
// enable Chrome mode for that host automatically and reload once — the manual
// equivalent users otherwise discover only after reporting "this site won't open".
function maybeAutoChrome(tab) {
  if (!tab || closing || !store) return;
  const host = shouldAutoChromeMode({ title: tab.title, url: tab.url, chromeHosts: store.data.settings.chromeHosts });
  if (!host || autoChromeTried.has(host) || autoChromePending.has(host)) return;
  autoChromePending.add(host);
  const tabId = tab.id;
  const seenUrl = tab.url;
  setTimeout(() => {
    autoChromePending.delete(host);
    const current = tabs.find(t => t.id === tabId);
    if (!current || closing || !win || win.isDestroyed()) return;
    if (current.url !== seenUrl) return;
    const again = shouldAutoChromeMode({ title: current.title, url: current.url, chromeHosts: store.data.settings.chromeHosts });
    if (!again || autoChromeTried.has(again)) return;
    autoChromeTried.add(again);
    store.data.settings.chromeHosts = sanitizeChromeHosts([...store.data.settings.chromeHosts, again]);
    store.save();
    publish();
    notifyToast(`เปิดโหมด Chrome ให้ ${again} อัตโนมัติแล้ว กำลังโหลดใหม่`);
    if (current.view && !current.view.webContents.isDestroyed()) current.view.webContents.reload();
  }, AUTO_CHROME_DELAY_MS);
}

// Active website tab for find-in-page and zoom commands. Internal elysium://
// pages render inside the shell, so page search targets guest views only.
function findTarget() {
  const tab = activeTab();
  const contents = tab?.view?.webContents;
  if (!tab || !contents || contents.isDestroyed() || !isWebURL(tab.url)) throw new Error('ใช้ได้บนหน้าเว็บไซต์เท่านั้น');
  return contents;
}

function attachShortcuts(contents) {
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const key = input.key.toLowerCase();
    const ctrl = input.control || input.meta;
    let handled = true;
    if (ctrl && key === 'l') focusAddress();
    else if (ctrl && key === 't' && input.shift) reopenTab();
    else if (ctrl && key === 't') { createTab(); focusAddress(); }
    else if (ctrl && key === 'k') { exitHtmlFullscreen(); ui.overlay = true; layout(); publish(); win.webContents.focus(); win.webContents.send('elysium:palette'); }
    else if (ctrl && key === 'w') closeTab(activeId);
    else if (ctrl && key === 'tab') {
      const currentTabs = workspaceTabs();
      const index = currentTabs.findIndex(tab => tab.id === activeId);
      activate(currentTabs[(index + (input.shift ? -1 : 1) + currentTabs.length) % currentTabs.length].id);
    } else if (ctrl && /^[1-9]$/.test(key)) {
      const currentTabs = workspaceTabs();
      const tab = key === '9' ? currentTabs.at(-1) : currentTabs[Number(key) - 1];
      if (tab) activate(tab.id);
    } else if ((ctrl && key === 'r') || key === 'f5') reload(input.shift);
    else if (input.alt && key === 'arrowleft') go('back');
    else if (input.alt && key === 'arrowright') go('forward');
    else if (ctrl && key === 'd') bookmark();
    else if (ctrl && key === 'f') { win.webContents.send('elysium:find-open'); }
    else if (ctrl && key === 'h') openInternal('history');
    else if (ctrl && key === 'j') openInternal('downloads');
    else if (ctrl && ['+', '=', '-', '0'].includes(key)) {
      const contents = activeTab()?.view?.webContents;
      if (contents && !contents.isDestroyed()) {
        const level = key === '0' ? 0 : Math.max(-5, Math.min(5, contents.getZoomLevel() + (key === '-' ? -0.5 : 0.5)));
        contents.setZoomLevel(level);
        // Remember per-site zoom like popular browsers; 100% removes the override.
        store.data.zoomLevels = rememberZoom(store.data.zoomLevels, hostnameOf(activeTab().url), level);
        store.save();
        publish();
      }
    } else if (key === 'f' && !ctrl && !input.alt && htmlFullscreenTabId && activeTab()?.view?.webContents === contents) exitHtmlFullscreen();
    else if (key === 'f11' && htmlFullscreenTabId) exitHtmlFullscreen();
    else if (key === 'f11') win.setFullScreen(!win.isFullScreen());
    else if (key === 'escape' && activeTab()?.loading) activeTab().view.webContents.stop();
    else handled = false;
    if (handled) event.preventDefault();
    else if ((!ctrl && input.key.length === 1) || (ctrl && key === 'v')) {
      const tab = tabs.find(tab => tab.view?.webContents === contents);
      if (tab) tab.edited = true;
    }
  });
}

function createView(tab) {
  const view = new WebContentsView({ webPreferences: {
    session: tab.private ? privateSession : browserSession,
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    navigateOnDragDrop: false,
    spellcheck: true,
    disableHtmlFullscreenWindowResize: true,
  } });
  tab.view = view;
  const wc = view.webContents;
  wc.setAudioMuted(tab.muted);
  view.setBackgroundColor('#ffffff');
  win.contentView.addChildView(view);
  attachShortcuts(wc);
  wc.setWindowOpenHandler(({ url }) => {
    if (isWebURL(url)) createTab(url, { workspaceId: tab.workspaceId, private: tab.private });
    return { action: 'deny' };
  });
  const guard = (event, url) => { if (!isWebURL(url)) event.preventDefault(); };
  wc.on('will-navigate', guard);
  wc.on('will-redirect', guard);
  wc.on('focus', () => { if (ui.split?.includes(tab.id) && activeId !== tab.id) { activeId = tab.id; publish(); } });
  // Electron 44 carries audible on the event itself, with no second argument.
  wc.on('audio-state-changed', event => {
    if (tab.view?.webContents !== wc) return;
    tab.audible = event.audible; publish();
  });
  wc.on('enter-html-full-screen', () => {
    if (tab.view?.webContents !== wc || !tabs.includes(tab)) return;
    htmlFullscreenTabId = tab.id;
    htmlFullscreenOwnsWindow = !win.isFullScreen();
    ui.overlay = false;
    applyHtmlFullscreenCSS(wc);
    publish();
    scheduleHtmlFullscreenLayout(tab.id);
  });
  wc.on('leave-html-full-screen', () => {
    if (htmlFullscreenTabId !== tab.id) return;
    htmlFullscreenTabId = null;
    cancelHtmlFullscreenLayout();
    removeHtmlFullscreenCSS(wc);
    const exitWindow = htmlFullscreenOwnsWindow;
    htmlFullscreenOwnsWindow = false;
    if (exitWindow && win.isFullScreen()) win.setFullScreen(false);
    publish();
    setImmediate(() => {
      if (htmlFullscreenTabId) return;
      layout();
      publish();
    });
  });
  wc.on('page-favicon-updated', async (_event, urls) => {
    const url = urls.find(isWebURL);
    if (!url) return;
    try {
      // Fetch in the owning session, never include page credentials in the shell.
      const response = await (tab.private ? privateSession : browserSession).fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(5000) });
      if (!response.ok || Number(response.headers.get('content-length') || 0) > 100000) return;
      const reader = response.body.getReader(); const chunks = []; let size = 0;
      while (true) { const next = await reader.read(); if (next.done) break; size += next.value.length; if (size > 100000) { await reader.cancel(); return; } chunks.push(Buffer.from(next.value)); }
      const icon = nativeImage.createFromBuffer(Buffer.concat(chunks));
      if (!icon.isEmpty() && tabs.includes(tab)) { tab.favicon = icon.resize({ width: 24, height: 24 }).toDataURL(); publish(); }
    } catch { /* Initial fallback stays visible when a favicon cannot load. */ }
  });
  wc.on('did-start-loading', () => { tab.loading = true; publish(); });
  wc.on('did-stop-loading', () => { tab.loading = false; publish(); });
  // Per-site Chrome mode, JS half: page scripts read navigator.* directly, so
  // opted-in hosts get a stock Chrome identity here too (headers alone did not
  // release Cloudflare challenges). Runs at dom-ready, before async bot scripts
  // typically sample the fingerprint, and never touches non-opted hosts.
  // Subframes (Turnstile/challenge iframes sample too) get the same treatment.
  const applyCompatShim = frame => {
    if (!isWebURL(tab.url)) return;
    const host = hostnameOf(tab.url);
    if (!host || !store.data.settings.chromeHosts.includes(host)) return;
    frame.executeJavaScript(buildCompatShim({ userAgent: stockChromeUA(process.versions.chrome), chromeVersion: process.versions.chrome })).catch(() => {});
  };
  wc.on('dom-ready', () => {
    if (tab.view?.webContents !== wc || wc.isDestroyed()) return;
    applyCompatShim(wc.mainFrame);
  });
  wc.on('frame-created', (_event, { frame }) => {
    frame.once('dom-ready', () => {
      if (tab.view?.webContents !== wc || wc.isDestroyed() || frame.isDestroyed()) return;
      applyCompatShim(frame);
    });
  });
  wc.on('found-in-page', (_event, result) => {
    if (tab.id === activeId && win && !win.isDestroyed()) win.webContents.send('elysium:found-in-page', { matches: result.matches, activeMatchOrdinal: result.activeMatchOrdinal, finalUpdate: result.finalUpdate });
  });
  wc.on('did-start-navigation', (_event, url, _inPlace, mainFrame) => {
    if (mainFrame && isWebURL(url)) { tab.url = url; tab.error = null; layout(); publish(); }
  });
  wc.on('did-navigate', (_event, url) => { tab.url = url; tab.error = null; saveTabs(); publish(); });
  wc.on('did-navigate-in-page', (_event, url, mainFrame) => {
    if (mainFrame && isWebURL(url)) {
      tab.url = url;
      if (!tab.private) store.visit(url, wc.getTitle());
      saveTabs();
      publish();
    }
  });
  wc.on('page-title-updated', (_event, title) => {
    tab.title = title.slice(0, 300) || tab.url;
    const latest = store.data.history[0];
    if (!tab.private && latest?.url === tab.url) { latest.title = tab.title; store.save(); }
    publish();
    maybeAutoChrome(tab);
  });
  wc.on('did-finish-load', () => {
    // Chromium also emits this event after rendering its network error document.
    if (tab.error) { tab.loading = false; publish(); return; }
    tab.title = wc.getTitle().slice(0, 300) || tab.url;
    tab.error = null;
    // Re-apply the remembered per-site zoom for full navigations.
    const savedZoom = (store.data.zoomLevels[hostnameOf(tab.url)] ?? 0);
    if (savedZoom && wc.getZoomLevel() !== savedZoom) wc.setZoomLevel(savedZoom);
    if (!tab.private) store.visit(tab.url, tab.title);
    layout();
    publish();
    maybeAutoChrome(tab);
  });
  wc.on('did-fail-load', (_event, code, description, url, mainFrame) => {
    if (!mainFrame || code === -3) return;
    tab.loading = false;
    tab.error = { code, description, url };
    layout();
    publish();
  });
  wc.on('render-process-gone', () => {
    tab.error = { description: 'หน้านี้หยุดทำงาน กรุณาโหลดอีกครั้ง', url: tab.url };
    tab.loading = false;
    layout();
    publish();
  });
  wc.on('context-menu', (_event, params) => {
    const template = [];
    if (isWebURL(params.linkURL)) template.push({ label: 'เปิดลิงก์ในแท็บใหม่', click: () => createTab(params.linkURL, { workspaceId: tab.workspaceId, private: tab.private }) }, { type: 'separator' });
    if (params.isEditable) template.push({ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' });
    else if (params.selectionText) template.push({ role: 'copy' });
    else template.push({ label: 'ย้อนกลับ', enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() }, { label: 'ไปข้างหน้า', enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() }, { label: 'โหลดอีกครั้ง', click: () => wc.reload() });
    Menu.buildFromTemplate(template).popup({ window: win });
  });
  return view;
}

function load(tab, url) {
  tab.suspended = false;
  tab.edited = false;
  tab.error = null;
  tab.url = url;
  if (url.startsWith('elysium://')) {
    if (htmlFullscreenTabId === tab.id) exitHtmlFullscreen();
    if (ui.split?.includes(tab.id)) ui.split = null;
    if (tab.view) {
      win.contentView.removeChildView(tab.view);
      tab.view.webContents.close();
      tab.view = null;
    }
    tab.title = PAGE_TITLES[url.slice('elysium://'.length)] || PAGE_TITLES.home;
    tab.audible = false;
    tab.loading = false;
  } else {
    if (!tab.view) createView(tab);
    tab.loading = true;
    tab.view.webContents.loadURL(url).catch(error => {
      if (closing || tab.url !== url || error.errno === -3 || error.code === 'ERR_ABORTED') return;
      tab.error = tab.error || { description: error.code || 'ไม่สามารถเปิดเว็บไซต์ได้', url };
      tab.loading = false;
      layout();
      publish();
    });
  }
  saveTabs();
  layout();
  publish();
}

function createTab(url = 'elysium://home', options = {}) {
  const tab = { id: options.id || randomUUID(), url, title: options.title || 'New Tab', workspaceId: options.workspaceId || store.data.activeWorkspace, private: options.private ?? activeTab()?.private ?? false, pinned: !!options.pinned, muted: false, audible: false, autoSuspend: !!options.autoSuspend, suspended: false, lastActive: Date.now(), edited: false, loading: false, error: null, view: null, favicon: '' };
  tabs.push(tab);
  activeId = tab.id;
  load(tab, url);
  activate(tab.id);
  return tab;
}

function activate(id) {
  const tab = tabs.find(item => item.id === id);
  if (!tab) return;
  if (htmlFullscreenTabId && htmlFullscreenTabId !== id) exitHtmlFullscreen();
  activeId = id;
  store.data.activeWorkspace = tab.workspaceId;
  if (ui.split && !ui.split.includes(id)) ui.split = null;
  tab.lastActive = Date.now();
  if (tab.suspended) load(tab, tab.url);
  layout();
  if (tab.view && !tab.error) tab.view.webContents.focus();
  else win.webContents.focus();
  publish();
}

function closeTab(id) {
  const index = tabs.findIndex(tab => tab.id === id);
  if (index < 0) return;
  const [tab] = tabs.splice(index, 1);
  if (htmlFullscreenTabId === id) {
    const exitWindow = htmlFullscreenOwnsWindow;
    htmlFullscreenTabId = null;
    htmlFullscreenOwnsWindow = false;
    cancelHtmlFullscreenLayout();
    if (exitWindow && win.isFullScreen()) win.setFullScreen(false);
  }
  if (tab.view) removeHtmlFullscreenCSS(tab.view.webContents);
  if (ui.split?.includes(id)) ui.split = null;
  if (!tab.private) { const { view, navigation, ...entry } = tab; closedTabs.unshift(entry); closedTabs.splice(30); }
  if (tab.view) { win.contentView.removeChildView(tab.view); tab.view.webContents.close(); }
  if (!workspaceTabs().length) createTab('elysium://home', { private: false });
  else if (id === activeId) activate(workspaceTabs().at(-1).id);
  if (tab.private && !tabs.some(t => t.private)) {
    const previousSession = privateSession;
    privateSession = session.fromPartition(`cherry-private-${randomUUID()}`);
    configureSession(privateSession, true);
    previousSession.clearStorageData().catch(() => {});
    previousSession.clearCache().catch(() => {});
    for (const entry of grantedPermissions) if (entry.startsWith('private:')) grantedPermissions.delete(entry);
  }
  saveTabs();
  layout();
  publish();
}

function openInternal(page) {
  if (!INTERNAL_PAGES.includes(page)) return;
  const existing = workspaceTabs().find(tab => tab.url === `elysium://${page}` && tab.private === !!activeTab()?.private);
  if (existing) activate(existing.id);
  else createTab(`elysium://${page}`);
}

function go(direction) {
  const history = activeTab()?.view?.webContents.navigationHistory;
  if (direction === 'back' && history?.canGoBack()) history.goBack();
  if (direction === 'forward' && history?.canGoForward()) history.goForward();
}

function reload(ignoreCache = false) {
  const tab = activeTab();
  if (!tab?.view) return;
  tab.error = null;
  layout();
  if (ignoreCache) tab.view.webContents.reloadIgnoringCache();
  else tab.view.webContents.reload();
  publish();
}

function bookmark() {
  const tab = activeTab();
  if (!tab || !isWebURL(tab.url)) return;
  store.toggleBookmark(tab.url, tab.title);
  publish();
}

function trusted(event) {
  return win && event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame && event.senderFrame.url === UI_URL;
}

function reopenTab() {
  const previous = closedTabs.shift();
  if (previous) createTab(previous.url, { ...previous, id: undefined, private: false });
}

function apiKey() {
  if (!store.data.secrets.aiKey) return '';
  if (!safeStorage.isEncryptionAvailable()) throw new Error('ระบบจัดเก็บ credential ของ Windows ไม่พร้อม');
  return safeStorage.decryptString(Buffer.from(store.data.secrets.aiKey, 'base64'));
}

function readOAuthToken() {
  if (!store.data.secrets.aiOAuth) return null;
  if (!safeStorage.isEncryptionAvailable()) throw new Error('ระบบจัดเก็บ credential ของ Windows ไม่พร้อม');
  try { return JSON.parse(safeStorage.decryptString(Buffer.from(store.data.secrets.aiOAuth, 'base64'))); }
  catch { throw new Error('อ่าน OAuth session ไม่สำเร็จ กรุณาเชื่อมบัญชีใหม่'); }
}

function saveOAuthToken(token, config = store.data.settings.ai) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows credential encryption ไม่พร้อม จึงไม่ได้เก็บ OAuth token');
  const protectedToken = { ...token, fingerprint: oauthFingerprint(config) };
  store.data.secrets.aiOAuth = safeStorage.encryptString(JSON.stringify(protectedToken)).toString('base64');
  store.save();
}

function oauthSummary() {
  if (store?.data.settings.ai.provider !== 'oauth-openai-compatible' || !store.data.secrets.aiOAuth) return { connected: false, expiresAt: 0 };
  try {
    const token = readOAuthToken();
    return token?.accessToken && token.fingerprint === oauthFingerprint(store.data.settings.ai)
      ? { connected: true, expiresAt: Number(token.expiresAt) || 0 }
      : { connected: false, expiresAt: 0 };
  } catch { return { connected: false, expiresAt: 0 }; }
}

async function aiCredential(config = store.data.settings.ai) {
  if (config.provider !== 'oauth-openai-compatible') return apiKey();
  let token = readOAuthToken();
  if (!token?.accessToken || token.fingerprint !== oauthFingerprint(config)) throw new Error('กรุณาเชื่อมบัญชี OAuth ก่อนใช้ AI');
  if (!token.expiresAt || token.expiresAt > Date.now() + 60000) return token.accessToken;
  providerStatus = 'กำลังต่ออายุ OAuth session…'; publish();
  token = await refreshAccessToken(config, token.refreshToken);
  saveOAuthToken(token, config);
  providerStatus = 'เชื่อมบัญชี OAuth แล้ว'; publish();
  return token.accessToken;
}

function oauthPage(success, message) {
  const title = success ? 'เชื่อมบัญชีสำเร็จ' : 'เชื่อมบัญชีไม่สำเร็จ';
  const color = success ? '#71e3bd' : '#ff8b9b';
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>${title}</title><style>body{margin:0;background:#071122;color:#e6edff;font:16px/1.7 system-ui;display:grid;place-items:center;min-height:100vh}.card{max-width:520px;margin:24px;padding:36px;border:1px solid #5477aa;border-radius:18px;background:#101e35;box-shadow:0 22px 70px #0008}h1{color:${color};font-size:25px}p{color:#b8c8e5}</style></head><body><main class="card"><h1>${title}</h1><p>${message}</p><p>ปิดแท็บนี้แล้วกลับไปที่ elysium-browser ได้เลย</p></main></body></html>`;
}

async function startOAuthLogin() {
  const config = { ...store.data.settings.ai };
  validateOAuthConfig(config);
  providerURL(config.endpoint, '');
  if (!config.model) throw new Error('กรุณาใส่ model ก่อนเชื่อมบัญชี');
  if (oauthServer) throw new Error('กำลังเชื่อม OAuth อยู่แล้ว กรุณาทำรายการในเบราว์เซอร์ให้เสร็จ');

  const server = http.createServer();
  oauthServer = server;
  try {
    await new Promise((resolve, reject) => {
      const onError = error => { server.off('listening', onListen); reject(error); };
      const onListen = () => { server.off('error', onError); resolve(); };
      server.once('error', onError);
      server.once('listening', onListen);
      server.listen(0, '127.0.0.1');
    });
  } catch (error) {
    oauthServer = null;
    throw new Error(`เปิด OAuth callback ไม่สำเร็จ: ${error.message}`);
  }

  const port = server.address().port;
  const attempt = createOAuthAttempt(config, `http://127.0.0.1:${port}/oauth/callback`);
  let settled = false;
  let callbackClaimed = false;
  let settle;
  const result = new Promise((resolve, reject) => {
    settle = (error, token) => {
      if (settled) return;
      settled = true;
      if (error) reject(error); else resolve(token);
    };
  });
  cancelOAuth = () => settle(new Error('ยกเลิกการเชื่อม OAuth แล้ว'));
  const timer = setTimeout(() => settle(new Error('หมดเวลารอ OAuth กรุณาลองเชื่อมบัญชีอีกครั้ง')), 180000);
  server.on('error', error => settle(new Error(`OAuth callback error: ${error.message}`)));

  server.on('request', async (request, response) => {
    let callback;
    try { callback = new URL(request.url, attempt.redirectURI); }
    catch {
      response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end('Invalid request');
      return;
    }
    if (request.method !== 'GET' || callback.pathname !== '/oauth/callback') {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end('Not found');
      return;
    }
    if (settled || callbackClaimed) {
      response.writeHead(409, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(oauthPage(false, 'คำขอนี้ถูกใช้ไปแล้ว'));
      return;
    }
    const oauthError = callback.searchParams.get('error');
    if (oauthError) {
      const detail = String(callback.searchParams.get('error_description') || oauthError).slice(0, 500);
      response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(oauthPage(false, 'ผู้ให้บริการปฏิเสธหรือยกเลิกคำขอ'));
      settle(new Error(`เชื่อม OAuth ไม่สำเร็จ: ${detail}`));
      return;
    }
    if (!safeStateEqual(attempt.state, callback.searchParams.get('state'))) {
      response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(oauthPage(false, 'ค่า state ไม่ตรงกัน จึงหยุดการเชื่อมต่อเพื่อความปลอดภัย'));
      settle(new Error('OAuth state ไม่ตรงกัน กรุณาลองใหม่'));
      return;
    }
    const code = callback.searchParams.get('code');
    if (!code || code.length > 10000) {
      response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(oauthPage(false, 'ไม่ได้รับ authorization code'));
      settle(new Error('OAuth server ไม่ได้ส่ง authorization code'));
      return;
    }
    callbackClaimed = true;
    try {
      const token = await exchangeAuthorizationCode(config, attempt, code);
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(oauthPage(true, 'บัญชีพร้อมใช้กับ elysium-browser AI แล้ว'));
      settle(null, token);
    } catch (error) {
      response.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(oauthPage(false, 'แลก authorization code เป็น token ไม่สำเร็จ'));
      settle(error);
    }
  });

  providerStatus = 'เปิดเบราว์เซอร์แล้ว · รอผู้ใช้ยืนยัน OAuth'; publish();
  try {
    await shell.openExternal(attempt.authorizationURL);
    const token = await result;
    if (store.data.settings.ai.provider !== 'oauth-openai-compatible' || oauthFingerprint(store.data.settings.ai) !== oauthFingerprint(config)) {
      throw new Error('การตั้งค่า OAuth เปลี่ยนระหว่างเชื่อมบัญชี กรุณาลองใหม่');
    }
    saveOAuthToken(token, config);
    providerStatus = 'เชื่อมบัญชี OAuth แล้ว';
    publish();
    return { connected: true };
  } catch (error) {
    providerStatus = `OAuth ไม่สำเร็จ · ${String(error.message || error).slice(0, 500)}`;
    publish();
    throw error;
  } finally {
    clearTimeout(timer);
    cancelOAuth = null;
    oauthServer = null;
    await new Promise(resolve => server.close(resolve));
  }
}

async function extractCurrent(selectionOnly = false) {
  const tab = activeTab();
  if (!tab?.view || tab.error || !isWebURL(tab.url)) throw new Error('เปิดเว็บไซต์ก่อนใช้เครื่องมือนี้');
  const extracted = await tab.view.webContents.executeJavaScript(EXTRACT_PAGE);
  return { title: extracted.title || tab.title, url: tab.url, text: selectionOnly ? extracted.selection : extracted.text, selection: extracted.selection };
}

async function suspendTab(id, confirmed = false) {
  const tab = tabs.find(tab => tab.id === id);
  if (!tab?.view || tab.id === activeId || ui.split?.includes(id) || tab.loading || tab.audible || tab.view.webContents.isCurrentlyAudible() || tab.view.webContents.isBeingCaptured() || downloads.some(d => d.sourceTabId === id && ['progressing', 'interrupted'].includes(d.state))) return false;
  const conditions = await tab.view.webContents.executeJavaScript(CAN_SUSPEND).catch(() => ({ edited: true, hasFrames: true }));
  if (!tabs.includes(tab) || !tab.view || tab.id === activeId || ui.split?.includes(id) || tab.loading || tab.view.webContents.isCurrentlyAudible() || tab.view.webContents.isBeingCaptured() || downloads.some(d => d.sourceTabId === id && ['progressing', 'interrupted'].includes(d.state))) return false;
  if (conditions.media || conditions.hasFrames || (!confirmed && (conditions.edited || tab.edited))) return false;
  if (!confirmed && !tab.autoSuspend) return false;
  if (store.data.settings.memoryExceptions.includes(new URL(tab.url).hostname)) return false;
  win.contentView.removeChildView(tab.view);
  tab.view.webContents.close();
  tab.view = null;
  tab.suspended = true;
  tab.loading = false;
  saveTabs(); publish();
  return true;
}

function showReminderNotification(reminder) {
  if (!Notification.isSupported()) return;
  const notification = new Notification({
    title: `เตือนจาก elysium-browser · ${reminder.title}`,
    body: reminder.details || `ถึงเวลาแล้ว · ${new Date(reminder.dueAt).toLocaleString('th-TH')}`,
    icon: path.join(__dirname, '../assets/elysium.ico'),
    timeoutType: 'never',
  });
  notification.on('click', () => {
    if (!win || win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    openInternal('notes');
  });
  notification.show();
}

function checkReminders(now = Date.now()) {
  if (!store || closing) return 0;
  const due = store.data.reminders
    .filter(reminder => !reminder.done && reminder.dueAt <= now && reminder.notifiedAt < reminder.dueAt)
    .sort((a, b) => a.dueAt - b.dueAt);
  if (!due.length) return 0;
  for (const reminder of due) {
    showReminderNotification(reminder);
    reminder.notifiedAt = now;
    reminder.updatedAt = now;
  }
  store.save();
  publish();
  return due.length;
}

function checkCalendar(now = Date.now()) {
  if (!store || closing) return 0;
  const due = dueEvents(store.data.calendarEvents, now);
  for (const event of due) {
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: `elysium-browser Calendar · ${event.title}`,
        body: [event.allDay ? `${event.startDate} · ทั้งวัน` : new Date(event.startAt).toLocaleString('th-TH'), event.location, event.details].filter(Boolean).join('\n'),
        icon: path.join(__dirname, '../assets/elysium.ico'),
      });
      notification.on('click', () => {
        if (!win || win.isDestroyed()) return;
        if (win.isMinimized()) win.restore();
        win.show(); win.focus(); openInternal('calendar');
        win.webContents.send('elysium:calendar-event', event.id);
      });
      notification.show();
    }
    event.notifiedAt = now;
  }
  if (due.length) { store.save(); publish(); }
  return due.length;
}

const COMMAND_TYPES = {
  'calendar-save': 'object', 'calendar-delete': 'string', 'calendar-check': 'none',
  navigate: 'string', 'new-tab': 'optional-string', 'activate-tab': 'string', 'close-tab': 'string', internal: 'string', back: 'none', forward: 'none', reload: 'none', stop: 'none', bookmark: 'none',
  'remove-bookmark': 'string', 'remove-history': 'string', 'clear-history': 'optional-string', settings: 'object', 'clear-site-data': 'none', 'show-download': 'string', 'cancel-download': 'string',
  'pin-tab': 'string', 'mute-tab': 'string', 'reorder-tab': 'object', 'reopen-tab': 'none', 'private-tab': 'none', 'workspace-save': 'object', 'workspace-switch': 'string', 'workspace-remove': 'string', 'move-tab': 'object',
  panel: 'optional-string', overlay: 'boolean', 'split-open': 'object', 'split-close': 'none', 'split-ratio': 'number', 'note-save': 'object', 'note-delete': 'string', clip: 'none', reader: 'none',
  'postit-save': 'object', 'postit-delete': 'string', 'reminder-save': 'object', 'reminder-delete': 'string', 'reminder-done': 'object', 'reminder-snooze': 'object', 'reminder-check': 'none',
  'theme-save': 'object', 'background-import': 'none', 'bookmark-edit': 'object', 'shortcut-save': 'object', 'shortcut-remove': 'string', 'todo-save': 'object', 'todo-delete': 'string',
  'suspend-tab': 'object', 'tab-auto-suspend': 'object', 'ai-settings': 'object', 'ai-check': 'none', 'ai-oauth-start': 'none', 'ai-oauth-logout': 'none', 'ai-preview': 'string', 'ai-send': 'object', 'weather-config': 'object', 'weather-refresh': 'none',
  'permission-set': 'object', 'clear-origin-data': 'string', 'pause-download': 'string',
  'resume-download': 'string', 'find-start': 'string', 'find-next': 'optional-string', 'find-prev': 'optional-string', 'find-stop': 'none',
  'zoom-set': 'number', 'zoom-reset': 'none', 'bookmark-import': 'none', 'compat-chrome': 'object',
  'default-protocol': 'none', 'default-browser-check': 'none', 'default-browser-settings': 'none',
  'update-check': 'none', 'update-download': 'none', 'update-install': 'none', 'update-open-releases': 'none',
};
function validateCommand(action, payload) {
  if (!Object.hasOwn(COMMAND_TYPES, action)) throw new Error('คำสั่งไม่ถูกต้อง');
  const type = COMMAND_TYPES[action];
  if (JSON.stringify(payload ?? null).length > 150000) throw new Error('ข้อมูลใหญ่เกินกำหนด');
  const optional = type.startsWith('optional-');
  if (optional && payload == null) return;
  if (type === 'none' && payload != null) throw new Error('คำสั่งนี้ไม่รับข้อมูล');
  if (type === 'none') return;
  if (typeof payload !== type.replace('optional-', '') || (type === 'object' && (!payload || Array.isArray(payload))) || (type === 'number' && !Number.isFinite(payload))) throw new Error('รูปแบบข้อมูลคำสั่งไม่ถูกต้อง');
}

async function command(action, payload) {
  validateCommand(action, payload);
  switch (action) {
    case 'navigate': load(activeTab(), resolveAddress(payload, store.data.settings.searchEngine)); break;
    case 'new-tab': createTab(payload ? resolveAddress(payload, store.data.settings.searchEngine) : undefined); if (!payload) focusAddress(); break;
    case 'activate-tab': activate(payload); break;
    case 'close-tab': closeTab(payload); break;
    case 'internal': openInternal(payload); break;
    case 'back': go('back'); break;
    case 'forward': go('forward'); break;
    case 'reload': reload(); break;
    case 'stop': activeTab()?.view?.webContents.stop(); break;
    case 'find-start': lastFind = payload.slice(0, 500); findTarget().findInPage(lastFind); break;
    case 'find-next': { const text = (payload ?? lastFind).slice(0, 500); if (text) { lastFind = text; findTarget().findInPage(text, { findNext: true }); } break; }
    case 'find-prev': { const text = (payload ?? lastFind).slice(0, 500); if (text) { lastFind = text; findTarget().findInPage(text, { findNext: false, forward: false }); } break; }
    case 'find-stop': { const contents = activeTab()?.view?.webContents; if (contents && !contents.isDestroyed()) { try { contents.stopFindInPage('clearSelection'); } catch { /* Already stopped. */ } } break; }
    case 'zoom-set': { const contents = findTarget(); const level = Math.max(-5, Math.min(5, payload)); contents.setZoomLevel(level); store.data.zoomLevels = rememberZoom(store.data.zoomLevels, hostnameOf(activeTab().url), level); store.save(); publish(); break; }
    case 'zoom-reset': { const contents = activeTab()?.view?.webContents; if (contents && !contents.isDestroyed()) contents.setZoomLevel(0); store.data.zoomLevels = rememberZoom(store.data.zoomLevels, hostnameOf(activeTab()?.url || ''), 0); store.save(); publish(); break; }
    case 'compat-chrome': {
      const host = hostnameOf(`https://${String(payload?.host || '').trim().toLowerCase()}`);
      if (!host) throw new Error('ชื่อเว็บไม่ถูกต้อง');
      const hosts = store.data.settings.chromeHosts.filter(h => h !== host);
      if (payload?.enabled) hosts.push(host);
      store.data.settings.chromeHosts = sanitizeChromeHosts(hosts);
      store.save();
      publish();
      return { ok: true, enabled: store.data.settings.chromeHosts.includes(host) };
    }
    case 'bookmark-import': {
      const { canceled, filePaths } = await dialog.showOpenDialog(win, { title: 'นำเข้าบุ๊กมาร์ก — elysium-browser', filters: [{ name: 'Bookmarks HTML', extensions: ['html', 'htm'] }], properties: ['openFile'] });
      if (canceled || !filePaths?.[0]) return { ok: true, imported: 0, skipped: 0 };
      let parsed = [];
      try { parsed = parseBookmarksHTML(fs.readFileSync(filePaths[0], 'utf8')); }
      catch { throw new Error('อ่านไฟล์บุ๊กมาร์กไม่สำเร็จ'); }
      const existing = new Set(store.data.bookmarks.map(item => item.url));
      let imported = 0;
      for (const entry of parsed) {
        if (existing.has(entry.url)) continue;
        existing.add(entry.url);
        store.data.bookmarks.push({ id: randomUUID(), title: entry.title, url: entry.url, folder: entry.folder, createdAt: Date.now() });
        imported++;
      }
      store.data.bookmarks = store.data.bookmarks.slice(0, 2000);
      store.save();
      publish();
      return { ok: true, imported, skipped: parsed.length - imported };
    }
    case 'default-protocol': {
      // Registering elysium:// lets other apps open links back in elysium-browser.
      let protocol = null;
      try { protocol = app.isPackaged ? app.setAsDefaultProtocolClient('elysium') || app.isDefaultProtocolClient('elysium') : app.isDefaultProtocolClient('elysium'); }
      catch { try { protocol = app.isDefaultProtocolClient('elysium'); } catch { protocol = null; } }
      publish();
      return { ok: true, protocol };
    }
    case 'default-browser-check': {
      let protocol = null;
      try { protocol = app.isDefaultProtocolClient('elysium'); } catch { protocol = null; }
      return { ok: true, protocol, packaged: app.isPackaged, platform: process.platform };
    }
    case 'default-browser-settings': {
      // Windows reserves the default-browser choice for the user; deep-link there.
      if (process.platform === 'win32') { await shell.openExternal('ms-settings:defaultapps'); break; }
      throw new Error('ตั้งค่า Default browser ใน System Settings ของระบบ');
    }
    case 'bookmark': bookmark(); break;
    case 'remove-bookmark': store.data.bookmarks = store.data.bookmarks.filter(item => item.id !== payload); store.save(); break;
    case 'remove-history': store.data.history = store.data.history.filter(item => item.id !== payload); store.save(); break;
    case 'clear-history': {
      const periods = { hour: 3600000, day: 86400000, week: 604800000 };
      const cutoff = Object.hasOwn(periods, payload) ? Date.now() - periods[payload] : 0;
      store.data.history = cutoff ? store.data.history.filter(h => h.visitedAt < cutoff) : []; store.save(); break;
    }
    case 'settings':
      if (payload && Object.hasOwn(SEARCH_ENGINES, payload.searchEngine)) store.data.settings.searchEngine = payload.searchEngine;
      if (typeof payload?.restoreTabs === 'boolean') store.data.settings.restoreTabs = payload.restoreTabs;
      for (const key of ['compactSidebar', 'memorySaver']) if (typeof payload[key] === 'boolean') store.data.settings[key] = payload[key];
      if (Number.isFinite(payload.suspendMinutes)) store.data.settings.suspendMinutes = Math.max(5, Math.min(240, payload.suspendMinutes));
      if (Array.isArray(payload.memoryExceptions)) store.data.settings.memoryExceptions = payload.memoryExceptions.filter(x => typeof x === 'string').map(x => x.trim()).filter(Boolean).slice(0, 200);
      if (typeof payload.autoUpdate === 'boolean') store.data.settings.autoUpdate = payload.autoUpdate;
      if (payload?.privacy && typeof payload.privacy === 'object') store.data.settings.privacy = sanitizePrivacy({ ...store.data.settings.privacy, ...payload.privacy });
      store.save();
      layout();
      break;
    case 'clear-site-data':
      await browserSession.clearStorageData();
      await browserSession.clearCache();
      grantedPermissions.clear();
      store.data.permissions = {}; store.save();
      break;
    case 'show-download': {
      const download = downloads.find(item => item.id === payload);
      if (download?.state === 'completed' && download.path) shell.showItemInFolder(download.path);
      break;
    }
    case 'cancel-download': {
      const download = downloads.find(item => item.id === payload);
      if (download && ['progressing', 'interrupted'].includes(download.state) && download.item) download.item.cancel();
      break;
    }
    case 'pause-download': { const d = downloads.find(d => d.id === payload); if (d?.state === 'progressing' && d.item) { d.item.pause(); d.paused = true; d.canResume = d.item.canResume(); } break; }
    case 'resume-download': { const d = downloads.find(d => d.id === payload); if (d?.item && (d.paused || d.state === 'interrupted') && d.item.canResume()) { d.item.resume(); d.paused = false; } else throw new Error('เซิร์ฟเวอร์หรือรายการนี้ไม่รองรับดาวน์โหลดต่อ'); break; }
    case 'pin-tab': { const tab = tabs.find(t => t.id === payload); if (tab) { tab.pinned = !tab.pinned; saveTabs(); } break; }
    case 'mute-tab': { const tab = tabs.find(t => t.id === payload); if (tab?.view) { tab.muted = !tab.muted; tab.view.webContents.setAudioMuted(tab.muted); } break; }
    case 'reorder-tab': {
      const index = tabs.findIndex(t => t.id === payload.id); const target = tabs.findIndex(t => t.id === payload.beforeId);
      if (index >= 0 && target >= 0 && tabs[index].workspaceId === tabs[target].workspaceId) { const [tab] = tabs.splice(index, 1); tabs.splice(tabs.findIndex(t => t.id === payload.beforeId), 0, tab); saveTabs(); } break;
    }
    case 'reopen-tab': reopenTab(); break;
    case 'private-tab': createTab('elysium://home', { private: true }); break;
    case 'workspace-save': {
      const name = String(payload.name || '').trim().slice(0, 60); if (!name) throw new Error('กรุณาตั้งชื่อ workspace');
      const color = /^#[0-9a-f]{6}$/i.test(payload.color) ? payload.color : '#2f6bff';
      const existing = store.data.workspaces.find(w => w.id === payload.id);
      if (existing) Object.assign(existing, { name, color });
      else { if (store.data.workspaces.length >= 30) throw new Error('สร้าง workspace ได้สูงสุด 30'); store.data.workspaces.push({ id: randomUUID(), name, color }); }
      store.save(); break;
    }
    case 'workspace-switch': {
      if (!store.data.workspaces.some(w => w.id === payload)) throw new Error('ไม่พบ workspace');
      ui.split = null; store.data.activeWorkspace = payload;
      if (workspaceTabs().length) activate(workspaceTabs()[0].id); else createTab('elysium://home', { private: false });
      saveTabs(); break;
    }
    case 'workspace-remove': {
      if (store.data.workspaces.length === 1) throw new Error('ต้องมีอย่างน้อยหนึ่ง workspace');
      const target = store.data.workspaces.find(w => w.id !== payload);
      for (const tab of tabs) if (tab.workspaceId === payload) tab.workspaceId = target.id;
      store.data.workspaces = store.data.workspaces.filter(w => w.id !== payload);
      if (store.data.activeWorkspace === payload) store.data.activeWorkspace = target.id;
      ui.split = null; layout(); saveTabs(); break;
    }
    case 'move-tab': {
      const tab = tabs.find(t => t.id === payload.id); if (tab && store.data.workspaces.some(w => w.id === payload.workspaceId)) { tab.workspaceId = payload.workspaceId; activate(tab.id); saveTabs(); } break;
    }
    case 'panel':
      if (payload != null && !['ai', 'notes', 'downloads', 'reader', 'info'].includes(payload)) throw new Error('Panel ไม่ถูกต้อง');
      ui.panel = payload || null; layout(); break;
    case 'overlay': ui.overlay = payload; layout(); if (payload) win.webContents.focus(); else if (activeTab()?.view) activeTab().view.webContents.focus(); break;
    case 'split-open': {
      const first = activeTab(); if (!first?.view || first.error) throw new Error('เปิดเว็บไซต์ก่อนใช้ Split View');
      let second = tabs.find(t => t.id === payload.id && t.workspaceId === first.workspaceId && t.id !== first.id && isWebURL(t.url));
      if (!second && typeof payload.url === 'string') { const url = resolveAddress(payload.url, store.data.settings.searchEngine); if (!isWebURL(url)) throw new Error('Split View รองรับเว็บไซต์ HTTP/HTTPS'); second = createTab(url, { private: first.private }); }
      if (!second) throw new Error('เลือกเว็บอีกแท็บหรือใส่ URL');
      if (second.suspended) load(second, second.url);
      ui.split = [first.id, second.id]; activate(first.id); break;
    }
    case 'split-close': ui.split = null; layout(); break;
    case 'split-ratio': ui.ratio = Math.max(0.25, Math.min(0.75, payload)); layout(); break;
    case 'calendar-save': {
      if (store.readOnly) throw new Error('โปรไฟล์นี้เปิดให้ดูอย่างเดียว');
      const fields = normalizeEvent(payload);
      const previous = payload.id ? store.data.calendarEvents.find(event => event.id === payload.id) : null;
      if (payload.id && !previous) throw new Error('ไม่พบนัดหมายนี้');
      if (!previous && store.data.calendarEvents.length >= 2000) throw new Error('เก็บนัดหมายได้สูงสุด 2,000 รายการ');
      const now = Date.now();
      const event = { ...fields, id: previous?.id || randomUUID(), createdAt: previous?.createdAt || now, updatedAt: now,
        notifiedAt: previous && reminderAt(previous) === reminderAt(fields) ? previous.notifiedAt : 0 };
      const original = store.data.calendarEvents;
      store.data.calendarEvents = previous ? original.map(item => item.id === event.id ? event : item) : [...original, event];
      store.save();
      if (store.writeError) { store.data.calendarEvents = original; throw new Error(store.writeError); }
      publish(); setTimeout(() => checkCalendar(), 50);
      return { ok: true, id: event.id };
    }
    case 'calendar-delete': {
      const original = store.data.calendarEvents;
      if (!original.some(event => event.id === payload)) throw new Error('ไม่พบนัดหมายนี้');
      store.data.calendarEvents = original.filter(event => event.id !== payload);
      store.save();
      if (store.writeError) { store.data.calendarEvents = original; throw new Error(store.writeError); }
      publish(); return { ok: true };
    }
    case 'calendar-check': return { ok: true, notified: checkCalendar() };
    case 'note-save': {
      if (typeof payload.body !== 'string' || typeof payload.title !== 'string') throw new Error('รูปแบบโน้ตไม่ถูกต้อง');
      let note = store.data.notes.find(n => n.id === payload.id);
      if (!note) { note = { id: randomUUID(), sourceURL: isWebURL(payload.sourceURL) ? payload.sourceURL : '' }; store.data.notes.unshift(note); }
      Object.assign(note, { title: payload.title.slice(0, 200), body: payload.body.slice(0, 100000), updatedAt: Date.now() });
      store.save(); publish(); return { ok: true, id: note.id };
    }
    case 'note-delete': store.data.notes = store.data.notes.filter(n => n.id !== payload); store.save(); break;
    case 'postit-save': {
      if (typeof payload.title !== 'string' || typeof payload.body !== 'string') throw new Error('รูปแบบ Post-it ไม่ถูกต้อง');
      const title = payload.title.trim().slice(0, 120);
      const body = payload.body.trim().slice(0, 4000);
      if (!title && !body) throw new Error('เขียนข้อความใน Post-it ก่อนบันทึก');
      const now = Date.now();
      let postIt = store.data.postIts.find(item => item.id === payload.id);
      if (!postIt) {
        if (store.data.postIts.length >= 300) throw new Error('เก็บ Post-it ได้สูงสุด 300 ใบ');
        postIt = { id: randomUUID(), createdAt: now };
        store.data.postIts.unshift(postIt);
      }
      Object.assign(postIt, {
        title,
        body,
        color: POST_IT_COLORS.includes(payload.color) ? payload.color : 'yellow',
        pinned: !!payload.pinned,
        updatedAt: now,
      });
      store.data.postIts.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
      store.save(); publish(); return { ok: true, id: postIt.id };
    }
    case 'postit-delete': store.data.postIts = store.data.postIts.filter(item => item.id !== payload); store.save(); break;
    case 'reminder-save': {
      if (typeof payload.title !== 'string') throw new Error('รูปแบบการแจ้งเตือนไม่ถูกต้อง');
      const title = payload.title.trim().slice(0, 200);
      const dueAt = typeof payload.dueAt === 'number' ? payload.dueAt : Date.parse(payload.dueAt);
      if (!title) throw new Error('ใส่หัวข้อที่ต้องการให้ elysium-browser เตือน');
      if (!Number.isFinite(dueAt)) throw new Error('เลือกวันและเวลาแจ้งเตือน');
      const now = Date.now();
      let reminder = store.data.reminders.find(item => item.id === payload.id);
      if (!reminder) {
        if (store.data.reminders.length >= 500) throw new Error('เก็บการแจ้งเตือนได้สูงสุด 500 รายการ');
        reminder = { id: randomUUID(), createdAt: now, done: false, notifiedAt: 0 };
        store.data.reminders.push(reminder);
      }
      if (reminder.dueAt !== dueAt || reminder.title !== title) reminder.notifiedAt = 0;
      Object.assign(reminder, {
        title,
        details: String(payload.details || '').trim().slice(0, 2000),
        dueAt,
        done: typeof payload.done === 'boolean' ? payload.done : reminder.done,
        updatedAt: now,
      });
      store.data.reminders.sort((a, b) => Number(a.done) - Number(b.done) || a.dueAt - b.dueAt);
      store.save();
      setTimeout(() => checkReminders(), 50);
      publish(); return { ok: true, id: reminder.id };
    }
    case 'reminder-delete': store.data.reminders = store.data.reminders.filter(item => item.id !== payload); store.save(); break;
    case 'reminder-done': {
      const reminder = store.data.reminders.find(item => item.id === payload.id);
      if (!reminder || typeof payload.done !== 'boolean') throw new Error('ไม่พบรายการแจ้งเตือน');
      reminder.done = payload.done;
      reminder.updatedAt = Date.now();
      if (!reminder.done && reminder.dueAt > Date.now()) reminder.notifiedAt = 0;
      store.save(); break;
    }
    case 'reminder-snooze': {
      const reminder = store.data.reminders.find(item => item.id === payload.id);
      if (!reminder) throw new Error('ไม่พบรายการแจ้งเตือน');
      const minutes = Math.max(1, Math.min(10080, Number(payload.minutes) || 10));
      reminder.dueAt = Date.now() + minutes * 60000;
      reminder.done = false;
      reminder.notifiedAt = 0;
      reminder.updatedAt = Date.now();
      store.data.reminders.sort((a, b) => Number(a.done) - Number(b.done) || a.dueAt - b.dueAt);
      store.save(); break;
    }
    case 'reminder-check': return { ok: true, notified: checkReminders() };
    case 'clip': {
      const page = await extractCurrent(true); if (!page.text) throw new Error('เลือกข้อความบนเว็บไซต์ก่อนเก็บคลิป');
      store.data.notes.unshift({ id: randomUUID(), title: page.title, body: page.text, sourceURL: page.url, updatedAt: Date.now() }); store.save(); ui.panel = 'notes'; layout(); break;
    }
    case 'reader': reader = await extractCurrent(); ui.panel = 'reader'; layout(); break;
    case 'theme-save': {
      store.data.settings.theme = sanitizeTheme({ ...store.data.settings.theme, ...payload });
      const palette = getNovelTheme(store.data.settings.theme.variant)?.palette;
      if (win && !win.isDestroyed()) win.setTitleBarOverlay({color:palette?.canvas || '#0a162c',symbolColor:palette?.text || '#cbdcfa'});
      store.save(); break;
    }
    case 'background-import': {
      const selected = await dialog.showOpenDialog(win, { title: 'เลือกภาพพื้นหลัง', properties: ['openFile'], filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }] });
      if (!selected.canceled && selected.filePaths[0]) {
        const file = selected.filePaths[0]; if (fs.statSync(file).size > 15000000) throw new Error('เลือกภาพขนาดไม่เกิน 15 MB');
        let bitmap = nativeImage.createFromPath(file); if (bitmap.isEmpty()) throw new Error('ไม่สามารถอ่านภาพนี้ได้');
        if (bitmap.getSize().width > 1920) bitmap = bitmap.resize({ width: 1920 });
        const directory = path.join(app.getPath('userData'), 'themes'); fs.mkdirSync(directory, { recursive: true });
        const filename = `background-${Date.now()}.png`; fs.writeFileSync(path.join(directory, filename), bitmap.toPNG());
        store.data.customBackground = filename; store.data.settings.theme.background = 'custom'; store.save();
      } break;
    }
    case 'bookmark-edit': {
      const bookmark = store.data.bookmarks.find(b => b.id === payload.id); if (!bookmark) throw new Error('ไม่พบบุ๊กมาร์ก');
      const url = resolveAddress(payload.url); if (!isWebURL(url)) throw new Error('ใส่ URL เว็บไซต์');
      Object.assign(bookmark, { title: String(payload.title || url).slice(0, 300), url, folder: String(payload.folder || '').slice(0, 80) }); store.save(); break;
    }
    case 'shortcut-save': {
      const url = resolveAddress(payload.url); if (!isWebURL(url)) throw new Error('ใส่ URL เว็บไซต์');
      const existing = store.data.shortcuts.find(s => s.id === payload.id);
      if (existing) Object.assign(existing, { title: String(payload.title || new URL(url).hostname).slice(0, 40), url });
      else { if (store.data.shortcuts.length >= 12) throw new Error('เพิ่มทางลัดได้สูงสุด 12 รายการ'); store.data.shortcuts.push({ id: randomUUID(), title: String(payload.title || new URL(url).hostname).slice(0, 40), url }); }
      store.save(); break;
    }
    case 'shortcut-remove': store.data.shortcuts = store.data.shortcuts.filter(s => s.id !== payload); store.save(); break;
    case 'todo-save': {
      const todo = store.data.todos.find(t => t.id === payload.id);
      if (todo) { if (typeof payload.done === 'boolean') todo.done = payload.done; }
      else if (typeof payload.text === 'string' && payload.text.trim()) store.data.todos.push({ id: randomUUID(), text: payload.text.trim().slice(0, 300), done: false });
      store.save(); break;
    }
    case 'todo-delete': store.data.todos = store.data.todos.filter(t => t.id !== payload); store.save(); break;
    case 'suspend-tab': if (!await suspendTab(payload.id, payload.confirmed === true)) throw new Error('พักแท็บนี้ไม่ได้: อาจกำลังใช้งาน มีเสียง ดาวน์โหลด iframe หรือข้อมูลยังไม่บันทึก'); break;
    case 'tab-auto-suspend': { const tab = tabs.find(t => t.id === payload.id); if (tab && typeof payload.enabled === 'boolean') { tab.autoSuspend = payload.enabled; saveTabs(); } break; }
    case 'ai-settings': {
      if (!['none', 'ollama', 'openai-compatible', 'oauth-openai-compatible'].includes(payload.provider)) throw new Error('Provider ไม่ถูกต้อง');
      if (payload.provider !== 'none') providerURL(String(payload.endpoint || ''), '');
      let oauthConfigChanged = false;
      const nextAI = {
        provider: payload.provider,
        endpoint: String(payload.endpoint || '').slice(0, 2048),
        model: String(payload.model || '').slice(0, 200),
        ...(payload.provider === 'oauth-openai-compatible' ? {
          oauthAuthorizationEndpoint: String(payload.oauthAuthorizationEndpoint || '').slice(0, 2048),
          oauthTokenEndpoint: String(payload.oauthTokenEndpoint || '').slice(0, 2048),
          oauthClientId: String(payload.oauthClientId || '').slice(0, 500),
          oauthScopes: String(payload.oauthScopes || '').slice(0, 2000),
        } : {}),
      };
      if (payload.provider === 'oauth-openai-compatible') {
        validateOAuthConfig(nextAI);
        let savedFingerprint = '';
        try { savedFingerprint = readOAuthToken()?.fingerprint || ''; } catch { /* Replace unreadable credentials on the next login. */ }
        if (savedFingerprint && savedFingerprint !== oauthFingerprint(nextAI)) {
          delete store.data.secrets.aiOAuth;
          oauthConfigChanged = true;
        }
      }
      if (typeof payload.apiKey === 'string' && payload.apiKey) {
        if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows credential encryption ไม่พร้อม จึงไม่ได้เก็บ API key');
        store.data.secrets.aiKey = safeStorage.encryptString(payload.apiKey).toString('base64');
      }
      if (payload.clearKey === true) delete store.data.secrets.aiKey;
      store.data.settings.ai = nextAI;
      aiPreview = null;
      providerStatus = oauthConfigChanged ? 'การตั้งค่า OAuth เปลี่ยนแล้ว · กรุณาเชื่อมบัญชีใหม่' : '';
      store.save(); break;
    }
    case 'ai-oauth-start': return { ok: true, ...(await startOAuthLogin()) };
    case 'ai-oauth-logout':
      if (cancelOAuth) cancelOAuth();
      delete store.data.secrets.aiOAuth;
      providerStatus = 'ออกจากบัญชี OAuth ใน elysium-browser แล้ว';
      aiPreview = null; store.save(); break;
    case 'ai-check': { const result = await checkProvider(store.data.settings.ai, await aiCredential()); providerStatus = `เชื่อมต่อแล้ว · ${result.models.length} models`; publish(); return { ok: true, ...result }; }
    case 'ai-preview': {
      if (!['summarize', 'translate', 'ask', 'draft'].includes(payload)) throw new Error('AI action ไม่ถูกต้อง');
      const context = payload === 'draft' ? { title: '', url: '', text: '' } : await extractCurrent(payload === 'translate');
      if (payload === 'translate' && !context.text) throw new Error('เลือกข้อความก่อนแปล');
      aiPreview = { id: randomUUID(), action: payload, title: context.title, url: context.url, text: context.text.slice(0, 12000), provider: { ...store.data.settings.ai } }; aiResult = ''; ui.panel = 'ai'; layout(); break;
    }
    case 'ai-send': {
      if (aiBusy) throw new Error('กำลังรอคำตอบจาก provider');
      if (!aiPreview || payload.id !== aiPreview.id || payload.consent !== true) throw new Error('ตรวจข้อความและยืนยันก่อนส่งไปยัง provider');
      const preview = { ...aiPreview }; aiBusy = true; publish();
      try { aiResult = await requestAI(preview.provider, await aiCredential(preview.provider), { action: preview.action, question: String(payload.question || '').slice(0, 4000), context: preview }); }
      finally { aiBusy = false; publish(); } break;
    }
    case 'weather-config': {
      if (!['none', 'open-meteo'].includes(payload.provider)) throw new Error('Weather provider ไม่ถูกต้อง');
      store.data.settings.weather = { provider: payload.provider, city: String(payload.city || '').trim().slice(0, 100) }; weather = null; store.save(); break;
    }
    case 'weather-refresh': {
      if (store.data.settings.weather.provider !== 'open-meteo' || !store.data.settings.weather.city) throw new Error('ตั้งค่าเมืองและ Open-Meteo ก่อนดูอากาศ');
      weather = await getWeather(store.data.settings.weather.city); break;
    }
    case 'permission-set': {
      if (!isWebURL(payload.origin) || !['media', 'notifications', 'geolocation'].includes(payload.permission) || !['ask', 'allow', 'deny'].includes(payload.value)) throw new Error('สิทธิ์เว็บไซต์ไม่ถูกต้อง');
      const origin = new URL(payload.origin).origin;
      if (activeTab()?.private) throw new Error('การจัดการสิทธิ์แบบบันทึกใช้กับแท็บปกติเท่านั้น');
      store.data.permissions[origin] = { ...store.data.permissions[origin], [payload.permission]: payload.value };
      grantedPermissions.delete(`${origin}|${payload.permission}`); store.save(); break;
    }
    case 'clear-origin-data': {
      if (!isWebURL(payload)) throw new Error('Origin ไม่ถูกต้อง');
      const origin = new URL(payload).origin;
      await (activeTab()?.private ? privateSession : browserSession).clearStorageData({ origin });
      if (!activeTab()?.private) { delete store.data.permissions[origin]; store.save(); }
      for (const entry of grantedPermissions) if (entry.startsWith(`${activeTab()?.private ? 'private:' : ''}${origin}|`)) grantedPermissions.delete(entry);
      break;
    }
    case 'update-check': return { ok: true, ...(await updater.check()) };
    case 'update-download': await updater.download(); break;
    case 'update-install': updater.install(); break;
    case 'update-open-releases': updater.openReleases(); break;
    default: throw new Error('คำสั่งไม่ถูกต้อง');
  }
  publish();
  return { ok: true };
}

function configureSession(target, isPrivate = false) {
  // Keep Chromium compatibility tokens while identifying elysium-browser and avoiding
  // Electron-specific fingerprinting in both HTTP headers and navigator.userAgent.
  target.setUserAgent(elysiumUserAgent());
  // Privacy signals, never content blocking: DNT and Sec-GPC simply declare the
  // user's tracking preference to websites that honor them.
  // Compatibility fingerprint: real Chromium browsers always send low-entropy
  // Client Hints, and bot scoring flags requests whose UA claims Chrome while
  // the hints are missing or inconsistent — so every web request carries
  // Sec-CH-UA brands matching the User-Agent it goes out with.
  target.webRequest.onBeforeSendHeaders((details, callback) => {
    try {
      const settings = store?.data?.settings;
      const privacy = settings?.privacy;
      const requestHeaders = { ...details.requestHeaders };
      const host = hostnameOf(details.url);
      if (host) {
        const opted = settings?.chromeHosts || [];
        // Chrome mode follows the tab: subresource/beacon/challenge requests on
        // third-party hosts (Cloudflare challenge platform, Turnstile, beacons)
        // carry the same identity as the opted-in page that caused them, so the
        // whole challenge session stays consistent like stock Chrome.
        const owner = details.webContentsId != null ? tabs.find(t => t.view?.webContents?.id === details.webContentsId) : null;
        const chromeMode = isChromeModeRequest({ requestHost: host, ownerUrl: owner?.url || '', chromeHosts: opted });
        requestHeaders['Sec-CH-UA'] = hintBrands({ chromeMode, chromeMajor: process.versions.chrome, appMajor: app.getVersion() });
        requestHeaders['Sec-CH-UA-Mobile'] = '?0';
        requestHeaders['Sec-CH-UA-Platform'] = '"Windows"';
        // Per-site Chrome mode for server allowlists that only know Chrome/Edge.
        if (chromeMode) requestHeaders['User-Agent'] = stockChromeUA(process.versions.chrome);
      }
      if (privacy?.dnt) requestHeaders.DNT = '1';
      if (privacy?.gpc) requestHeaders['Sec-GPC'] = '1';
      callback({ requestHeaders });
    } catch { callback({}); }
  });
  target.setPermissionCheckHandler((contents, permission, origin) => {
    if (!['media', 'notifications', 'geolocation', 'fullscreen'].includes(permission) || !isWebURL(origin) || !origin.startsWith('https://') || !contents || contents.isDestroyed() || !isWebURL(contents.getURL()) || new URL(contents.getURL()).origin !== new URL(origin).origin) return false;
    origin = new URL(origin).origin;
    // A normal fullscreen request already requires a user gesture. Chromium
    // reports gesture-free attempts separately as automatic-fullscreen, which
    // remains denied by the allow-list above.
    if (permission === 'fullscreen') return true;
    if (isPrivate) return grantedPermissions.has(`private:${origin}|${permission}`);
    if (store.data.permissions[origin]?.[permission] === 'deny') return false;
    return store.data.permissions[origin]?.[permission] === 'allow' || grantedPermissions.has(`${origin}|${permission}`);
  });
  target.setPermissionRequestHandler(async (contents, permission, callback, details) => {
    const labels = { media: 'ใช้กล้องหรือไมโครโฟน', geolocation: 'เข้าถึงตำแหน่งที่ตั้ง', notifications: 'แสดงการแจ้งเตือน' };
    const requestURL = details.requestingUrl || contents?.getURL();
    if (![...Object.keys(labels), 'fullscreen'].includes(permission) || !isWebURL(requestURL) || !contents || contents.isDestroyed() || !isWebURL(contents.getURL())) return callback(false);
    const origin = new URL(requestURL).origin;
    if (!requestURL.startsWith('https://') || new URL(contents.getURL()).origin !== origin) return callback(false);
    if (permission === 'fullscreen') return callback(true);
    const key = `${isPrivate ? 'private:' : ''}${origin}|${permission}`;
    const saved = !isPrivate ? store.data.permissions[origin]?.[permission] : undefined;
    if (saved === 'deny') return callback(false);
    if (saved === 'allow') return callback(true);
    if (grantedPermissions.has(key)) return callback(true);
    try {
      const { response } = await dialog.showMessageBox(win, {
        type: 'question', title: 'สิทธิ์ของเว็บไซต์', message: `${origin} ต้องการ${labels[permission]}`,
        detail: 'อนุญาตเฉพาะระหว่างการเปิด elysium-browser ครั้งนี้', buttons: ['ไม่อนุญาต', 'อนุญาต'], defaultId: 0, cancelId: 0,
      });
      if (response === 1 && !contents.isDestroyed()) grantedPermissions.add(key);
      callback(response === 1 && !contents.isDestroyed());
    } catch { callback(false); }
  });
  target.on('will-download', (_event, item, contents) => {
    item.setSaveDialogOptions({ title: 'บันทึกไฟล์ — elysium-browser', defaultPath: path.join(app.getPath('downloads'), path.basename(item.getFilename())) });
    const download = { id: randomUUID(), sourceTabId: tabs.find(t => t.view?.webContents === contents)?.id, private: isPrivate, filename: item.getFilename(), url: item.getURL(), received: 0, total: item.getTotalBytes(), state: 'progressing', paused: false, canResume: false, createdAt: Date.now(), path: '', speed: 0, etaSec: null, lastSample: { at: Date.now(), bytes: 0 }, item };
    downloads.unshift(download);
    item.on('updated', (_event, state) => {
      download.state = state;
      download.received = item.getReceivedBytes();
      download.total = item.getTotalBytes();
      download.path = item.getSavePath();
      download.paused = item.isPaused();
      download.canResume = item.canResume();
      // Speed as an exponential moving average over ~0.5s samples; ETA from it.
      const now = Date.now();
      const elapsed = (now - download.lastSample.at) / 1000;
      if (elapsed >= 0.5 && !download.paused) {
        const instant = Math.max(0, (download.received - download.lastSample.bytes) / elapsed);
        download.speed = download.speed ? Math.round(download.speed * 0.6 + instant * 0.4) : Math.round(instant);
        download.lastSample = { at: now, bytes: download.received };
      }
      download.etaSec = download.speed > 0 && download.total > download.received ? Math.ceil((download.total - download.received) / download.speed) : null;
      publish();
    });
    item.once('done', (_event, state) => {
      download.state = state;
      download.path = item.getSavePath();
      download.received = item.getReceivedBytes();
      delete download.item;
      download.paused = false;
      download.canResume = false;
      // Keep finished, non-private records across restarts; interrupted ones lose resume support.
      if (!download.private && FINISHED_DOWNLOAD_STATES.includes(state)) {
        store.data.downloads = [{ id: download.id, filename: download.filename, url: download.url, path: download.path, received: download.received, total: download.total, state, createdAt: download.createdAt }, ...store.data.downloads.filter(d => d.id !== download.id)].slice(0, 200);
        store.save();
      }
      publish();
    });
    publish();
  });
}

function createWindow() {
  closing = false;
  tabs = [];
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1000, minHeight: 650,
    title: ELYSIUM_BROWSER_NAME, backgroundColor: '#071122',
    icon: path.join(__dirname, '../assets/elysium.ico'),
    titleBarStyle: 'hidden', titleBarOverlay: { color: getNovelTheme(store.data.settings.theme.variant)?.palette.canvas || '#0a162c', symbolColor: getNovelTheme(store.data.settings.theme.variant)?.palette.text || '#cbdcfa', height: 40 },
    autoHideMenuBar: true, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  attachShortcuts(win.webContents);
  win.on('resize', () => { layout(); publish(); });
  win.on('enter-full-screen', () => { layout(); publish(); });
  win.on('leave-full-screen', () => { layout(); publish(); });
  win.on('ready-to-show', () => { win.show(); layout(); });
  win.on('close', () => {
    closing = true;
    if (cancelOAuth) cancelOAuth();
    clearInterval(memoryTimer);
    clearInterval(reminderTimer);
    clearTimeout(publishTimer);
    clearTimeout(htmlFullscreenLayoutTimer);
    publishTimer = null;
    htmlFullscreenLayoutTimer = null;
    // Clear-on-exit privacy: history is wiped synchronously; cookies/cache are
    // best-effort async and usually finish while windows tear down.
    const privacy = store.data.settings.privacy;
    if (privacy.clearHistory) store.data.history = [];
    if (privacy.clearCookies) browserSession.clearStorageData({ storages: ['cookies'] }).catch(() => {});
    if (privacy.clearCache) browserSession.clearCache().catch(() => {});
    saveTabs();
    for (const tab of tabs) if (tab.view && !tab.view.webContents.isDestroyed()) tab.view.webContents.close();
  });
  win.on('closed', () => { win = null; });
  const saved = [...store.data.sessionTabs];
  const activeWorkspace = store.data.activeWorkspace;
  win.loadFile(UI_FILE);
  if (store.data.settings.restoreTabs) for (const entry of saved) createTab(entry.url, { ...entry, private: false });
  store.data.activeWorkspace = activeWorkspace;
  if (!workspaceTabs().length) createTab('elysium://home', { private: false });
  activate(workspaceTabs().find(tab => tab.url === 'elysium://home')?.id || workspaceTabs()[0].id);
  if (process.argv.includes('--calendar')) openInternal('calendar');
  if (process.argv.includes('--themes')) openInternal('themes');
  memoryTimer = setInterval(async () => {
    if (!store.data.settings.memorySaver || closing) return;
    for (const tab of [...tabs]) {
      if (Date.now() - tab.lastActive > store.data.settings.suspendMinutes * 60000) await suspendTab(tab.id).catch(() => {});
    }
  }, 60000);
  reminderTimer = setInterval(() => { checkReminders(); checkCalendar(); }, 15000);
  setTimeout(() => { checkReminders(); checkCalendar(); }, 1200);
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', (_event, argv) => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); if (argv.includes('--calendar')) openInternal('calendar'); if (argv.includes('--themes')) openInternal('themes'); } });
  app.whenReady().then(() => {
    // First launch after the Cherry → elysium-browser rename adopts the legacy profile.
    if (!process.env.ELYSIUM_TEST_PROFILE) {
      try {
        const nextDir = app.getPath('userData');
        const legacyDir = path.join(path.dirname(nextDir), 'Cherrywebbrowser');
        const hasData = fs.existsSync(path.join(nextDir, 'elysium-data.json')) || fs.existsSync(path.join(nextDir, 'cherry-data.json'));
        if (!hasData && fs.existsSync(path.join(legacyDir, 'cherry-data.json'))) {
          fs.mkdirSync(nextDir, { recursive: true });
          fs.cpSync(legacyDir, nextDir, { recursive: true });
        }
      } catch { /* Start with a fresh profile when migration is unavailable. */ }
    }
    store = new BrowserStore(app.getPath('userData'));
    // Restore the persisted download history (finished, non-private) into the session list.
    downloads = store.data.downloads.map(record => ({ ...record, paused: false, canResume: false }));
    pruneMissingDownloads();
    Menu.setApplicationMenu(null);
    // Claim elysium:// links for packaged builds so other apps can open back here.
    if (app.isPackaged) { try { app.setAsDefaultProtocolClient('elysium'); } catch { /* Protocol claim is best-effort. */ } }
    browserSession = session.fromPartition('persist:cherry-web');
    privateSession = session.fromPartition(`cherry-private-${randomUUID()}`);
    configureSession(browserSession);
    configureSession(privateSession, true);
    ipcMain.handle('elysium:state', event => { if (!trusted(event)) throw new Error('Untrusted sender'); return snapshot(); });
    ipcMain.handle('elysium:command', async (event, action, payload) => {
      if (!trusted(event)) throw new Error('Untrusted sender');
      try { return await command(action, payload); }
      catch (error) { return { ok: false, error: error.message }; }
    });
    updater.init(publish);
    if (store.data.settings.autoUpdate) setTimeout(() => updater.check().catch(() => {}), 30000);
    createWindow();
    app.on('activate', () => { if (!win) createWindow(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
