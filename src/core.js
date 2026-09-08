const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { normalizeEvent } = require('./calendar');
const { ids: NOVEL_THEME_IDS } = require('./themes');

const INTERNAL_PAGES = ['home', 'bookmarks', 'history', 'downloads', 'settings', 'workspaces', 'themes', 'notes', 'memory', 'calendar'];
const SEARCH_ENGINES = {
  google: 'https://www.google.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=',
  bing: 'https://www.bing.com/search?q=',
};
const POST_IT_COLORS = ['yellow', 'blue', 'pink', 'mint', 'purple'];
const SCHEMA_VERSION = 5;
const FINISHED_DOWNLOAD_STATES = ['completed', 'interrupted'];

// Drop persisted download records whose file no longer exists on disk
// (deleted/renamed/moved outside the app), so the list mirrors the filesystem.
function filterExistingDownloads(records) {
  if (!Array.isArray(records)) return [];
  return records.filter(record => {
    if (!record || typeof record.path !== 'string' || !record.path) return false;
    try { return fs.existsSync(record.path); }
    catch { return false; }
  });
}

function isWebURL(value) {
  try { return ['https:', 'http:'].includes(new URL(value).protocol); }
  catch { return false; }
}

// Stock Chrome User-Agent for per-site compatibility mode (server allowlists
// that only know Chrome/Edge). JS navigator.userAgent still reports elysium.
function stockChromeUA(chromeVersion) {
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
}

// Low-entropy Client Hints brands, mirroring how Edge/Brave carry their own
// product brand next to Chromium. chromeMode impersonates Google Chrome.
function hintBrands({ chromeMode = false, chromeMajor = '', appMajor = '1' } = {}) {
  const major = String(chromeMajor || '').split('.')[0] || '';
  if (chromeMode) return `"Google Chrome";v="${major}", "Chromium";v="${major}", "Not/A)Brand";v="99"`;
  return `"elysium-browser";v="${String(appMajor || '1').split('.')[0]}", "Chromium";v="${major}", "Not/A)Brand";v="99"`;
}

function sanitizeChromeHosts(input) {
  if (!Array.isArray(input)) return [];
  const hosts = [];
  for (const entry of input) {
    const host = typeof entry === 'string' ? entry.toLowerCase().slice(0, 253) : hostnameOf(entry?.url || '');
    if (host && /^[a-z0-9.-]+(:\d+)?$/.test(host) && !hosts.includes(host)) hosts.push(host);
    if (hosts.length >= 200) break;
  }
  return hosts;
}

// Chrome-mode decision for one request: stock identity when the request host
// itself is opted in, or when the tab that caused it currently shows an
// opted-in site (covers challenge CDNs, Turnstile and beacons on third-party
// hosts so the whole session stays consistent like stock Chrome).
function isChromeModeRequest({ requestHost = '', ownerUrl = '', chromeHosts = [] } = {}) {
  if (!Array.isArray(chromeHosts) || !chromeHosts.length) return false;
  if (requestHost && chromeHosts.includes(requestHost)) return true;
  const pageHost = hostnameOf(ownerUrl || '');
  return !!pageHost && chromeHosts.includes(pageHost);
}
// Interstitial titles that mean a bot-verification page is showing instead of
// the real site (Cloudflare and similar). Used to auto-offer Chrome mode.
const CHALLENGE_TITLE_PATTERN = /just a moment|attention required/i;

