const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const app = require('../src/app');
const env = require('../src/config/env');
const { User, Session } = require('../src/models');
const { generateRefreshToken } = require('../src/utils/jwt');
const { isOriginAllowed, normalizeOrigin, isDevLocalhostOrigin } = require('../src/utils/origin');
const { isSecureConnection } = require('../src/utils/cookie');

describe('CSRF Origin Validation & Cloudflare Tunnel Regression Suite', () => {
  let server;
  let baseUrl;
  const approvedCloudflareOrigin = 'https://uap-test-portal.trycloudflare.com';
  const unapprovedCloudflareOrigin = 'https://unapproved-attacker.trycloudflare.com';
  const maliciousOrigin = 'https://malicious-attacker.com';
  const localhostEvilOrigin = 'http://localhost.evil.com';

  before(async () => {
    // Configure explicit environment allowlist for the approved Cloudflare origin
    process.env.CLOUDFLARE_TUNNEL_URL = approvedCloudflareOrigin;
    env.CLOUDFLARE_TUNNEL_URL = approvedCloudflareOrigin;

    await connectDB();
    await seedDatabase();

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    delete process.env.CLOUDFLARE_TUNNEL_URL;
    env.CLOUDFLARE_TUNNEL_URL = '';
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  // Helper to login and extract tokens & cookies
  async function performLogin(origin) {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
      },
      body: JSON.stringify({
        email: 'student@uap.edu',
        password: 'Student@123',
      }),
    });
    const status = res.status;
    const body = await res.json().catch(() => ({}));
    const rawCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];
    const refreshCookie = rawCookies.find((c) => c && c.includes('uap_refresh='));
    const csrfCookie = rawCookies.find((c) => c && c.includes('uap_csrf='));

    return {
      status,
      body,
      refreshCookie: refreshCookie ? refreshCookie.split(';')[0] : null,
      csrfCookie: csrfCookie ? csrfCookie.split(';')[0] : null,
      csrfToken: body?.data?.csrfToken || null,
      rawCookies,
    };
  }

  // 1. Localhost login and browser refresh
  it('1. Localhost (127.0.0.1 & localhost) login and browser refresh succeed', async () => {
    const session = await performLogin('http://localhost:5173');
    assert.strictEqual(session.status, 200);
    assert.ok(session.refreshCookie, 'Must set uap_refresh cookie');
    assert.ok(session.csrfCookie, 'Must set uap_csrf cookie');

    // Simulate browser refresh: send refresh request with Origin: http://localhost:5173
    const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        Cookie: `${session.refreshCookie}; ${session.csrfCookie}`,
        'X-CSRF-Token': session.csrfToken,
      },
      body: JSON.stringify({}),
    });

    assert.strictEqual(refreshRes.status, 200, 'Refresh must succeed for localhost:5173');
    const refreshData = await refreshRes.json();
    assert.ok(refreshData.data.accessToken, 'Must return new accessToken');

    // Also test 127.0.0.1 origin
    const session127 = await performLogin('http://127.0.0.1:5173');
    assert.strictEqual(session127.status, 200);
    const refreshRes127 = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://127.0.0.1:5173',
        Cookie: `${session127.refreshCookie}; ${session127.csrfCookie}`,
        'X-CSRF-Token': session127.csrfToken,
      },
      body: JSON.stringify({}),
    });
    assert.strictEqual(refreshRes127.status, 200, 'Refresh must succeed for 127.0.0.1:5173');
  });

  // 2. Approved Cloudflare origin login and browser refresh
  it('2. Approved Cloudflare origin login and browser refresh succeed', async () => {
    const session = await performLogin(approvedCloudflareOrigin);
    assert.strictEqual(session.status, 200, 'Login must succeed from approved Cloudflare origin');
    assert.ok(session.refreshCookie);
    assert.ok(session.csrfCookie);

    // Simulate browser refresh through approved Cloudflare tunnel
    const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: approvedCloudflareOrigin,
        Cookie: `${session.refreshCookie}; ${session.csrfCookie}`,
        'X-CSRF-Token': session.csrfToken,
      },
      body: JSON.stringify({}),
    });

    assert.strictEqual(refreshRes.status, 200, 'Browser refresh must succeed from approved Cloudflare origin');
    const data = await refreshRes.json();
    assert.ok(data.data.accessToken, 'Must issue new access token');
    assert.ok(data.data.csrfToken, 'Must issue rotated CSRF token');
  });

  // 3. Unapproved Cloudflare origin rejected with 403
  it('3. Unapproved Cloudflare origin is rejected with HTTP 403 on refresh and login', async () => {
    // Valid session established on approved origin
    const session = await performLogin(approvedCloudflareOrigin);

    // An attacker creates their own *.trycloudflare.com tunnel and attempts to refresh
    const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: unapprovedCloudflareOrigin,
        Cookie: `${session.refreshCookie}; ${session.csrfCookie}`,
        'X-CSRF-Token': session.csrfToken,
      },
      body: JSON.stringify({}),
    });

    assert.strictEqual(refreshRes.status, 403, 'Unapproved Cloudflare tunnel must be rejected with 403');
    const data = await refreshRes.json();
    assert.match(data.message, /(csrf origin validation failed|cors blocked)/i);
  });

  // 4. Arbitrary external origin rejected
  it('4. Arbitrary external origin is rejected with HTTP 403', async () => {
    const session = await performLogin(approvedCloudflareOrigin);

    const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: maliciousOrigin,
        Cookie: `${session.refreshCookie}; ${session.csrfCookie}`,
        'X-CSRF-Token': session.csrfToken,
      },
      body: JSON.stringify({}),
    });

    assert.strictEqual(refreshRes.status, 403);
    const data = await refreshRes.json();
    assert.match(data.message, /(csrf origin validation failed|cors blocked)/i);

    // Substring bypass attempt (localhost.evil.com) must also be rejected
    const evilRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: localhostEvilOrigin,
        Cookie: `${session.refreshCookie}; ${session.csrfCookie}`,
        'X-CSRF-Token': session.csrfToken,
      },
      body: JSON.stringify({}),
    });
    assert.strictEqual(evilRes.status, 403, 'Substring bypass localhost.evil.com must be rejected');
  });

  // 5. Missing Origin and Referer handling follows existing application policy
  it('5. Missing Origin and Referer allows non-browser requests but validates CSRF cookie when present', async () => {
    const session = await performLogin(approvedCloudflareOrigin);

    // Request with valid CSRF token but no Origin header (non-browser client)
    const validNoOriginRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${session.refreshCookie}; ${session.csrfCookie}`,
        'X-CSRF-Token': session.csrfToken,
      },
      body: JSON.stringify({}),
    });
    assert.strictEqual(validNoOriginRes.status, 200, 'Valid non-browser request with valid CSRF token succeeds');

    // Request with NO Origin and MISSING CSRF token while cookie is present -> must be 403
    const invalidNoOriginRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${session.refreshCookie}; ${session.csrfCookie}`,
      },
      body: JSON.stringify({}),
    });
    assert.strictEqual(invalidNoOriginRes.status, 403, 'Missing CSRF header must be rejected even without Origin');
  });

  // 6. Expired refresh token is rejected appropriately
  it('6. Expired refresh token is rejected with HTTP 401', async () => {
    const user = await User.findOne({ email: 'student@uap.edu' });
    const expiredToken = generateRefreshToken({
      id: user._id.toString(),
      role: user.role,
      tokenVersion: user.tokenVersion || 0,
    });
    // Create an already-expired session in DB
    const { hashToken } = require('../src/utils/sessionCrypto');
    const expiredHash = hashToken(expiredToken);
    await Session.create({
      userId: user._id,
      familyId: 'family_expired_test',
      currentTokenHash: expiredHash,
      status: 'active',
      expiresAt: new Date(Date.now() - 10000), // in the past
    });

    const res = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        Cookie: `uap_refresh=${encodeURIComponent(expiredToken)}; uap_csrf=dummy_csrf`,
        'X-CSRF-Token': 'dummy_csrf',
      },
      body: JSON.stringify({}),
    });

    assert.strictEqual(res.status, 401, 'Expired session must return 401');
    const data = await res.json();
    assert.match(data.message, /session has expired/i);
  });

  // 7. Invalid refresh token is rejected appropriately
  it('7. Malformed or tampered refresh token is rejected with HTTP 401', async () => {
    const res = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        Cookie: `uap_refresh=invalid_tampered_token_payload; uap_csrf=dummy_csrf`,
        'X-CSRF-Token': 'dummy_csrf',
      },
      body: JSON.stringify({}),
    });

    assert.strictEqual(res.status, 401, 'Malformed token must return 401');
    const data = await res.json();
    assert.match(data.message, /invalid refresh token/i);
  });

  // 8. Logout invalidates the session as intended
  it('8. Logout invalidates session in database and clears auth cookies', async () => {
    const session = await performLogin(approvedCloudflareOrigin);
    assert.strictEqual(session.status, 200);

    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: approvedCloudflareOrigin,
        Cookie: `${session.refreshCookie}; ${session.csrfCookie}`,
        'X-CSRF-Token': session.csrfToken,
      },
      body: JSON.stringify({}),
    });

    assert.strictEqual(logoutRes.status, 200, 'Logout must succeed');
    const setCookies = logoutRes.headers.getSetCookie ? logoutRes.headers.getSetCookie() : [logoutRes.headers.get('set-cookie')];
    const clearedRefresh = setCookies.find((c) => c && c.includes('uap_refresh=') && c.includes('Max-Age=0'));
    const clearedCsrf = setCookies.find((c) => c && c.includes('uap_csrf=') && c.includes('Max-Age=0'));
    assert.ok(clearedRefresh, 'Must clear uap_refresh with Max-Age=0');
    assert.ok(clearedCsrf, 'Must clear uap_csrf with Max-Age=0');

    // Attempting refresh with the logged-out session must now fail
    const reRefreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: approvedCloudflareOrigin,
        Cookie: `${session.refreshCookie}; ${session.csrfCookie}`,
        'X-CSRF-Token': session.csrfToken,
      },
      body: JSON.stringify({}),
    });
    assert.strictEqual(reRefreshRes.status, 401, 'Revoked session cannot be refreshed');
  });

  // 9. Production configuration does not accidentally enable development-origin exceptions
  it('9. Production mode strictly enforces configured allowlist without development localhost exceptions', () => {
    // In production, isDevLocalhostOrigin must be false even for 127.0.0.1 or localhost
    assert.strictEqual(isDevLocalhostOrigin('http://localhost:5173', 'production'), false);
    assert.strictEqual(isDevLocalhostOrigin('http://127.0.0.1:5173', 'production'), false);

    // In production, an origin not in configured CLIENT_URL must be rejected
    assert.strictEqual(isOriginAllowed('http://localhost:3000', 'production'), false);
    assert.strictEqual(isOriginAllowed('https://any-tunnel.trycloudflare.com', 'production'), false);

    // Development origin with exact localhost passes in development mode
    assert.strictEqual(isDevLocalhostOrigin('http://localhost:5173', 'development'), true);
    assert.strictEqual(isDevLocalhostOrigin('http://127.0.0.1:5173', 'development'), true);

    // Malicious subdomains attempting to impersonate localhost must NEVER pass in development or production
    assert.strictEqual(isDevLocalhostOrigin('http://localhost.evil.com:5173', 'development'), false);
    assert.strictEqual(isDevLocalhostOrigin('http://127.0.0.1.evil.com', 'development'), false);
    assert.strictEqual(isOriginAllowed('http://localhost.evil.com', 'development'), false);
  });

  // 10. Protocol-aware Secure cookie attribute check
  it('10. isSecureConnection helper sets Secure when request is HTTPS or proxied via HTTPS', () => {
    const fakeHttpsRes = { req: { secure: true, headers: {} } };
    const fakeForwardedHttpsRes = { req: { secure: false, headers: { 'x-forwarded-proto': 'https' } } };
    const fakeHttpRes = { req: { secure: false, headers: { 'x-forwarded-proto': 'http' } } };

    assert.strictEqual(isSecureConnection(fakeHttpsRes), true, 'Direct HTTPS must be Secure');
    assert.strictEqual(isSecureConnection(fakeForwardedHttpsRes), true, 'x-forwarded-proto https must be Secure');
    assert.strictEqual(isSecureConnection(fakeHttpRes), false, 'Plain HTTP in dev must NOT be Secure');
  });
});
