import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Lock,
  Wifi,
  WifiOff,
  RefreshCw,
  Clock,
  ShieldCheck,
  AlertTriangle,
  LogOut,
  CheckCircle2,
  User,
} from 'lucide-react';
import interviewService from '../../services/interview.service';
import { authService } from '../../services/auth.service';
import { storage } from '../../utils/storage';
import {
  DEFAULT_ICE_SERVERS,
  acquireInterviewMedia,
  stopMediaStream,
  formatElapsedSeconds,
} from '../../utils/interviewMedia';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Alert from '../ui/Alert';

const CONNECTION_BADGE = {
  connecting: { variant: 'info', label: 'Connecting' },
  connected: { variant: 'success', label: 'Connected' },
  reconnecting: { variant: 'warning', label: 'Reconnecting' },
  disconnected: { variant: 'error', label: 'Disconnected' },
  ended: { variant: 'neutral', label: 'Ended' },
};

/**
 * Shared two-way WebRTC video & audio interview room used inside existing Faculty and Student views.
 * - Faculty view: Student is main video, Faculty is self-view; Faculty controls own & student's media.
 * - Student view: Faculty is main video, Student is self-view; Student media controls are locked/faculty-controlled.
 */
export default function InterviewVideoRoom({
  interview,
  session,
  role, // 'faculty' | 'student'
  autoStartMedia = true,
  onLeave,
  onComplete,
  completing = false,
  onSessionEnded,
  onMediaError,
}) {
  const interviewId = interview?.id || interview?._id;
  const isFaculty = role === 'faculty';
  const isInterviewFinished = ['completed', 'cancelled'].includes(interview?.status);

  // Connection & room state
  const [connectionState, setConnectionState] = useState(isInterviewFinished ? 'ended' : 'connecting');
  const [peerOnline, setPeerOnline] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Local media state
  const [mediaInitialized, setMediaInitialized] = useState(false);
  const [requestingMedia, setRequestingMedia] = useState(false);
  const [localCameraOn, setLocalCameraOn] = useState(false);
  const [localMicOn, setLocalMicOn] = useState(false);
  const [cameraPermission, setCameraPermission] = useState('prompted');
  const [micPermission, setMicPermission] = useState('prompted');
  const [mediaError, setMediaError] = useState(null);

  // Faculty-enforced control state for student media
  const [studentMediaControl, setStudentMediaControl] = useState(() => ({
    cameraEnabled: session?.studentMediaControl?.cameraEnabled !== false,
    micEnabled: session?.studentMediaControl?.micEnabled !== false,
  }));
  const [pendingStudentCommand, setPendingStudentCommand] = useState(null);
  const [studentMediaAlert, setStudentMediaAlert] = useState(null);

  // Peer reported media state
  const [peerMediaState, setPeerMediaState] = useState(null);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);

  // Live session timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Refs for WebRTC & Signaling
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const pcRef = useRef(null);
  const wsRef = useRef(null);
  const pendingIceRef = useRef([]);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const isUnmountedRef = useRef(false);
  const endedRef = useRef(isInterviewFinished);
  const studentControlRef = useRef(studentMediaControl);
  const cameraPermissionRef = useRef(cameraPermission);
  const micPermissionRef = useRef(micPermission);
  const onSessionEndedRef = useRef(onSessionEnded);
  const onMediaErrorRef = useRef(onMediaError);

  useEffect(() => {
    studentControlRef.current = studentMediaControl;
  }, [studentMediaControl]);

  useEffect(() => {
    cameraPermissionRef.current = cameraPermission;
  }, [cameraPermission]);

  useEffect(() => {
    micPermissionRef.current = micPermission;
  }, [micPermission]);

  useEffect(() => {
    onSessionEndedRef.current = onSessionEnded;
    onMediaErrorRef.current = onMediaError;
  }, [onSessionEnded, onMediaError]);

  useEffect(() => {
    endedRef.current = isInterviewFinished;
    if (isInterviewFinished) {
      setConnectionState('ended');
    }
  }, [isInterviewFinished]);

  // Elapsed timer synchronized to session.startedAt
  useEffect(() => {
    if (isInterviewFinished) return undefined;
    const startTs = session?.startedAt ? new Date(session.startedAt).getTime() : Date.now();
    const updateTimer = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startTs) / 1000)));
    };
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [session?.startedAt, isInterviewFinished]);

  const sendWs = useCallback((payload) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  const syncLocalStateToPeer = useCallback(
    (overrides = {}) => {
      const stream = localStreamRef.current;
      const vTrack = stream?.getVideoTracks?.()[0];
      const aTrack = stream?.getAudioTracks?.()[0];
      const camOn =
        overrides.cameraEnabled !== undefined
          ? overrides.cameraEnabled
          : Boolean(vTrack && vTrack.readyState === 'live' && vTrack.enabled);
      const micOn =
        overrides.micEnabled !== undefined
          ? overrides.micEnabled
          : Boolean(aTrack && aTrack.readyState === 'live' && aTrack.enabled);

      sendWs({
        type: 'MEDIA_STATUS_UPDATE',
        cameraEnabled: camOn,
        micEnabled: micOn,
        cameraPermission: overrides.cameraPermission ?? cameraPermissionRef.current,
        micPermission: overrides.micPermission ?? micPermissionRef.current,
        errorCode: overrides.errorCode ?? null,
        errorMessage: overrides.errorMessage ?? null,
      });
    },
    [sendWs]
  );

  const attachLocalTracksToPc = useCallback((pc) => {
    if (!pc) return;
    const stream = localStreamRef.current;
    const videoTrack = stream?.getVideoTracks?.()[0] || null;
    const audioTrack = stream?.getAudioTracks?.()[0] || null;

    const transceivers = pc.getTransceivers ? pc.getTransceivers() : [];
    const videoTransceiver = transceivers.find(
      (t) => t.receiver?.track?.kind === 'video' || t.sender?.track?.kind === 'video'
    );
    const audioTransceiver = transceivers.find(
      (t) => t.receiver?.track?.kind === 'audio' || t.sender?.track?.kind === 'audio'
    );

    if (videoTransceiver) {
      try {
        videoTransceiver.direction = 'sendrecv';
        videoTransceiver.sender.replaceTrack(videoTrack).catch(() => {});
      } catch {
        // ignore if peer connection closing
      }
    } else if (videoTrack) {
      try {
        pc.addTrack(videoTrack, stream);
      } catch {
        // ignore
      }
    }

    if (audioTransceiver) {
      try {
        audioTransceiver.direction = 'sendrecv';
        audioTransceiver.sender.replaceTrack(audioTrack).catch(() => {});
      } catch {
        // ignore
      }
    } else if (audioTrack) {
      try {
        pc.addTrack(audioTrack, stream);
      } catch {
        // ignore
      }
    }
  }, []);

  const closePeerConnection = useCallback(() => {
    pendingIceRef.current = [];
    if (pcRef.current) {
      try {
        pcRef.current.onicecandidate = null;
        pcRef.current.ontrack = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.oniceconnectionstatechange = null;
        pcRef.current.close();
      } catch {
        // ignore
      }
      pcRef.current = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    remoteStreamRef.current = null;
    setHasRemoteVideo(false);
  }, []);

  const teardownAll = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    closePeerConnection();
    stopMediaStream(localStreamRef.current);
    localStreamRef.current = null;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        wsRef.current.close(1000, 'Room closed');
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
    setLocalCameraOn(false);
    setLocalMicOn(false);
  }, [closePeerConnection]);

  const createPeerConnection = useCallback(
    (isOfferer) => {
      closePeerConnection();

      const pc = new RTCPeerConnection({ iceServers: DEFAULT_ICE_SERVERS });
      const remoteStream = new MediaStream();
      remoteStreamRef.current = remoteStream;
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }

      if (isOfferer) {
        pc.addTransceiver('video', { direction: 'sendrecv' });
        pc.addTransceiver('audio', { direction: 'sendrecv' });
      }

      pc.ontrack = (event) => {
        const track = event.track;
        if (!track) return;
        const existing = remoteStream.getTracks().find((t) => t.id === track.id);
        if (!existing) {
          remoteStream.addTrack(track);
        }
        if (remoteVideoRef.current) {
          if (remoteVideoRef.current.srcObject !== remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
          }
          remoteVideoRef.current.play?.().catch(() => {});
        }
        if (track.kind === 'video') {
          setHasRemoteVideo(true);
        }
        track.onended = () => {
          if (track.kind === 'video') {
            setHasRemoteVideo(remoteStream.getVideoTracks().some((t) => t.readyState === 'live'));
          }
        };
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendWs({
            type: 'WEBRTC_ICE_CANDIDATE',
            candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
          });
        }
      };

      const syncConnectionStatus = () => {
        if (endedRef.current) {
          setConnectionState('ended');
          return;
        }
        const cState = pc.connectionState;
        const iceState = pc.iceConnectionState;
        if (cState === 'connected' || iceState === 'connected' || iceState === 'completed') {
          setConnectionState('connected');
          setStatusMessage('');
        } else if (cState === 'connecting' || iceState === 'checking') {
          setConnectionState('connecting');
        } else if (iceState === 'disconnected' || cState === 'disconnected') {
          setConnectionState('reconnecting');
          setStatusMessage('Media connection interrupted. Attempting to reconnect...');
        } else if (cState === 'failed' || iceState === 'failed') {
          setConnectionState('reconnecting');
          setStatusMessage('Connection lost. Retrying ICE negotiation...');
        }
      };

      pc.onconnectionstatechange = syncConnectionStatus;
      pc.oniceconnectionstatechange = syncConnectionStatus;

      attachLocalTracksToPc(pc);
      pcRef.current = pc;
      return pc;
    },
    [attachLocalTracksToPc, closePeerConnection, sendWs]
  );

  const startOfferAsFaculty = useCallback(
    async ({ iceRestart = false } = {}) => {
      if (!isFaculty || endedRef.current) return;
      try {
        const pc =
          iceRestart && pcRef.current && pcRef.current.signalingState !== 'closed'
            ? pcRef.current
            : createPeerConnection(true);
        attachLocalTracksToPc(pc);
        const offer = await pc.createOffer({ iceRestart });
        await pc.setLocalDescription(offer);
        sendWs({
          type: 'WEBRTC_OFFER',
          sdp: { type: offer.type, sdp: offer.sdp },
        });
      } catch (err) {
        console.warn('[InterviewVideoRoom] Failed to create WebRTC offer:', err.message);
      }
    },
    [isFaculty, createPeerConnection, attachLocalTracksToPc, sendWs]
  );

  const applyStudentMediaPolicyToLocalTracks = useCallback(
    (policy) => {
      if (isFaculty) return { applied: true };
      const stream = localStreamRef.current;
      const vTracks = stream?.getVideoTracks?.() || [];
      const aTracks = stream?.getAudioTracks?.() || [];

      let camApplied = false;
      vTracks.forEach((t) => {
        if (t.readyState === 'live') {
          t.enabled = Boolean(policy.cameraEnabled);
          camApplied = true;
        }
      });

      let micApplied = false;
      aTracks.forEach((t) => {
        if (t.readyState === 'live') {
          t.enabled = Boolean(policy.micEnabled);
          micApplied = true;
        }
      });

      const nextCamOn = Boolean(policy.cameraEnabled && camApplied);
      const nextMicOn = Boolean(policy.micEnabled && micApplied);
      setLocalCameraOn(nextCamOn);
      setLocalMicOn(nextMicOn);

      return {
        applied: (!policy.cameraEnabled || camApplied) && (!policy.micEnabled || micApplied),
        camApplied,
        micApplied,
        nextCamOn,
        nextMicOn,
      };
    },
    [isFaculty]
  );

  const initializeLocalMedia = useCallback(
    async ({ notifyFacultyOnFailure = true } = {}) => {
      if (endedRef.current) return;
      setRequestingMedia(true);
      setMediaError(null);

      try {
        stopMediaStream(localStreamRef.current);
        const result = await acquireInterviewMedia();
        if (isUnmountedRef.current || endedRef.current) {
          stopMediaStream(result.stream);
          return;
        }

        localStreamRef.current = result.stream;
        setCameraPermission(result.cameraPermission);
        setMicPermission(result.micPermission);
        setMediaInitialized(true);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = result.stream || null;
        }

        const vTracks = result.stream?.getVideoTracks?.() || [];
        const aTracks = result.stream?.getAudioTracks?.() || [];

        if (!isFaculty) {
          const policy = studentControlRef.current;
          vTracks.forEach((t) => {
            t.enabled = Boolean(policy.cameraEnabled);
          });
          aTracks.forEach((t) => {
            t.enabled = Boolean(policy.micEnabled);
          });
          setLocalCameraOn(Boolean(policy.cameraEnabled && vTracks.length > 0));
          setLocalMicOn(Boolean(policy.micEnabled && aTracks.length > 0));
        } else {
          setLocalCameraOn(vTracks.length > 0);
          setLocalMicOn(aTracks.length > 0);
        }

        // Watch for hardware unplug / permission revocation mid-session
        [...vTracks, ...aTracks].forEach((track) => {
          track.onended = () => {
            if (isUnmountedRef.current || endedRef.current) return;
            const isVideo = track.kind === 'video';
            const errMsg = isVideo
              ? 'Camera device disconnected or permission revoked.'
              : 'Microphone device disconnected or permission revoked.';
            setMediaError({
              code: 'TRACK_ENDED',
              title: isVideo ? 'Camera Interrupted' : 'Microphone Interrupted',
              message: errMsg,
            });
            if (isVideo) {
              setLocalCameraOn(false);
              setCameraPermission('unavailable');
            } else {
              setLocalMicOn(false);
              setMicPermission('unavailable');
            }
            syncLocalStateToPeer({
              cameraEnabled: isVideo ? false : undefined,
              micEnabled: !isVideo ? false : undefined,
              cameraPermission: isVideo ? 'unavailable' : undefined,
              micPermission: !isVideo ? 'unavailable' : undefined,
              errorCode: 'TRACK_ENDED',
              errorMessage: errMsg,
            });
            if (!isFaculty) {
              sendWs({
                type: 'MEDIA_COMMAND_FAILED',
                code: 'TRACK_ENDED',
                reason: errMsg,
              });
            }
          };
        });

        if (result.error) {
          setMediaError(result.error);
          if (onMediaErrorRef.current) onMediaErrorRef.current(result.error);
          if (!isFaculty && notifyFacultyOnFailure) {
            sendWs({
              type: 'MEDIA_COMMAND_FAILED',
              code: result.error.code,
              reason: result.error.message,
            });
          }
        }

        if (pcRef.current && pcRef.current.signalingState !== 'closed') {
          attachLocalTracksToPc(pcRef.current);
        }

        const effectiveCamOn = isFaculty
          ? vTracks.length > 0
          : Boolean(studentControlRef.current.cameraEnabled && vTracks.length > 0);
        const effectiveMicOn = isFaculty
          ? aTracks.length > 0
          : Boolean(studentControlRef.current.micEnabled && aTracks.length > 0);

        syncLocalStateToPeer({
          cameraEnabled: effectiveCamOn,
          micEnabled: effectiveMicOn,
          cameraPermission: result.cameraPermission,
          micPermission: result.micPermission,
          errorCode: result.error?.code || null,
          errorMessage: result.error?.message || null,
        });

        sendWs({ type: 'READY_FOR_CALL' });
      } finally {
        setRequestingMedia(false);
      }
    },
    [isFaculty, attachLocalTracksToPc, syncLocalStateToPeer, sendWs]
  );

  // Sync local video element when stream or layout updates
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      if (localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      localVideoRef.current.play?.().catch(() => {});
    }
  }, [localCameraOn, mediaInitialized]);

  // Keep remote video/audio playback active even when remote camera is off
  useEffect(() => {
    if (remoteVideoRef.current && remoteStreamRef.current) {
      if (remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
      remoteVideoRef.current.play?.().catch(() => {});
    }
  }, [hasRemoteVideo, peerOnline]);

  // Connect authenticated WebSocket signaling & handle lifecycle
  useEffect(() => {
    isUnmountedRef.current = false;
    if (!interviewId || isInterviewFinished) {
      setConnectionState('ended');
      return () => {
        isUnmountedRef.current = true;
      };
    }

    let cancelled = false;

    const connectSignaling = async () => {
      if (cancelled || isUnmountedRef.current || endedRef.current) return;

      let token = storage.getToken();
      if (!token) {
        try {
          const refreshed = await authService.refreshToken({});
          const data = refreshed?.data || refreshed;
          if (data?.accessToken) {
            storage.setToken(data.accessToken);
            token = data.accessToken;
          }
        } catch {
          // handled below
        }
      }

      if (!token) {
        setConnectionState('disconnected');
        setStatusMessage('Authentication session expired. Please sign in again.');
        return;
      }

      const wsUrl = interviewService.getSignalingUrl();
      setConnectionState(reconnectAttemptRef.current > 0 ? 'reconnecting' : 'connecting');

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled || isUnmountedRef.current) {
          ws.close();
          return;
        }
        reconnectAttemptRef.current = 0;
        ws.send(JSON.stringify({ type: 'AUTH', token, interviewId }));
      };

      ws.onmessage = async (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        if (msg.type === 'AUTH_OK') {
          setPeerOnline(Boolean(msg.peerOnline));
          if (msg.studentMediaControl) {
            setStudentMediaControl(msg.studentMediaControl);
            studentControlRef.current = msg.studentMediaControl;
            if (!isFaculty && localStreamRef.current) {
              applyStudentMediaPolicyToLocalTracks(msg.studentMediaControl);
            }
          }
          if (msg.peerMediaState) {
            setPeerMediaState(msg.peerMediaState);
          }

          setConnectionState(msg.peerOnline ? 'connecting' : 'connecting');
          setStatusMessage(
            msg.peerOnline
              ? 'Establishing live video & audio connection...'
              : `Waiting for ${isFaculty ? 'student' : 'faculty'} to join...`
          );

          syncLocalStateToPeer();
          if (isFaculty && msg.peerOnline) {
            await startOfferAsFaculty();
          }
          return;
        }

        if (msg.type === 'PEER_JOINED') {
          setPeerOnline(true);
          if (msg.mediaState) {
            setPeerMediaState(msg.mediaState);
          }
          setStatusMessage('Participant joined. Connecting video & audio...');
          syncLocalStateToPeer();
          if (isFaculty) {
            await startOfferAsFaculty();
          }
          return;
        }

        if (msg.type === 'PEER_READY_FOR_CALL') {
          setPeerOnline(true);
          if (isFaculty) {
            await startOfferAsFaculty();
          }
          return;
        }

        if (msg.type === 'PEER_LEFT') {
          setPeerOnline(false);
          closePeerConnection();
          setConnectionState('disconnected');
          setStatusMessage(
            `${isFaculty ? 'Student' : 'Faculty'} disconnected from the interview room.`
          );
          return;
        }

        if (msg.type === 'PEER_MEDIA_STATE') {
          if (msg.state) {
            setPeerMediaState(msg.state);
          }
          return;
        }

        if (msg.type === 'MEDIA_CONTROL_COMMAND' && !isFaculty) {
          const nextPolicy = msg.studentMediaControl || {};
          setStudentMediaControl(nextPolicy);
          studentControlRef.current = nextPolicy;

          const labelMap = {
            STUDENT_CAMERA_ENABLE: 'Faculty enabled your camera.',
            STUDENT_CAMERA_DISABLE: 'Faculty turned off your camera.',
            STUDENT_MIC_ENABLE: 'Faculty enabled your microphone.',
            STUDENT_MIC_DISABLE: 'Faculty muted your microphone.',
          };
          if (labelMap[msg.command]) {
            toast.info(labelMap[msg.command]);
          }

          // If enabling camera/mic when track was lost or not yet live, attempt to re-acquire
          const needsCamera = msg.command === 'STUDENT_CAMERA_ENABLE';
          const needsMic = msg.command === 'STUDENT_MIC_ENABLE';
          const stream = localStreamRef.current;
          const hasLiveCam = stream?.getVideoTracks?.().some((t) => t.readyState === 'live');
          const hasLiveMic = stream?.getAudioTracks?.().some((t) => t.readyState === 'live');

          if ((needsCamera && !hasLiveCam) || (needsMic && !hasLiveMic)) {
            await initializeLocalMedia({ notifyFacultyOnFailure: true });
          }

          const res = applyStudentMediaPolicyToLocalTracks(nextPolicy);
          if (!res.applied) {
            const reason =
              needsCamera && !res.camApplied
                ? 'Student camera permission denied or hardware unavailable.'
                : 'Student microphone permission denied or hardware unavailable.';
            ws.send(
              JSON.stringify({
                type: 'MEDIA_COMMAND_FAILED',
                command: msg.command,
                code: 'TRACK_UNAVAILABLE',
                reason,
              })
            );
          }
          syncLocalStateToPeer({
            cameraEnabled: res.nextCamOn,
            micEnabled: res.nextMicOn,
          });
          return;
        }

        if (msg.type === 'MEDIA_CONTROL_ACK' && isFaculty) {
          setPendingStudentCommand(null);
          if (msg.studentMediaControl) {
            setStudentMediaControl(msg.studentMediaControl);
            studentControlRef.current = msg.studentMediaControl;
          }
          if (!msg.deliveredToStudent) {
            toast.info('Media preference saved. Student is not currently connected.');
          }
          return;
        }

        if (msg.type === 'STUDENT_MEDIA_ERROR' && isFaculty) {
          setStudentMediaAlert({
            command: msg.command,
            code: msg.code,
            reason: msg.reason,
            timestamp: msg.timestamp,
          });
          toast.warning(msg.reason || 'Student media device error reported.');
          return;
        }

        if (msg.type === 'WEBRTC_OFFER' && !isFaculty && msg.sdp) {
          try {
            const pc = createPeerConnection(false);
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            attachLocalTracksToPc(pc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send(
              JSON.stringify({
                type: 'WEBRTC_ANSWER',
                sdp: { type: answer.type, sdp: answer.sdp },
              })
            );
            for (const cand of pendingIceRef.current) {
              await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
            }
            pendingIceRef.current = [];
          } catch (err) {
            console.warn('[InterviewVideoRoom] Failed handling WebRTC offer:', err.message);
          }
          return;
        }

        if (msg.type === 'WEBRTC_ANSWER' && isFaculty && msg.sdp && pcRef.current) {
          try {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            for (const cand of pendingIceRef.current) {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
            }
            pendingIceRef.current = [];
          } catch (err) {
            console.warn('[InterviewVideoRoom] Failed handling WebRTC answer:', err.message);
          }
          return;
        }

        if (msg.type === 'WEBRTC_ICE_CANDIDATE' && msg.candidate) {
          const pc = pcRef.current;
          if (pc && pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
          } else {
            pendingIceRef.current.push(msg.candidate);
          }
          return;
        }

        if (msg.type === 'SESSION_ENDED') {
          endedRef.current = true;
          teardownAll();
          setConnectionState('ended');
          setStatusMessage(msg.reason || 'Interview session has ended.');
          if (onSessionEndedRef.current) onSessionEndedRef.current(msg);
          return;
        }

        if (msg.type === 'SIGNAL_ERROR') {
          setPendingStudentCommand(null);
          if (msg.code === 'FORBIDDEN' || msg.code === 'INVALID_TOKEN') {
            setStatusMessage(msg.message);
          }
          toast.error(msg.message || 'Signaling error.');
        }
      };

      ws.onerror = () => {
        // onclose handles reconnect
      };

      ws.onclose = (ev) => {
        if (cancelled || isUnmountedRef.current || endedRef.current) return;
        // Do not retry on explicit auth/forbidden rejection
        if ([4000, 4001, 4003, 4004, 4008].includes(ev.code)) {
          setConnectionState(ev.code === 4000 ? 'ended' : 'disconnected');
          return;
        }
        const delayMs = Math.min(8000, 1000 * Math.pow(2, reconnectAttemptRef.current));
        reconnectAttemptRef.current += 1;
        setConnectionState('reconnecting');
        setStatusMessage('Signaling connection lost. Reconnecting...');
        reconnectTimerRef.current = setTimeout(connectSignaling, delayMs);
      };
    };

    connectSignaling();

    return () => {
      cancelled = true;
      isUnmountedRef.current = true;
      teardownAll();
    };
  }, [
    interviewId,
    isInterviewFinished,
    isFaculty,
    applyStudentMediaPolicyToLocalTracks,
    attachLocalTracksToPc,
    closePeerConnection,
    createPeerConnection,
    initializeLocalMedia,
    startOfferAsFaculty,
    syncLocalStateToPeer,
    teardownAll,
  ]);

  // Auto-initialize media when explicitly entering an active session with user gesture/consent
  useEffect(() => {
    if (isInterviewFinished || mediaInitialized || requestingMedia) return;
    if (autoStartMedia) {
      initializeLocalMedia({ notifyFacultyOnFailure: true });
    }
  }, [autoStartMedia, isInterviewFinished, mediaInitialized, requestingMedia, initializeLocalMedia]);

  // Faculty toggling their OWN camera or mic
  const handleToggleOwnMedia = async (kind) => {
    if (!isFaculty || endedRef.current) return;
    const stream = localStreamRef.current;
    const tracks = kind === 'camera' ? stream?.getVideoTracks?.() : stream?.getAudioTracks?.();
    const liveTrack = tracks?.find((t) => t.readyState === 'live');

    if (!liveTrack) {
      await initializeLocalMedia({ notifyFacultyOnFailure: false });
      return;
    }

    const nextEnabled = !liveTrack.enabled;
    liveTrack.enabled = nextEnabled;

    if (kind === 'camera') {
      setLocalCameraOn(nextEnabled);
      syncLocalStateToPeer({ cameraEnabled: nextEnabled });
    } else {
      setLocalMicOn(nextEnabled);
      syncLocalStateToPeer({ micEnabled: nextEnabled });
    }
  };

  // Faculty controlling STUDENT'S camera or mic via authenticated signaling
  const handleFacultyStudentControl = (command) => {
    if (!isFaculty || endedRef.current) return;
    setStudentMediaAlert(null);
    setPendingStudentCommand(command);
    const sent = sendWs({ type: 'MEDIA_CONTROL', command });
    if (!sent) {
      interviewService
        .controlStudentMedia(interviewId, command)
        .then((res) => {
          if (res?.studentMediaControl) {
            setStudentMediaControl(res.studentMediaControl);
          }
          setPendingStudentCommand(null);
        })
        .catch((err) => {
          setPendingStudentCommand(null);
          toast.error(err.message || 'Failed to update student media state.');
        });
    }
  };

  const remoteParticipant = isFaculty
    ? {
        name: interview?.studentId?.name || 'Assigned Student',
        institutionalId: interview?.studentId?.studentId || 'Student',
        roleLabel: 'Student',
      }
    : {
        name: interview?.facultyId?.name || 'Assigned Faculty',
        institutionalId: interview?.facultyId?.facultyId || 'Faculty',
        roleLabel: 'Faculty',
      };

  const localParticipant = isFaculty
    ? {
        name: interview?.facultyId?.name || 'Faculty (You)',
        institutionalId: interview?.facultyId?.facultyId || 'Faculty',
        roleLabel: 'Faculty (You)',
      }
    : {
        name: interview?.studentId?.name || 'Student (You)',
        institutionalId: interview?.studentId?.studentId || 'Student',
        roleLabel: 'Student (You)',
      };

  const connBadge = CONNECTION_BADGE[connectionState] || CONNECTION_BADGE.connecting;
  const remoteCamActive = Boolean(
    peerOnline && (peerMediaState ? peerMediaState.cameraEnabled : hasRemoteVideo)
  );
  const remoteMicActive = Boolean(peerOnline && peerMediaState?.micEnabled);

  return (
    <div
      data-testid="interview-video-room"
      className="rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark shadow-warm-sm overflow-hidden"
    >
      {/* Top Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-surface-light-border dark:border-surface-dark-border bg-slate-50/80 dark:bg-surface-dark-muted/50">
        <div className="flex flex-wrap items-center gap-2.5">
          <Badge variant={connBadge.variant} size="sm" dot data-testid="video-connection-status">
            {connBadge.label}
          </Badge>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <Clock className="w-3.5 h-3.5 text-brand-primary" />
            <span data-testid="interview-elapsed-timer">{formatElapsedSeconds(elapsedSeconds)}</span>
            <span className="text-slate-400 font-normal">/ {interview?.durationMinutes || 30}m</span>
          </span>
          {statusMessage && connectionState !== 'connected' && (
            <span className="text-xs text-slate-500 dark:text-slate-400" data-testid="video-status-message">
              {statusMessage}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isInterviewFinished && connectionState === 'reconnecting' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={RefreshCw}
              onClick={() => (isFaculty ? startOfferAsFaculty({ iceRestart: true }) : sendWs({ type: 'READY_FOR_CALL' }))}
            >
              Reconnect Call
            </Button>
          )}
          {!isInterviewFinished && onLeave && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={LogOut}
              disabled={completing}
              onClick={() => {
                teardownAll();
                onLeave();
              }}
              data-testid="btn-leave-video-room"
            >
              Leave
            </Button>
          )}
          {!isInterviewFinished && onComplete && (
            <Button
              type="button"
              variant="sage"
              size="sm"
              icon={CheckCircle2}
              isLoading={completing}
              onClick={() => {
                teardownAll();
                onComplete();
              }}
              data-testid="btn-end-video-interview"
            >
              End Interview
            </Button>
          )}
        </div>
      </div>

      {/* Disclosure & Alerts */}
      <div className="p-4 sm:p-5 space-y-4">
        {!isFaculty && !isInterviewFinished && (
          <div
            data-testid="student-media-disclosure"
            className="flex items-start gap-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-surface-dark-muted/40 px-3.5 py-2.5 text-xs text-slate-700 dark:text-slate-300"
          >
            <ShieldCheck className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                Live Face-to-Face Interview & Faculty-Controlled Media
              </p>
              <p>
                Your camera and microphone are streamed live only to your assigned faculty interviewer (not automatically recorded). During the interview, your faculty controls when your camera and microphone are active.
              </p>
            </div>
          </div>
        )}

        {mediaError && !isInterviewFinished && (
          <Alert variant="warning" title={mediaError.title || 'Media Permission / Device Issue'}>
            <div data-testid="media-error-alert" className="flex flex-wrap items-center justify-between gap-3">
              <span>{mediaError.message}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={RefreshCw}
                isLoading={requestingMedia}
                onClick={() => initializeLocalMedia({ notifyFacultyOnFailure: true })}
                data-testid="btn-retry-media"
              >
                Retry Camera & Mic
              </Button>
            </div>
          </Alert>
        )}

        {isFaculty && studentMediaAlert && !isInterviewFinished && (
          <Alert variant="warning" title="Student Device / Permission Notice">
            <div data-testid="student-media-error-banner" className="flex items-center justify-between gap-2">
              <span>{studentMediaAlert.reason}</span>
              <button
                type="button"
                onClick={() => setStudentMediaAlert(null)}
                className="text-xs font-semibold underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </Alert>
        )}

        {!mediaInitialized && !autoStartMedia && !isInterviewFinished && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/20 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-700 dark:text-slate-200">
              Click to grant browser camera and microphone access for live two-way audio and video.
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={Video}
              isLoading={requestingMedia}
              onClick={() => initializeLocalMedia({ notifyFacultyOnFailure: true })}
              data-testid="btn-grant-interview-media"
            >
              Allow Camera & Microphone
            </Button>
          </div>
        )}

        {/* Main Video Stage + Self-View */}
        <div className="relative rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden aspect-video min-h-[260px] max-h-[520px] w-full flex items-center justify-center">
          {/* Remote Participant Main Video (kept rendered so remote audio stays active even when camera is off) */}
          <video
            ref={remoteVideoRef}
            data-testid={isFaculty ? 'remote-video-student' : 'remote-video-faculty'}
            autoPlay
            playsInline
            className={`w-full h-full object-cover transition-opacity ${
              remoteCamActive ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'
            }`}
          />

          {/* Remote Placeholder when offline or camera disabled */}
          {!remoteCamActive && (
            <div
              data-testid="remote-video-placeholder"
              className="flex flex-col items-center justify-center text-center px-4 py-8 space-y-2.5 text-slate-300"
            >
              <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                {!peerOnline ? (
                  <WifiOff className="w-7 h-7 text-slate-400" />
                ) : (
                  <VideoOff className="w-7 h-7 text-amber-400" />
                )}
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-white">
                  {remoteParticipant.name} ({remoteParticipant.institutionalId})
                </p>
                <p className="text-xs text-slate-400">
                  {isInterviewFinished
                    ? 'Interview session has ended.'
                    : !peerOnline
                    ? `Waiting for ${remoteParticipant.roleLabel.toLowerCase()} to join the room...`
                    : peerMediaState?.cameraPermission === 'denied'
                    ? `${remoteParticipant.roleLabel} camera permission denied.`
                    : peerMediaState?.cameraPermission === 'unavailable'
                    ? `${remoteParticipant.roleLabel} camera unavailable.`
                    : `${remoteParticipant.roleLabel} camera is currently off.`}
                </p>
              </div>
            </div>
          )}

          {/* Remote Participant Identity & Status Overlay (Bottom Left) */}
          <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2 bg-slate-900/80 backdrop-blur-md border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-white">
            <User className="w-3.5 h-3.5 text-brand-peach shrink-0" />
            <span className="font-semibold" data-testid="remote-participant-label">
              {remoteParticipant.name} ({remoteParticipant.institutionalId})
            </span>
            <span
              data-testid="remote-camera-indicator"
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium ${
                remoteCamActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
              }`}
            >
              {remoteCamActive ? <Video className="w-3 h-3" /> : <VideoOff className="w-3 h-3" />}
              {remoteCamActive ? 'Cam On' : 'Cam Off'}
            </span>
            <span
              data-testid="remote-mic-indicator"
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium ${
                remoteMicActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
              }`}
            >
              {remoteMicActive ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
              {remoteMicActive ? 'Mic On' : 'Muted'}
            </span>
          </div>

          {/* Smaller Self-View Preview (Bottom Right) */}
          <div
            data-testid="self-video-preview-container"
            className="absolute bottom-3 right-3 w-36 sm:w-48 aspect-video rounded-xl border border-slate-600/90 bg-slate-900 shadow-lg overflow-hidden"
          >
            <video
              ref={localVideoRef}
              data-testid={isFaculty ? 'local-video-faculty' : 'local-video-student'}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${
                localCameraOn && !isInterviewFinished ? 'block' : 'hidden'
              }`}
            />
            {(!localCameraOn || isInterviewFinished) && (
              <div
                data-testid="self-video-off-overlay"
                className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-slate-900 text-slate-300"
              >
                <VideoOff className="w-4 h-4 text-slate-400 mb-1" />
                <span className="text-[10px] font-medium leading-tight">
                  {isInterviewFinished
                    ? 'Ended'
                    : !isFaculty && !studentMediaControl.cameraEnabled
                    ? 'Disabled by Faculty'
                    : cameraPermission === 'denied'
                    ? 'Permission Denied'
                    : 'Camera Off'}
                </span>
              </div>
            )}
            <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1 pointer-events-none">
              <span
                data-testid="local-participant-label"
                className="px-1.5 py-0.5 rounded bg-slate-950/80 text-[10px] font-semibold text-white truncate"
              >
                {localParticipant.name} ({localParticipant.institutionalId})
              </span>
              <span
                className={`p-1 rounded bg-slate-950/80 ${
                  localMicOn ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {localMicOn ? <Mic className="w-2.5 h-2.5" /> : <MicOff className="w-2.5 h-2.5" />}
              </span>
            </div>
          </div>
        </div>

        {/* Media Controls Bar: Strictly Role-Separated */}
        {isFaculty ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Faculty's Own Camera & Microphone Controls */}
            <div
              data-testid="faculty-own-media-controls"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-surface-dark-muted/30 p-3.5 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Your Media (Faculty)
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Local camera & mic
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={localCameraOn ? 'outline' : 'destructive'}
                  size="sm"
                  icon={localCameraOn ? Video : VideoOff}
                  disabled={isInterviewFinished}
                  onClick={() => handleToggleOwnMedia('camera')}
                  data-testid="btn-faculty-camera-toggle"
                >
                  {localCameraOn ? 'Faculty Camera: ON' : 'Faculty Camera: OFF'}
                </Button>
                <Button
                  type="button"
                  variant={localMicOn ? 'outline' : 'destructive'}
                  size="sm"
                  icon={localMicOn ? Mic : MicOff}
                  disabled={isInterviewFinished}
                  onClick={() => handleToggleOwnMedia('mic')}
                  data-testid="btn-faculty-mic-toggle"
                >
                  {localMicOn ? 'Faculty Mic: ON' : 'Faculty Mic: OFF'}
                </Button>
              </div>
            </div>

            {/* Authorized Student Media Controls */}
            <div
              data-testid="faculty-student-media-controls"
              className="rounded-xl border border-brand-primary/30 dark:border-brand-peach/30 bg-brand-primary/5 dark:bg-brand-primary/10 p-3.5 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Student Media Controls (Authorized)
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Controls {interview?.studentId?.name || 'student'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={studentMediaControl.cameraEnabled ? 'primary' : 'outline'}
                  size="sm"
                  icon={studentMediaControl.cameraEnabled ? Video : VideoOff}
                  disabled={isInterviewFinished || interview?.status !== 'in_progress'}
                  isLoading={
                    pendingStudentCommand === 'STUDENT_CAMERA_ENABLE' ||
                    pendingStudentCommand === 'STUDENT_CAMERA_DISABLE'
                  }
                  onClick={() =>
                    handleFacultyStudentControl(
                      studentMediaControl.cameraEnabled
                        ? 'STUDENT_CAMERA_DISABLE'
                        : 'STUDENT_CAMERA_ENABLE'
                    )
                  }
                  data-testid="btn-student-camera-control"
                >
                  {studentMediaControl.cameraEnabled
                    ? 'Student Camera: Enabled'
                    : 'Student Camera: Disabled'}
                </Button>
                <Button
                  type="button"
                  variant={studentMediaControl.micEnabled ? 'primary' : 'outline'}
                  size="sm"
                  icon={studentMediaControl.micEnabled ? Mic : MicOff}
                  disabled={isInterviewFinished || interview?.status !== 'in_progress'}
                  isLoading={
                    pendingStudentCommand === 'STUDENT_MIC_ENABLE' ||
                    pendingStudentCommand === 'STUDENT_MIC_DISABLE'
                  }
                  onClick={() =>
                    handleFacultyStudentControl(
                      studentMediaControl.micEnabled
                        ? 'STUDENT_MIC_DISABLE'
                        : 'STUDENT_MIC_ENABLE'
                    )
                  }
                  data-testid="btn-student-mic-control"
                >
                  {studentMediaControl.micEnabled
                    ? 'Student Mic: Enabled'
                    : 'Student Mic: Disabled'}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Student Read-Only Locked Media Status (NO interactive toggles) */
          <div
            data-testid="student-locked-media-status"
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-surface-dark-muted/40 p-3.5 flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                data-testid="student-camera-status-badge"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                  localCameraOn
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
                    : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                {localCameraOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
                <span>
                  Camera:{' '}
                  {cameraPermission === 'denied'
                    ? 'Permission Denied'
                    : cameraPermission === 'unavailable'
                    ? 'Unavailable'
                    : !studentMediaControl.cameraEnabled
                    ? 'Disabled by Faculty'
                    : localCameraOn
                    ? 'Active'
                    : 'Inactive'}
                </span>
              </span>

              <span
                data-testid="student-mic-status-badge"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                  localMicOn
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
                    : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                {localMicOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                <span>
                  Microphone:{' '}
                  {micPermission === 'denied'
                    ? 'Permission Denied'
                    : micPermission === 'unavailable'
                    ? 'Unavailable'
                    : !studentMediaControl.micEnabled
                    ? 'Muted by Faculty'
                    : localMicOn
                    ? 'Active'
                    : 'Inactive'}
                </span>
              </span>
            </div>

            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <Wifi className="w-3.5 h-3.5 text-brand-primary" />
              Faculty controls your camera & microphone during this interview
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
