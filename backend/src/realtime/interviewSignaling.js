const crypto = require('crypto');
const mongoose = require('mongoose');
const { verifyAccessToken } = require('../utils/jwt');
const { isOriginAllowed } = require('../utils/origin');
const { User, Interview, InterviewSession, AuditLog } = require('../models');
const logger = require('../utils/logger');

const WS_PATH = '/api/interviews/ws';
const WS_MAGIC_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_PAYLOAD_BYTES = 256 * 1024; // 256 KB ceiling for JSON signaling messages (no raw media)
const AUTH_TIMEOUT_MS = 10000;
const HEARTBEAT_INTERVAL_MS = 25000;

const MEDIA_CONTROL_COMMANDS = new Set([
  'STUDENT_CAMERA_ENABLE',
  'STUDENT_CAMERA_DISABLE',
  'STUDENT_MIC_ENABLE',
  'STUDENT_MIC_DISABLE',
]);

const RELAY_SIGNAL_TYPES = new Set([
  'WEBRTC_OFFER',
  'WEBRTC_ANSWER',
  'WEBRTC_ICE_CANDIDATE',
]);

/**
 * Encodes an RFC 6455 unmasked server-to-client WebSocket frame.
 */
function encodeWsFrame(opcode, payloadBuf = Buffer.alloc(0)) {
  const len = payloadBuf.length;
  let header;
  if (len < 126) {
    header = Buffer.allocUnsafe(2);
    header[0] = 0x80 | opcode;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.allocUnsafe(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.allocUnsafe(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payloadBuf]);
}

function sendWsClose(socket, code = 1000, reason = '') {
  if (!socket || socket.destroyed || !socket.writable) return;
  try {
    const reasonBuf = Buffer.from(String(reason).slice(0, 120), 'utf8');
    const payload = Buffer.allocUnsafe(2 + reasonBuf.length);
    payload.writeUInt16BE(code, 0);
    reasonBuf.copy(payload, 2);
    socket.end(encodeWsFrame(0x8, payload));
  } catch {
    try {
      socket.destroy();
    } catch {
      // ignore
    }
  }
}

function sendWsJson(socket, data) {
  if (!socket || socket.destroyed || !socket.writable) return false;
  try {
    const buf = Buffer.from(JSON.stringify(data), 'utf8');
    socket.write(encodeWsFrame(0x1, buf));
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves institutional identifier string safely for display & signaling metadata.
 */
function resolveInstitutionalId(user, role) {
  if (!user) return '';
  if (role === 'faculty') {
    return user.facultyId || user.email || String(user._id);
  }
  return user.studentId || user.email || String(user._id);
}

/**
 * Manages authenticated 1:1 WebSocket signaling rooms for UAP faculty interviews.
 * Uses Node's built-in http upgrade + RFC 6455 framing with zero external WS dependencies.
 */
class InterviewSignalingManager {
  constructor() {
    this.rooms = new Map(); // interviewId -> { faculty: conn | null, student: conn | null, peerMediaState: { faculty, student } }
    this.connections = new Set();
    this.attachedServers = new Set();
    this.heartbeatTimer = null;
  }

  attach(httpServer) {
    if (!httpServer || this.attachedServers.has(httpServer)) return;
    this.attachedServers.add(httpServer);

    httpServer.on('upgrade', (req, socket, head) => {
      this._handleUpgrade(req, socket, head);
    });

    if (!this.heartbeatTimer) {
      this.heartbeatTimer = setInterval(() => {
        this._runHeartbeat();
      }, HEARTBEAT_INTERVAL_MS);
      if (this.heartbeatTimer.unref) {
        this.heartbeatTimer.unref();
      }
    }
  }

  _runHeartbeat() {
    for (const conn of this.connections) {
      if (!conn.socket || conn.socket.destroyed || !conn.socket.writable) {
        this._cleanupConnection(conn);
        continue;
      }
      if (!conn.alive) {
        sendWsClose(conn.socket, 1001, 'Heartbeat timeout');
        this._cleanupConnection(conn);
        continue;
      }
      conn.alive = false;
      try {
        conn.socket.write(encodeWsFrame(0x9, Buffer.alloc(0)));
      } catch {
        this._cleanupConnection(conn);
      }
    }
  }

  _handleUpgrade(req, socket) {
    let pathname = '';
    try {
      const parsed = new URL(req.url || '/', 'http://localhost');
      pathname = parsed.pathname;
    } catch {
      socket.destroy();
      return;
    }

    if (pathname !== WS_PATH) {
      return;
    }

    const origin = req.headers.origin;
    if (origin && !isOriginAllowed(origin, process.env.NODE_ENV)) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    const upgradeHeader = String(req.headers.upgrade || '').toLowerCase();
    const wsKey = req.headers['sec-websocket-key'];
    if (upgradeHeader !== 'websocket' || !wsKey) {
      socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    const acceptKey = crypto
      .createHash('sha1')
      .update(`${wsKey}${WS_MAGIC_GUID}`)
      .digest('base64');

    const responseHeaders = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey}`,
      '\r\n',
    ].join('\r\n');

    socket.write(responseHeaders);
    socket.setNoDelay(true);

    // Optional Bearer token from upgrade header (used by Node test clients if desired)
    const authHeader = req.headers.authorization;
    const headerToken =
      authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1].trim() : null;

    const conn = {
      id: crypto.randomUUID(),
      socket,
      alive: true,
      authenticated: false,
      user: null,
      userId: null,
      role: null, // 'faculty' | 'student'
      interviewId: null,
      headerToken,
      buffer: Buffer.alloc(0),
      fragOpcode: null,
      fragChunks: [],
      fragSize: 0,
      closed: false,
      authTimer: null,
    };

    this.connections.add(conn);

    conn.authTimer = setTimeout(() => {
      if (!conn.authenticated && !conn.closed) {
        sendWsJson(socket, {
          type: 'SIGNAL_ERROR',
          code: 'AUTH_TIMEOUT',
          message: 'Authentication timed out.',
        });
        sendWsClose(socket, 4001, 'Authentication timeout');
        this._cleanupConnection(conn);
      }
    }, AUTH_TIMEOUT_MS);
    if (conn.authTimer.unref) {
      conn.authTimer.unref();
    }

    socket.on('data', (chunk) => {
      this._onData(conn, chunk);
    });
    socket.on('close', () => {
      this._cleanupConnection(conn);
    });
    socket.on('error', () => {
      this._cleanupConnection(conn);
    });
  }

  _onData(conn, chunk) {
    if (conn.closed) return;
    conn.buffer = Buffer.concat([conn.buffer, chunk]);

    while (conn.buffer.length >= 2) {
      const byte0 = conn.buffer[0];
      const byte1 = conn.buffer[1];
      const fin = (byte0 & 0x80) !== 0;
      const opcode = byte0 & 0x0f;
      const masked = (byte1 & 0x80) !== 0;
      let payloadLen = byte1 & 0x7f;
      let offset = 2;

      if (!masked) {
        sendWsClose(conn.socket, 1002, 'Client frames must be masked');
        this._cleanupConnection(conn);
        return;
      }

      if (payloadLen === 126) {
        if (conn.buffer.length < 4) return;
        payloadLen = conn.buffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLen === 127) {
        if (conn.buffer.length < 10) return;
        const bigLen = conn.buffer.readBigUInt64BE(2);
        if (bigLen > BigInt(MAX_PAYLOAD_BYTES)) {
          sendWsClose(conn.socket, 1009, 'Payload too large');
          this._cleanupConnection(conn);
          return;
        }
        payloadLen = Number(bigLen);
        offset = 10;
      }

      if (payloadLen > MAX_PAYLOAD_BYTES) {
        sendWsClose(conn.socket, 1009, 'Payload too large');
        this._cleanupConnection(conn);
        return;
      }

      const totalFrameLen = offset + 4 + payloadLen;
      if (conn.buffer.length < totalFrameLen) {
        return;
      }

      const maskKey = conn.buffer.subarray(offset, offset + 4);
      const maskedPayload = conn.buffer.subarray(offset + 4, totalFrameLen);
      const payload = Buffer.allocUnsafe(payloadLen);
      for (let i = 0; i < payloadLen; i++) {
        payload[i] = maskedPayload[i] ^ maskKey[i % 4];
      }

      conn.buffer = conn.buffer.subarray(totalFrameLen);
      conn.alive = true;

      if (opcode === 0x8) {
        // Close
        sendWsClose(conn.socket, 1000, 'Normal closure');
        this._cleanupConnection(conn);
        return;
      }
      if (opcode === 0x9) {
        // Ping -> Pong
        if (conn.socket.writable) {
          conn.socket.write(encodeWsFrame(0xA, payload));
        }
        continue;
      }
      if (opcode === 0xA) {
        // Pong
        continue;
      }

      if (opcode === 0x1 || opcode === 0x2) {
        if (fin) {
          this._handleRawMessage(conn, payload);
        } else {
          conn.fragOpcode = opcode;
          conn.fragChunks = [payload];
          conn.fragSize = payload.length;
        }
      } else if (opcode === 0x0) {
        if (conn.fragOpcode === null) {
          sendWsClose(conn.socket, 1002, 'Unexpected continuation frame');
          this._cleanupConnection(conn);
          return;
        }
        conn.fragSize += payload.length;
        if (conn.fragSize > MAX_PAYLOAD_BYTES) {
          sendWsClose(conn.socket, 1009, 'Fragmented message too large');
          this._cleanupConnection(conn);
          return;
        }
        conn.fragChunks.push(payload);
        if (fin) {
          const fullPayload = Buffer.concat(conn.fragChunks);
          conn.fragOpcode = null;
          conn.fragChunks = [];
          conn.fragSize = 0;
          this._handleRawMessage(conn, fullPayload);
        }
      }
    }
  }

  _handleRawMessage(conn, payloadBuf) {
    let msg;
    try {
      msg = JSON.parse(payloadBuf.toString('utf8'));
    } catch {
      sendWsJson(conn.socket, {
        type: 'SIGNAL_ERROR',
        code: 'INVALID_JSON',
        message: 'Signaling message must be valid JSON.',
      });
      return;
    }

    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') {
      sendWsJson(conn.socket, {
        type: 'SIGNAL_ERROR',
        code: 'INVALID_MESSAGE',
        message: 'Missing signaling message type.',
      });
      return;
    }

    this._handleMessage(conn, msg).catch((err) => {
      logger.warn('[InterviewSignaling] Message handler error: %s', err.message);
      sendWsJson(conn.socket, {
        type: 'SIGNAL_ERROR',
        code: err.code || 'SIGNAL_ERROR',
        message: err.message || 'Signaling error.',
      });
    });
  }

  async _handleMessage(conn, msg) {
    if (msg.type === 'PING') {
      sendWsJson(conn.socket, { type: 'PONG', timestamp: Date.now() });
      return;
    }

    if (msg.type === 'AUTH') {
      await this._handleAuth(conn, msg);
      return;
    }

    if (!conn.authenticated) {
      sendWsJson(conn.socket, {
        type: 'SIGNAL_ERROR',
        code: 'UNAUTHENTICATED',
        message: 'Authenticate before sending signaling messages.',
      });
      sendWsClose(conn.socket, 4001, 'Unauthenticated');
      this._cleanupConnection(conn);
      return;
    }

    if (msg.type === 'MEDIA_CONTROL' || MEDIA_CONTROL_COMMANDS.has(msg.type)) {
      const command = msg.type === 'MEDIA_CONTROL' ? msg.command : msg.type;
      await this._handleMediaControl(conn, command);
      return;
    }

    if (RELAY_SIGNAL_TYPES.has(msg.type)) {
      await this._handleWebRtcRelay(conn, msg);
      return;
    }

    if (msg.type === 'MEDIA_STATUS_UPDATE') {
      await this._handleMediaStatusUpdate(conn, msg);
      return;
    }

    if (msg.type === 'MEDIA_COMMAND_FAILED') {
      this._handleMediaCommandFailed(conn, msg);
      return;
    }

    if (msg.type === 'READY_FOR_CALL') {
      this._handleReadyForCall(conn);
      return;
    }

    sendWsJson(conn.socket, {
      type: 'SIGNAL_ERROR',
      code: 'UNSUPPORTED_EVENT',
      message: `Unsupported signaling event "${msg.type}".`,
    });
  }

  async _handleAuth(conn, msg) {
    const token = (typeof msg.token === 'string' && msg.token.trim()) || conn.headerToken;
    const interviewId = typeof msg.interviewId === 'string' ? msg.interviewId.trim() : '';

    if (!token || !mongoose.Types.ObjectId.isValid(interviewId)) {
      sendWsJson(conn.socket, {
        type: 'SIGNAL_ERROR',
        code: 'INVALID_AUTH',
        message: 'Valid authentication token and interviewId are required.',
      });
      sendWsClose(conn.socket, 4001, 'Invalid auth payload');
      this._cleanupConnection(conn);
      return;
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      sendWsJson(conn.socket, {
        type: 'SIGNAL_ERROR',
        code: 'INVALID_TOKEN',
        message: err.message || 'Invalid or expired access token.',
      });
      sendWsClose(conn.socket, 4001, 'Invalid token');
      this._cleanupConnection(conn);
      return;
    }

    const userId = decoded.id || decoded.sub;
    const user = await User.findById(userId).select(
      '_id name email role studentId facultyId status isActive tokenVersion'
    );
    if (!user || user.status !== 'active' || !user.isActive) {
      sendWsJson(conn.socket, {
        type: 'SIGNAL_ERROR',
        code: 'ACCOUNT_INACTIVE',
        message: 'User account is inactive or not found.',
      });
      sendWsClose(conn.socket, 4001, 'Inactive user');
      this._cleanupConnection(conn);
      return;
    }

    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== (user.tokenVersion || 0)) {
      sendWsJson(conn.socket, {
        type: 'SIGNAL_ERROR',
        code: 'SESSION_REVOKED',
        message: 'Session has been invalidated. Please sign in again.',
      });
      sendWsClose(conn.socket, 4001, 'Session revoked');
      this._cleanupConnection(conn);
      return;
    }

    const interview = await Interview.findById(interviewId)
      .populate('facultyId', 'name email facultyId')
      .populate('studentId', 'name email studentId');

    if (!interview) {
      sendWsJson(conn.socket, {
        type: 'SIGNAL_ERROR',
        code: 'NOT_FOUND',
        message: 'Interview not found.',
      });
      sendWsClose(conn.socket, 4004, 'Interview not found');
      this._cleanupConnection(conn);
      return;
    }

    const uid = user._id.toString();
    const facultyOwnerId = (interview.facultyId?._id || interview.facultyId).toString();
    const assignedStudentId = (interview.studentId?._id || interview.studentId).toString();

    let participantRole = null;
    if (user.role === 'admin' || (user.role === 'instructor' && facultyOwnerId === uid)) {
      participantRole = 'faculty';
    } else if (user.role === 'student' && assignedStudentId === uid && interview.status !== 'draft') {
      participantRole = 'student';
    }

    if (!participantRole) {
      sendWsJson(conn.socket, {
        type: 'SIGNAL_ERROR',
        code: 'FORBIDDEN',
        message: 'You are not authorized to join signaling for this interview.',
      });
      sendWsClose(conn.socket, 4003, 'Forbidden');
      this._cleanupConnection(conn);
      return;
    }

    if (['completed', 'cancelled'].includes(interview.status)) {
      sendWsJson(conn.socket, {
        type: 'SESSION_ENDED',
        status: interview.status,
        reason: `Interview has ${interview.status}.`,
      });
      sendWsClose(conn.socket, 4000, 'Interview ended');
      this._cleanupConnection(conn);
      return;
    }

    if (conn.authTimer) {
      clearTimeout(conn.authTimer);
      conn.authTimer = null;
    }

    conn.authenticated = true;
    conn.user = user;
    conn.userId = uid;
    conn.role = participantRole;
    conn.interviewId = interview._id.toString();

    const room = this._getOrCreateRoom(conn.interviewId);
    const prevConn = room[participantRole];
    if (prevConn && prevConn.id !== conn.id) {
      // Prevent duplicate ghost connections for the same participant role
      sendWsClose(prevConn.socket, 4008, 'Replaced by newer connection');
      this._detachFromRoom(prevConn);
    }
    room[participantRole] = conn;

    const latestSession = await InterviewSession.findOne({
      interviewId: interview._id,
      status: { $in: ['pending', 'active'] },
    }).sort({ createdAt: -1 });

    const studentMediaControl = latestSession?.studentMediaControl
      ? {
          cameraEnabled: latestSession.studentMediaControl.cameraEnabled !== false,
          micEnabled: latestSession.studentMediaControl.micEnabled !== false,
        }
      : { cameraEnabled: true, micEnabled: true };

    const peerRole = participantRole === 'faculty' ? 'student' : 'faculty';
    const peerConn = room[peerRole];

    const facultyProfile = {
      id: facultyOwnerId,
      name: interview.facultyId?.name || 'Faculty',
      institutionalId: resolveInstitutionalId(interview.facultyId, 'faculty'),
      role: 'faculty',
    };
    const studentProfile = {
      id: assignedStudentId,
      name: interview.studentId?.name || 'Student',
      institutionalId: resolveInstitutionalId(interview.studentId, 'student'),
      role: 'student',
    };

    const selfProfile = participantRole === 'faculty' ? facultyProfile : studentProfile;
    const peerProfile = participantRole === 'faculty' ? studentProfile : facultyProfile;

    sendWsJson(conn.socket, {
      type: 'AUTH_OK',
      interviewId: conn.interviewId,
      role: participantRole,
      interviewStatus: interview.status,
      self: selfProfile,
      peer: peerProfile,
      peerOnline: Boolean(peerConn && !peerConn.closed),
      studentMediaControl,
      peerMediaState: room.peerMediaState[peerRole] || null,
    });

    if (peerConn && !peerConn.closed) {
      sendWsJson(peerConn.socket, {
        type: 'PEER_JOINED',
        role: participantRole,
        participant: selfProfile,
        mediaState: room.peerMediaState[participantRole] || null,
      });
    }
  }

  async _handleMediaControl(conn, command) {
    if (!MEDIA_CONTROL_COMMANDS.has(command)) {
      sendWsJson(conn.socket, {
        type: 'SIGNAL_ERROR',
        code: 'INVALID_COMMAND',
        message: 'Unsupported student media control command.',
      });
      return;
    }

    // Strict server-side authorization: students cannot control media or send faculty commands
    if (conn.role !== 'faculty' || (conn.user.role !== 'instructor' && conn.user.role !== 'admin')) {
      await AuditLog.create({
        userId: conn.user._id,
        action: 'UNAUTHORIZED_MEDIA_CONTROL_ATTEMPT',
        entityType: 'Interview',
        entityId: conn.interviewId,
        details: { command, actorRole: conn.user.role },
      }).catch(() => {});

      sendWsJson(conn.socket, {
        type: 'SIGNAL_ERROR',
        code: 'FORBIDDEN',
        message: 'Only assigned faculty can control student camera or microphone.',
      });
      return;
    }

    // Lazy require avoids circular dependency with interview.service
    const interviewService = require('../services/interview.service');
    let result;
    try {
      result = await interviewService.controlStudentMedia(conn.interviewId, conn.user, command);
    } catch (err) {
      sendWsJson(conn.socket, {
        type: 'SIGNAL_ERROR',
        code: err.statusCode === 403 ? 'FORBIDDEN' : err.statusCode === 404 ? 'NOT_FOUND' : 'MEDIA_CONTROL_REJECTED',
        message: err.message || 'Media control command rejected.',
      });
      return;
    }

    const deliveredToStudent = this.sendMediaControlToStudent(
      conn.interviewId,
      command,
      result.studentMediaControl
    );

    sendWsJson(conn.socket, {
      type: 'MEDIA_CONTROL_ACK',
      command,
      studentMediaControl: result.studentMediaControl,
      deliveredToStudent,
      timestamp: new Date().toISOString(),
    });
  }

  sendMediaControlToStudent(interviewId, command, studentMediaControl) {
    const room = this.rooms.get(String(interviewId));
    const studentConn = room?.student;
    if (!studentConn || studentConn.closed) {
      return false;
    }
    return sendWsJson(studentConn.socket, {
      type: 'MEDIA_CONTROL_COMMAND',
      command,
      studentMediaControl,
      timestamp: new Date().toISOString(),
    });
  }

  async _handleWebRtcRelay(conn, msg) {
    // Reject raw binary frames or suspicious media payloads; only compact SDP / ICE JSON is allowed
    if (msg.type === 'WEBRTC_OFFER' || msg.type === 'WEBRTC_ANSWER') {
      if (!msg.sdp || typeof msg.sdp !== 'object' || typeof msg.sdp.sdp !== 'string') {
        sendWsJson(conn.socket, {
          type: 'SIGNAL_ERROR',
          code: 'INVALID_SDP',
          message: 'Invalid WebRTC session description payload.',
        });
        return;
      }
    } else if (msg.type === 'WEBRTC_ICE_CANDIDATE') {
      if (!msg.candidate || typeof msg.candidate !== 'object') {
        sendWsJson(conn.socket, {
          type: 'SIGNAL_ERROR',
          code: 'INVALID_ICE',
          message: 'Invalid ICE candidate payload.',
        });
        return;
      }
    }

    const interview = await Interview.findById(conn.interviewId).select('status').lean();
    if (!interview || ['completed', 'cancelled'].includes(interview.status)) {
      sendWsJson(conn.socket, {
        type: 'SESSION_ENDED',
        status: interview?.status || 'ended',
        reason: 'Interview session is no longer active.',
      });
      return;
    }

    const room = this.rooms.get(conn.interviewId);
    if (!room) return;
    const targetRole = conn.role === 'faculty' ? 'student' : 'faculty';
    const targetConn = room[targetRole];
    if (!targetConn || targetConn.closed) {
      return;
    }

    const relayPayload = {
      type: msg.type,
      fromRole: conn.role, // Server-verified role only
    };
    if (msg.sdp) relayPayload.sdp = { type: String(msg.sdp.type || ''), sdp: msg.sdp.sdp };
    if (msg.candidate) relayPayload.candidate = msg.candidate;

    sendWsJson(targetConn.socket, relayPayload);
  }

  async _handleMediaStatusUpdate(conn, msg) {
    const room = this.rooms.get(conn.interviewId);
    if (!room) return;

    const sanitizedState = {
      cameraEnabled: Boolean(msg.cameraEnabled),
      micEnabled: Boolean(msg.micEnabled),
      cameraPermission: typeof msg.cameraPermission === 'string' ? msg.cameraPermission.slice(0, 32) : 'unknown',
      micPermission: typeof msg.micPermission === 'string' ? msg.micPermission.slice(0, 32) : 'unknown',
      errorCode: typeof msg.errorCode === 'string' ? msg.errorCode.slice(0, 64) : null,
      errorMessage: typeof msg.errorMessage === 'string' ? msg.errorMessage.slice(0, 240) : null,
      connected: true,
      updatedAt: new Date().toISOString(),
    };

    room.peerMediaState[conn.role] = sanitizedState;

    const targetRole = conn.role === 'faculty' ? 'student' : 'faculty';
    const targetConn = room[targetRole];
    if (targetConn && !targetConn.closed) {
      sendWsJson(targetConn.socket, {
        type: 'PEER_MEDIA_STATE',
        role: conn.role,
        state: sanitizedState,
      });
    }

    // Persist non-blocking snapshot to active InterviewSession
    InterviewSession.findOneAndUpdate(
      { interviewId: conn.interviewId, status: { $in: ['pending', 'active'] } },
      { $set: { [`participantMediaState.${conn.role}`]: { ...sanitizedState, updatedAt: new Date() } } },
      { sort: { createdAt: -1 } }
    ).catch(() => {});
  }

  _handleMediaCommandFailed(conn, msg) {
    if (conn.role !== 'student') return;
    const room = this.rooms.get(conn.interviewId);
    const facultyConn = room?.faculty;
    if (!facultyConn || facultyConn.closed) return;

    sendWsJson(facultyConn.socket, {
      type: 'STUDENT_MEDIA_ERROR',
      command: typeof msg.command === 'string' ? msg.command.slice(0, 48) : null,
      code: typeof msg.code === 'string' ? msg.code.slice(0, 64) : 'MEDIA_ERROR',
      reason: typeof msg.reason === 'string' ? msg.reason.slice(0, 240) : 'Student media command could not be applied.',
      timestamp: new Date().toISOString(),
    });
  }

  _handleReadyForCall(conn) {
    const room = this.rooms.get(conn.interviewId);
    if (!room) return;
    const targetRole = conn.role === 'faculty' ? 'student' : 'faculty';
    const targetConn = room[targetRole];
    if (targetConn && !targetConn.closed) {
      sendWsJson(targetConn.socket, {
        type: 'PEER_READY_FOR_CALL',
        role: conn.role,
      });
    }
  }

  notifySessionEnded(interviewId, status = 'completed', reason = 'Interview session ended.') {
    const key = String(interviewId);
    const room = this.rooms.get(key);
    if (!room) return;

    for (const role of ['faculty', 'student']) {
      const c = room[role];
      if (c && !c.closed) {
        sendWsJson(c.socket, {
          type: 'SESSION_ENDED',
          status,
          reason,
        });
        sendWsClose(c.socket, 4000, 'Session ended');
        this._cleanupConnection(c);
      }
    }
    this.rooms.delete(key);
  }

  _getOrCreateRoom(interviewId) {
    let room = this.rooms.get(interviewId);
    if (!room) {
      room = {
        faculty: null,
        student: null,
        peerMediaState: { faculty: null, student: null },
      };
      this.rooms.set(interviewId, room);
    }
    return room;
  }

  _detachFromRoom(conn) {
    if (!conn.interviewId || !conn.role) return;
    const room = this.rooms.get(conn.interviewId);
    if (!room) return;

    if (room[conn.role]?.id === conn.id) {
      room[conn.role] = null;
      if (room.peerMediaState[conn.role]) {
        room.peerMediaState[conn.role] = {
          ...room.peerMediaState[conn.role],
          connected: false,
        };
      }
      const peerRole = conn.role === 'faculty' ? 'student' : 'faculty';
      const peerConn = room[peerRole];
      if (peerConn && !peerConn.closed) {
        sendWsJson(peerConn.socket, {
          type: 'PEER_LEFT',
          role: conn.role,
        });
      }
    }

    if (!room.faculty && !room.student) {
      this.rooms.delete(conn.interviewId);
    }
  }

  _cleanupConnection(conn) {
    if (!conn || conn.closed) return;
    conn.closed = true;
    if (conn.authTimer) {
      clearTimeout(conn.authTimer);
      conn.authTimer = null;
    }
    this.connections.delete(conn);
    this._detachFromRoom(conn);
    if (conn.socket && !conn.socket.destroyed) {
      try {
        conn.socket.destroy();
      } catch {
        // ignore
      }
    }
  }

  closeAll() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    for (const conn of Array.from(this.connections)) {
      sendWsClose(conn.socket, 1001, 'Server shutting down');
      this._cleanupConnection(conn);
    }
    this.rooms.clear();
  }
}

const interviewSignaling = new InterviewSignalingManager();

module.exports = {
  WS_PATH,
  MEDIA_CONTROL_COMMANDS,
  interviewSignaling,
  attachInterviewSignaling: (httpServer) => interviewSignaling.attach(httpServer),
};