// Returns the host to auto-enable when a verification page looks stuck, else ''.
function shouldAutoChromeMode({ title = '', url = '', chromeHosts = [] } = {}) {
  if (!CHALLENGE_TITLE_PATTERN.test(String(title || ''))) return '';
  const host = hostnameOf(url || '');
  if (!host || (Array.isArray(chromeHosts) && chromeHosts.includes(host))) return '';
  return host;
}
// Guest-page shim for per-site Chrome mode: reports a stock Chrome identity to
// page scripts (navigator.userAgent + userAgentData) on user-opted hosts only.
// Cloudflare-style bot scoring reads these JS signals alongside headers; without
// the shim the page still sees the elysium product brand and holds challenges.
function buildCompatShim({ userAgent = '', chromeVersion = '' } = {}) {
  const major = String(chromeVersion || '').split('.')[0] || '';
  const full = String(chromeVersion || major || '');
  const payload = JSON.stringify({ userAgent: String(userAgent || ''), major, full });
  return `(() => { try {
    const config = ${payload};
    if (!config.userAgent || navigator.userAgent === config.userAgent) return;
    const brands = [{ brand: 'Google Chrome', version: config.major }, { brand: 'Chromium', version: config.major }, { brand: 'Not/A)Brand', version: '99' }];
    const fullList = [{ brand: 'Google Chrome', version: config.full || config.major }, { brand: 'Chromium', version: config.full || config.major }, { brand: 'Not/A)Brand', version: '99.0.0.0' }];
    const mask = (fn, name) => { try { Object.defineProperty(fn, 'toString', { value: () => ('function ' + name + '() { [native code] }'), configurable: true }); } catch (e) {} };
    const uaGetter = () => config.userAgent;
    mask(uaGetter, 'get userAgent');
    Object.defineProperty(navigator, 'userAgent', { get: uaGetter, configurable: true });
    const highEntropy = async (hints) => {
      const out = {};
      for (const hint of hints || []) {
        if (hint === 'architecture') out.architecture = 'x86';
        else if (hint === 'bitness') out.bitness = '64';
        else if (hint === 'brands') out.brands = brands.slice();
        else if (hint === 'fullVersionList') out.fullVersionList = fullList.slice();
        else if (hint === 'mobile') out.mobile = false;
        else if (hint === 'model') out.model = '';
        else if (hint === 'platform') out.platform = 'Windows';
        else if (hint === 'platformVersion') out.platformVersion = '15.0.0';
        else if (hint === 'uaFullVersion') out.uaFullVersion = config.full || config.major;
        else if (hint === 'wow64') out.wow64 = false;
      }
      return out;
    };
    mask(highEntropy, 'getHighEntropyValues');
    const toJSON = () => ({ brands: brands.slice(), mobile: false, platform: 'Windows' });
    mask(toJSON, 'toJSON');
    const uaData = { brands: brands.slice(), mobile: false, platform: 'Windows', getHighEntropyValues: highEntropy, toJSON };
    const dataGetter = () => uaData;
    mask(dataGetter, 'get userAgentData');
    Object.defineProperty(navigator, 'userAgentData', { get: dataGetter, configurable: true });
  } catch (e) {} })();`;
}
function hostnameOf(url) {
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) return '';
    return parsed.hostname.toLowerCase().slice(0, 253);
  } catch { return ''; }
}

// Electron zoom levels step ~x1.2 per level (Chromium convention).
function zoomPercent(level) {
  if (!Number.isFinite(level)) return 100;
  return Math.round(100 * Math.pow(1.2, Math.max(-5, Math.min(5, level))));
}

// Remember a per-site zoom level; level 0 removes the override. Capped at 200 hosts.
function rememberZoom(levels, host, level) {
  const store = levels && typeof levels === 'object' ? levels : {};
  if (!host || typeof host !== 'string') return store;
  const clamped = Math.max(-5, Math.min(5, Number(level) || 0));
  delete store[host];
  if (clamped !== 0) store[host] = clamped;
  for (const key of Object.keys(store).slice(0, Math.max(0, Object.keys(store).length - 200))) delete store[key];
  return store;
}

function sanitizePrivacy(input) {
  const base = { dnt: true, gpc: true, clearHistory: false, clearCookies: false, clearCache: false };
  if (!input || typeof input !== 'object') return base;
  for (const key of Object.keys(base)) if (typeof input[key] === 'boolean') base[key] = input[key];
  return base;
}

