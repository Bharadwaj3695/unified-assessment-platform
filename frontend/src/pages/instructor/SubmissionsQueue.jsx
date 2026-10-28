import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import instructorService from '../../services/instructor.service';
import { useRefresh } from '../../hooks/useRefresh';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import TableSkeleton from '../../components/ui/TableSkeleton';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from '../../components/ui/Table';
import {
  X,
  Award,
  RefreshCw,
} from 'lucide-react';

const SubmissionsQueue = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [submissions, setSubmissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('search');
    if (q) setSearchTerm(q);
  }, [location.search]);

  const loadSubmissions = useCallback(async (isManual = false) => {
    try {
      if (!isManual) {
        setIsLoading(true);
      }
      setError(null);
      const res = await instructorService.getInstructorSubmissions({ limit: 100 });
      const list = res.data || res.submissions || [];
      setSubmissions(list);
    } catch (err) {
      setError(err.message || 'Failed to retrieve instructor submissions.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const { isRefreshing, refresh: handleRefresh } = useRefresh(
    () => loadSubmissions(true),
    { successMessage: 'Submissions queue refreshed!' }
  );

  useEffect(() => {
    loadSubmissions(false).catch(() => {});
  }, [loadSubmissions]);

  const filteredSubmissions = submissions.filter((sub) => {
    const isPending = sub.status === 'submitted' || sub.evaluationStatus === 'pending';
    const isEvaluated = sub.status === 'evaluated' || sub.evaluationStatus === 'completed';
    const isCertified = Boolean(sub.certificate);

    if (statusFilter === 'pending' && !isPending) return false;
    if (statusFilter === 'evaluated' && !isEvaluated) return false;
    if (statusFilter === 'certified' && !isCertified) return false;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      const matchStudent =
        sub.student?.name?.toLowerCase().includes(term) ||
        sub.student?.email?.toLowerCase().includes(term) ||
        sub.student?.studentId?.toLowerCase().includes(term);
      const matchAsmt = sub.assessment?.title?.toLowerCase().includes(term);
      const matchCert = sub.certificate?.certificateId?.toLowerCase().includes(term);
      if (!matchStudent && !matchAsmt && !matchCert) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <Badge variant="sage" size="sm" dot>
              Evaluation Studio
            </Badge>
            <span className="text-xs text-slate-400">· Grading & Feedback Queue</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Submission Evaluation Queue
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Review student answers, evaluate subjective responses, and release grades.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1 bg-[#FFF9F2] dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] p-1 rounded-xl">
            {[
              { id: 'all', label: 'All' },
              { id: 'pending', label: 'Needs Review' },
              { id: 'evaluated', label: 'Evaluated' },
              { id: 'certified', label: 'Certificate Issued' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-[#E05D38] text-white shadow-warm-xs'
                    : 'text-[#64748B] hover:text-[#1F2937] dark:hover:text-[#F9FAFB]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={RefreshCw}
            iconClassName={isRefreshing ? 'animate-spin' : ''}
            onClick={handleRefresh}
            isLoading={isRefreshing}
            loadingText="Refreshing..."
            title="Refresh queue"
            aria-label={isRefreshing ? 'Refreshing queue' : 'Refresh queue'}
          >
            Refresh
          </Button>

          {searchTerm && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FDECE2] text-[#E05D38] dark:bg-[#341C16] dark:text-[#F4A261] border border-[#E05D38]/30">
              <span>Filter: &ldquo;{searchTerm}&rdquo;</span>
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="hover:text-red-600 transition-colors cursor-pointer ml-1"
                title="Clear search filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Submissions Table */}
      {isLoading ? (
        <TableSkeleton rows={5} columns={8} />
      ) : error ? (
        <ErrorState
          title="Unable to Load Submissions"
          message={error}
          onRetry={loadSubmissions}
        />
      ) : (
        <Card>
          {filteredSubmissions.length === 0 ? (
          <EmptyState
            title="No submissions found"
            description={
              searchTerm || statusFilter !== 'all'
                ? 'No student attempts match your selected search or filter criteria.'
                : 'No student submissions are currently queued for evaluation.'
            }
          />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Student</TableHeader>
                <TableHeader>Assessment</TableHeader>
                <TableHeader>Submitted</TableHeader>
                <TableHeader>Earned Marks</TableHeader>
                <TableHeader>Grade & Result</TableHeader>
                <TableHeader>Certification</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader className="text-right">Action</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredSubmissions.map((sub) => {
                const subId = sub._id || sub.id;
                const isPending =
                  sub.status === 'submitted' || sub.evaluationStatus === 'pending';
                const certEnabled = Boolean(sub.assessment?.certification?.enabled);
                const hasCert = Boolean(sub.certificate);
                const isEligible = Boolean(sub.evaluation?.certificateEligible);
                const isPassed = sub.passed || sub.resultStatus === 'passed';

                return (
                  <TableRow key={subId}>
                    <TableCell>
                      <div>
                        <span className="font-semibold text-[#1F2937] dark:text-[#F9FAFB] block">
                          {sub.student?.name || 'Student Candidate'}
                        </span>
                        {sub.student?.studentId && (
                          <span className="text-[10px] font-mono text-[#E05D38] dark:text-[#F4A261] font-semibold block">
                            ID: {sub.student.studentId}
                          </span>
                        )}
                        <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">{sub.student?.email}</span>
                      </div>
                    </TableCell>

                    <TableCell className="max-w-xs truncate text-xs font-medium text-[#1F2937] dark:text-[#E2E8F0]">
                      <span className="block font-semibold truncate">{sub.assessment?.title || 'Assessment'}</span>
                      <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">{sub.assessment?.category || 'General'}</span>
                    </TableCell>

                    <TableCell className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                      {sub.submittedAt
                        ? new Date(sub.submittedAt).toLocaleDateString()
                        : 'Recent'}
                    </TableCell>

                    <TableCell className="text-xs text-[#1F2937] dark:text-[#F9FAFB] font-medium">
                      {isPending ? (
                        <span>{sub.autoScore || 0} pts (Provisional)</span>
                      ) : (
                        <span>
                          <strong>{sub.score || sub.finalScore || 0}</strong> / {sub.totalPoints || sub.assessment?.totalPoints || 100} pts{' '}
                          <span className="text-[#64748B]">({sub.percentage || 0}%)</span>
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="text-xs font-semibold">
                      {isPending ? (
                        <Badge variant="peach" size="sm">
                          Pending Evaluation
                        </Badge>
                      ) : (
                        <div className="flex flex-col gap-1 items-start">
                          <Badge
                            variant={isPassed ? 'sage' : 'danger'}
                            size="sm"
                          >
                            {isPassed ? 'Passed' : 'Not Passed'}
                          </Badge>
                          {sub.evaluation?.grade && (
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                              Grade: {sub.evaluation.grade} {sub.evaluation.gradeLabel ? `(${sub.evaluation.gradeLabel})` : ''}
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      {!certEnabled ? (
                        <Badge variant="neutral" size="sm">
                          Certification Disabled
                        </Badge>
                      ) : isPending ? (
                        <Badge variant="peach" size="sm">
                          Pending Evaluation
                        </Badge>
                      ) : hasCert ? (
                        <div className="flex flex-col gap-0.5 items-start">
                          <Badge variant="sage" size="sm" className="flex items-center gap-1">
                            <Award className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span>Certificate Issued</span>
                          </Badge>
                          <span className="text-[10px] font-mono text-slate-500 font-semibold">
                            {sub.certificate.certificateId}
                          </span>
                        </div>
                      ) : isEligible ? (
                        <Badge variant="peach" size="sm">
                          Eligible for Certification
                        </Badge>
                      ) : (
                        <Badge variant="neutral" size="sm">
                          Not Eligible
                        </Badge>
                      )}
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
                      <Link to={`/instructor/evaluate/${subId}`}>
                        <Button
                          variant={isPending ? 'primary' : 'outline'}
                          size="sm"
                        >
                          {isPending ? 'Evaluate' : 'Review'}
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
      )}
    </div>
  );
};

export default SubmissionsQueue;
