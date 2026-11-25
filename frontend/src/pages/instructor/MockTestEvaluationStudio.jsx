import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock,
  FileText,
  Download,
  AlertCircle,
  Save,
  Send,
  User,
  ExternalLink,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { toast } from 'react-toastify';
import uapQuestionBankService from '../../services/uapQuestionBank.service';
import analyticsService from '../../services/analytics.service';

export default function MockTestEvaluationStudio() {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Form State: { [qId]: { marksAwarded, comment, rubricScores: [{ criterion, score, maxMarks, comment }] } }
  const [gradingData, setGradingData] = useState({});
  const [generalFeedback, setGeneralFeedback] = useState('');

  useEffect(() => {
    async function loadAttempt() {
      try {
        setLoading(true);
        setUnauthorized(false);
        setErrorMessage(null);

        const res = await uapQuestionBankService.getMockTestAttemptForReview(attemptId);
        const data = res.data;
        setReviewData(data);
        setGeneralFeedback(data.generalFeedback || '');

        // Initialize grading data for each response
        const initialGrading = {};
        (data.responses || []).forEach((resp) => {
          const qId = resp.questionId.toString();
          const existingRubric = resp.rubricScores?.length > 0 ? resp.rubricScores : resp.rubric || [];
          initialGrading[qId] = {
            marksAwarded: resp.scoreAwarded !== undefined && resp.scoreAwarded !== null ? resp.scoreAwarded : 0,
            comment: resp.evaluatorComment || resp.feedback || '',
            rubricScores: existingRubric.map((r) => ({
              criterion: r.criterion || r.criteria || '',
              score: r.score || 0,
              maxMarks: r.maxMarks || 0,
              comment: r.comment || '',
            })),
          };
        });
        setGradingData(initialGrading);
      } catch (err) {
        if (err.response?.status === 403) {
          setUnauthorized(true);
        } else {
          setErrorMessage(err.response?.data?.message || err.message || 'Failed to load attempt for review.');
        }
      } finally {
        setLoading(false);
      }
    }

    if (attemptId) {
      loadAttempt();
    }
  }, [attemptId]);

  const handleMarksChange = (qId, val, maxMarks) => {
    const num = val === '' ? '' : Number(val);
    if (num !== '' && num > maxMarks) {
      toast.warning(`Awarded marks cannot exceed maximum marks of ${maxMarks}.`);
    }

    setGradingData((prev) => ({
      ...prev,
      [qId]: {
        ...prev[qId],
        marksAwarded: num,
      },
    }));
  };

  const handleCommentChange = (qId, val) => {
    setGradingData((prev) => ({
      ...prev,
      [qId]: {
        ...prev[qId],
        comment: val,
      },
    }));
  };

  const handleRubricScoreChange = (qId, rubIdx, val, maxRubricMarks) => {
    const num = val === '' ? 0 : Number(val);
    setGradingData((prev) => {
      const current = prev[qId] || {};
      const updatedRubric = [...(current.rubricScores || [])];
      if (updatedRubric[rubIdx]) {
        updatedRubric[rubIdx] = {
          ...updatedRubric[rubIdx],
          score: Math.min(maxRubricMarks, Math.max(0, num)),
        };
      }

      // Auto calculate total marks awarded from rubrics if criteria exist
      const rubricTotal = updatedRubric.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0);

      return {
        ...prev,
        [qId]: {
          ...current,
          rubricScores: updatedRubric,
          marksAwarded: rubricTotal,
        },
      };
    });
  };

  const handleSubmitEvaluation = async () => {
    if (!reviewData) return;

    // Validate that all pending manual review questions have valid scores
    const pendingResponses = (reviewData.responses || []).filter(
      (r) => r.evaluationStatus === 'PENDING_MANUAL_REVIEW'
    );

    for (let i = 0; i < pendingResponses.length; i++) {
      const resp = pendingResponses[i];
      const qId = resp.questionId.toString();
      const gradeItem = gradingData[qId];

      if (!gradeItem || gradeItem.marksAwarded === '' || isNaN(Number(gradeItem.marksAwarded))) {
        toast.error(`Please enter marks awarded for Question ${i + 1}.`);
        return;
      }

      const awarded = Number(gradeItem.marksAwarded);
      if (awarded < 0) {
        toast.error(`Marks for Question ${i + 1} cannot be negative.`);
        return;
      }
      if (awarded > resp.maxMarks) {
        toast.error(`Marks for Question ${i + 1} (${awarded}) exceed maximum allowed marks (${resp.maxMarks}).`);
        return;
      }
    }

    try {
      setSubmitting(true);
      const responsesFeedback = pendingResponses.map((resp) => {
        const qId = resp.questionId.toString();
        const item = gradingData[qId] || {};
        return {
          questionId: qId,
          marksAwarded: Number(item.marksAwarded),
          comment: item.comment || '',
          rubricScores: item.rubricScores || [],
        };
      });

      const res = await uapQuestionBankService.evaluateMockTestAttempt(attemptId, {
        responsesFeedback,
        generalFeedback,
      });

      toast.success('Mock test attempt evaluated and finalized successfully!');
      // Update local state to finalized
      setReviewData((prev) => ({
        ...prev,
        status: 'EVALUATED',
        evaluationStatus: 'COMPLETED',
        manualScore: res.data.manualScore,
        earnedMarks: res.data.score,
        percentage: res.data.percentage,
        gradedAt: res.data.gradedAt,
      }));
    } catch (err) {
      toast.error('Evaluation submission failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        <p className="text-sm">Loading mock test submission and rubrics...</p>
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-900 shadow-sm text-center space-y-4">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-950/50 rounded-full flex items-center justify-center mx-auto text-red-600">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Access Denied</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          You are not authorized to evaluate this mock test attempt. Only the test author or an administrator may
          review and grade submissions.
        </p>
        <div className="pt-4">
          <button
            onClick={() => navigate('/instructor/question-bank')}
            className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
          >
            Return to Mock Bank
          </button>
        </div>
      </div>
    );
  }

  if (errorMessage || !reviewData) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Unable to Load Submission</h3>
        <p className="text-sm text-slate-500">{errorMessage || 'Attempt not found'}</p>
        <button
          onClick={() => navigate('/instructor/question-bank')}
          className="px-4 py-2 rounded-lg bg-brand-primary text-white hover:bg-brand-primary-hover shadow-warm-xs text-xs font-semibold transition"
        >
          Back to Mock Bank
        </button>
      </div>
    );
  }

  const isFinalized = reviewData.status === 'EVALUATED' && reviewData.evaluationStatus === 'COMPLETED';

  return (
    <div className="space-y-6 pb-24 max-w-6xl mx-auto">
      {/* Header Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex items-center gap-2">
          {isFinalized && (
            <>
              <button
                type="button"
                onClick={() => navigate(`/instructor/reports/mock_test/${attemptId}`)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                View Report
              </button>
              <button
                type="button"
                onClick={() =>
                  analyticsService
                    .downloadIndividualExamReportPdf('mock_test', attemptId)
                    .then(() => toast.success('Performance report PDF downloaded.'))
                    .catch((err) => toast.error(err.message || 'Failed to download PDF'))
                }
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Download PDF
              </button>
            </>
          )}
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              isFinalized
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
            }`}
          >
            {isFinalized ? 'Grading Finalized' : 'Awaiting Faculty Grading'}
          </span>
        </div>
      </div>

      {/* Summary Banner Card */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div>
            <span className="text-xs font-bold text-brand-primary dark:text-brand-peach uppercase tracking-wider">
              {reviewData.examination} Mock Test Evaluation
            </span>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-1">{reviewData.mockTestTitle}</h1>
          </div>

          {/* Student Profile Info */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
            <div className="w-10 h-10 rounded-full bg-brand-primary/10 dark:bg-brand-primary/20 text-brand-primary dark:text-brand-peach flex items-center justify-center font-bold text-sm">
              <User className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{reviewData.student?.name || 'Student'}</p>
              <p className="text-xs text-slate-400">{reviewData.student?.email}</p>
            </div>
          </div>
        </div>

        {/* Score & Telemetry Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-400 uppercase font-bold">Auto Score</span>
            <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{reviewData.autoScore} Marks</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-400 uppercase font-bold">Manual Score</span>
            <p className="text-xl font-black text-brand-primary dark:text-brand-peach mt-1">{reviewData.manualScore} Marks</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-400 uppercase font-bold">Total Earned</span>
            <p className="text-xl font-black text-emerald-600 mt-1">
              {reviewData.earnedMarks} / {reviewData.totalMarks}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-400 uppercase font-bold">Percentage</span>
            <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{reviewData.percentage}%</p>
          </div>
        </div>
      </div>

      {/* Responses Review & Grading List */}
      <div className="space-y-6">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Award className="w-5 h-5 text-brand-primary dark:text-brand-peach" />
          Question Submissions & Rubric Scoring
        </h2>

        {(reviewData.responses || []).map((resp, idx) => {
          const qId = resp.questionId.toString();
          const qGrade = gradingData[qId] || {};
          const isPending = resp.evaluationStatus === 'PENDING_MANUAL_REVIEW';
          const isManual = isPending || resp.evaluationStatus === 'MANUALLY_EVALUATED';

          return (
            <div
              key={qId}
              className={`p-6 rounded-2xl border transition bg-white dark:bg-slate-900 shadow-sm space-y-5 ${
                isPending
                  ? 'border-brand-primary/40 dark:border-brand-primary/40 ring-1 ring-brand-primary/20'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              {/* Question Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-300">
                    Q{idx + 1}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {resp.questionType}
                  </span>
                  <span className="text-xs font-semibold text-brand-primary dark:text-brand-peach">Max: {resp.maxMarks} Marks</span>
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                    resp.evaluationStatus === 'AUTOMATIC'
                      ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      : resp.evaluationStatus === 'MANUALLY_EVALUATED'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  }`}
                >
                  {resp.evaluationStatus.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Statement */}
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                {resp.questionStatement}
              </p>

              {/* Student Answer Presentation */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Candidate Response:</span>

                {/* 1. Descriptive Answer */}
                {resp.questionType === 'DESCRIPTIVE' && (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-sm leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                    {resp.textAnswer || <span className="italic text-slate-400">No response provided</span>}
                  </div>
                )}

                {/* 2. File Upload Response */}
                {resp.questionType === 'FILE_UPLOAD' && (
                  <div className="space-y-3">
                    {resp.fileAnswer ? (
                      <div className="p-4 rounded-xl border border-brand-primary/30 dark:border-brand-primary/30 bg-brand-primary/10 dark:bg-brand-primary/20 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-lg bg-brand-primary/10 dark:bg-brand-primary/20 text-brand-primary dark:text-brand-peach">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                              {resp.fileAnswer.originalFilename}
                            </h4>
                            <p className="text-xs text-slate-500">
                              {(resp.fileAnswer.size / 1024).toFixed(1)} KB • Uploaded:{' '}
                              {new Date(resp.fileAnswer.uploadedAt || Date.now()).toLocaleString()}
                            </p>
                          </div>
                        </div>

                        <a
                          href={`/api/tests/mock-tests/attempts/${attemptId}/questions/${resp.questionId}/file`}
                          target="_blank"
                          rel="noreferrer"
                          download={resp.fileAnswer.originalFilename}
                          className="px-3 py-1.5 rounded-lg bg-brand-primary text-white text-xs font-semibold hover:bg-brand-primary-hover shadow-warm-xs flex items-center gap-1.5 transition"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download Document
                        </a>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs text-slate-400 italic">
                        No file uploaded for this question
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Short Answer */}
                {resp.questionType === 'SHORT_ANSWER' && (
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-sm font-mono text-slate-900 dark:text-white">
                    {resp.textAnswer || <span className="italic text-slate-400">Empty</span>}
                  </div>
                )}

                {/* 4. Automated Types (MCQ / SQL / Code) */}
                {!['DESCRIPTIVE', 'FILE_UPLOAD', 'SHORT_ANSWER'].includes(resp.questionType) && (
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {resp.selectedOption
                          ? `Selected: ${resp.selectedOption}`
                          : resp.selectedOptions?.length > 0
                          ? `Selected: [${resp.selectedOptions.join(', ')}]`
                          : resp.code
                          ? 'Source code submitted'
                          : 'Unanswered'}
                      </span>
                      <p className="text-slate-500 mt-0.5">{resp.feedback}</p>
                    </div>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      Score: {resp.scoreAwarded} / {resp.maxMarks}
                    </span>
                  </div>
                )}
              </div>

              {/* Faculty Grading Controls for Subjective / Manual Questions */}
              {isManual && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                  {/* Rubric Matrix if configured */}
                  {qGrade.rubricScores?.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Scoring Rubric Breakdown:
                      </span>
                      <div className="space-y-2">
                        {qGrade.rubricScores.map((rub, rubIdx) => (
                          <div
                            key={rubIdx}
                            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                          >
                            <div className="flex-1">
                              <span className="font-bold text-slate-800 dark:text-slate-200">{rub.criterion}</span>
                              <span className="text-slate-400 ml-2">(Max: {rub.maxMarks} Marks)</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <label className="text-slate-500 font-semibold">Awarded:</label>
                              <input
                                type="number"
                                min="0"
                                max={rub.maxMarks}
                                step="0.5"
                                disabled={isFinalized}
                                value={rub.score ?? 0}
                                onChange={(e) =>
                                  handleRubricScoreChange(qId, rubIdx, e.target.value, rub.maxMarks)
                                }
                                className="w-20 p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-center font-bold text-sm outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-60"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Overall Question Marks & Commentary Input */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Total Marks Awarded (Max {resp.maxMarks}):
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={resp.maxMarks}
                        step="0.5"
                        disabled={isFinalized}
                        value={qGrade.marksAwarded ?? 0}
                        onChange={(e) => handleMarksChange(qId, e.target.value, resp.maxMarks)}
                        className="w-full mt-1.5 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-base text-brand-primary dark:text-brand-peach focus:ring-2 focus:ring-brand-primary outline-none disabled:opacity-60"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Evaluator Comments for Student:
                      </label>
                      <input
                        type="text"
                        disabled={isFinalized}
                        value={qGrade.comment || ''}
                        onChange={(e) => handleCommentChange(qId, e.target.value)}
                        placeholder="Feedback on reasoning, accuracy, or formatting..."
                        className="w-full mt-1.5 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-brand-primary outline-none disabled:opacity-60"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Holistic General Feedback & Finalization Bar */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <label className="text-sm font-bold text-slate-900 dark:text-white">General Candidate Feedback</label>
        <textarea
          rows={3}
          disabled={isFinalized}
          value={generalFeedback}
          onChange={(e) => setGeneralFeedback(e.target.value)}
          placeholder="Overall comments, strengths, and areas for improvement..."
          className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-brand-primary outline-none disabled:opacity-60 leading-relaxed"
        />

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-slate-400">
            {isFinalized
              ? `Graded by ${reviewData.evaluatorId || 'Faculty'} on ${new Date(
                  reviewData.gradedAt || Date.now()
                ).toLocaleDateString()}`
              : 'All pending subjective responses must be scored before finalization.'}
          </span>

          {!isFinalized && (
            <button
              onClick={handleSubmitEvaluation}
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-brand-primary hover:bg-brand-primary-hover text-white font-bold text-xs flex items-center gap-2 shadow-warm-xs transition disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Finalize & Submit Evaluation
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
