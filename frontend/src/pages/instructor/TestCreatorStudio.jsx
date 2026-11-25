import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, useParams, Link } from 'react-router-dom';
import {
  Save,
  Send,
  Eye,
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Code2,
  Database,
  FileText,
  UploadCloud,
  Check,
  X,
  ArrowLeft,
  Clock,
  Shield,
  Layers,
  Sparkles,
} from 'lucide-react';
import { toast } from 'react-toastify';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import CodeEditor from '../../components/common/CodeEditor';
import uapQuestionBankService from '../../services/uapQuestionBank.service';
import { assessmentService } from '../../services/assessment.service';

// Supported Question Types aligned with Mock Bank Studio
const QUESTION_TYPES = [
  { id: 'SINGLE_MCQ', label: 'Single Choice (MCQ)', icon: CheckCircle2 },
  { id: 'MULTI_SELECT', label: 'Multiple Select', icon: CheckCircle2 },
  { id: 'TRUE_FALSE', label: 'True / False', icon: CheckCircle2 },
  { id: 'SHORT_ANSWER', label: 'Short Answer', icon: FileText },
  { id: 'DESCRIPTIVE', label: 'Descriptive / Essay', icon: FileText },
  { id: 'CODING', label: 'Coding Challenge', icon: Code2 },
  { id: 'SQL', label: 'SQL Query Challenge', icon: Database },
  { id: 'FILL_BLANK', label: 'Fill in the Blank', icon: FileText },
  { id: 'FILE_UPLOAD', label: 'Document / File Upload', icon: UploadCloud },
];

const EXAM_CATEGORIES = ['GATE', 'Placement', 'Institutional', 'Competitive', 'Practice', 'General'];
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];
const ASSESSMENT_CATEGORIES = ['Computer Science', 'Engineering', 'Mathematics', 'General'];

