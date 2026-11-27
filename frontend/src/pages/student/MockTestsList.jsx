import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ArrowRight, Search, X } from 'lucide-react';
import uapQuestionBankService from '../../services/uapQuestionBank.service';
import useDebounce from '../../hooks/useDebounce';
import Pagination, { PaginationJumpLink } from '../../components/ui/Pagination';
import { DEFAULT_PAGE_SIZE, normalizePagination } from '../../utils/pagination';

export default function MockTestsList() {
  const navigate = useNavigate();
  const [mockTests, setMockTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const listTopRef = useRef(null);
  const paginationRef = useRef(null);

  const loadTests = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      const res = await uapQuestionBankService.getMockTestsPaginated(params);
      const list = Array.isArray(res) ? res : res.data || [];
      setMockTests(list);
      setPagination(normalizePagination(res.pagination, { page, limit, total: list.length }));
    } catch (_err) {
      setMockTests([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch]);

  useEffect(() => {
    loadTests();
  }, [loadTests]);

  return (
    <div ref={listTopRef} className="space-y-6 pb-12">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Practice Tests & Mock Exams</h1>
          <p className="text-sm text-slate-500 mt-1">
            Take blueprint-generated practice tests calibrated against competitive and institutional syllabi.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search mock tests..."
              aria-label="Search mock tests"
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <PaginationJumpLink
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            targetRef={paginationRef}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full p-8 text-center text-xs text-slate-400">Loading available tests...</div>
        ) : mockTests.length === 0 ? (
          <div className="col-span-full p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            {debouncedSearch.trim()
              ? 'No mock tests match your search criteria.'
              : 'No published mock tests currently available.'}
          </div>
        ) : (
          mockTests.map((test) => (
            <div
              key={test._id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/20 dark:text-brand-peach">
                    {test.examination}
                  </span>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {test.durationMinutes} mins
                  </span>
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white line-clamp-2">{test.title}</h3>
                <p className="text-xs text-slate-500 line-clamp-2 mt-1">{test.description || 'Practice examination'}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-semibold block">{test.questionCount || test.resolvedQuestions?.length || 0} Questions</span>
                  <span>{test.totalMarks} Marks</span>
                </div>
                <button
                  onClick={() => navigate(`/student/mock-test/${test._id}`)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-brand-primary text-white hover:bg-brand-primary-hover shadow-warm-xs transition flex items-center gap-1.5"
                >
                  Start Exam
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {!loading && mockTests.length > 0 && (
        <Pagination
          containerRef={paginationRef}
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
          itemLabel="mock tests"
          testIdPrefix="mock-tests-pagination"
        />
      )}
    </div>
  );
}
