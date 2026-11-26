import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowDown } from 'lucide-react';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../../utils/pagination';

/**
 * Build compact page number sequence with ellipsis for first/last/window access.
 * Example: [1, '...', 4, 5, 6, '...', 13]
 */
function buildPageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, '...', totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
}

/**
 * Compact jump link placed near list headers on long pages so users can jump straight to bottom pagination.
 */
export function PaginationJumpLink({
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  targetRef = null,
  targetId = null,
  className = '',
}) {
  if (totalItems <= 0 || totalPages <= 1) return null;

  const handleJump = () => {
    const el = targetRef?.current || (targetId ? document.getElementById(targetId) : null);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  return (
    <button
      type="button"
      onClick={handleJump}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark text-slate-600 dark:text-slate-300 hover:text-brand-primary hover:border-brand-primary/40 transition-colors cursor-pointer ${className}`}
      title="Jump to pagination controls"
      aria-label={`Jump to pagination controls (Page ${currentPage} of ${totalPages})`}
    >
      <span>
        Page {currentPage} / {totalPages}
      </span>
      <ArrowDown className="w-3 h-3" aria-hidden="true" />
    </button>
  );
}

/**
 * Reusable UAP Pagination component.
 * Supports rows-per-page selection (5, 10, 15, 25, 50), Showing X-Y of Z summary,
 * Previous/Next, First/Last page access, and numbered page buttons with ellipsis.
 */
export default function Pagination({
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = DEFAULT_PAGE_SIZE,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'records',
  scrollTargetRef = null,
  containerRef = null,
  id = undefined,
  testIdPrefix = 'pagination',
  className = '',
}) {
  const minPageSize = useMemo(
    () => Math.min(...(pageSizeOptions.length ? pageSizeOptions : PAGE_SIZE_OPTIONS)),
    [pageSizeOptions]
  );

  const safeTotal = Math.max(0, Number(totalItems) || 0);
  const safeLimit = Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE);
  const safeTotalPages = Math.max(1, Number(totalPages) || Math.ceil(safeTotal / safeLimit) || 1);
  const safeCurrentPage = Math.min(Math.max(1, Number(currentPage) || 1), safeTotalPages);

  const pageNumbers = useMemo(
    () => buildPageNumbers(safeCurrentPage, safeTotalPages),
    [safeCurrentPage, safeTotalPages]
  );

  // Hide completely when empty or when total records fit within the smallest page size option
  if (safeTotal === 0 || (safeTotal <= minPageSize && safeTotalPages <= 1)) {
    return null;
  }

  const startItem = (safeCurrentPage - 1) * safeLimit + 1;
  const endItem = Math.min(safeTotal, safeCurrentPage * safeLimit);

  const goToPage = (targetPage) => {
    const clamped = Math.min(Math.max(1, targetPage), safeTotalPages);
    if (clamped === safeCurrentPage || typeof onPageChange !== 'function') return;
    onPageChange(clamped);
    if (scrollTargetRef?.current && typeof scrollTargetRef.current.scrollIntoView === 'function') {
      scrollTargetRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSizeChange = (e) => {
    const nextSize = Number(e.target.value);
    if (!Number.isFinite(nextSize) || nextSize <= 0 || typeof onPageSizeChange !== 'function') {
      return;
    }
    onPageSizeChange(nextSize);
  };

  const btnBase =
    'inline-flex items-center justify-center h-8 min-w-[2rem] px-2.5 text-xs font-semibold rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-brand-primary/30 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none';
  const btnDefault =
    'border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark text-slate-700 dark:text-slate-200 hover:bg-[#FFF9F2] dark:hover:bg-slate-800';
  const btnActive =
    'border-[#E05D38] bg-[#E05D38] text-white shadow-warm-xs dark:border-[#E05D38] dark:bg-[#E05D38]';

  return (
    <div
      ref={containerRef}
      id={id}
      data-testid={testIdPrefix}
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 mt-4 border-t border-surface-light-border dark:border-surface-dark-border text-xs ${className}`}
    >
      {/* Left: Rows per page + Showing X–Y of Z */}
      <div className="flex flex-wrap items-center gap-3 text-slate-600 dark:text-slate-400">
        {typeof onPageSizeChange === 'function' && (
          <label className="inline-flex items-center gap-2">
            <span className="font-medium text-slate-500 dark:text-slate-400">Rows per page:</span>
            <select
              value={safeLimit}
              onChange={handleSizeChange}
              aria-label="Rows per page"
              data-testid={`${testIdPrefix}-page-size`}
              className="px-2.5 py-1 text-xs font-semibold rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        )}

        <span data-testid={`${testIdPrefix}-summary`} className="font-medium">
          Showing{' '}
          <strong className="text-slate-900 dark:text-slate-100">
            {startItem}–{endItem}
          </strong>{' '}
          of <strong className="text-slate-900 dark:text-slate-100">{safeTotal}</strong> {itemLabel}
        </span>
      </div>

      {/* Right: Page navigation controls (hidden on single page of results) */}
      {safeTotalPages > 1 && (
        <nav
          aria-label="Pagination"
          className="flex flex-wrap items-center gap-1.5"
        >
          <button
            type="button"
            onClick={() => goToPage(1)}
            disabled={safeCurrentPage <= 1}
            aria-label="First page"
            title="First page"
            data-testid={`${testIdPrefix}-first`}
            className={`${btnBase} ${btnDefault} px-2`}
          >
            <ChevronsLeft className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => goToPage(safeCurrentPage - 1)}
            disabled={safeCurrentPage <= 1}
            aria-label="Previous page"
            data-testid={`${testIdPrefix}-prev`}
            className={`${btnBase} ${btnDefault} gap-1`}
          >
            <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Previous</span>
          </button>

          <div className="flex items-center gap-1">
            {pageNumbers.map((item, idx) =>
              item === '...' ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-1.5 text-slate-400 dark:text-slate-500 select-none"
                  aria-hidden="true"
                >
                  ...
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => goToPage(item)}
                  aria-label={`Page ${item}`}
                  aria-current={item === safeCurrentPage ? 'page' : undefined}
                  data-testid={`${testIdPrefix}-page-${item}`}
                  className={`${btnBase} ${item === safeCurrentPage ? btnActive : btnDefault}`}
                >
                  {item}
                </button>
              )
            )}
          </div>

          <button
            type="button"
            onClick={() => goToPage(safeCurrentPage + 1)}
            disabled={safeCurrentPage >= safeTotalPages}
            aria-label="Next page"
            data-testid={`${testIdPrefix}-next`}
            className={`${btnBase} ${btnDefault} gap-1`}
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => goToPage(safeTotalPages)}
            disabled={safeCurrentPage >= safeTotalPages}
            aria-label="Last page"
            title="Last page"
            data-testid={`${testIdPrefix}-last`}
            className={`${btnBase} ${btnDefault} px-2`}
          >
            <ChevronsRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </nav>
      )}
    </div>
  );
}