// Helper to generate client ID for newly added questions
const generateClientId = () => `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// Default structure for a question item
const createNewQuestion = (type = 'SINGLE_MCQ', number = 1) => {
  return {
    clientId: generateClientId(),
    statement: '',
    questionType: type,
    difficulty: 'MEDIUM',
    marks: type === 'CODING' || type === 'SQL' ? 10 : 5,
    negativeMarks: 0,
    explanation: '',
    isCollapsed: false,
    options: [
      { id: 'opt_1', text: '', isCorrect: true },
      { id: 'opt_2', text: '', isCorrect: false },
      { id: 'opt_3', text: '', isCorrect: false },
      { id: 'opt_4', text: '', isCorrect: false },
    ],
    answerKey: 'opt_1',
    evaluationConfig: {
      scoringPolicy: 'ALL_OR_NOTHING',
      caseSensitive: false,
      acceptedAnswers: [],
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
  };
};

export default function TestCreatorStudio() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id: editId } = useParams();

  // Test Type: 'assessment' | 'mock'
  const initialType = searchParams.get('type') === 'mock' ? 'mock' : 'assessment';
  const [testType, setTestType] = useState(initialType);
  const [status, setStatus] = useState('draft');

  // Subjects & Topics state
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingTopics, setLoadingTopics] = useState(false);

  // Form Details
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);

  // Assessment-specific fields
  const [assessmentCategory, setAssessmentCategory] = useState('General');
  const [passingScore, setPassingScore] = useState(60);
  const [accessType, setAccessType] = useState('public');
  const [scheduledAt, setScheduledAt] = useState('');
  const [deadlineAt, setDeadlineAt] = useState('');
  const [proctoringEnabled, setProctoringEnabled] = useState(false);
  const [cameraRequired, setCameraRequired] = useState(false);
  const [randomization, setRandomization] = useState(false);

  // Mock-specific fields
  const [examination, setExamination] = useState('GATE');
  const [selectedTopicIds, setSelectedTopicIds] = useState([]);
  const [difficultyDistribution, setDifficultyDistribution] = useState({ easy: 30, medium: 50, hard: 20 });
  const [negativeMarking, setNegativeMarking] = useState(true);
  const [negativeMarkingRatio, setNegativeMarkingRatio] = useState(0.33);

  // Questions List
  const [questions, setQuestions] = useState([createNewQuestion('SINGLE_MCQ', 1)]);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewQuestionIndex, setPreviewQuestionIndex] = useState(0);

  // Load available subjects
  useEffect(() => {
    async function fetchSubjects() {
      try {
        setLoadingSubjects(true);
        const res = await uapQuestionBankService.getSubjects();
        const subList = res.data || [];
        setSubjects(subList);
        if (subList.length > 0 && !subjectId) {
          setSubjectId(subList[0]._id || subList[0].id);
        }
      } catch (_err) {
        setSubjects([]);
      } finally {
        setLoadingSubjects(false);
      }
    }
    fetchSubjects();
  }, []);

  // Fetch topics when subjectId changes
  useEffect(() => {
    if (subjectId) {
      async function fetchTopics() {
        try {
          setLoadingTopics(true);
          const res = await uapQuestionBankService.getTopics({ subjectId });
          setTopics(res.data || []);
        } catch (_err) {
          setTopics([]);
        } finally {
          setLoadingTopics(false);
        }
      }
      fetchTopics();
    }
  }, [subjectId]);

  // Load existing test if edit mode
  useEffect(() => {
    if (editId) {
      async function loadExistingTest() {
        try {
          if (testType === 'assessment') {
            const res = await assessmentService.getAssessmentById(editId);
            const asmt = res.data || res;
            setTitle(asmt.title || '');
            setDescription(asmt.description || '');
            setSubjectId(asmt.subjectId || '');
            setDurationMinutes(asmt.durationMinutes || 60);
            setStatus(asmt.status || 'draft');
            setAssessmentCategory(asmt.category || 'General');
            setPassingScore(asmt.passingScore || 60);
            setAccessType(asmt.accessType || 'public');
            setProctoringEnabled(Boolean(asmt.proctoringEnabled));
            setCameraRequired(Boolean(asmt.cameraRequired));
            if (asmt.questions && asmt.questions.length > 0) {
              setQuestions(
                asmt.questions.map((q, idx) => ({
                  clientId: `q_loaded_${idx}`,
                  statement: q.questionText || q.statement || '',
                  questionType: mapBackendTypeToStudio(q.type),
                  difficulty: q.difficulty || 'MEDIUM',
                  marks: q.points || 5,
                  negativeMarks: 0,
                  explanation: q.explanation || '',
                  isCollapsed: false,
                  options: q.options || [],
                  answerKey: q.correctAnswer || 'opt_1',
                  evaluationConfig: {
                    allowedLanguages: q.codingConfig?.allowedLanguages || ['python', 'javascript'],
                    defaultLanguage: q.codingConfig?.defaultLanguage || 'python',
                    sqlDialect: q.codingConfig?.sqlDialect || 'sqlite',
                    schemaDdl: q.codingConfig?.schemaDdl || '',
                    testCases: q.codingConfig?.testCases || [],
                    rubric: [],
                    fileUploadConfig: q.fileUploadConfig || { allowedFileTypes: ['.pdf', '.docx'] },
                  },
                }))
              );
            }
          }
        } catch (err) {
          toast.error('Failed to load test details.');
        }
      }
      loadExistingTest();
    }
  }, [editId, testType]);

  // Derived metrics
  const totalMarks = useMemo(() => {
    return questions.reduce((acc, q) => acc + (Number(q.marks) || 0), 0);
  }, [questions]);

  // Helper map from backend type to studio type
  const mapBackendTypeToStudio = (backendType) => {
    switch (backendType) {
      case 'mcq':
        return 'SINGLE_MCQ';
      case 'multi_select':
        return 'MULTI_SELECT';
      case 'true_false':
        return 'TRUE_FALSE';
      case 'short_answer':
        return 'SHORT_ANSWER';
      case 'long_answer':
        return 'DESCRIPTIVE';
      case 'code':
        return 'CODING';
      case 'sql':
        return 'SQL';
      case 'file_upload':
        return 'FILE_UPLOAD';
      default:
        return 'SINGLE_MCQ';
    }
  };

  // Helper map from studio type to backend assessment type
  const mapStudioTypeToBackend = (studioType) => {
    switch (studioType) {
      case 'SINGLE_MCQ':
        return 'mcq';
      case 'MULTI_SELECT':
        return 'mcq';
      case 'TRUE_FALSE':
        return 'true_false';
      case 'SHORT_ANSWER':
        return 'short_answer';
      case 'DESCRIPTIVE':
        return 'long_answer';
      case 'CODING':
        return 'code';
      case 'SQL':
        return 'sql';
      case 'FILE_UPLOAD':
        return 'file_upload';
      case 'FILL_BLANK':
        return 'short_answer';
      default:
        return 'mcq';
    }
  };

  // --- QUESTION OPERATIONS ---

  // Add Question
  const handleAddQuestion = (type = 'SINGLE_MCQ') => {
    setQuestions((prev) => [...prev, createNewQuestion(type, prev.length + 1)]);
    toast.info(`Question #${questions.length + 1} added.`);
  };

  // Change Question Type
  const handleTypeChange = (idx, newType) => {
    setQuestions((prev) => {
      const updated = [...prev];
      const cur = updated[idx];
      updated[idx] = {
        ...cur,
        questionType: newType,
        // Reset or adapt options/testcases if switching to/from coding or sql
        evaluationConfig: {
          ...cur.evaluationConfig,
          allowedLanguages: ['python', 'javascript'],
          defaultLanguage: 'python',
          sqlDialect: 'sqlite',
        },
      };
      return updated;
    });
  };

  // Update simple question field
  const updateQuestionField = (idx, field, value) => {
    setQuestions((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  // Update evaluation config field
  const updateEvaluationConfig = (idx, field, value) => {
    setQuestions((prev) => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        evaluationConfig: {
          ...updated[idx].evaluationConfig,
          [field]: value,
        },
      };
      return updated;
    });
  };

  // Reorder question
  const handleMoveQuestion = (idx, direction) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= questions.length) return;
    setQuestions((prev) => {
      const updated = [...prev];
      const temp = updated[idx];
      updated[idx] = updated[targetIdx];
      updated[targetIdx] = temp;
      return updated;
    });
  };

  // Duplicate question
  const handleDuplicateQuestion = (idx) => {
    const target = questions[idx];
    const clone = {
      ...JSON.parse(JSON.stringify(target)),
      clientId: generateClientId(),
      statement: `${target.statement} (Copy)`.trim(),
    };
    setQuestions((prev) => {
      const updated = [...prev];
      updated.splice(idx + 1, 0, clone);
      return updated;
    });
    toast.success('Question duplicated.');
  };

  // Delete question
  const handleRemoveQuestion = (idx) => {
    if (questions.length <= 1) {
      toast.warning('A test must have at least one question.');
      return;
    }
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
    toast.info('Question removed.');
  };

  // Toggle Collapse
  const handleToggleCollapse = (idx) => {
    setQuestions((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], isCollapsed: !updated[idx].isCollapsed };
      return updated;
    });
  };

  // Options management for MCQ / Multi-select / True-False
  const handleAddOption = (qIdx) => {
    setQuestions((prev) => {
      const updated = [...prev];
      const cur = updated[qIdx];
      const optId = `opt_${(cur.options || []).length + 1}`;
      updated[qIdx] = {
        ...cur,
        options: [...(cur.options || []), { id: optId, text: '', isCorrect: false }],
      };
      return updated;
    });
  };

  const handleUpdateOptionText = (qIdx, optIdx, text) => {
    setQuestions((prev) => {
      const updated = [...prev];
      const opts = [...(updated[qIdx].options || [])];
      opts[optIdx] = { ...opts[optIdx], text };
      updated[qIdx] = { ...updated[qIdx], options: opts };
      return updated;
    });
  };

  const handleRemoveOption = (qIdx, optIdx) => {
    setQuestions((prev) => {
      const updated = [...prev];
      const cur = updated[qIdx];
      if ((cur.options || []).length <= 2) {
        toast.warning('Multiple-choice questions require at least 2 options.');
        return prev;
      }
      const opts = cur.options.filter((_, i) => i !== optIdx);
      updated[qIdx] = { ...cur, options: opts };
      return updated;
    });
  };

  const handleToggleCorrectOption = (qIdx, optId) => {
    setQuestions((prev) => {
      const updated = [...prev];
      const cur = updated[qIdx];
      const isMulti = cur.questionType === 'MULTI_SELECT';

      const opts = (cur.options || []).map((o) => {
        if (isMulti) {
          return o.id === optId ? { ...o, isCorrect: !o.isCorrect } : o;
        }
        return { ...o, isCorrect: o.id === optId };
      });

      updated[qIdx] = {
        ...cur,
        options: opts,
        answerKey: optId,
      };
      return updated;
    });
  };

  // Coding Test Cases management
  const handleAddTestCase = (qIdx, isHidden = false) => {
    setQuestions((prev) => {
      const updated = [...prev];
      const cur = updated[qIdx];
      const tc = cur.evaluationConfig?.testCases || [];
      const newCase = {
        input: '',
        expectedOutput: '',
        isHidden,
        weight: isHidden ? 2 : 1,
        description: isHidden ? 'Hidden Evaluation Case' : 'Public Sample Case',
      };
      updated[qIdx] = {
        ...cur,
        evaluationConfig: {
          ...cur.evaluationConfig,
          testCases: [...tc, newCase],
        },
      };
      return updated;
    });
  };

  const handleUpdateTestCase = (qIdx, tcIdx, field, val) => {
    setQuestions((prev) => {
      const updated = [...prev];
      const cur = updated[qIdx];
      const tcList = [...(cur.evaluationConfig?.testCases || [])];
      tcList[tcIdx] = { ...tcList[tcIdx], [field]: val };
      updated[qIdx] = {
        ...cur,
        evaluationConfig: {
          ...cur.evaluationConfig,
          testCases: tcList,
        },
      };
      return updated;
    });
  };

  const handleRemoveTestCase = (qIdx, tcIdx) => {
    setQuestions((prev) => {
      const updated = [...prev];
      const cur = updated[qIdx];
      const tcList = (cur.evaluationConfig?.testCases || []).filter((_, i) => i !== tcIdx);
      updated[qIdx] = {
        ...cur,
        evaluationConfig: {
          ...cur.evaluationConfig,
          testCases: tcList,
        },
      };
      return updated;
    });
  };

  // Descriptive Rubric management
  const handleAddRubricCriterion = (qIdx) => {
    setQuestions((prev) => {
      const updated = [...prev];
      const cur = updated[qIdx];
      const rub = cur.evaluationConfig?.rubric || [];
      updated[qIdx] = {
        ...cur,
        evaluationConfig: {
          ...cur.evaluationConfig,
          rubric: [...rub, { criterion: '', maxMarks: 5, description: '' }],
        },
      };
      return updated;
    });
  };

  const handleUpdateRubricCriterion = (qIdx, rIdx, field, val) => {
    setQuestions((prev) => {
      const updated = [...prev];
      const cur = updated[qIdx];
      const rub = [...(cur.evaluationConfig?.rubric || [])];
      rub[rIdx] = { ...rub[rIdx], [field]: val };
      updated[qIdx] = {
        ...cur,
        evaluationConfig: {
          ...cur.evaluationConfig,
          rubric: rub,
        },
      };
      return updated;
    });
  };

  const handleRemoveRubricCriterion = (qIdx, rIdx) => {
    setQuestions((prev) => {
      const updated = [...prev];
      const cur = updated[qIdx];
      const rub = (cur.evaluationConfig?.rubric || []).filter((_, i) => i !== rIdx);
      updated[qIdx] = {
        ...cur,
        evaluationConfig: {
          ...cur.evaluationConfig,
          rubric: rub,
        },
      };
      return updated;
    });
  };

  // --- VALIDATION, SAVE DRAFT & PUBLISH ---

  const validateTestForm = (isPublishingMode = false) => {
    if (!title.trim()) {
      toast.error('Please enter a test title.');
      return false;
    }
    if (!subjectId) {
      toast.error('Please select a subject.');
      return false;
    }

    if (isPublishingMode) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.statement.trim()) {
          toast.error(`Question #${i + 1} statement is empty.`);
          return false;
        }
        if (q.questionType === 'SINGLE_MCQ' || q.questionType === 'MULTI_SELECT') {
          const emptyOpts = (q.options || []).some((o) => !o.text.trim());
          if (emptyOpts) {
            toast.error(`Question #${i + 1} has options with empty text.`);
            return false;
          }
          const hasCorrect = (q.options || []).some((o) => o.isCorrect);
          if (!hasCorrect) {
            toast.error(`Question #${i + 1} must mark at least one correct option.`);
            return false;
          }
        }
        if (q.questionType === 'CODING') {
          const tc = q.evaluationConfig?.testCases || [];
          if (tc.length === 0) {
            toast.error(`Coding Question #${i + 1} must have at least one test case.`);
            return false;
          }
        }
      }
    }
    return true;
  };

  const handleSaveDraft = async () => {
    if (!validateTestForm(false)) return;

    try {
      setIsSaving(true);
      if (testType === 'assessment') {
        const payload = {
          title: title.trim(),
          description: description.trim(),
          category: assessmentCategory,
          durationMinutes: Number(durationMinutes) || 60,
          passingScore: Number(passingScore) || 60,
          accessType,
          scheduledAt: scheduledAt || undefined,
          deadlineAt: deadlineAt || undefined,
          proctoringEnabled,
          cameraRequired,
          randomization: { enabled: randomization, shuffleOrder: randomization },
          status: 'draft',
          questions: questions.map((q, idx) => ({
            questionText: q.statement || `Question ${idx + 1}`,
            type: mapStudioTypeToBackend(q.questionType),
            options: (q.options || []).map((o) => ({ id: o.id, text: o.text || 'Option' })),
            correctAnswer:
              q.questionType === 'TRUE_FALSE'
                ? q.answerKey
                : q.options?.find((o) => o.isCorrect)?.id || 'opt_1',
            explanation: q.explanation || '',
            points: Number(q.marks) || 5,
            orderIndex: idx,
            codingConfig:
              q.questionType === 'CODING' || q.questionType === 'SQL'
                ? {
                    executionCategory: q.questionType === 'SQL' ? 'sql' : 'code',
                    allowedLanguages: q.evaluationConfig?.allowedLanguages || ['python', 'javascript'],
                    defaultLanguage: q.evaluationConfig?.defaultLanguage || 'python',
                    sqlDialect: q.evaluationConfig?.sqlDialect || 'sqlite',
                    schemaDdl: q.evaluationConfig?.schemaDdl || '',
                    testCases: q.evaluationConfig?.testCases || [],
                  }
                : undefined,
            fileUploadConfig:
              q.questionType === 'FILE_UPLOAD'
                ? q.evaluationConfig?.fileUploadConfig
                : undefined,
          })),
        };

        if (editId) {
          await assessmentService.updateAssessment(editId, payload);
        } else {
          await assessmentService.createAssessment(payload);
        }
        toast.success(`Draft saved for "${title.trim()}".`);
      } else {
        // Mock Test payload
        const payload = {
          title: title.trim(),
          description: description.trim(),
          examination,
          subjectId,
          topicIds: selectedTopicIds,
          durationMinutes: Number(durationMinutes) || 60,
          totalMarks: totalMarks || 100,
          questionCount: questions.length,
          difficultyDistribution,
          negativeMarking,
          negativeMarkingRatio: Number(negativeMarkingRatio) || 0.33,
        };

        if (editId) {
          await uapQuestionBankService.updateMockTest(editId, payload);
        } else {
          await uapQuestionBankService.createMockTest(payload);
        }
        toast.success(`Mock test draft saved for "${title.trim()}".`);
      }
      setStatus('draft');
    } catch (err) {
      toast.error('Failed to save draft: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!validateTestForm(true)) return;

    try {
      setIsPublishing(true);
      if (testType === 'assessment') {
        const payload = {
          title: title.trim(),
          description: description.trim(),
          category: assessmentCategory,
          durationMinutes: Number(durationMinutes) || 60,
          passingScore: Number(passingScore) || 60,
          accessType,
          scheduledAt: scheduledAt || undefined,
          deadlineAt: deadlineAt || undefined,
          proctoringEnabled,
          cameraRequired,
          randomization: { enabled: randomization, shuffleOrder: randomization },
          status: 'published',
          questions: questions.map((q, idx) => ({
            questionText: q.statement || `Question ${idx + 1}`,
            type: mapStudioTypeToBackend(q.questionType),
            options: (q.options || []).map((o) => ({ id: o.id, text: o.text || 'Option' })),
            correctAnswer:
              q.questionType === 'TRUE_FALSE'
                ? q.answerKey
                : q.options?.find((o) => o.isCorrect)?.id || 'opt_1',
            explanation: q.explanation || '',
            points: Number(q.marks) || 5,
            orderIndex: idx,
            codingConfig:
              q.questionType === 'CODING' || q.questionType === 'SQL'
                ? {
                    executionCategory: q.questionType === 'SQL' ? 'sql' : 'code',
                    allowedLanguages: q.evaluationConfig?.allowedLanguages || ['python', 'javascript'],
                    defaultLanguage: q.evaluationConfig?.defaultLanguage || 'python',
                    sqlDialect: q.evaluationConfig?.sqlDialect || 'sqlite',
                    schemaDdl: q.evaluationConfig?.schemaDdl || '',
                    testCases: q.evaluationConfig?.testCases || [],
                  }
                : undefined,
            fileUploadConfig:
              q.questionType === 'FILE_UPLOAD'
                ? q.evaluationConfig?.fileUploadConfig
                : undefined,
          })),
        };

        if (editId) {
          await assessmentService.updateAssessment(editId, payload);
        } else {
          await assessmentService.createAssessment(payload);
        }
        toast.success(`Assessment "${title.trim()}" published live!`);
        navigate('/instructor/assessments');
      } else {
        // Mock Test publish
        const payload = {
          title: title.trim(),
          description: description.trim(),
          examination,
          subjectId,
          topicIds: selectedTopicIds,
          durationMinutes: Number(durationMinutes) || 60,
          totalMarks: totalMarks || 100,
          questionCount: questions.length,
          difficultyDistribution,
          negativeMarking,
          negativeMarkingRatio: Number(negativeMarkingRatio) || 0.33,
        };

        let targetId = editId;
        if (!targetId) {
          const createRes = await uapQuestionBankService.createMockTest(payload);
          targetId = createRes.data?._id || createRes.data?.id;
        } else {
          await uapQuestionBankService.updateMockTest(targetId, payload);
        }

        if (targetId) {
          await uapQuestionBankService.generateMockTestBlueprint(targetId);
          await uapQuestionBankService.publishMockTest(targetId);
        }
        toast.success(`Mock Test "${title.trim()}" generated and published!`);
        navigate('/instructor/assessments');
      }
    } catch (err) {
      toast.error('Failed to publish: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-6 pb-16 max-w-6xl mx-auto" data-testid="test-creator-studio">
      {/* Studio Header */}
      <div className="rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark p-5 sm:p-6 shadow-warm-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 mb-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Link to="/instructor/create-test" className="hover:text-brand-primary flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" />
                Create Test Hub
              </Link>
              <span>/</span>
              <span className="text-slate-800 dark:text-slate-200">Studio</span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-slate-900 dark:text-white">
                Test Creator Studio
              </h1>
              <Badge variant={testType === 'assessment' ? 'primary' : 'sage'} size="sm">
                {testType === 'assessment' ? 'Course Assessment' : 'Mock Test'}
              </Badge>
              <Badge variant={status === 'published' ? 'sage' : 'neutral'} size="sm">
                {status === 'published' ? 'Published' : 'Draft'}
              </Badge>
              <Badge variant="neutral" size="sm">
                {questions.length} Question{questions.length !== 1 ? 's' : ''}
              </Badge>
              <Badge variant="neutral" size="sm">
                {totalMarks} Marks
              </Badge>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              icon={Eye}
              onClick={() => {
                setPreviewQuestionIndex(0);
                setIsPreviewOpen(true);
              }}
            >
              Student Preview
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={Save}
              loading={isSaving}
              onClick={handleSaveDraft}
              data-testid="btn-save-draft"
            >
              Save Draft
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Send}
              loading={isPublishing}
              onClick={handlePublish}
              data-testid="btn-publish"
            >
              Publish
            </Button>
          </div>
        </div>
      </div>

      {/* Test Details Section */}
      <Card title="Test Details" subtitle="Basic test metadata and scoring parameters">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Test Name */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Test Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Distributed Systems Midterm Examination"
                className="w-full p-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-brand-primary focus:outline-none"
              />
            </div>

            {/* Test Type selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Test Type
              </label>
              <select
                value={testType}
                onChange={(e) => setTestType(e.target.value)}
                className="w-full p-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-brand-primary focus:outline-none"
              >
                <option value="assessment">Course Assessment</option>
                <option value="mock">Mock Test (Practice)</option>
              </select>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Subject <span className="text-rose-500">*</span>
              </label>
              <select
                value={subjectId}
                onChange={(e) => {
                  setSubjectId(e.target.value);
                  setSelectedTopicIds([]);
                }}
                className="w-full p-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-brand-primary focus:outline-none"
              >
                <option value="">Select subject...</option>
                {subjects.map((s) => (
                  <option key={s._id || s.id} value={s._id || s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            {/* Duration */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Duration (Minutes)
              </label>
              <input
                type="number"
                min="5"
                max="360"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="w-full p-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            {/* Total Marks (read-only display) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Total Marks
              </label>
              <div className="p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-slate-800 dark:text-slate-200 font-bold">
                {totalMarks} Marks ({questions.length} Questions)
              </div>
            </div>

            {/* Assessment or Mock category */}
            <div>
              {testType === 'assessment' ? (
                <>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Assessment Category
                  </label>
                  <select
                    value={assessmentCategory}
                    onChange={(e) => setAssessmentCategory(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {ASSESSMENT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target Examination
                  </label>
                  <select
                    value={examination}
                    onChange={(e) => setExamination(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {EXAM_CATEGORIES.map((ex) => (
                      <option key={ex} value={ex}>
                        {ex}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </div>

          {/* Conditional: Assessment-Specific Configuration */}
          {testType === 'assessment' && (
            <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Assessment Rules & Scheduling
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Access Type
                  </label>
                  <select
                    value={accessType}
                    onChange={(e) => setAccessType(e.target.value)}
                    className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="public">Public (All Enrolled Students)</option>
                    <option value="restricted">Restricted (Assigned Roster Only)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Passing Score (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={passingScore}
                    onChange={(e) => setPassingScore(e.target.value)}
                    className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div className="flex flex-col justify-end space-y-1.5 pb-1">
                  <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={proctoringEnabled}
                      onChange={(e) => setProctoringEnabled(e.target.checked)}
                      className="rounded text-brand-primary"
                    />
                    <span>Proctoring Monitoring</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cameraRequired}
                      onChange={(e) => setCameraRequired(e.target.checked)}
                      className="rounded text-brand-primary"
                    />
                    <span>Webcam Required</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Conditional: Mock Test-Specific Blueprint Configuration */}
          {testType === 'mock' && (
            <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Blueprint Distribution & Rules
              </span>

              {/* Topics Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Scope Topics (Optional: Leave empty for all subject topics)
                </label>
                <div className="max-h-24 overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded-lg space-y-1 bg-slate-50 dark:bg-slate-800/40">
                  {topics.length === 0 ? (
                    <span className="text-[11px] text-slate-400">No specific topics found for this subject.</span>
                  ) : (
                    topics.map((t) => (
                      <label key={t._id || t.id} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedTopicIds.includes(t._id || t.id)}
                          onChange={(e) => {
                            const tid = t._id || t.id;
                            setSelectedTopicIds((prev) =>
                              e.target.checked ? [...prev, tid] : prev.filter((id) => id !== tid)
                            );
                          }}
                          className="w-3.5 h-3.5 rounded text-brand-sage focus:ring-brand-sage"
                        />
                        <span>{t.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Sliders for Easy / Med / Hard */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
                <div>
                  <label className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    Easy: {difficultyDistribution.easy}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={difficultyDistribution.easy}
                    onChange={(e) =>
                      setDifficultyDistribution((prev) => ({ ...prev, easy: Number(e.target.value) }))
                    }
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                    Medium: {difficultyDistribution.medium}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={difficultyDistribution.medium}
                    onChange={(e) =>
                      setDifficultyDistribution((prev) => ({ ...prev, medium: Number(e.target.value) }))
                    }
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                    Hard: {difficultyDistribution.hard}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={difficultyDistribution.hard}
                    onChange={(e) =>
                      setDifficultyDistribution((prev) => ({ ...prev, hard: Number(e.target.value) }))
                    }
                    className="w-full"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="mock-neg-marking"
                  checked={negativeMarking}
                  onChange={(e) => setNegativeMarking(e.target.checked)}
                  className="rounded text-brand-sage"
                />
                <label htmlFor="mock-neg-marking" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  Apply Negative Marking (-0.33x on incorrect attempts)
                </label>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* =========================================================================
          QUESTION AUTHORING SECTION (Reusing Mock Bank Studio Capabilities)
         ========================================================================= */}
      <div className="space-y-4">
        {/* Section Header with Add Question button at Top */}
        <div className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark shadow-warm-xs">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold font-display text-slate-900 dark:text-white">
              Questions
            </h2>
            <Badge variant="primary" size="sm">
              {questions.length} Items
            </Badge>
            <Badge variant="neutral" size="sm">
              {totalMarks} Total Marks
            </Badge>
          </div>

          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => handleAddQuestion('SINGLE_MCQ')}
            data-testid="btn-add-question-top"
          >
            Add Question
          </Button>
        </div>

        {/* Questions Cards List */}
        <div className="space-y-4">
          {questions.map((q, qIdx) => {
            const isCollapsed = q.isCollapsed;

            return (
              <div
                key={q.clientId}
                data-testid={`question-card-${qIdx}`}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-warm-xs overflow-hidden transition-all"
              >
                {/* Question Card Header */}
                <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
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

                    {/* Question Type Dropdown */}
                    <select
                      value={q.questionType}
                      onChange={(e) => handleTypeChange(qIdx, e.target.value)}
                      className="p-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                      data-testid={`question-type-select-${qIdx}`}
                    >
                      {QUESTION_TYPES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>

                    {/* Marks Input */}
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-slate-500 font-medium">Marks:</span>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={q.marks}
                        onChange={(e) => updateQuestionField(qIdx, 'marks', Number(e.target.value))}
                        className="w-14 p-1 text-xs text-center font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>

                    {/* Difficulty */}
                    <select
                      value={q.difficulty}
                      onChange={(e) => updateQuestionField(qIdx, 'difficulty', e.target.value)}
                      className="p-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                      {DIFFICULTIES.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Question Controls: Move Up, Move Down, Duplicate, Delete */}
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
                        title="Delete Question"
                        className="p-1 rounded text-slate-400 hover:text-rose-500 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Collapsed Snippet */}
                {isCollapsed && (
                  <div
                    onClick={() => handleToggleCollapse(qIdx)}
                    className="p-3 bg-white dark:bg-slate-900 cursor-pointer flex items-center justify-between text-xs text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-200 line-clamp-1">
                      {q.statement || '(No statement entered yet)'}
                    </span>
                    <span className="text-[11px] text-slate-400 ml-2 shrink-0">
                      {q.marks} Marks · {q.difficulty}
                    </span>
                  </div>
                )}

                {/* Expanded Card Body */}
                {!isCollapsed && (
                  <div className="p-4 sm:p-5 space-y-4">
                    {/* Statement Prompt */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Question Statement <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        rows={3}
                        value={q.statement}
                        onChange={(e) => updateQuestionField(qIdx, 'statement', e.target.value)}
                        placeholder="Enter question statement or instructions..."
                        className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-1 focus:ring-brand-primary focus:outline-none"
                      />
                    </div>

                    {/* --- TYPE-SPECIFIC FIELDS --- */}

                    {/* 1. MCQ / MULTI_SELECT / TRUE_FALSE */}
                    {(q.questionType === 'SINGLE_MCQ' ||
                      q.questionType === 'MULTI_SELECT' ||
                      q.questionType === 'TRUE_FALSE') && (
                      <div className="space-y-3 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {q.questionType === 'TRUE_FALSE' ? 'True / False Key' : 'Answer Choices'}
                          </span>
                          {q.questionType !== 'TRUE_FALSE' && (
                            <button
                              type="button"
                              onClick={() => handleAddOption(qIdx)}
                              className="px-2 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-brand-primary dark:text-brand-peach hover:bg-brand-primary/10 transition flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              Add Option
                            </button>
                          )}
                        </div>

                        {q.questionType === 'TRUE_FALSE' ? (
                          <div className="flex items-center gap-4 pt-1">
                            {['True', 'False'].map((val) => (
                              <label key={val} className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`tf_${q.clientId}`}
                                  checked={q.answerKey === val}
                                  onChange={() => updateQuestionField(qIdx, 'answerKey', val)}
                                  className="w-4 h-4 text-brand-primary"
                                />
                                <span>{val}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {(q.options || []).map((opt, optIdx) => (
                              <div key={opt.id || optIdx} className="flex items-center gap-2">
                                <input
                                  type={q.questionType === 'MULTI_SELECT' ? 'checkbox' : 'radio'}
                                  name={`correct_opt_${q.clientId}`}
                                  checked={Boolean(opt.isCorrect)}
                                  onChange={() => handleToggleCorrectOption(qIdx, opt.id)}
                                  title="Mark as correct answer"
                                  className="w-4 h-4 text-brand-primary cursor-pointer shrink-0"
                                />
                                <span className="text-xs font-bold text-slate-500 w-5 text-center">
                                  {String.fromCharCode(65 + optIdx)}
                                </span>
                                <input
                                  type="text"
                                  value={opt.text}
                                  onChange={(e) => handleUpdateOptionText(qIdx, optIdx, e.target.value)}
                                  placeholder={`Option ${String.fromCharCode(65 + optIdx)} text...`}
                                  className="flex-1 p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                />
                                {(q.options || []).length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveOption(qIdx, optIdx)}
                                    className="p-1.5 text-slate-400 hover:text-rose-500 transition"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 2. Coding Challenge */}
                    {q.questionType === 'CODING' && (
                      <div className="space-y-3 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            Test Cases (Public & Hidden)
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleAddTestCase(qIdx, false)}
                              className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-brand-primary dark:text-brand-peach hover:bg-brand-primary/10 transition"
                            >
                              + Public Sample
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
                              className={`p-3 rounded-xl border text-xs space-y-2 ${
                                tc.isHidden
                                  ? 'border-slate-300 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/40'
                                  : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    tc.isHidden
                                      ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                                      : 'bg-brand-primary/10 text-brand-primary dark:text-brand-peach'
                                  }`}
                                >
                                  {tc.isHidden ? 'HIDDEN EVALUATION CASE' : 'PUBLIC SAMPLE CASE'} #{tcIdx + 1}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <label className="text-[11px] text-slate-500">Weight:</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={tc.weight || 1}
                                    onChange={(e) => handleUpdateTestCase(qIdx, tcIdx, 'weight', Number(e.target.value))}
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
                                    className="w-full p-1.5 rounded border border-slate-300 dark:border-slate-700 font-mono text-[11px] bg-white dark:bg-slate-800"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-slate-500 font-medium">Expected Output (stdout):</label>
                                  <textarea
                                    rows={2}
                                    value={tc.expectedOutput || ''}
                                    onChange={(e) => handleUpdateTestCase(qIdx, tcIdx, 'expectedOutput', e.target.value)}
                                    className="w-full p-1.5 rounded border border-slate-300 dark:border-slate-700 font-mono text-[11px] bg-white dark:bg-slate-800"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 3. SQL Query Challenge */}
                    {q.questionType === 'SQL' && (
                      <div className="space-y-3 pt-1">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          SQL Database Setup & Test Script
                        </span>
                        <div>
                          <label className="text-[10px] text-slate-500 font-medium">Schema DDL Setup Script:</label>
                          <textarea
                            rows={3}
                            value={q.evaluationConfig?.schemaDdl || ''}
                            onChange={(e) => updateEvaluationConfig(qIdx, 'schemaDdl', e.target.value)}
                            placeholder="CREATE TABLE students (id INT PRIMARY KEY, name TEXT, gpa REAL); INSERT INTO students VALUES (1, 'Alice', 3.9);"
                            className="w-full p-2 font-mono text-[11px] rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                          />
                        </div>
                      </div>
                    )}

                    {/* 4. Descriptive / Essay Rubric */}
                    {q.questionType === 'DESCRIPTIVE' && (
                      <div className="space-y-3 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            Evaluation Rubric Criteria
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddRubricCriterion(qIdx)}
                            className="px-2 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-brand-primary dark:text-brand-peach hover:bg-brand-primary/10 transition flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Add Criterion
                          </button>
                        </div>
                        <div className="space-y-2">
                          {(q.evaluationConfig?.rubric || []).map((r, rIdx) => (
                            <div key={rIdx} className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 flex items-center gap-2">
                              <input
                                type="text"
                                value={r.criterion}
                                onChange={(e) => handleUpdateRubricCriterion(qIdx, rIdx, 'criterion', e.target.value)}
                                placeholder="Criterion name..."
                                className="flex-1 p-1 text-xs font-semibold rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                              />
                              <input
                                type="number"
                                min="1"
                                value={r.maxMarks}
                                onChange={(e) => handleUpdateRubricCriterion(qIdx, rIdx, 'maxMarks', Number(e.target.value))}
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
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Explanation */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Explanation / Solution Note (Optional)
                      </label>
                      <input
                        type="text"
                        value={q.explanation || ''}
                        onChange={(e) => updateQuestionField(qIdx, 'explanation', e.target.value)}
                        placeholder="Explanatory note shown to students after review is permitted..."
                        className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add Question Button at Bottom of Questions List */}
        <div className="pt-2">
          <Button
            variant="outline"
            size="md"
            icon={Plus}
            onClick={() => handleAddQuestion('SINGLE_MCQ')}
            className="w-full justify-center border-dashed hover:border-brand-primary hover:bg-brand-primary/5"
            data-testid="btn-add-question-bottom"
          >
            Add Question
          </Button>
        </div>
      </div>

      {/* =========================================================================
          STUDENT PREVIEW MODAL
         ========================================================================= */}
      {isPreviewOpen && (
        <Modal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          title="Student Examination Preview"
          size="xl"
        >
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {/* Header info */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {title || 'Untitled Test'}
                </h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                  <span>{durationMinutes} Minutes</span>
                  <span>·</span>
                  <span>{totalMarks} Total Marks</span>
                  <span>·</span>
                  <span>{questions.length} Questions</span>
                </div>
              </div>
              <Badge variant={testType === 'assessment' ? 'primary' : 'sage'} size="sm">
                {testType === 'assessment' ? 'Assessment' : 'Mock Test'}
              </Badge>
            </div>

            {/* Question pagination pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
              {questions.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPreviewQuestionIndex(idx)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                    previewQuestionIndex === idx
                      ? 'bg-brand-primary text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Q{idx + 1}
                </button>
              ))}
            </div>

            {/* Active Question Preview */}
            {questions[previewQuestionIndex] && (
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Question {previewQuestionIndex + 1} of {questions.length}
                  </span>
                  <span className="text-xs font-bold text-brand-primary">
                    {questions[previewQuestionIndex].marks} Marks
                  </span>
                </div>

                <div className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-medium">
                  {questions[previewQuestionIndex].statement || '(Empty question statement)'}
                </div>

                {/* Multiple choice options (confidential answer keys NOT revealed) */}
                {(questions[previewQuestionIndex].questionType === 'SINGLE_MCQ' ||
                  questions[previewQuestionIndex].questionType === 'MULTI_SELECT' ||
                  questions[previewQuestionIndex].questionType === 'TRUE_FALSE') && (
                  <div className="space-y-2 pt-2">
                    {questions[previewQuestionIndex].questionType === 'TRUE_FALSE' ? (
                      ['True', 'False'].map((opt) => (
                        <div key={opt} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                          <input type="radio" name="preview_tf" className="w-4 h-4 text-brand-primary" />
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{opt}</span>
                        </div>
                      ))
                    ) : (
                      (questions[previewQuestionIndex].options || []).map((opt, oi) => (
                        <div key={opt.id || oi} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <input
                            type={questions[previewQuestionIndex].questionType === 'MULTI_SELECT' ? 'checkbox' : 'radio'}
                            name="preview_opt"
                            className="w-4 h-4 text-brand-primary"
                          />
                          <span className="text-xs font-bold text-slate-500">{String.fromCharCode(65 + oi)}.</span>
                          <span className="text-xs text-slate-800 dark:text-slate-200">{opt.text || `Option ${oi + 1}`}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Coding challenge preview: ONLY public cases shown, hidden cases are strictly hidden */}
                {questions[previewQuestionIndex].questionType === 'CODING' && (
                  <div className="space-y-3 pt-2">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                        Sample Public Test Cases
                      </span>
                      {(questions[previewQuestionIndex].evaluationConfig?.testCases || [])
                        .filter((tc) => !tc.isHidden)
                        .map((tc, tci) => (
                          <div key={tci} className="text-xs font-mono p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            <div><strong className="text-slate-500">Input:</strong> {tc.input}</div>
                            <div><strong className="text-slate-500">Expected:</strong> {tc.expectedOutput}</div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
