import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../hooks/useAuth';
import { getTimeBasedGreeting } from '../../utils/greeting';
import assessmentService from '../../services/assessment.service';
import submissionService from '../../services/submission.service';
import analyticsService from '../../services/analytics.service';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import StatCard from '../../components/common/StatCard';
import PerformanceDonutChart from '../../components/charts/PerformanceDonutChart';
import ScoreTrendChart from '../../components/charts/ScoreTrendChart';
import { StudentHeroIllustration } from '../../components/illustrations';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from '../../components/ui/Table';
import {
  BookOpen,
  Clock,
  CheckCircle2,
  AlertCircle,
  Award,
  ArrowRight,
  RefreshCw,
  FileCheck2,
  Search,
  User,
  GraduationCap,
  Sparkles,
  Calendar,
  Lock,
  Globe,
  Shield,
  Camera,
  AlertTriangle,
  TrendingUp,
  MessageSquare,
  Eye,
  Layers,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Flame,
  Trophy,
  Target,
  BarChart2,
  TrendingDown,
  Minus,
  Zap,
  Medal,
  Star,
} from 'lucide-react';

const STANDARD_CATEGORIES = [
  'Artificial Intelligence',
  'Computer Science',
  'Cybersecurity',
  'Data Structures & Algorithms',
  'Database Systems',
  'DevOps & Cloud',
  'General',
  'Software Engineering',
  'Web Development',
];

const StudentDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [assessments, setAssessments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [performanceData, setPerformanceData] = useState(null);
  const [scoreTrends, setScoreTrends] = useState([]);
  const [dateFilter, setDateFilter] = useState('all');
  const [leaderboardScope, setLeaderboardScope] = useState('overall');
  const [selectedLeaderboardAssessment, setSelectedLeaderboardAssessment] = useState('');
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedAssessmentForModal, setSelectedAssessmentForModal] = useState(null);
  const [selectedFeedbackSubmission, setSelectedFeedbackSubmission] = useState(null);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);

  const openFeedbackModal = async (subId) => {
    try {
      setIsLoadingFeedback(true);
      const detail = await submissionService.getSubmissionById(subId);
      setSelectedFeedbackSubmission(detail);
    } catch (err) {
      toast.error(err.message || 'Failed to load evaluation feedback');
    } finally {
      setIsLoadingFeedback(false);
    }
  };

  const handleDownloadStudentFile = async (subId, qId, download = false, filename = 'submission.pdf') => {
    try {
      const blob = await submissionService.getAnswerFileBlob(subId, qId, download);
      const url = window.URL.createObjectURL(blob);
      if (download) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        window.open(url, '_blank');
      }
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);
    } catch (err) {
      toast.error(err.message || 'Failed to download document');
    }
  };

  // Determine sub-view based on current route
  const currentView = useMemo(() => {
    if (location.pathname.includes('/student/catalog')) return 'catalog';
    if (location.pathname.includes('/student/submissions')) return 'submissions';
    if (location.pathname.includes('/student/profile')) return 'profile';
    return 'dashboard';
  }, [location.pathname]);

  // Derive categories unconditionally to comply with React's Rules of Hooks
  const categories = useMemo(() => {
    const set = new Set();
    assessments.forEach((a) => {
      if (a.category && a.category.trim()) {
        set.add(a.category.trim());
      }
    });
    STANDARD_CATEGORIES.forEach((cat) => set.add(cat));
    return ['All', ...Array.from(set).sort()];
  }, [assessments]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const analyticsParams = dateFilter !== 'all' ? { dateFilter } : {};
      const [asmtRes, subRes, perfRes, trendsRes] = await Promise.all([
        assessmentService.getAssessments({ limit: 200 }),
        submissionService.getStudentSubmissions(),
        analyticsService.getStudentPerformance(analyticsParams).catch(() => null),
        analyticsService.getStudentTrends(analyticsParams).catch(() => []),
      ]);

      const loadedAssessments = asmtRes.data || asmtRes.assessments || [];
      const loadedSubmissions = subRes || [];

      setAssessments(loadedAssessments);
      setSubmissions(loadedSubmissions);
      if (perfRes) setPerformanceData(perfRes);
      if (trendsRes) setScoreTrends(trendsRes);
    } catch (err) {
      setError(err.message || 'Failed to retrieve assessment data.');
    } finally {
      setIsLoading(false);
    }
  }, [dateFilter]);

  const loadLeaderboard = useCallback(async () => {
    try {
      setIsLoadingLeaderboard(true);
      const params = {
        scope: leaderboardScope,
        limit: 10,
      };
      if (leaderboardScope === 'assessment' && selectedLeaderboardAssessment) {
        params.assessmentId = selectedLeaderboardAssessment;
      }
      const data = await analyticsService.getLeaderboard(params);
      setLeaderboardData(data);
    } catch (err) {
      console.warn('[Leaderboard] Failed to load leaderboard:', err.message);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  }, [leaderboardScope, selectedLeaderboardAssessment]);

  useEffect(() => {
    loadData();
  }, [loadData, location.pathname]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  useEffect(() => {
    if (!selectedLeaderboardAssessment && assessments.length > 0) {
      const firstId = assessments[0]._id || assessments[0].id;
      if (firstId) setSelectedLeaderboardAssessment(firstId.toString());
    }
  }, [assessments, selectedLeaderboardAssessment]);

  // 1. Trend Direction Calculation
  const trendDirection = useMemo(() => {
    if (!scoreTrends || scoreTrends.length < 2) return null;
    const overallAvg =
      performanceData?.overallAverageScore !== null && performanceData?.overallAverageScore !== undefined
        ? performanceData.overallAverageScore
        : scoreTrends.reduce((acc, t) => acc + (t.percentage || 0), 0) / scoreTrends.length;

    const lastN = scoreTrends.slice(-3);
    const recentAvg = lastN.reduce((acc, t) => acc + (t.percentage || 0), 0) / lastN.length;
    const diff = recentAvg - overallAvg;

    if (diff > 3) {
      return {
        label: 'Improving',
        bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
        Icon: TrendingUp,
        description: `Your last ${lastN.length} attempts avg (${Math.round(recentAvg)}%) is higher than your overall average (${Math.round(overallAvg)}%).`,
      };
    }
    if (diff < -3) {
      return {
        label: 'Declining',
        bg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-800',
        Icon: TrendingDown,
        description: `Your last ${lastN.length} attempts avg (${Math.round(recentAvg)}%) is lower than your overall average (${Math.round(overallAvg)}%).`,
      };
    }
    return {
      label: 'Steady',
      bg: 'bg-slate-50 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300 border-slate-200 dark:border-slate-700',
      Icon: Minus,
      description: `Performance is steady within ±3% of your overall average (${Math.round(overallAvg)}%).`,
    };
  }, [scoreTrends, performanceData]);

  // 2. Strongest & Needs Improvement Category Identifiers
  const { strongestCategory, needsImprovementCategory } = useMemo(() => {
    const categories = performanceData?.categoryPerformance || [];
    const qualified = categories.filter((c) => (c.assessmentsCompleted || 0) >= 2);
    if (qualified.length === 0) {
      return { strongestCategory: null, needsImprovementCategory: null };
    }

    let strongest = qualified[0];
    for (const c of qualified) {
      if (c.averageScore > strongest.averageScore) {
        strongest = c;
      }
    }

    const belowPassing = qualified.filter((c) => c.averageScore < 60);
    let needsImprovement = null;
    if (belowPassing.length > 0) {
      needsImprovement = belowPassing.reduce(
        (min, c) => (c.averageScore < min.averageScore ? c : min),
        belowPassing[0]
      );
    }

    return {
      strongestCategory: strongest ? strongest.category : null,
      needsImprovementCategory: needsImprovement ? needsImprovement.category : null,
    };
  }, [performanceData]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Spinner size="lg" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Loading your student workspace...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Unable to Load Dashboard"
        message={error}
        onRetry={loadData}
      />
    );
  }

  // Completed assessments (already submitted or evaluated)
  const completedAssessmentIds = new Set(
    submissions
      .filter((s) => s.status === 'submitted' || s.status === 'evaluated')
      .map((s) => {
        const id = s.assessment?._id || s.assessment?.id || s.assessmentId?._id || s.assessmentId;
        return id ? id.toString() : null;
      })
      .filter(Boolean)
  );

  // Active in-progress submissions map keyed by assessment ID
  const inProgressSubmissionsMap = new Map();
  submissions.forEach((s) => {
    if (s.status === 'in_progress') {
      const id = s.assessment?._id || s.assessment?.id || s.assessmentId?._id || s.assessmentId;
      if (id) {
        inProgressSubmissionsMap.set(id.toString(), s);
      }
    }
  });

  // Available assessments for attempt (either not started or in-progress)
  const availableAssessments = assessments.filter(
    (a) => !completedAssessmentIds.has((a._id || a.id)?.toString())
  );

  const evaluatedSubmissions = submissions.filter((s) => s.status === 'evaluated');
  const avgScore =
    evaluatedSubmissions.length > 0
      ? Math.round(
          evaluatedSubmissions.reduce((acc, curr) => acc + (curr.percentage || 0), 0) /
            evaluatedSubmissions.length
        )
      : 0;

  // Filtered assessments for Catalog - includes all eligible published assessments
  const filteredCatalog = assessments.filter((a) => {
    const matchCat =
      selectedCategory === 'All' ||
      (a.category && a.category.trim().toLowerCase() === selectedCategory.trim().toLowerCase());
    const matchSearch =
      !catalogSearch.trim() ||
      a.title?.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      a.description?.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      a.category?.toLowerCase().includes(catalogSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  // 3. Masked Name Helper for Student Privacy
  const formatMaskedName = (name, isCurrentUser) => {
    if (isCurrentUser) return `${name || 'You'} (You)`;
    if (!name) return 'Student Candidate';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  };

  const streakMilestones = [
    { days: 3, label: '3-Day Streak', title: 'Consistent Scholar', icon: '🥉' },
    { days: 7, label: '7-Day Streak', title: 'Weekly Warrior', icon: '🥈' },
    { days: 14, label: '14-Day Streak', title: 'Academic Champion', icon: '🥇' },
    { days: 30, label: '30-Day Streak', title: 'Master of Mastery', icon: '💎' },
  ];

  return (
    <div className="space-y-4 sm:space-y-5 lg:space-y-6">
      {/* 1. Personalized Welcome / Hero Area */}
      <div className="rounded-3xl border border-surface-light-border dark:border-surface-dark-border bg-gradient-to-r from-[#FFF4EB] via-white to-[#EEF6F4] dark:from-[#241712] dark:via-surface-dark dark:to-[#132822] p-5 sm:p-6 lg:py-5 lg:px-7 shadow-warm-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 sm:gap-6 relative z-10">
          <div className="max-w-xl">
            <div className="flex items-center space-x-2 mb-1.5 sm:mb-2">
              <Badge variant="peach" size="sm" dot>Student Workspace</Badge>
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                · Academic Year {new Date().getFullYear()}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-display tracking-tight text-slate-900 dark:text-slate-100">
              {getTimeBasedGreeting(user?.name)}
            </h1>
            <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Welcome back, {user?.name || 'Student'}! Continue your assessments and track your progress.
            </p>

            <div className="mt-3.5 sm:mt-4 flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={RefreshCw}
                onClick={loadData}
              >
                Refresh Data
              </Button>
              {currentView !== 'catalog' && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={BookOpen}
                  onClick={() => navigate('/student/catalog')}
                >
                  Browse Catalog
                </Button>
              )}
            </div>
          </div>

          <div className="hidden sm:flex flex-shrink-0 items-center justify-center">
            <StudentHeroIllustration className="w-28 h-28 sm:w-32 sm:h-32 lg:w-36 lg:h-36 object-contain" />
          </div>
        </div>
      </div>

      {/* Date Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border shadow-warm-xs">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <Calendar className="w-4 h-4 text-brand-terracotta" />
          <span>Analytics Timeframe:</span>
        </div>
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All History' },
            { id: 'recent', label: 'Recent (48 hrs)' },
            { id: 'last_week', label: 'Last 7 Days' },
            { id: 'last_month', label: 'Last 30 Days' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setDateFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                dateFilter === f.id
                  ? 'bg-[#FDECE2] text-[#E05D38] dark:bg-[#341C16] dark:text-[#F4A261] shadow-warm-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-[#FFF4EB]/60 dark:hover:bg-slate-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Overview Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Average Score"
          value={
            performanceData?.overallAverageScore !== null && performanceData?.overallAverageScore !== undefined
              ? `${performanceData.overallAverageScore}%`
              : '—'
          }
          subtitle={
            performanceData?.hasData
              ? `Pass Rate: ${performanceData.passRate}%`
              : 'No completed exams'
          }
          icon={Award}
          color="terracotta"
        />
        <StatCard
          title="Assessments Completed"
          value={
            performanceData
              ? `${performanceData.assessmentsCompleted} / ${performanceData.assessmentsAttempted}`
              : `${submissions.length}`
          }
          subtitle={
            performanceData?.hasData
              ? `${performanceData.passedAssessments} Passed · ${performanceData.failedAssessments} Failed`
              : 'Started vs submitted'
          }
          icon={CheckCircle2}
          color="sage"
        />
        <StatCard
          title="Academic Streak"
          value={`${performanceData?.currentStreak || 0} Days 🔥`}
          subtitle={
            performanceData?.bestStreak
              ? `Best: ${performanceData.bestStreak} Days · ${performanceData.streakActiveToday ? 'Active today' : 'Submit today!'}`
              : 'Complete tests to build streak'
          }
          icon={Flame}
          color="peach"
        />
        <StatCard
          title="Leaderboard Position"
          value={
            performanceData?.leaderboardPosition
              ? `#${performanceData.leaderboardPosition.rank}`
              : '—'
          }
          subtitle={
            performanceData?.leaderboardPosition
              ? `of ${performanceData.leaderboardPosition.totalStudents} ranked students`
              : 'Complete exams to rank'
          }
          icon={Trophy}
          color="secondary"
        />
      </div>

      {/* 3. Sub-View: CATALOG ONLY */}
      {currentView === 'catalog' && (
        <Card
          title="Assessment Catalog"
          subtitle="Browse all course examinations and quizzes available to your account"
        >
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-[#FDECE2] text-[#E05D38] dark:bg-[#341C16] dark:text-[#F4A261] shadow-warm-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-[#FFF4EB]/60 dark:hover:bg-slate-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Search catalog..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>
          </div>

          {filteredCatalog.length === 0 ? (
            <EmptyState
              title="No matching assessments"
              description="No open assessments match your current search or category filter."
              actionLabel="Reset Filters"
              onAction={() => {
                setSelectedCategory('All');
                setCatalogSearch('');
              }}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCatalog.map((asmt) => (
                <div
                  key={asmt._id || asmt.id}
                  className="p-5 rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark shadow-warm-xs hover:shadow-warm-sm hover:border-brand-peach/40 transition-all flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Badge variant={asmt.accessType === 'restricted' ? 'peach' : 'secondary'} size="sm">
                        {asmt.category || 'General'}
                      </Badge>
                      {completedAssessmentIds.has((asmt._id || asmt.id).toString()) ? (
                        <Badge variant="success" size="sm" dot>
                          Completed
                        </Badge>
                      ) : inProgressSubmissionsMap.has((asmt._id || asmt.id).toString()) ? (
                        <Badge variant="warning" size="sm" dot>
                          In Progress
                        </Badge>
                      ) : (
                        <Badge variant="sage" size="sm" dot>
                          Available
                        </Badge>
                      )}
                      {asmt.accessType === 'restricted' && (
                        <Badge variant="neutral" size="sm">
                          <Lock className="w-2.5 h-2.5 mr-1 inline" />
                          Cohort Assigned
                        </Badge>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {asmt.title}
                    </h3>
                    {asmt.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {asmt.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-surface-light-border dark:border-surface-dark-border flex items-center justify-between">
                    <div className="flex items-center space-x-3 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center">
                        <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        {asmt.durationMinutes}m
                      </span>
                      <span>{asmt.totalPoints || 100} pts</span>
                      <span className="text-brand-terracotta font-semibold">
                        Pass: {asmt.passingScore || 60}%
                      </span>
                    </div>

                    {completedAssessmentIds.has((asmt._id || asmt.id).toString()) ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/student/submissions')}
                      >
                        View Submission
                      </Button>
                    ) : (
                      <Button
                        variant={inProgressSubmissionsMap.has((asmt._id || asmt.id).toString()) ? 'secondary' : 'primary'}
                        size="sm"
                        icon={ArrowRight}
                        iconPosition="right"
                        onClick={() => setSelectedAssessmentForModal(asmt)}
                      >
                        {inProgressSubmissionsMap.has((asmt._id || asmt.id).toString()) ? 'Resume Attempt' : 'Start Exam'}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* 4. Sub-View: PROFILE ONLY */}
      {currentView === 'profile' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <Card title="Student Profile & Academic Record" subtitle="Personal details and enrolled status">
            <div className="flex items-center space-x-4 pb-6 border-b border-surface-light-border dark:border-surface-dark-border">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-brand-terracotta to-brand-peach text-white font-bold text-2xl flex items-center justify-center shadow-warm-xs">
                {user?.name?.[0]?.toUpperCase() || 'S'}
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{user?.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
                <div className="mt-2 flex items-center space-x-2">
                  <Badge variant="secondary" size="sm">Student Candidate</Badge>
                  <Badge variant="sage" size="sm" dot>Active Enrollment</Badge>
                </div>
              </div>
            </div>

            <div className="pt-5 space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-surface-light-border dark:border-surface-dark-border">
                <span className="text-slate-500">Institution:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">Unified Assessment Academic Portal</span>
              </div>
              <div className="flex justify-between py-2 border-b border-surface-light-border dark:border-surface-dark-border">
                <span className="text-slate-500">Completed Assessments:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{submissions.length}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Academic Standing:</span>
                <Badge variant={avgScore >= 70 ? 'success' : 'warning'}>
                  {avgScore >= 85 ? 'High Distinction' : avgScore >= 70 ? 'Good Standing' : 'Needs Review'}
                </Badge>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* 5. Sub-View: DASHBOARD & SUBMISSIONS (Default or Submissions) */}
      {(currentView === 'dashboard' || currentView === 'submissions') && (
        <>
          {/* Main Grid: Learning Cards & Academic Progress (Only in dashboard view) */}
          {currentView === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 8 Cols: Available Assessments Learning Cards */}
              <div className="lg:col-span-8 space-y-4">
                <Card
                  title="Assigned & Open Assessments"
                  subtitle="Authoritative timed examinations ready for attempt"
                  action={
                    <button
                      onClick={() => navigate('/student/catalog')}
                      className="text-xs font-semibold text-brand-primary hover:underline cursor-pointer"
                    >
                      View Catalog →
                    </button>
                  }
                >
                  {availableAssessments.length === 0 ? (
                    <EmptyState
                      title="All Caught Up!"
                      description="You have completed all available examinations."
                    />
                  ) : (
                    <div className="space-y-3.5">
                      {availableAssessments.slice(0, 4).map((asmt) => (
                        <div
                          key={asmt._id || asmt.id}
                          className="p-4 sm:p-5 rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark hover:border-brand-peach/50 shadow-warm-xs hover:shadow-warm-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex items-center space-x-2">
                              <Badge variant={asmt.accessType === 'restricted' ? 'peach' : 'secondary'} size="sm">
                                {asmt.category || 'General'}
                              </Badge>
                              {inProgressSubmissionsMap.has((asmt._id || asmt.id).toString()) ? (
                                <Badge variant="warning" size="sm" dot>
                                  In Progress
                                </Badge>
                              ) : (
                                <Badge variant="sage" size="sm" dot>
                                  Available
                                </Badge>
                              )}
                              {asmt.accessType === 'restricted' && (
                                <Badge variant="neutral" size="sm">
                                  Cohort
                                </Badge>
                              )}
                            </div>

                            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                              {asmt.title}
                            </h3>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                              <span className="flex items-center">
                                <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                                {asmt.durationMinutes} Mins
                              </span>
                              <span>{asmt.totalPoints || 100} Points</span>
                              <span className="text-brand-terracotta font-semibold">
                                Passing: {asmt.passingScore || 60}%
                              </span>
                            </div>
                          </div>

                          <div className="flex-shrink-0">
                            <Button
                              variant={inProgressSubmissionsMap.has((asmt._id || asmt.id).toString()) ? 'secondary' : 'primary'}
                              size="sm"
                              icon={ArrowRight}
                              iconPosition="right"
                              onClick={() => setSelectedAssessmentForModal(asmt)}
                            >
                              {inProgressSubmissionsMap.has((asmt._id || asmt.id).toString()) ? 'Resume Attempt' : 'Start Attempt'}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              {/* Right 4 Cols: Performance Summary */}
              <div className="lg:col-span-4 space-y-4">
                <Card
                  title="Academic Performance"
                  subtitle="Evaluated score average"
                >
                  <PerformanceDonutChart
                    centerMetric={evaluatedSubmissions.length > 0 ? `${avgScore}%` : '—'}
                    centerLabel="Avg Score"
                    height={220}
                  />
                  <div className="mt-4 pt-3 border-t border-surface-light-border dark:border-surface-dark-border text-xs text-slate-500 dark:text-slate-400 flex justify-between">
                    <span>Attempts Recorded:</span>
                    <strong className="text-slate-800 dark:text-slate-200">{submissions.length}</strong>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* Performance Trendline & Consistency / Streaks Section (Dashboard view only) */}
          {currentView === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Score Progression Trendline (8 cols) */}
              <div className="lg:col-span-8 space-y-4">
                <Card
                  title="Score Progression Trendline"
                  subtitle="Chronological score percentage across completed assessments"
                  action={
                    trendDirection && (
                      <div
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${trendDirection.bg}`}
                      >
                        <trendDirection.Icon className="w-3.5 h-3.5 mr-1" />
                        <span>Trend: {trendDirection.label}</span>
                      </div>
                    )
                  }
                >
                  <ScoreTrendChart data={scoreTrends} height={260} />
                  {trendDirection && (
                    <div className="mt-3 pt-3 border-t border-surface-light-border dark:border-surface-dark-border flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>{trendDirection.description}</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Total Recorded: {scoreTrends.length} attempt{scoreTrends.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </Card>
              </div>

              {/* Academic Streaks & Consistency (4 cols) */}
              <div className="lg:col-span-4 space-y-4">
                <Card
                  title="Academic Streaks"
                  subtitle="Daily learning consistency & milestones"
                >
                  <div className="space-y-4">
                    {/* Flame counter card */}
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-[#FFF4EB] via-[#FFF8F3] to-white dark:from-[#341C16] dark:via-surface-dark dark:to-surface-dark border border-[#FAD7C3] dark:border-amber-900/40 text-center relative overflow-hidden">
                      <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 text-amber-500 mb-2">
                        <Flame className="w-8 h-8" />
                      </div>
                      <div className="text-3xl font-black font-display tracking-tight text-slate-900 dark:text-slate-100">
                        {performanceData?.currentStreak || 0}{' '}
                        <span className="text-sm font-semibold text-slate-500">Days</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Current Streak · Best: <strong>{performanceData?.bestStreak || 0} Days</strong>
                      </p>
                    </div>

                    {/* Streak Status Notice */}
                    {performanceData?.streakActiveToday ? (
                      <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                        <span className="font-medium">Streak active today! Great momentum.</span>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                        <span className="font-medium">Complete an assessment today to keep your streak alive!</span>
                      </div>
                    )}

                    {/* Streak Milestones Badges */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                        Milestone Badges
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {streakMilestones.map((m) => {
                          const isUnlocked = (performanceData?.bestStreak || 0) >= m.days;
                          return (
                            <div
                              key={m.days}
                              className={`p-2.5 rounded-xl border text-xs flex items-center space-x-2 transition-all ${
                                isUnlocked
                                  ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60 text-slate-800 dark:text-slate-200 shadow-xs'
                                  : 'bg-slate-50/50 dark:bg-surface-dark-muted/40 border-surface-light-border dark:border-surface-dark-border text-slate-400 opacity-60'
                              }`}
                            >
                              <span className="text-base">{m.icon}</span>
                              <div className="min-w-0">
                                <span className="font-bold block truncate text-[11px]">{m.label}</span>
                                <span className="text-[10px] text-slate-500 truncate block">
                                  {isUnlocked ? 'Unlocked' : `${m.days} days req.`}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* Subject & Category Performance Breakdown (Dashboard view only) */}
          {currentView === 'dashboard' && (
            <Card
              title="Subject & Category Performance"
              subtitle="Evaluated results and passing rates segmented across academic curriculum areas"
            >
              {!performanceData?.categoryPerformance ||
              performanceData.categoryPerformance.filter(
                (c) => c.assessmentsCompleted > 0 || c.assessmentsAttempted > 0
              ).length === 0 ? (
                <EmptyState
                  title="No Category Breakdown Available"
                  description="Complete course examinations across topics to view subject-specific performance analytics."
                />
              ) : (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeader>Subject / Category</TableHeader>
                      <TableHeader>Attempted</TableHeader>
                      <TableHeader>Completed</TableHeader>
                      <TableHeader>Passing Rate</TableHeader>
                      <TableHeader>Average Score</TableHeader>
                      <TableHeader className="text-right">Academic Distinction</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {performanceData.categoryPerformance
                      .filter((c) => c.assessmentsCompleted > 0 || c.assessmentsAttempted > 0)
                      .map((cat) => {
                        const isStrongest = cat.category === strongestCategory;
                        const isNeedsImprovement = cat.category === needsImprovementCategory;
                        return (
                          <TableRow key={cat.category}>
                            <TableCell>
                              <span className="font-bold text-slate-900 dark:text-slate-100 block">
                                {cat.category}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                              {cat.assessmentsAttempted}
                            </TableCell>
                            <TableCell className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                              {cat.assessmentsCompleted}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <div className="w-16 h-2 rounded-full bg-slate-100 dark:bg-surface-dark-muted overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      cat.passRate >= 75
                                        ? 'bg-emerald-500'
                                        : cat.passRate >= 50
                                        ? 'bg-amber-500'
                                        : 'bg-rose-500'
                                    }`}
                                    style={{ width: `${Math.min(100, cat.passRate)}%` }}
                                  />
                                </div>
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                  {cat.passRate}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {cat.averageScore}%
                            </TableCell>
                            <TableCell className="text-right">
                              {isStrongest && (
                                <Badge variant="success" size="sm">
                                  <Star className="w-3 h-3 mr-1 inline" />
                                  Strongest Subject
                                </Badge>
                              )}
                              {isNeedsImprovement && (
                                <Badge variant="danger" size="sm">
                                  <AlertTriangle className="w-3 h-3 mr-1 inline" />
                                  Needs Improvement
                                </Badge>
                              )}
                              {!isStrongest && !isNeedsImprovement && (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              )}
            </Card>
          )}

          {/* Academic Leaderboard Section (Dashboard view only) */}
          {currentView === 'dashboard' && (
            <Card
              title="Academic Leaderboard"
              subtitle="Anonymous cohort standings ranked by evaluated performance"
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-xl bg-slate-100 dark:bg-surface-dark-muted p-1">
                    <button
                      type="button"
                      onClick={() => setLeaderboardScope('overall')}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        leaderboardScope === 'overall'
                          ? 'bg-white dark:bg-surface-dark text-slate-900 dark:text-slate-100 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      Overall Standings
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeaderboardScope('assessment')}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        leaderboardScope === 'assessment'
                          ? 'bg-white dark:bg-surface-dark text-slate-900 dark:text-slate-100 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      By Assessment
                    </button>
                  </div>

                  {leaderboardScope === 'assessment' && assessments.length > 0 && (
                    <select
                      value={selectedLeaderboardAssessment}
                      onChange={(e) => setSelectedLeaderboardAssessment(e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    >
                      {assessments.map((a) => (
                        <option key={a._id || a.id} value={a._id || a.id}>
                          {a.title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              }
            >
              {isLoadingLeaderboard ? (
                <div className="flex justify-center py-8">
                  <Spinner size="md" />
                </div>
              ) : !leaderboardData?.rankings || leaderboardData.rankings.length === 0 ? (
                <EmptyState
                  title="No Leaderboard Data"
                  description={
                    leaderboardScope === 'assessment'
                      ? 'No completed submissions recorded yet for this assessment.'
                      : 'Complete course assessments to appear on the overall leaderboard.'
                  }
                />
              ) : (
                <>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeader>Rank</TableHeader>
                        <TableHeader>Student</TableHeader>
                        <TableHeader>Score</TableHeader>
                        <TableHeader>
                          {leaderboardScope === 'assessment' ? 'Completion Time' : 'Completed Exams'}
                        </TableHeader>
                        <TableHeader className="text-right">Standing</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {leaderboardData.rankings.map((item) => {
                        const isGold = item.rank === 1;
                        const isSilver = item.rank === 2;
                        const isBronze = item.rank === 3;
                        return (
                          <TableRow
                            key={item.id || item.studentId}
                            className={
                              item.isCurrentUser
                                ? 'bg-[#FDECE2]/40 dark:bg-[#341C16]/40 border-l-4 border-[#E05D38]'
                                : ''
                            }
                          >
                            <TableCell>
                              <div className="flex items-center space-x-1.5">
                                {isGold && <span className="text-base" title="1st Place">🥇</span>}
                                {isSilver && <span className="text-base" title="2nd Place">🥈</span>}
                                {isBronze && <span className="text-base" title="3rd Place">🥉</span>}
                                <span
                                  className={`text-xs font-bold ${
                                    isGold
                                      ? 'text-amber-600 dark:text-amber-400'
                                      : isSilver
                                      ? 'text-slate-600 dark:text-slate-300'
                                      : isBronze
                                      ? 'text-amber-700 dark:text-amber-600'
                                      : 'text-slate-500'
                                  }`}
                                >
                                  #{item.rank}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-surface-dark-muted text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center justify-center flex-shrink-0">
                                  {item.studentDisplayName?.[0]?.toUpperCase() || 'S'}
                                </div>
                                <div>
                                  <span className="font-semibold text-slate-900 dark:text-slate-100 block text-xs">
                                    {formatMaskedName(item.studentDisplayName, item.isCurrentUser)}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    ID: {item.studentCode || 'STU-***'}
                                  </span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs font-bold text-brand-terracotta">
                                {item.percentage !== undefined
                                  ? `${item.percentage}%`
                                  : `${item.averagePercentage}%`}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                              {leaderboardScope === 'assessment' ? (
                                <span>
                                  {Math.floor((item.timeSpentSeconds || 0) / 60)}m{' '}
                                  {(item.timeSpentSeconds || 0) % 60}s
                                </span>
                              ) : (
                                <span>
                                  {item.totalCompleted} Completed ({item.totalPassed} Passed)
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.isCurrentUser ? (
                                <Badge variant="terracotta" size="sm">
                                  You
                                </Badge>
                              ) : isGold ? (
                                <Badge variant="success" size="sm">
                                  Top Performer
                                </Badge>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  {/* Pinned Your Standing if current user has data but is outside visible page */}
                  {performanceData?.leaderboardPosition &&
                    !leaderboardData.rankings.some((r) => r.isCurrentUser) && (
                      <div className="mt-3 p-3 rounded-xl bg-[#FDECE2]/50 dark:bg-[#341C16]/50 border border-brand-peach/40 flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2">
                          <Trophy className="w-4 h-4 text-brand-terracotta" />
                          <span className="text-slate-700 dark:text-slate-300">
                            Your Platform Standing: <strong>Rank #{performanceData.leaderboardPosition.rank}</strong> of{' '}
                            {performanceData.leaderboardPosition.totalStudents} ranked students
                          </span>
                        </div>
                        <span className="font-bold text-brand-terracotta">
                          Avg: {performanceData.overallAverageScore}%
                        </span>
                      </div>
                    )}
                </>
              )}
            </Card>
          )}

          {/* Submissions History Feed */}
          <Card
            title={currentView === 'submissions' ? 'Your Assessment Submissions & Results' : 'Recent Submissions'}
            subtitle="Chronological record of exam attempts, scores, and evaluation feedback"
          >
            {submissions.length === 0 ? (
              <EmptyState
                title="No Submissions Yet"
                description="When you complete an assessment, your submission score and evaluation will appear here."
              />
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>Assessment Title</TableHeader>
                    <TableHeader>Submitted Date</TableHeader>
                    <TableHeader>Score</TableHeader>
                    <TableHeader>Result</TableHeader>
                    <TableHeader>Status</TableHeader>
                    <TableHeader className="text-right">Action</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {submissions.map((sub) => (
                    <TableRow key={sub._id || sub.id}>
                      <TableCell>
                        <span className="font-bold text-slate-900 dark:text-slate-100 block">
                          {sub.assessment?.title || 'Assessment'}
                        </span>
                        <span className="text-xs text-slate-400">{sub.assessment?.category || 'General'}</span>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                        {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {sub.status === 'evaluated'
                          ? `${sub.score} / ${sub.totalPoints} (${sub.percentage}%)`
                          : sub.status === 'submitted'
                          ? 'Grading in progress'
                          : 'In Progress'}
                      </TableCell>
                      <TableCell>
                        {sub.status === 'evaluated' ? (
                          <Badge variant={sub.passed ? 'success' : 'danger'} size="sm">
                            {sub.passed ? 'Passed' : 'Needs Review'}
                          </Badge>
                        ) : sub.status === 'submitted' ? (
                          <Badge variant="warning" size="sm">
                            Pending Evaluation
                          </Badge>
                        ) : (
                          <Badge variant="neutral" size="sm">
                            In Progress
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            sub.status === 'evaluated'
                              ? 'success'
                              : sub.status === 'submitted'
                              ? 'primary'
                              : 'neutral'
                          }
                          size="sm"
                          dot
                        >
                          {sub.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {sub.status === 'evaluated' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openFeedbackModal(sub._id || sub.id)}
                          >
                            View Feedback
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </>
      )}

      {/* Assessment Details & Instructions Modal */}
      {selectedAssessmentForModal && (
        <Modal
          isOpen={Boolean(selectedAssessmentForModal)}
          onClose={() => setSelectedAssessmentForModal(null)}
          title="Assessment Details & Instructions"
          maxWidth="max-w-lg"
          footer={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedAssessmentForModal(null)}
              >
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={ArrowRight}
                iconPosition="right"
                onClick={() => {
                  const targetId = selectedAssessmentForModal._id || selectedAssessmentForModal.id;
                  setSelectedAssessmentForModal(null);
                  navigate(`/student/attempt/${targetId}`);
                }}
              >
                {inProgressSubmissionsMap.has((selectedAssessmentForModal._id || selectedAssessmentForModal.id).toString())
                  ? 'Resume Assessment'
                  : 'Start Assessment'}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <Badge variant={selectedAssessmentForModal.accessType === 'restricted' ? 'peach' : 'secondary'} size="sm">
                  {selectedAssessmentForModal.category || 'General'}
                </Badge>
                {selectedAssessmentForModal.proctoringEnabled && (
                  <Badge variant="terracotta" size="sm">
                    <Shield className="w-3 h-3 mr-1 inline" />
                    Proctored
                  </Badge>
                )}
                {inProgressSubmissionsMap.has((selectedAssessmentForModal._id || selectedAssessmentForModal.id).toString()) && (
                  <Badge variant="warning" size="sm" dot>
                    In Progress
                  </Badge>
                )}
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {selectedAssessmentForModal.title}
              </h2>
              {selectedAssessmentForModal.description ? (
                <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {selectedAssessmentForModal.description}
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-slate-400 italic">
                  No additional description provided for this assessment.
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border text-center text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Duration</span>
                <strong className="text-slate-800 dark:text-slate-200 font-bold">
                  {selectedAssessmentForModal.durationMinutes || 60} mins
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Total Points</span>
                <strong className="text-slate-800 dark:text-slate-200 font-bold">
                  {selectedAssessmentForModal.totalPoints || 100} pts
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Passing Score</span>
                <strong className="text-brand-terracotta font-bold">
                  {selectedAssessmentForModal.passingScore || 60}%
                </strong>
              </div>
            </div>

            {selectedAssessmentForModal.proctoringEnabled && (
              <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200 space-y-1">
                <div className="flex items-center space-x-1.5 font-bold">
                  <Shield className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Proctoring Security Requirements</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-indigo-800/90 dark:text-indigo-300">
                  {selectedAssessmentForModal.cameraRequired ? (
                    <li>Webcam verification is required throughout the examination.</li>
                  ) : (
                    <li>Automated exam activity monitoring is enabled.</li>
                  )}
                  <li>Copy and paste operations are blocked for written responses.</li>
                  <li>Suspicious navigation and session events will be recorded for instructor review.</li>
                </ul>
              </div>
            )}

            <div className="p-3 rounded-xl bg-[#FFF9F2] dark:bg-[#1A202C] border border-[#EBE3D8] dark:border-[#2D3748] text-xs text-slate-700 dark:text-slate-300 space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-slate-900 dark:text-slate-100">
                <Clock className="w-3.5 h-3.5 text-brand-terracotta" />
                <span>Assessment Instructions</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                <li>The server timer starts immediately upon clicking Start Assessment.</li>
                <li>Your responses are automatically saved in the background as you type.</li>
                <li>When the timer expires, all saved answers will be automatically submitted.</li>
                <li>You cannot restart the examination once finalized or expired.</li>
              </ul>
            </div>
          </div>
        </Modal>
      )}

      {/* Student Evaluation Feedback Modal */}
      {selectedFeedbackSubmission && (
        <Modal
          isOpen={Boolean(selectedFeedbackSubmission)}
          onClose={() => setSelectedFeedbackSubmission(null)}
          title="Assessment Evaluation Feedback"
          maxWidth="max-w-2xl"
          footer={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedFeedbackSubmission(null)}
            >
              Close
            </Button>
          }
        >
          <div className="space-y-5">
            {/* Header info */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {selectedFeedbackSubmission.assessment?.title || 'Assessment'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Faculty Evaluator: <strong>{selectedFeedbackSubmission.evaluation?.evaluatorId?.name || 'Academic Faculty'}</strong>
                  </p>
                </div>
                <Badge variant={selectedFeedbackSubmission.passed ? 'success' : 'danger'} size="sm">
                  {selectedFeedbackSubmission.passed ? 'Passed' : 'Needs Review'}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-surface-light-border dark:border-surface-dark-border text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Final Score</span>
                  <span className="font-bold text-brand-terracotta text-sm">
                    {selectedFeedbackSubmission.score} / {selectedFeedbackSubmission.totalPoints}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Percentage</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {selectedFeedbackSubmission.percentage}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Status</span>
                  <span className="font-bold text-emerald-600 text-sm">
                    {selectedFeedbackSubmission.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Overall Faculty Feedback */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                Faculty Feedback
              </h4>
              <div className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                {selectedFeedbackSubmission.feedback ||
                  selectedFeedbackSubmission.evaluation?.generalFeedback ||
                  'No general comments provided.'}
              </div>
            </div>

            {/* Question-level comments breakdown */}
            {selectedFeedbackSubmission.assessment?.questions &&
              selectedFeedbackSubmission.assessment.questions.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Question Feedback Breakdown
                  </h4>
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {selectedFeedbackSubmission.assessment.questions.map((q, idx) => {
                      const qId = (q._id || q.id).toString();
                      const fb =
                        selectedFeedbackSubmission.evaluation?.questionFeedback?.[qId] ||
                        (selectedFeedbackSubmission.evaluation?.questionFeedback instanceof Map &&
                          selectedFeedbackSubmission.evaluation.questionFeedback.get(qId));

                      const studentAnswers = selectedFeedbackSubmission.answers
                        ? (selectedFeedbackSubmission.answers instanceof Map
                            ? Object.fromEntries(selectedFeedbackSubmission.answers)
                            : selectedFeedbackSubmission.answers)
                        : {};
                      const studentAns = studentAnswers[qId];

                      return (
                        <div
                          key={qId}
                          className="p-3.5 rounded-xl bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border text-xs space-y-2"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              Question {idx + 1} ({q.type})
                            </span>
                            <span className="font-semibold text-brand-terracotta">
                              {fb?.pointsAwarded !== undefined ? `${fb.pointsAwarded} / ` : ''}{q.points} pts
                            </span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-400">{q.questionText}</p>

                          {/* Student Document / Answer Presentation */}
                          {studentAns && (
                            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border text-xs">
                              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                                Your Submission
                              </span>
                              {typeof studentAns === 'object' && studentAns.type === 'file' ? (
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center space-x-2 truncate">
                                    <FileText className="w-4 h-4 text-[#E05D38] flex-shrink-0" />
                                    <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                                      📄 {studentAns.originalFilename || 'document.pdf'}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-1.5 flex-shrink-0">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      icon={ExternalLink}
                                      onClick={() =>
                                        handleDownloadStudentFile(
                                          selectedFeedbackSubmission._id,
                                          qId,
                                          false,
                                          studentAns.originalFilename
                                        )
                                      }
                                    >
                                      View
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      icon={Download}
                                      onClick={() =>
                                        handleDownloadStudentFile(
                                          selectedFeedbackSubmission._id,
                                          qId,
                                          true,
                                          studentAns.originalFilename
                                        )
                                      }
                                    >
                                      Download
                                    </Button>
                                  </div>
                                </div>
                              ) : typeof studentAns === 'object' && studentAns.type === 'google_docs' ? (
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[#E05D38] truncate text-xs">
                                    {studentAns.googleDocsUrl}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    icon={ExternalLink}
                                    onClick={() => window.open(studentAns.googleDocsUrl, '_blank', 'noopener,noreferrer')}
                                  >
                                    Open
                                  </Button>
                                </div>
                              ) : (
                                <p className="text-slate-700 dark:text-slate-300">
                                  {String(studentAns)}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Faculty Comment */}
                          {fb?.comment && (
                            <div className="p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
                              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase block">
                                Faculty Comment
                              </span>
                              <p className="text-slate-800 dark:text-slate-200 mt-0.5">{fb.comment}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default StudentDashboard;
