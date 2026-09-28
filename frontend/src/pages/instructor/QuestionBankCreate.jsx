import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import questionBankService from '../../services/questionBank.service';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import {
  Database,
  ArrowLeft,
  AlertTriangle,
  Plus,
  Trash2,
  CheckCircle2,
  Info,
  Sparkles,
  Tag,
} from 'lucide-react';

const QuestionBankCreate = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  const [formData, setFormData] = useState({
    questionText: '',
    type: 'mcq',
    options: [
      { id: 'a', text: '' },
      { id: 'b', text: '' },
      { id: 'c', text: '' },
      { id: 'd', text: '' },
    ],
    correctAnswer: 'a',
    explanation: '',
    points: 5,
    difficulty: 'MEDIUM',
    bloomLevel: 'UNDERSTAND',
    category: 'Computer Science',
    tagsInput: '',
  });

  // Load question data when editing
  useEffect(() => {
    if (isEditing) {
      const fetchQuestion = async () => {
        try {
          setIsLoading(true);
          const res = await questionBankService.getQuestionById(id);
          const q = res.data?.question || res.data;
          if (q) {
            setFormData({
              questionText: q.questionText || '',
              type: q.type || 'mcq',
              options: Array.isArray(q.options) && q.options.length > 0 ? q.options : [
                { id: 'a', text: '' },
                { id: 'b', text: '' },
              ],
              correctAnswer: q.correctAnswer || (q.options?.[0]?.id || 'a'),
              explanation: q.explanation || '',
              points: q.points || 5,
              difficulty: q.difficulty || 'MEDIUM',
              bloomLevel: q.bloomLevel || 'UNDERSTAND',
              category: q.category || 'General',
              tagsInput: Array.isArray(q.tags) ? q.tags.join(', ') : '',
            });
          }
        } catch (err) {
          toast.error(err.message || 'Failed to load question for editing.');
          navigate('/instructor/question-bank');
        } finally {
          setIsLoading(false);
        }
      };
      fetchQuestion();
    }
  }, [id, isEditing, navigate]);

  // Debounced duplicate detection
  useEffect(() => {
    if (isEditing || !formData.questionText || formData.questionText.trim().length < 8) {
      setDuplicateWarning(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await questionBankService.checkDuplicate(formData.questionText);
        if (res.isDuplicate && res.duplicateQuestion) {
          setDuplicateWarning(res.duplicateQuestion);
        } else {
          setDuplicateWarning(null);
        }
      } catch {
        // ignore check errors
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [formData.questionText, isEditing]);

  const handleOptionChange = (idx, val) => {
    setFormData((prev) => {
      const updated = [...prev.options];
      updated[idx] = { ...updated[idx], text: val };
      return { ...prev, options: updated };
    });
  };

  const handleAddOption = () => {
    setFormData((prev) => {
      const nextLetter = String.fromCharCode(97 + prev.options.length);
      return {
        ...prev,
        options: [...prev.options, { id: nextLetter, text: '' }],
      };
    });
  };

  const handleRemoveOption = (idx) => {
    setFormData((prev) => {
      if (prev.options.length <= 2) {
        toast.warn('MCQ must have at least 2 options.');
        return prev;
      }
      const updated = prev.options.filter((_, i) => i !== idx);
      const activeCorrect = updated.some((opt) => opt.id === prev.correctAnswer)
        ? prev.correctAnswer
        : updated[0]?.id || 'a';
      return { ...prev, options: updated, correctAnswer: activeCorrect };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.questionText.trim()) {
      toast.error('Question text is required.');
      return;
    }

    if (formData.type === 'mcq') {
      const emptyOpts = formData.options.filter((o) => !o.text.trim());
      if (emptyOpts.length > 0) {
        toast.error('All MCQ options must have text.');
        return;
      }
      if (!formData.correctAnswer) {
        toast.error('Please select the correct answer for the MCQ.');
        return;
      }
    }

    try {
      setIsSaving(true);
      const tags = formData.tagsInput
        ? formData.tagsInput.split(',').map((t) => t.trim()).filter(Boolean)
        : [];

      const payload = {
        questionText: formData.questionText.trim(),
        type: formData.type,
        options: formData.type === 'mcq' ? formData.options : [],
        correctAnswer: formData.type === 'mcq' ? formData.correctAnswer : (formData.correctAnswer?.trim() || null),
        explanation: formData.explanation.trim() || null,
        points: parseInt(formData.points, 10) || 5,
        difficulty: formData.difficulty,
        bloomLevel: formData.bloomLevel,
        category: formData.category.trim() || 'General',
        tags,
      };

      if (isEditing) {
        await questionBankService.updateQuestion(id, payload);
        toast.success('Question updated successfully in Question Bank.');
      } else {
        await questionBankService.createQuestion(payload);
        toast.success('Question added to Question Bank.');
      }

      navigate('/instructor/question-bank');
    } catch (err) {
      toast.error(err.message || 'Failed to save question.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 flex justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link
            to="/instructor/question-bank"
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {isEditing ? 'Edit Question Bank Item' : 'Create Question Bank Item'}
            </h1>
            <p className="text-xs text-slate-500">
              {isEditing
                ? 'Updates will preserve historical assessments and submissions.'
                : 'Questions added here are instantly available across all assessments.'}
            </p>
          </div>
        </div>
      </div>

      {isEditing && (
        <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-lg flex items-start gap-2.5 text-xs text-indigo-900">
          <Info className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Automatic Versioning Guard:</span> If this question is already utilized in existing assessments, saving changes will automatically create a new version (e.g. Version 2). Historical assessments and student attempt grades will remain permanently anchored to their respective original versions.
          </div>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6 space-y-5">
          {/* Question Text Prompt */}
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">
              Question Prompt <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={formData.questionText}
              onChange={(e) => setFormData({ ...formData, questionText: e.target.value })}
              placeholder="e.g. What is the tightest upper bound time complexity of inserting into a Red-Black Tree?"
              className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />

            {/* Duplicate Detection Alert */}
            {duplicateWarning && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2 text-xs text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Possible Duplicate Detected:</span> A very similar question already exists in your Question Bank:
                  <div className="italic text-slate-700 mt-1">"{duplicateWarning.questionText}" ({duplicateWarning.category})</div>
                </div>
              </div>
            )}
          </div>

          {/* Classification & Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Question Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-md text-sm bg-white"
              >
                <option value="mcq">MCQ (Multiple Choice)</option>
                <option value="short_answer">Short Answer</option>
                <option value="long_answer">Long Answer</option>
                <option value="file_upload">File Upload (Phase 5 Document)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Bloom Taxonomy</label>
              <select
                value={formData.bloomLevel}
                onChange={(e) => setFormData({ ...formData, bloomLevel: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-md text-sm bg-white"
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Difficulty</label>
              <select
                value={formData.difficulty}
                onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-md text-sm bg-white"
              >
                <option value="EASY">EASY</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HARD">HARD</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Points Value</label>
              <input
                type="number"
                min="1"
                max="100"
                value={formData.points}
                onChange={(e) => setFormData({ ...formData, points: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-md text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category / Subject Area</label>
              <input
                type="text"
                placeholder="e.g. Data Structures, Web Architecture"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-md text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tags (Comma Separated)</label>
              <input
                type="text"
                placeholder="e.g. tree, sorting, complexity, https"
                value={formData.tagsInput}
                onChange={(e) => setFormData({ ...formData, tagsInput: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
          </div>

          {/* Type Specific Fields */}
          {formData.type === 'mcq' ? (
            <div className="pt-2 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  Multiple Choice Options & Correct Answer
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddOption}
                  className="flex items-center gap-1 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Option
                </Button>
              </div>

              <div className="space-y-2">
                {formData.options.map((opt, idx) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correctAnswer"
                      checked={formData.correctAnswer === opt.id}
                      onChange={() => setFormData({ ...formData, correctAnswer: opt.id })}
                      className="w-4 h-4 text-primary-600 focus:ring-primary-500 cursor-pointer"
                      title="Select as correct answer"
                    />
                    <span className="text-xs font-bold text-slate-500 uppercase w-5 text-center">
                      {opt.id}.
                    </span>
                    <input
                      type="text"
                      placeholder={`Option ${opt.id.toUpperCase()} text...`}
                      value={opt.text}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                      className="flex-1 p-2 border border-slate-300 rounded-md text-sm"
                      required
                    />
                    {formData.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(idx)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                        title="Remove option"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="pt-2 border-t border-slate-200 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sample Correct Answer / Rubric Criterion
                </label>
                <textarea
                  rows={2}
                  placeholder="Expected answer key or evaluation criteria for grading..."
                  value={formData.correctAnswer}
                  onChange={(e) => setFormData({ ...formData, correctAnswer: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-md text-sm"
                />
              </div>
            </div>
          )}

          {/* Explanation / Grading Feedback */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Explanation & Feedback (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Provide context on why this answer is correct or helpful learning feedback..."
              value={formData.explanation}
              onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
              className="w-full p-2.5 border border-slate-300 rounded-md text-sm"
            />
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/instructor/question-bank')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : isEditing ? 'Update Question' : 'Save to Question Bank'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default QuestionBankCreate;
