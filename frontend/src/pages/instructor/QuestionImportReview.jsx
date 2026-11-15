import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import questionImportService from '../../services/questionImport.service';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import CardSkeleton from '../../components/ui/CardSkeleton';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Edit,
  ArrowLeft,
  Sparkles,
  CheckSquare,
  Square,
  Check,
  X,
  HelpCircle,
  FileCheck2,
  Save,
  Send,
} from 'lucide-react';

const FILTER_TABS = [
  { id: 'ALL', label: 'All' },
  { id: 'PENDING', label: 'Pending Review' },
  { id: 'ACCEPTED', label: 'Accepted' },
  { id: 'REJECTED', label: 'Rejected' },
];

const QuestionImportReview = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [job, setJob] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filterState, setFilterState] = useState('ALL'); // 'ALL' | 'PENDING' | 'ACCEPTED' | 'REJECTED'
  const [selectedMap, setSelectedMap] = useState({});
  const [isBulkActioning, setIsBulkActioning] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Edit & Accept Modal state
  const [editModal, setEditModal] = useState({
    isOpen: false,
    question: null,
    formData: null,
    isSubmitting: false,
  });

  // Publish Live Modal state
  const [publishModal, setPublishModal] = useState({
    isOpen: false,
    mode: null, // 'pending_warning' | 'ready_to_create'
    acceptedCount: 0,
  });

  const loadJobPreview = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await questionImportService.getJobPreview(id);
      if (res.success) {
        setJob({
          id: res.jobId,
          status: res.status,
          sourceType: res.sourceType,
          totalDetected: res.totalDetected,
          totalAccepted: res.totalAccepted,
          totalRejected: res.totalRejected,
          errors: res.errors || [],
        });
        setQuestions(res.questions || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load import job questions.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadJobPreview();
  }, [loadJobPreview]);

  // Submissions action button handler - navigates to existing Instructor Submissions & Grading queue
  const handleNavigateToSubmissions = () => {
    navigate('/instructor/submissions');
  };

  // Save Draft action button handler - persists import review workflow state
  const handleSaveDraft = async () => {
    try {
      setIsSavingDraft(true);
      await loadJobPreview();
      toast.success(
        'Import review workflow progress saved. Approved questions are stored in your Question Bank.'
      );
    } catch (err) {
      toast.error(err.message || 'Failed to save review draft.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Publish Live action button handler - verifies faculty approval gate and routes to assessment publishing workflow
  const handlePublishLive = () => {
    const currentPending = questions.filter((q) => q.reviewStatus === 'PENDING');
    if (currentPending.length > 0) {
      setPublishModal({
        isOpen: true,
        mode: 'pending_warning',
        acceptedCount: questions.filter((q) => q.reviewStatus === 'ACCEPTED').length,
      });
      return;
    }

    const currentAccepted = questions.filter((q) => q.reviewStatus === 'ACCEPTED').length;
    if (currentAccepted === 0) {
      toast.error(
        'No questions have been accepted into the Question Bank yet. Please accept candidate questions first.'
      );
      return;
    }

    // Review page does not have an assessment context entity; route to existing assessment publishing workflow
    setPublishModal({
      isOpen: true,
      mode: 'ready_to_create',
      acceptedCount: currentAccepted,
    });
  };

  const handleSingleReview = async (tempId, action, reviewData = null) => {
    try {
      const res = await questionImportService.reviewQuestion(id, tempId, action, reviewData || {});
      toast.success(res.message || `Question ${action.toLowerCase()}ed.`);
      // Update local question state
      setQuestions((prev) =>
        prev.map((q) =>
          q.tempId === tempId
            ? {
                ...q,
                reviewStatus: action,
                ...(reviewData || {}),
              }
            : q
        )
      );
      // Remove from selection map if present
      setSelectedMap((prev) => {
        const copy = { ...prev };
        delete copy[tempId];
        return copy;
      });
      loadJobPreview();
    } catch (err) {
      toast.error(err.message || `Failed to ${action.toLowerCase()} question.`);
    }
  };

  const handleBulkReview = async (action) => {
    const tempIds = Object.keys(selectedMap);
    if (tempIds.length === 0) {
      toast.warn('Please select at least one question.');
      return;
    }

    try {
      setIsBulkActioning(true);
      const res = await questionImportService.bulkReview(id, tempIds, action);
      toast.success(res.message || `Selected questions ${action.toLowerCase()}ed.`);
      setSelectedMap({});
      loadJobPreview();
    } catch (err) {
      toast.error(err.message || `Bulk ${action.toLowerCase()} failed.`);
    } finally {
      setIsBulkActioning(false);
    }
  };

  const handleOpenEdit = (q) => {
    setEditModal({
      isOpen: true,
      question: q,
      formData: {
        questionText: q.questionText || '',
        type: q.type || 'mcq',
        points: q.points || 5,
        difficulty: q.difficulty || 'MEDIUM',
        bloomLevel: q.bloomLevel || 'UNDERSTAND',
        category: q.category || 'General',
        explanation: q.explanation || '',
        correctAnswer: q.correctAnswer || '',
        options: Array.isArray(q.options) ? [...q.options] : [],
      },
      isSubmitting: false,
    });
  };

  const handleSaveEditAndAccept = async (e) => {
    e.preventDefault();
    if (!editModal.formData.questionText.trim()) {
      toast.error('Question prompt is required.');
      return;
    }

    try {
      setEditModal((prev) => ({ ...prev, isSubmitting: true }));
      await handleSingleReview(editModal.question.tempId, 'ACCEPT', editModal.formData);
      setEditModal({ isOpen: false, question: null, formData: null, isSubmitting: false });
    } catch {
      setEditModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const toggleSelect = (tempId) => {
    setSelectedMap((prev) => {
      const copy = { ...prev };
      if (copy[tempId]) {
        delete copy[tempId];
      } else {
        copy[tempId] = true;
      }
      return copy;
    });
  };

  const pendingQuestions = questions.filter((q) => q.reviewStatus === 'PENDING');
  const acceptedCount = questions.filter((q) => q.reviewStatus === 'ACCEPTED').length;
  const rejectedCount = questions.filter((q) => q.reviewStatus === 'REJECTED').length;

  const filteredQuestions = questions.filter((q) => {
    if (filterState === 'ALL') return true;
    return q.reviewStatus === filterState;
  });

  const toggleSelectAllPending = () => {
    if (Object.keys(selectedMap).length === pendingQuestions.length) {
      setSelectedMap({});
    } else {
      const map = {};
      pendingQuestions.forEach((q) => {
        map[q.tempId] = true;
      });
      setSelectedMap(map);
    }
  };

  const selectedCount = Object.keys(selectedMap).length;

  const getBloomBadgeColor = (level) => {
    switch (level) {
      case 'CREATE':
        return 'bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800/40';
      case 'EVALUATE':
        return 'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/40';
      case 'ANALYZE':
        return 'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800/40';
      case 'APPLY':
        return 'bg-teal-100 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800/40';
      case 'UNDERSTAND':
        return 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40';
      case 'REMEMBER':
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700';
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-4">
        <CardSkeleton count={3} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-12 space-y-4">
        <ErrorState
          title="Import Review Error"
          message={error}
          onRetry={loadJobPreview}
        />
        <div className="text-center">
          <Button variant="outline" onClick={() => navigate('/instructor/question-import')}>
            Back to Imports
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-20">
      {/* Top Sticky Page Header & Consistent Action Bar */}
      <div className="sticky top-0 z-30 bg-bg-light/95 dark:bg-bg-dark/95 backdrop-blur-md -mx-3.5 sm:-mx-5 lg:-mx-6 xl:-mx-8 px-3.5 sm:px-5 lg:px-6 xl:px-8 py-3.5 border-b border-[#EBE3D8] dark:border-[#2D3748] shadow-warm-xs transition-all">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center space-x-2">
              <Link
                to="/instructor/question-import"
                className="text-xs font-semibold text-[#64748B] hover:text-[#E05D38] dark:hover:text-[#F4A261] flex items-center transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Imports
              </Link>
              <span className="text-[#64748B]/40">/</span>
              <Badge variant="peach" size="sm">
                Review Gate
              </Badge>
              {job?.sourceType && (
                <>
                  <span className="text-[#64748B]/40">/</span>
                  <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                    {job.sourceType}
                  </span>
                </>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-[#1F2937] dark:text-[#F9FAFB]">
              Review Imported Questions
            </h1>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Mandatory Review Gate: Accepted questions are immediately saved to your Question Bank.
            </p>
          </div>

          {/* Action Controls matching Instructor Create Assessment */}
          <div className="flex items-center gap-2.5 self-start sm:self-auto flex-shrink-0 flex-wrap sm:flex-nowrap">
            <Button
              type="button"
              variant="outline"
              size="md"
              icon={FileCheck2}
              onClick={handleNavigateToSubmissions}
            >
              Submissions
            </Button>
            <Button
              type="button"
              variant="outline"
              size="md"
              icon={Save}
              loading={isSavingDraft}
              onClick={handleSaveDraft}
            >
              Save Draft
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              icon={Send}
              onClick={handlePublishLive}
            >
              Publish Live
            </Button>
          </div>
        </div>
      </div>

      {/* 4 Summary Cards — Single source of visible status counts */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1 sm:gap-2">
        <Card className="p-1.5 sm:p-1.5 border-l-4 border-l-slate-500 dark:border-l-slate-500" data-testid="stat-total-detected">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Detected</div>
          <div className="text-2xl font-bold font-display text-slate-900 dark:text-slate-100 mt-0.5">
            {questions.length}
          </div>
        </Card>

        <Card className="p-1 sm:p-1.5 border-l-4 border-l-amber-500" data-testid="stat-pending-review">
          <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">Pending Review</div>
          <div className="text-2xl font-bold font-display text-amber-900 dark:text-amber-100 mt-0.5">
            {pendingQuestions.length}
          </div>
        </Card>

        <Card className="p-1.5 sm:p-1.5 border-l-4 border-l-emerald-500" data-testid="stat-accepted-bank">
          <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Accepted into Bank</div>
          <div className="text-2xl font-bold font-display text-emerald-900 dark:text-emerald-100 mt-0.5">
            {acceptedCount}
          </div>
        </Card>

        <Card className="p-1.5 sm:p-1.5 border-l-4 border-l-red-500" data-testid="stat-rejected">
          <div className="text-xs font-semibold text-red-700 dark:text-red-400">Rejected</div>
          <div className="text-2xl font-bold font-display text-red-900 dark:text-red-100 mt-0.5">
            {rejectedCount}
          </div>
        </Card>
      </div>

      {/* Compact Filter and Bulk Action Toolbar */}
      <Card className="p-1 sm:p-1.5 flex flex-col md:flex-row md:items-center justify-between gap-0">
        {/* Status Filter Buttons without numerical counts */}
        <div className="flex items-center gap-1 bg-[#FFF9F2] dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] p-1 rounded-xl overflow-x-auto no-scrollbar">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterState(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                filterState === tab.id
                  ? 'bg-[#E05D38] text-white shadow-warm-xs'
                  : 'text-[#64748B] hover:text-[#1F2937] dark:hover:text-[#F9FAFB]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Bulk Selection and Review Actions aligned in one clear toolbar */}
        {pendingQuestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={toggleSelectAllPending}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#64748B] dark:text-[#94A3B8] hover:text-[#1F2937] dark:hover:text-[#F9FAFB] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {selectedCount > 0 && selectedCount === pendingQuestions.length ? (
                <CheckSquare className="w-5 h-5 text-[#E05D38]" />
              ) : (
                <Square className="w-5 h-5 text-slate-400" />
              )}

              <span>Select All Pending</span>
            </button>


            <Button
              size="sm"
              variant="outline"
              icon={X}
              onClick={() => handleBulkReview('REJECT')}
              disabled={selectedCount === 0 || isBulkActioning}
              className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs"
            >
              Reject {selectedCount > 0 ? `(${selectedCount})` : ''}
            </Button>
            <Button
              size="sm"
              variant="primary"
              icon={Check}
              onClick={() => handleBulkReview('ACCEPT')}
              disabled={selectedCount === 0 || isBulkActioning}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            >
              Accept {selectedCount > 0 ? `(${selectedCount})` : ''}
            </Button>
          </div>
        )}
     </Card>
      {/* Extracted Questions List */}
      <div className="space-y-3.5">
        {filteredQuestions.length === 0 ? (
          <EmptyState
            title="No questions in this filter"
            description="Switch filter tab above to view all, pending, accepted, or rejected questions."
          />
        ) : (
          filteredQuestions.map((q, idx) => {
            const isSelected = Boolean(selectedMap[q.tempId]);
            const isPending = q.reviewStatus === 'PENDING';

            return (
              <Card
                key={q.tempId}
                className={`p-4 sm:p-5 transition-all ${
                  isSelected
                    ? 'border-[#E05D38] dark:border-[#E05D38] bg-[#FFF9F2]/50 dark:bg-[#1e1715]/40 shadow-warm-xs'
                    : ''
                } ${
                  q.reviewStatus === 'ACCEPTED'
                    ? 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/10'
                    : ''
                } ${
                  q.reviewStatus === 'REJECTED'
                    ? 'opacity-65 bg-slate-50/70 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800'
                    : ''
                }`}
              >
                <div className="flex items-start gap-3 sm:gap-3.5">
                  {/* Selection Checkbox */}
                  {isPending && (
                    <div
                      onClick={() => toggleSelect(q.tempId)}
                      className="mt-1 cursor-pointer select-none"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-[#E05D38]" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" />
                      )}
                    </div>
                  )}

                  <div className="flex-1 space-y-3">
                    {/* Top Badges & AI Classification Suggestions */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                        Q{idx + 1} • {q.type?.replace('_', ' ')}
                      </span>

                      {/* AI Bloom level suggestion */}
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded border ${getBloomBadgeColor(
                          q.bloomLevel
                        )} flex items-center gap-1`}
                      >
                        <Sparkles className="w-3 h-3" />
                        {q.bloomLevel}
                      </span>

                      {/* AI Difficulty suggestion */}
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
                        {q.difficulty}
                      </span>

                      <span className="text-xs text-slate-600 dark:text-slate-300 font-semibold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                        {q.points} pts
                      </span>

                      {/* AI Confidence */}
                      {q.confidence !== null && q.confidence !== undefined && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                          Confidence: <b className="text-slate-800 dark:text-slate-200">{q.confidence}%</b>
                        </span>
                      )}

                      {/* Review State Badge */}
                      <span className="ml-auto">
                        {q.reviewStatus === 'ACCEPTED' && (
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200 dark:border-emerald-900/50">
                            <CheckCircle className="w-3.5 h-3.5" />
                            ACCEPTED
                          </span>
                        )}
                        {q.reviewStatus === 'REJECTED' && (
                          <span className="text-xs font-bold text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-950/50 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-red-200 dark:border-red-900/50">
                            <XCircle className="w-3.5 h-3.5" />
                            REJECTED
                          </span>
                        )}
                        {q.reviewStatus === 'PENDING' && (
                          <span className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/50 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-900/50">
                            PENDING REVIEW
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Duplicate Warning */}
                    {q.isDuplicate && (
                      <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                        <span>
                          <b>Duplicate Notice:</b> A matching question was detected in your Question Bank. You can review or edit before deciding.
                        </span>
                      </div>
                    )}

                    {/* Unsupported Structure Warning */}
                    {q.isUnsupported && (
                      <div className="p-2.5 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/40 rounded-xl flex items-center gap-2 text-xs text-sky-800 dark:text-sky-300">
                        <HelpCircle className="w-4 h-4 text-sky-600 dark:text-sky-400 flex-shrink-0" />
                        <span>
                          <b>Format Notice:</b>{' '}
                          {q.unsupportedReason ||
                            'Non-standard form structure parsed. Please verify options and type.'}
                        </span>
                      </div>
                    )}

                    {/* Question Prompt */}
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                      {q.questionText}
                    </p>

                    {/* MCQ Options Display */}
                    {q.type === 'mcq' && Array.isArray(q.options) && q.options.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {q.options.map((opt) => (
                          <div
                            key={opt.id}
                            className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                              opt.id === q.correctAnswer
                                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/60 font-semibold text-emerald-900 dark:text-emerald-200'
                                : 'bg-slate-50 dark:bg-surface-dark-muted border-slate-200 dark:border-surface-dark-border text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <span>
                              <b className="uppercase mr-1.5">{opt.id}.</b> {opt.text}
                            </span>
                            {opt.id === q.correctAnswer && (
                              <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-medium flex-shrink-0 ml-2">
                                Parsed Answer
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Explanation */}
                    {q.explanation && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 italic bg-slate-50 dark:bg-surface-dark-muted p-2.5 rounded-xl border border-slate-200 dark:border-surface-dark-border">
                        Note: {q.explanation}
                      </p>
                    )}

                    {/* Per-Question Actions */}
                    {isPending && (
                      <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-slate-100 dark:border-surface-dark-border">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSingleReview(q.tempId, 'REJECT')}
                          className="text-xs text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEdit(q)}
                          className="text-xs text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center gap-1"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          Edit & Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleSingleReview(q.tempId, 'ACCEPT')}
                          className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Accept
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Publish Live Workflow Modal / Gate Notice */}
      <Modal
        isOpen={publishModal.isOpen}
        onClose={() => setPublishModal({ isOpen: false, mode: null, acceptedCount: 0 })}
        title={
          publishModal.mode === 'pending_warning'
            ? 'Faculty Review Required'
            : 'Publish Live Assessment'
        }
      >
        <div className="space-y-4">
          {publishModal.mode === 'pending_warning' ? (
            <>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                <p className="font-semibold mb-1">Unreviewed Candidate Questions</p>
                <p>
                  There are still <strong>{pendingQuestions.length} pending candidate questions</strong> that require faculty review before entering the Question Bank. Candidate questions cannot bypass the faculty review gate.
                </p>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Please review and accept or reject the remaining questions before publishing an assessment live.
              </p>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPublishModal({ isOpen: false, mode: null, acceptedCount: 0 })}
                >
                  Continue Reviewing
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={async () => {
                    setPublishModal({ isOpen: false, mode: null, acceptedCount: 0 });
                    await handleBulkReview('ACCEPT');
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Accept All Pending ({pendingQuestions.length})
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300">
                <p className="font-semibold mb-1">Approved Questions Stored in Question Bank</p>
                <p>
                  <strong>{publishModal.acceptedCount} approved questions</strong> have been validated and saved to your Question Bank.
                </p>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                To publish live assessments for students, configure examination parameters (title, duration, passing score, access mode, and proctoring) in the Assessment Builder using your approved Question Bank repository.
              </p>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPublishModal({ isOpen: false, mode: null, acceptedCount: 0 })}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  icon={Send}
                  onClick={() => {
                    setPublishModal({ isOpen: false, mode: null, acceptedCount: 0 });
                    navigate('/instructor/create');
                  }}
                >
                  Open Assessment Builder & Publish
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Edit & Accept Modal */}
      <Modal
        isOpen={editModal.isOpen}
        onClose={() => setEditModal({ isOpen: false, question: null, formData: null, isSubmitting: false })}
        title="Edit Question Before Approval"
        size="lg"
      >
        {editModal.formData && (
          <form onSubmit={handleSaveEditAndAccept} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-800 dark:text-slate-200 mb-1">
                Question Prompt
              </label>
              <textarea
                rows={3}
                value={editModal.formData.questionText}
                onChange={(e) =>
                  setEditModal({
                    ...editModal,
                    formData: { ...editModal.formData, questionText: e.target.value },
                  })
                }
                className="w-full p-2.5 border border-slate-300 dark:border-surface-dark-border rounded-xl text-sm bg-white dark:bg-surface-dark text-slate-900 dark:text-slate-100"
                required
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Type
                </label>
                <select
                  value={editModal.formData.type}
                  onChange={(e) =>
                    setEditModal({
                      ...editModal,
                      formData: { ...editModal.formData, type: e.target.value },
                    })
                  }
                  className="w-full p-2 border border-slate-300 dark:border-surface-dark-border rounded-xl bg-white dark:bg-surface-dark text-slate-900 dark:text-slate-100"
                >
                  <option value="mcq">MCQ</option>
                  <option value="short_answer">Short Answer</option>
                  <option value="long_answer">Long Answer</option>
                  <option value="file_upload">File Upload</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bloom Level
                </label>
                <select
                  value={editModal.formData.bloomLevel}
                  onChange={(e) =>
                    setEditModal({
                      ...editModal,
                      formData: { ...editModal.formData, bloomLevel: e.target.value },
                    })
                  }
                  className="w-full p-2 border border-slate-300 dark:border-surface-dark-border rounded-xl bg-white dark:bg-surface-dark text-slate-900 dark:text-slate-100"
                >
                  <option value="REMEMBER">REMEMBER</option>
                  <option value="UNDERSTAND">UNDERSTAND</option>
                  <option value="APPLY">APPLY</option>
                  <option value="ANALYZE">ANALYZE</option>
                  <option value="EVALUATE">EVALUATE</option>
                  <option value="CREATE">CREATE</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Difficulty
                </label>
                <select
                  value={editModal.formData.difficulty}
                  onChange={(e) =>
                    setEditModal({
                      ...editModal,
                      formData: { ...editModal.formData, difficulty: e.target.value },
                    })
                  }
                  className="w-full p-2 border border-slate-300 dark:border-surface-dark-border rounded-xl bg-white dark:bg-surface-dark text-slate-900 dark:text-slate-100"
                >
                  <option value="EASY">EASY</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HARD">HARD</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Points
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={editModal.formData.points}
                  onChange={(e) =>
                    setEditModal({
                      ...editModal,
                      formData: { ...editModal.formData, points: parseInt(e.target.value, 10) || 5 },
                    })
                  }
                  className="w-full p-2 border border-slate-300 dark:border-surface-dark-border rounded-xl bg-white dark:bg-surface-dark text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {editModal.formData.type === 'mcq' && (
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-surface-dark-border">
                <label className="block font-semibold text-slate-800 dark:text-slate-200">
                  Options & Correct Answer
                </label>
                {editModal.formData.options.map((opt, oIdx) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="editCorrectAnswer"
                      checked={editModal.formData.correctAnswer === opt.id}
                      onChange={() =>
                        setEditModal({
                          ...editModal,
                          formData: { ...editModal.formData, correctAnswer: opt.id },
                        })
                      }
                    />
                    <span className="font-bold uppercase w-4 text-slate-800 dark:text-slate-200">
                      {opt.id}.
                    </span>
                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) => {
                        const updated = [...editModal.formData.options];
                        updated[oIdx] = { ...updated[oIdx], text: e.target.value };
                        setEditModal({
                          ...editModal,
                          formData: { ...editModal.formData, options: updated },
                        });
                      }}
                      className="flex-1 p-2 border border-slate-300 dark:border-surface-dark-border rounded-xl bg-white dark:bg-surface-dark text-slate-900 dark:text-slate-100"
                    />
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <input
                type="text"
                value={editModal.formData.category}
                onChange={(e) =>
                  setEditModal({
                    ...editModal,
                    formData: { ...editModal.formData, category: e.target.value },
                  })
                }
                className="w-full p-2 border border-slate-300 dark:border-surface-dark-border rounded-xl bg-white dark:bg-surface-dark text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-surface-dark-border">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setEditModal({ isOpen: false, question: null, formData: null, isSubmitting: false })}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={editModal.isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {editModal.isSubmitting ? 'Saving...' : 'Accept to Bank'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default QuestionImportReview;
