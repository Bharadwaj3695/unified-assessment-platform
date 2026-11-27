import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Save,
  Send,
  Eye,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  ArrowLeft,
  Sparkles,
  Code2,
  Database,
  FileText,
  Sliders,
  Check,
  Copy,
  ChevronUp,
  ChevronDown,
  Clock,
  Layers,
  UploadCloud,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';
import { toast } from 'react-toastify';
import uapQuestionBankService from '../../services/uapQuestionBank.service';
import {
  getOptionLetter,
  validateQuestion as validateSharedQuestion,
} from '../../utils/questionValidation';

const QUESTION_TYPES = [
  { id: 'SINGLE_MCQ', label: 'Single Choice (MCQ)', icon: CheckCircle2 },
  { id: 'MULTI_SELECT', label: 'Multiple Select', icon: CheckCircle2 },
  { id: 'TRUE_FALSE', label: 'True / False', icon: CheckCircle2 },
  { id: 'FILL_BLANK', label: 'Fill in the Blank', icon: FileText },
  { id: 'SHORT_ANSWER', label: 'Short Answer', icon: FileText },
  { id: 'DESCRIPTIVE', label: 'Descriptive / Essay', icon: FileText },
  { id: 'CODING', label: 'Coding Challenge', icon: Code2 },
  { id: 'SQL', label: 'SQL Query Challenge', icon: Database },
  { id: 'FILE_UPLOAD', label: 'Document / File Upload', icon: UploadCloud },
];

const EXAM_CATEGORIES = ['INSTITUTIONAL', 'COMPETITIVE', 'PRACTICE', 'PLACEMENT', 'GENERAL'];
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];

