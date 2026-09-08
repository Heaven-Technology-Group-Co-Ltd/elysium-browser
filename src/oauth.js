const { createHash, randomBytes, timingSafeEqual } = require('node:crypto');

const MAX_TOKEN_RESPONSE = 1_000_000;

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function secureOAuthURL(value, label) {
  let url;
  try { url = new URL(String(value || '')); }
  catch { throw new Error(`${label} ไม่ใช่ URL ที่ถูกต้อง`); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) || url.username || url.password) {
    throw new Error(`${label} ต้องเป็น HTTPS หรือ HTTP บน localhost และไม่มี credential ใน URL`);
  }
  return url;
}

function validateOAuthConfig(config) {
  if (config.provider !== 'oauth-openai-compatible') throw new Error('Provider นี้ไม่ได้ใช้ OAuth');
  const clientId = String(config.oauthClientId || '').trim();
  if (!clientId || clientId.length > 500) throw new Error('กรุณาใส่ OAuth client ID');
  const authorizationEndpoint = secureOAuthURL(config.oauthAuthorizationEndpoint, 'Authorization endpoint').href;
  const tokenEndpoint = secureOAuthURL(config.oauthTokenEndpoint, 'Token endpoint').href;
  return {
    clientId,
    authorizationEndpoint,
    tokenEndpoint,
    scopes: String(config.oauthScopes || '').trim().replace(/\s+/g, ' ').slice(0, 2000),
  };
}

function oauthFingerprint(config) {
  const oauth = validateOAuthConfig(config);
  return createHash('sha256').update(JSON.stringify({
    endpoint: String(config.endpoint || ''),
    clientId: oauth.clientId,
    authorizationEndpoint: oauth.authorizationEndpoint,
    tokenEndpoint: oauth.tokenEndpoint,
  })).digest('hex');
}

function createOAuthAttempt(config, redirectURI) {
  const oauth = validateOAuthConfig(config);
  const redirect = new URL(redirectURI);
  if (redirect.protocol !== 'http:' || redirect.hostname !== '127.0.0.1' || !redirect.port || redirect.pathname !== '/oauth/callback') {
    throw new Error('OAuth callback ต้องเป็น loopback 127.0.0.1 ของ Cherry');
  }
  const codeVerifier = base64url(randomBytes(48));
  const state = base64url(randomBytes(32));
  const codeChallenge = base64url(createHash('sha256').update(codeVerifier).digest());
  const authorizationURL = new URL(oauth.authorizationEndpoint);
  authorizationURL.searchParams.set('response_type', 'code');
  authorizationURL.searchParams.set('client_id', oauth.clientId);
  authorizationURL.searchParams.set('redirect_uri', redirect.href);
  authorizationURL.searchParams.set('state', state);
  authorizationURL.searchParams.set('code_challenge', codeChallenge);
  authorizationURL.searchParams.set('code_challenge_method', 'S256');
  if (oauth.scopes) authorizationURL.searchParams.set('scope', oauth.scopes);
  return { authorizationURL: authorizationURL.href, codeVerifier, state, redirectURI: redirect.href };
}

function safeStateEqual(expected, received) {
  const a = Buffer.from(String(expected || ''));
  const b = Buffer.from(String(received || ''));
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readTokenResponse(response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('OAuth server ไม่ได้ส่งคำตอบ');
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_TOKEN_RESPONSE) { await reader.cancel(); throw new Error('คำตอบจาก OAuth server ใหญ่เกินกำหนด'); }
    chunks.push(Buffer.from(value));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return JSON.parse(raw); }
  catch {
    const form = new URLSearchParams(raw);
    if (form.has('access_token') || form.has('error')) return Object.fromEntries(form);
    throw new Error('OAuth server ส่งคำตอบที่อ่านไม่ได้');
  }
}

function normalizeToken(data, previousRefreshToken = '') {
  const accessToken = typeof data.access_token === 'string' ? data.access_token.trim() : '';
  const tokenType = typeof data.token_type === 'string' ? data.token_type : 'Bearer';
  if (!accessToken || accessToken.length > 100000) throw new Error('OAuth server ไม่ได้ส่ง access token ที่ถูกต้อง');
  if (tokenType.toLowerCase() !== 'bearer') throw new Error(`OAuth token type ${tokenType} ยังไม่รองรับ`);
  const refreshToken = typeof data.refresh_token === 'string' && data.refresh_token ? data.refresh_token : previousRefreshToken;
  if (refreshToken.length > 100000) throw new Error('OAuth refresh token ใหญ่เกินกำหนด');
  const expiresIn = Number(data.expires_in);
  return {
    accessToken,
    refreshToken,
    expiresAt: Number.isFinite(expiresIn) && expiresIn > 0 ? Date.now() + Math.min(expiresIn, 31536000) * 1000 : 0,
    scope: String(data.scope || '').slice(0, 2000),
    connectedAt: Date.now(),
  };
}

async function tokenRequest(config, fields, previousRefreshToken = '') {
  const oauth = validateOAuthConfig(config);
  const response = await fetch(oauth.tokenEndpoint, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
    redirect: 'error',
    signal: AbortSignal.timeout(45000),
  });
  const data = await readTokenResponse(response);
  if (!response.ok || data.error) {
    const detail = String(data.error_description || data.error || `HTTP ${response.status}`).slice(0, 500);
    throw new Error(`เชื่อม OAuth ไม่สำเร็จ: ${detail}`);
  }
  return normalizeToken(data, previousRefreshToken);
}

async function exchangeAuthorizationCode(config, attempt, code) {
  const oauth = validateOAuthConfig(config);
  return tokenRequest(config, {
    grant_type: 'authorization_code',
    code: String(code || ''),
    redirect_uri: attempt.redirectURI,
    client_id: oauth.clientId,
    code_verifier: attempt.codeVerifier,
  });
}

async function refreshAccessToken(config, refreshToken) {
  const oauth = validateOAuthConfig(config);
  if (!refreshToken) throw new Error('OAuth session หมดอายุ กรุณาเชื่อมบัญชีใหม่');
  const fields = { grant_type: 'refresh_token', refresh_token: refreshToken, client_id: oauth.clientId };
  if (oauth.scopes) fields.scope = oauth.scopes;
  return tokenRequest(config, fields, refreshToken);
}

module.exports = {
  createOAuthAttempt,
  exchangeAuthorizationCode,
  normalizeToken,
  oauthFingerprint,
  refreshAccessToken,
  safeStateEqual,
  secureOAuthURL,
  validateOAuthConfig,
};
