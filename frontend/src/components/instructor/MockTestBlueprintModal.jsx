import { useState, useEffect } from 'react';
import { Sliders, X, Check, Loader2, Sparkles, BookOpen } from 'lucide-react';
import { toast } from 'react-toastify';
import uapQuestionBankService from '../../services/uapQuestionBank.service';

export default function MockTestBlueprintModal({ isOpen, onClose, subjects = [], onCreated }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    examination: '',
    subjectId: subjects[0]?._id || '',
    topicIds: [],
    durationMinutes: 60,
    totalMarks: 100,
    questionCount: 15,
    negativeMarking: true,
    negativeMarkingRatio: 0.33,
    difficultyDistribution: {
      easy: 30,
      medium: 50,
      hard: 20,
    },
  });

  const [topics, setTopics] = useState([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (formData.subjectId) {
      async function fetchTopics() {
        try {
          setLoadingTopics(true);
          const res = await uapQuestionBankService.getTopics({ subjectId: formData.subjectId });
          setTopics(res.data || []);
        } catch (_err) {
          setTopics([]);
        } finally {
          setLoadingTopics(false);
        }
      }
      fetchTopics();
    }
  }, [formData.subjectId]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Please enter a mock test title.');
      return;
    }
    if (!String(formData.examination || '').trim()) {
      toast.error('Please enter a target examination.');
      return;
    }
    if (!formData.subjectId) {
      toast.error('Please select a subject.');
      return;
    }

    try {
      setSubmitting(true);
      // Create Mock Test
      const createRes = await uapQuestionBankService.createMockTest({
        ...formData,
        examination: String(formData.examination).trim(),
      });
      const testId = createRes.data._id || createRes.data.id;

      // Auto-generate question selection from blueprint
      await uapQuestionBankService.generateMockTestBlueprint(testId);
      // Publish the mock test
      await uapQuestionBankService.publishMockTest(testId);

      toast.success('Mock Test generated and published with locked question versions!');
      if (onCreated) onCreated();
      onClose();
    } catch (err) {
      toast.error('Failed to create mock test: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-brand-primary text-white shadow-warm-xs">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Mock Test Blueprint Builder</h2>
              <p className="text-xs text-slate-500">
                Define blueprint distributions. The selection engine resolves and locks immutable question snapshots.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Test Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. GATE 2026 Full-Length Mock Exam #1"
              className="w-full p-2.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="blueprint-target-examination"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Target Examination
              </label>
              <input
                id="blueprint-target-examination"
                type="text"
                value={formData.examination}
                onChange={(e) => setFormData((prev) => ({ ...prev, examination: e.target.value }))}
                placeholder="Enter examination name"
                data-testid="blueprint-input-target-examination"
                className="w-full p-2.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Subject <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={formData.subjectId}
                onChange={(e) => setFormData((prev) => ({ ...prev, subjectId: e.target.value, topicIds: [] }))}
                className="w-full p-2.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="">Select Subject...</option>
                {subjects.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Topics selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Scope Topics (Leave empty for all subject topics)
            </label>
            <div className="max-h-28 overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded-lg space-y-1 bg-slate-50 dark:bg-slate-800/40">
              {topics.map((t) => (
                <label key={t._id} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.topicIds.includes(t._id)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFormData((prev) => ({
                        ...prev,
                        topicIds: checked ? [...prev.topicIds, t._id] : prev.topicIds.filter((id) => id !== t._id),
                      }));
                    }}
                    className="w-3.5 h-3.5 rounded text-brand-primary focus:ring-brand-primary"
                  />
                  <span>{t.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Timing & Scoring */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Duration (min)
              </label>
              <input
                type="number"
                min="5"
                value={formData.durationMinutes}
                onChange={(e) => setFormData((prev) => ({ ...prev, durationMinutes: Number(e.target.value) }))}
                className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Question Count
              </label>
              <input
                type="number"
                min="1"
                value={formData.questionCount}
                onChange={(e) => setFormData((prev) => ({ ...prev, questionCount: Number(e.target.value) }))}
                className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Total Marks
              </label>
              <input
                type="number"
                min="1"
                value={formData.totalMarks}
                onChange={(e) => setFormData((prev) => ({ ...prev, totalMarks: Number(e.target.value) }))}
                className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700"
              />
            </div>
          </div>

          {/* Difficulty Blueprint sliders */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 space-y-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
              Difficulty Distribution Ratio (%)
            </span>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-emerald-600 font-semibold">Easy: {formData.difficultyDistribution.easy}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formData.difficultyDistribution.easy}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      difficultyDistribution: { ...prev.difficultyDistribution, easy: Number(e.target.value) },
                    }))
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-[11px] text-amber-600 font-semibold">Medium: {formData.difficultyDistribution.medium}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formData.difficultyDistribution.medium}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      difficultyDistribution: { ...prev.difficultyDistribution, medium: Number(e.target.value) },
                    }))
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-[11px] text-rose-600 font-semibold">Hard: {formData.difficultyDistribution.hard}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formData.difficultyDistribution.hard}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      difficultyDistribution: { ...prev.difficultyDistribution, hard: Number(e.target.value) },
                    }))
                  }
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="neg-marking-toggle"
              checked={formData.negativeMarking}
              onChange={(e) => setFormData((prev) => ({ ...prev, negativeMarking: e.target.checked }))}
              className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary"
            />
            <label htmlFor="neg-marking-toggle" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
              Apply Negative Marking (deduct 0.33x on incorrect attempts)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold rounded-lg bg-brand-primary text-white hover:bg-brand-primary-hover shadow-warm-xs transition flex items-center gap-1.5"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {submitting ? 'Generating Test...' : 'Generate & Publish Blueprint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
