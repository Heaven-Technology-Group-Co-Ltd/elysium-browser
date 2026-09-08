const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { resolveAddress, isWebURL, BrowserStore } = require('../src/core');
const { computeLayout, sanitizeTheme, filterExistingDownloads } = require('../src/core');
const { hostnameOf, zoomPercent, rememberZoom, sanitizePrivacy, parseBookmarksHTML } = require('../src/core');
const { sanitizeChromeHosts, stockChromeUA, hintBrands } = require('../src/core');
const { buildCompatShim } = require('../src/core');
const { isChromeModeRequest } = require('../src/core');
const { shouldAutoChromeMode } = require('../src/core');
const { providerURL } = require('../src/providers');
const { createOAuthAttempt, normalizeToken, oauthFingerprint, safeStateEqual, secureOAuthURL } = require('../src/oauth');

function removeTestDirectory(directory) {
  const resolved = path.resolve(directory);
  assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
  assert.ok(path.basename(resolved).startsWith('elysium-core-'));
  fs.rmSync(resolved, { recursive: true, force: true });
}

test('resolves web addresses, local servers, international domains and Thai queries', () => {
  assert.equal(resolveAddress(' example.com/docs '), 'https://example.com/docs');
  assert.equal(resolveAddress('localhost:3000/path'), 'http://localhost:3000/path');
  assert.equal(resolveAddress('127.0.0.1:8123'), 'http://127.0.0.1:8123/');
  assert.equal(resolveAddress('[::1]:3000'), 'http://[::1]:3000/');
  assert.equal(resolveAddress('https://example.com/a?q=b#c'), 'https://example.com/a?q=b#c');
  assert.equal(resolveAddress('แมวน่ารัก', 'duckduckgo'), `https://duckduckgo.com/?q=${encodeURIComponent('แมวน่ารัก')}`);
  assert.match(resolveAddress('ไทย.ไทย'), /^https:\/\/xn--/);
  assert.equal(resolveAddress(''), 'elysium://home');
  assert.equal(resolveAddress('elysium://history'), 'elysium://history');
  assert.equal(resolveAddress('cherry://calendar'), 'elysium://calendar');
});

test('rejects executable and local-file schemes', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///C:/secret', 'ftp://example.com', 'elysium://invalid', 'vbscript:test']) {
    assert.throws(() => resolveAddress(url));
    assert.equal(isWebURL(url), false);
  }
});

test('bookmarks, settings and history persist across restarts; recent duplicate visits merge', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'elysium-core-'));
  t.after(() => removeTestDirectory(directory));
  const store = new BrowserStore(directory);
  assert.equal(store.toggleBookmark('https://example.com/', 'ตัวอย่าง'), true);
  store.visit('https://example.com/', 'Loading');
  store.visit('https://example.com/', 'ตัวอย่าง');
  store.data.settings.searchEngine = 'bing';
  store.save();
  const restored = new BrowserStore(directory);
  assert.equal(restored.data.bookmarks[0].title, 'ตัวอย่าง');
  assert.equal(restored.data.history.length, 1);
  assert.equal(restored.data.history[0].title, 'ตัวอย่าง');
  assert.equal(restored.data.settings.searchEngine, 'bing');
  assert.equal(restored.toggleBookmark('https://example.com/', 'ตัวอย่าง'), false);
  assert.equal(new BrowserStore(directory).data.bookmarks.length, 0);
});

test('invalid saved data is sanitized and corrupt files are preserved', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'elysium-core-'));
  t.after(() => removeTestDirectory(directory));
  fs.writeFileSync(path.join(directory, 'elysium-data.json'), JSON.stringify({ bookmarks: [null, { id: 'bad', url: 'javascript:test', title: 'bad' }], savedTabs: ['file:///secret', 'https://example.com/'], settings: { searchEngine: 'invalid' } }));
  const sanitized = new BrowserStore(directory);
  assert.deepEqual(sanitized.data.bookmarks, []);
  assert.deepEqual(sanitized.data.savedTabs, ['https://example.com/']);
  assert.equal(sanitized.data.settings.searchEngine, 'google');
  fs.writeFileSync(path.join(directory, 'elysium-data.json'), '{broken');
  assert.deepEqual(new BrowserStore(directory).data.history, []);
  assert.ok(fs.readdirSync(directory).some(name => name.includes('.backup-')));
});