// Parse Netscape-format bookmark exports (Chrome/Edge "Export bookmarks to HTML").
// Returns [{ title, url, folder }] capped at 2000 entries, web URLs only.
function parseBookmarksHTML(html) {
  const results = [];
  if (typeof html !== 'string' || !html) return results;
  const source = html.slice(0, 5000000);
  const decode = value => String(value ?? '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_m, code) => { try { return String.fromCodePoint(Math.min(0x10FFFF, Number(code))); } catch { return ''; } }).replace(/<[^>]*>/g, '').trim();
  const tagPattern = /<(\/?)dl\b[^>]*>|<h3\b[^>]*>([^<]*)<\/h3\s*>|<a\b([^>]*)>([^<]*)<\/a\s*>/gi;
  let depth = 0;
  const folders = [];
  let match;
  while ((match = tagPattern.exec(source)) && results.length < 2000) {
    const [full, closing, folderName, anchorAttrs, anchorText] = match;
    if (/^<h3/i.test(full)) {
      folders.length = depth;
      folders.push(decode(folderName).slice(0, 60));
    } else if (/^<a/i.test(full)) {
      const href = /href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(anchorAttrs || '');
      const url = decode(href?.[2] ?? href?.[3] ?? href?.[4] ?? '');
      if (!isWebURL(url)) continue;
      results.push({ title: decode(anchorText).slice(0, 300) || url, url, folder: folders[depth - 1] || '' });
    } else {
      // Remaining alternative is <DL> (open) or </DL> (close).
      if (closing) { depth = Math.max(0, depth - 1); folders.length = depth; }
      else depth += 1;
    }
  }
  return results;
}

// Legacy Cherry builds used cherry:// internal URLs; accept them as aliases.
function normalizeInternalURL(url) {
  return typeof url === 'string' ? url.replace(/^cherry:\/\//i, 'elysium://') : url;
}

function resolveAddress(input, engine = 'google') {
  const raw = String(input ?? '').trim().slice(0, 8192);
  if (!raw) return 'elysium://home';
  const value = normalizeInternalURL(raw);
  if (INTERNAL_PAGES.some(page => value === `elysium://${page}`)) return value;
  // Recognize host:port before rejecting explicit non-web schemes.
  const hostLike = /^(localhost|\[[0-9a-f:]+\]|(?:[^\s./:]+\.)+[^\s./:]+)(:\d+)?([/?#].*)?$/i.test(value);
  if (hostLike) {
    const protocol = /^(localhost|127\.0\.0\.1|\[::1\])(?=[:/?#]|$)/i.test(value) ? 'http' : 'https';
    try { return new URL(`${protocol}://${value}`).href; } catch { /* Search invalid hosts. */ }
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) {
    if (!isWebURL(value)) throw new Error('รองรับเฉพาะที่อยู่ http:// และ https://');
    return new URL(value).href;
  }
  return (Object.hasOwn(SEARCH_ENGINES, engine) ? SEARCH_ENGINES[engine] : SEARCH_ENGINES.google) + encodeURIComponent(value);
}

function defaults() {
  return {
    schemaVersion: SCHEMA_VERSION, calendarEvents: [], bookmarks: [], history: [], savedTabs: [], sessionTabs: [], downloads: [], zoomLevels: {},
    workspaces: [{ id: 'personal', name: 'Personal', color: '#2f6bff' }], activeWorkspace: 'personal', notes: [], postIts: [], reminders: [], todos: [],
    settings: { searchEngine: 'google', restoreTabs: true, compactSidebar: false, memorySaver: false, suspendMinutes: 20, memoryExceptions: [], autoUpdate: true, privacy: sanitizePrivacy(), chromeHosts: [],
      theme: { variant: 'midnight', character: 'cherry', background: 'city', graphics: true, motion: true, glow: 45, art: 100 },
      ai: { provider: 'none', endpoint: '', model: '' }, weather: { provider: 'none', city: '', latitude: null, longitude: null } },
    permissions: {}, secrets: {},
    shortcuts: [
      { id: 'google', title: 'Google', url: 'https://www.google.com/' },
      { id: 'youtube', title: 'YouTube', url: 'https://www.youtube.com/' },
      { id: 'github', title: 'GitHub', url: 'https://github.com/' },
      { id: 'figma', title: 'Figma', url: 'https://www.figma.com/' },
      { id: 'notion', title: 'Notion', url: 'https://www.notion.so/' },
      { id: 'chatgpt', title: 'ChatGPT', url: 'https://chatgpt.com/' },
    ],
  };
}

class BrowserStore {
  constructor(directory) {
    this.directory = directory;
    this.file = path.join(directory, 'elysium-data.json');
    this.legacyFile = path.join(directory, 'cherry-data.json');
    this.data = defaults();
    this.writeError = null;
    try {
      let saved;
      let sourceFile = this.file;
      try {
        saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      } catch (error) {
        // First run after the Cherry → elysium-browser rename reads the legacy file.
        if (error.code !== 'ENOENT' || !fs.existsSync(this.legacyFile)) throw error;
        sourceFile = this.legacyFile;
        saved = JSON.parse(fs.readFileSync(this.legacyFile, 'utf8'));
      }
      if (saved.schemaVersion > SCHEMA_VERSION) { this.readOnly = true; throw new Error('Newer profile schema'); }
      if (!saved.schemaVersion || saved.schemaVersion < SCHEMA_VERSION) {
        const backup = `${this.file}.before-schema-${SCHEMA_VERSION}`;
        if (!fs.existsSync(backup)) fs.copyFileSync(sourceFile, backup);
      }
      if (!saved.schemaVersion || saved.schemaVersion < 2) {
        const backup = `${this.file}.before-schema-2`;
        if (!fs.existsSync(backup)) fs.copyFileSync(sourceFile, backup);
      }
      if (!saved.schemaVersion || saved.schemaVersion < 3) {
        const backup = `${this.file}.before-schema-3`;
        if (!fs.existsSync(backup)) fs.copyFileSync(sourceFile, backup);
      }
      if (Array.isArray(saved.downloads)) {
        const ids = new Set();
        // Persist only finished, non-private records; live items resume from scratch.
        for (const d of saved.downloads) {
          if (!d || typeof d.id !== 'string' || !d.id || ids.has(d.id)) continue;
          if (d.private || !FINISHED_DOWNLOAD_STATES.includes(d.state) || !isWebURL(d.url)) continue;
          this.data.downloads.push({
            id: d.id,
            filename: String(d.filename || 'ไฟล์').slice(0, 300),
            url: d.url,
            path: String(d.path || '').slice(0, 2048),
            received: Number.isFinite(d.received) ? Math.max(0, d.received) : 0,
            total: Number.isFinite(d.total) ? Math.max(0, d.total) : 0,
            state: d.state,
            createdAt: Number(d.createdAt) || Date.now(),
          });
          ids.add(d.id);
          if (this.data.downloads.length >= 200) break;
        }
      }
      for (const field of ['bookmarks', 'history']) {
        if (Array.isArray(saved[field])) this.data[field] = saved[field].filter(item => item && typeof item.id === 'string' && typeof item.title === 'string' && isWebURL(item.url)).slice(0, 2000);
      }
      if (saved.settings && Object.hasOwn(SEARCH_ENGINES, saved.settings.searchEngine)) this.data.settings.searchEngine = saved.settings.searchEngine;
      if (typeof saved.settings?.restoreTabs === 'boolean') this.data.settings.restoreTabs = saved.settings.restoreTabs;
      if (Array.isArray(saved.savedTabs)) this.data.savedTabs = saved.savedTabs.filter(isWebURL).slice(0, 30);
      for (const key of ['compactSidebar', 'memorySaver']) if (typeof saved.settings?.[key] === 'boolean') this.data.settings[key] = saved.settings[key];
      if (Number.isFinite(saved.settings?.suspendMinutes)) this.data.settings.suspendMinutes = Math.max(5, Math.min(240, saved.settings.suspendMinutes));
      if (Array.isArray(saved.settings?.memoryExceptions)) this.data.settings.memoryExceptions = saved.settings.memoryExceptions.filter(x => typeof x === 'string').slice(0, 200);
      if (typeof saved.settings?.autoUpdate === 'boolean') this.data.settings.autoUpdate = saved.settings.autoUpdate;
      this.data.settings.privacy = sanitizePrivacy(saved.settings?.privacy);
      this.data.settings.chromeHosts = sanitizeChromeHosts(saved.settings?.chromeHosts);
      if (saved.zoomLevels && typeof saved.zoomLevels === 'object') {
        for (const [host, level] of Object.entries(saved.zoomLevels).slice(0, 500)) {
          if (typeof host === 'string' && host && Number.isFinite(Number(level))) {
            const clamped = Math.max(-5, Math.min(5, Number(level)));
            if (clamped !== 0) this.data.zoomLevels[host.slice(0, 253)] = clamped;
          }
          if (Object.keys(this.data.zoomLevels).length >= 200) break;
        }
      }
      const theme = saved.settings?.theme;
      if (theme && typeof theme === 'object') this.data.settings.theme = sanitizeTheme(theme);
      if (saved.settings?.ai && ['none', 'ollama', 'openai-compatible', 'oauth-openai-compatible'].includes(saved.settings.ai.provider)) {
        const ai = saved.settings.ai;
        this.data.settings.ai = {
          provider: ai.provider,
          endpoint: String(ai.endpoint || '').slice(0, 2048),
          model: String(ai.model || '').slice(0, 200),
          ...(ai.provider === 'oauth-openai-compatible' ? {
            oauthAuthorizationEndpoint: String(ai.oauthAuthorizationEndpoint || '').slice(0, 2048),
            oauthTokenEndpoint: String(ai.oauthTokenEndpoint || '').slice(0, 2048),
            oauthClientId: String(ai.oauthClientId || '').slice(0, 500),
            oauthScopes: String(ai.oauthScopes || '').slice(0, 2000),
          } : {}),
        };
      }
      if (saved.settings?.weather?.provider === 'open-meteo') this.data.settings.weather = { ...this.data.settings.weather, ...saved.settings.weather };
      if (Array.isArray(saved.workspaces)) {
        const valid = saved.workspaces.filter(w => w && typeof w.id === 'string' && typeof w.name === 'string').slice(0, 30);
        if (valid.length) this.data.workspaces = valid.map(w => ({ id: w.id, name: w.name.slice(0, 60), color: /^#[0-9a-f]{6}$/i.test(w.color) ? w.color : '#2f6bff' }));
      }
      if (this.data.workspaces.some(w => w.id === saved.activeWorkspace)) this.data.activeWorkspace = saved.activeWorkspace;
      const validWorkspace = id => this.data.workspaces.some(w => w.id === id) ? id : this.data.workspaces[0].id;
      if (Array.isArray(saved.sessionTabs)) this.data.sessionTabs = saved.sessionTabs.map(t => t && typeof t.url === 'string' ? { ...t, url: normalizeInternalURL(t.url) } : t).filter(t => t && !t.private && (isWebURL(t.url) || INTERNAL_PAGES.some(p => t.url === `elysium://${p}`))).slice(0, 200).map(t => ({ id: typeof t.id === 'string' ? t.id : randomUUID(), url: t.url, title: String(t.title || t.url).slice(0, 300), workspaceId: validWorkspace(t.workspaceId), pinned: !!t.pinned, autoSuspend: !!t.autoSuspend }));
      else this.data.sessionTabs = this.data.savedTabs.map(url => ({ id: randomUUID(), url, title: url, workspaceId: this.data.activeWorkspace, pinned: false }));
      if (Array.isArray(saved.notes)) this.data.notes = saved.notes.filter(n => n && typeof n.id === 'string' && typeof n.body === 'string').slice(0, 1000).map(n => ({ id: n.id, title: String(n.title || 'โน้ต').slice(0, 200), body: n.body.slice(0, 100000), sourceURL: isWebURL(n.sourceURL) ? n.sourceURL : '', updatedAt: Number(n.updatedAt) || Date.now() }));
      if (Array.isArray(saved.postIts)) this.data.postIts = saved.postIts.filter(n => n && typeof n.id === 'string' && typeof n.body === 'string').slice(0, 300).map(n => ({
        id: n.id,
        title: String(n.title || '').slice(0, 120),
        body: n.body.slice(0, 4000),
        color: POST_IT_COLORS.includes(n.color) ? n.color : 'yellow',
        pinned: !!n.pinned,
        createdAt: Number(n.createdAt) || Number(n.updatedAt) || Date.now(),
        updatedAt: Number(n.updatedAt) || Date.now(),
      }));
      if (Array.isArray(saved.reminders)) this.data.reminders = saved.reminders.filter(r => r && typeof r.id === 'string' && typeof r.title === 'string' && Number.isFinite(Number(r.dueAt))).slice(0, 500).map(r => ({
        id: r.id,
        title: r.title.slice(0, 200),
        details: String(r.details || '').slice(0, 2000),
        dueAt: Number(r.dueAt),
        done: !!r.done,
        notifiedAt: Number(r.notifiedAt) || 0,
        createdAt: Number(r.createdAt) || Date.now(),
        updatedAt: Number(r.updatedAt) || Date.now(),
      }));
      if (Array.isArray(saved.calendarEvents)) {
        const ids = new Set();
        for (const event of saved.calendarEvents.slice(0, 2000)) {
          if (!event || typeof event.id !== 'string' || !event.id || ids.has(event.id)) continue;
          try {
            this.data.calendarEvents.push({ ...normalizeEvent(event), id: event.id,
              createdAt: Number(event.createdAt) || Date.now(), updatedAt: Number(event.updatedAt) || Date.now(),
              notifiedAt: Number.isFinite(event.notifiedAt) && event.notifiedAt > 0 ? event.notifiedAt : 0 });
            ids.add(event.id);
          } catch { /* Ignore invalid calendar records without discarding the profile. */ }
        }
      }
      if (Array.isArray(saved.todos)) this.data.todos = saved.todos.filter(t => t && typeof t.id === 'string' && typeof t.text === 'string').slice(0, 100).map(t => ({ id: t.id, text: t.text.slice(0, 300), done: !!t.done }));
      if (Array.isArray(saved.shortcuts)) this.data.shortcuts = saved.shortcuts.filter(s => s && typeof s.id === 'string' && isWebURL(s.url)).slice(0, 12).map(s => ({ id: s.id, title: String(s.title || s.url).slice(0, 50), url: s.url }));
      if (saved.permissions && typeof saved.permissions === 'object') this.data.permissions = saved.permissions;
      if (typeof saved.secrets?.aiKey === 'string') this.data.secrets.aiKey = saved.secrets.aiKey;
      if (typeof saved.secrets?.aiOAuth === 'string') this.data.secrets.aiOAuth = saved.secrets.aiOAuth;
      if (typeof saved.customBackground === 'string') this.data.customBackground = path.basename(saved.customBackground);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        // Preserve a damaged file before a future save replaces it.
        try { fs.copyFileSync(this.file, `${this.file}.backup-${Date.now()}`); } catch { /* Report write failures on save. */ }
      }
    }
  }

  save() {
    if (this.readOnly) { this.writeError = 'โปรไฟล์นี้สร้างโดย elysium-browser รุ่นใหม่กว่า กรุณาใช้แอปรุ่นเดิม'; return; }
    try {
      fs.mkdirSync(this.directory, { recursive: true });
      fs.writeFileSync(`${this.file}.tmp`, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(`${this.file}.tmp`, this.file);
      this.writeError = null;
    } catch {
      this.writeError = 'บันทึกข้อมูลไม่สำเร็จ กรุณาตรวจสอบพื้นที่ว่างและสิทธิ์เข้าถึงโฟลเดอร์';
    }
  }

  visit(url, title) {
    if (!isWebURL(url)) return;
    const latest = this.data.history[0];
    if (latest?.url === url && Date.now() - latest.visitedAt < 5000) {
      latest.title = title || url;
      latest.visitedAt = Date.now();
    } else {
      this.data.history.unshift({ id: randomUUID(), url, title: title || url, visitedAt: Date.now() });
      this.data.history = this.data.history.slice(0, 2000);
    }
    this.save();
  }

  toggleBookmark(url, title) {
    if (!isWebURL(url)) return false;
    const index = this.data.bookmarks.findIndex(item => item.url === url);
    if (index >= 0) this.data.bookmarks.splice(index, 1);
    else this.data.bookmarks.unshift({ id: randomUUID(), url, title: title || url, createdAt: Date.now() });
    this.save();
    return index < 0;
  }
}

function sanitizeTheme(input) {
  const base = { variant: 'midnight', character: 'cherry', background: 'city', graphics: true, motion: true, glow: 45, art: 100 };
  const generated = ['rose', 'aurora', 'solar', 'crimson', 'emerald', 'cosmic', 'aqua', 'lunar', 'silver', ...NOVEL_THEME_IDS];
  for (const [key, values] of Object.entries({ variant: ['midnight', 'violet', 'slate', ...generated], character: ['cherry', 'violet', 'ghost', 'nova'], background: ['city', 'team', 'custom', ...generated] })) if (values.includes(input[key])) base[key] = input[key];
  for (const key of ['graphics', 'motion']) if (typeof input[key] === 'boolean') base[key] = input[key];
  for (const key of ['glow', 'art']) if (Number.isFinite(input[key])) base[key] = Math.max(0, Math.min(100, input[key]));
  return base;
}

function computeLayout(width, height, { compact = false, panel = false, split = false, ratio = 0.5 } = {}) {
  const sidebar = compact ? 72 : width <= 1366 ? 208 : 236;
  const panelWidth = panel ? (width <= 1366 ? 300 : 328) : 0;
  const top = 96;
  const area = { x: sidebar, y: top, width: Math.max(0, width - sidebar - panelWidth), height: Math.max(0, height - top) };
  const divider = split ? 8 : 0;
  const splitHeader = split ? 32 : 0;
  const leftWidth = split ? Math.round((area.width - divider) * Math.max(0.25, Math.min(0.75, ratio))) : area.width;
  return { sidebar, panelWidth, area, left: { ...area, y: top + splitHeader, height: Math.max(0, area.height - splitHeader), width: leftWidth }, right: { x: sidebar + leftWidth + divider, y: top + splitHeader, width: Math.max(0, area.width - leftWidth - divider), height: Math.max(0, area.height - splitHeader) }, dividerX: sidebar + leftWidth };
}

module.exports = { BrowserStore, resolveAddress, isWebURL, hostnameOf, zoomPercent, rememberZoom, sanitizePrivacy, sanitizeChromeHosts, stockChromeUA, hintBrands, buildCompatShim, isChromeModeRequest, shouldAutoChromeMode, parseBookmarksHTML, normalizeInternalURL, INTERNAL_PAGES, SEARCH_ENGINES, POST_IT_COLORS, SCHEMA_VERSION, FINISHED_DOWNLOAD_STATES, filterExistingDownloads, sanitizeTheme, computeLayout };
