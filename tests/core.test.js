const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { resolveAddress, isWebURL, BrowserStore } = require('../src/core');
const { computeLayout, sanitizeTheme, filterExistingDownloads } = require('../src/core');
const { providerURL } = require('../src/providers');
const { createOAuthAttempt, normalizeToken, oauthFingerprint, safeStateEqual, secureOAuthURL } = require('../src/oauth');

function removeTestDirectory(directory) {
  const resolved = path.resolve(directory);
  assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
  assert.ok(path.basename(resolved).startsWith('cherry-core-'));
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
  assert.equal(resolveAddress(''), 'cherry://home');
  assert.equal(resolveAddress('cherry://history'), 'cherry://history');
});

test('rejects executable and local-file schemes', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///C:/secret', 'ftp://example.com', 'cherry://invalid', 'vbscript:test']) {
    assert.throws(() => resolveAddress(url));
    assert.equal(isWebURL(url), false);
  }
});

test('bookmarks, settings and history persist across restarts; recent duplicate visits merge', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cherry-core-'));
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
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cherry-core-'));
  t.after(() => removeTestDirectory(directory));
  fs.writeFileSync(path.join(directory, 'cherry-data.json'), JSON.stringify({ bookmarks: [null, { id: 'bad', url: 'javascript:test', title: 'bad' }], savedTabs: ['file:///secret', 'https://example.com/'], settings: { searchEngine: 'invalid' } }));
  const sanitized = new BrowserStore(directory);
  assert.deepEqual(sanitized.data.bookmarks, []);
  assert.deepEqual(sanitized.data.savedTabs, ['https://example.com/']);
  assert.equal(sanitized.data.settings.searchEngine, 'google');
  fs.writeFileSync(path.join(directory, 'cherry-data.json'), '{broken');
  assert.deepEqual(new BrowserStore(directory).data.history, []);
  assert.ok(fs.readdirSync(directory).some(name => name.includes('.backup-')));
});

test('schema migration preserves old profile, bookmarks and sessions without private tabs', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cherry-core-'));
  t.after(() => removeTestDirectory(directory));
  const file = path.join(directory, 'cherry-data.json');
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

test('finished non-private downloads persist across restarts and unsafe records are dropped', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cherry-core-'));
  t.after(() => removeTestDirectory(directory));
  const file = path.join(directory, 'cherry-data.json');
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
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cherry-core-'));
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
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cherry-core-'));
  t.after(() => removeTestDirectory(directory));
  const store = new BrowserStore(directory);
  const dueAt = Date.now() + 60000;
  store.data.postIts.push({id:'post-1',title:'จำไว้',body:'ข้อความบนบอร์ด',color:'pink',pinned:true,createdAt:1,updatedAt:2});
  store.data.reminders.push({id:'reminder-1',title:'ส่งงาน',details:'ก่อนประชุม',dueAt,done:false,notifiedAt:0,createdAt:1,updatedAt:2});
  store.save();
  const restored = new BrowserStore(directory);
  assert.deepEqual(restored.data.postIts[0],{id:'post-1',title:'จำไว้',body:'ข้อความบนบอร์ด',color:'pink',pinned:true,createdAt:1,updatedAt:2});
  assert.deepEqual(restored.data.reminders[0],{id:'reminder-1',title:'ส่งงาน',details:'ก่อนประชุม',dueAt,done:false,notifiedAt:0,createdAt:1,updatedAt:2});

  const file = path.join(directory, 'cherry-data.json');
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
    oauthClientId: 'cherry-public-client', oauthScopes: 'openid  profile offline_access',
  };
  const attempt = createOAuthAttempt(config, 'http://127.0.0.1:49152/oauth/callback');
  const authorize = new URL(attempt.authorizationURL);
  assert.equal(authorize.searchParams.get('response_type'), 'code');
  assert.equal(authorize.searchParams.get('client_id'), 'cherry-public-client');
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