test('schema migration preserves old profile, bookmarks and sessions without private tabs', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'elysium-core-'));
  t.after(() => removeTestDirectory(directory));
  const file = path.join(directory, 'elysium-data.json');
  const old = JSON.stringify({schemaVersion:4,bookmarks:[{id:'b',title:'เดิม',url:'https://example.com/',folder:'Reading'}],savedTabs:['https://example.com/'],settings:{restoreTabs:false,searchEngine:'bing'}});
  fs.writeFileSync(file,old);
  const migrated = new BrowserStore(directory);
  assert.equal(fs.readFileSync(`${file}.before-schema-5`,'utf8'),old);
  assert.equal(migrated.data.schemaVersion,5);
  assert.deepEqual(migrated.data.downloads,[]);
  assert.equal(migrated.data.sessionTabs[0].url,'https://example.com/');
  assert.equal(migrated.data.settings.restoreTabs,false);
  assert.equal(migrated.data.bookmarks[0].folder,'Reading');
  migrated.data.sessionTabs.push({id:'p',url:'https://private.example/',private:true});
  migrated.save();assert.equal(new BrowserStore(directory).data.sessionTabs.length,1);
  const future=JSON.stringify({schemaVersion:999,bookmarks:[]});fs.writeFileSync(file,future);
  const unknown=new BrowserStore(directory);unknown.save();assert.equal(fs.readFileSync(file,'utf8'),future);assert.ok(unknown.writeError);
});

test('legacy Cherry profile file is adopted and saved under the new name', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'elysium-core-'));
  t.after(() => removeTestDirectory(directory));
  fs.writeFileSync(path.join(directory, 'cherry-data.json'), JSON.stringify({ schemaVersion: 5, bookmarks: [{ id: 'b', title: 'เดิม', url: 'https://example.com/' }], sessionTabs: [{ id: 's', title: 'เก่า', url: 'cherry://calendar', workspaceId: 'personal' }] }));
  const store = new BrowserStore(directory);
  assert.equal(store.data.bookmarks[0].title, 'เดิม');
  assert.equal(store.data.sessionTabs[0].url, 'elysium://calendar');
  store.save();
  assert.ok(fs.existsSync(path.join(directory, 'elysium-data.json')));
});

test('finished non-private downloads persist across restarts and unsafe records are dropped', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'elysium-core-'));
  t.after(() => removeTestDirectory(directory));
  const file = path.join(directory, 'elysium-data.json');
  fs.writeFileSync(file, JSON.stringify({ schemaVersion: 5, downloads: [
    { id: 'done-1', filename: 'report.pdf', url: 'https://example.com/report.pdf', path: 'C:/dl/report.pdf', received: 100, total: 100, state: 'completed', createdAt: 1 },
    { id: 'bad-url', filename: 'x', url: 'javascript:evil', path: '', state: 'completed', createdAt: 1 },
    { id: 'private-1', filename: 'secret.zip', url: 'https://example.com/secret.zip', path: '', private: true, state: 'completed', createdAt: 1 },
    { id: 'live-1', filename: 'half.bin', url: 'https://example.com/half.bin', path: '', state: 'progressing', createdAt: 1 },
    { id: 'done-1', filename: 'dup.pdf', url: 'https://example.com/dup.pdf', path: '', state: 'completed', createdAt: 1 },
    null,
  ] }));
  const restored = new BrowserStore(directory);
  assert.deepEqual(restored.data.downloads.map(d => d.id), ['done-1']);
  assert.equal(restored.data.downloads[0].path, 'C:/dl/report.pdf');
  restored.save();
  assert.deepEqual(new BrowserStore(directory).data.downloads.map(d => d.id), ['done-1']);
});

