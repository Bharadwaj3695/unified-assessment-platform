import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import assessmentService from '../../services/assessment.service';
import StudentSelector from '../../components/instructor/StudentSelector';
import GradingSchemeEditor from '../../components/instructor/GradingSchemeEditor';
import { DEFAULT_GRADING_SCHEME, validateGradingScheme } from '../../utils/gradingScheme';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import PageLoader from '../../components/ui/PageLoader';
import Alert from '../../components/ui/Alert';
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Save,
  Send,
  ArrowLeft,
  Clock,
  Award,
  Globe,
  Lock,
  ListChecks,
  AlignLeft,
  FileText,
  X,
  Shield,
  Camera,
  Upload,
  Database,
  Shuffle,
  CheckCircle,
  HelpCircle,
  Layers,
  Sparkles,
} from 'lucide-react';
import QuestionBankPickerModal from '../../components/modals/QuestionBankPickerModal';

const CATEGORIES = [
  'Computer Science',
  'Software Engineering',
  'Data Structures & Algorithms',
  'Cybersecurity',
  'DevOps & Cloud',
  'Artificial Intelligence',
  'Database Systems',
  'Web Development',
  'General',
];

const AssessmentBuilder = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Computer Science');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [passingScore, setPassingScore] = useState(60);
  const [accessType, setAccessType] = useState('public');
  const [assignedStudents, setAssignedStudents] = useState([]);
  const [proctoringEnabled, setProctoringEnabled] = useState(false);
  const [cameraRequired, setCameraRequired] = useState(false);
  const [status, setStatus] = useState('draft');
  const [randomization, setRandomization] = useState({
    enabled: false,
    poolCount: '',
    shuffleOrder: true,
  });
  const [certification, setCertification] = useState({
    enabled: false,
    passingPercentage: 50,
    gradingScheme: DEFAULT_GRADING_SCHEME.map((b) => ({ ...b })),
    templateId: null,
    certificateTitle: '',
    signatoryName: '',
    signatoryTitle: 'Dean of Academic Affairs',
  });
  const [isQuestionBankModalOpen, setIsQuestionBankModalOpen] = useState(false);

  // Questions State
  const [questions, setQuestions] = useState([
    {
      id: 'temp-1',
      questionText: '',
      type: 'mcq',
      points: 5,
      options: [
        { id: 'opt_1', text: '' },
        { id: 'opt_2', text: '' },
        { id: 'opt_3', text: '' },
        { id: 'opt_4', text: '' },
      ],
      correctAnswer: 'opt_1',
      explanation: '',
    },
  ]);

  // Expand / Collapse State for Questions
  const [expandedQuestions, setExpandedQuestions] = useState({ 'temp-1': true });

  // Delete Question Confirmation Modal State
  const [questionToDelete, setQuestionToDelete] = useState(null);

  // Loading & Submission State
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [confirmPublishModal, setConfirmPublishModal] = useState(false);

  // Load existing assessment if in edit mode
  useEffect(() => {
    if (!isEditMode) return;

    let mounted = true;
    const fetchAssessment = async () => {
      try {
        setIsLoading(true);
        const data = await assessmentService.getAssessmentById(id);
        if (mounted && data) {
          setTitle(data.title || '');
          setDescription(data.description || '');
          setCategory(data.category || 'Computer Science');
          setDurationMinutes(data.durationMinutes || 60);
          setPassingScore(data.passingScore || 60);
          setAccessType(data.accessType || 'public');
          setAssignedStudents(
            data.assignedStudents?.map((s) => (s._id || s.id || s).toString()) || []
          );
          setProctoringEnabled(Boolean(data.proctoringEnabled));
          setCameraRequired(Boolean(data.cameraRequired));
          setStatus(data.status || 'draft');
          if (data.randomization) {
            setRandomization({
              enabled: Boolean(data.randomization.enabled),
              poolCount: data.randomization.poolCount || '',
              shuffleOrder: data.randomization.shuffleOrder ?? true,
            });
          }
          if (data.certification) {
            setCertification({
              enabled: Boolean(data.certification.enabled),
              passingPercentage: data.certification.passingPercentage ?? 50,
              gradingScheme:
                data.certification.gradingScheme && data.certification.gradingScheme.length > 0
                  ? data.certification.gradingScheme
                  : DEFAULT_GRADING_SCHEME.map((b) => ({ ...b })),
              templateId: data.certification.templateId?._id || data.certification.templateId || null,
              certificateTitle: data.certification.certificateTitle || '',
              signatoryName: data.certification.signatoryName || '',
              signatoryTitle: data.certification.signatoryTitle || 'Dean of Academic Affairs',
            });
          }

          if (data.questions && data.questions.length > 0) {
            const loadedQuestions = data.questions.map((q, idx) => ({
              id: q._id || q.id || `q-${idx}`,
              questionText: q.questionText || '',
              type: q.type || 'mcq',
              points: q.points || 5,
              options:
                q.options && q.options.length > 0
                  ? q.options.map((opt, oIdx) => ({
                      id: opt.id || `opt_${oIdx + 1}`,
                      text: opt.text || '',
                    }))
                  : [
                      { id: 'opt_1', text: '' },
                      { id: 'opt_2', text: '' },
                    ],
              correctAnswer: q.correctAnswer || (q.options?.[0]?.id ?? 'opt_1'),
              explanation: q.explanation || '',
              bankQuestionId: q.bankQuestionId || null,
              questionBankId: q.questionBankId || null,
              questionBankVersion: q.questionBankVersion || null,
              difficulty: q.difficulty,
              bloomLevel: q.bloomLevel,
              tags: q.tags || [],
              fileUploadConfig: q.fileUploadConfig || {
                allowedFileTypes: ['pdf', 'doc', 'docx'],
                maxFileSizeMb: 10,
                allowGoogleDocs: true,
                isRequired: true,
              },
            }));
            setQuestions(loadedQuestions);
            // Expand first question by default
            if (loadedQuestions[0]) {
              setExpandedQuestions({ [loadedQuestions[0].id]: true });
            }
          }
        }
      } catch (err) {
        if (mounted) {
          setLoadError(err.message || 'Failed to load assessment for editing.');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchAssessment();
    return () => {
      mounted = false;
    };
  }, [id, isEditMode]);

  // Calculate total points dynamically
  const totalCalculatedPoints = questions.reduce(
    (sum, q) => sum + (parseInt(q.points, 10) || 0),
    0
  );

  // Expand / Collapse Helpers
  const toggleQuestionExpanded = (qId) => {
    setExpandedQuestions((prev) => ({
      ...prev,
      [qId]: !prev[qId],
    }));
  };

  const expandAllQuestions = () => {
    const all = {};
    questions.forEach((q) => {
      all[q.id] = true;
    });
    setExpandedQuestions(all);
  };

  const collapseAllQuestions = () => {
    setExpandedQuestions({});
  };

  const areAllExpanded =
    questions.length > 0 && questions.every((q) => expandedQuestions[q.id]);

  // Question Management Helpers
  const handleImportFromQuestionBank = (importedQuestions) => {
    setQuestions((prev) => {
      const isInitialEmpty = prev.length === 1 && !prev[0].questionText.trim();
      const newItems = importedQuestions.map((iq, idx) => ({
        id: `qb-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        questionText: iq.questionText,
        type: iq.type,
        points: iq.points || 5,
        options: iq.options || [],
        correctAnswer: iq.correctAnswer || (iq.options?.[0]?.id ?? 'opt_1'),
        explanation: iq.explanation || '',
        bankQuestionId: iq.bankQuestionId,
        questionBankId: iq.questionBankId,
        questionBankVersion: iq.questionBankVersion,
        difficulty: iq.difficulty,
        bloomLevel: iq.bloomLevel,
        tags: iq.tags,
      }));

      // Automatically expand new items
      const newExpanded = {};
      newItems.forEach((item) => {
        newExpanded[item.id] = true;
      });
      setExpandedQuestions((curr) => ({ ...curr, ...newExpanded }));

      return isInitialEmpty ? newItems : [...prev, ...newItems];
    });
    toast.success(`Imported ${importedQuestions.length} question(s) from Question Bank.`);
  };

  const addQuestion = (type = 'mcq') => {
    const newId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newQ = {
      id: newId,
      questionText: '',
      type,
      points:
        type === 'long_answer'
          ? 20
          : type === 'short_answer'
          ? 10
          : type === 'file_upload'
          ? 20
          : 5,
      options:
        type === 'mcq'
          ? [
              { id: 'opt_1', text: '' },
              { id: 'opt_2', text: '' },
              { id: 'opt_3', text: '' },
              { id: 'opt_4', text: '' },
            ]
          : [],
      correctAnswer: type === 'mcq' ? 'opt_1' : null,
      explanation: '',
      fileUploadConfig: {
        allowedFileTypes: ['pdf', 'doc', 'docx'],
        maxFileSizeMb: 10,
        allowGoogleDocs: true,
        isRequired: true,
      },
    };
    setQuestions([...questions, newQ]);
    setExpandedQuestions((prev) => ({ ...prev, [newId]: true }));
  };

  const updateFileUploadConfig = (qIndex, field, val) => {
    const updated = [...questions];
    const currentConfig = updated[qIndex].fileUploadConfig || {
      allowedFileTypes: ['pdf', 'doc', 'docx'],
      maxFileSizeMb: 10,
      allowGoogleDocs: true,
      isRequired: true,
    };
    updated[qIndex].fileUploadConfig = {
      ...currentConfig,
      [field]: val,
    };
    setQuestions(updated);
  };

  const toggleAllowedFileType = (qIndex, format) => {
    const updated = [...questions];
    const currentConfig = updated[qIndex].fileUploadConfig || {
      allowedFileTypes: ['pdf', 'doc', 'docx'],
      maxFileSizeMb: 10,
      allowGoogleDocs: true,
      isRequired: true,
    };
    const types = [...(currentConfig.allowedFileTypes || ['pdf', 'doc', 'docx'])];
    const idx = types.indexOf(format);
    if (idx >= 0) {
      if (types.length === 1) {
        toast.warning('At least one file format must be allowed.');
        return;
      }
      types.splice(idx, 1);
    } else {
      types.push(format);
    }
    updated[qIndex].fileUploadConfig = {
      ...currentConfig,
      allowedFileTypes: types,
    };
    setQuestions(updated);
  };

  const removeQuestion = (index) => {
    if (questions.length <= 1) {
      toast.warning('Assessments must have at least one question.');
      return;
    }
    const qToRemove = questions[index];
    const updated = [...questions];
    updated.splice(index, 1);
    setQuestions(updated);
    if (qToRemove && qToRemove.id) {
      setExpandedQuestions((prev) => {
        const next = { ...prev };
        delete next[qToRemove.id];
        return next;
      });
    }
  };

  const handleDeleteQuestionClick = (index) => {
    if (questions.length <= 1) {
      toast.warning('Assessments must have at least one question.');
      return;
    }
    const targetQ = questions[index];
    const hasContent =
      Boolean(targetQ.questionText?.trim()) ||
      Boolean(targetQ.options?.some((o) => o.text?.trim())) ||
      Boolean(targetQ.explanation?.trim());

    if (hasContent) {
      setQuestionToDelete({ index, questionNumber: index + 1 });
    } else {
      removeQuestion(index);
    }
  };

  const moveQuestion = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= questions.length) return;
    const updated = [...questions];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setQuestions(updated);
  };

  const updateQuestionField = (index, field, val) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: val };
    setQuestions(updated);
  };

  const updateOptionText = (qIndex, optIndex, text) => {
    const updated = [...questions];
    const options = [...updated[qIndex].options];
    options[optIndex] = { ...options[optIndex], text };
    updated[qIndex].options = options;
    setQuestions(updated);
  };

  const addOption = (qIndex) => {
    const updated = [...questions];
    const options = [...updated[qIndex].options];
    const newOptId = `opt_${options.length + 1}`;
    options.push({ id: newOptId, text: '' });
    updated[qIndex].options = options;
    setQuestions(updated);
  };

  const removeOption = (qIndex, optIndex) => {
    const updated = [...questions];
    const options = [...updated[qIndex].options];
    if (options.length <= 2) {
      toast.warning('Multiple choice questions require at least 2 choices.');
      return;
    }
    const removedOpt = options.splice(optIndex, 1)[0];
    if (updated[qIndex].correctAnswer === removedOpt.id) {
      updated[qIndex].correctAnswer = options[0]?.id || null;
    }
    updated[qIndex].options = options;
    setQuestions(updated);
  };

  // Client Validation
  const validateForm = (isPublishing) => {
    const errors = {};
    const questionsToExpand = {};

    if (!title.trim() || title.trim().length < 3) {
      errors.title = 'Title is required (at least 3 characters)';
    }
    if (!durationMinutes || parseInt(durationMinutes, 10) < 1) {
      errors.durationMinutes = 'Duration must be at least 1 minute';
    }
    if (
      passingScore === '' ||
      parseInt(passingScore, 10) < 0 ||
      parseInt(passingScore, 10) > 100
    ) {
      errors.passingScore = 'Passing score must be between 0 and 100%';
    }
    if (isPublishing && accessType === 'restricted' && assignedStudents.length === 0) {
      errors.assignedStudents = 'Restricted assessments require at least 1 assigned student before publishing.';
    }

    // Validate certification settings if enabled
    if (certification.enabled) {
      if (
        certification.passingPercentage === '' ||
        isNaN(Number(certification.passingPercentage)) ||
        Number(certification.passingPercentage) < 0 ||
        Number(certification.passingPercentage) > 100
      ) {
        errors.passingPercentage = 'Certification passing percentage must be between 0 and 100%';
      }

      const schemeValidation = validateGradingScheme(certification.gradingScheme);
      if (!schemeValidation.valid) {
        errors.gradingScheme = schemeValidation.error;
      }
    }

    // Validate questions
    questions.forEach((q, idx) => {
      let qHasError = false;
      if (!q.questionText.trim()) {
        errors[`q_${idx}_text`] = `Question #${idx + 1} prompt cannot be empty.`;
        qHasError = true;
      }
      if (q.type === 'mcq') {
        const hasEmptyOption = q.options.some((o) => !o.text.trim());
        if (hasEmptyOption) {
          errors[`q_${idx}_options`] = `Question #${idx + 1} has blank answer options.`;
          qHasError = true;
        }
        if (!q.correctAnswer) {
          errors[`q_${idx}_answer`] = `Question #${idx + 1} must have a designated correct answer.`;
          qHasError = true;
        }
      }
      if (q.type === 'file_upload') {
        const allowed = q.fileUploadConfig?.allowedFileTypes || [];
        if (allowed.length === 0) {
          errors[`q_${idx}_filetypes`] = `Question #${idx + 1} must have at least one allowed file format.`;
          qHasError = true;
        }
      }
      if (qHasError) {
        questionsToExpand[q.id] = true;
      }
    });

    if (Object.keys(questionsToExpand).length > 0) {
      setExpandedQuestions((prev) => ({ ...prev, ...questionsToExpand }));
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async (targetStatus) => {
    const isPublishing = targetStatus === 'published';
    if (!validateForm(isPublishing)) {
      toast.error('Please resolve the highlighted validation errors.');
      return;
    }

    try {
      setIsSaving(true);
      const payload = {
        title: title.trim(),
        description: description.trim(),
        category,
        durationMinutes: parseInt(durationMinutes, 10),
        passingScore: parseInt(passingScore, 10),
        accessType,
        assignedStudents: accessType === 'restricted' ? assignedStudents : [],
        proctoringEnabled: Boolean(proctoringEnabled),
        cameraRequired: proctoringEnabled ? Boolean(cameraRequired) : false,
        status: targetStatus,
        randomization: {
          enabled: Boolean(randomization.enabled),
          poolCount:
            randomization.enabled && randomization.poolCount
              ? parseInt(randomization.poolCount, 10)
              : null,
          shuffleOrder: Boolean(randomization.shuffleOrder),
        },
        certification: {
          enabled: Boolean(certification.enabled),
          passingPercentage: Number(certification.passingPercentage) || 50,
          gradingScheme: certification.gradingScheme,
          templateId: certification.templateId || null,
          certificateTitle: certification.certificateTitle?.trim() || '',
          signatoryName: certification.signatoryName?.trim() || '',
          signatoryTitle: certification.signatoryTitle?.trim() || 'Dean of Academic Affairs',
        },
        questions: questions.map((q, idx) => ({
          questionText: q.questionText.trim(),
          type: q.type,
          points: parseInt(q.points, 10) || 5,
          options: q.type === 'mcq' ? q.options.map((o) => ({ id: o.id, text: o.text.trim() })) : [],
          correctAnswer: q.type === 'mcq' ? q.correctAnswer : null,
          explanation: q.explanation?.trim() || null,
          orderIndex: idx,
          bankQuestionId: q.bankQuestionId || null,
          questionBankId: q.questionBankId || null,
          questionBankVersion: q.questionBankVersion || null,
          difficulty: q.difficulty,
          bloomLevel: q.bloomLevel,
          tags: q.tags || [],
          fileUploadConfig:
            q.type === 'file_upload'
              ? {
                  allowedFileTypes: q.fileUploadConfig?.allowedFileTypes || ['pdf', 'doc', 'docx'],
                  maxFileSizeMb: q.fileUploadConfig?.maxFileSizeMb || 10,
                  allowGoogleDocs: q.fileUploadConfig?.allowGoogleDocs ?? true,
                  isRequired: q.fileUploadConfig?.isRequired ?? true,
                }
              : undefined,
        })),
      };

      if (isEditMode) {
        await assessmentService.updateAssessment(id, payload);
        toast.success(
          targetStatus === 'published'
            ? 'Assessment updated & published live!'
            : 'Assessment draft saved successfully.'
        );
      } else {
        await assessmentService.createAssessment(payload);
        toast.success(
          targetStatus === 'published'
            ? 'Assessment authored & published live!'
            : 'New draft assessment created successfully.'
        );
      }

      navigate('/instructor/assessments');
    } catch (err) {
      toast.error(err.message || 'Failed to save assessment.');
    } finally {
      setIsSaving(false);
      setConfirmPublishModal(false);
    }
  };

  if (isLoading) {
    return <PageLoader message="Loading assessment studio..." />;
  }

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto py-12 space-y-4">
        <Alert variant="error" title="Unable to Load Assessment">
          {loadError}
        </Alert>
        <Link to="/instructor/assessments">
          <Button variant="outline" icon={ArrowLeft}>
            Back to My Assessments
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24">
      {/* Top Sticky Page Header & Action Bar */}
      <div className="sticky top-0 z-30 bg-bg-light/95 dark:bg-bg-dark/95 backdrop-blur-md -mx-3.5 sm:-mx-5 lg:-mx-6 xl:-mx-8 px-3.5 sm:px-5 lg:px-6 xl:px-8 py-3.5 border-b border-[#EBE3D8] dark:border-[#2D3748] shadow-warm-xs transition-all">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center space-x-2">
              <Link
                to="/instructor/assessments"
                className="text-xs font-semibold text-[#64748B] hover:text-[#E05D38] dark:hover:text-[#F4A261] flex items-center transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Assessments
              </Link>
              <span className="text-[#64748B]/40">/</span>
              <Badge variant={status === 'published' ? 'sage' : 'peach'} size="sm">
                {isEditMode ? `Editing (${status})` : 'New Draft'}
              </Badge>
            </div>
            <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-[#1F2937] dark:text-[#F9FAFB]">
              {isEditMode ? 'Edit Assessment' : 'Author New Assessment'}
            </h1>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Configure examination parameters, questions, scoring weights, and access rules.
            </p>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2.5 self-start sm:self-auto flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              size="md"
              icon={Save}
              loading={isSaving}
              onClick={() => handleSave('draft')}
            >
              Save Draft
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              icon={Send}
              loading={isSaving}
              onClick={() => {
                if (validateForm(true)) {
                  setConfirmPublishModal(true);
                }
              }}
            >
              Publish Live
            </Button>
          </div>
        </div>
      </div>

      {/* 01 — Assessment Details */}
      <Card
        title={
          <div className="flex items-center space-x-2.5">
            <Layers className="w-5 h-5 text-[#E05D38]" />
            <span>01 — Assessment Details</span>
          </div>
        }
        subtitle=""
        className="border border-[#EBE3D8] dark:border-[#2D3748]"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Title: 8 cols on md */}
            <div className="md:col-span-8">
              <label className="block text-xs font-semibold text-[#1F2937] dark:text-[#F9FAFB] mb-1">
                Assessment Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Distributed Systems Final Exam"
                className="w-full px-3.5 py-2 text-sm bg-white dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl focus:outline-none focus:border-[#E05D38] focus:ring-2 focus:ring-[#E05D38]/20 transition-all text-[#1F2937] dark:text-[#F9FAFB]"
              />
              {validationErrors.title && (
                <p className="text-xs text-red-500 mt-1">{validationErrors.title}</p>
              )}
            </div>

            {/* Category: 4 cols on md */}
            <div className="md:col-span-4">
              <label className="block text-xs font-semibold text-[#1F2937] dark:text-[#F9FAFB] mb-1">
                Category / Subject
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl focus:outline-none focus:border-[#E05D38] focus:ring-2 focus:ring-[#E05D38]/20 transition-all text-[#1F2937] dark:text-[#F9FAFB]"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Duration & Passing Score Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1F2937] dark:text-[#F9FAFB] mb-1 flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1 text-[#E05D38]" />
                Duration (Minutes) *
              </label>
              <input
                type="number"
                min="1"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl focus:outline-none focus:border-[#E05D38] focus:ring-2 focus:ring-[#E05D38]/20 transition-all text-[#1F2937] dark:text-[#F9FAFB]"
              />
              {validationErrors.durationMinutes && (
                <p className="text-xs text-red-500 mt-1">{validationErrors.durationMinutes}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1F2937] dark:text-[#F9FAFB] mb-1 flex items-center">
                <Award className="w-3.5 h-3.5 mr-1 text-[#3D8A78]" />
                Passing Score (%) *
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={passingScore}
                onChange={(e) => setPassingScore(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl focus:outline-none focus:border-[#E05D38] focus:ring-2 focus:ring-[#E05D38]/20 transition-all text-[#1F2937] dark:text-[#F9FAFB]"
              />
              {validationErrors.passingScore && (
                <p className="text-xs text-red-500 mt-1">{validationErrors.passingScore}</p>
              )}
            </div>
          </div>

          {/* Description & Syllabus Guidance */}
          <div>
            <label className="block text-xs font-semibold text-[#1F2937] dark:text-[#F9FAFB] mb-1">
              Description and Instructions
            </label>
            <textarea
              rows="3"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide students with instructions regarding covered modules, tools permitted, etc."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl focus:outline-none focus:border-[#E05D38] focus:ring-2 focus:ring-[#E05D38]/20 transition-all text-[#1F2937] dark:text-[#F9FAFB]"
            />
          </div>

          {/* Existing assessment configuration fields (Access, Proctoring, Randomization) */}
          <div className="pt-4 border-t border-[#EBE3D8] dark:border-[#2D3748] space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] flex items-center space-x-1.5">
              <Shield className="w-3.5 h-3.5 text-[#E05D38]" />
              <span>Assessment Configuration & Rules</span>
            </h4>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Audience & Access Control */}
              <div className="p-3.5 rounded-xl bg-[#FCF8F3]/60 dark:bg-[#1A202C]/60 border border-[#EBE3D8] dark:border-[#2D3748] space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#1F2937] dark:text-[#F9FAFB] flex items-center space-x-1.5">
                    <Globe className="w-3.5 h-3.5 text-[#E05D38]" />
                    <span>Audience & Access Mode</span>
                  </label>
                  <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    {accessType === 'public' ? 'Open to all students' : 'Restricted list'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAccessType('public')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all text-center flex items-center justify-center space-x-1.5 ${
                      accessType === 'public'
                        ? 'border-[#E05D38] bg-[#FDECE2] dark:bg-[#341C16] text-[#E05D38] shadow-warm-xs'
                        : 'border-[#EBE3D8] dark:border-[#2D3748] bg-white dark:bg-[#12161F] text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Public Access</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAccessType('restricted')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all text-center flex items-center justify-center space-x-1.5 ${
                      accessType === 'restricted'
                        ? 'border-[#3D8A78] bg-[#EAF4F1] dark:bg-[#132A24] text-[#3D8A78] shadow-warm-xs'
                        : 'border-[#EBE3D8] dark:border-[#2D3748] bg-white dark:bg-[#12161F] text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Restricted Access</span>
                  </button>
                </div>

                {accessType === 'restricted' && (
                  <div className="pt-2">
                    <StudentSelector
                      value={assignedStudents}
                      onChange={setAssignedStudents}
                      error={validationErrors.assignedStudents}
                    />
                  </div>
                )}
              </div>

              {/* Proctoring & Randomization Controls */}
              <div className="space-y-3">
                {/* Proctoring */}
                <div className="p-3.5 rounded-xl bg-[#FCF8F3]/60 dark:bg-[#1A202C]/60 border border-[#EBE3D8] dark:border-[#2D3748] space-y-2">
                  <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={proctoringEnabled}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setProctoringEnabled(checked);
                        if (!checked) setCameraRequired(false);
                      }}
                      className="rounded border-[#EBE3D8] text-[#E05D38] focus:ring-[#E05D38]/30"
                    />
                    <div>
                      <div className="flex items-center space-x-1.5 text-xs font-bold text-[#1F2937] dark:text-[#F9FAFB]">
                        <Shield className="w-3.5 h-3.5 text-[#E05D38]" />
                        <span>AI-Assisted Proctoring</span>
                      </div>
                      <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] block">
                        Record candidate lifecycle telemetry during examination attempts.
                      </span>
                    </div>
                  </label>

                  {proctoringEnabled && (
                    <div className="pl-6 pt-1 border-t border-[#EBE3D8]/60 dark:border-[#2D3748]/60">
                      <label className="flex items-center space-x-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={cameraRequired}
                          onChange={(e) => setCameraRequired(e.target.checked)}
                          className="rounded border-[#EBE3D8] text-[#E05D38] focus:ring-[#E05D38]/30"
                        />
                        <span className="text-xs text-[#1F2937] dark:text-[#F9FAFB] flex items-center space-x-1 font-medium">
                          <Camera className="w-3 h-3 text-[#3D8A78]" />
                          <span>Require Web Camera Access</span>
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Randomization */}
                <div className="p-3.5 rounded-xl bg-[#FCF8F3]/60 dark:bg-[#1A202C]/60 border border-[#EBE3D8] dark:border-[#2D3748] space-y-2">
                  <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={randomization.enabled}
                      onChange={(e) =>
                        setRandomization({
                          ...randomization,
                          enabled: e.target.checked,
                        })
                      }
                      className="rounded border-[#EBE3D8] text-[#E05D38] focus:ring-[#E05D38]/30"
                    />
                    <div>
                      <div className="flex items-center space-x-1.5 text-xs font-bold text-[#1F2937] dark:text-[#F9FAFB]">
                        <Shuffle className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Question Randomization</span>
                      </div>
                      <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] block">
                        Shuffle questions or deliver a randomized subset pool.
                      </span>
                    </div>
                  </label>

                  {randomization.enabled && (
                    <div className="pl-6 space-y-2 pt-1 border-t border-[#EBE3D8]/60 dark:border-[#2D3748]/60">
                      <div className="flex items-center space-x-2">
                        <label className="text-xs text-[#64748B] dark:text-[#94A3B8] whitespace-nowrap">
                          Pool Selection Count:
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={questions.length || 100}
                          placeholder={`All (${questions.length})`}
                          value={randomization.poolCount}
                          onChange={(e) =>
                            setRandomization({
                              ...randomization,
                              poolCount: e.target.value,
                            })
                          }
                          className="w-24 px-2 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-[#12161F] text-[#1F2937] dark:text-[#F9FAFB]"
                        />
                      </div>
                      <label className="flex items-center space-x-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={randomization.shuffleOrder}
                          onChange={(e) =>
                            setRandomization({
                              ...randomization,
                              shuffleOrder: e.target.checked,
                            })
                          }
                          className="rounded border-[#EBE3D8] text-[#E05D38] focus:ring-[#E05D38]/30"
                        />
                        <span className="text-xs text-[#1F2937] dark:text-[#F9FAFB]">
                          Shuffle Question Delivery Order
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 02 — Questions & Answers */}
      <Card
        title={
          <div className="flex items-center space-x-2.5">
            <ListChecks className="w-5 h-5 text-[#E05D38]" />
            <span>02 — Questions & Answers</span>
          </div>
        }
        subtitle=""
        action={
          <div className="flex items-center space-x-3">
            {/* Question count and total marks summary */}
            <div className="hidden sm:flex items-center space-x-1.5 text-xs font-semibold">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                <strong>{questions.length}</strong> {questions.length === 1 ? 'Question' : 'Questions'}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-[#FDF1EC] dark:bg-[#341C16] text-[#E05D38] border border-[#EBE3D8] dark:border-[#2D3748]">
                <strong>{totalCalculatedPoints}</strong> pts Total
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={areAllExpanded ? ChevronUp : ChevronDown}
              onClick={areAllExpanded ? collapseAllQuestions : expandAllQuestions}
            >
              {areAllExpanded ? 'Collapse All' : 'Expand All'}
            </Button>
          </div>
        }
        className="border border-[#EBE3D8] dark:border-[#2D3748]"
      >
        <div className="space-y-4">
          {/* Mobile Question count & total marks summary */}
          <div className="flex sm:hidden items-center justify-between text-xs font-semibold pb-1">
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              <strong>{questions.length}</strong> {questions.length === 1 ? 'Question' : 'Questions'}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-[#FDF1EC] dark:bg-[#341C16] text-[#E05D38] border border-[#EBE3D8] dark:border-[#2D3748]">
              <strong>{totalCalculatedPoints}</strong> pts Total
            </span>
          </div>

          {/* Question-Type Selection Toolbar */}
          <div className="p-3 rounded-xl bg-[#FAF6F0]/80 dark:bg-[#12161F]/80 border border-[#EBE3D8] dark:border-[#2D3748] flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={ListChecks}
              onClick={() => addQuestion('mcq')}
            >
              Add Multiple Choice
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={AlignLeft}
              onClick={() => addQuestion('short_answer')}
            >
              Add Short Answer
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={FileText}
              onClick={() => addQuestion('long_answer')}
            >
              Add Long Essay
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={Upload}
              onClick={() => addQuestion('file_upload')}
            >
              Add File Upload
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={Database}
              onClick={() => setIsQuestionBankModalOpen(true)}
              className="text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-semibold"
            >
              Import from Question Bank
            </Button>
          </div>

          {/* Clean Vertical Questions List */}
          <div className="space-y-3.5">
          {questions.map((q, qIndex) => {
            const isExpanded = Boolean(expandedQuestions[q.id]);
            const hasError = Boolean(
              validationErrors[`q_${qIndex}_text`] ||
                validationErrors[`q_${qIndex}_options`] ||
                validationErrors[`q_${qIndex}_answer`] ||
                validationErrors[`q_${qIndex}_filetypes`]
            );

            return (
              <div
                key={q.id || qIndex}
                className={`rounded-2xl border transition-all ${
                  hasError
                    ? 'border-red-300 dark:border-red-800 bg-red-50/20 dark:bg-red-950/10'
                    : 'border-[#EBE3D8] dark:border-[#2D3748] bg-white dark:bg-[#1A202C]'
                } shadow-warm-xs overflow-hidden`}
              >
                {/* Compact Row Header (Clickable for Expand / Collapse) */}
                <div
                  onClick={() => toggleQuestionExpanded(q.id)}
                  className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/60 dark:hover:bg-slate-800/40 select-none transition-colors"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleQuestionExpanded(q.id);
                    }
                  }}
                  aria-expanded={isExpanded}
                  aria-label={`Question ${qIndex + 1}: ${q.questionText || 'Empty prompt'}`}
                >
                  {/* Left: Number, Type Badge, Short Preview */}
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <span className="w-7 h-7 rounded-lg bg-[#FDF1EC] dark:bg-[#341C16] text-[#E05D38] font-bold text-xs flex items-center justify-center border border-[#EBE3D8] dark:border-[#2D3748] flex-shrink-0">
                      {qIndex + 1}
                    </span>
                    <Badge
                      variant={
                        q.type === 'mcq'
                          ? 'terracotta'
                          : q.type === 'short_answer'
                          ? 'peach'
                          : q.type === 'long_answer'
                          ? 'sage'
                          : 'secondary'
                      }
                      size="sm"
                    >
                      {q.type === 'mcq'
                        ? 'Multiple Choice'
                        : q.type === 'short_answer'
                        ? 'Short Answer'
                        : q.type === 'long_answer'
                        ? 'Long Essay'
                        : 'File Upload'}
                    </Badge>
                    <div className="min-w-0 flex-1 truncate">
                      {q.questionText.trim() ? (
                        <span className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 truncate block">
                          {q.questionText}
                        </span>
                      ) : (
                        <span className="text-xs sm:text-sm italic text-slate-400 dark:text-slate-500">
                          (Question prompt empty — click to configure)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Points, Reorder, Delete, Chevron */}
                  <div className="flex items-center space-x-1.5 flex-shrink-0 self-end sm:self-auto">
                    <span className="px-2 py-0.5 text-xs font-bold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 mr-1">
                      {q.points || 0} pts
                    </span>
                    {/* Move Up */}
                    <button
                      type="button"
                      disabled={qIndex === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveQuestion(qIndex, -1);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-25 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Move Question Up"
                      aria-label="Move question up"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    {/* Move Down */}
                    <button
                      type="button"
                      disabled={qIndex === questions.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveQuestion(qIndex, 1);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-25 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Move Question Down"
                      aria-label="Move question down"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    {/* Delete */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteQuestionClick(qIndex);
                      }}
                      className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      title="Delete Question"
                      aria-label="Delete question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {/* Expand/Collapse Chevron */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleQuestionExpanded(q.id);
                      }}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title={isExpanded ? 'Collapse Question' : 'Expand Question'}
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? 'Collapse question details' : 'Expand question details'}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-[#E05D38]" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Question Editor */}
                {isExpanded && (
                  <div className="border-t border-[#EBE3D8] dark:border-[#2D3748] p-4 sm:p-5 space-y-4 bg-[#FFFCF8]/40 dark:bg-[#12161F]/40">
                    {/* Question Type and Points Configuration */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1">
                          Question Type
                        </label>
                        <select
                          value={q.type}
                          onChange={(e) => updateQuestionField(qIndex, 'type', e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl text-[#1F2937] dark:text-[#F9FAFB] focus:outline-none focus:border-[#E05D38] focus:ring-1 focus:ring-[#E05D38]/20"
                        >
                          <option value="mcq">Multiple Choice (MCQ)</option>
                          <option value="short_answer">Short Answer (Subjective)</option>
                          <option value="long_answer">Long Essay (Subjective)</option>
                          <option value="file_upload">File Upload / Document (Subjective)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1">
                          Points Weight
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={q.points}
                          onChange={(e) =>
                            updateQuestionField(qIndex, 'points', parseInt(e.target.value, 10) || 1)
                          }
                          className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl text-[#1F2937] dark:text-[#F9FAFB] focus:outline-none focus:border-[#E05D38] focus:ring-1 focus:ring-[#E05D38]/20"
                        />
                      </div>
                    </div>

                    {/* Question Bank Metadata Chip (if imported) */}
                    {q.bankQuestionId && (
                      <div className="p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40 flex flex-wrap items-center justify-between gap-2 text-xs text-indigo-900 dark:text-indigo-200">
                        <div className="flex items-center space-x-2">
                          <Database className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span className="font-semibold">Imported Question Bank Item</span>
                          {q.difficulty && (
                            <Badge variant="secondary" size="sm">
                              {q.difficulty}
                            </Badge>
                          )}
                          {q.bloomLevel && (
                            <Badge variant="neutral" size="sm">
                              {q.bloomLevel}
                            </Badge>
                          )}
                        </div>
                        {q.tags && q.tags.length > 0 && (
                          <div className="flex items-center space-x-1">
                            {q.tags.slice(0, 3).map((tag, tIdx) => (
                              <span
                                key={tIdx}
                                className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900 text-[10px]"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Question Prompt */}
                    <div>
                      <label className="block text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1">
                        Question Prompt / Problem Statement *
                      </label>
                      <textarea
                        rows="2"
                        value={q.questionText}
                        onChange={(e) => updateQuestionField(qIndex, 'questionText', e.target.value)}
                        placeholder="Enter question text here..."
                        className="w-full px-3.5 py-2 text-sm bg-white dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl focus:outline-none focus:border-[#E05D38] focus:ring-2 focus:ring-[#E05D38]/20 text-[#1F2937] dark:text-[#F9FAFB]"
                      />
                      {validationErrors[`q_${qIndex}_text`] && (
                        <p className="text-xs text-red-500 mt-1">
                          {validationErrors[`q_${qIndex}_text`]}
                        </p>
                      )}
                    </div>

                    {/* File Upload Configuration */}
                    {q.type === 'file_upload' && (
                      <div className="p-4 rounded-xl border border-[#EBE3D8] dark:border-[#2D3748] bg-[#FFF9F2]/60 dark:bg-[#12161F]/60 space-y-3">
                        <div className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] flex items-center space-x-1.5">
                          <Upload className="w-3.5 h-3.5 text-[#E05D38]" />
                          <span>Document Upload Configuration</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                          {/* Allowed Formats */}
                          <div>
                            <label className="block text-xs font-semibold text-[#1F2937] dark:text-[#F9FAFB] mb-1.5">
                              Allowed Document Formats *
                            </label>
                            <div className="flex items-center space-x-3 text-xs">
                              {['pdf', 'doc', 'docx'].map((fmt) => {
                                const isChecked = (
                                  q.fileUploadConfig?.allowedFileTypes || ['pdf', 'doc', 'docx']
                                ).includes(fmt);
                                return (
                                  <label key={fmt} className="flex items-center space-x-1.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => toggleAllowedFileType(qIndex, fmt)}
                                      className="rounded border-[#EBE3D8] text-[#E05D38] focus:ring-[#E05D38]"
                                    />
                                    <span className="font-semibold uppercase text-[#1F2937] dark:text-[#F9FAFB]">
                                      .{fmt}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                            {validationErrors[`q_${qIndex}_filetypes`] && (
                              <p className="text-xs text-red-500 mt-1">
                                {validationErrors[`q_${qIndex}_filetypes`]}
                              </p>
                            )}
                          </div>

                          {/* Max File Size */}
                          <div>
                            <label className="block text-xs font-semibold text-[#1F2937] dark:text-[#F9FAFB] mb-1.5">
                              Maximum File Size (MB)
                            </label>
                            <div className="flex items-center space-x-2">
                              <input
                                type="number"
                                min="1"
                                max="50"
                                value={q.fileUploadConfig?.maxFileSizeMb ?? 10}
                                onChange={(e) =>
                                  updateFileUploadConfig(
                                    qIndex,
                                    'maxFileSizeMb',
                                    Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 10))
                                  )
                                }
                                className="w-24 px-3 py-1 text-xs bg-white dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl text-[#1F2937] dark:text-[#F9FAFB] focus:outline-none focus:border-[#E05D38]"
                              />
                              <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                                MB (1 - 50MB)
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 pt-1 border-t border-[#EBE3D8]/60 dark:border-[#2D3748]/60 text-xs">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={q.fileUploadConfig?.allowGoogleDocs ?? true}
                              onChange={(e) =>
                                updateFileUploadConfig(qIndex, 'allowGoogleDocs', e.target.checked)
                              }
                              className="rounded border-[#EBE3D8] text-[#E05D38] focus:ring-[#E05D38]"
                            />
                            <span className="text-[#1F2937] dark:text-[#F9FAFB] font-medium">
                              Allow Google Docs URL submissions
                            </span>
                          </label>

                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={q.fileUploadConfig?.isRequired ?? true}
                              onChange={(e) =>
                                updateFileUploadConfig(qIndex, 'isRequired', e.target.checked)
                              }
                              className="rounded border-[#EBE3D8] text-[#E05D38] focus:ring-[#E05D38]"
                            />
                            <span className="text-[#1F2937] dark:text-[#F9FAFB] font-medium">
                              Mandatory Submission (Required)
                            </span>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Multiple Choice Options List */}
                    {q.type === 'mcq' && (
                      <div className="space-y-2.5 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
                            Answer Options (Select radio for correct answer):
                          </span>
                          <button
                            type="button"
                            onClick={() => addOption(qIndex)}
                            className="text-xs font-semibold text-[#E05D38] hover:text-[#C84E2D] hover:underline flex items-center cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            Add Option
                          </button>
                        </div>

                        <div className="space-y-2">
                          {q.options.map((opt, optIndex) => {
                            const isCorrect = q.correctAnswer === opt.id;
                            return (
                              <div key={opt.id || optIndex} className="flex items-center space-x-2">
                                <input
                                  type="radio"
                                  name={`correct_${qIndex}`}
                                  checked={isCorrect}
                                  onChange={() =>
                                    updateQuestionField(qIndex, 'correctAnswer', opt.id)
                                  }
                                  className="w-4 h-4 text-[#E05D38] accent-[#E05D38] focus:ring-[#E05D38] cursor-pointer"
                                  title="Mark as correct answer"
                                />
                                <input
                                  type="text"
                                  value={opt.text}
                                  onChange={(e) =>
                                    updateOptionText(qIndex, optIndex, e.target.value)
                                  }
                                  placeholder={`Option ${String.fromCharCode(65 + optIndex)}`}
                                  className={`flex-1 px-3 py-1.5 text-xs bg-white dark:bg-[#12161F] border rounded-xl focus:outline-none focus:border-[#E05D38] focus:ring-1 focus:ring-[#E05D38]/20 transition-all text-[#1F2937] dark:text-[#F9FAFB] ${
                                    isCorrect
                                      ? 'border-[#E05D38] bg-[#FDECE2]/40 dark:bg-[#341C16]/40'
                                      : 'border-[#EBE3D8] dark:border-[#2D3748]'
                                  }`}
                                />
                                {q.options.length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() => removeOption(qIndex, optIndex)}
                                    className="p-1 text-[#64748B] hover:text-red-500 cursor-pointer transition-colors"
                                    title="Remove Option"
                                    aria-label="Remove Option"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {validationErrors[`q_${qIndex}_options`] && (
                          <p className="text-xs text-red-500 mt-1">
                            {validationErrors[`q_${qIndex}_options`]}
                          </p>
                        )}
                        {validationErrors[`q_${qIndex}_answer`] && (
                          <p className="text-xs text-red-500 mt-1">
                            {validationErrors[`q_${qIndex}_answer`]}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Subjective Guidance / Explanation Note */}
                    <div className="pt-2">
                      <label className="block text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1">
                        {q.type === 'mcq'
                          ? 'Confidential Explanation (Shown to instructors during review)'
                          : 'Grading Rubric / Evaluator Guidance Notes'}
                      </label>
                      <input
                        type="text"
                        value={q.explanation || ''}
                        onChange={(e) => updateQuestionField(qIndex, 'explanation', e.target.value)}
                        placeholder="Provide sample solution criteria or key requirements..."
                        className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl text-[#1F2937] dark:text-[#F9FAFB] focus:outline-none focus:border-[#E05D38] focus:ring-1 focus:ring-[#E05D38]/20"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </div>
      </Card>

      {/* 03 — Certification & Grading */}
      <GradingSchemeEditor
        title="03 — Certification & Grading"
        certification={certification}
        onChange={setCertification}
        errors={validationErrors}
        assessmentTitle={title}
      />



      {/* Confirmation Modal for Publishing */}
      <Modal
        isOpen={confirmPublishModal}
        onClose={() => setConfirmPublishModal(false)}
        title="Publish Assessment"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            You are about to publish <strong>"{title}"</strong> live.
          </p>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-dark-muted text-xs space-y-1 text-slate-600 dark:text-slate-300">
            <div>
              <strong>Access Mode:</strong>{' '}
              {accessType === 'restricted'
                ? `Restricted (${assignedStudents.length} Students Assigned)`
                : 'Public (Open to All Active Students)'}
            </div>
            <div>
              <strong>Total Questions:</strong> {questions.length} items ({totalCalculatedPoints} pts)
            </div>
            <div>
              <strong>Duration:</strong> {durationMinutes} Minutes
            </div>
            <div>
              <strong>Certification:</strong>{' '}
              {certification.enabled
                ? `Enabled (Threshold: ${certification.passingPercentage}%)`
                : 'Disabled'}
            </div>
          </div>
          <div className="flex items-center justify-end space-x-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmPublishModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={isSaving}
              onClick={() => handleSave('published')}
            >
              Confirm & Publish
            </Button>
          </div>
        </div>
      </Modal>

      {/* Safe Question Deletion Confirmation Modal */}
      <Modal
        isOpen={Boolean(questionToDelete)}
        onClose={() => setQuestionToDelete(null)}
        title="Delete Question"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Are you sure you want to delete <strong>Question #{questionToDelete ? questionToDelete.questionNumber : ''}</strong>?
            Any prompt text, answer choices, or configuration entered for this question will be permanently lost.
          </p>
          <div className="flex items-center justify-end space-x-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setQuestionToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => {
                if (questionToDelete) {
                  removeQuestion(questionToDelete.index);
                  setQuestionToDelete(null);
                }
              }}
            >
              Delete Question
            </Button>
          </div>
        </div>
      </Modal>

      {/* Question Bank Picker Modal */}
      <QuestionBankPickerModal
        isOpen={isQuestionBankModalOpen}
        onClose={() => setIsQuestionBankModalOpen(false)}
        onSelectQuestions={handleImportFromQuestionBank}
      />
    </div>
  );
};

export default AssessmentBuilder;