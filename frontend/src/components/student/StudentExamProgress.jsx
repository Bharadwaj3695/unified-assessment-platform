import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Download,
  FileText,
  Clock,
  Sparkles,
  Search,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'react-toastify';
import analyticsService from '../../services/analytics.service';
import useDebounce from '../../hooks/useDebounce';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import ErrorState from '../ui/ErrorState';
import TableSkeleton from '../ui/TableSkeleton';
import Pagination, { PaginationJumpLink } from '../ui/Pagination';
import { DEFAULT_PAGE_SIZE, normalizePagination } from '../../utils/pagination';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from '../ui/Table';

export default function StudentExamProgress() {
  const navigate = useNavigate();
  const [progressData, setProgressData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [examType, setExamType] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date_desc');
  const [downloadingId, setDownloadingId] = useState(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingLimit, setPendingLimit] = useState(DEFAULT_PAGE_SIZE);

  const evaluatedTopRef = useRef(null);
  const evaluatedPaginationRef = useRef(null);
  const pendingTopRef = useRef(null);
  const pendingPaginationRef = useRef(null);

  const loadExamProgress = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await analyticsService.getStudentExamProgress({
        search: debouncedSearch,
        examType,
        resultFilter,
        sortBy,
        page,
        limit,
        pendingPage,
        pendingLimit,
      });
      setProgressData(data);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Unable to load exam progress.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, examType, resultFilter, sortBy, page, limit, pendingPage, pendingLimit]);

  useEffect(() => {
    loadExamProgress();
  }, [loadExamProgress]);

  const handleDownloadPdf = async (item) => {
    try {
      setDownloadingId(item.attemptId);
      await analyticsService.downloadIndividualExamReportPdf(item.attemptType, item.attemptId);
      toast.success(`Downloaded report PDF for "${item.examName}".`);
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to download PDF report.');
    } finally {
      setDownloadingId(null);
    }
  };

  const evaluatedExams = progressData?.evaluatedExams || [];
  const pendingExams = progressData?.pendingExams || [];
  const summary = progressData?.summary || {
    evaluatedCount: 0,
    pendingCount: 0,
    passedCount: 0,
    failedCount: 0,
    averagePercentage: null,
  };
  const evaluatedPagination = normalizePagination(
    progressData?.evaluatedPagination || progressData?.pagination,
    { page, limit, total: evaluatedExams.length }
  );
  const pendingPagination = normalizePagination(
    progressData?.pendingPagination,
    { page: pendingPage, limit: pendingLimit, total: pendingExams.length }
  );
  const Predictor = progressData?.Predictor || null;

  return (
    <div className="space-y-6" data-testid="student-exam-progress-view">
      {/* Header & Summary */}
      <Card
        title="Exam Performance"
        subtitle="Individual evaluated exam outcomes, scores, and downloadable reports"
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={RefreshCw}
            onClick={loadExamProgress}
          >
            Refresh
          </Button>
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border">
            <span className="text-[11px] text-slate-500 block">Evaluated Exams</span>
            <span className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
              {summary.evaluatedCount}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border">
            <span className="text-[11px] text-slate-500 block">Passed</span>
            <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
              {summary.passedCount}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border">
            <span className="text-[11px] text-slate-500 block">Failed</span>
            <span className="text-lg font-extrabold text-rose-600 dark:text-rose-400">
              {summary.failedCount}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border">
            <span className="text-[11px] text-slate-500 block">Pending Evaluation</span>
            <span className="text-lg font-extrabold text-amber-600 dark:text-amber-400">
              {summary.pendingCount}
            </span>
          </div>
        </div>

        {/* Filter & Sort Controls */}
        <div
          ref={evaluatedTopRef}
          className="flex flex-wrap items-center gap-2 pb-4 mb-4 border-b border-surface-light-border dark:border-surface-dark-border"
        >
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
                setPendingPage(1);
              }}
              placeholder="Search exam name or subject..."
              aria-label="Search exam performance"
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
          </div>

          <select
            value={examType}
            onChange={(e) => {
              setExamType(e.target.value);
              setPage(1);
              setPendingPage(1);
            }}
            aria-label="Filter by exam type"
            className="px-2.5 py-1.5 text-xs rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark text-slate-700 dark:text-slate-200"
          >
            <option value="all">All Types</option>
            <option value="assessment">Assessments</option>
            <option value="mock_test">Mock Tests</option>
          </select>

          <select
            value={resultFilter}
            onChange={(e) => {
              setResultFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by result"
            className="px-2.5 py-1.5 text-xs rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark text-slate-700 dark:text-slate-200"
          >
            <option value="all">All Results</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(1);
            }}
            aria-label="Sort exams"
            className="px-2.5 py-1.5 text-xs rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark text-slate-700 dark:text-slate-200"
          >
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="score_desc">Highest Percentage</option>
            <option value="score_asc">Lowest Percentage</option>
            <option value="name_asc">Exam Name (A–Z)</option>
          </select>

          <PaginationJumpLink
            currentPage={evaluatedPagination.page}
            totalPages={evaluatedPagination.totalPages}
            totalItems={evaluatedPagination.total}
            targetRef={evaluatedPaginationRef}
          />
        </div>

        {/* Evaluated Exams Table */}
        {loading ? (
          <TableSkeleton rows={4} columns={8} />
        ) : error ? (
          <ErrorState title="Unable to Load Exam Progress" message={error} onRetry={loadExamProgress} />
        ) : evaluatedExams.length === 0 ? (
          <EmptyState
            title="No Evaluated Exams Found"
            description={
              search || examType !== 'all' || resultFilter !== 'all'
                ? 'No evaluated exams match the current filter criteria.'
                : 'Completed and finalized exam evaluations will appear here with individual performance reports.'
            }
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Exam Name</TableHeader>
                <TableHeader>Subject</TableHeader>
                <TableHeader>Type</TableHeader>
                <TableHeader>Date</TableHeader>
                <TableHeader>Score</TableHeader>
                <TableHeader>Percentage</TableHeader>
                <TableHeader>Threshold</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Result</TableHeader>
                <TableHeader className="text-right">Report</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {evaluatedExams.map((item) => (
                <TableRow key={`${item.attemptType}-${item.attemptId}`} data-testid={`progress-exam-row-${item.attemptId}`}>
                  <TableCell>
                    <span className="font-bold text-slate-900 dark:text-slate-100 block">
                      {item.examName}
                    </span>
                    {item.examinationTag && (
                      <span className="text-[11px] text-[#E05D38] dark:text-[#F4A261] font-medium">
                        {item.examinationTag}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600 dark:text-slate-300">
                    {item.subject}
                  </TableCell>
                  <TableCell>
                    <Badge variant="neutral" size="sm">
                      {item.examTypeLabel}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                    <span>{item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : '—'}</span>
                    {item.evaluatedAt && (
                      <span className="block text-[10px] text-slate-400">
                        Graded: {new Date(item.evaluatedAt).toLocaleDateString()}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {item.score} / {item.totalMarks}
                  </TableCell>
                  <TableCell className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {item.percentage}%
                  </TableCell>
                  <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                    {item.passingThreshold}%
                  </TableCell>
                  <TableCell>
                    <Badge variant="neutral" size="sm">
                      Evaluated
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.passed ? 'success' : 'danger'} size="sm">
                      {item.resultLabel}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        icon={FileText}
                        onClick={() => navigate(`/student/reports/${item.attemptType}/${item.attemptId}`)}
                        data-testid={`btn-view-report-${item.attemptId}`}
                      >
                        View Report
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        icon={Download}
                        loading={downloadingId === item.attemptId}
                        onClick={() => handleDownloadPdf(item)}
                        data-testid={`btn-download-pdf-${item.attemptId}`}
                        title="Download PDF"
                      >
                        Download PDF
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!loading && !error && evaluatedExams.length > 0 && (
          <Pagination
            containerRef={evaluatedPaginationRef}
            scrollTargetRef={evaluatedTopRef}
            currentPage={evaluatedPagination.page}
            totalPages={evaluatedPagination.totalPages}
            totalItems={evaluatedPagination.total}
            pageSize={limit}
            onPageChange={(nextPage) => setPage(nextPage)}
            onPageSizeChange={(nextLimit) => {
              setLimit(nextLimit);
              setPage(1);
            }}
            itemLabel="evaluated exams"
            testIdPrefix="progress-evaluated-pagination"
          />
        )}
      </Card>

      {/* Pending Evaluations (Strictly Separated) */}
      {!loading && !error && pendingExams.length > 0 && (
        <div ref={pendingTopRef}>
        <Card
          title="Pending Evaluation"
          subtitle="Submitted exams awaiting faculty grading — excluded from completed exam performance"
          action={
            <PaginationJumpLink
              currentPage={pendingPagination.page}
              totalPages={pendingPagination.totalPages}
              totalItems={pendingPagination.total}
              targetRef={pendingPaginationRef}
            />
          }
        >
          <div className="divide-y divide-surface-light-border dark:divide-surface-dark-border" data-testid="progress-pending-section">
            {pendingExams.map((item) => (
              <div
                key={`pending-${item.attemptType}-${item.attemptId}`}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {item.examName}
                    </span>
                    <Badge variant="neutral" size="sm">
                      {item.examTypeLabel}
                    </Badge>
                    <Badge variant="warning" size="sm">
                      Pending Evaluation
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Subject: {item.subject} · Submitted:{' '}
                    {item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : '—'}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Report available after evaluation</span>
                </div>
              </div>
            ))}
          </div>
          <Pagination
            containerRef={pendingPaginationRef}
            scrollTargetRef={pendingTopRef}
            currentPage={pendingPagination.page}
            totalPages={pendingPagination.totalPages}
            totalItems={pendingPagination.total}
            pageSize={pendingLimit}
            onPageChange={(nextPage) => setPendingPage(nextPage)}
            onPageSizeChange={(nextLimit) => {
              setPendingLimit(nextLimit);
              setPendingPage(1);
            }}
            itemLabel="pending evaluations"
            testIdPrefix="progress-pending-pagination"
          />
        </Card>
        </div>
      )}

      {/* Performance Analysis (Integration-Ready Placeholder) */}
      <Card
        title="Performance Analysis"
        subtitle="Estimate-only predictive analytics integration (separate from official evaluation)"
        action={
          <Badge variant="neutral" size="sm">
            <Sparkles className="w-3 h-3 mr-1 inline" />
            {Predictor?.badge || 'Coming Soon · Not Available'}
          </Badge>
        }
      >
        <div className="space-y-3 text-xs" data-testid="progress-ai-predictor">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border text-slate-600 dark:text-slate-300 leading-relaxed">
            {Predictor?.disclaimer ||
              'Performance Analysis is coming soon and is not currently available. Future estimates will never modify official scores, pass/fail outcomes, or certification.'}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-slate-500 dark:text-slate-400">
            <span>
              Finalized Exams Analyzed:{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                {Predictor?.evaluatedHistoryCount ?? summary.evaluatedCount}
              </strong>
            </span>
            <span>
              Status:{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                {Predictor?.isOperational ? 'Operational' : 'Coming Soon / Not Available'}
              </strong>
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