test('download records with missing files are dropped so the list mirrors the filesystem', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'elysium-core-'));
  t.after(() => removeTestDirectory(directory));
  const kept = path.join(directory, 'kept.bin');
  fs.writeFileSync(kept, 'data');
  const records = [
    { id: 'kept', filename: 'kept.bin', path: kept },
    { id: 'gone', filename: 'gone.bin', path: path.join(directory, 'gone.bin') },
    { id: 'no-path', filename: 'x.bin', path: '' },
    null,
  ];
  assert.deepEqual(filterExistingDownloads(records).map(d => d.id), ['kept']);
  fs.rmSync(kept);
  assert.deepEqual(filterExistingDownloads(records), []);
  assert.deepEqual(filterExistingDownloads(null), []);
});

test('post-its and reminders persist across restarts and sanitize unsafe fields', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'elysium-core-'));
  t.after(() => removeTestDirectory(directory));
  const store = new BrowserStore(directory);
  const dueAt = Date.now() + 60000;
  store.data.postIts.push({id:'post-1',title:'จำไว้',body:'ข้อความบนบอร์ด',color:'pink',pinned:true,createdAt:1,updatedAt:2});
  store.data.reminders.push({id:'reminder-1',title:'ส่งงาน',details:'ก่อนประชุม',dueAt,done:false,notifiedAt:0,createdAt:1,updatedAt:2});
  store.save();
  const restored = new BrowserStore(directory);
  assert.deepEqual(restored.data.postIts[0],{id:'post-1',title:'จำไว้',body:'ข้อความบนบอร์ด',color:'pink',pinned:true,createdAt:1,updatedAt:2});
  assert.deepEqual(restored.data.reminders[0],{id:'reminder-1',title:'ส่งงาน',details:'ก่อนประชุม',dueAt,done:false,notifiedAt:0,createdAt:1,updatedAt:2});

  const file = path.join(directory, 'elysium-data.json');
  fs.writeFileSync(file,JSON.stringify({schemaVersion:3,postIts:[{id:'post-2',title:'x',body:'y',color:'<script>'}],reminders:[{id:'bad',title:'bad',dueAt:'not-a-date'}]}));
  const sanitized = new BrowserStore(directory);
  assert.equal(sanitized.data.postIts[0].color,'yellow');
  assert.deepEqual(sanitized.data.reminders,[]);
});

test('native split bounds never overlap chrome, divider or panel at all requested sizes', () => {
  for(const [width,height] of [[1920,1080],[1672,941],[1440,900],[1366,768],[1024,768]])
    for(const compact of [false,true])for(const panel of [false,true])for(const ratio of [.25,.5,.75]){
      const b=computeLayout(width,height,{compact,panel,split:true,ratio});
      assert.equal(b.left.x,b.sidebar);assert.equal(b.left.y,128);
      assert.equal(b.right.x,b.left.x+b.left.width+8);
      assert.equal(b.right.x+b.right.width,width-b.panelWidth);
      assert.equal(b.left.y+b.left.height,height);assert.ok(b.left.width>0&&b.right.width>0);
    }
  assert.equal(computeLayout(1024,768,{compact:false}).sidebar,208);
  assert.equal(computeLayout(1440,900,{compact:false}).sidebar,236);
});

test('provider endpoints cannot expose credentials over remote HTTP or redirects through URL auth', () => {
  assert.equal(providerURL('http://127.0.0.1:11434','/api/chat'),'http://127.0.0.1:11434/api/chat');
  assert.equal(providerURL('https://api.example/v1/','/models'),'https://api.example/v1/models');
  for(const endpoint of ['http://api.example','file:///tmp','javascript:test','https://user:secret@example.com'])assert.throws(()=>providerURL(endpoint,''));
  assert.deepEqual(sanitizeTheme({variant:'<script>',character:'fruit',glow:10000,art:-5,graphics:false}),{variant:'midnight',character:'cherry',background:'city',graphics:false,motion:true,glow:100,art:0});
  assert.deepEqual(sanitizeTheme({variant:'rose',background:'rose',character:'nova'}),{variant:'rose',character:'nova',background:'rose',graphics:true,motion:true,glow:45,art:100});
});

