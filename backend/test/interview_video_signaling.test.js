const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const app = require('../src/app');
const { attachInterviewSignaling, interviewSignaling } = require('../src/realtime/interviewSignaling');
const { generateAccessToken } = require('../src/utils/jwt');
const {
  User,
  Interview,
  InterviewSession,
  AuditLog,
} = require('../src/models');

function connectWs(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const messages = [];
    const waiters = [];

    ws.addEventListener('message', (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        data = event.data;
      }
      if (waiters.length > 0) {
        const idx = waiters.findIndex((w) => w.predicate(data));
        if (idx !== -1) {
          const [waiter] = waiters.splice(idx, 1);
          clearTimeout(waiter.timer);
          waiter.resolve(data);
          return;
        }
      }
      messages.push(data);
    });

    const helper = {
      ws,
      sendJson: (obj) => ws.send(JSON.stringify(obj)),
      nextMessage: (predicate = () => true, timeoutMs = 4000) => {
        const existingIdx = messages.findIndex(predicate);
        if (existingIdx !== -1) {
          return Promise.resolve(messages.splice(existingIdx, 1)[0]);
        }
        return new Promise((res, rej) => {
          const timer = setTimeout(() => {
            const idx = waiters.findIndex((w) => w.timer === timer);
            if (idx !== -1) waiters.splice(idx, 1);
            rej(new Error('Timed out waiting for WebSocket message'));
          }, timeoutMs);
          waiters.push({ predicate, resolve: res, timer });
        });
      },
      waitClose: (timeoutMs = 4000) => {
        if (ws.readyState === WebSocket.CLOSED) {
          return Promise.resolve({ code: 1000 });
        }
        return new Promise((res, rej) => {
          const timer = setTimeout(() => rej(new Error('Timed out waiting for WS close')), timeoutMs);
          ws.addEventListener(
            'close',
            (ev) => {
              clearTimeout(timer);
              res({ code: ev.code, reason: ev.reason });
            },
            { once: true }
          );
        });
      },
      close: () => {
        try {
          ws.close();
        } catch {
          // ignore
        }
      },
    };

    ws.addEventListener('open', () => resolve(helper), { once: true });
    ws.addEventListener('error', (err) => reject(err), { once: true });
  });
}

