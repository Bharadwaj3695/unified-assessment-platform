import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Sliders, ArrowRight, CheckCircle2, Circle } from 'lucide-react';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';

/**
 * Faculty Create Test Hub
 * Compact, concise, action-focused test type selector.
 */
export default function CreateTest() {
  const navigate = useNavigate();
  const [selectedTestType, setSelectedTestType] = useState('assessment');

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

      {/* Two Selectable Cards Grid */}
      <div
        data-testid="create-test-two-cards-grid"
        className="grid grid-cols-1 md:grid-cols-2 gap-5"
      >
        {/* Card 1: Assessment */}
        <div
          data-testid="card-assessment"
          onClick={() => setSelectedTestType('assessment')}
          className={`cursor-pointer rounded-2xl border p-5 sm:p-6 transition-all shadow-warm-xs flex flex-col justify-between ${
            selectedTestType === 'assessment'
              ? 'border-brand-primary ring-2 ring-brand-primary/20 bg-brand-primary-light/20 dark:bg-brand-primary-dark/20'
              : 'border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark hover:border-brand-primary/40'
          }`}
        >
          <div>
            <div className="flex items-start justify-between mb-4">
              <div className="w-11 h-11 rounded-xl bg-brand-primary-light dark:bg-brand-primary-dark text-brand-primary flex items-center justify-center shadow-warm-xs">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="sm">
                  Assessment
                </Badge>
                {selectedTestType === 'assessment' ? (
                  <CheckCircle2 className="w-5 h-5 text-brand-primary" />
                ) : (
                  <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                )}
              </div>
            </div>

            <h2 className="text-lg sm:text-xl font-bold font-display tracking-tight text-slate-900 dark:text-white">
              Assessment
            </h2>
            <p className="text-xs font-medium text-brand-primary dark:text-brand-peach mt-0.5">
              Course assessment
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
              Classroom, course, and institutional examinations.
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <Button
              variant={selectedTestType === 'assessment' ? 'primary' : 'outline'}
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTestType('assessment');
                navigate('/instructor/test-creator?type=assessment');
              }}
            >
              Launch
            </Button>
          </div>
        </div>

        {/* Card 2: Mock Test */}
        <div
          data-testid="card-mock-test"
          onClick={() => setSelectedTestType('mock')}
          className={`cursor-pointer rounded-2xl border p-5 sm:p-6 transition-all shadow-warm-xs flex flex-col justify-between ${
            selectedTestType === 'mock'
              ? 'border-brand-sage ring-2 ring-brand-sage/20 bg-brand-sage-light/20 dark:bg-brand-sage-dark/20'
              : 'border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark hover:border-brand-sage/40'
          }`}
        >
          <div>
            <div className="flex items-start justify-between mb-4">
              <div className="w-11 h-11 rounded-xl bg-brand-sage-light dark:bg-brand-sage-dark text-brand-sage flex items-center justify-center shadow-warm-xs">
                <Sliders className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="sage" size="sm">
                  Mock Test
                </Badge>
                {selectedTestType === 'mock' ? (
                  <CheckCircle2 className="w-5 h-5 text-brand-sage" />
                ) : (
                  <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                )}
              </div>
            </div>

            <h2 className="text-lg sm:text-xl font-bold font-display tracking-tight text-slate-900 dark:text-white">
              Mock Test
            </h2>
            <p className="text-xs font-medium text-brand-sage dark:text-emerald-400 mt-0.5">
              Practice test
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
              Syllabus-calibrated practice examinations and blueprints.
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <Button
              variant={selectedTestType === 'mock' ? 'sage' : 'outline'}
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTestType('mock');
                navigate('/instructor/test-creator?type=mock');
              }}
            >
              Launch
            </Button>
          </div>
        </div>
      </div>

      {/* Selected Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark shadow-warm-xs">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            Selected Test Type:
          </span>
          <Badge
            variant={selectedTestType === 'assessment' ? 'primary' : 'sage'}
            size="md"
            dot
          >
            {selectedTestType === 'assessment' ? 'Course assessment' : 'Practice test'}
          </Badge>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={ArrowRight}
          iconPosition="right"
          onClick={handleLaunch}
          data-testid="btn-launch-creator"
        >
          Launch Test Creator
        </Button>
      </div>
    </div>
  );
}