test('OAuth uses authorization-code PKCE, loopback callbacks and safe endpoints', () => {
  const config = {
    provider: 'oauth-openai-compatible', endpoint: 'https://ai.example/v1',
    oauthAuthorizationEndpoint: 'https://login.example/authorize', oauthTokenEndpoint: 'https://login.example/token',
    oauthClientId: 'elysium-public-client', oauthScopes: 'openid  profile offline_access',
  };
  const attempt = createOAuthAttempt(config, 'http://127.0.0.1:49152/oauth/callback');
  const authorize = new URL(attempt.authorizationURL);
  assert.equal(authorize.searchParams.get('response_type'), 'code');
  assert.equal(authorize.searchParams.get('client_id'), 'elysium-public-client');
  assert.equal(authorize.searchParams.get('code_challenge_method'), 'S256');
  assert.match(authorize.searchParams.get('code_challenge'), /^[A-Za-z0-9_-]{43}$/);
  assert.equal(authorize.searchParams.get('scope'), 'openid profile offline_access');
  assert.equal(attempt.codeVerifier.includes('='), false);
  assert.equal(safeStateEqual(attempt.state, attempt.state), true);
  assert.equal(safeStateEqual(attempt.state, `${attempt.state}x`), false);
  assert.equal(oauthFingerprint(config), oauthFingerprint({ ...config, model: 'another-model' }));
  assert.notEqual(oauthFingerprint(config), oauthFingerprint({ ...config, endpoint: 'https://other.example/v1' }));
  assert.equal(secureOAuthURL('http://localhost:9000/token', 'Token').hostname, 'localhost');
  for (const endpoint of ['http://login.example/token', 'file:///token', 'https://name:password@login.example/token']) assert.throws(() => secureOAuthURL(endpoint, 'Token'));
  assert.throws(() => createOAuthAttempt(config, 'https://app.example/oauth/callback'));
});

test('OAuth token normalization preserves refresh tokens without exposing provider formats', () => {
  const token = normalizeToken({ access_token: 'access', refresh_token: 'refresh', token_type: 'bearer', expires_in: 3600, scope: 'openid' });
  assert.equal(token.accessToken, 'access');
  assert.equal(token.refreshToken, 'refresh');
  assert.ok(token.expiresAt > Date.now());
  assert.equal(normalizeToken({ access_token: 'new', expires_in: 120 }, 'old-refresh').refreshToken, 'old-refresh');
  assert.throws(() => normalizeToken({ access_token: 'access', token_type: 'mac' }));
  assert.throws(() => normalizeToken({ token_type: 'bearer' }));
});

test('per-site zoom helpers map hosts, clamp levels and format percents', t => {
  assert.equal(hostnameOf('https://Mail.Example.com/inbox'), 'mail.example.com');
  assert.equal(hostnameOf('http://localhost:3000/x'), 'localhost');
  assert.equal(hostnameOf('elysium://settings'), '');
  assert.equal(hostnameOf('not a url'), '');
  assert.equal(zoomPercent(0), 100);
  assert.equal(zoomPercent(1), 120);
  assert.equal(zoomPercent(-1), 83);
  assert.equal(zoomPercent(99), zoomPercent(5));
  assert.equal(zoomPercent(NaN), 100);
  const levels = rememberZoom({}, 'example.com', 1);
  assert.deepEqual(levels, { 'example.com': 1 });
  rememberZoom(levels, 'example.com', 0);
  assert.deepEqual(levels, {});
  rememberZoom(levels, 'example.com', 99);
  assert.equal(levels['example.com'], 5);
  assert.equal(rememberZoom(null, 'example.com', 1)['example.com'], 1);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'elysium-core-'));
  t.after(() => removeTestDirectory(directory));
  const store = new BrowserStore(directory);
  assert.deepEqual(store.data.zoomLevels, {});
  assert.deepEqual(store.data.settings.privacy, { dnt: true, gpc: true, clearHistory: false, clearCookies: false, clearCache: false });
  store.data.zoomLevels = rememberZoom(store.data.zoomLevels, 'example.com', -1);
  store.data.settings.privacy.clearHistory = true;
  store.save();
  const restored = new BrowserStore(directory);
  assert.equal(restored.data.zoomLevels['example.com'], -1);
  assert.equal(restored.data.settings.privacy.clearHistory, true);
  assert.equal(restored.data.settings.privacy.dnt, true);
});