describe('UAP Two-Way Video WebRTC Signaling & Faculty Media Control', () => {
  let server;
  let baseUrl;
  let wsUrl;
  let student1;
  let student2;
  let instructor1;
  let instructor2;
  let student1Token;
  let student2Token;
  let instructor1Token;
  let instructor2Token;
  let interviewId;
  let draftInterviewId;

  before(async () => {
    await connectDB();
    await seedDatabase();

    student1 = await User.findOne({ email: 'student@uap.edu' });
    student2 = await User.findOne({ email: 'alice@uap.edu' });
    instructor1 = await User.findOne({ email: 'instructor@uap.edu' });

    await User.deleteOne({ email: 'instructor2_ws@uap.edu' });
    instructor2 = await User.create({
      name: 'Foreign Faculty',
      email: 'instructor2_ws@uap.edu',
      password: 'Password@123',
      role: 'instructor',
      facultyId: 'FAC-WS-999',
      status: 'active',
      isActive: true,
    });

    student1Token = generateAccessToken({
      id: student1._id.toString(),
      role: 'student',
      email: student1.email,
      tokenVersion: student1.tokenVersion || 0,
    });
    student2Token = generateAccessToken({
      id: student2._id.toString(),
      role: 'student',
      email: student2.email,
      tokenVersion: student2.tokenVersion || 0,
    });
    instructor1Token = generateAccessToken({
      id: instructor1._id.toString(),
      role: 'instructor',
      email: instructor1.email,
      tokenVersion: instructor1.tokenVersion || 0,
    });
    instructor2Token = generateAccessToken({
      id: instructor2._id.toString(),
      role: 'instructor',
      email: instructor2.email,
      tokenVersion: instructor2.tokenVersion || 0,
    });

    server = http.createServer(app);
    attachInterviewSignaling(server);

    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        wsUrl = `ws://127.0.0.1:${port}/api/interviews/ws`;
        resolve();
      });
    });

    // Create a ready interview and a draft interview
    const res1 = await fetch(`${baseUrl}/api/interviews`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${instructor1Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Live Two-Way Video Viva',
        interviewType: 'viva',
        studentId: student1._id.toString(),
        status: 'ready',
        questions: [{ questionText: 'Describe WebRTC ICE.', maxMarks: 10 }],
      }),
    });
    assert.strictEqual(res1.status, 201);
    interviewId = (await res1.json()).data.id;

    const res2 = await fetch(`${baseUrl}/api/interviews`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${instructor1Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Draft Hidden Viva',
        interviewType: 'technical',
        studentId: student1._id.toString(),
        status: 'draft',
        questions: [{ questionText: 'Draft Q1', maxMarks: 10 }],
      }),
    });
    assert.strictEqual(res2.status, 201);
    draftInterviewId = (await res2.json()).data.id;
  });

  after(async () => {
    interviewSignaling.closeAll();
    for (const id of [interviewId, draftInterviewId].filter(Boolean)) {
      await InterviewSession.deleteMany({ interviewId: id });
      await AuditLog.deleteMany({ entityId: id });
      await Interview.deleteOne({ _id: id });
    }
    await User.deleteOne({ email: 'instructor2_ws@uap.edu' });
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  it('1. Rejects unauthenticated, foreign student, foreign faculty, and draft student connections', async () => {
    // Invalid token
    const badClient = await connectWs(wsUrl);
    badClient.sendJson({ type: 'AUTH', token: 'invalid.jwt.token', interviewId });
    const badErr = await badClient.nextMessage((m) => m.type === 'SIGNAL_ERROR');
    assert.strictEqual(badErr.code, 'INVALID_TOKEN');
    const badClose = await badClient.waitClose();
    assert.strictEqual(badClose.code, 4001);

    // Foreign student
    const foreignStu = await connectWs(wsUrl);
    foreignStu.sendJson({ type: 'AUTH', token: student2Token, interviewId });
    const stuErr = await foreignStu.nextMessage((m) => m.type === 'SIGNAL_ERROR');
    assert.strictEqual(stuErr.code, 'FORBIDDEN');
    const stuClose = await foreignStu.waitClose();
    assert.strictEqual(stuClose.code, 4003);

    // Foreign faculty
    const foreignFac = await connectWs(wsUrl);
    foreignFac.sendJson({ type: 'AUTH', token: instructor2Token, interviewId });
    const facErr = await foreignFac.nextMessage((m) => m.type === 'SIGNAL_ERROR');
    assert.strictEqual(facErr.code, 'FORBIDDEN');
    const facClose = await foreignFac.waitClose();
    assert.strictEqual(facClose.code, 4003);

    // Assigned student cannot join draft interview
    const draftStu = await connectWs(wsUrl);
    draftStu.sendJson({ type: 'AUTH', token: student1Token, interviewId: draftInterviewId });
    const draftErr = await draftStu.nextMessage((m) => m.type === 'SIGNAL_ERROR');
    assert.strictEqual(draftErr.code, 'FORBIDDEN');
    await draftStu.waitClose();
  });

  it('2. Rejects faculty media-control commands before interview session is active (in_progress)', async () => {
    const facultyClient = await connectWs(wsUrl);
    facultyClient.sendJson({ type: 'AUTH', token: instructor1Token, interviewId });
    const authOk = await facultyClient.nextMessage((m) => m.type === 'AUTH_OK');
    assert.strictEqual(authOk.role, 'faculty');
    assert.strictEqual(authOk.interviewStatus, 'ready');

    facultyClient.sendJson({ type: 'MEDIA_CONTROL', command: 'STUDENT_CAMERA_DISABLE' });
    const errMsg = await facultyClient.nextMessage((m) => m.type === 'SIGNAL_ERROR');
    assert.strictEqual(errMsg.code, 'MEDIA_CONTROL_REJECTED');
    assert.match(errMsg.message, /in-progress/i);

    facultyClient.close();
    await facultyClient.waitClose();
  });

  it('3. Relays WebRTC SDP/ICE with server-verified roles and enforces faculty-only student media controls', async () => {
    // Activate session via REST
    const startRes = await fetch(`${baseUrl}/api/interviews/${interviewId}/session/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${instructor1Token}` },
    });
    assert.strictEqual(startRes.status, 200);

    const facultyClient = await connectWs(wsUrl);
    facultyClient.sendJson({ type: 'AUTH', token: instructor1Token, interviewId });
    const facAuth = await facultyClient.nextMessage((m) => m.type === 'AUTH_OK');
    assert.strictEqual(facAuth.role, 'faculty');
    assert.strictEqual(facAuth.peerOnline, false);

    const studentClient = await connectWs(wsUrl);
    studentClient.sendJson({ type: 'AUTH', token: student1Token, interviewId });
    const stuAuth = await studentClient.nextMessage((m) => m.type === 'AUTH_OK');
    assert.strictEqual(stuAuth.role, 'student');
    assert.strictEqual(stuAuth.peerOnline, true);
    assert.deepStrictEqual(stuAuth.studentMediaControl, { cameraEnabled: true, micEnabled: true });

    const peerJoined = await facultyClient.nextMessage((m) => m.type === 'PEER_JOINED');
    assert.strictEqual(peerJoined.role, 'student');

    // WebRTC Offer / Answer / ICE relay with server-stamped fromRole
    facultyClient.sendJson({
      type: 'WEBRTC_OFFER',
      fromRole: 'student', // attempted spoof should be overwritten
      sdp: { type: 'offer', sdp: 'v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\n' },
    });
    const relayedOffer = await studentClient.nextMessage((m) => m.type === 'WEBRTC_OFFER');
    assert.strictEqual(relayedOffer.fromRole, 'faculty');
    assert.strictEqual(relayedOffer.sdp.type, 'offer');

    studentClient.sendJson({
      type: 'WEBRTC_ANSWER',
      fromRole: 'faculty', // attempted spoof should be overwritten
      sdp: { type: 'answer', sdp: 'v=0\r\no=- 456 2 IN IP4 127.0.0.1\r\n' },
    });
    const relayedAnswer = await facultyClient.nextMessage((m) => m.type === 'WEBRTC_ANSWER');
    assert.strictEqual(relayedAnswer.fromRole, 'student');
    assert.strictEqual(relayedAnswer.sdp.type, 'answer');

    studentClient.sendJson({
      type: 'WEBRTC_ICE_CANDIDATE',
      candidate: { candidate: 'candidate:1 1 UDP 2122252543 127.0.0.1 50000 typ host', sdpMid: '0' },
    });
    const relayedIce = await facultyClient.nextMessage((m) => m.type === 'WEBRTC_ICE_CANDIDATE');
    assert.strictEqual(relayedIce.fromRole, 'student');
    assert.ok(relayedIce.candidate.candidate.includes('typ host'));

    // Student CANNOT send faculty media-control commands over WS or REST
    studentClient.sendJson({ type: 'MEDIA_CONTROL', command: 'STUDENT_CAMERA_DISABLE' });
    const stuForbidden = await studentClient.nextMessage((m) => m.type === 'SIGNAL_ERROR');
    assert.strictEqual(stuForbidden.code, 'FORBIDDEN');

    const stuRestForbidden = await fetch(`${baseUrl}/api/interviews/${interviewId}/session/media-control`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${student1Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ command: 'STUDENT_CAMERA_DISABLE' }),
    });
    assert.strictEqual(stuRestForbidden.status, 403);

    // Faculty sends all 4 media-control commands and student receives them
    const commands = [
      { cmd: 'STUDENT_CAMERA_DISABLE', expected: { cameraEnabled: false, micEnabled: true } },
      { cmd: 'STUDENT_MIC_DISABLE', expected: { cameraEnabled: false, micEnabled: false } },
      { cmd: 'STUDENT_CAMERA_ENABLE', expected: { cameraEnabled: true, micEnabled: false } },
      { cmd: 'STUDENT_MIC_ENABLE', expected: { cameraEnabled: true, micEnabled: true } },
    ];

    for (const { cmd, expected } of commands) {
      facultyClient.sendJson({ type: 'MEDIA_CONTROL', command: cmd });
      const ack = await facultyClient.nextMessage((m) => m.type === 'MEDIA_CONTROL_ACK');
      assert.strictEqual(ack.command, cmd);
      assert.strictEqual(ack.deliveredToStudent, true);
      assert.deepStrictEqual(ack.studentMediaControl, expected);

      const delivered = await studentClient.nextMessage((m) => m.type === 'MEDIA_CONTROL_COMMAND');
      assert.strictEqual(delivered.command, cmd);
      assert.deepStrictEqual(delivered.studentMediaControl, expected);
    }

    // Student media status & failure notification reaches faculty
    studentClient.sendJson({
      type: 'MEDIA_STATUS_UPDATE',
      cameraEnabled: false,
      micEnabled: true,
      cameraPermission: 'denied',
      micPermission: 'granted',
    });
    const peerState = await facultyClient.nextMessage((m) => m.type === 'PEER_MEDIA_STATE');
    assert.strictEqual(peerState.role, 'student');
    assert.strictEqual(peerState.state.cameraPermission, 'denied');

    studentClient.sendJson({
      type: 'MEDIA_COMMAND_FAILED',
      command: 'STUDENT_CAMERA_ENABLE',
      code: 'PERMISSION_DENIED',
      reason: 'Student camera permission denied by browser.',
    });
    const stuErrToFac = await facultyClient.nextMessage((m) => m.type === 'STUDENT_MEDIA_ERROR');
    assert.strictEqual(stuErrToFac.code, 'PERMISSION_DENIED');

    // Completing interview broadcasts SESSION_ENDED and closes both sockets
    const compRes = await fetch(`${baseUrl}/api/interviews/${interviewId}/session/complete`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${instructor1Token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'complete' }),
    });
    assert.strictEqual(compRes.status, 200);

    const [facEnded, stuEnded] = await Promise.all([
      facultyClient.nextMessage((m) => m.type === 'SESSION_ENDED'),
      studentClient.nextMessage((m) => m.type === 'SESSION_ENDED'),
    ]);
    assert.strictEqual(facEnded.status, 'completed');
    assert.strictEqual(stuEnded.status, 'completed');

    await Promise.all([facultyClient.waitClose(), studentClient.waitClose()]);

    // Reconnecting after completion sends SESSION_ENDED and closes
    const postEndClient = await connectWs(wsUrl);
    postEndClient.sendJson({ type: 'AUTH', token: instructor1Token, interviewId });
    const postEnded = await postEndClient.nextMessage((m) => m.type === 'SESSION_ENDED');
    assert.strictEqual(postEnded.status, 'completed');
    await postEndClient.waitClose();
  });
});
