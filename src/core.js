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

function isWebURL(value) {
  try { return ['https:', 'http:'].includes(new URL(value).protocol); }
  catch { return false; }
}

function resolveAddress(input, engine = 'google') {
  const value = String(input ?? '').trim().slice(0, 8192);
  if (!value) return 'cherry://home';
  if (INTERNAL_PAGES.some(page => value === `cherry://${page}`)) return value;
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
    schemaVersion: SCHEMA_VERSION, calendarEvents: [], bookmarks: [], history: [], savedTabs: [], sessionTabs: [], downloads: [],
    workspaces: [{ id: 'personal', name: 'Personal', color: '#2f6bff' }], activeWorkspace: 'personal', notes: [], postIts: [], reminders: [], todos: [],
    settings: { searchEngine: 'google', restoreTabs: true, compactSidebar: false, memorySaver: false, suspendMinutes: 20, memoryExceptions: [], autoUpdate: true,
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
    this.file = path.join(directory, 'cherry-data.json');
    this.data = defaults();
    this.writeError = null;
    try {
      const saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (saved.schemaVersion > SCHEMA_VERSION) { this.readOnly = true; throw new Error('Newer profile schema'); }
      if (!saved.schemaVersion || saved.schemaVersion < SCHEMA_VERSION) {
        const backup = `${this.file}.before-schema-${SCHEMA_VERSION}`;
        if (!fs.existsSync(backup)) fs.copyFileSync(this.file, backup);
      }
      if (!saved.schemaVersion || saved.schemaVersion < 2) {
        const backup = `${this.file}.before-schema-2`;
        if (!fs.existsSync(backup)) fs.copyFileSync(this.file, backup);
      }
      if (!saved.schemaVersion || saved.schemaVersion < 3) {
        const backup = `${this.file}.before-schema-3`;
        if (!fs.existsSync(backup)) fs.copyFileSync(this.file, backup);
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
      if (Array.isArray(saved.sessionTabs)) this.data.sessionTabs = saved.sessionTabs.filter(t => t && !t.private && (isWebURL(t.url) || INTERNAL_PAGES.some(p => t.url === `cherry://${p}`))).slice(0, 200).map(t => ({ id: typeof t.id === 'string' ? t.id : randomUUID(), url: t.url, title: String(t.title || t.url).slice(0, 300), workspaceId: validWorkspace(t.workspaceId), pinned: !!t.pinned, autoSuspend: !!t.autoSuspend }));
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
    if (this.readOnly) { this.writeError = 'โปรไฟล์นี้สร้างโดย Cherry รุ่นใหม่กว่า กรุณาใช้แอปรุ่นเดิม'; return; }
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

module.exports = { BrowserStore, resolveAddress, isWebURL, INTERNAL_PAGES, SEARCH_ENGINES, POST_IT_COLORS, SCHEMA_VERSION, FINISHED_DOWNLOAD_STATES, sanitizeTheme, computeLayout };