test('privacy settings sanitize unknown or hostile stored values', () => {
  assert.deepEqual(sanitizePrivacy(null), { dnt: true, gpc: true, clearHistory: false, clearCookies: false, clearCache: false });
  assert.deepEqual(sanitizePrivacy({ dnt: false, gpc: 'yes', clearCookies: 1, extra: true }), { dnt: false, gpc: true, clearHistory: false, clearCookies: false, clearCache: false });
});

test('bookmark import parses Netscape HTML exports with folders', () => {
  const html = '<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>'
    + '<DT><H3 ADD_DATE="1">งาน</H3><DL><p>'
    + '<DT><A HREF="https://example.com/docs" ADD_DATE="1">คู่มือ</A>'
    + "<DT><A HREF='https://mail.example.com/'>เมล</A>"
    + '</DL><p>'
    + '<DT><A HREF="https://plain.example/">ไม่มีโฟลเดอร์</A>'
    + '<DT><A HREF="javascript:alert(1)">สคริปต์</A>'
    + '<DT><A>ไม่มีลิงก์</A>';
  const parsed = parseBookmarksHTML(html);
  assert.equal(parsed.length, 3);
  assert.deepEqual(parsed[0], { title: 'คู่มือ', url: 'https://example.com/docs', folder: 'งาน' });
  assert.deepEqual(parsed[1], { title: 'เมล', url: 'https://mail.example.com/', folder: 'งาน' });
  assert.deepEqual(parsed[2], { title: 'ไม่มีโฟลเดอร์', url: 'https://plain.example/', folder: '' });
  assert.deepEqual(parseBookmarksHTML(''), []);
  assert.deepEqual(parseBookmarksHTML(null), []);
  const entities = parseBookmarksHTML('<DL><p><DT><A HREF="https://example.com/?a=1&amp;b=2">Fish &amp; Chips</A>');
  assert.equal(entities[0].title, 'Fish & Chips');
  assert.equal(entities[0].url, 'https://example.com/?a=1&b=2');
});

test('compat mode builds stock Chrome UA and consistent client-hint brands', t => {
  const ua = stockChromeUA('152.0.7977.76');
  assert.equal(ua, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.7977.76 Safari/537.36');
  assert.ok(!ua.includes('elysium'));
  assert.equal(hintBrands({ chromeMode: true, chromeMajor: '152' }), '"Google Chrome";v="152", "Chromium";v="152", "Not/A)Brand";v="99"');
  assert.equal(hintBrands({ chromeMajor: '152.0.1', appMajor: '1' }), '"elysium-browser";v="1", "Chromium";v="152", "Not/A)Brand";v="99"');
  assert.deepEqual(sanitizeChromeHosts(['Example.COM', 'bad host!', 'example.com', 42]), ['example.com']);
  assert.equal(sanitizeChromeHosts(['a'.repeat(300)])[0].length, 253);
  assert.deepEqual(sanitizeChromeHosts('nope'), []);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'elysium-core-'));
  t.after(() => removeTestDirectory(directory));
  const store = new BrowserStore(directory);
  assert.deepEqual(store.data.settings.chromeHosts, []);
  store.data.settings.chromeHosts = sanitizeChromeHosts(['bank.example']);
  store.save();
  assert.deepEqual(new BrowserStore(directory).data.settings.chromeHosts, ['bank.example']);
});

