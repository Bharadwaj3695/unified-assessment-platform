const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');

describe('Profile Image Upload and Edit Functionality: Live Verification Against Running API', () => {
  let server;
  let baseUrl = 'http://localhost:5000';
  let studentToken;
  let facultyToken;
  let adminToken;
  let facultyUserId;

  // 1x1 valid PNG image buffer
  const samplePngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  before(async () => {
    // Check if live server is reachable on localhost:5000; if not, spin up ephemeral server
    try {
      const probe = await fetch(`${baseUrl}/api/auth/login`, { method: 'OPTIONS' }).catch(() => null);
      if (!probe) {
        throw new Error('Not reachable');
      }
    } catch {
      await connectDB();
      await seedDatabase();
      server = http.createServer(app);
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
    }

    // 1. Authenticate student
    const studRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student@uap.edu', password: 'Student@123' }),
    });
    const studJson = await studRes.json();
    assert.strictEqual(studRes.status, 200, 'Student login should succeed');
    studentToken = studJson.data?.accessToken;
    assert.ok(studentToken, 'Student token should be returned');

    // 2. Authenticate faculty
    const facRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'instructor@uap.edu', password: 'Instructor@123' }),
    });
    const facJson = await facRes.json();
    assert.strictEqual(facRes.status, 200, 'Faculty login should succeed');
    facultyToken = facJson.data?.accessToken;
    facultyUserId = facJson.data?.user?.id;
    assert.ok(facultyToken, 'Faculty token should be returned');

    // 3. Authenticate admin
    const admRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@uap.edu', password: 'Admin@123' }),
    });
    const admJson = await admRes.json();
    assert.strictEqual(admRes.status, 200, 'Admin login should succeed');
    adminToken = admJson.data?.accessToken;
    assert.ok(adminToken, 'Admin token should be returned');
  });

  // -------------------------------------------------------------------------
  // 1. Student Profile: Upload, Verify, Update Fields, Remove
  // -------------------------------------------------------------------------
  it('Student: can upload profile photo, see it reflected in profile, and remove it', async () => {
    // Clean any initial avatar
    await fetch(`${baseUrl}/api/users/avatar`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    // Check profile has null avatar
    let profRes = await fetch(`${baseUrl}/api/users/profile`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    let prof = await profRes.json();
    assert.strictEqual(prof.data.avatar, null);

    // Upload new avatar using FormData
    const formData = new FormData();
    const fileBlob = new Blob([samplePngBuffer], { type: 'image/png' });
    formData.append('avatar', fileBlob, 'student_test.png');

    const uploadRes = await fetch(`${baseUrl}/api/users/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: formData,
    });
    assert.strictEqual(uploadRes.status, 200);
    const uploadData = await uploadRes.json();
    assert.ok(uploadData.data?.avatar?.startsWith('/uploads/'));

    // Verify profile reflects new avatar
    profRes = await fetch(`${baseUrl}/api/users/profile`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    prof = await profRes.json();
    assert.strictEqual(prof.data.avatar, uploadData.data.avatar);

    // Update profile text fields while avatar persists
    const updateRes = await fetch(`${baseUrl}/api/users/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        name: 'Alex Johnson',
        bio: 'Updated bio during photo testing',
        department: 'Computer Science',
      }),
    });
    assert.strictEqual(updateRes.status, 200);

    // Check profile again
    profRes = await fetch(`${baseUrl}/api/users/profile`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    prof = await profRes.json();
    assert.strictEqual(prof.data.avatar, uploadData.data.avatar);
    assert.strictEqual(prof.data.bio, 'Updated bio during photo testing');

    // Remove photo
    const deleteRes = await fetch(`${baseUrl}/api/users/avatar`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.strictEqual(deleteRes.status, 200);

    // Verify profile reflects removed avatar
    profRes = await fetch(`${baseUrl}/api/users/profile`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    prof = await profRes.json();
    assert.strictEqual(prof.data.avatar, null);
    assert.strictEqual(prof.data.bio, 'Updated bio during photo testing');
  });

  // -------------------------------------------------------------------------
  // 2. Instructor Profile: Upload, Verify, Remove
  // -------------------------------------------------------------------------
  it('Faculty: can upload photo and remove photo', async () => {
    // Clean initial
    await fetch(`${baseUrl}/api/users/avatar`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${facultyToken}` },
    });

    const formData = new FormData();
    const fileBlob = new Blob([samplePngBuffer], { type: 'image/png' });
    formData.append('avatar', fileBlob, 'faculty_test.png');

    const uploadRes = await fetch(`${baseUrl}/api/users/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: formData,
    });
    assert.strictEqual(uploadRes.status, 200);
    const uploadData = await uploadRes.json();
    assert.ok(uploadData.data?.avatar?.startsWith('/uploads/'));

    // Check profile
    let profRes = await fetch(`${baseUrl}/api/users/profile`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    let prof = await profRes.json();
    assert.strictEqual(prof.data.avatar, uploadData.data.avatar);

    // Remove photo
    const deleteRes = await fetch(`${baseUrl}/api/users/avatar`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    assert.strictEqual(deleteRes.status, 200);

    profRes = await fetch(`${baseUrl}/api/users/profile`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    prof = await profRes.json();
    assert.strictEqual(prof.data.avatar, null);
  });

  // -------------------------------------------------------------------------
  // 3. Admin Profile: Upload, Verify, Remove
  // -------------------------------------------------------------------------
  it('Admin: can upload photo and remove photo', async () => {
    // Clean initial
    await fetch(`${baseUrl}/api/users/avatar`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const formData = new FormData();
    const fileBlob = new Blob([samplePngBuffer], { type: 'image/png' });
    formData.append('avatar', fileBlob, 'admin_test.png');

    const uploadRes = await fetch(`${baseUrl}/api/users/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: formData,
    });
    assert.strictEqual(uploadRes.status, 200);
    const uploadData = await uploadRes.json();
    assert.ok(uploadData.data?.avatar?.startsWith('/uploads/'));

    // Check profile
    let profRes = await fetch(`${baseUrl}/api/users/profile`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    let prof = await profRes.json();
    assert.strictEqual(prof.data.avatar, uploadData.data.avatar);

    // Remove photo
    const deleteRes = await fetch(`${baseUrl}/api/users/avatar`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(deleteRes.status, 200);

    profRes = await fetch(`${baseUrl}/api/users/profile`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    prof = await profRes.json();
    assert.strictEqual(prof.data.avatar, null);
  });

  // -------------------------------------------------------------------------
  // 4. Security & RBAC Isolation
  // -------------------------------------------------------------------------
  it('Security: unauthenticated requests are rejected with 401', async () => {
    const res = await fetch(`${baseUrl}/api/users/avatar`, {
      method: 'DELETE',
    });
    assert.strictEqual(res.status, 401);
  });

  it('Security: student cannot delete or overwrite another user\'s profile photo', async () => {
    // Upload photo for faculty first
    const formData = new FormData();
    const fileBlob = new Blob([samplePngBuffer], { type: 'image/png' });
    formData.append('avatar', fileBlob, 'faculty_test2.png');

    await fetch(`${baseUrl}/api/users/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: formData,
    });

    // Student attempts to delete faculty's avatar by forging userId
    await fetch(`${baseUrl}/api/users/avatar?userId=${facultyUserId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ userId: facultyUserId }),
    });

    // Faculty avatar should remain untouched!
    const profRes = await fetch(`${baseUrl}/api/users/profile`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    const prof = await profRes.json();
    assert.ok(prof.data.avatar, 'Faculty avatar should NOT be deleted by another user');

    // Clean up faculty avatar
    await fetch(`${baseUrl}/api/users/avatar`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });
});
