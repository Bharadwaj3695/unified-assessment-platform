import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Sparkles,
  Code2,
  Clock,
  Award,
  User,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../hooks/useAuth';
import analyticsService from '../../services/analytics.service';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import ErrorState from '../../components/ui/ErrorState';

export default function ExamPerformanceReport() {
  const { attemptType, attemptId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isPendingState, setIsPendingState] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const backPath =
    user?.role === 'instructor' || user?.role === 'admin'
      ? '/instructor/submissions'
      : '/student/progress';

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      setIsPendingState(false);
      const data = await analyticsService.getIndividualExamReport(attemptType, attemptId);
      setReport(data);
    } catch (err) {
      const status = err?.response?.status || err?.status;
      const msg = err?.response?.data?.message || err?.message || 'Unable to load exam performance report.';
      if (status === 409) {
        setIsPendingState(true);
      }
      setErrorMessage(msg);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [attemptType, attemptId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      await analyticsService.downloadIndividualExamReportPdf(attemptType, attemptId);
      toast.success('Performance report PDF downloaded.');
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to download PDF report.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
        Loading individual exam performance report...
      </div>
    );
  }

  if (isPendingState) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 py-6">
        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={ArrowLeft}
          onClick={() => navigate(backPath)}
        >
          Back
        </Button>
        <Card title="Individual Exam Performance Report">
          <div className="py-10 text-center space-y-3" data-testid="report-pending-notice">
            <Badge variant="warning" size="sm">Pending Evaluation</Badge>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Report available after evaluation
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              This exam submission has not been finalized yet. Once grading is complete, the full report and PDF download will become available automatically.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (errorMessage || !report) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 py-6">
        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={ArrowLeft}
          onClick={() => navigate(backPath)}
        >
          Back
        </Button>
        <ErrorState
          title="Unable to Open Exam Report"
          message={errorMessage || 'Exam report not found.'}
          onRetry={loadReport}
        />
      </div>
    );
  }

  const { meta, student, outcome, counts, questionBreakdown = [], topicBreakdown = [], feedback, aiPredictor } = report;
  const evaluatedDate = meta.evaluatedAt
    ? new Date(meta.evaluatedAt).toLocaleDateString()
    : meta.submittedAt
    ? new Date(meta.submittedAt).toLocaleDateString()
    : '—';

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-light-border dark:border-surface-dark-border pb-4">
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => navigate(backPath)}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral" size="sm">
              {meta.examTypeLabel}
            </Badge>
            {meta.examinationTag && (
              <Badge variant="terracotta" size="sm">
                {meta.examinationTag}
              </Badge>
            )}
            <Badge variant={outcome.passed ? 'success' : 'danger'} size="sm">
              {outcome.resultLabel}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100" data-testid="report-exam-name">
            {meta.examName}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Subject: <strong>{meta.subject}</strong> · Evaluated: <strong>{evaluatedDate}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            type="button"
            variant="primary"
            size="md"
            icon={Download}
            loading={downloadingPdf}
            onClick={handleDownloadPdf}
            data-testid="btn-download-report-pdf"
          >
            Download PDF
          </Button>
        </div>
      </div>

      {/* Candidate & Outcome Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Card className="lg:col-span-4" title="Candidate Details">
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[#FDECE2] dark:bg-[#341C16] text-[#E05D38] dark:text-[#F4A261] flex items-center justify-center font-bold">
                <User className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900 dark:text-slate-100">{student.name}</p>
                {student.studentId && (
                  <p className="font-mono text-[11px] text-[#E05D38] dark:text-[#F4A261] font-semibold">
                    ID: {student.studentId}
                  </p>
                )}
              </div>
            </div>
            {student.email && (
              <p className="text-slate-500 dark:text-slate-400">Email: {student.email}</p>
            )}
            {student.department && (
              <p className="text-slate-500 dark:text-slate-400">Department: {student.department}</p>
            )}
            <p className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Time Spent: {Math.max(1, Math.round((meta.timeSpentSeconds || 0) / 60))} min
            </p>
          </div>
        </Card>

        <Card className="lg:col-span-8" title="Exam Performance Summary">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border">
              <span className="text-[11px] text-slate-500 block">Score</span>
              <span className="text-lg font-extrabold text-slate-900 dark:text-slate-100" data-testid="report-score">
                {outcome.score} / {outcome.totalMarks}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border">
              <span className="text-[11px] text-slate-500 block">Percentage</span>
              <span className="text-lg font-extrabold text-[#E05D38] dark:text-[#F4A261]" data-testid="report-percentage">
                {outcome.percentage}%
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border">
              <span className="text-[11px] text-slate-500 block">Passing Threshold</span>
              <span className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                {outcome.passingThreshold}%
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border">
              <span className="text-[11px] text-slate-500 block">Result</span>
              <div className="mt-1 flex items-center gap-1.5">
                <Badge variant={outcome.passed ? 'success' : 'danger'} size="sm">
                  {outcome.resultLabel}
                </Badge>
                {outcome.grade && (
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    ({outcome.grade})
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-surface-light-border dark:border-surface-dark-border text-xs">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Correct: {counts.correct}</span>
            </div>
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold">
              <XCircle className="w-4 h-4" />
              <span>Incorrect: {counts.incorrect}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-semibold">
              <AlertCircle className="w-4 h-4" />
              <span>Unanswered: {counts.unanswered}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Faculty Feedback & Improvement Areas */}
      <Card title="Faculty Feedback & Grading Remarks">
        <div className="space-y-3 text-xs">
          {feedback?.evaluatorName && (
            <p className="text-slate-500 dark:text-slate-400">
              Evaluated by: <strong className="text-slate-800 dark:text-slate-200">{feedback.evaluatorName}</strong>
            </p>
          )}
          <div className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-slate-800 dark:text-slate-200 leading-relaxed">
            {feedback?.generalFeedback || 'No general faculty remarks were recorded.'}
          </div>
          {feedback?.outcomeFeedback && (
            <p className="text-slate-600 dark:text-slate-300">{feedback.outcomeFeedback}</p>
          )}
          {Array.isArray(feedback?.improvementAreas) && feedback.improvementAreas.length > 0 && (
            <div className="pt-2 space-y-1.5">
              <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block">
                Observed Improvement Areas
              </span>
              <ul className="space-y-1 list-disc list-inside text-slate-600 dark:text-slate-300">
                {feedback.improvementAreas.map((area, idx) => (
                  <li key={idx}>
                    {area.topic ? <strong>[{area.topic}] </strong> : null}
                    {area.note}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>

      {/* Topic-Wise Breakdown (only when real topic data exists) */}
      {topicBreakdown.length > 0 && (
        <Card title="Topic-Wise Performance">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {topicBreakdown.map((t, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-slate-50/50 dark:bg-surface-dark-muted space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900 dark:text-slate-100">{t.topicName}</span>
                  <span className="font-bold text-[#E05D38] dark:text-[#F4A261]">{t.accuracyPercentage}%</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {t.correctCount} / {t.totalQuestions} questions correct
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Question-Wise Breakdown */}
      <Card title="Question-Wise Performance">
        {questionBreakdown.length === 0 ? (
          <p className="text-xs text-slate-500">No question-level breakdown recorded for this attempt.</p>
        ) : (
          <div className="space-y-3">
            {questionBreakdown.map((q) => (
              <div
                key={q.questionId}
                className="p-4 rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Q{q.questionNumber}
                    </span>
                    <Badge variant="neutral" size="sm">
                      {q.questionType}
                    </Badge>
                    {q.topic && (
                      <Badge variant="sage" size="sm">
                        {q.topic}
                      </Badge>
                    )}
                    <Badge
                      variant={
                        q.status === 'correct'
                          ? 'success'
                          : q.status === 'unanswered'
                          ? 'neutral'
                          : 'danger'
                      }
                      size="sm"
                    >
                      {q.status === 'correct' ? 'Correct' : q.status === 'unanswered' ? 'Unanswered' : 'Incorrect'}
                    </Badge>
                  </div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {q.marksAwarded} / {q.maxMarks} marks
                  </span>
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {q.prompt}
                </p>

                {q.codingDetails && (
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border text-[11px] flex flex-wrap items-center gap-3">
                    <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                      <Code2 className="w-3.5 h-3.5 text-[#E05D38]" />
                      {q.codingDetails.language || 'Code / SQL'}
                    </span>
                    {q.codingDetails.verdict && (
                      <span>Verdict: <strong>{q.codingDetails.verdict}</strong></span>
                    )}
                    {q.codingDetails.executionResult?.verdict && (
                      <span>
                        Execution: <strong>{q.codingDetails.executionResult.verdict}</strong>
                        {typeof q.codingDetails.executionResult.passedCount === 'number' &&
                          typeof q.codingDetails.executionResult.totalCount === 'number' &&
                          ` (${q.codingDetails.executionResult.passedCount}/${q.codingDetails.executionResult.totalCount} test cases)`}
                      </span>
                    )}
                  </div>
                )}

                {q.feedback && (
                  <div className="p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40 text-xs text-slate-700 dark:text-slate-300">
                    <strong>Faculty Remark:</strong> {q.feedback}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* AI Performance Analysis (Integration-Ready Placeholder) */}
      <Card
        title="AI Performance Analysis"
        action={
          <Badge variant="neutral" size="sm">
            <Sparkles className="w-3 h-3 mr-1 inline" />
            Estimate · Not Yet Operational
          </Badge>
        }
      >
        <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300" data-testid="report-ai-placeholder">
          <p>{aiPredictor?.disclaimer}</p>
          <p className="text-[11px] text-slate-500">
            Status: <strong>Integration Ready ({aiPredictor?.status || 'NOT_IMPLEMENTED'})</strong> · Historical evaluated records available: <strong>{aiPredictor?.evaluatedHistoryCount ?? 1}</strong>
          </p>
        </div>
      </Card>
    </div>
  );
}
