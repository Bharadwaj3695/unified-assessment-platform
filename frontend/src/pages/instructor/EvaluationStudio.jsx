import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import instructorService from '../../services/instructor.service';
import sanitizeHtml from '../../utils/sanitize';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import Alert from '../../components/ui/Alert';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  BookOpen,
  Award,
  Send,
  Save,
  HelpCircle,
  FileText,
  AlignLeft,
  ListChecks,
  Check,
  X,
  Sparkles,
} from 'lucide-react';

const EvaluationStudio = () => {
  const { id: submissionId } = useParams();
  const navigate = useNavigate();

  const [submission, setSubmission] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // Form State
  const [questionFeedback, setQuestionFeedback] = useState({});
  const [generalFeedback, setGeneralFeedback] = useState('');
  const [confirmModal, setConfirmModal] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchSubmission = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await instructorService.getSubmissionForEvaluation(submissionId);
        if (!mounted) return;

        setSubmission(data);
        setGeneralFeedback(data.feedback || data.evaluation?.generalFeedback || '');

        // Prepopulate feedback from existing evaluation if present
        const initialFeedback = {};
        const existingFb = data.evaluation?.questionFeedback || {};

        if (data.assessment?.questions) {
          data.assessment.questions.forEach((q) => {
            const qId = (q._id || q.id).toString();
            const prev = existingFb[qId];
            if (prev) {
              initialFeedback[qId] = {
                pointsAwarded: prev.pointsAwarded !== undefined ? prev.pointsAwarded : '',
                comment: prev.comment || '',
              };
            } else if (q.type === 'short_answer' || q.type === 'long_answer') {
              initialFeedback[qId] = {
                pointsAwarded: '',
                comment: '',
              };
            }
          });
        }

        setQuestionFeedback(initialFeedback);
      } catch (err) {
        if (mounted) {
          setError(err.message || 'Failed to load submission for evaluation.');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchSubmission();
    return () => {
      mounted = false;
    };
  }, [submissionId]);

  const questions = submission?.assessment?.questions || [];
  const subjectiveQuestions = useMemo(() => {
    return questions.filter((q) => q.type === 'short_answer' || q.type === 'long_answer');
  }, [questions]);

  // Track progress of subjective evaluations
  const subjectiveGradedCount = useMemo(() => {
    return subjectiveQuestions.filter((q) => {
      const qId = (q._id || q.id).toString();
      const fb = questionFeedback[qId];
      return fb && fb.pointsAwarded !== '' && !isNaN(Number(fb.pointsAwarded));
    }).length;
  }, [subjectiveQuestions, questionFeedback]);

  // Live Score Calculations
  const calculatedManualScore = useMemo(() => {
    return subjectiveQuestions.reduce((sum, q) => {
      const qId = (q._id || q.id).toString();
      const fb = questionFeedback[qId];
      const pts = fb ? Number(fb.pointsAwarded) : 0;
      return sum + (isNaN(pts) || pts < 0 ? 0 : pts);
    }, 0);
  }, [subjectiveQuestions, questionFeedback]);

  const autoScore = submission?.autoScore || 0;
  const totalPoints = submission?.totalPoints || submission?.assessment?.totalPoints || 100;
  const liveFinalScore = autoScore + calculatedManualScore;
  const livePercentage =
    totalPoints > 0 ? Math.round((liveFinalScore / totalPoints) * 100 * 100) / 100 : 0;
  const passingScore = submission?.assessment?.passingScore || 60;
  const isPassing = livePercentage >= passingScore;

  const handleFeedbackChange = (qId, field, value) => {
    setQuestionFeedback((prev) => ({
      ...prev,
      [qId]: {
        ...prev[qId],
        [field]: value,
      },
    }));
  };

  const handleSaveEvaluation = async (isFinal) => {
    // Validation
    const feedbackPayload = {};
    for (const q of subjectiveQuestions) {
      const qId = (q._id || q.id).toString();
      const fb = questionFeedback[qId];

      if (isFinal) {
        if (!fb || fb.pointsAwarded === '' || fb.pointsAwarded === undefined) {
          toast.error(`Please assign awarded points for "${q.questionText.slice(0, 30)}..."`);
          return;
        }
      }

      if (fb && fb.pointsAwarded !== '' && fb.pointsAwarded !== undefined) {
        const pts = Number(fb.pointsAwarded);
        if (isNaN(pts) || pts < 0) {
          toast.error(`Awarded points must be a valid non-negative number for question "${q.questionText.slice(0, 30)}..."`);
          return;
        }
        if (pts > q.points) {
          toast.error(`Awarded points (${pts}) cannot exceed max question points (${q.points}).`);
          return;
        }
        feedbackPayload[qId] = {
          pointsAwarded: pts,
          comment: fb.comment || '',
        };
      }
    }

    try {
      setIsSaving(true);
      await instructorService.submitEvaluation(submissionId, {
        questionFeedback: feedbackPayload,
        generalFeedback: generalFeedback.trim(),
      });

      toast.success(
        isFinal
          ? 'Evaluation completed and final grade published!'
          : 'Evaluation progress saved successfully.'
      );
      navigate('/instructor/submissions');
    } catch (err) {
      toast.error(err.message || 'Failed to submit evaluation.');
    } finally {
      setIsSaving(false);
      setConfirmModal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center">
        <Spinner size="lg" />
        <p className="mt-4 text-sm text-slate-500 font-medium">
          Loading submission evaluation studio...
        </p>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="max-w-2xl mx-auto py-12 space-y-4">
        <Alert variant="error" title="Evaluation Access Error">
          {error || 'Submission could not be retrieved.'}
        </Alert>
        <Link to="/instructor/submissions">
          <Button variant="outline" icon={ArrowLeft}>
            Back to Submissions Queue
          </Button>
        </Link>
      </div>
    );
  }

  const studentAnswers = submission.answers ? (submission.answers instanceof Map ? Object.fromEntries(submission.answers) : submission.answers) : {};

  return (
    <div className="space-y-6 pb-12">
      {/* Top Navigation & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-surface-light-border dark:border-surface-dark-border pb-5">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Link
              to="/instructor/submissions"
              className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Evaluation Queue
            </Link>
            <span className="text-slate-300 dark:text-slate-600">/</span>
            <Badge
              variant={submission.evaluationStatus === 'completed' ? 'success' : 'warning'}
              size="sm"
            >
              {submission.evaluationStatus === 'completed' ? 'Evaluated' : 'Pending Review'}
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Evaluation Studio: {submission.assessment?.title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Review student written responses, assign points, and formulate feedback.
          </p>
        </div>

        <div className="flex items-center space-x-2.5 self-start sm:self-auto">
          <Button
            type="button"
            variant="outline"
            size="md"
            icon={Save}
            loading={isSaving}
            onClick={() => handleSaveEvaluation(false)}
          >
            Save Draft
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            icon={Send}
            loading={isSaving}
            onClick={() => setConfirmModal(true)}
          >
            Finalize Evaluation
          </Button>
        </div>
      </div>

      {/* Grid Layout: 2 Columns on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Questions & Student Answers (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          {questions.map((q, idx) => {
            const qId = (q._id || q.id).toString();
            const studentAnswer = studentAnswers[qId];
            const isSubjective = q.type === 'short_answer' || q.type === 'long_answer';
            const fb = questionFeedback[qId] || { pointsAwarded: '', comment: '' };

            return (
              <div
                key={qId}
                className="p-5 sm:p-6 rounded-2xl border border-[#EBE3D8] dark:border-[#2D3748] bg-white dark:bg-[#1A202C] shadow-warm-xs space-y-4"
              >
                {/* Question Header */}
                <div className="flex items-center justify-between border-b border-[#EBE3D8] dark:border-[#2D3748] pb-3">
                  <div className="flex items-center space-x-2.5">
                    <span className="w-6 h-6 rounded-full bg-[#FFF9F2] dark:bg-[#12161F] text-[#E05D38] font-bold text-xs flex items-center justify-center border border-[#EBE3D8] dark:border-[#2D3748]">
                      {idx + 1}
                    </span>
                    <Badge
                      variant={
                        q.type === 'mcq'
                          ? 'terracotta'
                          : q.type === 'short_answer'
                          ? 'peach'
                          : 'sage'
                      }
                      size="sm"
                    >
                      {q.type === 'mcq'
                        ? 'Objective MCQ'
                        : q.type === 'short_answer'
                        ? 'Short Answer'
                        : 'Long Essay'}
                    </Badge>
                  </div>
                  <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
                    Max: <strong>{q.points} Points</strong>
                  </span>
                </div>

                {/* Question Prompt */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] mb-1">
                    Problem Prompt
                  </h4>
                  <p className="text-sm font-medium text-[#1F2937] dark:text-[#F9FAFB]">
                    {q.questionText}
                  </p>
                </div>

                {/* Rubric / Explanation Note (Confidential Evaluator Notes) */}
                {q.explanation && (
                  <div className="p-3 bg-[#FFF4ED] dark:bg-[#341C16] border border-[#F4A261]/40 rounded-xl text-xs space-y-1">
                    <div className="font-semibold text-[#E05D38] dark:text-[#F4A261] flex items-center">
                      <HelpCircle className="w-3.5 h-3.5 mr-1" />
                      Grading Criteria & Rubric Reference
                    </div>
                    <p className="text-[#1F2937] dark:text-[#F9FAFB]">{q.explanation}</p>
                  </div>
                )}

                {/* Student's Answer Presentation */}
                <div className="p-4 rounded-xl bg-[#FFF9F2] dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                    Student Submission
                  </div>

                  {studentAnswer === undefined || studentAnswer === null || studentAnswer === '' ? (
                    <p className="text-xs italic text-[#64748B]">
                      (No response provided by student)
                    </p>
                  ) : q.type === 'mcq' ? (
                    <div className="space-y-1.5 text-xs">
                      {q.options?.map((opt) => {
                        const isStudentChoice = String(opt.id) === String(studentAnswer);
                        const isCorrectAnswer = String(opt.id) === String(q.correctAnswer);

                        return (
                          <div
                            key={opt.id}
                            className={`p-2 rounded-xl flex items-center justify-between ${
                              isStudentChoice && isCorrectAnswer
                                ? 'bg-emerald-100/80 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 font-semibold border border-emerald-300'
                                : isStudentChoice && !isCorrectAnswer
                                ? 'bg-red-100/80 text-red-800 dark:bg-red-950/50 dark:text-red-300 font-semibold border border-red-300'
                                : isCorrectAnswer
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30'
                                : 'text-[#64748B] dark:text-[#94A3B8]'
                            }`}
                          >
                            <span>{opt.text}</span>
                            {isStudentChoice && (
                              <Badge
                                variant={isCorrectAnswer ? 'sage' : 'danger'}
                                size="sm"
                              >
                                {isCorrectAnswer ? 'Student Selected (Correct)' : 'Student Selected (Incorrect)'}
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : q.type === 'short_answer' ? (
                    <p className="text-xs text-[#1F2937] dark:text-[#F9FAFB] whitespace-pre-wrap">
                      {String(studentAnswer)}
                    </p>
                  ) : (
                    /* Long Answer: Render safely through HTML Sanitizer */
                    <div
                      className="text-xs text-[#1F2937] dark:text-[#F9FAFB] prose dark:prose-invert max-w-none break-words"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(String(studentAnswer)),
                      }}
                    />
                  )}
                </div>

                {/* Scoring & Feedback Input Area */}
                {isSubjective ? (
                  <div className="p-4 rounded-xl border border-[#F4A261]/40 bg-[#FFF4ED]/60 dark:bg-[#341C16]/30 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <label className="text-xs font-bold text-[#1F2937] dark:text-[#F9FAFB] flex items-center">
                        <Award className="w-3.5 h-3.5 mr-1.5 text-[#E05D38]" />
                        Award Score (0 to {q.points} Points) *
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="0"
                          max={q.points}
                          step="0.5"
                          value={fb.pointsAwarded}
                          onChange={(e) =>
                            handleFeedbackChange(qId, 'pointsAwarded', e.target.value)
                          }
                          placeholder={`0 - ${q.points}`}
                          className="w-24 px-3 py-1.5 text-xs text-center font-bold bg-white dark:bg-[#12161F] border border-[#E05D38]/50 rounded-xl focus:outline-none focus:border-[#E05D38] focus:ring-2 focus:ring-[#E05D38]/20 text-[#1F2937] dark:text-[#F9FAFB]"
                        />
                        <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
                          / {q.points} pts
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1">
                        Question-Specific Feedback & Guidance for Student
                      </label>
                      <input
                        type="text"
                        value={fb.comment}
                        onChange={(e) => handleFeedbackChange(qId, 'comment', e.target.value)}
                        placeholder="Provide constructive feedback explaining score deductions or praise..."
                        className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl focus:outline-none focus:border-[#E05D38] focus:ring-2 focus:ring-[#E05D38]/20 text-[#1F2937] dark:text-[#F9FAFB]"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs px-3 py-2 bg-[#FFF9F2] dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl text-[#64748B]">
                    <span>Objective Auto-Graded Question</span>
                    <span className="font-semibold text-[#1F2937] dark:text-[#F9FAFB]">
                      Score: {String(studentAnswer) === String(q.correctAnswer) ? q.points : 0} / {q.points} pts
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right: Student Summary, Evaluation Status & General Feedback (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Student Profile Card */}
          <Card title="Student Information">
            <div className="space-y-3 text-xs">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FDECE2] dark:bg-[#341C16] text-[#E05D38] dark:text-[#F4A261] font-bold text-sm flex items-center justify-center border border-[#F4A261]/30">
                  {submission.student?.name?.charAt(0) || 'S'}
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#1F2937] dark:text-[#F9FAFB]">
                    {submission.student?.name || 'Student Candidate'}
                  </div>
                  <div className="text-[#64748B] dark:text-[#94A3B8]">{submission.student?.email}</div>
                </div>
              </div>

              <div className="pt-2 border-t border-[#EBE3D8] dark:border-[#2D3748] space-y-1.5 text-[#1F2937] dark:text-[#E2E8F0]">
                <div className="flex justify-between">
                  <span className="text-[#64748B] dark:text-[#94A3B8]">Submitted At:</span>
                  <span className="font-medium">
                    {submission.submittedAt
                      ? new Date(submission.submittedAt).toLocaleString()
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B] dark:text-[#94A3B8]">Submission Reason:</span>
                  <span className="font-medium">{submission.submittedReason || 'USER_SUBMITTED'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B] dark:text-[#94A3B8]">Time Spent:</span>
                  <span className="font-medium">
                    {Math.round((submission.timeSpentSeconds || 0) / 60)} minutes
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Live Score Tally Card */}
          <Card title="Grading Summary & Live Calculation">
            <div className="space-y-4">
              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-[#64748B] dark:text-[#94A3B8]">Subjective Items Evaluated</span>
                  <span className="text-[#E05D38] dark:text-[#F4A261] font-bold">
                    {subjectiveGradedCount} of {subjectiveQuestions.length} Complete
                  </span>
                </div>
                <div className="w-full bg-[#FFF9F2] dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-[#E05D38] h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        subjectiveQuestions.length > 0
                          ? (subjectiveGradedCount / subjectiveQuestions.length) * 100
                          : 100
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Score breakdown table */}
              <div className="p-3.5 bg-[#FFF9F2] dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#64748B] dark:text-[#94A3B8]">Objective (Auto-Score):</span>
                  <span className="font-bold text-[#1F2937] dark:text-[#F9FAFB]">
                    {autoScore} pts
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B] dark:text-[#94A3B8]">Subjective (Manual Score):</span>
                  <span className="font-bold text-[#1F2937] dark:text-[#F9FAFB]">
                    {calculatedManualScore} pts
                  </span>
                </div>
                <div className="pt-2 border-t border-[#EBE3D8] dark:border-[#2D3748] flex justify-between text-sm">
                  <span className="font-bold text-[#1F2937] dark:text-[#F9FAFB]">
                    Calculated Final Score:
                  </span>
                  <span className="font-extrabold text-[#E05D38] dark:text-[#F4A261]">
                    {liveFinalScore} / {totalPoints} pts
                  </span>
                </div>
                <div className="flex justify-between text-xs pt-1">
                  <span className="text-[#64748B] dark:text-[#94A3B8]">Final Percentage:</span>
                  <span className="font-bold text-[#1F2937] dark:text-[#F9FAFB]">
                    {livePercentage}%
                  </span>
                </div>
                <div className="flex justify-between text-xs pt-1">
                  <span className="text-[#64748B] dark:text-[#94A3B8]">Result Status (Pass: {passingScore}%):</span>
                  <Badge variant={isPassing ? 'sage' : 'danger'} size="sm">
                    {isPassing ? 'PASS' : 'FAIL'}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>

          {/* General Feedback Textarea */}
          <Card title="Overall Evaluator Feedback" subtitle="Transmitted to student upon publication">
            <textarea
              rows="4"
              value={generalFeedback}
              onChange={(e) => setGeneralFeedback(e.target.value)}
              placeholder="Provide a comprehensive summary of student performance, highlighting key strengths and areas of improvement..."
              className="w-full px-3.5 py-2.5 text-xs bg-white dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl focus:outline-none focus:border-[#E05D38] focus:ring-2 focus:ring-[#E05D38]/20 transition-all text-[#1F2937] dark:text-[#F9FAFB]"
            />
          </Card>
        </div>
      </div>

      {/* Confirmation Modal for Finalizing Evaluation */}
      <Modal
        isOpen={confirmModal}
        onClose={() => setConfirmModal(false)}
        title="Finalize & Publish Grade"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            You are about to publish the final evaluation for{' '}
            <strong>{submission.student?.name}</strong>.
          </p>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-dark-muted text-xs space-y-1.5 text-slate-700 dark:text-slate-300">
            <div className="flex justify-between">
              <span>Final Score:</span>
              <strong>{liveFinalScore} / {totalPoints} Points</strong>
            </div>
            <div className="flex justify-between">
              <span>Final Percentage:</span>
              <strong>{livePercentage}%</strong>
            </div>
            <div className="flex justify-between">
              <span>Outcome:</span>
              <strong className={isPassing ? 'text-emerald-600' : 'text-red-600'}>
                {isPassing ? 'PASSED' : 'FAILED'}
              </strong>
            </div>
          </div>
          <div className="flex items-center justify-end space-x-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={isSaving}
              onClick={() => handleSaveEvaluation(true)}
            >
              Publish Grade
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default EvaluationStudio;
