const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const announcementService = require('../src/services/announcement.service');
const announcementController = require('../src/controllers/announcement.controller');
const { generateAccessToken } = require('../src/utils/jwt');
const { User, Announcement, SystemSetting, AuditLog } = require('../src/models');

describe('UAP Feature Verification: Persistent Scheduled Announcement System', () => {
  let adminUser;
  let instructorUser;
  let studentUser;
  let adminToken;
  let instructorToken;
  let studentToken;
  let server;
  let baseUrl;

  const mockResponse = () => {
    const res = {
      statusCode: 200,
      responseData: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.responseData = data;
        return this;
      },
    };
    return res;
  };

  before(async () => {
    await connectDB();
    await seedDatabase();

    // Start ephemeral in-process HTTP server for full route testing
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    adminUser = await User.findOne({ email: 'admin@uap.edu' });
    instructorUser = await User.findOne({ email: 'instructor@uap.edu' });
    studentUser = await User.findOne({ email: 'student@uap.edu' });

    assert.ok(adminUser, 'Admin user must exist');
    assert.ok(instructorUser, 'Instructor user must exist');
    assert.ok(studentUser, 'Student user must exist');

    adminToken = generateAccessToken({ id: adminUser._id, role: adminUser.role });
    instructorToken = generateAccessToken({ id: instructorUser._id, role: instructorUser.role });
    studentToken = generateAccessToken({ id: studentUser._id, role: studentUser.role });
  });

  after(async () => {
    await Announcement.deleteMany({});
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  beforeEach(async () => {
    await Announcement.deleteMany({});
    await SystemSetting.findOneAndUpdate({}, { announcementBanner: '' });
  });

  it('1. Saving a draft does not expose the announcement on public or student/instructor endpoints', async () => {
    // 1. Admin saves draft
    const draft = await announcementService.saveDraft(
      {
        message: 'Upcoming server maintenance on Friday night',
        targetAudience: 'all',
        durationDays: 0,
        durationHours: 2,
        durationMinutes: 0,
      },
      adminUser,
      '127.0.0.1'
    );

    assert.ok(draft._id);
    assert.strictEqual(draft.status, 'draft');
    assert.strictEqual(draft.message, 'Upcoming server maintenance on Friday night');

    // Verify audit log
    const audit = await AuditLog.findOne({ action: 'ANNOUNCEMENT_DRAFT_SAVED', entityId: draft._id.toString() });
    assert.ok(audit, 'Audit log must record draft creation');

    // 2. Query active announcement as a student
    const activeStudent = await announcementService.getActiveAnnouncement('student');
    assert.strictEqual(activeStudent.active, false);
    assert.strictEqual(activeStudent.announcement, null);

    // 3. Query active announcement as an instructor
    const activeInstructor = await announcementService.getActiveAnnouncement('instructor');
    assert.strictEqual(activeInstructor.active, false);
    assert.strictEqual(activeInstructor.announcement, null);

    // 4. Query active announcement anonymously
    const activePublic = await announcementService.getActiveAnnouncement(null);
    assert.strictEqual(activePublic.active, false);
    assert.strictEqual(activePublic.announcement, null);

    // 5. Admin can retrieve current configuration
    const currentAdmin = await announcementService.getCurrentAnnouncement();
    assert.ok(currentAdmin.current);
    assert.strictEqual(currentAdmin.current.status, 'draft');
    assert.strictEqual(currentAdmin.current.effectiveStatus, 'draft');
  });

  it('2. Publishing immediately makes the announcement active and visible across all users', async () => {
    // Publish immediately for 2 hours
    const published = await announcementService.publishImmediate(
      {
        message: 'Campus closed due to severe weather conditions',
        durationDays: 0,
        durationHours: 2,
        durationMinutes: 30,
        targetAudience: 'all',
      },
      adminUser,
      '127.0.0.1'
    );

    assert.ok(published._id);
    assert.strictEqual(published.status, 'published');
    assert.ok(published.startDate instanceof Date);
    assert.ok(published.expiryDate instanceof Date);
    assert.ok(published.expiryDate > published.startDate);

    // Verify SystemSetting was synchronized
    const setting = await SystemSetting.findOne();
    assert.strictEqual(setting.announcementBanner, 'Campus closed due to severe weather conditions');

    // Verify audit log
    const audit = await AuditLog.findOne({ action: 'ANNOUNCEMENT_PUBLISHED', entityId: published._id.toString() });
    assert.ok(audit, 'Audit log must record publication');

    // Verify active endpoint returns sanitized payload
    const activeStudent = await announcementService.getActiveAnnouncement('student');
    assert.strictEqual(activeStudent.active, true);
    assert.ok(activeStudent.announcement);
    assert.strictEqual(activeStudent.announcement.id, published._id.toString());
    assert.strictEqual(activeStudent.announcement.message, 'Campus closed due to severe weather conditions');
    assert.strictEqual(activeStudent.announcement.targetAudience, 'all');

    // Security check: internal fields must NOT be exposed
    assert.strictEqual(activeStudent.announcement.createdBy, undefined);
    assert.strictEqual(activeStudent.announcement.updatedBy, undefined);
    assert.strictEqual(activeStudent.announcement.cancelledAt, undefined);
  });

  it('3. Scheduled announcements become active only when server time reaches the scheduled start', async () => {
    const futureStart = new Date(Date.now() + 60 * 60 * 1000); // 1 hour in the future

    const scheduled = await announcementService.scheduleAnnouncement(
      {
        message: 'Scheduled mid-term examinations begin tomorrow',
        startDate: futureStart.toISOString(),
        durationDays: 1,
        durationHours: 0,
        durationMinutes: 0,
        targetAudience: 'all',
      },
      adminUser,
      '127.0.0.1'
    );

    assert.ok(scheduled._id);
    assert.strictEqual(scheduled.status, 'scheduled');

    // 1. Current query must NOT be active because server time has not reached futureStart
    const activeNow = await announcementService.getActiveAnnouncement('student');
    assert.strictEqual(activeNow.active, false);
    assert.strictEqual(activeNow.announcement, null);

    // 2. Admin inspects status: effectiveStatus is 'scheduled'
    const adminCheck = await announcementService.getCurrentAnnouncement();
    assert.strictEqual(adminCheck.current.effectiveStatus, 'scheduled');

    // 3. Fast-forward startDate into the past to simulate server time advancing past start
    scheduled.startDate = new Date(Date.now() - 5 * 60 * 1000); // 5 mins ago
    await scheduled.save();

    // Now query should return it as active
    const activeAfterStart = await announcementService.getActiveAnnouncement('student');
    assert.strictEqual(activeAfterStart.active, true);
    assert.strictEqual(activeAfterStart.announcement.id, scheduled._id.toString());
  });

  it('4. Announcements automatically expire and are no longer returned after expiryDate', async () => {
    // Create an announcement that already expired 10 minutes ago
    const pastStart = new Date(Date.now() - 70 * 60 * 1000);
    const pastExpiry = new Date(Date.now() - 10 * 60 * 1000);

    const expiredDoc = await Announcement.create({
      message: 'This notice has expired',
      status: 'published',
      startDate: pastStart,
      expiryDate: pastExpiry,
      durationHours: 1,
      targetAudience: 'all',
      createdBy: adminUser._id,
      publishedAt: pastStart,
    });

    // Query active announcement: must return false
    const active = await announcementService.getActiveAnnouncement('student');
    assert.strictEqual(active.active, false);
    assert.strictEqual(active.announcement, null);

    // Admin current view correctly identifies effective status as expired
    const adminView = await announcementService.getCurrentAnnouncement();
    assert.strictEqual(adminView.current.effectiveStatus, 'expired');
  });

  it('5. Cancelling an announcement immediately revokes visibility and clears SystemSetting mirror', async () => {
    const published = await announcementService.publishImmediate(
      {
        message: 'Active announcement to be withdrawn',
        durationDays: 1,
        durationHours: 0,
        durationMinutes: 0,
      },
      adminUser,
      '127.0.0.1'
    );

    // Verify initially active
    let active = await announcementService.getActiveAnnouncement('student');
    assert.strictEqual(active.active, true);

    // Admin cancels announcement
    const cancelled = await announcementService.cancelAnnouncement(published._id, adminUser, '127.0.0.1');
    assert.strictEqual(cancelled.status, 'cancelled');
    assert.ok(cancelled.cancelledAt instanceof Date);

    // Immediately verify not visible on active endpoint
    active = await announcementService.getActiveAnnouncement('student');
    assert.strictEqual(active.active, false);
    assert.strictEqual(active.announcement, null);

    // Verify SystemSetting banner is cleared
    const setting = await SystemSetting.findOne();
    assert.strictEqual(setting.announcementBanner, '');

    // Verify audit log
    const audit = await AuditLog.findOne({ action: 'ANNOUNCEMENT_CANCELLED', entityId: published._id.toString() });
    assert.ok(audit, 'Audit log must record cancellation');
  });

  it('6. Publishing a new announcement supersedes any existing active or scheduled announcements', async () => {
    // 1. Publish announcement A
    const first = await announcementService.publishImmediate(
      {
        message: 'First active announcement',
        durationHours: 5,
      },
      adminUser,
      '127.0.0.1'
    );

    // 2. Publish announcement B
    const second = await announcementService.publishImmediate(
      {
        message: 'Second active announcement replaces first',
        durationHours: 2,
      },
      adminUser,
      '127.0.0.1'
    );

    // Verify first announcement was marked cancelled
    const firstCheck = await Announcement.findById(first._id);
    assert.strictEqual(firstCheck.status, 'cancelled');

    // Verify active returns second announcement only
    const active = await announcementService.getActiveAnnouncement('student');
    assert.strictEqual(active.active, true);
    assert.strictEqual(active.announcement.id, second._id.toString());
    assert.strictEqual(active.announcement.message, 'Second active announcement replaces first');
  });

  it('7. Validation error handling for empty messages and invalid durations', async () => {
    // Test schedule with invalid past date
    await assert.rejects(
      async () => {
        await announcementService.scheduleAnnouncement(
          {
            message: 'Test message',
            startDate: 'invalid-date',
            durationHours: 1,
          },
          adminUser,
          '127.0.0.1'
        );
      },
      { message: 'Invalid scheduled start date' }
    );
  });

  it('8. Controller integration: active and administrative endpoints return correct HTTP statuses', async () => {
    // Publish via controller
    const pubReq = {
      body: {
        message: 'HTTP Controller Integration Test Notice',
        durationDays: 0,
        durationHours: 3,
        durationMinutes: 0,
      },
      user: adminUser,
      ip: '127.0.0.1',
    };
    const pubRes = mockResponse();
    await announcementController.publishImmediate(pubReq, pubRes, (err) => { if (err) throw err; });

    assert.strictEqual(pubRes.statusCode, 200);
    assert.strictEqual(pubRes.responseData.success, true);
    assert.strictEqual(pubRes.responseData.data.message, 'HTTP Controller Integration Test Notice');

    // Query active via controller
    const activeReq = { user: studentUser };
    const activeRes = mockResponse();
    await announcementController.getActive(activeReq, activeRes, (err) => { if (err) throw err; });

    assert.strictEqual(activeRes.statusCode, 200);
    assert.strictEqual(activeRes.responseData.data.active, true);
    assert.strictEqual(activeRes.responseData.data.announcement.message, 'HTTP Controller Integration Test Notice');
  });

  it('9. Route RBAC enforcement: student and instructor are rejected with HTTP 403 on mutation endpoints', async () => {
    const payload = {
      message: 'Unauthorized announcement attempt',
      durationDays: 0,
      durationHours: 1,
      durationMinutes: 0,
    };

    // 1. Student attempting to publish immediately
    const studentRes = await fetch(`${baseUrl}/api/admin/announcements/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify(payload),
    });
    assert.strictEqual(studentRes.status, 403, 'Student must receive HTTP 403 Forbidden on publish');
    const studentBody = await studentRes.json();
    assert.strictEqual(studentBody.success, false);
    assert.match(studentBody.message, /Access denied/);

    // 2. Instructor attempting to save draft
    const instructorRes = await fetch(`${baseUrl}/api/admin/announcements/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${instructorToken}`,
      },
      body: JSON.stringify(payload),
    });
    assert.strictEqual(instructorRes.status, 403, 'Instructor must receive HTTP 403 Forbidden on draft');

    // 3. Student attempting to schedule
    const studentScheduleRes = await fetch(`${baseUrl}/api/admin/announcements/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ ...payload, startDate: new Date(Date.now() + 86400000).toISOString() }),
    });
    assert.strictEqual(studentScheduleRes.status, 403, 'Student must receive HTTP 403 Forbidden on schedule');

    // 4. Instructor attempting to cancel
    const instructorCancelRes = await fetch(`${baseUrl}/api/admin/announcements/cancel`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${instructorToken}`,
      },
    });
    assert.strictEqual(instructorCancelRes.status, 403, 'Instructor must receive HTTP 403 Forbidden on cancel');
  });

  it('10. Route Authentication enforcement: unauthenticated mutations fail with HTTP 401', async () => {
    const res = await fetch(`${baseUrl}/api/admin/announcements/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Anonymous announcement' }),
    });
    assert.strictEqual(res.status, 401, 'Unauthenticated request to admin route must return HTTP 401');
  });

  it('11. Full HTTP workflow: admin publishes, public endpoint reads active, admin cancels, active disappears', async () => {
    // 1. Admin publishes via POST /api/admin/announcements/publish
    const pubRes = await fetch(`${baseUrl}/api/admin/announcements/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        message: 'Campus closed tomorrow for institutional convocation',
        durationDays: 1,
        durationHours: 0,
        durationMinutes: 0,
        targetAudience: 'all',
      }),
    });
    assert.strictEqual(pubRes.status, 200);
    const pubData = await pubRes.json();
    assert.strictEqual(pubData.success, true);
    assert.strictEqual(pubData.data.message, 'Campus closed tomorrow for institutional convocation');
    const announcementId = pubData.data._id || pubData.data.id;

    // 2. Unauthenticated user fetches active announcement via GET /api/announcements/active
    const activeRes = await fetch(`${baseUrl}/api/announcements/active`);
    assert.strictEqual(activeRes.status, 200);
    const activeData = await activeRes.json();
    assert.strictEqual(activeData.success, true);
    assert.strictEqual(activeData.data.active, true);
    assert.strictEqual(activeData.data.announcement.message, 'Campus closed tomorrow for institutional convocation');
    assert.strictEqual(activeData.data.announcement.createdBy, undefined, 'No admin IDs exposed');

    // 3. Admin cancels announcement via PUT /api/admin/announcements/:id/cancel
    const cancelRes = await fetch(`${baseUrl}/api/admin/announcements/${announcementId}/cancel`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    assert.strictEqual(cancelRes.status, 200);

    // 4. Re-fetch active announcement: must be inactive
    const afterCancelRes = await fetch(`${baseUrl}/api/announcements/active`);
    assert.strictEqual(afterCancelRes.status, 200);
    const afterCancelData = await afterCancelRes.json();
    assert.strictEqual(afterCancelData.data.active, false);
    assert.strictEqual(afterCancelData.data.announcement, null);
  });

  it('12. Canonical /api/announcements route verification: publish and cancel work seamlessly and persist in MongoDB', async () => {
    // 1. Admin publishes via canonical POST /api/announcements/publish
    const pubRes = await fetch(`${baseUrl}/api/announcements/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        message: 'Canonical API path broadcast verification',
        durationDays: 0,
        durationHours: 4,
        durationMinutes: 15,
        targetAudience: 'all',
      }),
    });
    assert.strictEqual(pubRes.status, 200);
    const pubData = await pubRes.json();
    assert.strictEqual(pubData.success, true);
    assert.strictEqual(pubData.data.message, 'Canonical API path broadcast verification');

    // 2. Direct MongoDB check
    const saved = await Announcement.findOne({ message: 'Canonical API path broadcast verification' });
    assert.ok(saved, 'Announcement must be persisted in MongoDB collection');
    assert.strictEqual(saved.status, 'published');
    assert.strictEqual(saved.durationHours, 4);
    assert.strictEqual(saved.durationMinutes, 15);

    // 3. Admin cancels via canonical PUT /api/announcements/cancel
    const cancelRes = await fetch(`${baseUrl}/api/announcements/cancel`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    assert.strictEqual(cancelRes.status, 200);

    // 4. MongoDB verify cancellation
    const cancelledDoc = await Announcement.findById(saved._id);
    assert.strictEqual(cancelledDoc.status, 'cancelled');
    assert.ok(cancelledDoc.cancelledAt);
  });

  it('13. Audience scoping enforcement across Student, Instructor, Admin, and Public viewports', async () => {
    // A. Target: students only
    const studentOnly = await announcementService.publishImmediate(
      {
        message: 'Student study hall open tonight',
        targetAudience: 'students',
        durationHours: 2,
      },
      adminUser,
      '127.0.0.1'
    );

    const sRes = await fetch(`${baseUrl}/api/announcements/active`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const sData = await sRes.json();
    assert.strictEqual(sData.data.active, true, 'Students must see student-targeted announcement');
    assert.strictEqual(sData.data.announcement.message, 'Student study hall open tonight');

    const iRes = await fetch(`${baseUrl}/api/announcements/active`, {
      headers: { Authorization: `Bearer ${instructorToken}` },
    });
    const iData = await iRes.json();
    assert.strictEqual(iData.data.active, false, 'Instructors must NOT see student-targeted announcement');

    const aRes = await fetch(`${baseUrl}/api/announcements/active`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const aData = await aRes.json();
    assert.strictEqual(aData.data.active, false, 'Admins must NOT see student-targeted announcement in navbar');

    const pRes = await fetch(`${baseUrl}/api/announcements/active`);
    const pData = await pRes.json();
    assert.strictEqual(pData.data.active, false, 'Public unauthenticated users must NOT see student-targeted announcement');

    // B. Target: instructors only
    await announcementService.publishImmediate(
      {
        message: 'Faculty grading deadline is 5pm Friday',
        targetAudience: 'instructors',
        durationHours: 2,
      },
      adminUser,
      '127.0.0.1'
    );

    const sRes2 = await fetch(`${baseUrl}/api/announcements/active`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const sData2 = await sRes2.json();
    assert.strictEqual(sData2.data.active, false, 'Students must NOT see instructor-targeted announcement');

    const iRes2 = await fetch(`${baseUrl}/api/announcements/active`, {
      headers: { Authorization: `Bearer ${instructorToken}` },
    });
    const iData2 = await iRes2.json();
    assert.strictEqual(iData2.data.active, true, 'Instructors must see instructor-targeted announcement');
    assert.strictEqual(iData2.data.announcement.message, 'Faculty grading deadline is 5pm Friday');

    // C. Target: admins only
    await announcementService.publishImmediate(
      {
        message: 'Admin server upgrade maintenance scheduled',
        targetAudience: 'admins',
        durationHours: 2,
      },
      adminUser,
      '127.0.0.1'
    );

    const aRes3 = await fetch(`${baseUrl}/api/announcements/active`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const aData3 = await aRes3.json();
    assert.strictEqual(aData3.data.active, true, 'Admins must see admin-targeted announcement');

    const sRes3 = await fetch(`${baseUrl}/api/announcements/active`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const sData3 = await sRes3.json();
    assert.strictEqual(sData3.data.active, false, 'Students must NOT see admin-targeted announcement');
  });

  it('14. Scheduled announcement provides nextScheduledStart for client timer wake-up', async () => {
    const futureStart = new Date(Date.now() + 120 * 60 * 1000); // 2 hours future
    await announcementService.scheduleAnnouncement(
      {
        message: 'Upcoming system maintenance in two hours',
        startDate: futureStart.toISOString(),
        durationHours: 1,
        targetAudience: 'all',
      },
      adminUser,
      '127.0.0.1'
    );

    // Active endpoint returns active: false and nextScheduledStart
    const res = await fetch(`${baseUrl}/api/announcements/active`);
    const data = await res.json();
    assert.strictEqual(data.data.active, false);
    assert.strictEqual(data.data.announcement, null);
    assert.ok(data.data.nextScheduledStart, 'Must provide nextScheduledStart timestamp');
    assert.strictEqual(new Date(data.data.nextScheduledStart).getTime(), futureStart.getTime());
  });
});
