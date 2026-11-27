import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  LogOut,
  Save,
  UserCheck,
  Video,
  FileText,
} from 'lucide-react';
import interviewService from '../../services/interview.service';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import ErrorState from '../../components/ui/ErrorState';
import FloatingCameraPreview from '../../components/proctoring/FloatingCameraPreview';
import InterviewVideoRoom from '../../components/interviews/InterviewVideoRoom';
import { formatDateTime } from '../../utils/formatters';

export default function StudentInterviewRoom() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [interview, setInterview] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [cameraStatus, setCameraStatus] = useState('not_required');
  const [joining, setJoining] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [justEnteredSession, setJustEnteredSession] = useState(false);

  const [studentNotes, setStudentNotes] = useState('');
  const [responses, setResponses] = useState({});

  const loadInterview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await interviewService.getInterviewById(id);
      setInterview(data);
      if (data.session) {
        setSession(data.session);
        setStudentNotes(data.session.studentNotes || '');
        setResponses(data.session.studentResponses || {});
      }
    } catch (err) {
      setError(err.message || 'Unable to access this interview.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadInterview();
  }, [loadInterview]);

  const procCfg = interview?.proctoringConfig || {};
  const cameraEnabled = Boolean(
    procCfg.cameraProctoringEnabled || procCfg.cameraPermissionRequired
  );
  const cameraMandatory = Boolean(procCfg.cameraPermissionRequired);
  const isCameraReady =
    !cameraMandatory || cameraStatus === 'granted' || cameraStatus === 'reconnected';
  const sessionActive = Boolean(session && session.status === 'active' && interview?.status === 'in_progress');

  const handleJoinSession = async () => {
    if (cameraMandatory && !isCameraReady) {
      toast.warning('Please allow camera access before starting the interview.');
      return;
    }
    try {
      setJoining(true);
      setJustEnteredSession(true);
      const data = await interviewService.startOrJoinSession(id);
      setInterview(data.interview);
      setSession(data.session);
      toast.success('Joined interview room.');
    } catch (err) {
      setJustEnteredSession(false);
      toast.error(err.message || 'Unable to join interview session.');
    } finally {
      setJoining(false);
    }
  };

  const handleCameraEvent = async ({ eventType, detail, status }) => {
    if (!sessionActive && !session) return;
    try {
      await interviewService.updateCameraStatus(id, {
        status: status || cameraStatus,
        eventType,
        detail,
      });
    } catch {
      // Non-fatal telemetry sync
    }
  };

  const handleSaveResponses = async () => {
    try {
      setSavingNotes(true);
      await interviewService.saveStudentResponses(id, {
        studentNotes,
        studentResponses: responses,
      });
      toast.success('Notes saved.');
    } catch (err) {
      toast.error(err.message || 'Failed to save responses.');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleCompleteOrLeave = async (action) => {
    try {
      setCompleting(true);
      const updated = await interviewService.completeOrLeaveSession(id, {
        action,
        reason: action === 'leave' ? 'Student exited room' : 'Student completed session',
      });
      setInterview(updated);
      setSession(updated.session || null);
      toast.success(
        action === 'leave'
          ? 'You have left the interview room.'
          : 'Interview session completed.'
      );
      if (action === 'leave') {
        navigate('/student/interviews');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update session.');
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
        Loading interview room...
      </div>
    );
  }

  if (error || !interview) {
    return (
      <div className="max-w-2xl mx-auto py-8 space-y-4">
        <Button
          variant="outline"
          size="sm"
          icon={ArrowLeft}
          onClick={() => navigate('/student/interviews')}
        >
          Back to Interviews
        </Button>
        <ErrorState
          title="Interview Unavailable"
          message={error || 'Interview not found.'}
          onRetry={loadInterview}
        />
      </div>
    );
  }

  const isFinished = ['completed', 'cancelled'].includes(interview.status);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12" data-testid="student-interview-room">
      {/* Header */}
      <div className="rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark p-5 sm:p-6 shadow-warm-xs space-y-3">
        <button
          type="button"
          onClick={() => navigate('/student/interviews')}
          className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 flex items-center gap-1 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Assigned Interviews</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Badge variant="primary" size="sm" className="uppercase">
                {interview.interviewType?.replace('_', ' ')}
              </Badge>
              <Badge
                variant={interview.status === 'completed' ? 'success' : interview.status === 'cancelled' ? 'error' : 'info'}
                size="sm"
                className="uppercase"
              >
                {interview.status?.replace('_', ' ')}
              </Badge>
              {cameraEnabled && (
                <Badge variant={isCameraReady ? 'success' : 'warning'} size="sm">
                  Camera: {cameraStatus}
                </Badge>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-display text-slate-900 dark:text-slate-100">
              {interview.title}
            </h1>
          </div>

          {interview.status === 'completed' && (
            <Button
              variant="primary"
              size="sm"
              icon={FileText}
              onClick={() => navigate(`/student/interviews/${id}/report`)}
              data-testid="btn-view-performance-report"
            >
              View Performance Report
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-brand-primary" />
            Faculty: {interview.facultyId?.name || 'Instructor'}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-brand-sage" />
            Duration: {interview.durationMinutes} mins
          </span>
          {interview.scheduledStartAt && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {formatDateTime(interview.scheduledStartAt)}
            </span>
          )}
        </div>
      </div>

      {/* Instructions */}
      {interview.instructions && (
        <Card title="Interview Instructions">
          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
            {interview.instructions}
          </p>
        </Card>
      )}

      {/* Pre-Join Camera Permission & Floating Preview */}
      {!sessionActive && !isFinished && (
        <FloatingCameraPreview
          enabled={cameraEnabled}
          required={cameraMandatory}
          disclosureText={procCfg.disclosureText}
          sessionActive={!isFinished && !completing && !sessionActive}
          onStatusChange={(nextStatus) => setCameraStatus(nextStatus)}
          onCameraEvent={handleCameraEvent}
        />
      )}

      {/* Pre-Join Lobby */}
      {!sessionActive && !isFinished && (
        <Card title="Join Interview Session">
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {cameraMandatory && !isCameraReady
                ? 'Grant camera access above before entering the active interview session.'
                : 'Entering the active interview connects live two-way audio and video with your assigned faculty interviewer. Your faculty controls camera and microphone state during the session.'}
            </p>
            <Button
              type="button"
              variant="primary"
              size="md"
              icon={Video}
              isLoading={joining}
              disabled={cameraMandatory && !isCameraReady}
              onClick={handleJoinSession}
              data-testid="btn-enter-active-session"
            >
              Start / Join Interview Session
            </Button>
          </div>
        </Card>
      )}

      {/* Live Two-Way Face-to-Face Video Interview Room */}
      {(sessionActive || isFinished) && (
        <InterviewVideoRoom
          interview={interview}
          session={session}
          role="student"
          autoStartMedia={sessionActive && justEnteredSession}
          completing={completing}
          onLeave={() => handleCompleteOrLeave('leave')}
          onComplete={() => handleCompleteOrLeave('complete')}
          onSessionEnded={() => loadInterview()}
        />
      )}

      {/* Active Interview Workspace */}
      {sessionActive && (
        <Card
          title="Interview Participation Workspace"
          subtitle="Respond to faculty questions or capture scratchpad notes"
          action={
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={Save}
                isLoading={savingNotes}
                onClick={handleSaveResponses}
              >
                Save Notes
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={LogOut}
                disabled={completing}
                onClick={() => handleCompleteOrLeave('leave')}
                data-testid="btn-leave-interview"
              >
                Leave
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                icon={CheckCircle2}
                isLoading={completing}
                onClick={() => handleCompleteOrLeave('complete')}
                data-testid="btn-complete-interview"
              >
                Complete Session
              </Button>
            </div>
          }
        >
          <div className="space-y-5">
            {(interview.questions || []).map((q, idx) => {
              const qId = String(q._id || q.id);
              return (
                <div
                  key={qId}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-surface-dark-muted/30 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-brand-primary">
                      Question {idx + 1}
                    </span>
                    <Badge variant="neutral" size="sm">
                      {q.topic || 'General'} · {q.maxMarks || 10} pts
                    </Badge>
                  </div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {q.questionText}
                  </p>
                  <textarea
                    rows={2}
                    value={responses[qId] || ''}
                    onChange={(e) =>
                      setResponses((prev) => ({ ...prev, [qId]: e.target.value }))
                    }
                    placeholder="Optional written response or code/outline..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-surface-dark"
                  />
                </div>
              );
            })}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                General Scratchpad Notes
              </label>
              <textarea
                rows={3}
                value={studentNotes}
                onChange={(e) => setStudentNotes(e.target.value)}
                placeholder="Notes shared during the interview..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-surface-dark"
              />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
