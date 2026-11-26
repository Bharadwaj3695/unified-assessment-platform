import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  VideoOff,
  AlertTriangle,
  RefreshCw,
  Move,
  Minimize2,
  Maximize2,
  ShieldCheck,
} from 'lucide-react';
import Button from '../ui/Button';
import Alert from '../ui/Alert';

/**
 * Maps browser MediaDevices errors into clear, actionable recovery states.
 */
function classifyCameraError(err) {
  const name = err?.name || '';
  const msg = err?.message || '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return {
      status: 'denied',
      eventType: 'camera_permission_denied',
      title: 'Camera Permission Denied',
      guidance:
        'Camera access was blocked. Click the camera icon in your browser address bar, allow camera access for this site, and then click Retry Camera.',
    };
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return {
      status: 'unavailable',
      eventType: 'camera_unavailable',
      title: 'No Camera Detected',
      guidance:
        'No working webcam was found on this device. Connect a camera or check OS privacy settings, then click Retry Camera.',
    };
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return {
      status: 'unavailable',
      eventType: 'camera_unavailable',
      title: 'Camera Already in Use',
      guidance:
        'Your camera appears to be in use by another application or browser tab. Close the other app and click Retry Camera.',
    };
  }
  return {
    status: 'denied',
    eventType: 'camera_permission_denied',
    title: 'Unable to Access Camera',
    guidance: msg || 'Please grant camera permission in your browser settings and retry.',
  };
}

const DEFAULT_DISCLOSURE =
  'Camera preview is used for identity presence verification during this session. Video is not transmitted or recorded unless explicitly enabled by institutional policy.';

/**
 * Reusable Camera Permission Gate + Floating Draggable Live Preview.
 *
 * Handles:
 * - Clear permission explanation & consent disclosure before calling getUserMedia
 * - All failure modes (denied, unavailable, in use, unsupported API, track stopped/disconnected)
 * - Blocking mandatory sessions until camera is granted & active
 * - Repositionable floating preview (drag or corner snap) without obstructing content
 * - Stopping all MediaStreamTracks on unmount or session completion
 */
