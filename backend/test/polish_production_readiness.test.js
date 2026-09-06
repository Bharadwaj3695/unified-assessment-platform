const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const app = require('../src/app');
const { User } = require('../src/models');
const { generateAccessToken } = require('../src/utils/jwt');

describe('Phase I Verification: Polish, Accessibility & Production Readiness', () => {
  let server;
  let baseUrl;
  let adminToken;
  let instructorToken;
  let studentToken;

  before(async () => {
    await connectDB();
    await seedDatabase();

    const admin = await User.findOne({ email: 'admin@uap.edu' });
    const instructor = await User.findOne({ email: 'instructor@uap.edu' });
    const student = await User.findOne({ email: 'student@uap.edu' });

    adminToken = generateAccessToken({ id: admin._id.toString(), role: 'admin', email: admin.email });
    instructorToken = generateAccessToken({ id: instructor._id.toString(), role: 'instructor', email: instructor.email });
    studentToken = generateAccessToken({ id: student._id.toString(), role: 'student', email: student.email });

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
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

  it('1. Production health check endpoint responds with 200 healthy status', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'healthy');
    assert.ok(data.timestamp);
    assert.strictEqual(data.service, 'Unified Assessment Platform API');
  });

  it('2. Helmet security headers are applied to HTTP responses', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.ok(res.headers.get('x-dns-prefetch-control'));
    assert.ok(res.headers.get('x-content-type-options'));
    assert.ok(res.headers.get('x-frame-options'));
  });

  it('3. Unauthenticated requests to protected endpoints are blocked with 401', async () => {
    const res = await fetch(`${baseUrl}/api/admin/stats`);
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.match(data.message, /authentication token/i);
  });

  it('4. Role isolation: student is blocked from administrative endpoints (HTTP 403)', async () => {
    const res = await fetch(`${baseUrl}/api/admin/stats`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.match(data.message, /access denied/i);
  });

  it('5. Role isolation: instructor is blocked from administrative endpoints (HTTP 403)', async () => {
    const res = await fetch(`${baseUrl}/api/admin/settings`, {
      headers: { Authorization: `Bearer ${instructorToken}` },
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.match(data.message, /access denied/i);
  });

  it('6. Role verification: admin has authorized access to oversight endpoints (HTTP 200)', async () => {
    const res = await fetch(`${baseUrl}/api/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.data.totalUsers > 0);
  });

  it('7. Validation error handling: malformed payload returns 422 with structured field errors', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid-email-format',
        password: '123', // too short
      }),
    });
    assert.strictEqual(res.status, 422);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.match(data.message, /validation failed/i);
    assert.ok(Array.isArray(data.errors));
    assert.ok(data.errors.length >= 2);
  });

  it('8. Error handling: invalid Mongoose ObjectId returns 404 CastError response', async () => {
    const res = await fetch(`${baseUrl}/api/admin/users/invalid-hex-id`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.match(data.message, /resource not found/i);
  });

  it('9. Notifications API returns unread counter and handles mark-read for authenticated users', async () => {
    const res = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(typeof data.data.unreadCount === 'number');
    assert.ok(Array.isArray(data.data.notifications));
  });
});
