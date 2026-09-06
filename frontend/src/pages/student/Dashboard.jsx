import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import assessmentService from '../../services/assessment.service';
import submissionService from '../../services/submission.service';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import StatCard from '../../components/common/StatCard';
import PerformanceDonutChart from '../../components/charts/PerformanceDonutChart';
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
} from 'lucide-react';

const StudentDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [assessments, setAssessments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Determine sub-view based on current route
  const currentView = useMemo(() => {
    if (location.pathname.includes('/student/catalog')) return 'catalog';
    if (location.pathname.includes('/student/submissions')) return 'submissions';
    if (location.pathname.includes('/student/profile')) return 'profile';
    return 'dashboard';
  }, [location.pathname]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [asmtRes, subRes] = await Promise.all([
        assessmentService.getAssessments(),
        submissionService.getStudentSubmissions(),
      ]);

      const loadedAssessments = asmtRes.data || asmtRes.assessments || [];
      const loadedSubmissions = subRes || [];

      setAssessments(loadedAssessments);
      setSubmissions(loadedSubmissions);
    } catch (err) {
      setError(err.message || 'Failed to retrieve assessment data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  // Calculate student metrics
  const submittedAssessmentIds = new Set(
    submissions
      .map((s) => {
        const id = s.assessment?._id || s.assessment?.id || s.assessmentId?._id || s.assessmentId;
        return id ? id.toString() : null;
      })
      .filter(Boolean)
  );

  const availableAssessments = assessments.filter(
    (a) => !submittedAssessmentIds.has((a._id || a.id).toString())
  );

  const evaluatedSubmissions = submissions.filter((s) => s.status === 'evaluated');
  const avgScore =
    evaluatedSubmissions.length > 0
      ? Math.round(
          evaluatedSubmissions.reduce((acc, curr) => acc + (curr.percentage || 0), 0) /
            evaluatedSubmissions.length
        )
      : 0;

  // Filtered assessments for Catalog
  const categories = ['All', ...new Set(assessments.map((a) => a.category).filter(Boolean))];
  const filteredCatalog = availableAssessments.filter((a) => {
    const matchCat = selectedCategory === 'All' || a.category === selectedCategory;
    const matchSearch =
      !catalogSearch.trim() ||
      a.title?.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      a.description?.toLowerCase().includes(catalogSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* 1. Personalized Welcome / Hero Area */}
      <div className="rounded-3xl border border-surface-light-border dark:border-surface-dark-border bg-gradient-to-r from-[#FFF4EB] via-white to-[#EEF6F4] dark:from-[#241712] dark:via-surface-dark dark:to-[#132822] p-6 sm:p-8 shadow-warm-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
          <div className="max-w-xl">
            <div className="flex items-center space-x-2 mb-2">
              <Badge variant="peach" size="sm" dot>Student Workspace</Badge>
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                · Academic Year {new Date().getFullYear()}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-display tracking-tight text-slate-900 dark:text-slate-100">
              Welcome back, {user?.name || 'Student'}! 👋
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              You have <strong className="text-brand-terracotta">{availableAssessments.length} assessment{availableAssessments.length !== 1 ? 's' : ''}</strong> available for your enrolled coursework. Pick an examination below to begin your timed attempt.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
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
            <StudentHeroIllustration className="w-32 h-32 sm:w-40 sm:h-40" />
          </div>
        </div>
      </div>

      {/* 2. Overview Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Available Exams"
          value={availableAssessments.length}
          subtitle="Open for attempt"
          icon={BookOpen}
          color="peach"
        />
        <StatCard
          title="Submissions"
          value={submissions.length}
          subtitle="Total attempts recorded"
          icon={FileCheck2}
          color="secondary"
        />
        <StatCard
          title="Evaluated"
          value={evaluatedSubmissions.length}
          subtitle="Grading completed"
          icon={CheckCircle2}
          color="sage"
        />
        <StatCard
          title="Average Score"
          value={evaluatedSubmissions.length > 0 ? `${avgScore}%` : '—'}
          subtitle="Overall academic mark"
          icon={Award}
          color="terracotta"
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
                      <Badge variant="sage" size="sm" dot>
                        Available
                      </Badge>
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

                    <Button
                      variant="primary"
                      size="sm"
                      icon={ArrowRight}
                      iconPosition="right"
                      onClick={() => navigate(`/student/attempt/${asmt._id || asmt.id}`)}
                    >
                      Start Exam
                    </Button>
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
                              <Badge variant="sage" size="sm" dot>
                                Available
                              </Badge>
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
                              variant="primary"
                              size="sm"
                              icon={ArrowRight}
                              iconPosition="right"
                              onClick={() => navigate(`/student/attempt/${asmt._id || asmt.id}`)}
                            >
                              Start Attempt
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
                    <TableHeader className="text-right">Status</TableHeader>
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
                        ) : (
                          <Badge variant="warning" size="sm">
                            Pending Evaluation
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default StudentDashboard;
