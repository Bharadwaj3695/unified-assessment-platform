import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getTimeBasedGreeting } from '../../utils/greeting';
import assessmentService from '../../services/assessment.service';
import instructorService from '../../services/instructor.service';
import InstructorSearchBar from '../../components/instructor/InstructorSearchBar';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import StatCard from '../../components/common/StatCard';
import ActivityBarChart from '../../components/charts/ActivityBarChart';
import Spinner from '../../components/ui/Spinner';
import { InstructorHeroIllustration } from '../../components/illustrations';
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
  PlusCircle,
  Clock,
  CheckCircle2,
  FileText,
  Users,
  AlertCircle,
  FileCheck2,
  ArrowRight,
  TrendingUp,
  Edit,
  Globe,
  Lock,
  BarChart2,
} from 'lucide-react';

const InstructorDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [assessments, setAssessments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [stats, setStats] = useState({
    totalAssessments: 0,
    publishedCount: 0,
    draftCount: 0,
    pendingEvaluations: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [asmtRes, subRes] = await Promise.allSettled([
        assessmentService.getAssessments({ limit: 50 }),
        instructorService.getInstructorSubmissions({ limit: 20 }),
      ]);

      const loadedAssessments =
        asmtRes.status === 'fulfilled'
          ? asmtRes.value.data || asmtRes.value.assessments || []
          : [];

      const loadedSubmissions =
        subRes.status === 'fulfilled'
          ? subRes.value.data || subRes.value.submissions || []
          : [];

      setAssessments(loadedAssessments);
      setSubmissions(loadedSubmissions);

      const published = loadedAssessments.filter((a) => a.status === 'published').length;
      const draft = loadedAssessments.filter((a) => a.status === 'draft').length;
      const pendingGrading = loadedSubmissions.filter(
        (s) => s.status === 'submitted' || s.evaluationStatus === 'pending'
      ).length;

      setStats({
        totalAssessments: loadedAssessments.length,
        publishedCount: published,
        draftCount: draft,
        pendingEvaluations: pendingGrading,
      });
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  return (
    <div className="space-y-4 sm:space-y-5 lg:space-y-6">
      {/* Prominent Workspace Search Bar */}
      <div className="rounded-2xl border border-[#EBE3D8] dark:border-[#2D3748] bg-white dark:bg-[#1A202C] p-3.5 sm:p-4 shadow-warm-xs">
        <InstructorSearchBar
          placeholder="Search course assessments, students, or submissions..."
          onSelectAssessment={(asmt) => navigate(`/instructor/edit/${asmt._id || asmt.id}`)}
        />
      </div>

      {/* Personalized Welcome Header with Instructor Illustration */}
      <div className="rounded-2xl border border-[#EBE3D8] dark:border-[#2D3748] bg-gradient-to-r from-[#EAF4F1] via-[#FFFDFB] to-[#FDECE2] dark:from-[#132A24] dark:via-[#1A202C] dark:to-[#341C16] p-5 sm:p-6 lg:py-5 lg:px-7 shadow-warm-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 sm:gap-6 relative z-10">
          <div className="max-w-xl">
            <div className="flex items-center space-x-2 mb-1.5 sm:mb-2">
              <Badge variant="sage" size="sm" dot>Instructor Studio</Badge>
              <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">· Department of Computer Science</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-[#1F2937] dark:text-[#F9FAFB]">
              {getTimeBasedGreeting(user?.name)}
            </h1>
            <p className="mt-1.5 sm:mt-2 text-sm text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
              Welcome back. Manage your assessments and monitor student performance.
            </p>
            <div className="mt-3.5 sm:mt-4 flex items-center space-x-3">
              <Link to="/instructor/create">
                <Button variant="primary" size="md" icon={PlusCircle}>
                  Create Assessment
                </Button>
              </Link>
              <Link to="/instructor/submissions">
                <Button variant="outline" size="md">
                  View Queue
                </Button>
              </Link>
            </div>
          </div>

          <div className="hidden md:flex flex-shrink-0 items-center justify-center">
            <InstructorHeroIllustration className="w-40 h-28 sm:w-48 sm:h-32 lg:w-52 lg:h-36 object-contain drop-shadow-sm" />
          </div>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Assessments"
          value={isLoading ? '...' : String(stats.totalAssessments)}
          subtitle="Authored by you"
          icon={BookOpen}
          color="sage"
        />
        <StatCard
          title="Published & Live"
          value={isLoading ? '...' : String(stats.publishedCount)}
          subtitle="Open to students"
          icon={CheckCircle2}
          color="secondary"
          trend="Active cohort"
          trendType="up"
        />
        <StatCard
          title="Drafts In Progress"
          value={isLoading ? '...' : String(stats.draftCount)}
          subtitle="Unpublished examinations"
          icon={FileText}
          color="peach"
        />
        <StatCard
          title="Pending Evaluations"
          value={isLoading ? '...' : String(stats.pendingEvaluations)}
          subtitle="Awaiting manual grading"
          icon={AlertCircle}
          color="primary"
          trend={stats.pendingEvaluations > 0 ? 'Review Required' : 'All Graded'}
          trendType={stats.pendingEvaluations > 0 ? 'down' : 'up'}
        />
      </div>

      {/* Top Grid: Recent Assessments & Submission Activity Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Assessments Managed (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-4">
          <Card
            title="My Assessments"
            subtitle="Overview of published and draft course examinations"
            action={
              <Link to="/instructor/assessments" className="text-xs font-semibold text-[#3D8A78] hover:text-[#2D6A5B] hover:underline">
                View All →
              </Link>
            }
          >
            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center">
                <Spinner size="sm" />
                <p className="mt-2 text-xs text-[#64748B]">Loading assessments...</p>
              </div>
            ) : assessments.length === 0 ? (
              <EmptyState
                title="No assessments created yet"
                description="Author your first assessment with MCQs, short answers, or long essays."
                actionLabel="Create Assessment"
                onAction={() => navigate('/instructor/create')}
              />
            ) : (
              <div className="space-y-3">
                {assessments.slice(0, 4).map((asmt) => {
                  const asmtId = asmt._id || asmt.id;
                  const isPublished = asmt.status === 'published';
                  const isRestricted = asmt.accessType === 'restricted';
                  const qCount = asmt.questions?.length || 0;

                  return (
                    <div
                      key={asmtId}
                      className="p-4 rounded-2xl border border-[#EBE3D8] dark:border-[#2D3748] bg-[#FFF9F2]/50 dark:bg-[#12161F] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#F4A261] transition-all shadow-warm-xs"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <Badge
                            variant={isPublished ? 'sage' : 'peach'}
                            size="sm"
                            dot
                          >
                            {asmt.status}
                          </Badge>
                          <Badge
                            variant={isRestricted ? 'terracotta' : 'neutral'}
                            size="sm"
                          >
                            {isRestricted ? (
                              <span className="flex items-center">
                                <Lock className="w-2.5 h-2.5 mr-1" />
                                Restricted
                              </span>
                            ) : (
                              <span className="flex items-center">
                                <Globe className="w-2.5 h-2.5 mr-1" />
                                Public
                              </span>
                            )}
                          </Badge>
                          <span className="text-xs text-[#64748B]">·</span>
                          <span className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8] truncate">{asmt.category}</span>
                        </div>
                        <h4 className="text-sm font-semibold text-[#1F2937] dark:text-[#F9FAFB] truncate">
                          {asmt.title}
                        </h4>
                        <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                          {asmt.durationMinutes} Mins · {qCount} Questions · Pass: {asmt.passingScore}% · {asmt.totalPoints || 100} Pts
                        </p>
                      </div>

                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <Link to={`/instructor/analytics/${asmtId}`}>
                          <Button variant="secondary" size="sm" icon={BarChart2}>
                            Analytics
                          </Button>
                        </Link>
                        <Link to={`/instructor/edit/${asmtId}`}>
                          <Button variant="outline" size="sm" icon={Edit}>
                            Edit
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right: Submission Activity Trends (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-4">
          <Card
            title="Weekly Submissions"
            subtitle="Student test attempt volume (Last 7 days)"
          >
            <ActivityBarChart
              barKey="submissions"
              barLabel="Submissions"
              barColor="#3D8A78"
              height={230}
            />
            <div className="mt-4 pt-3 border-t border-[#EBE3D8] dark:border-[#2D3748] flex items-center justify-between text-xs text-[#64748B] dark:text-[#94A3B8]">
              <span>Total Submissions Tracked: <strong className="text-[#1F2937] dark:text-[#F9FAFB]">{submissions.length} Attempts</strong></span>
              <span className="text-[#3D8A78] font-semibold">Live System Sync</span>
            </div>
          </Card>
        </div>
      </div>

      {/* Pending Evaluations Section */}
      <Card
        title="Student Submissions Requiring Evaluation"
        subtitle="Review short answer and long essay responses, assign points, and release feedback"
        action={
          <Link to="/instructor/submissions" className="text-xs font-semibold text-[#E05D38] hover:text-[#C84E2D] hover:underline">
            Evaluation Queue →
          </Link>
        }
      >
        {isLoading ? (
          <div className="py-8 flex justify-center">
            <Spinner size="sm" />
          </div>
        ) : submissions.length === 0 ? (
          <EmptyState
            title="All submissions evaluated"
            description="There are currently no student responses awaiting grading."
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Student</TableHeader>
                <TableHeader>Assessment</TableHeader>
                <TableHeader>Submitted</TableHeader>
                <TableHeader>Auto Score</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader className="text-right">Action</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {submissions.slice(0, 5).map((item) => {
                const subId = item._id || item.id;
                const isPending = item.status === 'submitted' || item.evaluationStatus === 'pending';

                return (
                  <TableRow key={subId}>
                    <TableCell>
                      <div>
                        <span className="font-semibold text-[#1F2937] dark:text-[#F9FAFB] block">
                          {item.student?.name || 'Student'}
                        </span>
                        <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">{item.student?.email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs font-medium text-[#1F2937] dark:text-[#E2E8F0]">
                      {item.assessment?.title || 'Assessment'}
                    </TableCell>
                    <TableCell className="text-[#64748B] dark:text-[#94A3B8] text-xs">
                      {item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : 'Recent'}
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-[#1F2937] dark:text-[#E2E8F0]">
                      {item.autoScore !== undefined ? `${item.autoScore} Pts` : `${item.score || 0} Pts`}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={isPending ? 'peach' : 'sage'}
                        size="sm"
                        dot
                      >
                        {isPending ? 'Pending Evaluation' : 'Evaluated'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link to="/instructor/submissions">
                        <Button
                          variant={isPending ? 'primary' : 'ghost'}
                          size="sm"
                        >
                          {isPending ? 'Review' : 'View'}
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
};

export default InstructorDashboard;
