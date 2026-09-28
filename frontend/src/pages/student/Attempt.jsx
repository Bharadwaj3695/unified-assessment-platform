import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { toast } from 'react-toastify';
import assessmentService from '../../services/assessment.service';
import submissionService from '../../services/submission.service';
import proctoringService from '../../services/proctoring.service';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import ErrorState from '../../components/ui/ErrorState';
import ProgressBar from '../../components/ui/ProgressBar';
import {
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Send,
  Save,
  HelpCircle,
  FileText,
  AlertTriangle,
  RefreshCw,
  Shield,
  ShieldAlert,
  Camera,
  VideoOff,
  Upload,
  Download,
  ExternalLink,
  FileCheck,
  Trash2,
  Paperclip,
  X,
} from 'lucide-react';

const Attempt = () => {
  const { id: assessmentId } = useParams();
  const navigate = useNavigate();

  const [assessment, setAssessment] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const answersRef = useRef({});

  // Loading & error states
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Autosave status: 'idle' | 'saving' | 'saved' | 'error'
  const [saveStatus, setSaveStatus] = useState('idle');
  const [lastSavedAt, setLastSavedAt] = useState(null);

  // Timer states (seconds remaining)
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Submit modal state
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  // Proctoring states
  const [proctoringSession, setProctoringSession] = useState(null);
  const [cameraStatus, setCameraStatus] = useState('not_required');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Document Submission states (Phase 5)
  const [selectedFiles, setSelectedFiles] = useState({});
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [gdocsUrls, setGdocsUrls] = useState({});
  const [isAttachingUrl, setIsAttachingUrl] = useState(false);
  const [replacingQuestionId, setReplacingQuestionId] = useState({});
  const [activeTabByQuestion, setActiveTabByQuestion] = useState({});

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Final submit handler
  const handleFinalSubmit = useCallback(
    async (isAutoSubmit = false) => {
      if (!submission?._id || isSubmittingRef.current) return;
      isSubmittingRef.current = true;
      setIsSubmitting(true);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      const isAuto = typeof isAutoSubmit === 'boolean' ? isAutoSubmit : false;

      try {
        stopCamera();
        await submissionService.submitAssessment(submission._id, answersRef.current || {});
        toast.success(
          isAuto
            ? 'Time expired. Assessment submitted successfully!'
            : 'Assessment submitted successfully!'
        );
        navigate('/student/dashboard', { replace: true });
      } catch (err) {
        toast.error(err.message || 'Submission failed. Please check your connection.');
        setIsSubmitting(false);
        isSubmittingRef.current = false;
        setIsSubmitModalOpen(false);
      }
    },
    [submission?._id, stopCamera, navigate]
  );

  // Load assessment metadata and initiate/resume attempt
  const initializeAttempt = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      // 1. Fetch sanitized assessment details
      const assessmentData = await assessmentService.getAssessmentById(assessmentId);
      setAssessment(assessmentData);
      setQuestions(assessmentData.questions || []);

      // 2. Start or resume existing in-progress attempt
      const submissionData = await submissionService.startAttempt(assessmentId);
      if (submissionData.status && submissionData.status !== 'in_progress') {
        setLoadError('This assessment attempt has already been submitted and finalized.');
        return;
      }
      setSubmission(submissionData);

      // 3. Initialize answers
      const existingAnswers = submissionData.answers
        ? (submissionData.answers instanceof Map
            ? Object.fromEntries(submissionData.answers)
            : submissionData.answers)
        : {};
      setAnswers(existingAnswers);
      answersRef.current = existingAnswers;

      // 4. Initialize server-authoritative timer countdown
      if (submissionData.deadlineAt) {
        const deadlineMs = new Date(submissionData.deadlineAt).getTime();
        const remainingSec = Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000));
        if (remainingSec <= 0) {
          setLoadError('The allotted time limit for this exam attempt has expired.');
          return;
        }
        setTimeLeft(remainingSec);
      }

      // 5. Initialize Proctoring telemetry if enabled on assessment
      if (assessmentData.proctoringEnabled) {
        try {
          const subId = submissionData._id || submissionData.id;
          const procData = await proctoringService.getSessionBySubmission(subId);
          if (procData?.session) {
            const currentSession = procData.session;
            const sessId = currentSession._id || currentSession.id;
            setProctoringSession(currentSession);
            setCameraStatus(currentSession.cameraStatus || 'not_required');

            // Request camera access if required
            if (assessmentData.cameraRequired && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
              try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                streamRef.current = stream;
                if (videoRef.current) {
                  videoRef.current.srcObject = stream;
                }
                setCameraStatus('granted');
                await proctoringService.recordEvent(sessId, {
                  eventType: 'camera_permission_granted',
                  severity: 'info',
                });

                // Monitor track disconnection
                stream.getVideoTracks().forEach((track) => {
                  track.onended = () => {
                    setCameraStatus('disconnected');
                    proctoringService.recordEvent(sessId, {
                      eventType: 'camera_disconnected',
                      severity: 'medium',
                    }).catch(() => {});
                  };
                });
              } catch (camErr) {
                setCameraStatus('denied');
                await proctoringService.recordEvent(sessId, {
                  eventType: 'camera_permission_denied',
                  severity: 'medium',
                  metadata: { errorName: camErr.name, errorMessage: camErr.message },
                });
                toast.warning('Camera verification required: Please allow camera access for exam proctoring.');
              }
            }
          }
        } catch (procErr) {
          console.warn('[Attempt] Proctoring telemetry initialization notice:', procErr.message);
        }
      }
    } catch (err) {
      setLoadError(err.message || 'Unable to start assessment attempt.');
    } finally {
      setIsLoading(false);
    }
  }, [assessmentId]);

  const handleFinalSubmitRef = useRef(handleFinalSubmit);
  useEffect(() => {
    handleFinalSubmitRef.current = handleFinalSubmit;
  }, [handleFinalSubmit]);

  useEffect(() => {
    initializeAttempt();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      stopCamera();
    };
  }, [initializeAttempt, stopCamera]);

  // Handle countdown timer based strictly on server deadline
  useEffect(() => {
    if (!submission?.deadlineAt) return;

    const deadlineMs = new Date(submission.deadlineAt).getTime();
    const initialRemaining = Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000));

    if (initialRemaining <= 0) {
      setLoadError('The allotted time limit for this exam attempt has expired.');
      return;
    }

    setTimeLeft(initialRemaining);

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((deadlineMs - now) / 1000));
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        if (!isSubmittingRef.current) {
          toast.warning('Allotted assessment time has expired! Finalizing attempt...');
          if (handleFinalSubmitRef.current) {
            handleFinalSubmitRef.current(true);
          }
        }
      }
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [submission?.deadlineAt]);

  // Format seconds to mm:ss or hh:mm:ss
  const formatTimer = (seconds) => {
    if (seconds === null) return '--:--';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Perform granular autosave
  const triggerAutosave = useCallback(
    async (qId, answerValue) => {
      if (!submission?._id || !qId) return;

      setSaveStatus('saving');
      try {
        await submissionService.autosaveAnswer(submission._id, qId, answerValue);
        setSaveStatus('saved');
        setLastSavedAt(new Date());
      } catch (err) {
        console.error('Autosave error:', err);
        setSaveStatus('error');
      }
    },
    [submission?._id]
  );

  // Handle answer changes
  const handleAnswerChange = (qId, value) => {
    setAnswers((prev) => {
      const updated = {
        ...prev,
        [qId]: value,
      };
      answersRef.current = updated;
      return updated;
    });

    // Debounce autosave
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setSaveStatus('saving');
    debounceTimerRef.current = setTimeout(() => {
      triggerAutosave(qId, value);
    }, 800);
  };

  // Document Submission Handlers (Phase 5)
  const handleFileUpload = async (questionId, file) => {
    if (!file || !submission?._id) return;
    const maxMb = currentQuestion?.fileUploadConfig?.maxFileSizeMb || 10;
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of ${maxMb}MB.`);
      return;
    }

    try {
      setIsUploadingFile(true);
      setUploadProgress(0);
      setSaveStatus('saving');

      const res = await submissionService.uploadAnswerFile(
        submission._id,
        questionId,
        file,
        (progressEvent) => {
          const percent = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 50;
          setUploadProgress(percent);
        }
      );

      const savedAnswer = res.data?.answer || res.answer;
      const updated = {
        ...answersRef.current,
        [questionId]: savedAnswer,
      };
      answersRef.current = updated;
      setAnswers(updated);
      setSaveStatus('saved');
      setLastSavedAt(new Date());
      setSelectedFiles((prev) => ({ ...prev, [questionId]: null }));
      setReplacingQuestionId((prev) => ({ ...prev, [questionId]: false }));
      toast.success('Document uploaded and saved successfully!');
    } catch (err) {
      setSaveStatus('error');
      toast.error(err.message || 'Failed to upload document file.');
    } finally {
      setIsUploadingFile(false);
      setUploadProgress(0);
    }
  };

  const handleGoogleDocsSubmit = async (questionId, url) => {
    if (!url || !url.trim() || !submission?._id) {
      toast.error('Please provide a Google Docs URL.');
      return;
    }
    const trimmed = url.trim();
    if (!trimmed.startsWith('https://docs.google.com/document/d/')) {
      toast.error('URL must follow standard format: https://docs.google.com/document/d/...');
      return;
    }

    try {
      setIsAttachingUrl(true);
      setSaveStatus('saving');
      const res = await submissionService.attachGoogleDocsUrl(submission._id, questionId, trimmed);
      const savedAnswer = res.data?.answer || res.answer;
      const updated = {
        ...answersRef.current,
        [questionId]: savedAnswer,
      };
      answersRef.current = updated;
      setAnswers(updated);
      setSaveStatus('saved');
      setLastSavedAt(new Date());
      setGdocsUrls((prev) => ({ ...prev, [questionId]: '' }));
      setReplacingQuestionId((prev) => ({ ...prev, [questionId]: false }));
      toast.success('Google Docs link attached successfully!');
    } catch (err) {
      setSaveStatus('error');
      toast.error(err.message || 'Failed to attach Google Docs link.');
    } finally {
      setIsAttachingUrl(false);
    }
  };

  const handleRemoveFile = async (questionId) => {
    if (!submission?._id) return;
    try {
      await submissionService.removeAnswerFile(submission._id, questionId);
      const updated = { ...answersRef.current };
      delete updated[questionId];
      answersRef.current = updated;
      setAnswers(updated);
      setSaveStatus('saved');
      setLastSavedAt(new Date());
      setSelectedFiles((prev) => ({ ...prev, [questionId]: null }));
      setGdocsUrls((prev) => ({ ...prev, [questionId]: '' }));
      setReplacingQuestionId((prev) => ({ ...prev, [questionId]: false }));
      toast.info('Document submission removed.');
    } catch (err) {
      toast.error(err.message || 'Failed to remove document.');
    }
  };

  const handleDownloadFile = async (questionId, download = false) => {
    if (!submission?._id) return;
    try {
      const currentAns = answers[questionId];
      const filename = currentAns?.originalFilename || 'submission.pdf';
      const blob = await submissionService.getAnswerFileBlob(submission._id, questionId, download);
      const url = window.URL.createObjectURL(blob);
      if (download) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        window.open(url, '_blank');
      }
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);
    } catch (err) {
      toast.error(err.message || 'Failed to access file.');
    }
  };

  const currentQuestion = questions[currentIdx];
  const totalQuestions = questions.length;
  const answeredCount = Object.values(answers).filter((a) => {
    if (a === undefined || a === null) return false;
    if (typeof a === 'object') return Boolean(a.fileKey || a.googleDocsUrl);
    return String(a).trim() !== '';
  }).length;
  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const isLastQuestion = currentIdx === totalQuestions - 1;

  // Phase 2A: Clipboard policy enforcement for written responses during active attempts
  const isClipboardRestricted = Boolean(
    assessment?.proctoringEnabled &&
    submission?.status === 'in_progress' &&
    currentQuestion &&
    ['short_answer', 'long_answer'].includes(currentQuestion.type)
  );

  const lastClipboardEventRef = useRef({ time: 0, action: '', questionId: '' });

  const handleClipboardBlocked = useCallback(
    (action, e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      // Subtle, non-intrusive feedback toast with fixed toastId to avoid stacking
      toast.warning('Copy and paste are disabled for written answers during this assessment.', {
        toastId: 'clipboard-policy-toast',
        autoClose: 3000,
      });

      // Client-side debounce (1500ms cooldown per action on same question)
      const now = Date.now();
      const last = lastClipboardEventRef.current;
      if (
        now - last.time < 1500 &&
        last.action === action &&
        last.questionId === currentQuestion?._id
      ) {
        return;
      }
      lastClipboardEventRef.current = {
        time: now,
        action,
        questionId: currentQuestion?._id,
      };

      // Dispatch telemetry event to existing ProctoringSession
      const sessId =
        proctoringSession?._id || proctoringSession?.id || submission?.proctoringSessionId;
      if (sessId && assessment?.proctoringEnabled) {
        const eventType =
          action === 'paste' ? 'paste_blocked' : action === 'cut' ? 'cut_blocked' : 'copy_blocked';

        proctoringService
          .recordEvent(sessId, {
            eventType,
            severity: 'low',
            metadata: {
              questionId: currentQuestion?._id,
              questionType: currentQuestion?.type,
              action,
              source: 'written_response',
            },
          })
          .catch((err) => {
            console.warn('[Attempt] Non-fatal clipboard telemetry error:', err?.message);
          });
      }
    },
    [proctoringSession, submission?.proctoringSessionId, assessment?.proctoringEnabled, currentQuestion]
  );

  const handleContextMenu = useCallback(
    (e) => {
      if (!isClipboardRestricted) return;
      e.preventDefault();
      e.stopPropagation();
      toast.warning('Copy and paste are disabled for written answers during this assessment.', {
        toastId: 'clipboard-policy-toast',
        autoClose: 3000,
      });
    },
    [isClipboardRestricted]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (!isClipboardRestricted) return;
      const isModifier = e.ctrlKey || e.metaKey;
      if (isModifier) {
        const key = e.key?.toLowerCase();
        if (key === 'v') {
          handleClipboardBlocked('paste', e);
        } else if (key === 'c') {
          handleClipboardBlocked('copy', e);
        } else if (key === 'x') {
          handleClipboardBlocked('cut', e);
        }
      }
    },
    [isClipboardRestricted, handleClipboardBlocked]
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-4">
        <Spinner size="lg" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Loading authorized exam environment...
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <ErrorState
          title="Cannot Access Assessment"
          message={loadError}
          onRetry={() => navigate('/student/dashboard')}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Sticky Top Bar: Exam Title, Progress & Server Timer */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#1A202C]/95 backdrop-blur-md border border-[#EBE3D8] dark:border-[#2D3748] py-3 px-4 sm:px-6 rounded-2xl shadow-warm-xs transition-all">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="terracotta" size="sm">
                {assessment?.category || 'Assessment'}
              </Badge>
              {assessment?.proctoringEnabled && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  <Shield className="w-3 h-3 text-indigo-500" />
                  Proctored Exam
                </span>
              )}
              {assessment?.cameraRequired && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                  cameraStatus === 'granted'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : cameraStatus === 'denied'
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                }`}>
                  {cameraStatus === 'granted' ? (
                    <Camera className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <VideoOff className="w-3 h-3 text-rose-500" />
                  )}
                  {cameraStatus === 'granted' ? 'Camera Live' : cameraStatus === 'denied' ? 'Camera Denied' : 'Camera Disconnected'}
                </span>
              )}
              <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                Passing: {assessment?.passingScore}%
              </span>
            </div>
            <video ref={videoRef} className="hidden" autoPlay playsInline muted />
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#1F2937] dark:text-[#F9FAFB] line-clamp-1 mt-0.5">
              {assessment?.title}
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            {/* Autosave Status Indicator with ARIA live region and Retry button */}
            <div
              className="flex items-center space-x-1.5 text-xs"
              role="status"
              aria-live="polite"
            >
              {saveStatus === 'saving' && (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#E05D38] flex-shrink-0" />
                  <span className="text-[#E05D38] font-medium hidden sm:inline">Autosaving...</span>
                  <span className="sr-only">Saving your response...</span>
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                  <CheckCircle className="w-3.5 h-3.5 text-[#3D8A78] flex-shrink-0" />
                  <span className="text-[#64748B] dark:text-[#94A3B8] hidden sm:inline">
                    Saved {lastSavedAt ? lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                  <span className="sr-only">Answer saved</span>
                </>
              )}
              {saveStatus === 'error' && (
                <div className="flex items-center space-x-1">
                  <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                  <span className="text-red-500 font-medium text-xs">Autosave failed</span>
                  {currentQuestion?._id && (
                    <button
                      type="button"
                      onClick={() => triggerAutosave(currentQuestion._id, answers[currentQuestion._id])}
                      className="ml-1 text-[11px] font-semibold text-[#E05D38] underline hover:text-[#C84E2D] focus:outline-none focus:ring-1 focus:ring-[#E05D38] rounded"
                      aria-label="Retry saving answer"
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Server-Authoritative Timer Pill */}
            <div
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl font-mono text-sm font-bold border shadow-xs ${
                timeLeft !== null && timeLeft <= 60
                  ? 'bg-red-50 dark:bg-red-950/40 text-red-600 border-red-300 dark:border-red-800 animate-pulse'
                  : timeLeft !== null && timeLeft <= 300
                  ? 'bg-[#FFF4ED] dark:bg-[#341C16] text-[#E05D38] border-[#F4A261]/40'
                  : 'bg-[#F3F7FB] dark:bg-[#1E293B] text-[#1F2937] dark:text-[#F1F5F9] border-[#E2E8F0] dark:border-[#334155]'
              }`}
            >
              <Clock className="w-4 h-4 flex-shrink-0 text-[#E05D38]" />
              <span>{formatTimer(timeLeft)}</span>
            </div>

            <Button
              variant="primary"
              size="sm"
              icon={Send}
              iconPosition="right"
              onClick={() => setIsSubmitModalOpen(true)}
            >
              Submit Exam
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-2.5">
          <ProgressBar
            value={progressPercent}
            color={progressPercent === 100 ? 'sage' : 'primary'}
            size="sm"
            showLabel={false}
          />
        </div>
      </div>

      {/* Main Attempt Grid: Question Engine + Navigation Palette */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 Cols: Active Question Workspace */}
        <div className="lg:col-span-8 space-y-6">
          {currentQuestion ? (
            <Card>
              {/* Question Header */}
              <div className="flex items-center justify-between pb-4 border-b border-surface-light-border dark:border-surface-dark-border">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-[#E05D38] dark:text-[#F4A261]">
                    Question {currentIdx + 1} of {totalQuestions}
                  </span>
                  <Badge variant="neutral" size="sm" className="uppercase text-[10px]">
                    {currentQuestion.type?.replace('_', ' ')}
                  </Badge>
                </div>
                <Badge variant="sage" size="sm">
                  {currentQuestion.points} Points
                </Badge>
              </div>

              {/* Question Prompt */}
              <div className="py-5">
                <h3 className="text-base sm:text-lg font-semibold text-[#1F2937] dark:text-[#F9FAFB] leading-relaxed">
                  {currentQuestion.questionText}
                </h3>
              </div>

              {/* Question Inputs by Type */}
              <div className="pt-2 pb-6">
                {/* 1. Multiple Choice Question (MCQ) */}
                {currentQuestion.type === 'mcq' && (
                  <div className="space-y-3">
                    {currentQuestion.options?.map((opt) => {
                      const isSelected = answers[currentQuestion._id] === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleAnswerChange(currentQuestion._id, opt.id)}
                          className={`w-full text-left p-4 rounded-xl border transition-all flex items-start space-x-3 cursor-pointer ${
                            isSelected
                              ? 'border-[#E05D38] bg-[#FDECE2] dark:bg-[#341C16] text-[#1F2937] dark:text-[#F9FAFB] ring-1 ring-[#E05D38]'
                              : 'border-[#EBE3D8] dark:border-[#2D3748] bg-white dark:bg-[#1A202C] hover:border-[#F4A261] hover:bg-[#FFFDFB] text-[#1F2937] dark:text-[#E2E8F0]'
                          }`}
                        >
                          <div
                            className={`w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold transition-colors ${
                              isSelected
                                ? 'border-[#E05D38] bg-[#E05D38] text-white'
                                : 'border-[#EBE3D8] dark:border-[#2D3748] bg-[#FFF9F2] dark:bg-[#12161F] text-[#64748B]'
                            }`}
                          >
                            {opt.id?.toUpperCase()}
                          </div>
                          <span className="text-sm font-medium pt-0.5">{opt.text}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 2. Short Answer Question */}
                {currentQuestion.type === 'short_answer' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">
                        Your Concise Response:
                      </label>
                      {assessment?.proctoringEnabled && (
                        <span className="text-[10px] text-[#E05D38] dark:text-[#F4A261] font-medium flex items-center space-x-1">
                          <ShieldAlert className="w-3 h-3" />
                          <span>Clipboard disabled</span>
                        </span>
                      )}
                    </div>
                    <textarea
                      rows={4}
                      value={answers[currentQuestion._id] || ''}
                      onChange={(e) => handleAnswerChange(currentQuestion._id, e.target.value)}
                      onCopyCapture={isClipboardRestricted ? (e) => handleClipboardBlocked('copy', e) : undefined}
                      onCutCapture={isClipboardRestricted ? (e) => handleClipboardBlocked('cut', e) : undefined}
                      onPasteCapture={isClipboardRestricted ? (e) => handleClipboardBlocked('paste', e) : undefined}
                      onContextMenu={isClipboardRestricted ? handleContextMenu : undefined}
                      onKeyDownCapture={isClipboardRestricted ? handleKeyDown : undefined}
                      placeholder="Type your short answer explanation here..."
                      className="w-full rounded-xl border border-[#EBE3D8] dark:border-[#2D3748] bg-white dark:bg-[#12161F] p-3.5 text-sm text-[#1F2937] dark:text-[#F9FAFB] focus:outline-none focus:border-[#E05D38] focus:ring-2 focus:ring-[#E05D38]/20 transition-all placeholder:text-[#64748B]/50"
                    />
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] text-right">
                      {(answers[currentQuestion._id] || '').length} characters entered
                    </p>
                  </div>
                )}

                {/* 3. Long Answer / Rich Text Essay */}
                {currentQuestion.type === 'long_answer' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider flex items-center space-x-1.5">
                        <FileText className="w-3.5 h-3.5 text-[#E05D38]" />
                        <span>Rich Text Essay Response (React Quill Editor):</span>
                      </label>
                      {assessment?.proctoringEnabled && (
                        <span className="text-[10px] text-[#E05D38] dark:text-[#F4A261] font-medium flex items-center space-x-1">
                          <ShieldAlert className="w-3 h-3" />
                          <span>Clipboard disabled</span>
                        </span>
                      )}
                    </div>
                    <div
                      onCopyCapture={isClipboardRestricted ? (e) => handleClipboardBlocked('copy', e) : undefined}
                      onCutCapture={isClipboardRestricted ? (e) => handleClipboardBlocked('cut', e) : undefined}
                      onPasteCapture={isClipboardRestricted ? (e) => handleClipboardBlocked('paste', e) : undefined}
                      onContextMenu={isClipboardRestricted ? handleContextMenu : undefined}
                      onKeyDownCapture={isClipboardRestricted ? handleKeyDown : undefined}
                      className="bg-white dark:bg-[#12161F] rounded-xl border border-[#EBE3D8] dark:border-[#2D3748] overflow-hidden focus-within:border-[#E05D38] focus-within:ring-2 focus-within:ring-[#E05D38]/20 transition-all"
                    >
                      <ReactQuill
                        theme="snow"
                        value={answers[currentQuestion._id] || ''}
                        onChange={(content) => handleAnswerChange(currentQuestion._id, content)}
                        placeholder="Compose your comprehensive technical response with structured paragraphs and code snippets..."
                        modules={{
                          toolbar: [
                            [{ header: [1, 2, 3, false] }],
                            ['bold', 'italic', 'underline', 'strike', 'blockquote'],
                            [{ list: 'ordered' }, { list: 'bullet' }],
                            ['code-block', 'clean'],
                          ],
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* 4. True/False Question */}
                {currentQuestion.type === 'true_false' && (
                  <div className="grid grid-cols-2 gap-4">
                    {['true', 'false'].map((val) => {
                      const isSelected = answers[currentQuestion._id] === val;
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => handleAnswerChange(currentQuestion._id, val)}
                          className={`p-4 rounded-xl border text-center font-bold capitalize transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#E05D38] bg-[#E05D38] text-white shadow-warm-xs'
                              : 'border-[#EBE3D8] dark:border-[#2D3748] bg-white dark:bg-[#1A202C] hover:border-[#F4A261] text-[#1F2937] dark:text-[#E2E8F0]'
                          }`}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 5. Document File Upload / Google Docs Question */}
                {currentQuestion.type === 'file_upload' && (() => {
                  const qId = currentQuestion._id;
                  const currentAnswer = answers[qId];
                  const isReplacing = Boolean(replacingQuestionId[qId]);
                  const hasExistingAnswer = Boolean(
                    currentAnswer &&
                    typeof currentAnswer === 'object' &&
                    (currentAnswer.fileKey || currentAnswer.googleDocsUrl)
                  );
                  const activeTab = activeTabByQuestion[qId] || 'upload';
                  const selectedFile = selectedFiles[qId];
                  const gdocsUrl = gdocsUrls[qId] || '';
                  const allowedExts = currentQuestion.fileUploadConfig?.allowedFileTypes || ['pdf', 'doc', 'docx'];
                  const maxMb = currentQuestion.fileUploadConfig?.maxFileSizeMb || 10;
                  const allowGDocs = currentQuestion.fileUploadConfig?.allowGoogleDocs !== false;

                  if (hasExistingAnswer && !isReplacing) {
                    const isFile = currentAnswer.type === 'file';
                    return (
                      <div className="space-y-4">
                        <div className="p-5 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center space-x-3 overflow-hidden">
                              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                                <FileCheck className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center space-x-2">
                                  <span className="text-sm font-bold text-[#1F2937] dark:text-[#F9FAFB] truncate">
                                    {isFile ? currentAnswer.originalFilename : 'Google Docs Submission'}
                                  </span>
                                  <Badge variant="success" size="sm">
                                    Saved & Attached
                                  </Badge>
                                </div>
                                <div className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                                  {isFile ? (
                                    <>
                                      <span>{currentAnswer.size ? `${(currentAnswer.size / (1024 * 1024)).toFixed(2)} MB` : ''}</span>
                                      <span className="mx-1.5">•</span>
                                      <span>Uploaded {new Date(currentAnswer.uploadedAt || Date.now()).toLocaleTimeString()}</span>
                                    </>
                                  ) : (
                                    <a
                                      href={currentAnswer.googleDocsUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[#E05D38] hover:underline flex items-center space-x-1"
                                    >
                                      <span className="truncate max-w-xs sm:max-w-md">{currentAnswer.googleDocsUrl}</span>
                                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2 self-end sm:self-auto flex-shrink-0">
                              {isFile ? (
                                <>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    icon={Download}
                                    onClick={() => handleDownloadFile(qId, true)}
                                    title="Download submitted file"
                                  >
                                    Download
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    icon={ExternalLink}
                                    onClick={() => handleDownloadFile(qId, false)}
                                    title="Preview file"
                                  >
                                    Preview
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  icon={ExternalLink}
                                  onClick={() => window.open(currentAnswer.googleDocsUrl, '_blank', 'noopener,noreferrer')}
                                >
                                  Open Document
                                </Button>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-emerald-200/60 dark:border-emerald-900/40">
                            <button
                              type="button"
                              onClick={() => setReplacingQuestionId((prev) => ({ ...prev, [qId]: true }))}
                              className="text-xs font-semibold text-[#E05D38] hover:underline cursor-pointer"
                            >
                              Replace with new submission
                            </button>
                            <span className="text-slate-300 dark:text-slate-700">•</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(qId)}
                              className="text-xs font-semibold text-red-600 hover:underline cursor-pointer flex items-center space-x-1"
                            >
                              <Trash2 className="w-3 h-3 mr-0.5" />
                              Remove submission
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {/* Tabs if Google Docs is allowed */}
                      {allowGDocs && (
                        <div className="flex border-b border-[#EBE3D8] dark:border-[#2D3748] space-x-4">
                          <button
                            type="button"
                            onClick={() => setActiveTabByQuestion((prev) => ({ ...prev, [qId]: 'upload' }))}
                            className={`pb-2.5 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 cursor-pointer flex items-center space-x-1.5 ${
                              activeTab === 'upload'
                                ? 'border-[#E05D38] text-[#E05D38]'
                                : 'border-transparent text-[#64748B] hover:text-[#1F2937]'
                            }`}
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Upload Document File</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTabByQuestion((prev) => ({ ...prev, [qId]: 'gdocs' }))}
                            className={`pb-2.5 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 cursor-pointer flex items-center space-x-1.5 ${
                              activeTab === 'gdocs'
                                ? 'border-[#E05D38] text-[#E05D38]'
                                : 'border-transparent text-[#64748B] hover:text-[#1F2937]'
                            }`}
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                            <span>Google Docs URL</span>
                          </button>
                        </div>
                      )}

                      {/* Tab 1: File Upload */}
                      {activeTab === 'upload' && (
                        <div className="space-y-4">
                          <div className="p-6 rounded-2xl border-2 border-dashed border-[#EBE3D8] dark:border-[#2D3748] bg-white dark:bg-[#12161F] text-center space-y-3">
                            <div className="w-12 h-12 mx-auto rounded-2xl bg-[#FFF4ED] dark:bg-[#341C16] flex items-center justify-center text-[#E05D38]">
                              <Upload className="w-6 h-6" />
                            </div>

                            <div>
                              <label className="cursor-pointer inline-block">
                                <span className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#E05D38] hover:bg-[#C84E2D] shadow-warm-xs transition-colors">
                                  Choose File
                                </span>
                                <input
                                  type="file"
                                  accept={allowedExts.map((e) => `.${e}`).join(',')}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      setSelectedFiles((prev) => ({ ...prev, [qId]: file }));
                                    }
                                  }}
                                  className="hidden"
                                />
                              </label>
                              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-2">
                                Supported: <strong>{allowedExts.map((e) => e.toUpperCase()).join(', ')}</strong> • Max size: <strong>{maxMb}MB</strong>
                              </p>
                            </div>

                            {selectedFile && (
                              <div className="mt-4 p-3 rounded-xl bg-[#FFF9F2] dark:bg-[#1A202C] border border-[#EBE3D8] dark:border-[#2D3748] flex items-center justify-between text-left">
                                <div className="flex items-center space-x-2.5 overflow-hidden">
                                  <FileText className="w-4 h-4 text-[#E05D38] flex-shrink-0" />
                                  <div className="truncate">
                                    <p className="text-xs font-bold text-[#1F2937] dark:text-[#F9FAFB] truncate">
                                      {selectedFile.name}
                                    </p>
                                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center space-x-2 flex-shrink-0">
                                  <Button
                                    type="button"
                                    variant="primary"
                                    size="sm"
                                    loading={isUploadingFile}
                                    onClick={() => handleFileUpload(qId, selectedFile)}
                                  >
                                    Upload Answer
                                  </Button>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedFiles((prev) => ({ ...prev, [qId]: null }))}
                                    className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            )}

                            {isUploadingFile && (
                              <div className="space-y-1.5 pt-2">
                                <div className="flex justify-between text-xs text-[#64748B]">
                                  <span>Uploading document securely...</span>
                                  <span>{uploadProgress}%</span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-[#E05D38] transition-all duration-300"
                                    style={{ width: `${uploadProgress}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Tab 2: Google Docs URL */}
                      {activeTab === 'gdocs' && (
                        <div className="p-5 rounded-2xl border border-[#EBE3D8] dark:border-[#2D3748] bg-white dark:bg-[#12161F] space-y-3">
                          <label className="block text-xs font-bold text-[#1F2937] dark:text-[#F9FAFB]">
                            Google Docs URL:
                          </label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="url"
                              value={gdocsUrl}
                              onChange={(e) => setGdocsUrls((prev) => ({ ...prev, [qId]: e.target.value }))}
                              placeholder="https://docs.google.com/document/d/..."
                              className="flex-1 px-3.5 py-2 text-xs bg-[#FFF9F2] dark:bg-[#1A202C] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl text-[#1F2937] dark:text-[#F9FAFB] focus:outline-none focus:border-[#E05D38]"
                            />
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              loading={isAttachingUrl}
                              onClick={() => handleGoogleDocsSubmit(qId, gdocsUrl)}
                            >
                              Attach
                            </Button>
                          </div>
                          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                            Provide a valid HTTPS link to your shared Google Doc. Make sure link sharing allows viewer access.
                          </p>
                        </div>
                      )}

                      {isReplacing && (
                        <div className="text-right">
                          <button
                            type="button"
                            onClick={() => setReplacingQuestionId((prev) => ({ ...prev, [qId]: false }))}
                            className="text-xs text-[#64748B] hover:text-[#1F2937] underline cursor-pointer"
                          >
                            Cancel replacement and keep existing submission
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Navigation Controls */}
              <div className="flex items-center justify-between pt-4 border-t border-surface-light-border dark:border-surface-dark-border">
                <Button
                  variant="outline"
                  size="sm"
                  icon={ChevronLeft}
                  onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
                  disabled={currentIdx === 0}
                >
                  Previous Question
                </Button>

                {isLastQuestion ? (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Send}
                    iconPosition="right"
                    onClick={() => setIsSubmitModalOpen(true)}
                  >
                    Review & Submit
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={ChevronRight}
                    iconPosition="right"
                    onClick={() => setCurrentIdx((prev) => Math.min(totalQuestions - 1, prev + 1))}
                  >
                    Next Question
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            <EmptyState
              title="No Questions Configured"
              description="This assessment does not contain questions."
            />
          )}
        </div>

        {/* Right 4 Cols: Question Navigation Palette */}
        <div className="lg:col-span-4 space-y-4">
          <Card
            title="Question Palette"
            subtitle={`${answeredCount} of ${totalQuestions} answered`}
          >
            <div className="grid grid-cols-5 gap-2.5">
              {questions.map((q, idx) => {
                const ans = answers[q._id];
                const isAnswered =
                  ans !== undefined &&
                  ans !== null &&
                  (typeof ans === 'object'
                    ? Boolean(ans.fileKey || ans.googleDocsUrl)
                    : String(ans).trim() !== '');
                const isCurrent = currentIdx === idx;

                return (
                  <button
                    key={q._id}
                    type="button"
                    onClick={() => setCurrentIdx(idx)}
                    className={`h-10 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                      isCurrent
                        ? 'ring-2 ring-[#E05D38] border-[#E05D38] bg-[#E05D38] text-white shadow-warm-xs'
                        : isAnswered
                        ? 'bg-[#EAF4F1] text-[#3D8A78] dark:bg-[#132A24] dark:text-[#67B5A3] border border-[#3D8A78]/30 font-bold'
                        : 'bg-[#FFF9F2] dark:bg-[#1A202C] border border-[#EBE3D8] dark:border-[#2D3748] text-[#64748B] dark:text-[#94A3B8] hover:border-[#F4A261]'
                    }`}
                  >
                    Q{idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 pt-4 border-t border-[#EBE3D8] dark:border-[#2D3748] space-y-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-md bg-[#3D8A78] flex-shrink-0" />
                <span>Answered</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-md bg-[#E05D38] flex-shrink-0" />
                <span>Active Question</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-md bg-[#EBE3D8] dark:bg-[#2D3748] flex-shrink-0" />
                <span>Unanswered</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Confirmation Modal Before Submission */}
      <Modal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        title="Finalize Assessment Submission"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSubmitModalOpen(false)}
              disabled={isSubmitting}
            >
              Back to Exam
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleFinalSubmit(false)}
              isLoading={isSubmitting}
              icon={Send}
            >
              Confirm Submission
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-[#1F2937] dark:text-[#E2E8F0]">
            You are about to finalize your attempt for{' '}
            <strong className="text-[#1F2937] dark:text-[#F9FAFB] font-bold">{assessment?.title}</strong>.
          </p>

          <div className="p-4 rounded-xl bg-[#FFF9F2] dark:bg-[#1A202C] border border-[#EBE3D8] dark:border-[#2D3748] text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-[#64748B] dark:text-[#94A3B8]">Total Questions:</span>
              <span className="font-semibold text-[#1F2937] dark:text-[#F9FAFB]">{totalQuestions}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B] dark:text-[#94A3B8]">Questions Answered:</span>
              <span className="font-semibold text-[#3D8A78] dark:text-[#67B5A3]">{answeredCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B] dark:text-[#94A3B8]">Remaining Unanswered:</span>
              <span className={`font-semibold ${totalQuestions - answeredCount > 0 ? 'text-[#E05D38]' : 'text-[#64748B]'}`}>
                {totalQuestions - answeredCount}
              </span>
            </div>
          </div>

          {totalQuestions - answeredCount > 0 && (
            <div className="p-3 rounded-xl bg-[#FFF4ED] dark:bg-[#341C16] border border-[#F4A261]/40 flex items-start space-x-2.5 text-xs text-[#E05D38] dark:text-[#F4A261]">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#E05D38]" />
              <span>
                You have <strong>{totalQuestions - answeredCount}</strong> unanswered question(s). Unanswered questions will receive 0 points.
              </span>
            </div>
          )}

          <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
            Once submitted, your attempt will be closed and you will not be able to revise your answers.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default Attempt;
