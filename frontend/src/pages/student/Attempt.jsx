import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { toast } from 'react-toastify';
import assessmentService from '../../services/assessment.service';
import submissionService from '../../services/submission.service';
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
} from 'lucide-react';

const Attempt = () => {
  const { id: assessmentId } = useParams();
  const navigate = useNavigate();

  const [assessment, setAssessment] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});

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
      setSubmission(submissionData);

      // 3. Initialize answers
      const existingAnswers = submissionData.answers || {};
      setAnswers(existingAnswers);

      // 4. Initialize server-authoritative timer countdown
      if (submissionData.deadlineAt) {
        const deadlineMs = new Date(submissionData.deadlineAt).getTime();
        const remainingSec = Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000));
        setTimeLeft(remainingSec);
      }
    } catch (err) {
      setLoadError(err.message || 'Unable to start assessment attempt.');
    } finally {
      setIsLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    initializeAttempt();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [initializeAttempt]);

  // Handle countdown timer
  useEffect(() => {
    if (timeLeft === null) return;

    if (timeLeft <= 0) {
      toast.warning('Allotted assessment time has expired! Finalizing attempt...');
      handleFinalSubmit();
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleFinalSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [timeLeft]);

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
    setAnswers((prev) => ({
      ...prev,
      [qId]: value,
    }));

    // Debounce autosave
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setSaveStatus('saving');
    debounceTimerRef.current = setTimeout(() => {
      triggerAutosave(qId, value);
    }, 800);
  };

  // Final submit handler
  const handleFinalSubmit = async () => {
    if (!submission?._id) return;
    setIsSubmitting(true);
    try {
      await submissionService.submitAssessment(submission._id, answers);
      toast.success('Assessment submitted successfully!');
      navigate('/student/dashboard', { replace: true });
    } catch (err) {
      toast.error(err.message || 'Submission failed. Please check your connection.');
      setIsSubmitting(false);
      setIsSubmitModalOpen(false);
    }
  };

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

  const currentQuestion = questions[currentIdx];
  const totalQuestions = questions.length;
  const answeredCount = Object.values(answers).filter(
    (a) => a !== undefined && a !== null && String(a).trim() !== ''
  ).length;
  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const isLastQuestion = currentIdx === totalQuestions - 1;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Sticky Top Bar: Exam Title, Progress & Server Timer */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#1A202C]/95 backdrop-blur-md border border-[#EBE3D8] dark:border-[#2D3748] py-3 px-4 sm:px-6 rounded-2xl shadow-warm-xs transition-all">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Badge variant="terracotta" size="sm">
                {assessment?.category || 'Assessment'}
              </Badge>
              <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                Passing: {assessment?.passingScore}%
              </span>
            </div>
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
                    <label className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">
                      Your Concise Response:
                    </label>
                    <textarea
                      rows={4}
                      value={answers[currentQuestion._id] || ''}
                      onChange={(e) => handleAnswerChange(currentQuestion._id, e.target.value)}
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
                    <label className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider flex items-center space-x-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#E05D38]" />
                      <span>Rich Text Essay Response (React Quill Editor):</span>
                    </label>
                    <div className="bg-white dark:bg-[#12161F] rounded-xl border border-[#EBE3D8] dark:border-[#2D3748] overflow-hidden focus-within:border-[#E05D38] focus-within:ring-2 focus-within:ring-[#E05D38]/20 transition-all">
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
                const isAnswered =
                  answers[q._id] !== undefined &&
                  answers[q._id] !== null &&
                  String(answers[q._id]).trim() !== '';
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
              onClick={handleFinalSubmit}
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