// Helper to generate unique client-side IDs
const generateClientId = () => `q_client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

// Default structure for a single question
const createDefaultQuestion = (overrides = {}, curriculumContext = {}) => {
  return {
    clientId: generateClientId(),
    savedId: null, // MongoDB _id when persisted
    questionCode: '',
    statement: '',
    questionType: 'SINGLE_MCQ',
    difficulty: 'MEDIUM',
    marks: 1,
    negativeMarks: 0,
    estimatedTimeSeconds: 60,
    explanation: '',
    visibility: 'INSTITUTIONAL',
    status: 'DRAFT',
    currentVersion: 1,
    isCollapsed: false,
    saveStatus: 'idle', // 'idle' | 'saving' | 'saved' | 'error'
    saveError: null,
    validationReport: null,
    // Inherited metadata
    examCategory: curriculumContext.examCategory || 'INSTITUTIONAL',
    subject: curriculumContext.subject || '',
    subjectId: curriculumContext.subjectId || null,
    topics: curriculumContext.topics ? [...curriculumContext.topics] : [],
    topicIds: curriculumContext.topicIds ? [...curriculumContext.topicIds] : [],
    conceptTags: curriculumContext.conceptTags ? [...curriculumContext.conceptTags] : [],
    conceptTagInput: '',
    // Options for MCQ / MULTI_SELECT / TRUE_FALSE
    options: [
      { id: 'opt_1', text: '', isCorrect: true },
      { id: 'opt_2', text: '', isCorrect: false },
      { id: 'opt_3', text: '', isCorrect: false },
      { id: 'opt_4', text: '', isCorrect: false },
    ],
    answerKey: 'opt_1',
    // Evaluation configuration
    evaluationConfig: {
      scoringPolicy: 'ALL_OR_NOTHING', // for MULTI_SELECT
      caseSensitive: false, // for FILL_BLANK
      acceptedAnswers: [], // for FILL_BLANK
      allowedLanguages: ['python', 'javascript'],
      defaultLanguage: 'python',
      sqlDialect: 'sqlite',
      schemaDdl: '',
      starterCode: {},
      cpuTimeLimitMs: 2000,
      memoryLimitMb: 256,
      testCases: [
        { input: '', expectedOutput: '', isHidden: false, weight: 1, description: 'Public Sample Case' },
        { input: '', expectedOutput: '', isHidden: true, weight: 2, description: 'Hidden Evaluation Case' },
      ],
      rubric: [
        { criterion: 'Accuracy & Completeness', maxMarks: 5, description: 'Core problem points addressed' },
      ],
      fileUploadConfig: {
        allowedFileTypes: ['.pdf', '.docx', '.png', '.jpg'],
        maxFileSizeMb: 10,
      },
    },
    ...overrides,
  };
};

// Validate an individual question according to platform rules
const validateSingleQuestion = (q, { isPublishing = false, index = 0 } = {}) => {
  const errors = [];
  const warnings = [];

  const statement = (q.statement || '').trim();
  if (!statement) {
    errors.push('Question statement is required.');
  } else if (statement.length < 5) {
    errors.push('Question statement must be at least 5 characters long.');
  }

  if (q.marks <= 0 || isNaN(q.marks)) {
    errors.push('Marks must be greater than 0.');
  }

  if (isPublishing) {
    const hasSubject = Boolean((q.subject && q.subject.trim()) || q.subjectId);
    if (!hasSubject) {
      errors.push('Subject must be entered before publishing.');
    }
  }

  if (!q.conceptTags || q.conceptTags.length === 0) {
    warnings.push('Adding concept tags improves student learning analytics.');
  }

  const shared = validateSharedQuestion(q, index, { minStatementLength: 5 });
  const optionErrors = {};
  let statementError = null;
  let correctAnswerError = null;

  if (!statement) {
    statementError = shared.statementError;
  } else if (statement.length < 5) {
    statementError = 'Question statement must be at least 5 characters long.';
  }

  // Type specific rules
  if (q.questionType === 'SINGLE_MCQ' || q.questionType === 'MULTI_SELECT') {
    const opts = q.options || [];
    if (opts.length < 2) {
      errors.push(
        q.questionType === 'SINGLE_MCQ'
          ? 'MCQ requires at least 2 options.'
          : 'Multi-select requires at least 2 options.'
      );
    }
    Object.entries(shared.optionErrors || {}).forEach(([optIdx, msg]) => {
      optionErrors[optIdx] = msg;
      errors.push(msg);
    });
    if (shared.correctAnswerError) {
      correctAnswerError = shared.correctAnswerError;
      errors.push(shared.correctAnswerError);
    }
  } else if (q.questionType === 'TRUE_FALSE') {
    if (q.answerKey === undefined || q.answerKey === null || q.answerKey === '') {
      correctAnswerError = 'Please select the correct True/False answer.';
      errors.push(correctAnswerError);
    }
  } else if (q.questionType === 'FILL_BLANK') {
    const hasAnswer =
      (typeof q.answerKey === 'string' && q.answerKey.trim().length > 0) ||
      (Array.isArray(q.evaluationConfig?.acceptedAnswers) && q.evaluationConfig.acceptedAnswers.length > 0);
    if (isPublishing && !hasAnswer) {
      errors.push('Please provide at least one accepted answer string.');
    }
  } else if (q.questionType === 'SHORT_ANSWER') {
    if (isPublishing && !q.answerKey && !q.explanation) {
      warnings.push('Short answer questions benefit from providing an expected keyword or answer key.');
    }
  } else if (q.questionType === 'DESCRIPTIVE') {
    const rubric = q.evaluationConfig?.rubric || [];
    if (isPublishing && rubric.length === 0) {
      warnings.push('Descriptive questions benefit from a structured grading rubric.');
    }
  } else if (q.questionType === 'CODING') {
    const tc = q.evaluationConfig?.testCases || [];
    if (tc.length === 0) {
      errors.push('Coding question must configure at least one testcase.');
    } else {
      if (!tc.some((t) => t.isHidden)) {
        warnings.push('Include hidden test cases for secure automated evaluation.');
      }
    }
  } else if (q.questionType === 'SQL') {
    if (!q.evaluationConfig?.schemaDdl && (!q.evaluationConfig?.testCases || q.evaluationConfig.testCases.length === 0)) {
      warnings.push('SQL questions should define a Schema DDL setup and evaluation query.');
    }
  } else if (q.questionType === 'FILE_UPLOAD') {
    const allowed = q.evaluationConfig?.fileUploadConfig?.allowedFileTypes || [];
    if (allowed.length === 0) {
      errors.push('Please select at least one allowed file type extension.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    statementError,
    optionErrors,
    correctAnswerError,
  };
};

export default function QuestionStudio() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');

  // Metadata
  const [loadingMetadata, setLoadingMetadata] = useState(false);

  // Common Curriculum Context
  const [curriculumContext, setCurriculumContext] = useState({
    examCategory: 'INSTITUTIONAL',
    subject: '',
    subjectId: null,
    topics: [],
    topicIds: [],
    topicInput: '',
    conceptTags: [],
    conceptTagInput: '',
  });

  // Multiple Questions Array in current authoring session
  const [questions, setQuestions] = useState([createDefaultQuestion()]);

  // View state
  const [activeTab, setActiveTab] = useState('editor'); // 'editor', 'preview'
  const [previewQuestionIndex, setPreviewQuestionIndex] = useState(0);
  const [isCurriculumExpanded, setIsCurriculumExpanded] = useState(true);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [isPublishingAll, setIsPublishingAll] = useState(false);
  const questionCardRefs = useRef({});

  const scrollToQuestionCard = (clientId) => {
    if (!clientId) return;
    requestAnimationFrame(() => {
      setTimeout(() => {
        const el = questionCardRefs.current[clientId];
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 40);
    });
  };

  // Load initial question if edit mode
  useEffect(() => {
    async function initStudio() {
      if (!editId) {
        setLoadingMetadata(false);
        return;
      }
      try {
        setLoadingMetadata(true);
        // Edit mode: fetch existing question
        const qRes = await uapQuestionBankService.getQuestionById(editId);
        const q = qRes.data;

        // Determine subject name and id
        const subName =
          q.subject ||
          q.subjectId?.name ||
          (typeof q.subjectId === 'string' && !q.subjectId.match(/^[0-9a-fA-F]{24}$/)
            ? q.subjectId
            : '');
        const subId =
          q.subjectId?._id ||
          (typeof q.subjectId === 'string' && q.subjectId.match(/^[0-9a-fA-F]{24}$/)
            ? q.subjectId
            : null);

        // Determine topics and topicIds
        let loadedTopics = [];
        if (Array.isArray(q.topics) && q.topics.length > 0) {
          loadedTopics = q.topics;
        } else if (Array.isArray(q.topicIds) && q.topicIds.length > 0) {
          loadedTopics = q.topicIds
            .map((t) => t.name || (typeof t === 'string' && !t.match(/^[0-9a-fA-F]{24}$/) ? t : ''))
            .filter(Boolean);
        }

        const loadedTopicIds = Array.isArray(q.topicIds)
          ? q.topicIds
              .map((t) => t._id || t)
              .filter((id) => typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/))
          : [];
        const loadedTags = q.conceptTags || [];

        setCurriculumContext({
          examCategory: q.examCategory || 'INSTITUTIONAL',
          subject: subName,
          subjectId: subId,
          topics: loadedTopics,
          topicIds: loadedTopicIds,
          topicInput: loadedTopics.join(', '),
          conceptTags: loadedTags,
          conceptTagInput: '',
        });

        // Set existing question as first question card
        setQuestions([
          createDefaultQuestion(
            {
              ...q,
              savedId: q.id || q._id,
              subject: subName,
              subjectId: subId,
              topics: loadedTopics,
              topicIds: loadedTopicIds,
              conceptTags: loadedTags,
              status: q.status || 'DRAFT',
              currentVersion: q.currentVersion || 1,
              saveStatus: 'saved',
            },
            {
              examCategory: q.examCategory,
              subject: subName,
              subjectId: subId,
              topics: loadedTopics,
              topicIds: loadedTopicIds,
              conceptTags: loadedTags,
            }
          ),
        ]);
      } catch (err) {
        toast.error('Failed to load question: ' + err.message);
      } finally {
        setLoadingMetadata(false);
      }
    }
    initStudio();
  }, [editId]);

  // Handle Curriculum Subject change (manual text entry)
  const handleCurriculumSubjectChange = (val) => {
    setCurriculumContext((prev) => ({ ...prev, subject: val }));
    // Update unsaved questions that do not have their own override
    setQuestions((prev) =>
      prev.map((q) => (!q.savedId ? { ...q, subject: val } : q))
    );
  };

  // Handle Curriculum Topics change (comma-separated manual text entry)
  const handleCurriculumTopicsChange = (val) => {
    const parsed = val
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    setCurriculumContext((prev) => ({ ...prev, topicInput: val, topics: parsed }));
    setQuestions((prev) =>
      prev.map((q) => (!q.savedId ? { ...q, topics: parsed } : q))
    );
  };

  // Concept Tag helpers for Curriculum Context
  const handleAddCurriculumTag = (e) => {
    if (e.key === 'Enter' && curriculumContext.conceptTagInput.trim()) {
      e.preventDefault();
      const tag = curriculumContext.conceptTagInput.trim();
      if (!curriculumContext.conceptTags.includes(tag)) {
        const nextTags = [...curriculumContext.conceptTags, tag];
        setCurriculumContext((prev) => ({
          ...prev,
          conceptTags: nextTags,
          conceptTagInput: '',
        }));
        // Apply to unsaved questions
        setQuestions((prev) =>
          prev.map((q) => (!q.savedId ? { ...q, conceptTags: nextTags } : q))
        );
      }
    }
  };

  const handleRemoveCurriculumTag = (tag) => {
    const nextTags = curriculumContext.conceptTags.filter((t) => t !== tag);
    setCurriculumContext((prev) => ({ ...prev, conceptTags: nextTags }));
    setQuestions((prev) =>
      prev.map((q) => (!q.savedId ? { ...q, conceptTags: nextTags } : q))
    );
  };

  // -------------------------------------------------------------
  // Question Manipulation Handlers (Add, Duplicate, Remove, Reorder)
  // -------------------------------------------------------------

  const handleAddQuestion = (type = 'SINGLE_MCQ') => {
    const newQ = createDefaultQuestion(
      { questionType: type },
      curriculumContext
    );
    setQuestions((prev) => [...prev, newQ]);
    toast.info(`Added new Question #${questions.length + 1} (${type})`);
  };

  const handleDuplicateQuestion = (idx) => {
    const source = questions[idx];
    const duplicated = JSON.parse(JSON.stringify(source));
    duplicated.clientId = generateClientId();
    duplicated.savedId = null; // Reset savedId so it saves as a new record!
    duplicated.questionCode = '';
    duplicated.status = 'DRAFT';
    duplicated.currentVersion = 1;
    duplicated.saveStatus = 'idle';
    duplicated.saveError = null;
    duplicated.validationReport = null;
    duplicated.isCollapsed = false;

    const nextQuestions = [...questions];
    nextQuestions.splice(idx + 1, 0, duplicated);
    setQuestions(nextQuestions);
    toast.success(`Duplicated Question #${idx + 1} into Question #${idx + 2}.`);
  };

  const handleRemoveQuestion = (idx) => {
    if (questions.length <= 1) {
      toast.warning('Session must contain at least one question.');
      return;
    }
    const q = questions[idx];
    if (q.statement && q.statement.trim().length > 0) {
      if (!window.confirm(`Delete Question #${idx + 1}? Any unsaved edits will be lost.`)) {
        return;
      }
    }
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
    toast.info(`Removed Question #${idx + 1}.`);
  };

  const handleMoveQuestion = (idx, direction) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= questions.length) return;
    const nextQuestions = [...questions];
    const [moved] = nextQuestions.splice(idx, 1);
    nextQuestions.splice(targetIdx, 0, moved);
    setQuestions(nextQuestions);
  };

  const handleToggleCollapse = (idx) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, isCollapsed: !q.isCollapsed } : q))
    );
  };

  const handleCollapseAll = (collapse) => {
    setQuestions((prev) => prev.map((q) => ({ ...q, isCollapsed: collapse })));
  };

  // Update specific question field
  const updateQuestionField = (idx, field, value) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (field !== 'validationReport' && next[idx].validationReport) {
        const rep = validateSingleQuestion(next[idx], { index: idx });
        next[idx] = { ...next[idx], validationReport: rep.valid ? null : rep };
      }
      return next;
    });
  };

  // Update question nested evaluationConfig field
  const updateEvaluationConfig = (idx, field, value) => {
    setQuestions((prev) => {
      const next = [...prev];
      const updated = {
        ...next[idx],
        evaluationConfig: {
          ...next[idx].evaluationConfig,
          [field]: value,
        },
      };
      if (updated.validationReport) {
        const rep = validateSingleQuestion(updated, { index: idx });
        updated.validationReport = rep.valid ? null : rep;
      }
      next[idx] = updated;
      return next;
    });
  };

  // Change question type
  const handleTypeChange = (idx, newType) => {
    setQuestions((prev) => {
      const next = [...prev];
      const current = next[idx];
      let newOptions = current.options;
      let newAnswerKey = current.answerKey;

      if (newType === 'TRUE_FALSE') {
        newOptions = [
          { id: 'opt_true', text: 'True', isCorrect: true },
          { id: 'opt_false', text: 'False', isCorrect: false },
        ];
        newAnswerKey = 'opt_true';
      } else if (newType === 'SINGLE_MCQ' || newType === 'MULTI_SELECT') {
        if (!newOptions || newOptions.length < 2) {
          newOptions = [
            { id: 'opt_1', text: '', isCorrect: true },
            { id: 'opt_2', text: '', isCorrect: false },
            { id: 'opt_3', text: '', isCorrect: false },
            { id: 'opt_4', text: '', isCorrect: false },
          ];
        }
        newAnswerKey = newType === 'SINGLE_MCQ' ? 'opt_1' : ['opt_1'];
      }

      const updated = {
        ...current,
        questionType: newType,
        options: newOptions,
        answerKey: newAnswerKey,
        validationReport: null,
      };
      if (current.validationReport) {
        const rep = validateSingleQuestion(updated, { index: idx });
        updated.validationReport = rep.valid ? null : rep;
      }
      next[idx] = updated;
      return next;
    });
  };

  // Option handlers for MCQ / MULTI_SELECT / TRUE_FALSE
  const handleOptionTextChange = (qIdx, optIdx, text) => {
    setQuestions((prev) => {
      const next = [...prev];
      const current = next[qIdx];
      const opts = [...current.options];
      opts[optIdx] = { ...opts[optIdx], text };
      const updated = { ...current, options: opts };
      if (current.validationReport) {
        const rep = validateSingleQuestion(updated, { index: qIdx });
        updated.validationReport = rep.valid ? null : rep;
      }
      next[qIdx] = updated;
      return next;
    });
  };

  const handleSetCorrectOption = (qIdx, optId) => {
    setQuestions((prev) => {
      const next = [...prev];
      const current = next[qIdx];
      let updated = current;

      if (current.questionType === 'SINGLE_MCQ' || current.questionType === 'TRUE_FALSE') {
        const opts = current.options.map((o) => ({ ...o, isCorrect: o.id === optId }));
        updated = { ...current, options: opts, answerKey: optId };
      } else if (current.questionType === 'MULTI_SELECT') {
        const opts = current.options.map((o) =>
          o.id === optId ? { ...o, isCorrect: !o.isCorrect } : o
        );
        const correctIds = opts.filter((o) => o.isCorrect).map((o) => o.id);
        updated = { ...current, options: opts, answerKey: correctIds };
      }

      if (current.validationReport) {
        const rep = validateSingleQuestion(updated, { index: qIdx });
        updated.validationReport = rep.valid ? null : rep;
      }
      next[qIdx] = updated;
      return next;
    });
  };

  const handleAddOption = (qIdx) => {
    setQuestions((prev) => {
      const next = [...prev];
      const current = next[qIdx];
      const existingIds = new Set((current.options || []).map((o) => o.id));
      let suffix = current.options.length + 1;
      while (existingIds.has(`opt_${suffix}`)) {
        suffix += 1;
      }
      const newOptId = `opt_${suffix}`;
      const updated = {
        ...current,
        options: [...current.options, { id: newOptId, text: '', isCorrect: false }],
      };
      if (current.validationReport) {
        const rep = validateSingleQuestion(updated, { index: qIdx });
        updated.validationReport = rep.valid ? null : rep;
      }
      next[qIdx] = updated;
      return next;
    });
  };

  const handleRemoveOption = (qIdx, optIdx) => {
    setQuestions((prev) => {
      const next = [...prev];
      const current = next[qIdx];
      if (current.options.length <= 2) {
        toast.warning('A multiple choice question requires at least 2 options.');
        return prev;
      }
      const updated = {
        ...current,
        options: current.options.filter((_, i) => i !== optIdx),
      };
      if (current.validationReport) {
        const rep = validateSingleQuestion(updated, { index: qIdx });
        updated.validationReport = rep.valid ? null : rep;
      }
      next[qIdx] = updated;
      return next;
    });
  };

  // Test cases for Coding / SQL
  const handleAddTestCase = (qIdx, isHidden = false) => {
    setQuestions((prev) => {
      const next = [...prev];
      const current = next[qIdx];
      const tc = current.evaluationConfig?.testCases || [];
      const newTc = {
        input: '',
        expectedOutput: '',
        isHidden,
        weight: 1,
        description: isHidden ? 'Hidden Test Case' : 'Public Sample Case',
      };
      next[qIdx] = {
        ...current,
        evaluationConfig: {
          ...current.evaluationConfig,
          testCases: [...tc, newTc],
        },
      };
      return next;
    });
  };

  const handleUpdateTestCase = (qIdx, tcIdx, field, val) => {
    setQuestions((prev) => {
      const next = [...prev];
      const current = next[qIdx];
      const tc = [...(current.evaluationConfig?.testCases || [])];
      tc[tcIdx] = { ...tc[tcIdx], [field]: val };
      next[qIdx] = {
        ...current,
        evaluationConfig: { ...current.evaluationConfig, testCases: tc },
      };
      return next;
    });
  };

  const handleRemoveTestCase = (qIdx, tcIdx) => {
    setQuestions((prev) => {
      const next = [...prev];
      const current = next[qIdx];
      const tc = (current.evaluationConfig?.testCases || []).filter((_, i) => i !== tcIdx);
      next[qIdx] = {
        ...current,
        evaluationConfig: { ...current.evaluationConfig, testCases: tc },
      };
      return next;
    });
  };

  // Rubric for Descriptive questions
  const handleAddRubricCriterion = (qIdx) => {
    setQuestions((prev) => {
      const next = [...prev];
      const current = next[qIdx];
      const rubric = current.evaluationConfig?.rubric || [];
      next[qIdx] = {
        ...current,
        evaluationConfig: {
          ...current.evaluationConfig,
          rubric: [
            ...rubric,
            { criterion: 'New Evaluation Criterion', maxMarks: 5, description: 'Evaluation guidelines' },
          ],
        },
      };
      return next;
    });
  };

  const handleUpdateRubricCriterion = (qIdx, rIdx, field, val) => {
    setQuestions((prev) => {
      const next = [...prev];
      const current = next[qIdx];
      const rubric = [...(current.evaluationConfig?.rubric || [])];
      rubric[rIdx] = { ...rubric[rIdx], [field]: val };
      next[qIdx] = {
        ...current,
        evaluationConfig: { ...current.evaluationConfig, rubric },
      };
      return next;
    });
  };

  const handleRemoveRubricCriterion = (qIdx, rIdx) => {
    setQuestions((prev) => {
      const next = [...prev];
      const current = next[qIdx];
      const rubric = (current.evaluationConfig?.rubric || []).filter((_, i) => i !== rIdx);
      next[qIdx] = {
        ...current,
        evaluationConfig: { ...current.evaluationConfig, rubric },
      };
      return next;
    });
  };

  // Run validation on all questions
  const handleValidateAll = (isPublishing = false) => {
    let allValid = true;
    let firstInvalidClientId = null;
    const validated = questions.map((q, idx) => {
      const report = validateSingleQuestion(q, { isPublishing, index: idx });
      if (!report.valid) {
        allValid = false;
        if (!firstInvalidClientId) firstInvalidClientId = q.clientId;
      }
      return {
        ...q,
        isCollapsed: !report.valid ? false : q.isCollapsed,
        validationReport: report,
      };
    });
    setQuestions(validated);
    if (!allValid && firstInvalidClientId) {
      scrollToQuestionCard(firstInvalidClientId);
    }
    return { allValid, validated };
  };

  // Helper to construct backend payload
  const buildQuestionPayload = (q) => {
    const subject = (q.subject !== undefined && q.subject !== null && q.subject !== '' ? q.subject : (curriculumContext.subject || '')).trim();
    const topics = (q.topics && q.topics.length > 0) ? q.topics : (curriculumContext.topics || []);
    return {
      statement: q.statement,
      questionType: q.questionType,
      difficulty: q.difficulty,
      marks: Number(q.marks || 1),
      negativeMarks: Number(q.negativeMarks || 0),
      estimatedTimeSeconds: Number(q.estimatedTimeSeconds || 60),
      explanation: q.explanation || '',
      examCategory: q.examCategory || curriculumContext.examCategory || 'INSTITUTIONAL',
      subject,
      subjectId: q.subjectId || curriculumContext.subjectId || null,
      topics,
      topicIds: q.topicIds?.length > 0 ? q.topicIds : curriculumContext.topicIds || [],
      conceptTags: q.conceptTags?.length > 0 ? q.conceptTags : curriculumContext.conceptTags || [],
      options: q.options || [],
      answerKey: q.answerKey,
      evaluationConfig: q.evaluationConfig || {},
      visibility: q.visibility || 'INSTITUTIONAL',
      status: q.status || 'DRAFT',
    };
  };

  // -------------------------------------------------------------
  // Save & Publish Multiple Questions
  // -------------------------------------------------------------

  // Save Single Question Draft
  const handleSaveSingleDraft = async (idx) => {
    const q = questions[idx];
    const report = validateSingleQuestion(q, { isPublishing: false, index: idx });
    if (!report.valid) {
      setQuestions((prev) =>
        prev.map((item, i) =>
          i === idx ? { ...item, isCollapsed: false, validationReport: report } : item
        )
      );
      scrollToQuestionCard(q.clientId);
      toast.error(`Question #${idx + 1} has incomplete fields. Please fix validation errors.`);
      return;
    }

    try {
      updateQuestionField(idx, 'saveStatus', 'saving');
      updateQuestionField(idx, 'saveError', null);
      const payload = { ...buildQuestionPayload(q), status: 'DRAFT' };

      if (q.savedId) {
        await uapQuestionBankService.updateQuestion(q.savedId, payload);
        updateQuestionField(idx, 'saveStatus', 'saved');
        toast.success(`Question #${idx + 1} draft updated.`);
      } else {
        const res = await uapQuestionBankService.createQuestion(payload);
        const newId = res.data.id || res.data._id;
        setQuestions((prev) => {
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            savedId: newId,
            saveStatus: 'saved',
            saveError: null,
          };
          return next;
        });
        toast.success(`Question #${idx + 1} saved as draft.`);
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message;
      setQuestions((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], saveStatus: 'error', saveError: errMsg };
        return next;
      });
      toast.error(`Question #${idx + 1} save failed: ${errMsg}`);
    }
  };

  // Save ALL Question Drafts
  const handleSaveAllDrafts = async () => {
    const { allValid } = handleValidateAll(false);
    if (!allValid) {
      toast.error('Please resolve validation errors before saving drafts.');
      return;
    }

    setIsSavingAll(true);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      try {
        updateQuestionField(i, 'saveStatus', 'saving');
        updateQuestionField(i, 'saveError', null);
        const payload = { ...buildQuestionPayload(q), status: 'DRAFT' };

        if (q.savedId) {
          await uapQuestionBankService.updateQuestion(q.savedId, payload);
          setQuestions((prev) => {
            const next = [...prev];
            next[i] = { ...next[i], saveStatus: 'saved', saveError: null };
            return next;
          });
          successCount++;
        } else {
          const res = await uapQuestionBankService.createQuestion(payload);
          const newId = res.data.id || res.data._id;
          setQuestions((prev) => {
            const next = [...prev];
            next[i] = { ...next[i], savedId: newId, saveStatus: 'saved', saveError: null };
            return next;
          });
          successCount++;
        }
      } catch (err) {
        failCount++;
        const errMsg = err.response?.data?.message || err.message;
        setQuestions((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], saveStatus: 'error', saveError: errMsg };
          return next;
        });
      }
    }

    setIsSavingAll(false);

    if (failCount === 0) {
      toast.success(`All ${successCount} question(s) saved successfully.`);
    } else {
      toast.warn(`Saved ${successCount} question(s); ${failCount} question(s) failed. Please check errors.`);
    }
  };

  // Publish All Valid Questions
  const handlePublishAll = async () => {
    // 1. Validate all questions for publishing
    const { allValid, validated } = handleValidateAll(true);

    if (!allValid) {
      const invalidIndices = validated
        .map((q, idx) => (!q.validationReport?.valid ? idx + 1 : null))
        .filter(Boolean);
      toast.error(
        `Cannot publish: Questions #${invalidIndices.join(', #')} have validation issues. Please correct them.`
      );
      // Auto expand cards with errors
      setQuestions((prev) =>
        prev.map((q) => (!q.validationReport?.valid ? { ...q, isCollapsed: false } : q))
      );
      return;
    }

    try {
      setIsPublishingAll(true);
      let publishedCount = 0;

      for (let i = 0; i < validated.length; i++) {
        let q = validated[i];
        let targetId = q.savedId;

        // Save or update draft first
        const payload = { ...buildQuestionPayload(q), status: 'DRAFT' };
        if (!targetId) {
          const createRes = await uapQuestionBankService.createQuestion(payload);
          targetId = createRes.data.id || createRes.data._id;
          setQuestions((prev) => {
            const next = [...prev];
            next[i] = { ...next[i], savedId: targetId };
            return next;
          });
        } else {
          await uapQuestionBankService.updateQuestion(targetId, payload);
        }

        // Lock & publish
        await uapQuestionBankService.publishQuestion(targetId);
        publishedCount++;

        setQuestions((prev) => {
          const next = [...prev];
          next[i] = {
            ...next[i],
            status: 'PUBLISHED',
            currentVersion: (next[i].currentVersion || 1) + 1,
            saveStatus: 'saved',
          };
          return next;
        });
      }

      toast.success(`Successfully published ${publishedCount} question(s) with locked versions!`);
      navigate('/instructor/question-bank');
    } catch (err) {
      toast.error('Publication failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsPublishingAll(false);
    }
  };

  return (
    <div className="space-y-4 pb-20 max-w-6xl mx-auto">
      {/* Top Header & Session Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-warm-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/instructor/question-bank')}
            title="Back to Mock Bank"
            className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                {editId ? 'Mock Bank Studio (Edit)' : 'Mock Bank Studio'}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-brand-primary/10 text-brand-primary dark:text-brand-peach border border-brand-primary/20">
                {questions.length} Question{questions.length !== 1 ? 's' : ''} in Session
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Author and configure multiple questions in one streamlined session.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (activeTab === 'editor') {
                const { allValid } = handleValidateAll(false);
                if (!allValid) {
                  toast.error('Please resolve validation errors before previewing.');
                  return;
                }
                setPreviewQuestionIndex(0);
                setActiveTab('preview');
              } else {
                setActiveTab('editor');
              }
            }}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition flex items-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5 text-slate-500" />
            {activeTab === 'editor' ? 'Student Preview' : 'Back to Editor'}
          </button>

          <button
            type="button"
            disabled={isSavingAll || isPublishingAll}
            onClick={handleSaveAllDrafts}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition flex items-center gap-1.5 shadow-sm"
          >
            <Save className="w-3.5 h-3.5 text-slate-500" />
            {isSavingAll ? 'Saving All...' : 'Save All Drafts'}
          </button>

          <button
            type="button"
            disabled={isSavingAll || isPublishingAll}
            onClick={handlePublishAll}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-brand-primary text-white hover:bg-brand-primary-hover shadow-warm-xs transition flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            {isPublishingAll ? 'Publishing...' : 'Publish Questions'}
          </button>
        </div>
      </div>

      {/* STUDENT SIMULATION VIEW */}
      {activeTab === 'preview' ? (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-warm-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-primary/10 text-brand-primary dark:text-brand-peach uppercase">
                Student Simulation Mode
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                Previews the exact layout students experience during an active assessment attempt.
              </p>
            </div>

            {/* Question selector in preview */}
            <div className="flex items-center gap-1">
              {questions.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPreviewQuestionIndex(i)}
                  className={`w-7 h-7 text-xs font-bold rounded-lg transition ${
                    previewQuestionIndex === i
                      ? 'bg-brand-primary text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Active Question Preview Card */}
          {(() => {
            const previewQ = questions[previewQuestionIndex] || questions[0];
            if (!previewQ) return null;
            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-400">
                      Q{previewQuestionIndex + 1}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {previewQ.questionType}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {previewQ.marks} Marks
                    </span>
                    {previewQ.negativeMarks > 0 && (
                      <span className="text-[10px] text-rose-500 block">
                        -{previewQ.negativeMarks} Neg. Mark
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="text-base font-semibold text-slate-900 dark:text-white whitespace-pre-wrap">
                  {previewQ.statement || 'Empty question statement...'}
                </h3>

                {/* Option Rendering for MCQ / MULTI_SELECT / TRUE_FALSE */}
                {(previewQ.questionType === 'SINGLE_MCQ' ||
                  previewQ.questionType === 'MULTI_SELECT' ||
                  previewQ.questionType === 'TRUE_FALSE') && (
                  <div className="space-y-2 pt-2">
                    {previewQ.options.map((opt, i) => (
                      <div
                        key={opt.id || i}
                        className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-3 transition cursor-pointer"
                      >
                        <input
                          type={previewQ.questionType === 'MULTI_SELECT' ? 'checkbox' : 'radio'}
                          name={`sim_q_${previewQuestionIndex}`}
                          className="w-4 h-4 text-brand-primary border-slate-300 focus:ring-brand-primary"
                          readOnly
                        />
                        <span className="text-xs font-bold text-slate-500">{getOptionLetter(i)}.</span>
                        <span className="text-xs text-slate-800 dark:text-slate-200">
                          {opt.text}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Fill in the Blank preview */}
                {previewQ.questionType === 'FILL_BLANK' && (
                  <div className="pt-2">
                    <input
                      type="text"
                      disabled
                      placeholder="Type your response here..."
                      className="w-full sm:w-80 p-2.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                )}

                {/* Short answer / Descriptive preview */}
                {(previewQ.questionType === 'SHORT_ANSWER' ||
                  previewQ.questionType === 'DESCRIPTIVE') && (
                  <div className="pt-2">
                    <textarea
                      rows={previewQ.questionType === 'DESCRIPTIVE' ? 4 : 2}
                      disabled
                      placeholder="Student text response area..."
                      className="w-full p-2.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                )}

                {/* Coding student view */}
                {previewQ.questionType === 'CODING' && (
                  <div className="space-y-3 pt-2">
                    <div className="p-3.5 rounded-lg bg-slate-900 text-slate-200 font-mono text-xs">
                      <p className="text-[11px] text-slate-500 mb-1"># Student Code Workspace</p>
                      <code>def solve():<br />&nbsp;&nbsp;&nbsp;&nbsp;pass</code>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Sample Public Test Cases:
                      </h4>
                      <div className="space-y-1.5">
                        {(previewQ.evaluationConfig?.testCases || [])
                          .filter((tc) => !tc.isHidden)
                          .map((tc, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-mono space-y-0.5"
                            >
                              <p><span className="text-slate-400">Input:</span> {tc.input || '(empty)'}</p>
                              <p><span className="text-slate-400">Expected:</span> {tc.expectedOutput}</p>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* File Upload preview */}
                {previewQ.questionType === 'FILE_UPLOAD' && (
                  <div className="pt-2 p-6 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2">
                    <UploadCloud className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Drag & Drop candidate file here or click to browse
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Permitted Formats:{' '}
                      {(previewQ.evaluationConfig?.fileUploadConfig?.allowedFileTypes || ['.pdf']).join(', ')}{' '}
                      | Max Size: {previewQ.evaluationConfig?.fileUploadConfig?.maxFileSizeMb || 10} MB
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      ) : (
        /* MULTI-QUESTION AUTHORING STUDIO */
        <div className="space-y-4">
          {/* Collapsible Session Curriculum Context Banner */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-warm-xs overflow-hidden">
            <div
              onClick={() => setIsCurriculumExpanded(!isCurriculumExpanded)}
              className="p-3.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-primary dark:text-brand-peach" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Curriculum & Exam Context
                </h2>
                <span className="text-[11px] text-slate-400">
                  
                </span>
              </div>
              <button type="button" className="text-slate-400 hover:text-slate-600">
                {isCurriculumExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {isCurriculumExpanded && (
              <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                {/* Examination Category */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Exam Category
                  </label>
                  <select
                    value={curriculumContext.examCategory}
                    onChange={(e) =>
                      setCurriculumContext((prev) => ({ ...prev, examCategory: e.target.value }))
                    }
                    className="w-full p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                  >
                    {EXAM_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Subject <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={curriculumContext.subject}
                    onChange={(e) => handleCurriculumSubjectChange(e.target.value)}
                    placeholder="Enter subject name (e.g. Data Structures)"
                    className="w-full p-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-brand-primary focus:border-brand-primary focus:outline-none"
                  />
                </div>

                {/* Default Topics */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Default Topics
                  </label>
                  <input
                    type="text"
                    value={curriculumContext.topicInput}
                    onChange={(e) => handleCurriculumTopicsChange(e.target.value)}
                    placeholder="Enter topic names (e.g. Trees, Graphs, Recursion)"
                    className="w-full p-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-brand-primary focus:border-brand-primary focus:outline-none"
                  />
                </div>

                {/* Concept Tags */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Concept Tags (Press Enter)
                  </label>
                  <input
                    type="text"
                    value={curriculumContext.conceptTagInput}
                    onChange={(e) =>
                      setCurriculumContext((prev) => ({ ...prev, conceptTagInput: e.target.value }))
                    }
                    onKeyDown={handleAddCurriculumTag}
                    placeholder="e.g. Recursion, BST..."
                    className="w-full p-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-brand-primary focus:border-brand-primary focus:outline-none"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5 max-h-16 overflow-y-auto">
                    {curriculumContext.conceptTags.map((tag) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-brand-primary/10 text-brand-primary dark:text-brand-peach flex items-center gap-1"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveCurriculumTag(tag)}
                          className="hover:text-rose-500 font-bold"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Multi-Question Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 pl-2">
                Questions ({questions.length})
              </span>
              <button
                type="button"
                onClick={() => handleCollapseAll(false)}
                className="px-2.5 py-1 text-[11px] font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                Expand All
              </button>
              <button
                type="button"
                onClick={() => handleCollapseAll(true)}
                className="px-2.5 py-1 text-[11px] font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                Collapse All
              </button>
              <button
                type="button"
                onClick={() => handleValidateAll(false)}
                className="px-2.5 py-1 text-[11px] font-medium rounded-lg text-brand-primary dark:text-brand-peach hover:bg-brand-primary/10 dark:hover:bg-brand-primary/20 transition flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                Validate All
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleAddQuestion('SINGLE_MCQ')}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-brand-primary text-white hover:bg-brand-primary-hover shadow-warm-xs transition flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Question
              </button>
            </div>
          </div>

          {/* VALIDATION SUMMARY BANNER */}
          {questions.some((q) => q.validationReport && !q.validationReport.valid) && (
            <div
              role="alert"
              data-testid="question-studio-validation-summary"
              className="p-3.5 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 space-y-1.5"
            >
              <div className="flex items-center gap-2 text-xs font-bold">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>
                  {questions.filter((q) => q.validationReport && !q.validationReport.valid).length === 1
                    ? `Question ${questions.findIndex((q) => q.validationReport && !q.validationReport.valid) + 1} has incomplete fields.`
                    : `${questions.filter((q) => q.validationReport && !q.validationReport.valid).length} questions have incomplete fields.`}
                </span>
              </div>
              <ul className="space-y-0.5 pl-6 list-disc text-xs">
                {questions.map((q, qIdx) => {
                  const rep = q.validationReport;
                  if (!rep || rep.valid) return null;
                  return rep.errors.map((errMsg, eIdx) => (
                    <li key={`${q.clientId}-${eIdx}`}>
                      <button
                        type="button"
                        onClick={() => scrollToQuestionCard(q.clientId)}
                        className="text-left hover:underline font-medium cursor-pointer"
                      >
                        Question {qIdx + 1}: {errMsg}
                      </button>
                    </li>
                  ));
                })}
              </ul>
            </div>
          )}

          {/* QUESTIONS LIST CARDS */}
          <div className="space-y-4">
            {questions.map((q, qIdx) => {
              const isCollapsed = q.isCollapsed;
              const rep = q.validationReport;

              return (
                <div
                  key={q.clientId}
                  ref={(el) => {
                    if (el) questionCardRefs.current[q.clientId] = el;
                    else delete questionCardRefs.current[q.clientId];
                  }}
                  className={`bg-white dark:bg-slate-900 rounded-xl border shadow-warm-xs transition-all overflow-hidden ${
                    rep && !rep.valid
                      ? 'border-rose-300 dark:border-rose-800'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {/* Card Header */}
                  <div className="p-3 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleCollapse(qIdx)}
                        className="p-1 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        title={isCollapsed ? 'Expand Question' : 'Collapse Question'}
                      >
                        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      <span className="font-bold text-xs text-slate-800 dark:text-white">
                        Question #{qIdx + 1}
                      </span>

                      {/* Question Type Selector Pill */}
                      <select
                        value={q.questionType}
                        onChange={(e) => handleTypeChange(qIdx, e.target.value)}
                        className="p-1 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                      >
                        {QUESTION_TYPES.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </select>

                      {/* Status / Saved Badge */}
                      {q.saveStatus === 'saving' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">
                          Saving...
                        </span>
                      )}
                      {q.saveStatus === 'saved' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {q.status === 'PUBLISHED' ? 'Published' : 'Saved Draft'}
                        </span>
                      )}
                      {q.saveStatus === 'error' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                          Error
                        </span>
                      )}

                      {/* Validation Badge */}
                      {rep && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                            rep.valid
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                          }`}
                        >
                          {rep.valid ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Valid
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-3 h-3 text-rose-600" />
                              {rep.errors.length} issue(s)
                            </>
                          )}
                        </span>
                      )}
                    </div>

                    {/* Card Actions: Reorder, Duplicate, Delete */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={qIdx === 0}
                        onClick={() => handleMoveQuestion(qIdx, -1)}
                        title="Move Up"
                        className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        disabled={qIdx === questions.length - 1}
                        onClick={() => handleMoveQuestion(qIdx, 1)}
                        title="Move Down"
                        className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicateQuestion(qIdx)}
                        title="Duplicate Question"
                        className="p-1 rounded text-slate-500 hover:text-brand-primary dark:hover:text-brand-peach transition"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestion(qIdx)}
                          title="Remove Question"
                          className="p-1 rounded text-slate-400 hover:text-rose-600 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Collapsed Preview Snippet */}
                  {isCollapsed && (
                    <div
                      onClick={() => handleToggleCollapse(qIdx)}
                      className="p-3 bg-white dark:bg-slate-900 cursor-pointer flex items-center justify-between text-xs text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <span className="font-medium text-slate-800 dark:text-slate-200 line-clamp-1">
                        {q.statement || '(No statement entered yet)'}
                      </span>
                      <span className="text-[11px] text-slate-400 ml-2 flex-shrink-0">
                        {q.marks} Marks | {q.difficulty}
                      </span>
                    </div>
                  )}

                  {/* Card Body (when Expanded) */}
                  {!isCollapsed && (
                    <div className="p-4 space-y-4">
                      {/* Validation Error banner if errors exist */}
                      {rep && !rep.valid && (
                        <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs space-y-1">
                          <div className="font-semibold flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                            Validation Requirements:
                          </div>
                          <ul className="list-disc list-inside space-y-0.5 text-[11px] pl-1">
                            {rep.errors.map((err, ei) => (
                              <li key={ei}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Question Statement */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Question Statement / Prompt <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                          rows={3}
                          value={q.statement}
                          onChange={(e) => updateQuestionField(qIdx, 'statement', e.target.value)}
                          placeholder="Enter complete question prompt, context, formulas, and instructions..."
                          className={`w-full p-2.5 rounded-lg border text-slate-900 dark:text-white text-xs focus:ring-1 focus:outline-none ${
                            rep?.statementError
                              ? 'border-rose-500 dark:border-rose-500 bg-rose-50/30 dark:bg-rose-950/20 focus:ring-rose-500'
                              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-brand-primary'
                          }`}
                        />
                        {rep?.statementError && (
                          <p
                            role="alert"
                            className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5"
                          >
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{rep.statementError}</span>
                          </p>
                        )}
                      </div>

                      {/* --- TYPE-SPECIFIC ANSWER CONFIGURATION --- */}

                      {/* 1. MCQ / MULTI_SELECT / TRUE_FALSE Options */}
                      {(q.questionType === 'SINGLE_MCQ' ||
                        q.questionType === 'MULTI_SELECT' ||
                        q.questionType === 'TRUE_FALSE') && (
                        <div className="space-y-3 pt-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                {q.questionType === 'TRUE_FALSE'
                                  ? 'True / False Configuration'
                                  : 'Options & Answer Key'}
                              </h4>
                              <p className="text-[11px] text-slate-500">
                                {q.questionType === 'SINGLE_MCQ'
                                  ? 'Select radio button next to the correct choice.'
                                  : q.questionType === 'MULTI_SELECT'
                                  ? 'Check all boxes corresponding to correct options.'
                                  : 'Mark which statement value is correct.'}
                              </p>
                            </div>

                            {q.questionType !== 'TRUE_FALSE' && (
                              <button
                                type="button"
                                onClick={() => handleAddOption(qIdx)}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-brand-primary dark:text-brand-peach hover:bg-brand-primary/10 transition flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                Add Option
                              </button>
                            )}
                          </div>

                          {/* Multi-Select Scoring Policy */}
                          {q.questionType === 'MULTI_SELECT' && (
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-xs">
                              <label className="font-semibold text-slate-600 dark:text-slate-400">
                                Scoring Policy:
                              </label>
                              <select
                                value={q.evaluationConfig?.scoringPolicy || 'ALL_OR_NOTHING'}
                                onChange={(e) => updateEvaluationConfig(qIdx, 'scoringPolicy', e.target.value)}
                                className="p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                              >
                                <option value="ALL_OR_NOTHING">All or Nothing (Strict)</option>
                                <option value="PROPORTIONAL_NO_PENALTY">Proportional Partial Credit (No Penalty)</option>
                                <option value="PROPORTIONAL_WITH_PENALTY">Proportional Partial Credit (With Penalty)</option>
                              </select>
                            </div>
                          )}

                          <div className="space-y-2">
                            {q.options.map((opt, optIdx) => {
                              const optError = rep?.optionErrors?.[optIdx] || null;
                              const optLetter = getOptionLetter(optIdx);
                              return (
                                <div key={opt.id || optIdx} className="space-y-1">
                                  <div
                                    className={`p-2.5 rounded-lg border transition flex items-center gap-2.5 ${
                                      optError
                                        ? 'border-rose-500 dark:border-rose-500 bg-rose-50/30 dark:bg-rose-950/20'
                                        : opt.isCorrect
                                        ? 'border-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-950/20'
                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => handleSetCorrectOption(qIdx, opt.id)}
                                      className={`w-5 h-5 rounded-full flex items-center justify-center border transition flex-shrink-0 ${
                                        opt.isCorrect
                                          ? 'bg-emerald-600 border-emerald-600 text-white'
                                          : 'border-slate-300 dark:border-slate-600 text-transparent hover:border-slate-400'
                                      }`}
                                    >
                                      <Check className="w-3 h-3 stroke-[3]" />
                                    </button>

                                    <span className="text-xs font-bold text-slate-500 w-4 text-center">
                                      {optLetter}
                                    </span>

                                    <input
                                      type="text"
                                      value={opt.text}
                                      onChange={(e) => handleOptionTextChange(qIdx, optIdx, e.target.value)}
                                      placeholder={`Option ${optLetter} text...`}
                                      aria-invalid={optError ? 'true' : 'false'}
                                      className="flex-1 bg-transparent text-xs text-slate-900 dark:text-white focus:outline-none"
                                    />

                                    {q.questionType !== 'TRUE_FALSE' && q.options.length > 2 && (
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveOption(qIdx, optIdx)}
                                        className="text-slate-400 hover:text-rose-500 transition p-1"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                  {optError && (
                                    <p
                                      role="alert"
                                      className="pl-2 text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5"
                                    >
                                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                      <span>{optError}</span>
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                            {rep?.correctAnswerError && (
                              <p
                                role="alert"
                                className="pt-1 text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5"
                              >
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>{rep.correctAnswerError}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 2. Fill in the Blank Configuration */}
                      {q.questionType === 'FILL_BLANK' && (
                        <div className="space-y-3 pt-1">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            Accepted Answer Keys
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            Comma-separate accepted responses or variations (e.g. "Paris, City of Light").
                          </p>
                          <input
                            type="text"
                            value={Array.isArray(q.answerKey) ? q.answerKey.join(', ') : q.answerKey || ''}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
                              updateQuestionField(qIdx, 'answerKey', raw);
                              updateEvaluationConfig(qIdx, 'acceptedAnswers', parts);
                            }}
                            placeholder="e.g. photosynthesis, light reaction"
                            className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                          />
                          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer pt-1">
                            <input
                              type="checkbox"
                              checked={q.evaluationConfig?.caseSensitive || false}
                              onChange={(e) => updateEvaluationConfig(qIdx, 'caseSensitive', e.target.checked)}
                              className="w-3.5 h-3.5 rounded text-brand-primary focus:ring-brand-primary"
                            />
                            Case sensitive string matching
                          </label>
                        </div>
                      )}

                      {/* 3. Short Answer Configuration */}
                      {q.questionType === 'SHORT_ANSWER' && (
                        <div className="space-y-2 pt-1">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            Expected Keywords or Model Response
                          </h4>
                          <textarea
                            rows={2}
                            value={typeof q.answerKey === 'string' ? q.answerKey : ''}
                            onChange={(e) => updateQuestionField(qIdx, 'answerKey', e.target.value)}
                            placeholder="Enter expected key phrase or evaluation guidance..."
                            className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                          />
                        </div>
                      )}

                      {/* 4. Descriptive / Essay Rubric Configuration */}
                      {q.questionType === 'DESCRIPTIVE' && (
                        <div className="space-y-3 pt-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                Descriptive Scoring Rubric Matrix
                              </h4>
                              <p className="text-[11px] text-slate-500">
                                Defines point criteria for faculty manual evaluation.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddRubricCriterion(qIdx)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-brand-primary dark:text-brand-peach hover:bg-brand-primary/10 transition flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              Add Criterion
                            </button>
                          </div>

                          <div className="space-y-2">
                            {(q.evaluationConfig?.rubric || []).map((r, rIdx) => (
                              <div
                                key={rIdx}
                                className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 space-y-1.5"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <input
                                    type="text"
                                    value={r.criterion}
                                    onChange={(e) =>
                                      handleUpdateRubricCriterion(qIdx, rIdx, 'criterion', e.target.value)
                                    }
                                    placeholder="Criterion name..."
                                    className="flex-1 p-1 text-xs font-semibold rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                                  />
                                  <div className="flex items-center gap-1">
                                    <span className="text-[11px] text-slate-500">Max Marks:</span>
                                    <input
                                      type="number"
                                      min="1"
                                      value={r.maxMarks}
                                      onChange={(e) =>
                                        handleUpdateRubricCriterion(
                                          qIdx,
                                          rIdx,
                                          'maxMarks',
                                          Number(e.target.value)
                                        )
                                      }
                                      className="w-14 p-1 text-xs text-center rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveRubricCriterion(qIdx, rIdx)}
                                      className="text-slate-400 hover:text-rose-500 p-1"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                                <input
                                  type="text"
                                  value={r.description || ''}
                                  onChange={(e) =>
                                    handleUpdateRubricCriterion(qIdx, rIdx, 'description', e.target.value)
                                  }
                                  placeholder="Guidance for awarding marks..."
                                  className="w-full p-1 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 5. Coding Challenge Test Cases */}
                      {q.questionType === 'CODING' && (
                        <div className="space-y-3 pt-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                Automated Execution & Test Cases
                              </h4>
                              <p className="text-[11px] text-slate-500">
                                Configure public sample cases (student feedback) and hidden evaluation cases.
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleAddTestCase(qIdx, false)}
                                className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-brand-primary dark:text-brand-peach hover:bg-brand-primary/10 transition"
                              >
                                + Public Case
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAddTestCase(qIdx, true)}
                                className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                              >
                                + Hidden Case
                              </button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            {(q.evaluationConfig?.testCases || []).map((tc, tcIdx) => (
                              <div
                                key={tcIdx}
                                className={`p-2.5 rounded-lg border text-xs space-y-1.5 ${
                                  tc.isHidden
                                    ? 'border-slate-300 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/40'
                                    : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                      tc.isHidden
                                        ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                                        : 'bg-brand-primary/10 text-brand-primary dark:text-brand-peach'
                                    }`}
                                  >
                                    {tc.isHidden ? 'HIDDEN CASE' : 'PUBLIC SAMPLE'} #{tcIdx + 1}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <label className="text-[11px] text-slate-500">Weight:</label>
                                    <input
                                      type="number"
                                      min="1"
                                      value={tc.weight || 1}
                                      onChange={(e) =>
                                        handleUpdateTestCase(qIdx, tcIdx, 'weight', Number(e.target.value))
                                      }
                                      className="w-12 p-0.5 text-center rounded border border-slate-300 dark:border-slate-700 text-xs"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveTestCase(qIdx, tcIdx)}
                                      className="text-slate-400 hover:text-rose-500 p-1"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-[10px] text-slate-500 font-medium">Input (stdin):</label>
                                    <textarea
                                      rows={2}
                                      value={tc.input || ''}
                                      onChange={(e) => handleUpdateTestCase(qIdx, tcIdx, 'input', e.target.value)}
                                      className="w-full p-1.5 rounded border border-slate-300 dark:border-slate-700 font-mono text-[11px]"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-slate-500 font-medium">Expected Output (stdout):</label>
                                    <textarea
                                      rows={2}
                                      value={tc.expectedOutput || ''}
                                      onChange={(e) =>
                                        handleUpdateTestCase(qIdx, tcIdx, 'expectedOutput', e.target.value)
                                      }
                                      className="w-full p-1.5 rounded border border-slate-300 dark:border-slate-700 font-mono text-[11px]"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 6. SQL Query Challenge */}
                      {q.questionType === 'SQL' && (
                        <div className="space-y-3 pt-1">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            SQL Schema Setup & Query
                          </h4>
                          <div>
                            <label className="text-[10px] text-slate-500 font-medium">Schema DDL Setup Script:</label>
                            <textarea
                              rows={2}
                              value={q.evaluationConfig?.schemaDdl || ''}
                              onChange={(e) => updateEvaluationConfig(qIdx, 'schemaDdl', e.target.value)}
                              placeholder="CREATE TABLE employees (id INT, name TEXT, salary INT);..."
                              className="w-full p-2 font-mono text-[11px] rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 font-medium">Authoritative Reference Query:</label>
                            <textarea
                              rows={2}
                              value={q.answerKey || ''}
                              onChange={(e) => updateQuestionField(qIdx, 'answerKey', e.target.value)}
                              placeholder="SELECT name, salary FROM employees WHERE salary > 50000;..."
                              className="w-full p-2 font-mono text-[11px] rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                            />
                          </div>
                        </div>
                      )}

                      {/* 7. File Upload Configuration */}
                      {q.questionType === 'FILE_UPLOAD' && (
                        <div className="space-y-3 pt-1">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            File Upload Restrictions
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div>
                              <label className="block text-[11px] text-slate-500 font-medium mb-1">
                                Allowed File Formats:
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {['.pdf', '.docx', '.png', '.jpg', '.zip'].map((ext) => {
                                  const allowed =
                                    q.evaluationConfig?.fileUploadConfig?.allowedFileTypes || ['.pdf'];
                                  const isChecked = allowed.includes(ext);
                                  return (
                                    <label key={ext} className="flex items-center gap-1 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(e) => {
                                          const nextExts = e.target.checked
                                            ? [...allowed, ext]
                                            : allowed.filter((x) => x !== ext);
                                          updateEvaluationConfig(qIdx, 'fileUploadConfig', {
                                            ...(q.evaluationConfig?.fileUploadConfig || {}),
                                            allowedFileTypes: nextExts,
                                          });
                                        }}
                                        className="w-3.5 h-3.5 rounded text-brand-primary focus:ring-brand-primary"
                                      />
                                      <span>{ext}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] text-slate-500 font-medium mb-1">
                                Maximum File Size (MB):
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="50"
                                value={q.evaluationConfig?.fileUploadConfig?.maxFileSizeMb || 10}
                                onChange={(e) => {
                                  updateEvaluationConfig(qIdx, 'fileUploadConfig', {
                                    ...(q.evaluationConfig?.fileUploadConfig || {}),
                                    maxFileSizeMb: Number(e.target.value),
                                  });
                                }}
                                className="w-24 p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-center"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* COMPACT QUESTION SETTINGS (Difficulty, Marks, Negative Marks, Time) */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          {/* Difficulty rating pills */}
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                              Difficulty
                            </label>
                            <div className="flex items-center gap-1">
                              {DIFFICULTIES.map((diff) => (
                                <button
                                  key={diff}
                                  type="button"
                                  onClick={() => updateQuestionField(qIdx, 'difficulty', diff)}
                                  className={`flex-1 py-1 text-[11px] font-bold rounded border transition ${
                                    q.difficulty === diff
                                      ? diff === 'EASY'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-500 dark:bg-emerald-950/40'
                                        : diff === 'MEDIUM'
                                        ? 'bg-amber-50 text-amber-700 border-amber-500 dark:bg-amber-950/40'
                                        : 'bg-rose-50 text-rose-700 border-rose-500 dark:bg-rose-950/40'
                                      : 'border-slate-200 dark:border-slate-700 text-slate-500'
                                  }`}
                                >
                                  {diff}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Marks */}
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                              Marks
                            </label>
                            <input
                              type="number"
                              min="0.25"
                              step="0.25"
                              value={q.marks}
                              onChange={(e) => updateQuestionField(qIdx, 'marks', Number(e.target.value))}
                              className="w-full p-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-center font-bold"
                            />
                          </div>

                          {/* Negative Marks */}
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                              Negative Marks
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.25"
                              value={q.negativeMarks}
                              onChange={(e) =>
                                updateQuestionField(qIdx, 'negativeMarks', Number(e.target.value))
                              }
                              className="w-full p-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-center"
                            />
                          </div>

                          {/* Estimated Time */}
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                              Est. Time (sec)
                            </label>
                            <input
                              type="number"
                              min="10"
                              value={q.estimatedTimeSeconds}
                              onChange={(e) =>
                                updateQuestionField(qIdx, 'estimatedTimeSeconds', Number(e.target.value))
                              }
                              className="w-full p-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-center"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Pedagogical Explanation */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Pedagogical Explanation / Solution Rationale
                        </label>
                        <textarea
                          rows={2}
                          value={q.explanation || ''}
                          onChange={(e) => updateQuestionField(qIdx, 'explanation', e.target.value)}
                          placeholder="Explain why the solution is correct. Displayed to students during post-test feedback."
                          className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      </div>

                      {/* Card Bottom Quick Actions */}
                      <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                        <div className="text-[11px] text-slate-400">
                          {q.savedId ? `Saved ID: ${q.savedId}` : 'Unsaved draft'}
                          {q.saveError && <span className="text-rose-500 ml-2">({q.saveError})</span>}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const rep = validateSingleQuestion(q, { isPublishing: false, index: qIdx });
                              updateQuestionField(qIdx, 'validationReport', rep);
                              if (rep.valid) toast.success(`Question #${qIdx + 1} validation passed.`);
                              else toast.warn(`Question #${qIdx + 1} has ${rep.errors.length} issue(s).`);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition"
                          >
                            Validate
                          </button>

                          <button
                            type="button"
                            disabled={q.saveStatus === 'saving'}
                            onClick={() => handleSaveSingleDraft(qIdx)}
                            className="px-3 py-1 text-xs font-semibold rounded-lg border border-brand-primary/30 text-brand-primary dark:text-brand-peach bg-brand-primary/10 hover:bg-brand-primary/20 transition flex items-center gap-1"
                          >
                            <Save className="w-3 h-3" />
                            {q.saveStatus === 'saving' ? 'Saving...' : 'Save Draft'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Add Question Bar */}
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => handleAddQuestion('SINGLE_MCQ')}
              className="px-4 py-2 text-xs font-bold rounded-lg border-2 border-dashed border-brand-primary/40 text-brand-primary dark:text-brand-peach hover:bg-brand-primary/10 transition inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Another Question
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
