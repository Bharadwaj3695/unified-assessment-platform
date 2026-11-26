import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, Video, FileText, UserCheck, RefreshCw, Camera } from 'lucide-react';
import interviewService from '../../services/interview.service';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { formatDateTime } from '../../utils/formatters';

const STATUS_BADGE = {
  scheduled: { variant: 'info', label: 'Scheduled' },
  ready: { variant: 'sage', label: 'Ready to Join' },
  in_progress: { variant: 'warning', label: 'In Progress' },
  completed: { variant: 'success', label: 'Completed' },
  cancelled: { variant: 'error', label: 'Cancelled' },
};

export default function StudentInterviews() {
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadInterviews = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await interviewService.listInterviews();
      setInterviews(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.message || 'Unable to load assigned interviews.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInterviews();
  }, [loadInterviews]);

  return (
    <div className="space-y-6 pb-12" data-testid="student-interviews-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark p-6 shadow-warm-xs">
        <div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            Student Workspace / <span className="text-brand-primary dark:text-brand-peach">Interviews</span>
          </div>
          <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-slate-100">
            Assigned Interviews
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            View scheduled faculty interviews, join open sessions, and review your official performance reports.
          </p>
        </div>
        <Button variant="outline" size="sm" icon={RefreshCw} onClick={loadInterviews}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <Card>
          <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            Loading assigned interviews...
          </div>
        </Card>
      ) : error ? (
        <ErrorState title="Unable to Load Interviews" message={error} onRetry={loadInterviews} />
      ) : interviews.length === 0 ? (
        <EmptyState
          title="No Assigned Interviews"
          description="You do not have any scheduled or active faculty interviews right now."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {interviews.map((iv) => {
            const ivId = iv.id || iv._id;
            const badge = STATUS_BADGE[iv.status] || { variant: 'neutral', label: iv.status };
            const canJoin = ['ready', 'in_progress', 'scheduled'].includes(iv.status);
            const camRequired = Boolean(
              iv.proctoringConfig?.cameraPermissionRequired || iv.proctoringConfig?.cameraProctoringEnabled
            );

            return (
              <Card key={ivId} hoverEffect data-testid={`student-interview-card-${ivId}`}>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={badge.variant} size="sm">
                      {badge.label}
                    </Badge>
                    <Badge variant="neutral" size="sm" className="uppercase">
                      {iv.interviewType?.replace('_', ' ')}
                    </Badge>
                    {camRequired && (
                      <Badge variant="primary" size="sm">
                        <Camera className="w-3 h-3 mr-1" />
                        Camera Required
                      </Badge>
                    )}
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {iv.title}
                    </h3>
                    {iv.instructions && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                        {iv.instructions}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-surface-dark-muted/40 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                      <span className="truncate">
                        {iv.facultyId?.name || 'Faculty'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-brand-sage shrink-0" />
                      <span>{iv.durationMinutes} mins</span>
                    </div>
                    <div className="flex items-center gap-2 sm:col-span-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        {iv.scheduledStartAt
                          ? `Scheduled: ${formatDateTime(iv.scheduledStartAt)}`
                          : 'Available to join now'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {canJoin && (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={Video}
                        onClick={() => navigate(`/student/interviews/${ivId}`)}
                        data-testid={`btn-join-interview-${ivId}`}
                      >
                        {iv.status === 'in_progress' ? 'Resume Interview Room' : 'Enter Interview Room'}
                      </Button>
                    )}
                    {iv.status === 'completed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        icon={FileText}
                        onClick={() => navigate(`/student/interviews/${ivId}/report`)}
                        data-testid={`btn-student-interview-report-${ivId}`}
                      >
                        View Performance Report
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
