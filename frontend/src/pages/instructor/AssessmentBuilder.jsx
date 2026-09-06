import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import assessmentService from '../../services/assessment.service';
import StudentSelector from '../../components/instructor/StudentSelector';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import Alert from '../../components/ui/Alert';
import {
  BookOpen,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Save,
  Send,
  ArrowLeft,
  HelpCircle,
  Clock,
  Award,
  Globe,
  Lock,
  ListChecks,
  AlignLeft,
  FileText,
  AlertTriangle,
  X,
} from 'lucide-react';

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
  const [status, setStatus] = useState('draft');

  // Question bank state
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
          setStatus(data.status || 'draft');

          if (data.questions && data.questions.length > 0) {
            setQuestions(
              data.questions.map((q, idx) => ({
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
              }))
            );
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

  // Question Management Helpers
  const addQuestion = (type = 'mcq') => {
    const newQ = {
      id: `temp-${Date.now()}`,
      questionText: '',
      type,
      points: type === 'long_answer' ? 20 : type === 'short_answer' ? 10 : 5,
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
    };
    setQuestions([...questions, newQ]);
  };

  const removeQuestion = (index) => {
    if (questions.length <= 1) {
      toast.warning('Assessments must have at least one question.');
      return;
    }
    const updated = [...questions];
    updated.splice(index, 1);
    setQuestions(updated);
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

    // Validate questions
    questions.forEach((q, idx) => {
      if (!q.questionText.trim()) {
        errors[`q_${idx}_text`] = `Question #${idx + 1} prompt cannot be empty.`;
      }
      if (q.type === 'mcq') {
        const hasEmptyOption = q.options.some((o) => !o.text.trim());
        if (hasEmptyOption) {
          errors[`q_${idx}_options`] = `Question #${idx + 1} has blank answer options.`;
        }
        if (!q.correctAnswer) {
          errors[`q_${idx}_answer`] = `Question #${idx + 1} must have a designated correct answer.`;
        }
      }
    });

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
        status: targetStatus,
        questions: questions.map((q, idx) => ({
          questionText: q.questionText.trim(),
          type: q.type,
          points: parseInt(q.points, 10) || 5,
          options: q.type === 'mcq' ? q.options.map((o) => ({ id: o.id, text: o.text.trim() })) : [],
          correctAnswer: q.type === 'mcq' ? q.correctAnswer : null,
          explanation: q.explanation?.trim() || null,
          orderIndex: idx,
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
        const created = await assessmentService.createAssessment(payload);
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
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Spinner size="lg" />
        <p className="mt-4 text-sm font-medium text-slate-500">
          Loading assessment studio...
        </p>
      </div>
    );
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
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#EBE3D8] dark:border-[#2D3748] pb-5">
        <div className="space-y-1">
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
          <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-[#1F2937] dark:text-[#F9FAFB]">
            {isEditMode ? 'Edit Assessment' : 'Author New Assessment'}
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8]">
            Configure examination parameters, questions, scoring weights, and access rules.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2.5 self-start sm:self-auto">
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

      {/* Grid: 2 Columns on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Assessment Parameters & Access (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* General Metadata */}
          <Card title="Assessment Specifications" subtitle="General course examination metadata">
            <div className="space-y-4">
              <div>
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

              <div>
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

              <div className="grid grid-cols-2 gap-3">
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

              <div>
                <label className="block text-xs font-semibold text-[#1F2937] dark:text-[#F9FAFB] mb-1">
                  Description & Syllabus Guidance
                </label>
                <textarea
                  rows="3"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide students with instructions regarding covered modules, tools permitted, etc."
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl focus:outline-none focus:border-[#E05D38] focus:ring-2 focus:ring-[#E05D38]/20 transition-all text-[#1F2937] dark:text-[#F9FAFB]"
                />
              </div>
            </div>
          </Card>

          {/* Access Control & Student Assignment */}
          <Card
            title="Audience & Access Control"
            subtitle="Configure student enrollment and test visibility"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {/* Public Option */}
                <div
                  onClick={() => setAccessType('public')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    accessType === 'public'
                      ? 'border-[#E05D38] bg-[#FDECE2] dark:bg-[#341C16]'
                      : 'border-[#EBE3D8] dark:border-[#2D3748] hover:border-[#F4A261]'
                  }`}
                >
                  <div className="flex items-center space-x-2 text-sm font-semibold text-[#1F2937] dark:text-[#F9FAFB] mb-1">
                    <Globe className="w-4 h-4 text-[#E05D38]" />
                    <span>Public Access</span>
                  </div>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                    Open to all active registered students once published.
                  </p>
                </div>

                {/* Restricted Option */}
                <div
                  onClick={() => setAccessType('restricted')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    accessType === 'restricted'
                      ? 'border-[#3D8A78] bg-[#EAF4F1] dark:bg-[#132A24]'
                      : 'border-[#EBE3D8] dark:border-[#2D3748] hover:border-[#F4A261]'
                  }`}
                >
                  <div className="flex items-center space-x-2 text-sm font-semibold text-[#1F2937] dark:text-[#F9FAFB] mb-1">
                    <Lock className="w-4 h-4 text-[#3D8A78]" />
                    <span>Restricted</span>
                  </div>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                    Only explicitly assigned students can view or attempt.
                  </p>
                </div>
              </div>

              {/* Student Selector when Restricted */}
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
          </Card>
        </div>

        {/* Right Column: Question Bank & Questions (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Summary Banner */}
          <div className="flex items-center justify-between p-5 rounded-2xl bg-gradient-to-r from-[#E05D38] via-[#E67E22] to-[#F4A261] text-white shadow-warm-md">
            <div>
              <span className="text-xs font-semibold text-white/80 uppercase tracking-wider block">
                Total Assessment Weight
              </span>
              <span className="text-2xl font-display font-bold">{totalCalculatedPoints} Points</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-white/80 uppercase tracking-wider block">
                Question Count
              </span>
              <span className="text-2xl font-display font-bold">{questions.length} Items</span>
            </div>
          </div>

          {/* Question Cards List */}
          <div className="space-y-4">
            {questions.map((q, qIndex) => (
              <div
                key={q.id || qIndex}
                className="p-5 rounded-2xl border border-[#EBE3D8] dark:border-[#2D3748] bg-white dark:bg-[#1A202C] shadow-warm-xs space-y-4 transition-all"
              >
                {/* Question Header */}
                <div className="flex items-center justify-between border-b border-[#EBE3D8] dark:border-[#2D3748] pb-3">
                  <div className="flex items-center space-x-2.5">
                    <span className="w-6 h-6 rounded-full bg-[#FFF9F2] dark:bg-[#12161F] text-[#E05D38] font-bold text-xs flex items-center justify-center border border-[#EBE3D8] dark:border-[#2D3748]">
                      {qIndex + 1}
                    </span>
                    <h4 className="text-sm font-bold text-[#1F2937] dark:text-[#F9FAFB]">
                      Question {qIndex + 1}
                    </h4>
                    <Badge
                      variant={
                        q.type === 'mcq'
                          ? 'terracotta'
                          : q.type === 'short_answer'
                          ? 'peach'
                          : 'sage'
                      }
                      size="sm"
                    >
                      {q.type === 'mcq'
                        ? 'Multiple Choice'
                        : q.type === 'short_answer'
                        ? 'Short Answer'
                        : 'Long Essay'}
                    </Badge>
                  </div>

                  <div className="flex items-center space-x-1">
                    {/* Move Up */}
                    <button
                      type="button"
                      disabled={qIndex === 0}
                      onClick={() => moveQuestion(qIndex, -1)}
                      className="p-1.5 rounded-lg text-[#64748B] hover:text-[#1F2937] dark:hover:text-[#F9FAFB] disabled:opacity-30 cursor-pointer"
                      title="Move Question Up"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    {/* Move Down */}
                    <button
                      type="button"
                      disabled={qIndex === questions.length - 1}
                      onClick={() => moveQuestion(qIndex, 1)}
                      className="p-1.5 rounded-lg text-[#64748B] hover:text-[#1F2937] dark:hover:text-[#F9FAFB] disabled:opacity-30 cursor-pointer"
                      title="Move Question Down"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => removeQuestion(qIndex)}
                      className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                      title="Delete Question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Question Type & Points Configuration */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1">
                      Question Type
                    </label>
                    <select
                      value={q.type}
                      onChange={(e) => updateQuestionField(qIndex, 'type', e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-[#FFF9F2] dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl text-[#1F2937] dark:text-[#F9FAFB] focus:outline-none focus:border-[#E05D38] focus:ring-1 focus:ring-[#E05D38]/20"
                    >
                      <option value="mcq">Multiple Choice (MCQ)</option>
                      <option value="short_answer">Short Answer (Subjective)</option>
                      <option value="long_answer">Long Essay (Subjective)</option>
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
                      className="w-full px-3 py-1.5 text-xs bg-[#FFF9F2] dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl text-[#1F2937] dark:text-[#F9FAFB] focus:outline-none focus:border-[#E05D38] focus:ring-1 focus:ring-[#E05D38]/20"
                    />
                  </div>
                </div>

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
                                className="p-1 text-[#64748B] hover:text-red-500 cursor-pointer"
                                title="Remove Option"
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
                    className="w-full px-3 py-1.5 text-xs bg-[#FFF9F2] dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl text-[#1F2937] dark:text-[#F9FAFB] focus:outline-none focus:border-[#E05D38] focus:ring-1 focus:ring-[#E05D38]/20"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Add Question Button Bar */}
          <div className="flex flex-wrap items-center justify-center p-4 border-2 border-dashed border-[#EBE3D8] dark:border-[#2D3748] rounded-2xl bg-white/60 dark:bg-[#1A202C]/60 gap-2.5 shadow-warm-xs">
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
          </div>
        </div>
      </div>

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
    </div>
  );
};

export default AssessmentBuilder;
