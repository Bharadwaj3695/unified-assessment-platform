import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  FileText,
  Clock,
  Check,
  X,
  Lock,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import interviewService from '../../services/interview.service';
import proctoringService from '../../services/proctoring.service';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import ErrorState from '../../components/ui/ErrorState';
import Alert from '../../components/ui/Alert';

export default function InterviewReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isFacultyOrAdmin = user?.role === 'instructor' || user?.role === 'admin';
  const backPath = isFacultyOrAdmin ? '/instructor/interviews' : '/student/interviews';

  const [studentReport, setStudentReport] = useState(null);
  const [facultyBundle, setFacultyBundle] = useState(null);
  const [activeTab, setActiveTab] = useState('performance'); // 'performance' | 'behavioral' | 'transcript'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Faculty behavioral review state
  const [behavioralNotes, setBehavioralNotes] = useState('');
  const [finalizingBehavioral, setFinalizingBehavioral] = useState(false);

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (isFacultyOrAdmin) {
        const bundle = await interviewService.getFacultyReport(id);
        setFacultyBundle(bundle);
        setStudentReport(bundle.performanceReport);
        setBehavioralNotes(bundle.behavioralReport?.facultyReviewNotes || '');
      } else {
        // Students strictly fetch Performance Report ONLY
        const perf = await interviewService.getStudentPerformanceReport(id);
        setStudentReport(perf);
        setFacultyBundle(null);
      }
    } catch (err) {
      setError(err.message || 'Unable to load interview report.');
    } finally {
      setLoading(false);
    }
  }, [id, isFacultyOrAdmin]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleReviewEvent = async (eventId, decision) => {
    try {
      await proctoringService.reviewEvent(eventId, { decision });
      toast.success(`Event marked as ${decision}.`);
      await loadReport();
    } catch (err) {
      toast.error(err.message || 'Failed to review event.');
    }
  };

  const handleFinalizeBehavioral = async (finalize = true) => {
    try {
      setFinalizingBehavioral(true);
      await interviewService.finalizeBehavioralReport(id, {
        facultyReviewNotes: behavioralNotes,
        finalize,
      });
      toast.success(finalize ? 'Behavioral report finalized.' : 'Review notes saved.');
      await loadReport();
    } catch (err) {
      toast.error(err.message || 'Failed to update behavioral report.');
    } finally {
      setFinalizingBehavioral(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
        Loading interview report...
      </div>
    );
  }

  if (error || !studentReport) {
    return (
      <div className="max-w-3xl mx-auto py-8 space-y-4">
        <Button variant="outline" size="sm" icon={ArrowLeft} onClick={() => navigate(backPath)}>
          Back
        </Button>
        <ErrorState
          title="Unable to Load Interview Report"
          message={error || 'Report not found.'}
          onRetry={loadReport}
        />
      </div>
    );
  }

  const behavioral = facultyBundle?.behavioralReport || null;
  const transcript = facultyBundle?.transcript || null;

  return (
    <div className="space-y-6 pb-12" data-testid="interview-report-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-light-border dark:border-surface-dark-border pb-4">
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => navigate(backPath)}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral" size="sm" className="uppercase">
              {studentReport.interviewType?.replace('_', ' ')}
            </Badge>
            <Badge variant={studentReport.passed ? 'success' : 'warning'} size="sm">
              {studentReport.evaluationStatus === 'finalized'
                ? studentReport.passed
                  ? 'Passed'
                  : 'Needs Improvement'
                : 'Pending Evaluation'}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-slate-100">
            {studentReport.title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Student: {studentReport.student?.name} ({studentReport.student?.studentId}) · Faculty:{' '}
            {studentReport.faculty?.name} ({studentReport.faculty?.facultyId})
          </p>
        </div>

        {/* Faculty-Only Section Tabs (Never rendered for students) */}
        {isFacultyOrAdmin && (
          <div className="flex flex-wrap gap-2" data-testid="faculty-report-tabs">
            <button
              type="button"
              onClick={() => setActiveTab('performance')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'performance'
                  ? 'bg-brand-primary text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              Performance Report
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('behavioral')}
              data-testid="tab-behavioral-report"
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'behavioral'
                  ? 'bg-brand-primary text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              Behavioral & Proctoring
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('transcript')}
              data-testid="tab-transcript"
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'transcript'
                  ? 'bg-brand-primary text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              Interview Transcript
            </button>
          </div>
        )}
      </div>

      {/* Performance Report (Visible to Student + Faculty/Admin) */}
      {(activeTab === 'performance' || !isFacultyOrAdmin) && (
        <div className="space-y-6" data-testid="performance-report-section">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <div className="text-xs text-slate-500">Official Score</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {studentReport.officialScore} / {studentReport.maxScore}
              </div>
            </Card>
            <Card>
              <div className="text-xs text-slate-500">Percentage</div>
              <div className="text-2xl font-bold text-brand-primary mt-1">
                {studentReport.percentage}%
              </div>
            </Card>
            <Card>
              <div className="text-xs text-slate-500">Questions Answered Correctly</div>
              <div className="text-2xl font-bold text-brand-sage mt-1">
                {studentReport.counts?.correct ?? 0} / {studentReport.counts?.totalQuestions ?? 0}
              </div>
            </Card>
            <Card>
              <div className="text-xs text-slate-500">Evaluation Status</div>
              <div className="text-lg font-bold capitalize text-slate-900 dark:text-slate-100 mt-1">
                {studentReport.evaluationStatus}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Strengths & Improvement Areas">
              <div className="space-y-4 text-xs">
                <div>
                  <h4 className="font-bold text-emerald-700 dark:text-emerald-400 mb-1.5 flex items-center gap-1.5">
                    <Award className="w-4 h-4" />
                    Strengths
                  </h4>
                  {studentReport.strengths?.length > 0 ? (
                    <ul className="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-300">
                      {studentReport.strengths.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-500">No strengths recorded yet.</p>
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-amber-700 dark:text-amber-400 mb-1.5">
                    Improvement Areas
                  </h4>
                  {studentReport.improvementAreas?.length > 0 ? (
                    <ul className="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-300">
                      {studentReport.improvementAreas.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-500">No improvement areas noted.</p>
                  )}
                </div>
              </div>
            </Card>

            <Card title="Faculty Feedback">
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                {studentReport.facultyFeedback || 'No written feedback provided yet.'}
              </p>
              {isFacultyOrAdmin && facultyBundle?.facultyOnlyNotes && (
                <div
                  data-testid="faculty-only-notes-box"
                  className="mt-4 p-3 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 text-xs"
                >
                  <div className="font-bold text-rose-700 dark:text-rose-400 mb-1 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" />
                    Faculty-Only Review Notes
                  </div>
                  <p className="text-slate-700 dark:text-slate-300">{facultyBundle.facultyOnlyNotes}</p>
                </div>
              )}
            </Card>
          </div>

          {studentReport.topicWisePerformance?.length > 0 && (
            <Card title="Topic-Wise Performance">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {studentReport.topicWisePerformance.map((t) => (
                  <div
                    key={t.topicName}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-surface-dark-muted/30 text-xs"
                  >
                    <div className="font-bold text-slate-900 dark:text-slate-100">{t.topicName}</div>
                    <div className="text-slate-500 mt-1">
                      {t.correctCount}/{t.totalQuestions} correct ({t.accuracyPercentage}%) ·{' '}
                      {t.earnedMarks}/{t.maxMarks} pts
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {studentReport.questionBreakdown?.length > 0 && (
            <Card title="Question-by-Question Evaluation">
              <div className="space-y-3">
                {studentReport.questionBreakdown.map((q) => (
                  <div
                    key={q.questionId}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                        {q.isCorrect ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-500" />
                        )}
                        <span>
                          Q{q.questionNumber}. {q.prompt}
                        </span>
                      </div>
                      {q.comment && <p className="text-slate-600 dark:text-slate-400 pl-6">{q.comment}</p>}
                    </div>
                    <Badge variant="neutral" size="sm">
                      {q.marksAwarded} / {q.maxMarks}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Faculty-Only Behavioral Report */}
      {isFacultyOrAdmin && activeTab === 'behavioral' && behavioral && (
        <div className="space-y-6" data-testid="behavioral-report-section">
          <Alert variant="info" title="Observable Proctoring Policy">
            Behavioral indicators reflect observable session events only. Flags are review indicators and do not automatically fail students.
          </Alert>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <div className="text-xs text-slate-500">Camera Disconnects</div>
              <div className="text-xl font-bold mt-1">
                {behavioral.observableMetrics?.cameraDisconnectCount ?? 0}
              </div>
            </Card>
            <Card>
              <div className="text-xs text-slate-500">Face Not Detected</div>
              <div className="text-xl font-bold mt-1">
                {behavioral.observableMetrics?.faceNotDetectedCount ?? 0}
              </div>
            </Card>
            <Card>
              <div className="text-xs text-slate-500">Multiple Faces</div>
              <div className="text-xl font-bold mt-1">
                {behavioral.observableMetrics?.multipleFacesCount ?? 0}
              </div>
            </Card>
            <Card>
              <div className="text-xs text-slate-500">Report Status</div>
              <div className="text-base font-bold capitalize mt-1">{behavioral.status}</div>
            </Card>
          </div>

          {behavioral.aiSummaryDraft?.summaryText && (
            <Card
              title="AI Behavioral Summary Draft"
              subtitle={`Provider: ${behavioral.aiSummaryDraft.provider || 'worker'}`}
            >
              <p className="text-xs text-slate-700 dark:text-slate-300">
                {behavioral.aiSummaryDraft.summaryText}
              </p>
              <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                {behavioral.aiSummaryDraft.disclaimer}
              </p>
            </Card>
          )}

          <Card title="Proctoring Event Timeline & Faculty Review">
            {behavioral.timeline?.length > 0 ? (
              <div className="space-y-3">
                {behavioral.timeline.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-amber-500" />
                        <span className="font-bold uppercase">{evt.eventType.replace(/_/g, ' ')}</span>
                        <Badge variant="neutral" size="sm">
                          {evt.severity}
                        </Badge>
                        <Badge
                          variant={
                            evt.reviewStatus === 'accepted'
                              ? 'warning'
                              : evt.reviewStatus === 'rejected'
                              ? 'success'
                              : 'info'
                          }
                          size="sm"
                        >
                          Review: {evt.reviewStatus}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(evt.timestamp).toLocaleString()}</span>
                        {evt.metadata?.reason && <span>· {evt.metadata.reason}</span>}
                      </div>
                    </div>

                    {evt.reviewStatus !== 'not_applicable' && (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          icon={Check}
                          onClick={() => handleReviewEvent(evt.id, 'accepted')}
                        >
                          Accept Flag
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          icon={X}
                          onClick={() => handleReviewEvent(evt.id, 'rejected')}
                        >
                          Dismiss
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-4 text-center">
                No proctoring events recorded for this interview session.
              </p>
            )}
          </Card>

          <Card title="Faculty Behavioral Review & Finalization">
            <div className="space-y-3">
              <textarea
                rows={3}
                value={behavioralNotes}
                onChange={(e) => setBehavioralNotes(e.target.value)}
                placeholder="Enter faculty observations on proctoring events..."
                data-testid="input-behavioral-notes"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-surface-dark"
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={finalizingBehavioral}
                  onClick={() => handleFinalizeBehavioral(false)}
                >
                  Save Draft Notes
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  isLoading={finalizingBehavioral}
                  onClick={() => handleFinalizeBehavioral(true)}
                  data-testid="btn-finalize-behavioral"
                >
                  Finalize Behavioral Report
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Faculty-Only Interview Transcript */}
      {isFacultyOrAdmin && activeTab === 'transcript' && transcript && (
        <Card
          title="Interview Transcript"
          subtitle={`Segments: ${transcript.segmentCount || 0} (Faculty-Only)`}
          data-testid="transcript-report-section"
        >
          {transcript.segments?.length > 0 ? (
            <div className="space-y-3">
              {transcript.segments.map((seg) => (
                <div
                  key={seg.id}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-surface-dark-muted/30 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {seg.speakerRole === 'faculty' ? 'Faculty' : 'Student'} ({seg.speakerInstitutionalId})
                    </span>
                    <span>
                      {seg.startTimestamp ? new Date(seg.startTimestamp).toLocaleTimeString() : ''}
                    </span>
                  </div>
                  <p className="text-slate-800 dark:text-slate-200">
                    {seg.status === 'unclear' ? '[unclear]' : seg.text}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
              <FileText className="w-5 h-5 text-slate-400" />
              <span>No transcript segments recorded for this interview.</span>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