test('compat shim reports stock Chrome identity to page scripts', async () => {
  const vm = require('node:vm');
  const ua = stockChromeUA('152.0.7977.76');
  const script = buildCompatShim({ userAgent: ua, chromeVersion: '152.0.7977.76' });
  assert.ok(script.includes('Google Chrome') && script.includes('getHighEntropyValues'));
  // Run the shim inside an isolated VM context with a fake navigator:
  const context = vm.createContext({ navigator: { userAgent: 'elysium', userAgentData: { brands: [] } } });
  vm.runInContext(script, context, { timeout: 1000 });
  const check = await vm.runInContext(`(async () => JSON.stringify({
    ua: navigator.userAgent,
    brands: navigator.userAgentData.brands,
    mobile: navigator.userAgentData.mobile,
    platform: navigator.userAgentData.platform,
    json: navigator.userAgentData.toJSON(),
    high: await navigator.userAgentData.getHighEntropyValues(['architecture', 'bitness', 'platform', 'platformVersion', 'uaFullVersion', 'wow64', 'model']),
    masked: navigator.userAgentData.getHighEntropyValues.toString(),
  }))()`, context, { timeout: 1000 });
  const result = JSON.parse(check);
  assert.equal(result.ua, ua);
  assert.equal(result.brands[0].brand, 'Google Chrome');
  assert.equal(result.brands[0].version, '152');
  assert.equal(result.mobile, false);
  assert.equal(result.platform, 'Windows');
  assert.equal(result.json.platform, 'Windows');
  assert.deepEqual(result.high, { architecture: 'x86', bitness: '64', platform: 'Windows', platformVersion: '15.0.0', uaFullVersion: '152.0.7977.76', wow64: false, model: '' });
  assert.match(result.masked, /native code/);
});

test('chrome mode follows the opted-in tab across third-party hosts', () => {
  const hosts = ['www.speedtest.net'];
  assert.equal(isChromeModeRequest({ requestHost: 'www.speedtest.net', ownerUrl: 'https://www.speedtest.net/th', chromeHosts: hosts }), true);
  // Challenge/beacon hosts inherit the opted-in page identity.
  assert.equal(isChromeModeRequest({ requestHost: 'challenges.cloudflare.com', ownerUrl: 'https://www.speedtest.net/th', chromeHosts: hosts }), true);
  // Non-opted tabs stay elysium everywhere.
  assert.equal(isChromeModeRequest({ requestHost: 'challenges.cloudflare.com', ownerUrl: 'https://example.com/', chromeHosts: hosts }), false);
  assert.equal(isChromeModeRequest({ requestHost: 'example.com', ownerUrl: 'https://example.com/', chromeHosts: hosts }), false);
  assert.equal(isChromeModeRequest({ requestHost: '', ownerUrl: '', chromeHosts: hosts }), false);
  assert.equal(isChromeModeRequest({ requestHost: 'www.speedtest.net', chromeHosts: null }), false);
});

test('stuck verification pages resolve to their host for auto chrome mode', () => {
  assert.equal(shouldAutoChromeMode({ title: 'Just a moment...', url: 'https://www.speedtest.net/th', chromeHosts: [] }), 'www.speedtest.net');
  assert.equal(shouldAutoChromeMode({ title: 'Attention Required! | Cloudflare', url: 'https://example.com/', chromeHosts: [] }), 'example.com');
  assert.equal(shouldAutoChromeMode({ title: 'Just a moment...', url: 'https://www.speedtest.net/th', chromeHosts: ['www.speedtest.net'] }), '');
  assert.equal(shouldAutoChromeMode({ title: 'Speedtest by Ookla', url: 'https://www.speedtest.net/th', chromeHosts: [] }), '');
  assert.equal(shouldAutoChromeMode({ title: 'Just a moment...', url: 'elysium://home', chromeHosts: [] }), '');
  assert.equal(shouldAutoChromeMode({}), '');
});
