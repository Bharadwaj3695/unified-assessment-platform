import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import questionBankService from '../../services/questionBank.service';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import {
  Database,
  PlusCircle,
  UploadCloud,
  Search,
  Filter,
  Trash2,
  Edit,
  Eye,
  History,
  Layers,
  Sparkles,
  Tag,
  CheckCircle,
  FileText,
} from 'lucide-react';

const QuestionBankList = () => {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [selectedBloom, setSelectedBloom] = useState('All');
  const [selectedType, setSelectedType] = useState('All');

  // Modals
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, question: null, isDeleting: false });
  const [detailModal, setDetailModal] = useState({ isOpen: false, question: null, versions: [], isLoadingDetail: false });

  const loadCategories = async () => {
    try {
      const res = await questionBankService.getCategories();
      if (res.success && Array.isArray(res.data)) {
        setCategories(res.data);
      }
    } catch {
      // ignore
    }
  };

  const loadQuestions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = {};
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (selectedCategory !== 'All') params.category = selectedCategory;
      if (selectedDifficulty !== 'All') params.difficulty = selectedDifficulty;
      if (selectedBloom !== 'All') params.bloomLevel = selectedBloom;
      if (selectedType !== 'All') params.type = selectedType;

      const res = await questionBankService.getQuestions(params);
      const list = res.data || res.questions || [];
      setQuestions(list);
    } catch (err) {
      setError(err.message || 'Failed to retrieve questions.');
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, selectedCategory, selectedDifficulty, selectedBloom, selectedType]);

  useEffect(() => {
    loadCategories();
    loadQuestions();
  }, [loadQuestions]);

  const handleDelete = async () => {
    if (!deleteModal.question) return;
    try {
      setDeleteModal((prev) => ({ ...prev, isDeleting: true }));
      await questionBankService.deleteQuestion(deleteModal.question._id);
      toast.success('Question deleted from Question Bank.');
      setDeleteModal({ isOpen: false, question: null, isDeleting: false });
      loadQuestions();
    } catch (err) {
      toast.error(err.message || 'Failed to delete question.');
      setDeleteModal((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  const handleOpenDetail = async (q) => {
    setDetailModal({ isOpen: true, question: q, versions: [], isLoadingDetail: true });
    try {
      const res = await questionBankService.getQuestionById(q._id);
      if (res.success && res.data) {
        setDetailModal({
          isOpen: true,
          question: res.data.question || res.data,
          versions: res.data.versions || [],
          isLoadingDetail: false,
        });
      }
    } catch {
      setDetailModal((prev) => ({ ...prev, isLoadingDetail: false }));
    }
  };

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

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Banner & Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-7 h-7 text-primary-600" />
            Question Bank
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Centralized reusable repository with version control, Bloom taxonomy, and duplicate detection.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => navigate('/instructor/question-import')}
            className="flex items-center gap-2"
          >
            <UploadCloud className="w-4 h-4 text-primary-600" />
            Import Questions
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate('/instructor/question-bank/create')}
            className="flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            Create Question
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by question text, tags, or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-slate-500 font-medium mb-1">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded bg-white text-slate-700"
              >
                <option value="All">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-500 font-medium mb-1">Question Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded bg-white text-slate-700"
              >
                <option value="All">All Types</option>
                <option value="mcq">MCQ</option>
                <option value="short_answer">Short Answer</option>
                <option value="long_answer">Long Answer</option>
                <option value="file_upload">File Upload</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-500 font-medium mb-1">Bloom Taxonomy</label>
              <select
                value={selectedBloom}
                onChange={(e) => setSelectedBloom(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded bg-white text-slate-700"
              >
                <option value="All">All Levels</option>
                <option value="REMEMBER">REMEMBER</option>
                <option value="UNDERSTAND">UNDERSTAND</option>
                <option value="APPLY">APPLY</option>
                <option value="ANALYZE">ANALYZE</option>
                <option value="EVALUATE">EVALUATE</option>
                <option value="CREATE">CREATE</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-500 font-medium mb-1">Difficulty</label>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded bg-white text-slate-700"
              >
                <option value="All">All Difficulties</option>
                <option value="EASY">EASY</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HARD">HARD</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Questions Listing */}
      {isLoading ? (
        <div className="py-20 flex justify-center">
          <Spinner />
        </div>
      ) : error ? (
        <Card className="p-8 text-center text-red-600 bg-red-50">
          <p>{error}</p>
        </Card>
      ) : questions.length === 0 ? (
        <EmptyState
          title="Question Bank is Empty"
          description="You have not created any questions yet. Add questions manually or import them from PDF, DOCX, or Google Forms."
          actionText="Create Question"
          onAction={() => navigate('/instructor/question-bank/create')}
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1 font-medium">
            <span>Showing {questions.length} question{questions.length === 1 ? '' : 's'}</span>
          </div>

          {questions.map((q) => (
            <Card key={q._id} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase tracking-wide">
                      {q.type?.replace('_', ' ')}
                    </span>
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${getBloomBadgeColor(q.bloomLevel)}`}>
                      {q.bloomLevel}
                    </span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      {q.difficulty}
                    </span>
                    <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      {q.points} pts
                    </span>
                    <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-mono font-medium border border-indigo-200">
                      v{q.version || 1}
                    </span>
                    <span className="text-xs font-medium text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                      {q.category}
                    </span>
                    {q.source && q.source !== 'MANUAL' && (
                      <span className="text-xs bg-sky-50 text-sky-700 px-2 py-0.5 rounded font-medium border border-sky-200 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        {q.source}
                      </span>
                    )}
                  </div>

                  <p className="text-base font-semibold text-slate-900 leading-snug">
                    {q.questionText}
                  </p>

                  {/* MCQ Options preview */}
                  {q.type === 'mcq' && Array.isArray(q.options) && q.options.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                      {q.options.slice(0, 4).map((opt) => (
                        <div
                          key={opt.id}
                          className={`text-xs p-1.5 rounded flex items-center gap-1.5 ${
                            opt.id === q.correctAnswer
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium'
                              : 'bg-slate-50 text-slate-600'
                          }`}
                        >
                          <span className="font-bold uppercase">{opt.id}.</span>
                          <span className="truncate">{opt.text}</span>
                          {opt.id === q.correctAnswer && (
                            <CheckCircle className="w-3 h-3 text-emerald-600 ml-auto flex-shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tags */}
                  {Array.isArray(q.tags) && q.tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {q.tags.map((tag, idx) => (
                        <span key={idx} className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded flex items-center gap-1">
                          <Tag className="w-2.5 h-2.5 text-slate-400" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="flex items-center md:flex-col gap-2 flex-shrink-0 self-end md:self-start">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenDetail(q)}
                    className="flex items-center gap-1 text-slate-700"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Details
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/instructor/question-bank/edit/${q._id}`)}
                    className="flex items-center gap-1 text-indigo-700 hover:bg-indigo-50"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteModal({ isOpen: true, question: q, isDeleting: false })}
                    className="flex items-center gap-1 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, question: null, isDeleting: false })}
        title="Delete Question from Bank"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete this question? Existing completed assessments and submissions that used this question version will remain safely preserved and unchanged.
          </p>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-sm text-slate-800 font-medium">
            "{deleteModal.question?.questionText}"
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeleteModal({ isOpen: false, question: null, isDeleting: false })}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDelete}
              disabled={deleteModal.isDeleting}
            >
              {deleteModal.isDeleting ? 'Deleting...' : 'Delete Question'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Question Details & Version History Modal */}
      <Modal
        isOpen={detailModal.isOpen}
        onClose={() => setDetailModal({ isOpen: false, question: null, versions: [], isLoadingDetail: false })}
        title="Question Details & Version History"
        size="lg"
      >
        {detailModal.isLoadingDetail ? (
          <div className="py-12 flex justify-center">
            <Spinner />
          </div>
        ) : detailModal.question ? (
          <div className="space-y-4 text-sm">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Question Prompt</span>
              <p className="font-semibold text-slate-900 text-base mt-1">
                {detailModal.question.questionText}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <span className="text-xs text-slate-500">Category</span>
                <p className="font-medium text-slate-800">{detailModal.question.category}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Points</span>
                <p className="font-medium text-slate-800">{detailModal.question.points} pts</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Bloom Level</span>
                <p className="font-medium text-slate-800">{detailModal.question.bloomLevel}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Difficulty</span>
                <p className="font-medium text-slate-800">{detailModal.question.difficulty}</p>
              </div>
            </div>

            {/* MCQ Options Detail */}
            {detailModal.question.type === 'mcq' && (
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Options</span>
                <div className="mt-2 space-y-1.5">
                  {detailModal.question.options?.map((opt) => (
                    <div
                      key={opt.id}
                      className={`p-2 rounded border flex items-center justify-between text-xs ${
                        opt.id === detailModal.question.correctAnswer
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <span><b className="uppercase mr-1">{opt.id}.</b> {opt.text}</span>
                      {opt.id === detailModal.question.correctAnswer && (
                        <span className="text-[11px] bg-emerald-600 text-white px-2 py-0.5 rounded font-medium">
                          Correct Answer
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Explanation / Rubric Notes */}
            {detailModal.question.explanation && (
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Explanation / Rubric</span>
                <p className="mt-1 text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200">
                  {detailModal.question.explanation}
                </p>
              </div>
            )}

            {/* Version History Table */}
            {detailModal.versions && detailModal.versions.length > 0 && (
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-indigo-600" />
                  Version History ({detailModal.versions.length} versions)
                </span>
                <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="p-2 font-medium">Version</th>
                        <th className="p-2 font-medium">Prompt Preview</th>
                        <th className="p-2 font-medium">Points</th>
                        <th className="p-2 font-medium">State</th>
                        <th className="p-2 font-medium">Updated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {detailModal.versions.map((ver) => (
                        <tr key={ver._id} className={ver.isLatest ? 'bg-indigo-50/40' : 'bg-white'}>
                          <td className="p-2 font-bold font-mono">v{ver.version}</td>
                          <td className="p-2 max-w-xs truncate text-slate-800">{ver.questionText}</td>
                          <td className="p-2 font-medium">{ver.points} pts</td>
                          <td className="p-2">
                            {ver.isLatest ? (
                              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                                ACTIVE LATEST
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                HISTORICAL
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-slate-500">
                            {new Date(ver.updatedAt || ver.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <Button
                variant="outline"
                onClick={() => setDetailModal({ isOpen: false, question: null, versions: [], isLoadingDetail: false })}
              >
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default QuestionBankList;