export default function FloatingCameraPreview({
  enabled = false,
  required = false,
  disclosureText = DEFAULT_DISCLOSURE,
  sessionActive = true,
  onStatusChange,
  onCameraEvent,
}) {
  const [cameraStatus, setCameraStatus] = useState(enabled ? 'prompted' : 'not_required');
  const [errorInfo, setErrorInfo] = useState(null);
  const [requesting, setRequesting] = useState(false);
  const [hasRequestedOnce, setHasRequestedOnce] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [corner, setCorner] = useState('bottom-right'); // 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  const [dragOffset, setDragOffset] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, origX: 0, origY: 0 });
  const hadConnectedOnceRef = useRef(false);

  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.onended = null;
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const notifyStatus = useCallback(
    (status, detail = '') => {
      setCameraStatus(status);
      if (onStatusChange) {
        onStatusChange(status, detail);
      }
    },
    [onStatusChange]
  );

  const emitEvent = useCallback(
    (eventType, detail = '', statusOverride = null) => {
      if (onCameraEvent) {
        onCameraEvent({
          eventType,
          detail,
          status: statusOverride || cameraStatus,
        });
      }
    },
    [onCameraEvent, cameraStatus]
  );

  // Attach stream whenever videoRef mounts or stream changes
  useEffect(() => {
    if (videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraStatus, minimized]);

  // Stop camera immediately if session becomes inactive or component unmounts
  useEffect(() => {
    if (!enabled || !sessionActive) {
      stopTracks();
    }
    return () => {
      stopTracks();
    };
  }, [enabled, sessionActive, stopTracks]);

  const requestCamera = useCallback(async () => {
    if (!enabled) return;
    setHasRequestedOnce(true);
    setErrorInfo(null);

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      const info = {
        status: 'unsupported',
        eventType: 'camera_unavailable',
        title: 'Camera API Unsupported',
        guidance:
          'Your browser does not support camera access (navigator.mediaDevices.getUserMedia). Please use a modern browser over HTTPS or localhost.',
      };
      setErrorInfo(info);
      notifyStatus('unsupported', info.title);
      emitEvent('camera_unavailable', info.title, 'unsupported');
      return;
    }

    try {
      setRequesting(true);
      stopTracks();

      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const isReconnect = hadConnectedOnceRef.current;
      hadConnectedOnceRef.current = true;
      const nextStatus = isReconnect ? 'reconnected' : 'granted';
      const evtType = isReconnect ? 'camera_reconnected' : 'camera_permission_granted';

      notifyStatus(nextStatus, 'Camera stream active');
      emitEvent(evtType, stream.getVideoTracks()[0]?.label || 'Webcam stream active', nextStatus);

      stream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          setErrorInfo({
            status: 'disconnected',
            eventType: 'camera_stream_stopped',
            title: 'Camera Stream Disconnected',
            guidance:
              'Your camera stream stopped unexpectedly or was unplugged. Reconnect your camera and click Reconnect Camera.',
          });
          notifyStatus('disconnected', 'Camera track ended unexpectedly');
          emitEvent('camera_disconnected', 'Camera track ended unexpectedly', 'disconnected');
        };
      });
    } catch (err) {
      const classified = classifyCameraError(err);
      setErrorInfo(classified);
      notifyStatus(classified.status, classified.guidance);
      emitEvent(classified.eventType, `${err?.name || 'Error'}: ${err?.message || classified.title}`, classified.status);
    } finally {
      setRequesting(false);
    }
  }, [enabled, stopTracks, notifyStatus, emitEvent]);

  // Dragging handlers for floating preview
  const handlePointerDown = (e) => {
    draggingRef.current = true;
    const rect = e.currentTarget.parentElement.getBoundingClientRect();
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      origX: dragOffset ? dragOffset.x : rect.left,
      origY: dragOffset ? dragOffset.y : rect.top,
    };
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!draggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setDragOffset({
        x: Math.max(8, Math.min(window.innerWidth - 220, dragStartRef.current.origX + dx)),
        y: Math.max(8, Math.min(window.innerHeight - 160, dragStartRef.current.origY + dy)),
      });
    };
    const onUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  if (!enabled) return null;

  const isStreamLive = cameraStatus === 'granted' || cameraStatus === 'reconnected';
  const showPermissionGate = required && !isStreamLive && sessionActive;

  const cornerClassMap = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-20 right-4',
    'top-left': 'top-20 left-4',
  };

  const cycleCorner = () => {
    setDragOffset(null);
    const order = ['bottom-right', 'bottom-left', 'top-left', 'top-right'];
    setCorner(order[(order.indexOf(corner) + 1) % order.length]);
  };

  return (
    <>
      {/* Blocking Gate when camera is mandatory and not currently live */}
      {showPermissionGate && (
        <div
          data-testid="camera-permission-gate"
          className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/30 p-5 space-y-4 shadow-warm-sm"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              {cameraStatus === 'disconnected' || cameraStatus === 'denied' || cameraStatus === 'unavailable' ? (
                <VideoOff className="w-5 h-5" />
              ) : (
                <Camera className="w-5 h-5" />
              )}
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {errorInfo ? errorInfo.title : 'Camera Access Required'}
                </h3>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-200/70 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                  <ShieldCheck className="w-3 h-3" />
                  Mandatory Camera Check
                </span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                {disclosureText || DEFAULT_DISCLOSURE}
              </p>
              {errorInfo && (
                <Alert variant="warning" title="Recovery Instructions">
                  {errorInfo.guidance}
                </Alert>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={hasRequestedOnce ? RefreshCw : Camera}
              isLoading={requesting}
              onClick={requestCamera}
              data-testid="btn-enable-camera"
            >
              {cameraStatus === 'disconnected'
                ? 'Reconnect Camera'
                : hasRequestedOnce
                ? 'Retry Camera Access'
                : 'Allow Camera & Continue'}
            </Button>
            <span className="text-xs text-slate-600 dark:text-slate-400">
              Status:{' '}
              <strong data-testid="camera-gate-status" className="uppercase">
                {cameraStatus}
              </strong>
            </span>
          </div>
        </div>
      )}

      {/* Optional (non-blocking) prompt banner if camera proctoring is enabled without strict block */}
      {!required && !isStreamLive && sessionActive && (
        <div
          data-testid="camera-optional-banner"
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-surface-dark-muted/40 p-3 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
            <Camera className="w-4 h-4 text-brand-primary shrink-0" />
            <span>{disclosureText || DEFAULT_DISCLOSURE}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={Camera}
            isLoading={requesting}
            onClick={requestCamera}
            data-testid="btn-enable-camera"
          >
            Enable Camera Preview
          </Button>
        </div>
      )}

      {/* Floating Repositionable Live Webcam Preview */}
      {sessionActive && (isStreamLive || cameraStatus === 'disconnected') && (
        <div
          data-testid="floating-camera-preview"
          style={
            dragOffset
              ? { position: 'fixed', left: `${dragOffset.x}px`, top: `${dragOffset.y}px`, zIndex: 45 }
              : undefined
          }
          className={`${
            dragOffset ? '' : `fixed ${cornerClassMap[corner]} z-45`
          } w-52 sm:w-56 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white/95 dark:bg-surface-dark/95 backdrop-blur-md shadow-warm-lg overflow-hidden select-none`}
        >
          {/* Drag Handle & Status Header */}
          <div
            onPointerDown={handlePointerDown}
            title="Drag to reposition preview"
            className="flex items-center justify-between px-2.5 py-1.5 bg-slate-100 dark:bg-surface-dark-elevated border-b border-slate-200 dark:border-slate-700 cursor-move"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isStreamLive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-100 truncate">
                {isStreamLive ? 'Camera Live' : 'Disconnected'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={cycleCorner}
                onPointerDown={(e) => e.stopPropagation()}
                title="Move corner"
                data-testid="btn-move-camera-preview"
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              >
                <Move className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setMinimized((m) => !m)}
                onPointerDown={(e) => e.stopPropagation()}
                title={minimized ? 'Expand preview' : 'Minimize preview'}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              >
                {minimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {!minimized && (
            <div className="relative bg-slate-950 aspect-video flex items-center justify-center">
              <video
                ref={videoRef}
                data-testid="floating-camera-video"
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${isStreamLive ? 'block' : 'hidden'}`}
              />
              {!isStreamLive && (
                <div className="p-3 text-center space-y-1.5">
                  <AlertTriangle className="w-5 h-5 text-amber-400 mx-auto" />
                  <p className="text-[11px] text-slate-200">Camera disconnected</p>
                  <button
                    type="button"
                    onClick={requestCamera}
                    className="px-2 py-1 rounded bg-brand-primary text-white text-[10px] font-semibold hover:bg-brand-primary-hover"
                  >
                    Reconnect
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
