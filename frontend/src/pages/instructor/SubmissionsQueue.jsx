import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import instructorService from '../../services/instructor.service';
import InstructorSearchBar from '../../components/instructor/InstructorSearchBar';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from '../../components/ui/Table';
import {
  FileCheck2,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  Award,
  ArrowRight,
  Filter,
} from 'lucide-react';

const SubmissionsQueue = () => {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadSubmissions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await instructorService.getInstructorSubmissions({ limit: 100 });
      const list = res.data || res.submissions || [];
      setSubmissions(list);
    } catch (err) {
      setError(err.message || 'Failed to retrieve instructor submissions.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  const filteredSubmissions = submissions.filter((sub) => {
    const isPending = sub.status === 'submitted' || sub.evaluationStatus === 'pending';
    const isEvaluated = sub.status === 'evaluated' || sub.evaluationStatus === 'completed';

    if (statusFilter === 'pending' && !isPending) return false;
    if (statusFilter === 'evaluated' && !isEvaluated) return false;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      const matchStudent =
        sub.student?.name?.toLowerCase().includes(term) ||
        sub.student?.email?.toLowerCase().includes(term);
      const matchAsmt = sub.assessment?.title?.toLowerCase().includes(term);
      if (!matchStudent && !matchAsmt) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Prominent Workspace Search Bar */}
      <div className="rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark p-4 sm:p-5 shadow-sm">
        <InstructorSearchBar placeholder="Search student name, email, or assessment title..." />
      </div>

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
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 bg-[#FFF9F2] dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] p-1 rounded-xl">
            {[
              { id: 'all', label: 'All' },
              { id: 'pending', label: 'Needs Review' },
              { id: 'evaluated', label: 'Evaluated' },
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

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search queue..."
              className="pl-8 pr-3 py-1.5 text-xs bg-[#FFF9F2] dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl text-[#1F2937] dark:text-[#F9FAFB] placeholder-[#64748B]/60 focus:outline-none focus:border-[#E05D38] focus:ring-1 focus:ring-[#E05D38]/20 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Submissions Table */}
      <Card>
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center">
            <Spinner size="md" />
            <p className="mt-3 text-xs text-slate-500">Loading student submissions...</p>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-red-500 text-sm">{error}</div>
        ) : filteredSubmissions.length === 0 ? (
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
                <TableHeader>Auto Score</TableHeader>
                <TableHeader>Manual Score</TableHeader>
                <TableHeader>Final Result</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader className="text-right">Action</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredSubmissions.map((sub) => {
                const subId = sub._id || sub.id;
                const isPending =
                  sub.status === 'submitted' || sub.evaluationStatus === 'pending';

                return (
                  <TableRow key={subId}>
                    <TableCell>
                      <div>
                        <span className="font-semibold text-[#1F2937] dark:text-[#F9FAFB] block">
                          {sub.student?.name || 'Student Candidate'}
                        </span>
                        <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">{sub.student?.email}</span>
                      </div>
                    </TableCell>

                    <TableCell className="max-w-xs truncate text-xs font-medium text-[#1F2937] dark:text-[#E2E8F0]">
                      {sub.assessment?.title || 'Assessment'}
                    </TableCell>

                    <TableCell className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                      {sub.submittedAt
                        ? new Date(sub.submittedAt).toLocaleDateString()
                        : 'Recent'}
                    </TableCell>

                    <TableCell className="text-xs text-[#1F2937] dark:text-[#F9FAFB] font-medium">
                      {sub.autoScore !== undefined ? `${sub.autoScore} pts` : '—'}
                    </TableCell>

                    <TableCell className="text-xs text-[#1F2937] dark:text-[#F9FAFB] font-medium">
                      {sub.manualScore !== undefined ? `${sub.manualScore} pts` : '—'}
                    </TableCell>

                    <TableCell className="text-xs font-semibold">
                      {isPending ? (
                        <span className="text-[#E05D38] dark:text-[#F4A261]">Pending Review</span>
                      ) : (
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[#1F2937] dark:text-[#F9FAFB]">{sub.score || sub.finalScore || 0} pts</span>
                          <span className="text-[#64748B]">({sub.percentage || 0}%)</span>
                          <Badge
                            variant={sub.passed || sub.resultStatus === 'passed' ? 'sage' : 'danger'}
                            size="sm"
                          >
                            {sub.passed || sub.resultStatus === 'passed' ? 'PASS' : 'FAIL'}
                          </Badge>
                        </div>
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
    </div>
  );
};

export default SubmissionsQueue;
