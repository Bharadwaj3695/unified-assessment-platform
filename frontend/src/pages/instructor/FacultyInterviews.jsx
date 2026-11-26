import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  Plus,
  Calendar,
  Clock,
  Users,
  Video,
  CheckCircle2,
  XCircle,
  Play,
  FileText,
  Edit3,
  BookOpen,
  Trash2,
  Database,
  RefreshCw,
} from 'lucide-react';
import interviewService from '../../services/interview.service';
import instructorService from '../../services/instructor.service';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import QuestionBankPickerModal from '../../components/modals/QuestionBankPickerModal';
import CameraProctoringPanel from '../../components/proctoring/CameraProctoringPanel';
import { formatDateTime } from '../../utils/formatters';

const STATUS_BADGE_MAP = {
  draft: { variant: 'neutral', label: 'Draft' },
  scheduled: { variant: 'info', label: 'Scheduled' },
  ready: { variant: 'sage', label: 'Ready' },
  in_progress: { variant: 'warning', label: 'In Progress' },
  completed: { variant: 'success', label: 'Completed' },
  cancelled: { variant: 'error', label: 'Cancelled' },
};

const DEFAULT_PROCTORING = {
  cameraProctoringEnabled: false,
  aiProctoringEnabled: false,
  liveMonitoringEnabled: false,
  cameraPermissionRequired: false,
  disclosureText:
    'Camera preview is used for identity presence verification during this interview session. Video is not transmitted or recorded unless explicitly enabled by institutional policy.',
};

