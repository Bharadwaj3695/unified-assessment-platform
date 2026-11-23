import { useState } from 'react';
import { Sparkles, X, Check, XCircle, Loader2, BookOpen, Layers } from 'lucide-react';
import { toast } from 'react-toastify';
import uapQuestionBankService from '../../services/uapQuestionBank.service';

export default function AiQuestionGeneratorModal({ isOpen, onClose, subjects = [], onQuestionsGenerated }) {
  const [selectedSubject, setSelectedSubject] = useState(subjects[0]?._id || '');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [topics, setTopics] = useState([]);
  const [questionType, setQuestionType] = useState('SINGLE_MCQ');
  const [difficulty, setDifficulty] = useState('MEDIUM');
  const [count, setCount] = useState(3);
  const [learningObjective, setLearningObjective] = useState('');
  const [referenceContent, setReferenceContent] = useState('');

  const [generating, setGenerating] = useState(false);
  const [currentJob, setCurrentJob] = useState(null);
  const [approvingId, setApprovingId] = useState(null);

  if (!isOpen) return null;

  const handleSubjectChange = async (subId) => {
    setSelectedSubject(subId);
    setSelectedTopic('');
    try {
      const res = await uapQuestionBankService.getTopics({ subjectId: subId });
      setTopics(res.data || []);
    } catch (_err) {
      setTopics([]);
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!selectedSubject) {
      toast.error('Please select a subject.');
      return;
    }

    try {
      setGenerating(true);
      const res = await uapQuestionBankService.createAiGenerationJob({
        subjectId: selectedSubject,
        topicId: selectedTopic || null,
        questionType,
        difficulty,
        count: Number(count),
        learningObjective,
        referenceContent,
      });

      setCurrentJob(res.data);
      toast.success('AI Draft generation completed! Please review drafts below.');
    } catch (err) {
      toast.error('Generation failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async (qItem) => {
    try {
      setApprovingId(qItem._id);
      await uapQuestionBankService.approveAiQuestion(currentJob._id, qItem._id);
      toast.success('Draft approved and committed into Mock Bank drafts.');

      // Refresh job
      const refreshed = await uapQuestionBankService.getAiGenerationJob(currentJob._id);
      setCurrentJob(refreshed.data);
      if (onQuestionsGenerated) onQuestionsGenerated();
    } catch (err) {
      toast.error('Approval failed: ' + err.message);
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (qItem) => {
    try {
      await uapQuestionBankService.rejectAiQuestion(currentJob._id, qItem._id, 'Faculty rejected');
      toast.info('Draft question rejected.');
      const refreshed = await uapQuestionBankService.getAiGenerationJob(currentJob._id);
      setCurrentJob(refreshed.data);
    } catch (err) {
      toast.error('Rejection failed: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-brand-primary/10 to-brand-peach/10 dark:from-brand-primary/20 dark:to-brand-peach/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-brand-primary text-white shadow-warm-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">AI Question Generator</h2>
              <p className="text-xs text-slate-500">
                Generate pedagogical draft questions. Faculty review & approval is strictly mandatory before publication.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Generation Config Form */}
          <form onSubmit={handleGenerate} className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Subject <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => handleSubjectChange(e.target.value)}
                required
                className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="">Select subject...</option>
                {subjects.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Topic (Optional)
              </label>
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="">All Topics</option>
                {topics.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Question Type
              </label>
              <select
                value={questionType}
                onChange={(e) => setQuestionType(e.target.value)}
                className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="SINGLE_MCQ">Single Choice (MCQ)</option>
                <option value="MULTI_SELECT">Multiple Select</option>
                <option value="CODING">Coding Challenge</option>
                <option value="SQL">SQL Challenge</option>
                <option value="SHORT_ANSWER">Short Answer</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Difficulty
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Count (1-10)
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Learning Objective
              </label>
              <input
                type="text"
                placeholder="e.g. Master Tree Traversal"
                value={learningObjective}
                onChange={(e) => setLearningObjective(e.target.value)}
                className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div className="sm:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={generating}
                className="px-5 py-2 text-xs font-semibold rounded-lg bg-brand-primary text-white hover:bg-brand-primary-hover shadow-warm-xs transition flex items-center gap-2"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {generating ? 'Synthesizing Questions...' : 'Generate Drafts'}
              </button>
            </div>
          </form>

          {/* Generated Questions Review Cards */}
          {currentJob && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Generated Drafts ({currentJob.generatedQuestions.length})
                </h3>
                <span className="text-xs text-slate-500">
                  Approved: {currentJob.approvedCount || 0} | Rejected: {currentJob.rejectedCount || 0}
                </span>
              </div>

              <div className="space-y-3">
                {currentJob.generatedQuestions.map((draft, idx) => (
                  <div
                    key={draft._id || idx}
                    className={`p-4 rounded-xl border text-sm transition space-y-3 ${
                      draft.reviewStatus === 'APPROVED'
                        ? 'border-emerald-300 bg-emerald-50/20 dark:border-emerald-900'
                        : draft.reviewStatus === 'REJECTED'
                        ? 'border-slate-200 bg-slate-100/50 opacity-60 dark:bg-slate-800/40'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/20 dark:text-brand-peach">
                            {draft.questionType}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {draft.difficulty}
                          </span>
                          {draft.reviewStatus === 'APPROVED' && (
                            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                              <Check className="w-3 h-3" /> Approved to Bank
                            </span>
                          )}
                          {draft.reviewStatus === 'REJECTED' && (
                            <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> Rejected
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-slate-900 dark:text-white">{draft.statement}</p>
                      </div>

                      {/* Actions */}
                      {draft.reviewStatus === 'PENDING_REVIEW' && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={approvingId === draft._id}
                            onClick={() => handleApprove(draft)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(draft)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 hover:text-rose-600 transition flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Options Preview */}
                    {draft.options?.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {draft.options.map((opt, i) => (
                          <div
                            key={opt.id || i}
                            className={`p-2 rounded border ${
                              opt.isCorrect
                                ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-medium'
                                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {opt.text}
                          </div>
                        ))}
                      </div>
                    )}

                    {draft.explanation && (
                      <p className="text-xs text-slate-500 italic">
                        <span className="font-medium text-slate-600 dark:text-slate-400">Explanation:</span> {draft.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
