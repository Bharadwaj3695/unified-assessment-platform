import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import analyticsService from '../../services/analytics.service';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import StatCard from '../../components/common/StatCard';
import ScoreDistributionChart from '../../components/charts/ScoreDistributionChart';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from '../../components/ui/Table';
import {
  ArrowLeft,
  BookOpen,
  Users,
  CheckCircle2,
  Clock,
  Award,
  AlertTriangle,
  FileCheck,
  TrendingUp,
  HelpCircle,
  BarChart2,
  Eye,
  RefreshCw,
  Lock,
  Globe,
  Check,
  X,
} from 'lucide-react';

const AssessmentAnalytics = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [assessmentData, setAssessmentData] = useState(null);
  const [questionData, setQuestionData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadAnalytics = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [analyticsRes, questionsRes] = await Promise.all([
        analyticsService.getInstructorAssessmentAnalytics(id),
        analyticsService.getInstructorQuestionAnalytics(id),
      ]);

      setAssessmentData(analyticsRes);
      setQuestionData(questionsRes);
    } catch (err) {
      setError(err.message || 'Failed to retrieve assessment analytics');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Spinner size="lg" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Compiling assessment analytics & question performance telemetry...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Assessment Analytics Unavailable"
        message={error}
        onRetry={loadAnalytics}
      />
    );
  }

  const {
    assessment,
    totalAssigned,
    startedAttempts,
    completedSubmissions,
    evaluatedSubmissions,
    pendingEvaluations,
    averageScore,
    highestScore,
    lowestScore,
    passRate,
    evaluationCompletionStatus,
    scoreDistribution,
    studentSubmissions = [],
  } = assessmentData || {};

  const isRestricted = assessment?.accessType === 'restricted';

  return (
    <div className="space-y-6">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            icon={ArrowLeft}
            onClick={() => navigate('/instructor/assessments')}
          >
            Back to Assessments
          </Button>
          <div>
            <div className="flex items-center space-x-2">
              <Badge variant="terracotta" size="sm">
                Assessment Analytics
              </Badge>
              <Badge variant={assessment?.status === 'published' ? 'sage' : 'peach'} size="sm" dot>
                {assessment?.status}
              </Badge>
              {isRestricted ? (
                <Badge variant="neutral" size="sm">
                  <Lock className="w-2.5 h-2.5 mr-1 inline" />
                  Restricted Cohort ({totalAssigned || 0})
                </Badge>
              ) : (
                <Badge variant="neutral" size="sm">
                  <Globe className="w-2.5 h-2.5 mr-1 inline" />
                  Public Exam
                </Badge>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-1">
              {assessment?.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            onClick={loadAnalytics}
          >
            Refresh Data
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Eye}
            onClick={() => navigate(`/instructor/submissions`)}
          >
            Evaluation Queue
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Started Attempts"
          value={startedAttempts}
          subtitle={`Completed: ${completedSubmissions}`}
          icon={Users}
          color="peach"
        />
        <StatCard
          title="Average Score"
          value={averageScore !== null ? `${averageScore}%` : '—'}
          subtitle={`High: ${highestScore ?? '—'}% · Low: ${lowestScore ?? '—'}%`}
          icon={Award}
          color="terracotta"
        />
        <StatCard
          title="Pass Rate"
          value={completedSubmissions > 0 ? `${passRate}%` : '—'}
          subtitle={`Passing Mark: ${assessment?.passingScore || 60}%`}
          icon={CheckCircle2}
          color="sage"
        />
        <StatCard
          title="Evaluation Status"
          value={
            evaluationCompletionStatus === 'completed'
              ? 'All Graded'
              : evaluationCompletionStatus === 'pending'
              ? `${pendingEvaluations} Pending`
              : 'No Attempts'
          }
          subtitle={`Evaluated: ${evaluatedSubmissions} / ${completedSubmissions}`}
          icon={FileCheck}
          color="secondary"
          trend={pendingEvaluations > 0 ? 'Requires Action' : 'Up to Date'}
          trendType={pendingEvaluations > 0 ? 'down' : 'up'}
        />
      </div>

      {/* Charts & Distribution Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Score Distribution */}
        <div className="lg:col-span-6 space-y-4">
          <Card
            title="Score Distribution"
            subtitle="Student examination results categorized by standard percentage intervals"
          >
            {completedSubmissions === 0 ? (
              <EmptyState
                title="No Submissions Recorded"
                description="Once students submit completed attempts, score distribution metrics will render here."
              />
            ) : (
              <ScoreDistributionChart data={scoreDistribution} height={250} />
            )}
          </Card>
        </div>

        {/* Right: Assessment Specifications */}
        <div className="lg:col-span-6 space-y-4">
          <Card
            title="Assessment Configuration & Telemetry"
            subtitle="Authoritative structural parameters"
          >
            <div className="space-y-3 text-xs pt-1">
              <div className="flex justify-between py-2 border-b border-surface-light-border dark:border-surface-dark-border">
                <span className="text-slate-500 dark:text-slate-400">Subject Category:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {assessment?.category || 'General'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-surface-light-border dark:border-surface-dark-border">
                <span className="text-slate-500 dark:text-slate-400">Total Points Available:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {assessment?.totalPoints || 100} Points
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-surface-light-border dark:border-surface-dark-border">
                <span className="text-slate-500 dark:text-slate-400">Passing Score Required:</span>
                <span className="font-semibold text-brand-terracotta">
                  {assessment?.passingScore || 60}%
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-surface-light-border dark:border-surface-dark-border">
                <span className="text-slate-500 dark:text-slate-400">Total Assigned Students:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {isRestricted ? `${totalAssigned} Students` : 'All Registered Candidates (Public)'}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500 dark:text-slate-400">Evaluation Pipeline:</span>
                <Badge
                  variant={
                    evaluationCompletionStatus === 'completed'
                      ? 'success'
                      : evaluationCompletionStatus === 'pending'
                      ? 'warning'
                      : 'neutral'
                  }
                  size="sm"
                >
                  {evaluationCompletionStatus === 'completed'
                    ? 'Fully Evaluated'
                    : evaluationCompletionStatus === 'pending'
                    ? 'Evaluations Pending'
                    : 'Awaiting Submissions'}
                </Badge>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Question-Level Analytics Table */}
      <Card
        title="Question-Level Analytics"
        subtitle="Objective accuracy statistics, subjective grading metrics, and difficulty indicators"
      >
        {!questionData?.questions || questionData.questions.length === 0 ? (
          <EmptyState
            title="No Questions Configured"
            description="Add examination questions in the Assessment Builder to review analytics."
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>#</TableHeader>
                <TableHeader>Question Prompt</TableHeader>
                <TableHeader>Type</TableHeader>
                <TableHeader>Points</TableHeader>
                <TableHeader>Attempts</TableHeader>
                <TableHeader>Accuracy / Avg Marks</TableHeader>
                <TableHeader>Difficulty</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {questionData.questions.map((q) => (
                <TableRow key={q.questionId}>
                  <TableCell className="font-bold text-slate-500">{q.orderIndex}</TableCell>
                  <TableCell className="max-w-md">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">
                      {q.questionText}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" size="sm">
                      {q.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-semibold">{q.points} pts</TableCell>
                  <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                    {q.attempts}
                  </TableCell>
                  <TableCell>
                    {q.isObjective ? (
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-1.5 text-xs font-semibold">
                          <span>{q.correctPercentage}% correct</span>
                          <span className="text-slate-400">({q.correctCount}/{q.attempts})</span>
                        </div>
                        <div className="w-24 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              q.correctPercentage >= 70
                                ? 'bg-emerald-500'
                                : q.correctPercentage >= 50
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${q.correctPercentage}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs">
                        {q.evaluatedCount > 0 ? (
                          <>
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {q.averageMarks} / {q.points} pts
                            </span>
                            <span className="text-slate-400 block text-[11px]">
                              {q.averagePercentage}% avg ({q.evaluatedCount} graded)
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-400 italic">Pending grading</span>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {q.isDifficult ? (
                      <Badge variant="danger" size="sm">
                        <AlertTriangle className="w-2.5 h-2.5 mr-1 inline" />
                        Challenging (&lt;50%)
                      </Badge>
                    ) : (
                      <Badge variant="sage" size="sm">
                        <Check className="w-2.5 h-2.5 mr-1 inline" />
                        Standard
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Student Submissions List */}
      <Card
        title="Student Submissions & Results"
        subtitle="Individual examination attempt outcomes for this assessment"
      >
        {studentSubmissions.length === 0 ? (
          <EmptyState
            title="No Student Submissions Yet"
            description="When enrolled students complete and submit their attempts, their results will appear here."
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Student</TableHeader>
                <TableHeader>Submitted Date</TableHeader>
                <TableHeader>Score</TableHeader>
                <TableHeader>Result</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader className="text-right">Action</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {studentSubmissions.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell>
                    <div>
                      <span className="font-bold text-slate-900 dark:text-slate-100 block">
                        {sub.studentName}
                      </span>
                      <span className="text-xs text-slate-400">{sub.studentCode}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                    {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {sub.score} / {sub.totalPoints} ({sub.percentage}%)
                  </TableCell>
                  <TableCell>
                    <Badge variant={sub.passed ? 'success' : 'danger'} size="sm">
                      {sub.passed ? 'Passed' : 'Failed'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        sub.evaluationStatus === 'completed'
                          ? 'success'
                          : 'warning'
                      }
                      size="sm"
                      dot
                    >
                      {sub.evaluationStatus === 'completed' ? 'Evaluated' : 'Pending Evaluation'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link to={`/instructor/submissions`}>
                      <Button variant="outline" size="sm">
                        Review
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
};

export default AssessmentAnalytics;