function toLocalInputValue(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function FacultyInterviews() {
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Studio Modal state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isBankPickerOpen, setIsBankPickerOpen] = useState(false);

  // Reschedule Modal state
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [rescheduleStart, setRescheduleStart] = useState('');
  const [rescheduleEnd, setRescheduleEnd] = useState('');

  // Form fields
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [interviewType, setInterviewType] = useState('technical');
  const [studentId, setStudentId] = useState('');
  const [scheduledStartAt, setScheduledStartAt] = useState('');
  const [scheduledEndAt, setScheduledEndAt] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [passingPercentage, setPassingPercentage] = useState(60);
  const [initialStatus, setInitialStatus] = useState('scheduled');
  const [questions, setQuestions] = useState([
    { sourceType: 'custom', questionText: '', topic: 'General', maxMarks: 10, rubricNotes: '' },
  ]);
  const [proctoringConfig, setProctoringConfig] = useState(DEFAULT_PROCTORING);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [ivList, stuList] = await Promise.all([
        interviewService.listInterviews({ status: statusFilter, search: searchQuery }),
        instructorService.getStudents(),
      ]);
      setInterviews(Array.isArray(ivList) ? ivList : []);
      setStudents(Array.isArray(stuList) ? stuList : []);
    } catch (err) {
      setError(err.message || 'Failed to load interviews.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setInstructions('');
    setInterviewType('technical');
    setStudentId(students[0]?._id || students[0]?.id || '');
    setScheduledStartAt('');
    setScheduledEndAt('');
    setDurationMinutes(30);
    setPassingPercentage(60);
    setInitialStatus('ready');
    setQuestions([
      { sourceType: 'custom', questionText: '', topic: 'General', maxMarks: 10, rubricNotes: '' },
    ]);
    setProctoringConfig(DEFAULT_PROCTORING);
  };

  const openCreateModal = () => {
    resetForm();
    setIsEditorOpen(true);
  };

  const openEditModal = (iv) => {
    setEditingId(iv.id || iv._id);
    setTitle(iv.title || '');
    setInstructions(iv.instructions || '');
    setInterviewType(iv.interviewType || 'technical');
    setStudentId(iv.studentId?._id || iv.studentId?.id || iv.studentId || '');
    setScheduledStartAt(toLocalInputValue(iv.scheduledStartAt));
    setScheduledEndAt(toLocalInputValue(iv.scheduledEndAt));
    setDurationMinutes(iv.durationMinutes || 30);
    setPassingPercentage(iv.passingPercentage ?? 60);
    setInitialStatus(iv.status || 'draft');
    setQuestions(
      iv.questions?.length > 0
        ? iv.questions.map((q) => ({
            sourceType: q.sourceType || 'custom',
            bankQuestionId: q.bankQuestionId || null,
            questionText: q.questionText || '',
            questionType: q.questionType || 'short_answer',
            topic: q.topic || 'General',
            maxMarks: q.maxMarks || 10,
            rubricNotes: q.rubricNotes || '',
          }))
        : [{ sourceType: 'custom', questionText: '', topic: 'General', maxMarks: 10, rubricNotes: '' }]
    );
    setProctoringConfig(iv.proctoringConfig || DEFAULT_PROCTORING);
    setIsEditorOpen(true);
  };

  const handleBankSelect = (pickedQuestions) => {
    const mapped = (pickedQuestions || []).map((q) => ({
      sourceType: 'bank',
      bankQuestionId: q._id || q.id,
      questionText: q.statement || q.questionText || '',
      questionType: q.questionType || q.type || 'short_answer',
      topic: (Array.isArray(q.conceptTags) && q.conceptTags[0]) || (Array.isArray(q.topics) && q.topics[0]) || 'General',
      maxMarks: Number(q.marks || q.points) || 10,
      rubricNotes: '',
    }));
    setQuestions((prev) => {
      const nonEmpty = prev.filter((item) => item.questionText.trim().length > 0);
      return [...nonEmpty, ...mapped];
    });
    toast.success(`Added ${mapped.length} question(s) from Question Bank.`);
  };

  const handleSaveInterview = async (e) => {
    e.preventDefault();
    if (!title.trim() || title.trim().length < 3) {
      toast.error('Interview title must be at least 3 characters.');
      return;
    }
    if (!studentId) {
      toast.error('Please assign a student.');
      return;
    }
    const cleanQuestions = questions
      .filter((q) => q.questionText.trim().length > 0)
      .map((q) => ({
        ...q,
        questionText: q.questionText.trim(),
        maxMarks: Number(q.maxMarks) || 10,
      }));
    if (cleanQuestions.length === 0) {
      toast.error('Add at least one interview question.');
      return;
    }

    const payload = {
      title: title.trim(),
      instructions: instructions.trim(),
      interviewType,
      studentId,
      scheduledStartAt: scheduledStartAt ? new Date(scheduledStartAt).toISOString() : null,
      scheduledEndAt: scheduledEndAt ? new Date(scheduledEndAt).toISOString() : null,
      durationMinutes: Number(durationMinutes) || 30,
      passingPercentage: Number(passingPercentage) ?? 60,
      questions: cleanQuestions,
      proctoringConfig,
      ...(!editingId ? { status: initialStatus } : {}),
    };

    try {
      setSaving(true);
      if (editingId) {
        await interviewService.updateInterview(editingId, payload);
        toast.success('Interview updated.');
      } else {
        await interviewService.createInterview(payload);
        toast.success('Interview created.');
      }
      setIsEditorOpen(false);
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to save interview.');
    } finally {
      setSaving(false);
    }
  };

  const handleTransition = async (id, nextStatus, extra = {}) => {
    try {
      await interviewService.transitionStatus(id, nextStatus, extra);
      toast.success(`Interview updated to ${nextStatus.replace('_', ' ')}.`);
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Transition failed.');
    }
  };

  const handleStartSession = async (id) => {
    try {
      await interviewService.startOrJoinSession(id);
      navigate(`/instructor/interviews/${id}/session`);
    } catch (err) {
      toast.error(err.message || 'Unable to start interview session.');
    }
  };

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!rescheduleTarget || !rescheduleStart) {
      toast.error('Scheduled start date/time is required.');
      return;
    }
    try {
      await interviewService.rescheduleInterview(rescheduleTarget.id || rescheduleTarget._id, {
        scheduledStartAt: new Date(rescheduleStart).toISOString(),
        scheduledEndAt: rescheduleEnd ? new Date(rescheduleEnd).toISOString() : null,
      });
      toast.success('Interview rescheduled.');
      setRescheduleTarget(null);
      await loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to reschedule interview.');
    }
  };

  return (
    <div className="space-y-6 pb-12" data-testid="faculty-interviews-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark p-6 shadow-warm-xs">
        <div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            Faculty Workspace / <span className="text-brand-primary dark:text-brand-peach">Interview Studio</span>
          </div>
          <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-slate-100">
            Faculty Interview Studio
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Schedule technical interviews & vivas, assign students, configure camera proctoring, and review reports.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={RefreshCw} onClick={loadData}>
            Refresh
          </Button>
          <Button
            variant="primary"
            size="md"
            icon={Plus}
            onClick={openCreateModal}
            data-testid="btn-create-interview"
          >
            Create Interview
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, student name, or student ID..."
            className="w-full sm:w-80 px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-surface-dark text-slate-900 dark:text-slate-100"
          />
          <div className="flex flex-wrap gap-1.5">
            {['all', 'draft', 'scheduled', 'ready', 'in_progress', 'completed', 'cancelled'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition cursor-pointer ${
                  statusFilter === st
                    ? 'bg-brand-primary text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Interviews List */}
      {loading ? (
        <Card>
          <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            Loading interviews...
          </div>
        </Card>
      ) : error ? (
        <ErrorState title="Unable to Load Interviews" message={error} onRetry={loadData} />
      ) : interviews.length === 0 ? (
        <EmptyState
          title="No Interviews Found"
          description="Create a new technical interview or oral viva and assign it to a student."
          actionLabel="Create Interview"
          onAction={openCreateModal}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {interviews.map((iv) => {
            const ivId = iv.id || iv._id;
            const badge = STATUS_BADGE_MAP[iv.status] || STATUS_BADGE_MAP.draft;
            const camOn = Boolean(iv.proctoringConfig?.cameraProctoringEnabled);
            const aiOn = Boolean(iv.proctoringConfig?.aiProctoringEnabled);
            return (
              <Card key={ivId} hoverEffect data-testid={`interview-card-${ivId}`}>
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge variant={badge.variant} size="sm">
                          {badge.label}
                        </Badge>
                        <Badge variant="neutral" size="sm" className="uppercase">
                          {iv.interviewType?.replace('_', ' ')}
                        </Badge>
                        {camOn && (
                          <Badge variant="primary" size="sm">
                            Camera Proctoring
                          </Badge>
                        )}
                        {aiOn && (
                          <Badge variant="secondary" size="sm">
                            AI Events
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                        {iv.title}
                      </h3>
                    </div>
                  </div>

                  {iv.instructions && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                      {iv.instructions}
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-surface-dark-muted/40 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                      <span className="truncate">
                        {iv.studentId?.name || 'Student'}{' '}
                        {iv.studentId?.studentId ? `(${iv.studentId.studentId})` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-brand-sage shrink-0" />
                      <span>
                        {iv.durationMinutes} mins | {iv.questions?.length || 0} Qs
                      </span>
                    </div>
                    <div className="flex items-center gap-2 sm:col-span-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        {iv.scheduledStartAt
                          ? `Scheduled: ${formatDateTime(iv.scheduledStartAt)}`
                          : 'Unscheduled (on-demand ready)'}
                      </span>
                    </div>
                  </div>

                  {/* Lifecycle & Session Actions */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {!['completed', 'cancelled'].includes(iv.status) && (
                      <Button
                        variant="outline"
                        size="sm"
                        icon={Edit3}
                        onClick={() => openEditModal(iv)}
                      >
                        Edit
                      </Button>
                    )}

                    {iv.status === 'draft' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={CheckCircle2}
                        onClick={() => handleTransition(ivId, 'ready')}
                      >
                        Mark Ready
                      </Button>
                    )}

                    {iv.status === 'scheduled' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={CheckCircle2}
                        onClick={() => handleTransition(ivId, 'ready')}
                      >
                        Mark Ready
                      </Button>
                    )}

                    {['ready', 'scheduled', 'in_progress'].includes(iv.status) && (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={iv.status === 'in_progress' ? Video : Play}
                        onClick={() => handleStartSession(ivId)}
                        data-testid={`btn-start-interview-${ivId}`}
                      >
                        {iv.status === 'in_progress' ? 'Open Live Session' : 'Start Session'}
                      </Button>
                    )}

                    {['draft', 'scheduled', 'ready'].includes(iv.status) && (
                      <Button
                        variant="outline"
                        size="sm"
                        icon={Calendar}
                        onClick={() => {
                          setRescheduleTarget(iv);
                          setRescheduleStart(toLocalInputValue(iv.scheduledStartAt));
                          setRescheduleEnd(toLocalInputValue(iv.scheduledEndAt));
                        }}
                      >
                        Reschedule
                      </Button>
                    )}

                    {iv.status === 'in_progress' && (
                      <Button
                        variant="sage"
                        size="sm"
                        icon={CheckCircle2}
                        onClick={() => handleTransition(ivId, 'completed')}
                      >
                        Complete
                      </Button>
                    )}

                    {!['completed', 'cancelled'].includes(iv.status) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={XCircle}
                        onClick={() => handleTransition(ivId, 'cancelled', { reason: 'Cancelled by faculty' })}
                        className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      >
                        Cancel
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      icon={FileText}
                      onClick={() => navigate(`/instructor/interviews/${ivId}/report`)}
                      data-testid={`btn-faculty-report-${ivId}`}
                    >
                      Reports
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Interview Modal */}
      <Modal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        title={editingId ? 'Edit Faculty Interview' : 'Create Faculty Interview'}
        size="xl"
      >
        <form onSubmit={handleSaveInterview} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Interview Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Data Structures & Algorithms Viva #1"
                data-testid="input-interview-title"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-surface-dark"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Interview Type
              </label>
              <select
                value={interviewType}
                onChange={(e) => setInterviewType(e.target.value)}
                data-testid="select-interview-type"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-surface-dark"
              >
                <option value="technical">Technical Interview</option>
                <option value="viva">Oral Viva</option>
                <option value="oral_assessment">Oral Assessment</option>
                <option value="project_review">Project Review</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Assign Student *
              </label>
              <select
                required
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                data-testid="select-interview-student"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-surface-dark"
              >
                <option value="">Select a student...</option>
                {students.map((s) => (
                  <option key={s._id || s.id} value={s._id || s.id}>
                    {s.name} {s.studentId ? `(${s.studentId})` : `— ${s.email}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Start Date & Time
              </label>
              <input
                type="datetime-local"
                value={scheduledStartAt}
                onChange={(e) => setScheduledStartAt(e.target.value)}
                data-testid="input-interview-start"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-surface-dark"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                End Date & Time
              </label>
              <input
                type="datetime-local"
                value={scheduledEndAt}
                onChange={(e) => setScheduledEndAt(e.target.value)}
                data-testid="input-interview-end"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-surface-dark"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Duration (Minutes)
              </label>
              <input
                type="number"
                min={5}
                max={240}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-surface-dark"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Passing Score (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={passingPercentage}
                onChange={(e) => setPassingPercentage(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-surface-dark"
              />
            </div>

            {!editingId && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Initial Lifecycle State
                </label>
                <select
                  value={initialStatus}
                  onChange={(e) => setInitialStatus(e.target.value)}
                  data-testid="select-interview-initial-status"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-surface-dark"
                >
                  <option value="ready">Ready (Student can join immediately)</option>
                  <option value="scheduled">Scheduled (Requires start time)</option>
                  <option value="draft">Draft (Hidden from student)</option>
                </select>
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Instructions for Student
              </label>
              <textarea
                rows={2}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Outline topics covered, expectations, and camera rules..."
                data-testid="input-interview-instructions"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-surface-dark"
              />
            </div>
          </div>

          {/* Questions Builder (Question Bank + Custom) */}
          <div className="space-y-3 rounded-2xl border border-surface-light-border dark:border-surface-dark-border p-4 bg-slate-50/50 dark:bg-surface-dark-muted/30">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-brand-primary" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Interview Questions ({questions.length})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={Database}
                  onClick={() => setIsBankPickerOpen(true)}
                  data-testid="btn-pick-from-bank"
                >
                  Pick from Question Bank
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={Plus}
                  onClick={() =>
                    setQuestions((prev) => [
                      ...prev,
                      { sourceType: 'custom', questionText: '', topic: 'General', maxMarks: 10, rubricNotes: '' },
                    ])
                  }
                  data-testid="btn-add-custom-question"
                >
                  Add Custom Question
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {questions.map((q, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      Q{idx + 1} ({q.sourceType === 'bank' ? 'Question Bank' : 'Custom'})
                    </span>
                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-rose-500 hover:text-rose-700 p-1"
                        title="Remove question"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={2}
                    value={q.questionText}
                    onChange={(e) => {
                      const val = e.target.value;
                      setQuestions((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, questionText: val } : item))
                      );
                    }}
                    placeholder="Enter interview question prompt..."
                    data-testid={`input-interview-question-${idx}`}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-surface-dark"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={q.topic}
                      onChange={(e) => {
                        const val = e.target.value;
                        setQuestions((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, topic: val } : item))
                        );
                      }}
                      placeholder="Topic (e.g. Trees)"
                      className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-surface-dark"
                    />
                    <input
                      type="number"
                      min={1}
                      value={q.maxMarks}
                      onChange={(e) => {
                        const val = e.target.value;
                        setQuestions((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, maxMarks: val } : item))
                        );
                      }}
                      placeholder="Max Marks"
                      className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-surface-dark"
                    />
                    <input
                      type="text"
                      value={q.rubricNotes}
                      onChange={(e) => {
                        const val = e.target.value;
                        setQuestions((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, rubricNotes: val } : item))
                        );
                      }}
                      placeholder="Expected key points (faculty rubric)"
                      className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-surface-dark"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Proctoring Configuration */}
          <CameraProctoringPanel
            config={proctoringConfig}
            onChange={setProctoringConfig}
            title="Interview Camera & Proctoring Policy"
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsEditorOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={saving}
              data-testid="btn-save-interview"
            >
              {editingId ? 'Save Changes' : 'Create Interview'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reschedule Modal */}
      <Modal
        isOpen={Boolean(rescheduleTarget)}
        onClose={() => setRescheduleTarget(null)}
        title="Reschedule Interview"
        size="sm"
      >
        <form onSubmit={handleRescheduleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1">New Start Date & Time *</label>
            <input
              type="datetime-local"
              required
              value={rescheduleStart}
              onChange={(e) => setRescheduleStart(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-surface-dark"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">New End Date & Time</label>
            <input
              type="datetime-local"
              value={rescheduleEnd}
              onChange={(e) => setRescheduleEnd(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-surface-dark"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setRescheduleTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Update Schedule
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reuse Existing Question Bank Picker Modal */}
      <QuestionBankPickerModal
        isOpen={isBankPickerOpen}
        onClose={() => setIsBankPickerOpen(false)}
        onSelectQuestions={handleBankSelect}
        existingQuestions={questions}
      />
    </div>
  );
}
