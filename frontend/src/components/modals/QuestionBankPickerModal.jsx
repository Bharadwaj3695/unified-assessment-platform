import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  CheckSquare,
  Square,
  CheckCircle2,
  Code2,
  Database,
  FileText,
  Sliders,
  Eye,
  X,
  AlertCircle,
  Layers,
  ArrowRight,
} from 'lucide-react';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import EmptyState from '../ui/EmptyState';
import uapQuestionBankService from '../../services/uapQuestionBank.service';
import questionBankService from '../../services/questionBank.service';

/**
 * Question Bank Selection Drawer / Modal
 * Allows faculty to browse, search, filter, preview, and batch-select
 * reusable questions from the centralized Question Bank into tests.
 */
export default function QuestionBankPickerModal({
  isOpen,
  onClose,
  onSelectQuestions,
  existingQuestions = [],
}) {
  const [questions, setQuestions] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [selectedTopic, setSelectedTopic] = useState('');

  // Selection Map: { [questionId]: questionObject }
  const [selectedMap, setSelectedMap] = useState({});

  // Question detail preview
  const [previewQuestion, setPreviewQuestion] = useState(null);

  // Set of already added question IDs
  const alreadyAddedIds = useMemo(() => {
    const set = new Set();
    existingQuestions.forEach((q) => {
      if (q.bankQuestionId) set.add(q.bankQuestionId.toString());
      if (q._id) set.add(q._id.toString());
      if (q.id) set.add(q.id.toString());
    });
    return set;
  }, [existingQuestions]);

  // Load metadata (subjects & topics)
  useEffect(() => {
    if (!isOpen) return;

    async function loadMetadata() {
      try {
        const [subsRes, topicsRes] = await Promise.all([
          uapQuestionBankService.getSubjects().catch(() => ({ data: [] })),
          uapQuestionBankService.getTopics().catch(() => ({ data: [] })),
        ]);
        setSubjects(subsRes.data || subsRes || []);
        setTopics(topicsRes.data || topicsRes || []);
      } catch (_err) {
        // Fallback
      }
    }
    loadMetadata();
  }, [isOpen]);

  // Fetch Questions from Question Bank
  const fetchQuestions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (selectedSubject) params.subjectId = selectedSubject;
      if (selectedType !== 'All') {
        params.questionType = selectedType;
        params.type = selectedType;
      }
      if (selectedDifficulty !== 'All') params.difficulty = selectedDifficulty;

      let list = [];
      try {
        const res = await uapQuestionBankService.getQuestions(params);
        list = Array.isArray(res) ? res : (res.data || res.questions || []);
      } catch (e) {
        // Fallback to questionBankService if uap service endpoint varies
        const fallbackRes = await questionBankService.getQuestions(params);
        list = Array.isArray(fallbackRes) ? fallbackRes : (fallbackRes.data || fallbackRes.questions || []);
      }

      // Filter by topic if selected
      if (selectedTopic) {
        list = list.filter((q) => {
          const tIds = (q.topicIds || []).map((t) => (t._id || t).toString());
          const tNames = q.topics || [];
          return tIds.includes(selectedTopic) || tNames.includes(selectedTopic);
        });
      }

      setQuestions(list);
    } catch (err) {
      setError(err.message || 'Failed to load questions from Question Bank.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedSubject, selectedType, selectedDifficulty, selectedTopic]);

  useEffect(() => {
    if (isOpen) {
      fetchQuestions();
      setSelectedMap({});
      setPreviewQuestion(null);
    }
  }, [isOpen, fetchQuestions]);

  // Available questions excluding already added ones
  const selectableQuestions = useMemo(() => {
    return questions.filter((q) => !alreadyAddedIds.has((q._id || q.id).toString()));
  }, [questions, alreadyAddedIds]);

  const selectedCount = Object.keys(selectedMap).length;

  // Toggle individual question selection
  const toggleSelect = (q) => {
    const qId = (q._id || q.id).toString();
    if (alreadyAddedIds.has(qId)) return;

    setSelectedMap((prev) => {
      const copy = { ...prev };
      if (copy[qId]) {
        delete copy[qId];
      } else {
        copy[qId] = q;
      }
      return copy;
    });
  };

  // Select all visible selectable questions
  const handleSelectAll = () => {
    const isAllSelected =
      selectableQuestions.length > 0 &&
      selectableQuestions.every((q) => Boolean(selectedMap[(q._id || q.id).toString()]));

    if (isAllSelected) {
      // Deselect all
      setSelectedMap({});
    } else {
      const newMap = { ...selectedMap };
      selectableQuestions.forEach((q) => {
        newMap[(q._id || q.id).toString()] = q;
      });
      setSelectedMap(newMap);
    }
  };

  const handleDeselectAll = () => {
    setSelectedMap({});
  };

  // Convert Question Bank question to test question format
  const handleConfirm = () => {
    const selectedList = Object.values(selectedMap).map((bq) => {
      const qText = bq.statement || bq.questionText || '';
      const qType = bq.questionType || (bq.type ? bq.type.toUpperCase() : 'SINGLE_MCQ');
      const codingCfg = bq.codingConfig || bq.evaluationConfig || {};

      return {
        clientId: `q_bank_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        bankQuestionId: (bq._id || bq.id).toString(),
        questionBankId: bq.questionBankId || null,
        questionBankVersion: bq.currentVersion || bq.version || 1,
        statement: qText,
        questionText: qText,
        questionType: qType === 'CODE' ? 'CODING' : qType,
        type: bq.type || (qType === 'CODING' ? 'code' : qType === 'SQL' ? 'sql' : 'mcq'),
        difficulty: bq.difficulty || 'MEDIUM',
        marks: Number(bq.marks || bq.points) || (qType === 'CODING' || qType === 'SQL' ? 10 : 5),
        points: Number(bq.marks || bq.points) || (qType === 'CODING' || qType === 'SQL' ? 10 : 5),
        negativeMarks: Number(bq.negativeMarks) || 0,
        explanation: bq.explanation || '',
        isCollapsed: true,
        options: Array.isArray(bq.options) && bq.options.length > 0
          ? bq.options.map((opt, i) => ({
              id: opt.id || `opt_${i + 1}`,
              text: opt.text || '',
              isCorrect: Boolean(opt.isCorrect || bq.answerKey === opt.id || bq.correctAnswer === opt.id),
            }))
          : [
              { id: 'opt_1', text: '', isCorrect: true },
              { id: 'opt_2', text: '', isCorrect: false },
            ],
        answerKey: bq.answerKey || bq.correctAnswer || 'opt_1',
        correctAnswer: bq.correctAnswer || bq.answerKey || 'opt_1',
        evaluationConfig: {
          problemTitle: codingCfg.problemTitle || '',
          problemDescription: codingCfg.problemDescription || '',
          inputFormat: codingCfg.inputFormat || '',
          outputFormat: codingCfg.outputFormat || '',
          constraints: codingCfg.constraints || '',
          sampleInput: codingCfg.sampleInput || '',
          sampleOutput: codingCfg.sampleOutput || '',
          scoringPolicy: codingCfg.scoringPolicy || 'ALL_OR_NOTHING',
          caseSensitive: codingCfg.caseSensitive || false,
          acceptedAnswers: codingCfg.acceptedAnswers || [],
          allowedLanguages: codingCfg.allowedLanguages || ['python', 'javascript'],
          defaultLanguage: codingCfg.defaultLanguage || 'python',
          sqlDialect: codingCfg.sqlDialect || 'sqlite',
          schemaDdl: codingCfg.schemaDdl || '',
          starterCode: codingCfg.starterCode || {},
          cpuTimeLimitMs: codingCfg.cpuTimeLimitMs || 2000,
          memoryLimitMb: codingCfg.memoryLimitMb || 256,
          testCases: Array.isArray(codingCfg.testCases)
            ? codingCfg.testCases.map((tc, tcI) => ({
                id: tc.id || tc._id || `tc-${tcI + 1}`,
                input: tc.input || '',
                expectedOutput: tc.expectedOutput || '',
                isHidden: Boolean(tc.isHidden),
                isEnabled: tc.isEnabled !== false,
                weight: tc.weight || 1,
                description: tc.description || (tc.isHidden ? 'Hidden Evaluation Case' : 'Public Sample Case'),
              }))
            : [],
          rubric: codingCfg.rubric || [],
          fileUploadConfig: codingCfg.fileUploadConfig || {
            allowedFileTypes: ['.pdf', '.docx', '.png', '.jpg'],
            maxFileSizeMb: 10,
          },
        },
        codingConfig: codingCfg,
        tags: Array.isArray(bq.tags) ? bq.tags : (bq.conceptTags || []),
      };
    });

    onSelectQuestions(selectedList);
    onClose();
  };

  const isAllSelectableSelected =
    selectableQuestions.length > 0 &&
    selectableQuestions.every((q) => Boolean(selectedMap[(q._id || q.id).toString()]));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Questions from Question Bank"
      size="xl"
      maxWidth="max-w-5xl"
    >
      <div className="space-y-4" data-testid="question-bank-selection-drawer">
        {/* Search and Filter Bar */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 space-y-3">
          {/* Search statement */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search questions by statement, code, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-primary"
              data-testid="input-search-bank-questions"
            />
          </div>

          {/* Filters: Subject, Type, Difficulty, Topic */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {/* Subject */}
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              data-testid="select-filter-subject"
            >
              <option value="">All Subjects</option>
              {subjects.map((s) => (
                <option key={s._id || s.id} value={s._id || s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {/* Type */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              data-testid="select-filter-type"
            >
              <option value="All">All Types</option>
              <option value="SINGLE_MCQ">Single Choice (MCQ)</option>
              <option value="MULTI_SELECT">Multiple Select</option>
              <option value="TRUE_FALSE">True / False</option>
              <option value="SHORT_ANSWER">Short Answer</option>
              <option value="DESCRIPTIVE">Descriptive</option>
              <option value="CODING">Coding</option>
              <option value="SQL">SQL Query</option>
              <option value="FILL_BLANK">Fill in Blank</option>
              <option value="FILE_UPLOAD">File Upload</option>
            </select>

            {/* Difficulty */}
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              data-testid="select-filter-difficulty"
            >
              <option value="All">All Difficulties</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>

            {/* Topic */}
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              data-testid="select-filter-topic"
            >
              <option value="">All Topics</option>
              {topics.map((t) => (
                <option key={t._id || t.id} value={t._id || t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action & Selection Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSelectAll}
              disabled={selectableQuestions.length === 0}
              className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-brand-primary disabled:opacity-50"
              data-testid="btn-select-all"
            >
              {isAllSelectableSelected ? (
                <CheckSquare className="w-4 h-4 text-brand-primary" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>
                {isAllSelectableSelected ? 'Deselect All' : `Select All (${selectableQuestions.length})`}
              </span>
            </button>

            {selectedCount > 0 && (
              <button
                type="button"
                onClick={handleDeselectAll}
                className="text-xs text-slate-500 hover:text-rose-500 underline"
                data-testid="btn-deselect-all"
              >
                Clear Selection
              </button>
            )}
          </div>

          <div className="flex items-center gap-2" data-testid="badge-selected-count">
            <Badge variant="primary" size="sm">
              Selected: {selectedCount}
            </Badge>
          </div>
        </div>

        {/* Questions List */}
        <div className="max-h-96 overflow-y-auto space-y-2 pr-1" data-testid="bank-questions-list">
          {loading ? (
            <div className="py-12 flex justify-center">
              <Spinner />
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 rounded-lg text-xs">
              {error}
            </div>
          ) : questions.length === 0 ? (
            <EmptyState
              title="No Questions Found"
              description="No Question Bank items match your search or filter criteria."
            />
          ) : (
            questions.map((q, idx) => {
              const qId = (q._id || q.id).toString();
              const isAlreadyAdded = alreadyAddedIds.has(qId);
              const isSelected = Boolean(selectedMap[qId]);
              const statementText = q.statement || q.questionText || `Question ${idx + 1}`;
              const qType = q.questionType || q.type || 'SINGLE_MCQ';

              return (
                <div
                  key={qId}
                  onClick={() => !isAlreadyAdded && toggleSelect(q)}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    isAlreadyAdded
                      ? 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/30 opacity-60 cursor-not-allowed'
                      : isSelected
                      ? 'border-brand-primary bg-brand-primary-light/20 dark:bg-brand-primary-dark/20 shadow-warm-xs cursor-pointer'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer'
                  }`}
                  data-testid={`bank-question-row-${qId}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Checkbox */}
                      <div className="pt-0.5 shrink-0">
                        {isAlreadyAdded ? (
                          <CheckCircle2 className="w-4 h-4 text-slate-400" />
                        ) : isSelected ? (
                          <CheckSquare className="w-4 h-4 text-brand-primary" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white line-clamp-2">
                          {statementText}
                        </p>

                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="px-2 py-0.5 rounded font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {qType}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 font-medium">
                            {q.subject || q.subjectId?.name || 'General'}
                          </span>
                          <span className="text-slate-300 dark:text-slate-600">•</span>
                          <span
                            className={`px-1.5 py-0.2 rounded font-bold ${
                              q.difficulty === 'EASY'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : q.difficulty === 'HARD'
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {q.difficulty || 'MEDIUM'}
                          </span>
                          <span className="text-slate-300 dark:text-slate-600">•</span>
                          <span className="text-slate-500 font-medium">
                            {q.marks || q.points || 5} Marks
                          </span>

                          {isAlreadyAdded && (
                            <Badge variant="neutral" size="sm">
                              Already in test
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* View Question Action */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewQuestion(q);
                      }}
                      className="shrink-0 px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1 transition"
                      data-testid={`btn-view-bank-question-${qId}`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Question
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500">
            Selected: <strong className="text-slate-800 dark:text-slate-200">{selectedCount}</strong> question{selectedCount !== 1 ? 's' : ''}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} data-testid="btn-cancel-modal">
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirm}
              disabled={selectedCount === 0}
              data-testid="btn-add-selected-questions"
            >
              Add Selected Questions ({selectedCount})
            </Button>
          </div>
        </div>

        {/* Nested Question Preview Modal */}
        {previewQuestion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-5 shadow-warm-lg space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-brand-primary/10 text-brand-primary dark:text-brand-peach uppercase">
                      {previewQuestion.questionType || previewQuestion.type}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {previewQuestion.difficulty || 'MEDIUM'}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {previewQuestion.marks || previewQuestion.points || 5} Marks
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Question Details
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewQuestion(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                    Statement
                  </span>
                  <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                    {previewQuestion.statement || previewQuestion.questionText}
                  </p>
                </div>

                {Array.isArray(previewQuestion.options) && previewQuestion.options.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                      Options
                    </span>
                    <div className="space-y-1">
                      {previewQuestion.options.map((opt, oI) => {
                        const isCorrect = Boolean(
                          opt.isCorrect ||
                          previewQuestion.answerKey === opt.id ||
                          previewQuestion.correctAnswer === opt.id
                        );
                        return (
                          <div
                            key={opt.id || oI}
                            className={`p-2 rounded-lg border text-xs flex items-center justify-between ${
                              isCorrect
                                ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200'
                                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <span>{opt.text}</span>
                            {isCorrect && (
                              <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Correct
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {(previewQuestion.codingConfig || previewQuestion.evaluationConfig) && (
                  <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                      Coding Configuration
                    </span>
                    <div className="p-2.5 rounded bg-slate-900 text-slate-100 font-mono text-[10px] space-y-1">
                      <div>Default Language: {(previewQuestion.codingConfig?.defaultLanguage || 'python')}</div>
                      <div>Sample Test Cases: {(previewQuestion.codingConfig?.testCases || []).filter((tc) => !tc.isHidden).length}</div>
                      <div>Hidden Test Cases: {(previewQuestion.codingConfig?.testCases || []).filter((tc) => tc.isHidden).length}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setPreviewQuestion(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
