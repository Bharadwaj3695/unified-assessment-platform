import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Award, User, Loader2, ArrowRight, FileText, Download, Search } from 'lucide-react';
import { toast } from 'react-toastify';
import uapQuestionBankService from '../../services/uapQuestionBank.service';
import analyticsService from '../../services/analytics.service';
import useDebounce from '../../hooks/useDebounce';
import Pagination from '../ui/Pagination';
import { DEFAULT_PAGE_SIZE, normalizePagination } from '../../utils/pagination';

export default function MockTestAttemptsModal({ isOpen, onClose, mockTest }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const listTopRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setPage(1);
      setSearch('');
      setStatusFilter('all');
    }
  }, [isOpen, mockTest?._id]);

  const fetchAttempts = useCallback(async () => {
    if (!isOpen || !mockTest?._id) return;
    try {
      setLoading(true);
      const params = { page, limit };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const res = await uapQuestionBankService.getMockTestAttemptsPaginated(mockTest._id, params);
      const list = Array.isArray(res) ? res : res.data || [];
      setAttempts(list);
      setPagination(normalizePagination(res.pagination, { page, limit, total: list.length }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to fetch student attempts');
      setAttempts([]);
    } finally {
      setLoading(false);
    }
  }, [isOpen, mockTest?._id, page, limit, statusFilter, debouncedSearch]);

  useEffect(() => {
    fetchAttempts();
  }, [fetchAttempts]);

  if (!isOpen || !mockTest) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/20 dark:text-brand-peach">
                {mockTest.examination}
              </span>
              <span className="text-xs text-slate-400">Total Marks: {mockTest.totalMarks}</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
              Submissions for: {mockTest.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter toolbar */}
        <div className="px-6 pt-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search student name, email, or ID..."
              aria-label="Search mock test attempts"
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter mock test attempts by status"
            className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending Manual Review</option>
            <option value="evaluated">Evaluated</option>
          </select>
        </div>

        {/* Content list */}
        <div ref={listTopRef} className="p-6 overflow-y-auto space-y-4 flex-1">
          {loading ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
              <Loader2 className="w-7 h-7 animate-spin text-brand-primary" />
              <span className="text-xs">Loading candidate submissions...</span>
            </div>
          ) : attempts.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <Award className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
              <p className="text-sm font-semibold">No student submissions yet</p>
              <p className="text-xs text-slate-400">Student attempts will appear here for grading upon submission.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              {attempts.map((attempt) => {
                const isPendingManual = attempt.evaluationStatus === 'PENDING_MANUAL_REVIEW';
                const isFinalized = attempt.status === 'EVALUATED' && attempt.evaluationStatus === 'COMPLETED';

                return (
                  <div
                    key={attempt._id}
                    className="p-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-sm">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {attempt.studentId?.name || 'Anonymous Student'}
                        </h4>
                        <p className="text-xs text-slate-400">
                          {attempt.studentId?.email} • Submitted:{' '}
                          {new Date(attempt.submittedAt || attempt.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isFinalized
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : isPendingManual
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isPendingManual ? 'Pending Manual Review' : attempt.status}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white mt-1">
                          Score: {attempt.earnedMarks} / {mockTest.totalMarks} ({attempt.percentage}%)
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {isFinalized && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                navigate(`/instructor/reports/mock_test/${attempt._id}`);
                              }}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 transition"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              View Report
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                analyticsService
                                  .downloadIndividualExamReportPdf('mock_test', attempt._id)
                                  .then(() => toast.success('Performance report PDF downloaded.'))
                                  .catch((err) => toast.error(err.message || 'Failed to download PDF'))
                              }
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 transition"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Download PDF
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => {
                            onClose();
                            navigate(`/instructor/mock-tests/evaluate/${attempt._id}`);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                            isPendingManual
                              ? 'bg-brand-primary hover:bg-brand-primary-hover text-white shadow-warm-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          {isPendingManual ? 'Grade Submission' : 'Review Evaluation'}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {attempts.length > 0 && (
            <Pagination
              scrollTargetRef={listTopRef}
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              pageSize={limit}
              onPageChange={(nextPage) => setPage(nextPage)}
              onPageSizeChange={(nextLimit) => {
                setLimit(nextLimit);
                setPage(1);
              }}
              itemLabel="attempts"
              testIdPrefix="mock-attempts-pagination"
            />
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between text-xs text-slate-400">
          <span>{pagination.total} Total Submissions</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
