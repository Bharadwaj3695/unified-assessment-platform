const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const app = require('../src/app');
const env = require('../src/config/env');
const { User, Session, AuditLog, Submission, Assessment } = require('../src/models');
const { hashToken } = require('../src/utils/sessionCrypto');
const authService = require('../src/services/auth.service');

describe('Stage 3: Secure Cookies, Session Lifecycle, CSRF & HTTP Caching', () => {
  let server;
  let baseUrl;
  let studentUser;
  let adminUser;

  before(async () => {
    await connectDB();
    await seedDatabase();
    studentUser = await User.findOne({ email: 'student@uap.edu' });
    adminUser = await User.findOne({ email: 'admin@uap.edu' });

    // Start ephemeral HTTP server for end-to-end middleware and header testing
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  describe('1. Cookie Issuance, Attributes & EMIT_REFRESH_TOKEN_BODY Enforcement', () => {
    it('1.1 Login should set HttpOnly uap_refresh cookie and companion uap_csrf cookie', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'student@uap.edu',
          password: 'Student@123',
        }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.data.accessToken, 'Access token must be returned in response');
      assert.ok(data.data.csrfToken, 'CSRF token must be returned in response');
      // When EMIT_REFRESH_TOKEN_BODY is false (default), refreshToken must not be in body
      assert.strictEqual(data.data.refreshToken, undefined, 'Raw refreshToken must NOT be exposed in body');

      const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];
      const refreshCookieHeader = setCookies.find((c) => c && c.includes('uap_refresh='));
      const csrfCookieHeader = setCookies.find((c) => c && c.includes('uap_csrf='));

      assert.ok(refreshCookieHeader, 'Must set uap_refresh cookie');
      assert.ok(csrfCookieHeader, 'Must set uap_csrf cookie');

      // Verify cookie attributes
      assert.match(refreshCookieHeader, /Path=\/api\/auth/i, 'uap_refresh Path must be /api/auth');
      assert.match(refreshCookieHeader, /HttpOnly/i, 'uap_refresh must be HttpOnly');
      assert.match(refreshCookieHeader, /SameSite=Lax/i, 'uap_refresh SameSite must be Lax');
      assert.match(refreshCookieHeader, /Max-Age=2592000/i, 'uap_refresh Max-Age must be 30 days');

      assert.match(csrfCookieHeader, /Path=\//i, 'uap_csrf Path must be /');
      assert.strictEqual(csrfCookieHeader.includes('HttpOnly'), false, 'uap_csrf must NOT be HttpOnly');
      assert.match(csrfCookieHeader, /SameSite=Lax/i, 'uap_csrf SameSite must be Lax');
    });

    it('1.2 MFA challenge initiation should NOT issue refresh or CSRF cookies', async () => {
      // Temporarily enable MFA for studentUser to test challenge isolation
      studentUser.mfaEnabled = true;
      studentUser.mfaSecret = 'JBSWY3DPEHPK3PXP';
      await studentUser.save();

      try {
        const res = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'student@uap.edu',
            password: 'Student@123',
          }),
        });

        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.data.mfaRequired, true);
        assert.ok(data.data.mfaToken);

        const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];
        const refreshCookie = setCookies.find((c) => c && c.includes('uap_refresh='));
        assert.strictEqual(refreshCookie, undefined, 'MFA challenge must NEVER issue refresh cookie');
      } finally {
        studentUser.mfaEnabled = false;
        studentUser.mfaSecret = null;
        await studentUser.save();
      }
    });
  });

  describe('2. CSRF Protection and Origin Validation', () => {
    let activeRefreshCookie;
    let activeCsrfCookie;
    let csrfTokenValue;

    before(async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'student@uap.edu', password: 'Student@123' }),
      });
      const data = await res.json();
      csrfTokenValue = data.data.csrfToken;
      const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];
      activeRefreshCookie = cookies.find((c) => c.includes('uap_refresh=')).split(';')[0];
      activeCsrfCookie = cookies.find((c) => c.includes('uap_csrf=')).split(';')[0];
    });

    it('2.1 Cookie refresh without X-CSRF-Token header should be rejected with HTTP 403', async () => {
      const res = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${activeRefreshCookie}; ${activeCsrfCookie}`,
        },
        body: JSON.stringify({}),
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.match(data.message, /invalid or missing csrf token/i);
    });

    it('2.2 Cookie refresh with mismatched X-CSRF-Token header should be rejected with HTTP 403', async () => {
      const res = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${activeRefreshCookie}; ${activeCsrfCookie}`,
          'X-CSRF-Token': 'wrong_invalid_csrf_token_hex_value',
        },
        body: JSON.stringify({}),
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.match(data.message, /invalid or missing csrf token/i);
    });

    it('2.3 Cookie refresh with untrusted Origin header should be rejected with HTTP 403', async () => {
      const res = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://malicious-attacker-site.com',
          Cookie: `${activeRefreshCookie}; ${activeCsrfCookie}`,
          'X-CSRF-Token': csrfTokenValue,
        },
        body: JSON.stringify({}),
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.match(data.message, /(csrf origin validation failed|cors blocked)/i);
    });

    it('2.3b Cookie refresh with untrusted Referer header should be rejected with HTTP 403 by CSRF middleware', async () => {
      const res = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Referer: 'https://malicious-attacker-site.com/evil-path',
          Cookie: `${activeRefreshCookie}; ${activeCsrfCookie}`,
          'X-CSRF-Token': csrfTokenValue,
        },
        body: JSON.stringify({}),
      });

      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.match(data.message, /csrf origin validation failed/i);
    });

    it('2.4 Cookie refresh with matching X-CSRF-Token and trusted origin should succeed and rotate cookie', async () => {
      const res = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:5173',
          Cookie: `${activeRefreshCookie}; ${activeCsrfCookie}`,
          'X-CSRF-Token': csrfTokenValue,
        },
        body: JSON.stringify({}),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.data.accessToken, 'Must issue new access token');
      assert.ok(data.data.csrfToken, 'Must issue fresh companion CSRF token');

      const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];
      const newRefresh = cookies.find((c) => c && c.includes('uap_refresh='));
      assert.ok(newRefresh, 'Must rotate uap_refresh cookie');
    });
  });

  describe('3. Legacy Migration & Rollback Behavior', () => {
    it('3.1 Legacy body refresh should be accepted during migration window and establish HttpOnly cookie', async () => {
      // Simulate legacy login yielding plaintext refresh token
      const loginRes = await authService.login({
        email: 'student@uap.edu',
        password: 'Student@123',
      });
      const legacyToken = loginRes.refreshToken;

      // Client sends legacy token in request body WITHOUT existing cookies
      const res = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: legacyToken }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.data.accessToken);

      // Verify server established new HttpOnly cookie and CSRF cookie
      const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];
      const refreshCookie = cookies.find((c) => c && c.includes('uap_refresh='));
      const csrfCookie = cookies.find((c) => c && c.includes('uap_csrf='));
      assert.ok(refreshCookie, 'Legacy body migration must issue uap_refresh cookie');
      assert.ok(csrfCookie, 'Legacy body migration must issue uap_csrf cookie');
    });

    it('3.2 When ALLOW_LEGACY_REFRESH_BODY is disabled, body refresh should be rejected with HTTP 400', async () => {
      const originalFlag = env.ALLOW_LEGACY_REFRESH_BODY;
      env.ALLOW_LEGACY_REFRESH_BODY = false;

      try {
        const res = await fetch(`${baseUrl}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: 'some_arbitrary_legacy_token' }),
        });

        assert.strictEqual(res.status, 400);
        const data = await res.json();
        assert.match(data.message, /body-based refresh tokens are deprecated/i);
      } finally {
        env.ALLOW_LEGACY_REFRESH_BODY = originalFlag;
      }
    });

    it('3.3 When EMIT_REFRESH_TOKEN_BODY is enabled (rollback mode), response body includes refreshToken', async () => {
      const originalEmit = env.EMIT_REFRESH_TOKEN_BODY;
      env.EMIT_REFRESH_TOKEN_BODY = true;

      try {
        const res = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'student@uap.edu', password: 'Student@123' }),
        });

        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.ok(data.data.refreshToken, 'Rollback mode must emit refreshToken in body');
      } finally {
        env.EMIT_REFRESH_TOKEN_BODY = originalEmit;
      }
    });
  });

  describe('4. Session Lifecycle, Logout & Cookie Clearing', () => {
    it('4.1 Logout must invalidate session and clear cookies with Max-Age=0 and expired date', async () => {
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'student@uap.edu', password: 'Student@123' }),
      });
      const loginData = await loginRes.json();
      const cookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get('set-cookie')];
      const refreshCookie = cookies.find((c) => c.includes('uap_refresh=')).split(';')[0];
      const csrfCookie = cookies.find((c) => c.includes('uap_csrf=')).split(';')[0];

      const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${refreshCookie}; ${csrfCookie}`,
          'X-CSRF-Token': loginData.data.csrfToken,
        },
      });

      assert.strictEqual(logoutRes.status, 200);

      // Verify clearing headers
      const clearCookies = logoutRes.headers.getSetCookie ? logoutRes.headers.getSetCookie() : [logoutRes.headers.get('set-cookie')];
      const clearedRefresh = clearCookies.filter((c) => c && c.includes('uap_refresh='));
      const clearedCsrf = clearCookies.find((c) => c && c.includes('uap_csrf='));

      assert.ok(clearedRefresh.length >= 1, 'Must emit Set-Cookie clearing uap_refresh');
      assert.ok(clearedCsrf, 'Must emit Set-Cookie clearing uap_csrf');
      assert.match(clearedRefresh[0], /Max-Age=0/i);
      assert.match(clearedRefresh[0], /1970/i);
      assert.match(clearedCsrf, /Max-Age=0/i);
      assert.match(clearedCsrf, /1970/i);

      // Attempting to refresh with the logged-out cookie must now fail with 401
      const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${refreshCookie}; ${csrfCookie}`,
          'X-CSRF-Token': loginData.data.csrfToken,
        },
      });
      assert.strictEqual(refreshRes.status, 401);
    });

    it('4.2 Password change must bump tokenVersion and revoke existing sessions', async () => {
      const loginRes = await authService.login({
        email: 'student@uap.edu',
        password: 'Student@123',
      });
      const t1 = loginRes.refreshToken;

      // Change password
      await authService.changePassword(studentUser._id, 'Student@123', 'Student@NewPass123');

      // Refresh with t1 must now fail
      await assert.rejects(
        async () => {
          await authService.refreshAccessToken({ refreshToken: t1 });
        },
        /Session has expired or been invalidated/i
      );

      // Restore password
      await authService.changePassword(studentUser._id, 'Student@NewPass123', 'Student@123');
    });
  });

  describe('5. HTTP Caching Headers Enforcement', () => {
    it('5.1 Sensitive API endpoints (/api/auth/*) must include strict no-store Cache-Control headers', async () => {
      const res = await fetch(`${baseUrl}/api/auth/profile`, {
        headers: { Authorization: 'Bearer invalid_or_missing' },
      });

      const cacheControl = res.headers.get('cache-control');
      const pragma = res.headers.get('pragma');
      const expires = res.headers.get('expires');

      assert.ok(cacheControl, 'Cache-Control header must be present');
      assert.match(cacheControl, /no-store/i, 'Must specify no-store');
      assert.match(cacheControl, /no-cache/i, 'Must specify no-cache');
      assert.match(cacheControl, /private/i, 'Must specify private');
      assert.strictEqual(pragma, 'no-cache', 'Pragma must be no-cache');
      assert.strictEqual(expires, '0', 'Expires must be 0');
    });

    it('5.2 Static avatar uploads (/uploads/*) must serve with controlled public caching', async () => {
      const res = await fetch(`${baseUrl}/uploads/avatar-test.png`);
      // Even if 404 on missing file, express.static configures headers
      const cacheControl = res.headers.get('cache-control');
      if (res.status === 200) {
        assert.match(cacheControl, /public/i);
        assert.match(cacheControl, /max-age=86400/i);
      }
    });
  });
});
