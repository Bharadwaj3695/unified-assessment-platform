import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../hooks/useAuth';
import { useRefresh } from '../../hooks/useRefresh';
import useDebounce from '../../hooks/useDebounce';
import certificateService from '../../services/certificate.service';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import TableSkeleton from '../../components/ui/TableSkeleton';
import Pagination, { PaginationJumpLink } from '../../components/ui/Pagination';
import { DEFAULT_PAGE_SIZE, normalizePagination } from '../../utils/pagination';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from '../../components/ui/Table';
import { formatDate, formatDateTime } from '../../utils/formatters';
import {
  Award,
  Download,
  Search,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Copy,
  Check,
  List,
  LayoutGrid,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  FileCheck2,
  Sparkles,
} from 'lucide-react';

/**
 * Student Portal: My Certifications Page
 * Displays institutional credential awards and certificates belonging to the authenticated student.
 */
const StudentCertifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [certificates, setCertificates] = useState([]);
  const [totalAll, setTotalAll] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('table');
  const [selectedCertForModal, setSelectedCertForModal] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
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

  // Set document title
  useEffect(() => {
    document.title = 'My Certificates | Unified Assessment Platform';
  }, []);

  // Fetch student certificates from backend
  const fetchCertificates = useCallback(async (isManual = false) => {
    if (!isManual) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const params = { page, limit };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const response = await certificateService.getMyCertificatesPaginated(params);
      const list = Array.isArray(response)
        ? response
        : response?.data || response?.certificates || [];
      setCertificates(list);
      const norm = normalizePagination(response?.pagination, {
        page,
        limit,
        total: list.length,
      });
      setPagination(norm);
      setTotalAll(
        typeof response?.totalAll === 'number' ? response.totalAll : norm.total
      );
    } catch (err) {
      console.error('[StudentCertifications] Failed to load certificates:', err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Failed to load your certificates. Please check your network connection.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, statusFilter, debouncedSearch]);

  const { isRefreshing, refresh: handleRefresh } = useRefresh(
    () => fetchCertificates(true),
    { successMessage: 'Certificates refreshed successfully!' }
  );

  useEffect(() => {
    fetchCertificates(false).catch(() => {});
  }, [fetchCertificates]);

  // Copy certificate ID or verification token to clipboard
  const handleCopy = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Certificate ID copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Download action with format support (pdf | png | jpg)
  const handleDownload = async (cert, format = 'pdf') => {
    const certId = cert._id || cert.id || cert.certificateId;
    const downloadKey = `${certId}:${format}`;
    setDownloadingId(downloadKey);
    try {
      const ext = format === 'jpeg' ? 'jpg' : format;
      const filename = `${cert.certificateId || 'Certificate'}.${ext}`;
      await certificateService.downloadCertificate(certId, filename, format);
      toast.success(`Certificate (${ext.toUpperCase()}) downloaded`);
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.message ||
          'Unable to process certificate download'
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const filteredCertificates = certificates;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          {/* Relevant navigation section context heading */}
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Assessment & Certification
            </span>
            <span className="text-slate-300 dark:text-slate-600">/</span>
            <span className="text-xs font-medium text-brand-primary dark:text-brand-peach">
              Credentials
            </span>
          </div>
          {/* Required page title */}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <span>My Certificates</span>
            <span className="inline-flex items-center justify-center p-1.5 rounded-xl bg-[#FDF1EC] dark:bg-[#341C16] text-[#E05D38] dark:text-[#F4A261]">
              <Award className="w-5 h-5" aria-hidden="true" />
            </span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
            Official certificates earned from finalized, qualifying assessments.
          </p>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            isLoading={isRefreshing}
            loadingText="Refreshing..."
            icon={RefreshCw}
            iconClassName={isRefreshing ? 'animate-spin' : ''}
            title="Refresh Certificates"
            aria-label={isRefreshing ? 'Refreshing certificates' : 'Refresh certificates'}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/student/catalog')}
            icon={FileCheck2}
          >
            My Assessments
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <Card>
          <div className="p-4">
            <TableSkeleton rows={4} columns={5} />
          </div>
        </Card>
      ) : error ? (
        <ErrorState
          title="Could not load certifications"
          message={error}
          onRetry={fetchCertificates}
        />
      ) : totalAll === 0 && !debouncedSearch.trim() && statusFilter === 'all' ? (
        /* Empty State strictly matching specified requirements */
        <EmptyState
          icon={Award}
          title="No certificates earned yet."
          description="Complete an eligible assessment and meet its certification requirements to earn a certificate."
          actionLabel="View Assessments"
          onAction={() => navigate('/student/catalog')}
        />
      ) : (
        /* Populated Certificates View */
        <div ref={listTopRef} className="space-y-4">
          {/* Search, Filter, and View Controls */}
          <Card className="p-3.5 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by title, assessment, or certificate ID..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Search certificates"
                  className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-slate-50 dark:bg-surface-dark-muted text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>

              {/* Status and View Toggle */}
              <div className="flex items-center space-x-2 flex-wrap">
                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-slate-50 dark:bg-surface-dark-muted text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-primary cursor-pointer"
                  aria-label="Filter by certificate status"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="revoked">Revoked</option>
                </select>

                <PaginationJumpLink
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  targetRef={paginationRef}
                />

                {/* View Mode Toggle */}
                <div className="flex items-center space-x-1 border border-surface-light-border dark:border-surface-dark-border rounded-xl p-1 bg-slate-50 dark:bg-surface-dark-muted">
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all cursor-pointer ${
                      viewMode === 'table'
                        ? 'bg-white dark:bg-surface-dark text-slate-900 dark:text-slate-100 shadow-warm-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                    title="Table View"
                    aria-label="Table View"
                  >
                    <List className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Table</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all cursor-pointer ${
                      viewMode === 'grid'
                        ? 'bg-white dark:bg-surface-dark text-slate-900 dark:text-slate-100 shadow-warm-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                    title="Cards View"
                    aria-label="Cards View"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Cards</span>
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* If search query filters out all records */}
          {filteredCertificates.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-surface-light-border dark:border-surface-dark-border bg-white/70 dark:bg-surface-dark/40">
              <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                No matching certificates found
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Try adjusting your search criteria or filter.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setPage(1);
                }}
              >
                Clear Filters
              </Button>
            </div>
          ) : viewMode === 'table' ? (
            /* Structured Data Table View */
            <div className="w-full overflow-x-auto rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark shadow-warm-xs">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader className="min-w-[200px]">Certificate Title</TableHeader>
                    <TableHeader className="min-w-[160px]">Exam / Course</TableHeader>
                    <TableHeader className="min-w-[140px]">Student</TableHeader>
                    <TableHeader className="min-w-[150px]">Certificate ID</TableHeader>
                    <TableHeader className="min-w-[115px]">Issue Date</TableHeader>
                    <TableHeader className="min-w-[110px]">Verification</TableHeader>
                    <TableHeader className="text-right min-w-[240px]">Downloads</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredCertificates.map((cert) => {
                    const certId = cert._id || cert.id || cert.certificateId;
                    const isCopied = copiedId === certId;
                    const isRevoked = cert.status === 'revoked';

                    return (
                      <TableRow key={certId} hoverEffect>
                        {/* Certificate Title */}
                        <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                          <div className="flex items-start space-x-2.5">
                            <div className="p-2 rounded-xl bg-[#FDF1EC] dark:bg-[#341C16] text-[#E05D38] dark:text-[#F4A261] flex-shrink-0 mt-0.5">
                              <Award className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 dark:text-slate-100 truncate text-sm">
                                {cert.title || cert.certificateTitle || 'Certificate of Completion'}
                              </p>
                              {typeof cert.percentage === 'number' && (
                                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {cert.grade ? `${cert.grade} · ` : ''}{cert.percentage}%
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Assessment Name */}
                        <TableCell>
                          <p className="text-sm text-slate-800 dark:text-slate-200 line-clamp-2">
                            {cert.assessmentName || cert.assessmentTitle || 'Assessment'}
                          </p>
                        </TableCell>

                        {/* Student Name */}
                        <TableCell>
                          <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                            {cert.studentName || user?.name || 'Student'}
                          </p>
                          {cert.studentIdNumber && (
                            <span className="text-[10px] font-mono text-slate-400">
                              {cert.studentIdNumber}
                            </span>
                          )}
                        </TableCell>

                        {/* Certificate ID */}
                        <TableCell>
                          <div className="flex items-center space-x-1.5 font-mono text-xs text-slate-700 dark:text-slate-300">
                            <span className="truncate max-w-[120px] font-semibold" title={cert.certificateId}>
                              {cert.certificateId}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(cert.certificateId, certId)}
                              className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                              title="Copy Certificate ID"
                              aria-label="Copy Certificate ID"
                            >
                              {isCopied ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </TableCell>

                        {/* Issue Date */}
                        <TableCell>
                          <div className="flex items-center space-x-1.5 text-xs text-slate-600 dark:text-slate-400">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span>{formatDate(cert.issuedAt)}</span>
                          </div>
                        </TableCell>

                        {/* Verification Status */}
                        <TableCell>
                          <Badge
                            variant={isRevoked ? 'error' : 'success'}
                            size="sm"
                            dot
                          >
                            {isRevoked ? 'Revoked' : 'Verified'}
                          </Badge>
                        </TableCell>

                        {/* Multi-format Download Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            {['pdf', 'png', 'jpg'].map((fmt) => (
                              <Button
                                key={fmt}
                                variant={fmt === 'pdf' ? 'outline' : 'ghost'}
                                size="sm"
                                icon={fmt === 'pdf' ? Download : undefined}
                                isLoading={downloadingId === `${certId}:${fmt}`}
                                disabled={isRevoked}
                                onClick={() => handleDownload(cert, fmt)}
                                data-testid={`btn-cert-download-${fmt}-${certId}`}
                                title={
                                  isRevoked
                                    ? 'Revoked certificate cannot be downloaded'
                                    : `Download ${fmt.toUpperCase()}`
                                }
                              >
                                {fmt.toUpperCase()}
                              </Button>
                            ))}
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={ExternalLink}
                              onClick={() => setSelectedCertForModal(cert)}
                              title="Preview Certificate"
                              aria-label="Preview Certificate"
                              data-testid={`btn-cert-preview-${certId}`}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            /* Responsive Grid / Cards View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCertificates.map((cert) => {
                const certId = cert._id || cert.id || cert.certificateId;
                const isCopied = copiedId === certId;
                const isRevoked = cert.status === 'revoked';

                return (
                  <Card
                    key={certId}
                    hoverEffect
                    className="flex flex-col justify-between border-t-4 border-t-brand-primary"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant={isRevoked ? 'error' : 'success'} size="sm" dot>
                          {isRevoked ? 'Revoked' : 'Verified'}
                        </Badge>
                        {cert.grade && (
                          <Badge
                            variant={
                              cert.grade.startsWith('A')
                                ? 'success'
                                : cert.grade.startsWith('B')
                                ? 'secondary'
                                : 'neutral'
                            }
                            size="sm"
                          >
                            Grade: {cert.grade}
                          </Badge>
                        )}
                      </div>

                      {/* Certificate Title */}
                      <div className="flex items-start space-x-2.5 mb-2">
                        <div className="p-2 rounded-xl bg-[#FDF1EC] dark:bg-[#341C16] text-[#E05D38] dark:text-[#F4A261] flex-shrink-0 mt-0.5">
                          <Award className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug">
                            {cert.title || cert.certificateTitle || 'Certificate of Completion'}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                            {cert.assessmentName || cert.assessmentTitle}
                          </p>
                        </div>
                      </div>

                      {/* Academic & Verification Info */}
                      <div className="mt-4 space-y-2 py-3 border-y border-surface-light-border dark:border-surface-dark-border text-xs">
                        <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                          <span>Student:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {cert.studentName || user?.name || 'Student'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                          <span>Certificate ID:</span>
                          <div className="flex items-center space-x-1 font-mono font-semibold text-slate-800 dark:text-slate-200">
                            <span>{cert.certificateId}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(cert.certificateId, certId)}
                              className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                              title="Copy"
                            >
                              {isCopied ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                          <span>Issue Date:</span>
                          <span className="text-slate-700 dark:text-slate-300">
                            {formatDate(cert.issuedAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="pt-4 flex items-center justify-between gap-2 mt-2 flex-wrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedCertForModal(cert)}
                        className="text-xs"
                      >
                        Preview
                      </Button>
                      <div className="flex items-center gap-1">
                        {['pdf', 'png', 'jpg'].map((fmt) => (
                          <Button
                            key={fmt}
                            variant={fmt === 'pdf' ? 'primary' : 'outline'}
                            size="sm"
                            isLoading={downloadingId === `${certId}:${fmt}`}
                            disabled={isRevoked}
                            onClick={() => handleDownload(cert, fmt)}
                          >
                            {fmt.toUpperCase()}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
          {filteredCertificates.length > 0 && (
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
              itemLabel="certificates"
              testIdPrefix="certificates-pagination"
            />
          )}
        </div>
      )}

      {/* Certificate Preview & Detail Modal */}
      {selectedCertForModal && (
        <Modal
          isOpen={Boolean(selectedCertForModal)}
          onClose={() => setSelectedCertForModal(null)}
          title="Certificate Preview & Details"
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4">
            {/* Visual Certificate Preview */}
            <div
              className="p-6 rounded-2xl bg-gradient-to-br from-[#FFF9F2] via-white to-[#FFF4EB] dark:from-[#241712] dark:via-surface-dark dark:to-[#1E2430] border-2 border-[#D4AF37]/70 text-center space-y-2.5 shadow-warm-sm"
              data-testid="certificate-preview-card"
            >
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 block">
                Unified Assessment Platform
              </span>
              <h4 className="font-bold text-lg text-[#B45309] dark:text-[#F4A261] tracking-wide">
                CERTIFICATE OF ACHIEVEMENT
              </h4>
              <p className="text-xs italic text-slate-500 dark:text-slate-400">
                Awarded to
              </p>
              <p className="text-xl font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                {selectedCertForModal.studentName || user?.name}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                for completing{' '}
                <strong className="text-slate-900 dark:text-slate-100">
                  {selectedCertForModal.assessmentName || selectedCertForModal.assessmentTitle}
                </strong>
              </p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {selectedCertForModal.title || selectedCertForModal.certificateTitle}
              </p>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                <span>ID: <strong className="font-mono text-slate-700 dark:text-slate-200">{selectedCertForModal.certificateId}</strong></span>
                <span>·</span>
                <span>Issued: {formatDate(selectedCertForModal.issuedAt)}</span>
                <span>·</span>
                <Badge
                  variant={selectedCertForModal.status === 'revoked' ? 'error' : 'success'}
                  size="sm"
                  dot
                >
                  {selectedCertForModal.status === 'revoked' ? 'Revoked' : 'Verified'}
                </Badge>
              </div>
            </div>

            {/* Academic Snapshot Metadata Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border">
                <span className="text-slate-400 block mb-0.5">Student Name:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedCertForModal.studentName || user?.name}
                </span>
                {selectedCertForModal.studentIdNumber && (
                  <span className="block text-[11px] text-slate-500 font-mono mt-0.5">
                    ID: {selectedCertForModal.studentIdNumber}
                  </span>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border">
                <span className="text-slate-400 block mb-0.5">Evaluation Outcome:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedCertForModal.grade || 'Passed'}
                  {selectedCertForModal.percentage !== null && ` (${selectedCertForModal.percentage}%)`}
                </span>
                {selectedCertForModal.score !== undefined && (
                  <span className="block text-[11px] text-slate-500 mt-0.5">
                    Score: {selectedCertForModal.score} / {selectedCertForModal.totalPoints || 100}
                  </span>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border">
                <span className="text-slate-400 block mb-0.5">Certificate ID:</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 break-all">
                  {selectedCertForModal.certificateId}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border">
                <span className="text-slate-400 block mb-0.5">Issue Date:</span>
                <span className="text-slate-800 dark:text-slate-200">
                  {formatDateTime(selectedCertForModal.issuedAt)}
                </span>
              </div>
            </div>

            {/* Verification Code Box */}
            {selectedCertForModal.verificationCode && (
              <div className="p-3 rounded-xl bg-[#FCF8F3] dark:bg-surface-dark-muted/80 border border-brand-peach/20 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Verification Code
                  </span>
                  <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {selectedCertForModal.verificationCode}
                  </span>
                </div>
                <div className="flex items-center space-x-1.5 self-end sm:self-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Copy}
                    onClick={() => handleCopy(selectedCertForModal.verificationCode, 'modal-verify')}
                  >
                    Copy Code
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={ExternalLink}
                    onClick={() =>
                      window.open(
                        `/verify/${encodeURIComponent(selectedCertForModal.verificationCode)}`,
                        '_blank',
                        'noopener,noreferrer'
                      )
                    }
                  >
                    Verify Online
                  </Button>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex flex-wrap justify-between items-center gap-2 pt-2 border-t border-surface-light-border dark:border-surface-dark-border">
              <Button variant="outline" size="sm" onClick={() => setSelectedCertForModal(null)}>
                Close
              </Button>
              <div className="flex items-center gap-1.5">
                {['pdf', 'png', 'jpg'].map((fmt) => {
                  const modalCertId =
                    selectedCertForModal._id || selectedCertForModal.id || selectedCertForModal.certificateId;
                  return (
                    <Button
                      key={fmt}
                      variant={fmt === 'pdf' ? 'primary' : 'outline'}
                      size="sm"
                      icon={Download}
                      isLoading={downloadingId === `${modalCertId}:${fmt}`}
                      disabled={selectedCertForModal.status === 'revoked'}
                      onClick={() => handleDownload(selectedCertForModal, fmt)}
                      data-testid={`btn-modal-download-${fmt}`}
                    >
                      Download {fmt.toUpperCase()}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default StudentCertifications;
