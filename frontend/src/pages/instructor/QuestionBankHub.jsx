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
      let questionList = res.data || [];

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
      setTotalQuestions(res.pagination?.total || (res.data ? res.data.length : 0));
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

  return (
    <div className="space-y-5 pb-16">
      {/* Top Banner / Actions Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-warm-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Mock Bank</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Create, categorize, validate, review, and assemble reusable questions for examinations and mock tests.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAiModalOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary dark:text-brand-peach border border-brand-primary/30 transition flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4 text-brand-primary dark:text-brand-peach" />
            AI Generator
          </button>

          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition flex items-center gap-1.5"
          >
            <UploadCloud className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            Bulk Import
          </button>

          <button
            type="button"
            onClick={() => setIsBlueprintModalOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary dark:text-brand-peach border border-brand-primary/30 transition flex items-center gap-1.5"
          >
            <Sliders className="w-4 h-4 text-brand-primary dark:text-brand-peach" />
            Mock Test Blueprint
          </button>

          <button
            type="button"
            onClick={() => navigate('/instructor/question-studio')}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-brand-primary text-white hover:bg-brand-primary-hover shadow-warm-xs transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Create Question
          </button>
        </div>
      </div>

      {/* Simplified Navigation: 1. Questions (N) and 2. Mock Tests & Blueprints */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('questions')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'questions'
              ? 'border-brand-primary text-brand-primary dark:text-brand-peach'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Database className="w-4 h-4" />
          Questions ({totalQuestions})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('mockTests')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'mockTests'
              ? 'border-brand-primary text-brand-primary dark:text-brand-peach'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Mock Tests & Blueprints
        </button>
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
                                onClick={() => setHistoryModalQuestionId(q.id || q._id)}
                                title="Version History"
                                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <History className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => navigate(`/instructor/question-studio?id=${q.id || q._id}`)}
                                title="Edit in Studio"
                                className="p-1.5 text-brand-primary hover:text-brand-primary-hover transition rounded-md hover:bg-brand-primary/10 dark:hover:bg-brand-primary/20"
                              >
                                <Edit className="w-3.5 h-3.5" />
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
                                  onClick={() => handleArchiveQuestion(q.id || q._id)}
                                  title="Archive Question"
                                  className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                                >
                                  <Archive className="w-3.5 h-3.5" />
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

      {/* MOCK TESTS & BLUEPRINTS VIEW */}
      {activeTab === 'mockTests' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockTests.map((test) => (
              <div
                key={test._id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-warm-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/20 dark:text-brand-peach">
                    {test.examination}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      test.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {test.status}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">{test.title}</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Duration: {test.durationMinutes} mins | Total Marks: {test.totalMarks}
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>Questions Resolved: {test.resolvedQuestions?.length || 0}</span>
                  <span>{test.negativeMarking ? 'Neg. Marking ON' : 'No Neg. Marking'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSubmissionsModalTest(test)}
                  className="w-full mt-2 py-2 px-3 rounded-lg border border-brand-primary/30 dark:border-brand-primary/30 bg-brand-primary/10 dark:bg-brand-primary/20 text-brand-primary dark:text-brand-peach text-xs font-bold hover:bg-brand-primary/20 dark:hover:bg-brand-primary/30 flex items-center justify-center gap-1.5 transition"
                >
                  <Award className="w-3.5 h-3.5 text-brand-primary dark:text-brand-peach" />
                  View Submissions & Grade
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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

      <MockTestBlueprintModal
        isOpen={isBlueprintModalOpen}
        onClose={() => setIsBlueprintModalOpen(false)}
        subjects={subjects}
        onCreated={() => uapQuestionBankService.getMockTests().then((res) => setMockTests(res.data || []))}
      />

      <QuestionVersionHistoryModal
        isOpen={Boolean(historyModalQuestionId)}
        onClose={() => setHistoryModalQuestionId(null)}
        questionId={historyModalQuestionId}
      />

      <MockTestAttemptsModal
        isOpen={Boolean(submissionsModalTest)}
        onClose={() => setSubmissionsModalTest(null)}
        mockTest={submissionsModalTest}
      />
    </div>
  );
}
