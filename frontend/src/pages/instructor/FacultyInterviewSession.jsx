import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  ArrowLeft,
  CheckCircle2,
  Play,
  Plus,
  Send,
  Shield,
  Sparkles,
  User,
  FileText,
} from 'lucide-react';
import interviewService from '../../services/interview.service';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import ErrorState from '../../components/ui/ErrorState';
import InterviewVideoRoom from '../../components/interviews/InterviewVideoRoom';

export default function FacultyInterviewSession() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [interview, setInterview] = useState(null);
  const [transcript, setTranscript] = useState({ segments: [], formattedText: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Transcript segment input
  const [speakerRole, setSpeakerRole] = useState('faculty');
  const [segmentText, setSegmentText] = useState('');
  const [segmentStatus, setSegmentStatus] = useState('final');
  const [addingSegment, setAddingSegment] = useState(false);

  // Evaluation form state
  const [questionScores, setQuestionScores] = useState([]);
  const [strengthsText, setStrengthsText] = useState('');
  const [improvementsText, setImprovementsText] = useState('');
  const [facultyFeedback, setFacultyFeedback] = useState('');
  const [facultyOnlyNotes, setFacultyOnlyNotes] = useState('');
  const [savingEval, setSavingEval] = useState(false);

  const loadSession = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [ivData, trData] = await Promise.all([
        interviewService.getInterviewById(id),
        interviewService.getTranscript(id).catch(() => ({ segments: [], formattedText: '' })),
      ]);
      setInterview(ivData);
      setTranscript(trData || { segments: [], formattedText: '' });

      const existingScores = ivData.evaluation?.questionScores || [];
      const scoreMap = new Map(existingScores.map((s) => [String(s.questionId), s]));
      setQuestionScores(
        (ivData.questions || []).map((q) => {
          const qId = String(q._id || q.id);
          const prev = scoreMap.get(qId);
          return {
            questionId: qId,
            prompt: q.questionText,
            topic: q.topic || 'General',
            maxMarks: q.maxMarks || 10,
            marksAwarded: prev ? prev.marksAwarded : 0,
            isCorrect: prev ? prev.isCorrect : false,
            comment: prev ? prev.comment : '',
          };
        })
      );
      setStrengthsText((ivData.evaluation?.strengths || []).join(', '));
      setImprovementsText((ivData.evaluation?.improvementAreas || []).join(', '));
      setFacultyFeedback(ivData.evaluation?.facultyFeedback || '');
      setFacultyOnlyNotes(ivData.evaluation?.facultyOnlyNotes || '');
    } catch (err) {
      setError(err.message || 'Failed to load interview session.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const handleAddTranscriptSegment = async (e) => {
    e.preventDefault();
    if (!segmentText.trim() && segmentStatus !== 'unclear') {
      toast.error('Enter transcript text or mark as [unclear].');
      return;
    }
    try {
      setAddingSegment(true);
      await interviewService.addTranscriptSegment(id, {
        speakerRole,
        text: segmentText.trim(),
        status: segmentStatus,
      });
      setSegmentText('');
      setSegmentStatus('final');
      const updated = await interviewService.getTranscript(id);
      setTranscript(updated);
    } catch (err) {
      toast.error(err.message || 'Failed to add transcript segment.');
    } finally {
      setAddingSegment(false);
    }
  };

  const handleRunAiTranscriptSummary = async () => {
    try {
      await interviewService.processAiTranscript(id, {
        utterances: [],
        generateSummary: true,
      });
      toast.success('AI transcript pipeline executed cleanly.');
      await loadSession();
    } catch (err) {
      toast.error(err.message || 'AI pipeline call failed.');
    }
  };

  const handleSaveEvaluation = async (finalize = true) => {
    try {
      setSavingEval(true);
      await interviewService.evaluateInterview(id, {
        questionScores: questionScores.map((q) => ({
          questionId: q.questionId,
          marksAwarded: Number(q.marksAwarded) || 0,
          maxMarks: Number(q.maxMarks) || 10,
          isCorrect: Number(q.marksAwarded) >= Number(q.maxMarks) * 0.6,
          topic: q.topic,
          comment: q.comment,
        })),
        strengths: strengthsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        improvementAreas: improvementsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        facultyFeedback,
        facultyOnlyNotes,
        finalize,
      });
      toast.success('Interview evaluation saved.');
      await loadSession();
    } catch (err) {
      toast.error(err.message || 'Failed to save evaluation.');
    } finally {
      setSavingEval(false);
    }
  };

  const handleCompleteInterview = async () => {
    try {
      await interviewService.completeOrLeaveSession(id, { action: 'complete' });
      toast.success('Interview marked as completed.');
      await loadSession();
    } catch (err) {
      toast.error(err.message || 'Failed to complete interview.');
    }
  };

  const handleStartLiveSession = async () => {
    try {
      await interviewService.startOrJoinSession(id);
      toast.success('Live interview session started.');
      await loadSession();
    } catch (err) {
      toast.error(err.message || 'Failed to start interview session.');
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
        Loading faculty interview session...
      </div>
    );
  }

  if (error || !interview) {
    return (
      <ErrorState
        title="Unable to Load Session"
        message={error || 'Interview not found.'}
        onRetry={loadSession}
      />
    );
  }

  const session = interview.session;

  return (
    <div className="space-y-6 pb-12" data-testid="faculty-interview-session">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark p-5 shadow-warm-xs">
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => navigate('/instructor/interviews')}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Interview Studio</span>
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold font-display text-slate-900 dark:text-slate-100">
              {interview.title}
            </h1>
            <Badge variant="warning" size="sm" className="uppercase">
              {interview.status?.replace('_', ' ')}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5" />
              {interview.studentId?.name} ({interview.studentId?.studentId || 'Student'})
            </span>
            {session && (
              <span className="flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-brand-primary" />
                Camera: {session.cameraConnectionStatus}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {['ready', 'scheduled'].includes(interview.status) && (
            <Button
              variant="primary"
              size="sm"
              icon={Play}
              onClick={handleStartLiveSession}
              data-testid="btn-faculty-start-live"
            >
              Start Live Video Session
            </Button>
          )}
          {interview.status !== 'completed' && interview.status !== 'cancelled' && (
            <Button
              variant="sage"
              size="sm"
              icon={CheckCircle2}
              onClick={handleCompleteInterview}
              data-testid="btn-faculty-complete-session"
            >
              Complete Interview
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            icon={FileText}
            onClick={() => navigate(`/instructor/interviews/${id}/report`)}
          >
            Open Full Reports
          </Button>
        </div>
      </div>

      {/* Live Two-Way Face-to-Face Video Interview Room */}
      {['in_progress', 'completed', 'cancelled'].includes(interview.status) ? (
        <InterviewVideoRoom
          interview={interview}
          session={session}
          role="faculty"
          autoStartMedia={interview.status === 'in_progress'}
          onLeave={() => navigate('/instructor/interviews')}
          onComplete={handleCompleteInterview}
          onSessionEnded={loadSession}
        />
      ) : (
        <Card
          title="Live Video Interview Room"
          subtitle="Start the interview session when you are ready to connect with the assigned student"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Assigned Student: <strong>{interview.studentId?.name}</strong> (
              {interview.studentId?.studentId || 'Student'}). Click Start Live Video Session to open the two-way video call and enable student media controls.
            </p>
            {['ready', 'scheduled'].includes(interview.status) && (
              <Button
                variant="primary"
                size="sm"
                icon={Play}
                onClick={handleStartLiveSession}
              >
                Start Live Video Session
              </Button>
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Questions & Deterministic Evaluation */}
        <div className="lg:col-span-7 space-y-6">
          <Card title="Rubric Scoring & Evaluation" subtitle="Official scores are strictly faculty-determined">
            <div className="space-y-4">
              {questionScores.map((q, idx) => (
                <div
                  key={q.questionId}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-surface-dark-muted/30 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Q{idx + 1}. {q.prompt}
                    </div>
                    <Badge variant="neutral" size="sm">
                      {q.topic}
                    </Badge>
                  </div>
                  {session?.studentResponses?.[q.questionId] && (
                    <div className="p-2 rounded-lg bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
                      <span className="font-semibold">Student Note:</span>{' '}
                      {session.studentResponses[q.questionId]}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">
                        Marks (Max {q.maxMarks})
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={q.maxMarks}
                        value={q.marksAwarded}
                        onChange={(e) => {
                          const val = e.target.value;
                          setQuestionScores((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, marksAwarded: val } : item))
                          );
                        }}
                        data-testid={`input-eval-marks-${idx}`}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-surface-dark"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">
                        Question Comment
                      </label>
                      <input
                        type="text"
                        value={q.comment}
                        onChange={(e) => {
                          const val = e.target.value;
                          setQuestionScores((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, comment: val } : item))
                          );
                        }}
                        placeholder="Observation or rubric feedback..."
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-surface-dark"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold mb-1">Strengths (comma-separated)</label>
                  <input
                    type="text"
                    value={strengthsText}
                    onChange={(e) => setStrengthsText(e.target.value)}
                    placeholder="Clear explanation, Problem decomposition"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-surface-dark"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Improvement Areas (comma-separated)</label>
                  <input
                    type="text"
                    value={improvementsText}
                    onChange={(e) => setImprovementsText(e.target.value)}
                    placeholder="Edge case analysis, Time complexity"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-surface-dark"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Student-Visible Faculty Feedback</label>
                <textarea
                  rows={2}
                  value={facultyFeedback}
                  onChange={(e) => setFacultyFeedback(e.target.value)}
                  data-testid="input-faculty-feedback"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-surface-dark"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-rose-700 dark:text-rose-400 mb-1">
                  Faculty-Only Review Notes (Hidden from Student)
                </label>
                <textarea
                  rows={2}
                  value={facultyOnlyNotes}
                  onChange={(e) => setFacultyOnlyNotes(e.target.value)}
                  data-testid="input-faculty-only-notes"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/20"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  icon={Send}
                  isLoading={savingEval}
                  onClick={() => handleSaveEvaluation(true)}
                  data-testid="btn-save-evaluation"
                >
                  Save & Finalize Evaluation
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Structured Transcript Capture (Faculty Only) */}
        <div className="lg:col-span-5 space-y-6">
          <Card
            title="Structured Interview Transcript"
            subtitle="Faculty-only record with authenticated institutional IDs"
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={Sparkles}
                onClick={handleRunAiTranscriptSummary}
              >
                AI Summary
              </Button>
            }
          >
            <div className="space-y-4">
              <div
                data-testid="transcript-segment-list"
                className="max-h-72 overflow-y-auto space-y-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-surface-dark-muted/40"
              >
                {transcript.segments?.length > 0 ? (
                  transcript.segments.map((seg) => (
                    <div key={seg.id} className="text-xs space-y-0.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {seg.speakerRole === 'faculty' ? 'Faculty' : 'Student'} ({seg.speakerInstitutionalId})
                        </span>
                        <span>
                          {seg.startTimestamp
                            ? new Date(seg.startTimestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })
                            : ''}
                        </span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300">
                        {seg.status === 'unclear' ? '[unclear]' : seg.text}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-500 text-center py-6">
                    No transcript segments recorded yet.
                  </div>
                )}
              </div>

              <form onSubmit={handleAddTranscriptSegment} className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={speakerRole}
                    onChange={(e) => setSpeakerRole(e.target.value)}
                    data-testid="select-transcript-speaker"
                    className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-surface-dark"
                  >
                    <option value="faculty">Faculty</option>
                    <option value="student">Student</option>
                  </select>
                  <select
                    value={segmentStatus}
                    onChange={(e) => setSegmentStatus(e.target.value)}
                    className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-surface-dark"
                  >
                    <option value="final">Clear Speech</option>
                    <option value="unclear">Unclear ([unclear])</option>
                  </select>
                </div>
                <textarea
                  rows={2}
                  value={segmentText}
                  onChange={(e) => setSegmentText(e.target.value)}
                  placeholder="Record spoken question or student answer..."
                  data-testid="input-transcript-text"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-surface-dark"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  icon={Plus}
                  isLoading={addingSegment}
                  data-testid="btn-add-transcript"
                  className="w-full"
                >
                  Append Transcript Segment
                </Button>
              </form>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
