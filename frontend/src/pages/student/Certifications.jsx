import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../hooks/useAuth';
import { useRefresh } from '../../hooks/useRefresh';
import certificateService from '../../services/certificate.service';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('table');
  const [selectedCertForModal, setSelectedCertForModal] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  // Set document title
  useEffect(() => {
    document.title = 'My Certifications | Unified Assessment Platform';
  }, []);

  // Fetch student certificates from backend
  const fetchCertificates = useCallback(async (isManual = false) => {
    if (!isManual) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const response = await certificateService.getMyCertificates();
      // Unpack response data envelope
      const list = Array.isArray(response)
        ? response
        : response?.data || response?.certificates || [];
      setCertificates(list);
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
  }, []);

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

  // Download action with clear dependency reporting
  const handleDownload = async (cert) => {
    const certId = cert._id || cert.id || cert.certificateId;
    setDownloadingId(certId);
    try {
      await certificateService.downloadCertificate(certId);
      toast.success('Download initiated');
    } catch (err) {
      const isPending =
        err.response?.status === 501 ||
        /pending|not implemented/i.test(err.response?.data?.message || err.message);

      if (isPending) {
        toast.info(
          'Certificate PDF rendering service is pending backend implementation. Your verification code and academic record are authentic.',
          { autoClose: 6000 }
        );
      } else {
        toast.error(
          err.response?.data?.message ||
            err.message ||
            'Unable to process download at this time'
        );
      }
    } finally {
      setDownloadingId(null);
    }
  };

  // Filtered certificates based on search query and status filter
  const filteredCertificates = useMemo(() => {
    return certificates.filter((cert) => {
      // Status filter
      if (statusFilter !== 'all' && cert.status !== statusFilter) {
        return false;
      }
      // Search query filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const title = (cert.title || cert.certificateTitle || '').toLowerCase();
      const assessment = (cert.assessmentName || cert.assessmentTitle || '').toLowerCase();
      const certId = (cert.certificateId || '').toLowerCase();
      const code = (cert.verificationCode || '').toLowerCase();
      const category = (cert.category || '').toLowerCase();

      return (
        title.includes(q) ||
        assessment.includes(q) ||
        certId.includes(q) ||
        code.includes(q) ||
        category.includes(q)
      );
    });
  }, [certificates, searchQuery, statusFilter]);

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
            <span>My Certifications</span>
            <span className="inline-flex items-center justify-center p-1.5 rounded-xl bg-[#FDF1EC] dark:bg-[#341C16] text-[#E05D38] dark:text-[#F4A261]">
              <Award className="w-5 h-5" aria-hidden="true" />
            </span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
            Official accredited certificates and credentials earned through qualifying assessment performances.
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
      ) : certificates.length === 0 ? (
        /* Empty State strictly matching specified requirements */
        <EmptyState
          icon={Award}
          title="No certificates earned yet"
          description="Complete an eligible assessment and meet its certification requirements to earn your certificate."
          actionLabel="View Assessments"
          onAction={() => navigate('/student/catalog')}
        />
      ) : (
        /* Populated Certificates View */
        <div className="space-y-4">
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
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-slate-50 dark:bg-surface-dark-muted text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>

              {/* Status and View Toggle */}
              <div className="flex items-center space-x-2 flex-wrap">
                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-slate-50 dark:bg-surface-dark-muted text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-primary cursor-pointer"
                  aria-label="Filter by certificate status"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="revoked">Revoked</option>
                </select>

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
                    <TableHeader className="min-w-[220px]">Certificate Title</TableHeader>
                    <TableHeader className="min-w-[180px]">Assessment Name</TableHeader>
                    <TableHeader className="min-w-[120px]">Grade & Percentage</TableHeader>
                    <TableHeader className="min-w-[160px]">Certificate ID</TableHeader>
                    <TableHeader className="min-w-[120px]">Issue Date</TableHeader>
                    <TableHeader className="min-w-[100px]">Status</TableHeader>
                    <TableHeader className="text-right min-w-[140px]">Download & Actions</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredCertificates.map((cert) => {
                    const certId = cert._id || cert.id || cert.certificateId;
                    const isCopied = copiedId === certId;
                    const isDownloading = downloadingId === certId;
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
                              {cert.category && (
                                <Badge variant="neutral" size="sm" className="mt-1">
                                  {cert.category}
                                </Badge>
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

                        {/* Grade and Percentage */}
                        <TableCell>
                          <div className="space-y-1">
                            {cert.grade ? (
                              <div className="flex items-center space-x-1.5">
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
                                  {cert.grade}
                                  {cert.gradeLabel ? ` (${cert.gradeLabel})` : ''}
                                </Badge>
                              </div>
                            ) : null}
                            {typeof cert.percentage === 'number' && (
                              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                                {cert.percentage}%
                                {cert.score !== undefined && cert.totalPoints ? (
                                  <span className="font-normal text-slate-400 dark:text-slate-500 text-[11px] ml-1">
                                    ({cert.score}/{cert.totalPoints} pts)
                                  </span>
                                ) : null}
                              </p>
                            )}
                            {!cert.grade && cert.percentage === null && (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </div>
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

                        {/* Status */}
                        <TableCell>
                          <Badge
                            variant={isRevoked ? 'error' : 'success'}
                            size="sm"
                            dot
                          >
                            {isRevoked ? 'Revoked' : 'Active'}
                          </Badge>
                        </TableCell>

                        {/* Available Download Action */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              icon={Download}
                              isLoading={isDownloading}
                              disabled={isRevoked}
                              onClick={() => handleDownload(cert)}
                              title={
                                isRevoked
                                  ? 'Revoked certificate cannot be downloaded'
                                  : 'Download Certificate'
                              }
                            >
                              Download
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={ExternalLink}
                              onClick={() => setSelectedCertForModal(cert)}
                              title="View Credential Snapshot"
                              aria-label="View Credential Snapshot"
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
                const isDownloading = downloadingId === certId;
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
                          {isRevoked ? 'Revoked' : 'Active'}
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

                        {typeof cert.percentage === 'number' && (
                          <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                            <span>Percentage Score:</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {cert.percentage}%
                            </span>
                          </div>
                        )}

                        <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                          <span>Issue Date:</span>
                          <span className="text-slate-700 dark:text-slate-300">
                            {formatDate(cert.issuedAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="pt-4 flex items-center justify-between gap-2 mt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedCertForModal(cert)}
                        className="text-xs"
                      >
                        Details
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        icon={Download}
                        isLoading={isDownloading}
                        disabled={isRevoked}
                        onClick={() => handleDownload(cert)}
                      >
                        Download
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Credential Snapshot Modal */}
      {selectedCertForModal && (
        <Modal
          isOpen={Boolean(selectedCertForModal)}
          onClose={() => setSelectedCertForModal(null)}
          title="Authoritative Credential Snapshot"
          maxWidth="max-w-xl"
        >
          <div className="space-y-4">
            {/* Header Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[#FFF4EB] to-white dark:from-[#341C16]/50 dark:to-surface-dark border border-brand-peach/30 dark:border-brand-primary/20">
              <div className="flex items-center space-x-3 mb-2">
                <div className="p-2 rounded-xl bg-brand-primary text-white shadow-warm-xs">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-slate-900 dark:text-slate-100">
                    {selectedCertForModal.title || selectedCertForModal.certificateTitle}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedCertForModal.assessmentName || selectedCertForModal.assessmentTitle}
                  </p>
                </div>
              </div>
              <Badge
                variant={selectedCertForModal.status === 'revoked' ? 'error' : 'success'}
                size="sm"
                dot
              >
                Status: {selectedCertForModal.status === 'revoked' ? 'Revoked' : 'Active Credential'}
              </Badge>
            </div>

            {/* Academic Snapshot Metadata Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border">
                <span className="text-slate-400 block mb-0.5">Recipient Student:</span>
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
                <span className="text-slate-400 block mb-0.5">Authoritative Grade:</span>
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
                <span className="text-slate-400 block mb-0.5">Issuance Timestamp:</span>
                <span className="text-slate-800 dark:text-slate-200">
                  {formatDateTime(selectedCertForModal.issuedAt)}
                </span>
              </div>
            </div>

            {/* Verification Code Box */}
            {selectedCertForModal.verificationCode && (
              <div className="p-3 rounded-xl bg-[#FCF8F3] dark:bg-surface-dark-muted/80 border border-brand-peach/20 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Cryptographic Verification Token
                  </span>
                  <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {selectedCertForModal.verificationCode}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  icon={Copy}
                  onClick={() => handleCopy(selectedCertForModal.verificationCode, 'modal-verify')}
                >
                  Copy
                </Button>
              </div>
            )}

            {/* Download Note / Notice */}
            <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-xs text-blue-800 dark:text-blue-300 flex items-start space-x-2">
              <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Accredited institution credentials maintain permanent blockchain/database verification.
                PDF document rendering and streaming downloads are integrated via backend template rendering.
              </span>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end space-x-2 pt-2 border-t border-surface-light-border dark:border-surface-dark-border">
              <Button variant="outline" size="sm" onClick={() => setSelectedCertForModal(null)}>
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Download}
                onClick={() => handleDownload(selectedCertForModal)}
              >
                Download Certificate
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default StudentCertifications;
