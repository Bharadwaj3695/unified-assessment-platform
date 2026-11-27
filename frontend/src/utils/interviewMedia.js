/**
 * Shared browser media & WebRTC helper utilities for UAP Faculty Interviews.
 */

export const DEFAULT_ICE_SERVERS = (() => {
  try {
    const raw = import.meta.env?.VITE_WEBRTC_ICE_SERVERS;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback to default STUN server
  }
  return [{ urls: 'stun:stun.l.google.com:19302' }];
})();

/**
 * Classifies MediaDevices getUserMedia errors into actionable user and faculty notifications.
 */
export function classifyMediaAccessError(err, kind = 'camera and microphone') {
  const name = err?.name || '';
  const msg = err?.message || '';

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return {
      permission: 'denied',
      code: 'PERMISSION_DENIED',
      title: `Permission Denied (${kind})`,
      message: `Browser permission for ${kind} was denied or revoked. Allow access in browser site settings and retry.`,
    };
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return {
      permission: 'unavailable',
      code: 'DEVICE_NOT_FOUND',
      title: `Device Unavailable (${kind})`,
      message: `No working ${kind} device was detected on this system. Connect a device and retry.`,
    };
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return {
      permission: 'unavailable',
      code: 'DEVICE_IN_USE',
      title: `Device Busy (${kind})`,
      message: `Your ${kind} is already in use by another application or tab. Close the other app and retry.`,
    };
  }
  return {
    permission: 'unavailable',
    code: name || 'MEDIA_ERROR',
    title: `Unable to Access ${kind}`,
    message: msg || `Could not initialize ${kind}. Check device permissions and retry.`,
  };
}

/**
 * Acquires local camera & microphone gracefully, falling back to single-medium capture
 * when one device is denied/absent so partial communication and clear error reporting work.
 */
export async function acquireInterviewMedia() {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getUserMedia !== 'function'
  ) {
    return {
      stream: null,
      cameraPermission: 'unsupported',
      micPermission: 'unsupported',
      error: {
        code: 'UNSUPPORTED',
        title: 'Media API Unsupported',
        message: 'Browser does not support camera/microphone capture (requires HTTPS or localhost).',
      },
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    return {
      stream,
      cameraPermission: stream.getVideoTracks().length > 0 ? 'granted' : 'unavailable',
      micPermission: stream.getAudioTracks().length > 0 ? 'granted' : 'unavailable',
      error: null,
    };
  } catch (combinedErr) {
    // Try acquiring video and audio independently so one working device still functions
    let videoTrack = null;
    let audioTrack = null;
    let cameraPermission = 'denied';
    let micPermission = 'denied';
    const errors = [];

    try {
      const vStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      videoTrack = vStream.getVideoTracks()[0] || null;
      cameraPermission = videoTrack ? 'granted' : 'unavailable';
    } catch (vErr) {
      const info = classifyMediaAccessError(vErr, 'camera');
      cameraPermission = info.permission;
      errors.push(info);
    }

    try {
      const aStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      audioTrack = aStream.getAudioTracks()[0] || null;
      micPermission = audioTrack ? 'granted' : 'unavailable';
    } catch (aErr) {
      const info = classifyMediaAccessError(aErr, 'microphone');
      micPermission = info.permission;
      errors.push(info);
    }

    const tracks = [videoTrack, audioTrack].filter(Boolean);
    const stream = tracks.length > 0 ? new MediaStream(tracks) : null;
    const primaryError = errors[0] || classifyMediaAccessError(combinedErr, 'camera and microphone');

    return {
      stream,
      cameraPermission,
      micPermission,
      error: errors.length > 0 ? {
        code: primaryError.code,
        title: primaryError.title,
        message: errors.map((e) => e.message).join(' '),
      } : null,
    };
  }
}

export function stopMediaStream(stream) {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    try {
      track.onended = null;
      track.stop();
    } catch {
      // ignore
    }
  });
}

export function formatElapsedSeconds(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
}
