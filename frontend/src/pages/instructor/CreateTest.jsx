import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  Sliders,
  Sparkles,
  Users,
  CheckCircle2,
  Circle,
  ArrowRight,
} from 'lucide-react';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';

/**
 * Faculty Create Test Hub
 *
 * Layout Blueprint:
 * - Breadcrumb: Faculty Workspace / Create Test
 * - Title: Create Test
 * - Subtitle: Select test type
 * - Primary Test Creation Card:
 *   - Options: Course Assessment & Mock Test inside ONE shared card
 *   - Both selectable with clear highlight
 *   - One "Launch" button inside the same card
 * - Interview Options:
 *   - AI Mock Interview ("Coming Soon") & Faculty Interview (links to /instructor/interviews)
 */
export default function CreateTest() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get('type') === 'mock' ? 'mock' : 'assessment';
  const [selectedTestType, setSelectedTestType] = useState(initialType);

  useEffect(() => {
    const type = searchParams.get('type');
    if (type === 'mock' || type === 'assessment') {
      setSelectedTestType(type);
    }
  }, [searchParams.get('type')]);

  const handleLaunch = () => {
    navigate(`/instructor/test-creator?type=${selectedTestType}`);
  };

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto" data-testid="faculty-create-test-hub">
      {/* Page Header */}
      <div className="rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark p-6 shadow-warm-xs">
        <div className="flex items-center space-x-2 mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span>Faculty Workspace</span>
          <span>/</span>
          <span className="text-brand-primary dark:text-brand-peach">Create Test</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-slate-900 dark:text-slate-100">
          Create Test
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Select test type
        </p>
      </div>

      {/* Primary Test Creation Card (Contains both Assessment & Mock Test) */}
      <div
        data-testid="card-primary-test-creation"
        className="rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark p-6 shadow-warm-xs space-y-6"
      >
        <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-lg font-bold font-display text-slate-900 dark:text-white">
            Select Test Type
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Choose the examination format to open in Test Creator Studio
          </p>
        </div>

        {/* Selectable Options List */}
        <div className="space-y-3">
          {/* Option 1: Course Assessment */}
          <div
            data-testid="option-course-assessment"
            onClick={() => setSelectedTestType('assessment')}
            className={`cursor-pointer rounded-xl border p-4 sm:p-5 transition-all flex items-start gap-4 ${
              selectedTestType === 'assessment'
                ? 'border-brand-primary ring-2 ring-brand-primary/20 bg-brand-primary-light/20 dark:bg-brand-primary-dark/20'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="pt-0.5">
              {selectedTestType === 'assessment' ? (
                <CheckCircle2 className="w-5 h-5 text-brand-primary shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-slate-400 dark:text-slate-600 shrink-0" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Course Assessment
                </span>
                <Badge variant="primary" size="sm">
                  Assessment
                </Badge>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Classroom, course, and institutional examinations with scheduling, cohorts, and grading rules.
              </p>
            </div>

            <div className="hidden sm:flex items-center justify-center w-9 h-9 rounded-xl bg-brand-primary-light dark:bg-brand-primary-dark text-brand-primary shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>

          {/* Option 2: Mock Test */}
          <div
            data-testid="option-mock-test"
            onClick={() => setSelectedTestType('mock')}
            className={`cursor-pointer rounded-xl border p-4 sm:p-5 transition-all flex items-start gap-4 ${
              selectedTestType === 'mock'
                ? 'border-brand-sage ring-2 ring-brand-sage/20 bg-brand-sage-light/20 dark:bg-brand-sage-dark/20'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="pt-0.5">
              {selectedTestType === 'mock' ? (
                <CheckCircle2 className="w-5 h-5 text-brand-sage shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-slate-400 dark:text-slate-600 shrink-0" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Mock Test
                </span>
                <Badge variant="sage" size="sm">
                  Practice test
                </Badge>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Syllabus-calibrated practice examinations with blueprint distribution and negative marking.
              </p>
            </div>

            <div className="hidden sm:flex items-center justify-center w-9 h-9 rounded-xl bg-brand-sage-light dark:bg-brand-sage-dark text-brand-sage shrink-0">
              <Sliders className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Launch Button inside the same card */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Selected format:{' '}
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {selectedTestType === 'assessment' ? 'Course Assessment' : 'Mock Test'}
            </span>
          </div>
          <Button
            variant="primary"
            size="md"
            icon={ArrowRight}
            onClick={handleLaunch}
            className="w-full sm:w-auto px-8"
            data-testid="btn-launch-creator"
          >
            Launch
          </Button>
        </div>
      </div>

      {/* Interview Assessments */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Interview Assessments
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card: AI Mock Interview */}
          <div
            data-testid="card-interview-ai"
            className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 p-5 flex items-start gap-3.5 opacity-80"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  AI Mock Interview
                </h4>
                <Badge variant="neutral" size="sm">
                  Coming Soon
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Automated conversational technical interviews with real-time rubric feedback.
              </p>
            </div>
          </div>

          {/* Card: Faculty Interview */}
          <button
            type="button"
            data-testid="card-interview-faculty"
            onClick={() => navigate('/instructor/interviews')}
            className="group text-left w-full cursor-pointer rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark p-5 shadow-warm-xs transition-all flex items-start gap-3.5 hover:border-brand-primary/60 dark:hover:border-brand-primary/60 hover:ring-2 hover:ring-brand-primary/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Faculty Interview
                </h4>
                <Badge variant="secondary" size="sm">
                  Available
                </Badge>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Live one-on-one evaluative faculty interviews with structured assessment rubrics.
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-primary dark:text-brand-peach group-hover:translate-x-0.5 transition-transform">
                <span>Open Faculty Interview Studio</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
