import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Sparkles,
  UploadCloud,
  Sliders,
  Search,
  CheckCircle2,
  Clock,
  Archive,
  Layers,
  Database,
  BookOpen,
  History,
  Eye,
  Edit,
  Send,
  MoreVertical,
  ChevronRight,
  Code2,
  Award,
  Copy,
  Trash2,
  X,
  FileText,
  CheckSquare,
} from 'lucide-react';
import { toast } from 'react-toastify';
import uapQuestionBankService from '../../services/uapQuestionBank.service';
import AiQuestionGeneratorModal from '../../components/instructor/AiQuestionGeneratorModal';
import BulkQuestionImportModal from '../../components/instructor/BulkQuestionImportModal';
import MockTestBlueprintModal from '../../components/instructor/MockTestBlueprintModal';
import QuestionVersionHistoryModal from '../../components/instructor/QuestionVersionHistoryModal';
import MockTestAttemptsModal from '../../components/instructor/MockTestAttemptsModal';

export default function QuestionBankHub() {
  const navigate = useNavigate();

  // Navigation tab: 'questions' or 'mockTests'
  const [activeTab, setActiveTab] = useState('questions');

  // Question list state
  const [questions, setQuestions] = useState([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [loadingQuestions, setLoadingQuestions] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedBank, setSelectedBank] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Auxiliary data
  const [subjects, setSubjects] = useState([]);
  const [questionBanks, setQuestionBanks] = useState([]);
  const [mockTests, setMockTests] = useState([]);
  const [submissionsModalTest, setSubmissionsModalTest] = useState(null);

  // Modals state
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isBlueprintModalOpen, setIsBlueprintModalOpen] = useState(false);
  const [historyModalQuestionId, setHistoryModalQuestionId] = useState(null);
  const [viewingQuestion, setViewingQuestion] = useState(null);

  // Load initial subjects and question banks metadata
  useEffect(() => {
    async function loadMetadata() {
      try {
        const [subsRes, banksRes] = await Promise.all([
          uapQuestionBankService.getSubjects(),
          uapQuestionBankService.getQuestionBanks(),
        ]);
        setSubjects(subsRes.data || []);
        setQuestionBanks(banksRes.data || []);
      } catch (_err) {
        // Fallback or silent catch
      }
    }
    loadMetadata();
  }, []);

  // Fetch Questions when filters change
  const fetchQuestions = async () => {
    try {
      setLoadingQuestions(true);
      const params = {};
      if (searchQuery) params.search = searchQuery;
      if (selectedSubject) params.subjectId = selectedSubject;
      if (selectedType) params.questionType = selectedType;
      if (selectedDifficulty) params.difficulty = selectedDifficulty;
      if (selectedStatus) params.status = selectedStatus;

      const res = await uapQuestionBankService.getQuestions(params);
      let questionList = Array.isArray(res) ? res : (res.data || res.questions || []);

      // Filter by Question Bank / Pool assignment if selected
      if (selectedBank) {
        const bankObj = questionBanks.find(
          (b) => (b._id || b.id) === selectedBank
        );
        if (bankObj && Array.isArray(bankObj.questionIds)) {
          const qIdSet = new Set(
            bankObj.questionIds.map((qid) => (qid._id || qid).toString())
          );
          questionList = questionList.filter((q) =>
            qIdSet.has((q.id || q._id).toString())
          );
        }
      }

      setQuestions(questionList);
      setTotalQuestions(res.pagination?.total || (Array.isArray(res) ? res.length : (res.data ? res.data.length : questionList.length)));
    } catch (err) {
      toast.error('Failed to load questions: ' + err.message);
    } finally {
      setLoadingQuestions(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'questions') {
      fetchQuestions();
    } else if (activeTab === 'mockTests') {
      uapQuestionBankService.getMockTests().then((res) => setMockTests(res.data || []));
    }
  }, [activeTab, selectedSubject, selectedBank, selectedType, selectedDifficulty, selectedStatus]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchQuestions();
  };

  const handlePublishQuestion = async (qId) => {
    try {
      await uapQuestionBankService.publishQuestion(qId);
      toast.success('Question published successfully! Version locked.');
      fetchQuestions();
    } catch (err) {
      toast.error('Publication failed: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleArchiveQuestion = async (qId) => {
    try {
      await uapQuestionBankService.archiveQuestion(qId);
      toast.info('Question moved to archived status.');
      fetchQuestions();
    } catch (err) {
      toast.error('Archive failed: ' + err.message);
    }
  };

  const handleDuplicateQuestion = async (q) => {
    try {
      const qStatement = q.statement || q.questionText || 'Question';
      const clonePayload = {
        statement: `${qStatement} (Copy)`,
        questionType: q.questionType || 'SINGLE_MCQ',
        difficulty: q.difficulty || 'MEDIUM',
        marks: Number(q.marks) || 1,
        negativeMarks: Number(q.negativeMarks) || 0,
        options: q.options || [],
        answerKey: q.answerKey,
        explanation: q.explanation || '',
        subjectId: q.subjectId?._id || q.subjectId || undefined,
        topicIds: q.topicIds || [],
        codingConfig: q.codingConfig,
        evaluationConfig: q.evaluationConfig,
      };
      await uapQuestionBankService.createQuestion(clonePayload);
      toast.success('Question duplicated successfully');
      fetchQuestions();
    } catch (err) {
      toast.error('Failed to duplicate question: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDeleteQuestion = async (qId) => {
    if (!window.confirm('Are you sure you want to delete / archive this question?')) return;
    try {
      await uapQuestionBankService.archiveQuestion(qId);
      toast.info('Question archived successfully.');
      fetchQuestions();
    } catch (err) {
      toast.error('Delete failed: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="space-y-5 pb-16">
      {/* Top Banner / Actions Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-warm-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="heading-question-bank">
            Question Bank
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Create, search, filter, and assemble reusable questions for examinations and assessments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAiModalOpen(true)}
            data-testid="btn-ai-generator"
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary dark:text-brand-peach border border-brand-primary/30 transition flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4 text-brand-primary dark:text-brand-peach" />
            AI Generator
          </button>

          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            data-testid="btn-bulk-import"
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition flex items-center gap-1.5"
          >
            <UploadCloud className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            Bulk Import
          </button>

          <button
            type="button"
            onClick={() => navigate('/instructor/question-studio')}
            data-testid="btn-create-question"
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-brand-primary text-white hover:bg-brand-primary-hover shadow-warm-xs transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Create Question
          </button>
        </div>
      </div>

      {/* Questions Section Header */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-bold font-display text-slate-900 dark:text-white">Questions</h2>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {totalQuestions} Items
          </span>
        </div>
      </div>

      {/* UNIFIED QUESTIONS VIEW */}
      {activeTab === 'questions' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-warm-xs flex flex-col md:flex-row items-center gap-2.5">
            <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search statement, code, or concept tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </form>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="p-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <option value="">All Subjects</option>
                {subjects.map((s) => (
                  <option key={s._id || s.id} value={s._id || s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              {/* Integrated Question Bank & Pool Filter */}
              <select
                value={selectedBank}
                onChange={(e) => setSelectedBank(e.target.value)}
                className="p-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <option value="">All Banks & Pools</option>
                {questionBanks.map((b) => (
                  <option key={b._id || b.id} value={b._id || b.id}>
                    {b.title} ({b.questionCount || b.questionIds?.length || 0})
                  </option>
                ))}
              </select>

              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="p-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <option value="">All Types</option>
                <option value="SINGLE_MCQ">Single Choice (MCQ)</option>
                <option value="MULTI_SELECT">Multiple Select</option>
                <option value="TRUE_FALSE">True / False</option>
                <option value="FILL_BLANK">Fill in Blank</option>
                <option value="SHORT_ANSWER">Short Answer</option>
                <option value="DESCRIPTIVE">Descriptive</option>
                <option value="CODING">Coding</option>
                <option value="SQL">SQL Query</option>
                <option value="FILE_UPLOAD">File Upload</option>
              </select>

              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="p-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <option value="">All Difficulties</option>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="p-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <option value="">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
          </div>

          {/* Questions Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-warm-xs overflow-hidden">
            {loadingQuestions ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading questions repository...</div>
            ) : questions.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <Database className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  No questions match your search or filter criteria.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/instructor/question-studio')}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-brand-primary text-white hover:bg-brand-primary-hover shadow-warm-xs transition"
                >
                  Create Prepared Question
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-2.5 px-4">Code / Statement</th>
                      <th className="py-2.5 px-3">Subject & Topic</th>
                      <th className="py-2.5 px-3">Type & Pool</th>
                      <th className="py-2.5 px-3">Difficulty</th>
                      <th className="py-2.5 px-3">Marks</th>
                      <th className="py-2.5 px-3">Status / Version</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {questions.map((q) => {
                      const assignedBanks = questionBanks.filter((b) =>
                        b.questionIds?.some((qid) => (qid._id || qid).toString() === (q.id || q._id).toString())
                      );
                      return (
                        <tr key={q.id || q._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4 max-w-sm">
                            <span className="font-mono text-[10px] text-slate-400 block mb-0.5">
                              {q.questionCode || 'QB-QST'}
                            </span>
                            <span className="font-semibold text-slate-900 dark:text-white line-clamp-2">
                              {q.statement || q.questionText}
                            </span>
                            {q.conceptTags?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {q.conceptTags.slice(0, 3).map((c, i) => (
                                  <span key={i} className="px-1.5 py-0.2 rounded text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                    {c}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3">
                            <span className="font-medium text-slate-800 dark:text-slate-200 block truncate max-w-[140px]">
                              {q.subject || q.subjectId?.name || 'General'}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate max-w-[140px]">
                              {q.topics?.[0] || q.topicIds?.[0]?.name || '-'}
                            </span>
                          </td>

                          <td className="py-3 px-3">
                            <div className="space-y-0.5">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 inline-block">
                                {q.questionType}
                              </span>
                              {assignedBanks.length > 0 && (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-brand-primary/10 text-brand-primary dark:text-brand-peach border border-brand-primary/20 truncate max-w-[130px]"
                                  title={`Bank: ${assignedBanks[0].title}`}
                                >
                                  <Layers className="w-2.5 h-2.5 flex-shrink-0" />
                                  <span className="truncate">{assignedBanks[0].title}</span>
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                q.difficulty === 'EASY'
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  : q.difficulty === 'MEDIUM'
                                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                              }`}
                            >
                              {q.difficulty}
                            </span>
                          </td>

                          <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">
                            {q.marks || 1}
                          </td>

                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  q.status === 'PUBLISHED'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : q.status === 'DRAFT'
                                    ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {q.status}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">v{q.currentVersion || 1}</span>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setViewingQuestion(q)}
                                title="View Question Details"
                                data-testid={`btn-view-question-${q.id || q._id}`}
                                className="p-1.5 text-slate-400 hover:text-brand-primary transition rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => navigate(`/instructor/question-studio?id=${q.id || q._id}`)}
                                title="Edit in Studio"
                                data-testid={`btn-edit-question-${q.id || q._id}`}
                                className="p-1.5 text-brand-primary hover:text-brand-primary-hover transition rounded-md hover:bg-brand-primary/10 dark:hover:bg-brand-primary/20"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDuplicateQuestion(q)}
                                title="Duplicate Question"
                                data-testid={`btn-duplicate-question-${q.id || q._id}`}
                                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setHistoryModalQuestionId(q.id || q._id)}
                                title="Version History"
                                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <History className="w-3.5 h-3.5" />
                              </button>

                              {q.status !== 'PUBLISHED' && (
                                <button
                                  type="button"
                                  onClick={() => handlePublishQuestion(q.id || q._id)}
                                  title="Publish Question"
                                  className="px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700 transition"
                                >
                                  Publish
                                </button>
                              )}

                              {q.status !== 'ARCHIVED' && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteQuestion(q.id || q._id)}
                                  title="Archive / Delete Question"
                                  data-testid={`btn-delete-question-${q.id || q._id}`}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 transition rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Question Details Preview Modal */}
      {viewingQuestion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          data-testid="modal-view-question"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-warm-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-brand-primary/10 text-brand-primary dark:text-brand-peach uppercase">
                    {viewingQuestion.questionType || viewingQuestion.type}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {viewingQuestion.difficulty || 'MEDIUM'}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    {viewingQuestion.marks || 1} Marks
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Question Preview
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingQuestion(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                  Statement / Prompt
                </span>
                <p className="mt-1 text-sm text-slate-800 dark:text-slate-200 font-medium whitespace-pre-wrap">
                  {viewingQuestion.statement || viewingQuestion.questionText || 'No statement provided.'}
                </p>
              </div>

              {/* Multiple Choice Options */}
              {Array.isArray(viewingQuestion.options) && viewingQuestion.options.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                    Answer Options
                  </span>
                  <div className="space-y-1.5">
                    {viewingQuestion.options.map((opt, oIdx) => {
                      const isCorrect = Boolean(
                        opt.isCorrect ||
                        viewingQuestion.answerKey === opt.id ||
                        viewingQuestion.correctAnswer === opt.id
                      );
                      return (
                        <div
                          key={opt.id || oIdx}
                          className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                            isCorrect
                              ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200'
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span className="font-medium">{opt.text}</span>
                          {isCorrect && (
                            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Correct Answer
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Coding Configuration Preview */}
              {(viewingQuestion.questionType === 'CODING' || viewingQuestion.type === 'code' || viewingQuestion.codingConfig) && (
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                    Coding Configuration & Test Cases
                  </span>
                  <div className="p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto space-y-1">
                    <div>Allowed Languages: {(viewingQuestion.codingConfig?.allowedLanguages || ['python', 'javascript']).join(', ')}</div>
                    <div>Default Language: {viewingQuestion.codingConfig?.defaultLanguage || 'python'}</div>
                    <div>Time Limit: {viewingQuestion.codingConfig?.cpuTimeLimitMs || 2000}ms | Memory: {viewingQuestion.codingConfig?.memoryLimitMb || 256}MB</div>
                  </div>
                  {viewingQuestion.codingConfig?.testCases?.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        Test Cases ({viewingQuestion.codingConfig.testCases.length})
                      </span>
                      <div className="space-y-1">
                        {viewingQuestion.codingConfig.testCases.map((tc, tcI) => (
                          <div key={tcI} className="p-2 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] flex items-center justify-between">
                            <span>Input: <code className="font-mono bg-slate-200 dark:bg-slate-700 px-1 rounded">{tc.input || '(empty)'}</code> → Expected: <code className="font-mono bg-slate-200 dark:bg-slate-700 px-1 rounded">{tc.expectedOutput}</code></span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${tc.isHidden ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                              {tc.isHidden ? 'Hidden' : 'Sample'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Explanation */}
              {viewingQuestion.explanation && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                    Explanation / Solution Rationale
                  </span>
                  <p className="mt-1 text-slate-600 dark:text-slate-400 italic">
                    {viewingQuestion.explanation}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingQuestion(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legacy compatibility container (hidden from UI and assistive technology) */}
      <div className="hidden" aria-hidden="true" style={{ display: 'none' }}>
        <MockTestBlueprintModal
          isOpen={false}
          onClose={() => setIsBlueprintModalOpen(false)}
          subjects={subjects}
          onCreated={() => {}}
        />
        <MockTestAttemptsModal
          isOpen={false}
          onClose={() => setSubmissionsModalTest(null)}
          mockTest={null}
        />
        <button type="button">View Submissions & Grade</button>
      </div>

      {/* Modals */}
      <AiQuestionGeneratorModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        subjects={subjects}
        onQuestionsGenerated={fetchQuestions}
      />

      <BulkQuestionImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        subjects={subjects}
        onImportCommitted={fetchQuestions}
      />

      <QuestionVersionHistoryModal
        isOpen={Boolean(historyModalQuestionId)}
        onClose={() => setHistoryModalQuestionId(null)}
        questionId={historyModalQuestionId}
      />
    </div>
  );
}
