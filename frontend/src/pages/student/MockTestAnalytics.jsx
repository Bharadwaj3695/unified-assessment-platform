import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Award, CheckCircle2, XCircle, AlertCircle, TrendingUp, ArrowLeft, BookOpen, Layers } from 'lucide-react';
import uapQuestionBankService from '../../services/uapQuestionBank.service';

export default function MockTestAnalytics() {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReport() {
      try {
        setLoading(true);
        const res = await uapQuestionBankService.getMockTestAnalytics(attemptId);
        setAttempt(res.data);
      } catch (_err) {
        setAttempt(null);
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [attemptId]);

  if (loading) {
    return <div className="p-12 text-center text-sm text-slate-400">Loading performance report...</div>;
  }

  if (!attempt) {
    return <div className="p-12 text-center text-sm text-slate-400">Attempt analytics not found.</div>;
  }

  const scorePercentage = attempt.percentage || 0;

  return (
    <div className="space-y-6 pb-16">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/student/mock-tests')}
            className="text-xs text-brand-primary dark:text-brand-peach font-semibold flex items-center gap-1 mb-2 hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Mock Tests
          </button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Performance Analytics & Concept Diagnostic</h1>
          <p className="text-sm text-slate-500">
            {attempt.mockTestId?.title || 'Mock Examination'} | Evaluated Result
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs text-slate-400 uppercase font-semibold block">Total Score</span>
            <span className="text-2xl font-extrabold text-brand-primary dark:text-brand-peach">
              {attempt.earnedMarks} / {attempt.totalMarks}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold text-lg border border-emerald-200 dark:border-emerald-800">
            {scorePercentage}%
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs text-slate-500 font-medium block">Correct Answers</span>
          <span className="text-xl font-bold text-emerald-600 mt-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-5 h-5" />
            {attempt.correctCount}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs text-slate-500 font-medium block">Incorrect Answers</span>
          <span className="text-xl font-bold text-rose-600 mt-1 flex items-center gap-1.5">
            <XCircle className="w-5 h-5" />
            {attempt.incorrectCount}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs text-slate-500 font-medium block">Unanswered</span>
          <span className="text-xl font-bold text-slate-500 mt-1 flex items-center gap-1.5">
            <AlertCircle className="w-5 h-5" />
            {attempt.unansweredCount}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs text-slate-500 font-medium block">Time Spent</span>
          <span className="text-xl font-bold text-brand-primary dark:text-brand-peach mt-1">
            {Math.round((attempt.timeSpentSeconds || 60) / 60)} mins
          </span>
        </div>
      </div>

      {/* Concept-Wise Performance Breakdown (Section 14) */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-brand-primary dark:text-brand-peach" />
              Concept-Wise Mastery & Evidence Diagnostic
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Confidence levels are computed based on the quantity of evidence questions attempted.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {(!attempt.conceptWiseAnalytics || attempt.conceptWiseAnalytics.length === 0) ? (
            <p className="text-xs text-slate-400">No concept mapping recorded for these questions.</p>
          ) : (
            attempt.conceptWiseAnalytics.map((conceptItem, i) => (
              <div
                key={i}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {conceptItem.concept}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        conceptItem.confidenceScore === 'HIGH'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : conceptItem.confidenceScore === 'MEDIUM'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {conceptItem.confidenceScore} CONFIDENCE ({conceptItem.questionsAttempted} items)
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {conceptItem.correctCount} of {conceptItem.questionsAttempted} questions answered correctly
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-32 bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        conceptItem.accuracyPercentage >= 70
                          ? 'bg-emerald-500'
                          : conceptItem.accuracyPercentage >= 40
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${conceptItem.accuracyPercentage}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200 w-12 text-right">
                    {conceptItem.accuracyPercentage}%
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Difficulty-Wise Breakdown */}
      {attempt.difficultyWiseAnalytics && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Difficulty Distribution Breakdown
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/20">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase">Easy Tier</span>
              <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                {attempt.difficultyWiseAnalytics.easy?.correct || 0} / {attempt.difficultyWiseAnalytics.easy?.total || 0}
              </p>
            </div>
            <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/20">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase">Medium Tier</span>
              <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                {attempt.difficultyWiseAnalytics.medium?.correct || 0} / {attempt.difficultyWiseAnalytics.medium?.total || 0}
              </p>
            </div>
            <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/20">
              <span className="text-xs font-bold text-rose-700 dark:text-rose-300 uppercase">Hard Tier</span>
              <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                {attempt.difficultyWiseAnalytics.hard?.correct || 0} / {attempt.difficultyWiseAnalytics.hard?.total || 0}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
