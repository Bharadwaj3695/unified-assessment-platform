import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import questionImportService from '../../services/questionImport.service';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Edit,
  ArrowLeft,
  Sparkles,
  Database,
  CheckSquare,
  Square,
  Check,
  X,
  FileText,
  HelpCircle,
} from 'lucide-react';

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

  // Edit & Accept Modal state
  const [editModal, setEditModal] = useState({
    isOpen: false,
    question: null,
    formData: null,
    isSubmitting: false,
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
      case 'CREATE': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'EVALUATE': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'ANALYZE': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'APPLY': return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'UNDERSTAND': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'REMEMBER':
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 flex justify-center">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="p-8 text-center text-red-600 bg-red-50">
          <p>{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/instructor/question-import')}>
            Back to Imports
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            to="/instructor/question-import"
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              Review Imported Questions
            </h1>
            <p className="text-xs text-slate-500">
              Mandatory Review Gate: Accepted questions are immediately saved to your Question Bank.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => navigate('/instructor/question-bank')}
            className="flex items-center gap-2 text-xs"
          >
            <Database className="w-4 h-4 text-primary-600" />
            Go to Question Bank
          </Button>
        </div>
      </div>

      {/* KPI Review Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-slate-400">
          <div className="text-xs font-medium text-slate-500">Total Detected</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{questions.length}</div>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-500">
          <div className="text-xs font-medium text-amber-700">Pending Review</div>
          <div className="text-2xl font-bold text-amber-900 mt-1">{pendingQuestions.length}</div>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500">
          <div className="text-xs font-medium text-emerald-700">Accepted into Bank</div>
          <div className="text-2xl font-bold text-emerald-900 mt-1">
            {questions.filter((q) => q.reviewStatus === 'ACCEPTED').length}
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-red-500">
          <div className="text-xs font-medium text-red-700">Rejected</div>
          <div className="text-2xl font-bold text-red-900 mt-1">
            {questions.filter((q) => q.reviewStatus === 'REJECTED').length}
          </div>
        </Card>
      </div>

      {/* Filter and Bulk Action Bar */}
      <Card className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Filter Buttons */}
        <div className="flex items-center space-x-2 text-xs">
          {['ALL', 'PENDING', 'ACCEPTED', 'REJECTED'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterState(st)}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                filterState === st
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st} ({questions.filter((q) => (st === 'ALL' ? true : q.reviewStatus === st)).length})
            </button>
          ))}
        </div>

        {/* Bulk Actions */}
        {pendingQuestions.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAllPending}
              className="flex items-center gap-1.5 text-xs text-slate-600 font-medium hover:text-slate-900"
            >
              {selectedCount > 0 && selectedCount === pendingQuestions.length ? (
                <CheckSquare className="w-4 h-4 text-primary-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>Select Pending ({pendingQuestions.length})</span>
            </button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkReview('REJECT')}
              disabled={selectedCount === 0 || isBulkActioning}
              className="text-red-600 border-red-200 hover:bg-red-50 text-xs flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              Reject ({selectedCount})
            </Button>

            <Button
              size="sm"
              variant="primary"
              onClick={() => handleBulkReview('ACCEPT')}
              disabled={selectedCount === 0 || isBulkActioning}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              Accept ({selectedCount})
            </Button>
          </div>
        )}
      </Card>

      {/* Extracted Questions List */}
      <div className="space-y-4">
        {filteredQuestions.length === 0 ? (
          <EmptyState
            title="No questions in this filter"
            description="Switch filter tab above to view all or pending questions."
          />
        ) : (
          filteredQuestions.map((q, idx) => {
            const isSelected = Boolean(selectedMap[q.tempId]);
            const isPending = q.reviewStatus === 'PENDING';

            return (
              <Card
                key={q.tempId}
                className={`p-5 transition-all ${
                  isSelected ? 'border-primary-500 bg-primary-50/20 shadow-sm' : ''
                } ${q.reviewStatus === 'ACCEPTED' ? 'border-emerald-200 bg-emerald-50/20' : ''} ${
                  q.reviewStatus === 'REJECTED' ? 'opacity-60 bg-slate-50' : ''
                }`}
              >
                <div className="flex items-start gap-3.5">
                  {/* Selection Checkbox */}
                  {isPending && (
                    <div
                      onClick={() => toggleSelect(q.tempId)}
                      className="mt-1 cursor-pointer"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-primary-600" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-300 hover:text-slate-500" />
                      )}
                    </div>
                  )}

                  <div className="flex-1 space-y-3">
                    {/* Top Badges & AI Classification Suggestions */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 uppercase">
                        Q{idx + 1} • {q.type?.replace('_', ' ')}
                      </span>

                      {/* AI Bloom level suggestion */}
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${getBloomBadgeColor(q.bloomLevel)} flex items-center gap-1`}>
                        <Sparkles className="w-3 h-3" />
                        {q.bloomLevel}
                      </span>

                      {/* AI Difficulty suggestion */}
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                        {q.difficulty}
                      </span>

                      <span className="text-xs text-slate-600 font-semibold bg-slate-100 px-2 py-0.5 rounded">
                        {q.points} pts
                      </span>

                      {/* AI Confidence */}
                      {q.confidence !== null && q.confidence !== undefined && (
                        <span className="text-[11px] text-slate-500 font-medium">
                          Confidence: <b className="text-slate-800">{q.confidence}%</b>
                        </span>
                      )}

                      {/* Review State Badge */}
                      <span className="ml-auto">
                        {q.reviewStatus === 'ACCEPTED' && (
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" />
                            ACCEPTED
                          </span>
                        )}
                        {q.reviewStatus === 'REJECTED' && (
                          <span className="text-xs font-bold text-red-700 bg-red-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" />
                            REJECTED
                          </span>
                        )}
                        {q.reviewStatus === 'PENDING' && (
                          <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
                            PENDING REVIEW
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Duplicate Warning */}
                    {q.isDuplicate && (
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-md flex items-center gap-2 text-xs text-amber-800">
                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <span>
                          <b>Duplicate Notice:</b> A matching question was detected in your Question Bank. You can review or edit before deciding.
                        </span>
                      </div>
                    )}

                    {/* Unsupported Structure Warning */}
                    {q.isUnsupported && (
                      <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-md flex items-center gap-2 text-xs text-sky-800">
                        <HelpCircle className="w-4 h-4 text-sky-600 flex-shrink-0" />
                        <span>
                          <b>Format Notice:</b> {q.unsupportedReason || 'Non-standard form structure parsed. Please verify options and type.'}
                        </span>
                      </div>
                    )}

                    {/* Question Prompt */}
                    <p className="text-sm font-semibold text-slate-900 leading-snug">
                      {q.questionText}
                    </p>

                    {/* MCQ Options Display */}
                    {q.type === 'mcq' && Array.isArray(q.options) && q.options.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {q.options.map((opt) => (
                          <div
                            key={opt.id}
                            className={`p-2 rounded border text-xs flex items-center justify-between ${
                              opt.id === q.correctAnswer
                                ? 'bg-emerald-50 border-emerald-300 font-semibold text-emerald-900'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            <span>
                              <b className="uppercase mr-1">{opt.id}.</b> {opt.text}
                            </span>
                            {opt.id === q.correctAnswer && (
                              <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded">
                                Parsed Answer
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Explanation */}
                    {q.explanation && (
                      <p className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded border border-slate-200">
                        Note: {q.explanation}
                      </p>
                    )}

                    {/* Per-Question Actions */}
                    {isPending && (
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSingleReview(q.tempId, 'REJECT')}
                          className="text-xs text-red-600 border-red-200 hover:bg-red-50 flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEdit(q)}
                          className="text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50 flex items-center gap-1"
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
              <label className="block font-semibold text-slate-800 mb-1">Question Prompt</label>
              <textarea
                rows={3}
                value={editModal.formData.questionText}
                onChange={(e) =>
                  setEditModal({
                    ...editModal,
                    formData: { ...editModal.formData, questionText: e.target.value },
                  })
                }
                className="w-full p-2.5 border border-slate-300 rounded-md text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Type</label>
                <select
                  value={editModal.formData.type}
                  onChange={(e) =>
                    setEditModal({
                      ...editModal,
                      formData: { ...editModal.formData, type: e.target.value },
                    })
                  }
                  className="w-full p-2 border border-slate-300 rounded-md bg-white"
                >
                  <option value="mcq">MCQ</option>
                  <option value="short_answer">Short Answer</option>
                  <option value="long_answer">Long Answer</option>
                  <option value="file_upload">File Upload</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Bloom Level</label>
                <select
                  value={editModal.formData.bloomLevel}
                  onChange={(e) =>
                    setEditModal({
                      ...editModal,
                      formData: { ...editModal.formData, bloomLevel: e.target.value },
                    })
                  }
                  className="w-full p-2 border border-slate-300 rounded-md bg-white"
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
                <label className="block font-semibold text-slate-700 mb-1">Difficulty</label>
                <select
                  value={editModal.formData.difficulty}
                  onChange={(e) =>
                    setEditModal({
                      ...editModal,
                      formData: { ...editModal.formData, difficulty: e.target.value },
                    })
                  }
                  className="w-full p-2 border border-slate-300 rounded-md bg-white"
                >
                  <option value="EASY">EASY</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HARD">HARD</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Points</label>
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
                  className="w-full p-2 border border-slate-300 rounded-md"
                />
              </div>
            </div>

            {editModal.formData.type === 'mcq' && (
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <label className="block font-semibold text-slate-800">Options & Correct Answer</label>
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
                    <span className="font-bold uppercase w-4">{opt.id}.</span>
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
                      className="flex-1 p-2 border border-slate-300 rounded-md"
                    />
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Category</label>
              <input
                type="text"
                value={editModal.formData.category}
                onChange={(e) =>
                  setEditModal({
                    ...editModal,
                    formData: { ...editModal.formData, category: e.target.value },
                  })
                }
                className="w-full p-2 border border-slate-300 rounded-md"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditModal({ isOpen: false, question: null, formData: null, isSubmitting: false })}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
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
