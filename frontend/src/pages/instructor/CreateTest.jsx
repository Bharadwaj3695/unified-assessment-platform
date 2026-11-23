import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Sliders,
  Sparkles,
  Users,
  ArrowRight,
  Lock,
  CheckCircle2,
  Clock,
  Shield,
  FileCheck2,
  Database,
  Layers,
  HelpCircle,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import MockTestBlueprintModal from '../../components/instructor/MockTestBlueprintModal';
import uapQuestionBankService from '../../services/uapQuestionBank.service';

/**
 * Dedicated Create Test Entry Point
 * Displays 4 testing paradigm cards:
 * 1. Assessment (Course/Classroom timed exam) -> launches AssessmentBuilder
 * 2. Mock Test (Practice blueprint exam) -> launches MockTestBlueprintModal
 * 3. AI Mock Interview (Coming soon placeholder)
 * 4. Faculty Interview (Coming soon placeholder)
 */
export default function CreateTest() {
  const navigate = useNavigate();
  const [isMockModalOpen, setIsMockModalOpen] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  useEffect(() => {
    async function fetchSubjects() {
      try {
        setLoadingSubjects(true);
        const res = await uapQuestionBankService.getSubjects();
        setSubjects(res.data || []);
      } catch (_err) {
        setSubjects([]);
      } finally {
        setLoadingSubjects(false);
      }
    }
    fetchSubjects();
  }, []);

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="rounded-3xl border border-surface-light-border dark:border-surface-dark-border bg-gradient-to-r from-[#FFF4EB] via-white to-[#EEF6F4] dark:from-[#241712] dark:via-surface-dark dark:to-[#132822] p-6 lg:p-8 shadow-warm-xs">
        <div className="max-w-2xl">
          <div className="flex items-center space-x-2 mb-2">
            <Badge variant="sage" size="sm" dot>
              Faculty Workspace
            </Badge>
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
              · Test Creation Hub
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-display tracking-tight text-slate-900 dark:text-slate-100">
            Create Test & Examination
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Select the testing paradigm for your curriculum. Author structured course assessments,
            generate syllabus-calibrated mock blueprints, or plan live oral examinations.
          </p>
        </div>
      </div>

      {/* 4 Central Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Course Assessment */}
        <div className="rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark p-6 shadow-warm-xs hover:shadow-warm-md hover:border-brand-peach/60 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-brand-primary-light dark:bg-brand-primary-dark text-brand-primary flex items-center justify-center shadow-warm-xs">
                <BookOpen className="w-6 h-6" />
              </div>
              <Badge variant="sage" size="sm" dot>
                Available
              </Badge>
            </div>

            <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white">
              Course Assessment
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              Classroom, course, and institutional examinations. Configure multiple-choice questions,
              programming challenges, SQL sandboxes, subjective essays, and file submissions.
            </p>

            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex items-center text-xs text-slate-600 dark:text-slate-400">
                <Clock className="w-4 h-4 mr-2 text-slate-400" />
                <span>Strict time windows & auto-submission</span>
              </div>
              <div className="flex items-center text-xs text-slate-600 dark:text-slate-400">
                <Shield className="w-4 h-4 mr-2 text-slate-400" />
                <span>Online proctoring & camera monitoring</span>
              </div>
              <div className="flex items-center text-xs text-slate-600 dark:text-slate-400">
                <FileCheck2 className="w-4 h-4 mr-2 text-slate-400" />
                <span>Automated test suites & faculty grading studio</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="primary"
              size="md"
              className="w-full justify-center"
              icon={ArrowRight}
              iconPosition="right"
              onClick={() => navigate('/instructor/create')}
            >
              Create Assessment
            </Button>
          </div>
        </div>

        {/* Card 2: Mock Test */}
        <div className="rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark p-6 shadow-warm-xs hover:shadow-warm-md hover:border-brand-sage/60 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-brand-sage-light dark:bg-brand-sage-dark text-brand-sage flex items-center justify-center shadow-warm-xs">
                <Sliders className="w-6 h-6" />
              </div>
              <Badge variant="sage" size="sm" dot>
                Available
              </Badge>
            </div>

            <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white">
              Mock Test & Blueprint
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              Practice exams, syllabus-calibrated blueprints, and immutable question snapshot
              resolution drawn from the centralized Mock Bank repository.
            </p>

            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex items-center text-xs text-slate-600 dark:text-slate-400">
                <Database className="w-4 h-4 mr-2 text-slate-400" />
                <span>Blueprint rules across subjects & topics</span>
              </div>
              <div className="flex items-center text-xs text-slate-600 dark:text-slate-400">
                <Layers className="w-4 h-4 mr-2 text-slate-400" />
                <span>Difficulty distribution (Easy, Medium, Hard)</span>
              </div>
              <div className="flex items-center text-xs text-slate-600 dark:text-slate-400">
                <CheckCircle2 className="w-4 h-4 mr-2 text-slate-400" />
                <span>Locked question version snapshots on publish</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="secondary"
              size="md"
              className="w-full justify-center"
              icon={ArrowRight}
              iconPosition="right"
              onClick={() => setIsMockModalOpen(true)}
            >
              Create Mock Test
            </Button>
          </div>
        </div>

        {/* Card 3: AI Mock Interview */}
        <div className="rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-slate-50/70 dark:bg-surface-dark/40 p-6 shadow-warm-xs flex flex-col justify-between opacity-85">
          <div>
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <Badge variant="neutral" size="sm">
                Coming Soon
              </Badge>
            </div>

            <h2 className="text-xl font-bold font-display text-slate-700 dark:text-slate-300">
              AI Mock Interview
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              Autonomous AI-led technical and behavioral interview simulations. Generates real-time
              follow-up questions, speech assessment, and competency scorecards.
            </p>

            <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-800/60 space-y-2">
              <div className="flex items-center text-xs text-slate-400">
                <Lock className="w-4 h-4 mr-2" />
                <span>Audio voice conversation & speech recognition</span>
              </div>
              <div className="flex items-center text-xs text-slate-400">
                <Lock className="w-4 h-4 mr-2" />
                <span>Adaptive domain-specific follow-up questions</span>
              </div>
              <div className="flex items-center text-xs text-slate-400">
                <Lock className="w-4 h-4 mr-2" />
                <span>Multi-parameter communication & technical grading</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200/60 dark:border-slate-800/60">
            <Button
              variant="outline"
              size="md"
              className="w-full justify-center opacity-60 cursor-not-allowed"
              disabled
            >
              Coming Soon
            </Button>
          </div>
        </div>

        {/* Card 4: Faculty Interview */}
        <div className="rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-slate-50/70 dark:bg-surface-dark/40 p-6 shadow-warm-xs flex flex-col justify-between opacity-85">
          <div>
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <Badge variant="neutral" size="sm">
                Coming Soon
              </Badge>
            </div>

            <h2 className="text-xl font-bold font-display text-slate-700 dark:text-slate-300">
              Faculty Face-to-Face Viva
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              Faculty-led live 1-on-1 student oral examinations, capstone defense sessions,
              and synchronized rubric evaluation workflows.
            </p>

            <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-800/60 space-y-2">
              <div className="flex items-center text-xs text-slate-400">
                <Lock className="w-4 h-4 mr-2" />
                <span>Live video conferencing & student identity check</span>
              </div>
              <div className="flex items-center text-xs text-slate-400">
                <Lock className="w-4 h-4 mr-2" />
                <span>Instant oral viva rubric score submission</span>
              </div>
              <div className="flex items-center text-xs text-slate-400">
                <Lock className="w-4 h-4 mr-2" />
                <span>Multi-faculty panel score normalization</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200/60 dark:border-slate-800/60">
            <Button
              variant="outline"
              size="md"
              className="w-full justify-center opacity-60 cursor-not-allowed"
              disabled
            >
              Coming Soon
            </Button>
          </div>
        </div>
      </div>

      {/* Modal for Mock Test Blueprint creation */}
      {isMockModalOpen && (
        <MockTestBlueprintModal
          isOpen={isMockModalOpen}
          onClose={() => setIsMockModalOpen(false)}
          subjects={subjects}
          onCreated={() => {
            navigate('/instructor/assessments');
          }}
        />
      )}
    </div>
  );
}
