import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../../hooks/useAuth';
import certificateService from '../../services/certificate.service';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
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
  AlertCircle,
  RefreshCw,
  Mail,
  ShieldCheck,
  FileCheck2,
  Copy,
  Check,
  Plus,
  Eye,
  Settings,
  Layers,
  FileText,
  BarChart3,
  Sliders,
  Send,
  XCircle,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

const CertificationStudio = () => {
  const { user } = useAuth();

  // Active top-level Studio tab: 'analytics' | 'templates' | 'registry' | 'settings' | 'editor'
  const [activeTab, setActiveTab] = useState('analytics');

  // Loading states
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Analytics data
  const [analytics, setAnalytics] = useState(null);

  // Templates state
  const [templates, setTemplates] = useState([]);
  const [templateFilter, setTemplateFilter] = useState('all');

  // Registry state
  const [certificates, setCertificates] = useState([]);
  const [registryPagination, setRegistryPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [emailFilter, setEmailFilter] = useState('all');

  // Modals state
  const [selectedCert, setSelectedCert] = useState(null);
  const [revokeCertTarget, setRevokeCertTarget] = useState(null);
  const [revocationReason, setRevocationReason] = useState('');
  const [isRevoking, setIsRevoking] = useState(false);

  // Template Editor State
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({
    title: '',
    description: '',
    orientation: 'landscape',
    pageSize: 'A4',
    status: 'draft',
    isDefault: false,
    canvas: {
      backgroundColor: '#FFFFFF',
      borderStyle: 'classic-gold',
      borderColor: '#D4AF37',
      borderWidth: 8,
    },
    branding: {
      institutionName: 'Unified Assessment Platform',
      signatoryName: 'Dr. Jane Smith',
      signatoryTitle: 'Dean of Academic Affairs',
    },
  });
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isPreviewingPdf, setIsPreviewingPdf] = useState(false);

  // Settings State
  const [settingsForm, setSettingsForm] = useState({
    institutionName: 'Unified Assessment Platform',
    institutionLogoUrl: '',
    institutionSealUrl: '',
    defaultSignatoryName: 'Dr. Jane Smith',
    defaultSignatoryTitle: 'Dean of Academic Affairs',
    defaultSignatorySignatureUrl: '',
    autoEmailCertificates: true,
    includePdfAttachment: true,
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Action states for table items
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);

  // Set document title
  useEffect(() => {
    document.title = 'Certification Studio | Admin Console | UAP';
  }, []);

  // Fetch initial analytics and settings
  const fetchAnalytics = useCallback(async () => {
    try {
      const data = await certificateService.getAnalytics();
      setAnalytics(data);
    } catch (err) {
      console.warn('[CertificationStudio] Failed to load analytics:', err.message);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const filter = templateFilter === 'all' ? {} : { status: templateFilter };
      const data = await certificateService.getTemplates(filter);
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error('Failed to load certificate templates');
    }
  }, [templateFilter]);

  const fetchRegistry = useCallback(async (page = 1) => {
    try {
      const data = await certificateService.getAllCertificatesAdmin({
        search: searchQuery,
        status: statusFilter,
        emailStatus: emailFilter,
        page,
        limit: 10,
      });
      setCertificates(data.certificates || []);
      setRegistryPagination({
        page: data.page || 1,
        limit: data.limit || 10,
        total: data.total || 0,
        totalPages: data.totalPages || 1,
      });
    } catch (err) {
      toast.error('Failed to load certificates registry');
    }
  }, [searchQuery, statusFilter, emailFilter]);

  const fetchSettings = useCallback(async () => {
    try {
      const data = await certificateService.getSettings();
      if (data && typeof data === 'object') {
        setSettingsForm((prev) => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.warn('[CertificationStudio] Failed to load settings:', err.message);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchAnalytics(), fetchTemplates(), fetchRegistry(1), fetchSettings()]);
      setLoading(false);
    };
    init();
  }, [fetchAnalytics, fetchTemplates, fetchRegistry, fetchSettings]);

  // Tab switch refresher
  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    if (tab === 'analytics') fetchAnalytics();
    if (tab === 'templates') fetchTemplates();
    if (tab === 'registry') fetchRegistry(1);
    if (tab === 'settings') fetchSettings();
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchAnalytics(), fetchTemplates(), fetchRegistry(registryPagination.page)]);
    setIsRefreshing(false);
    toast.success('Certification data refreshed');
  };

  // Copy helper
  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Open Template Editor (create or edit)
  const handleOpenEditor = (template = null) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateForm({
        title: template.title || '',
        description: template.description || '',
        orientation: template.orientation || 'landscape',
        pageSize: template.pageSize || 'A4',
        status: template.status || 'draft',
        isDefault: Boolean(template.isDefault),
        canvas: {
          backgroundColor: template.canvas?.backgroundColor || '#FFFFFF',
          borderStyle: template.canvas?.borderStyle || 'classic-gold',
          borderColor: template.canvas?.borderColor || '#D4AF37',
          borderWidth: template.canvas?.borderWidth || 8,
        },
        branding: {
          institutionName: template.branding?.institutionName || settingsForm.institutionName || 'Unified Assessment Platform',
          signatoryName: template.branding?.signatoryName || settingsForm.defaultSignatoryName || '',
          signatoryTitle: template.branding?.signatoryTitle || settingsForm.defaultSignatoryTitle || 'Dean of Academic Affairs',
        },
      });
    } else {
      setEditingTemplate(null);
      setTemplateForm({
        title: '',
        description: '',
        orientation: 'landscape',
        pageSize: 'A4',
        status: 'draft',
        isDefault: false,
        canvas: {
          backgroundColor: '#FFFFFF',
          borderStyle: 'classic-gold',
          borderColor: '#D4AF37',
          borderWidth: 8,
        },
        branding: {
          institutionName: settingsForm.institutionName || 'Unified Assessment Platform',
          signatoryName: settingsForm.defaultSignatoryName || 'Dr. Jane Smith',
          signatoryTitle: settingsForm.defaultSignatoryTitle || 'Dean of Academic Affairs',
        },
      });
    }
    setActiveTab('editor');
  };

  // Save template
  const handleSaveTemplate = async () => {
    if (!templateForm.title || templateForm.title.trim().length < 3) {
      toast.error('Template title must be at least 3 characters');
      return;
    }

    try {
      setIsSavingTemplate(true);
      if (editingTemplate) {
        await certificateService.updateTemplate(editingTemplate._id, templateForm);
        toast.success('Certificate template updated successfully (version incremented)');
      } else {
        await certificateService.createTemplate(templateForm);
        toast.success('Certificate template created successfully');
      }
      await fetchTemplates();
      setActiveTab('templates');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to save template');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  // Set default template
  const handleSetDefaultTemplate = async (templateId) => {
    try {
      await certificateService.setDefaultTemplate(templateId);
      toast.success('Template designated as institutional default');
      await fetchTemplates();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to set default template');
    }
  };

  // Download real preview PDF from server
  const handleDownloadPreviewPdf = async () => {
    try {
      setIsPreviewingPdf(true);
      const blob = await certificateService.previewTemplate(templateForm);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${templateForm.title.replace(/\s+/g, '_')}_Preview.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      toast.success('Preview PDF downloaded');
    } catch (err) {
      toast.error('Failed to generate preview PDF');
    } finally {
      setIsPreviewingPdf(false);
    }
  };

  // Save Institutional Settings
  const handleSaveSettings = async () => {
    try {
      setIsSavingSettings(true);
      await certificateService.updateSettings(settingsForm);
      toast.success('Institutional certification settings saved');
    } catch (err) {
      toast.error('Failed to update certification settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Download issued certificate PDF
  const handleDownloadCertificate = async (cert) => {
    const certId = cert._id || cert.certificateId;
    setActionLoadingId(`download-${certId}`);
    try {
      await certificateService.downloadCertificate(certId, `${cert.certificateId}.pdf`);
      toast.success('Certificate PDF downloaded');
    } catch (err) {
      toast.error('Failed to download certificate PDF');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Retry Email Delivery
  const handleRetryEmail = async (certId) => {
    setActionLoadingId(`email-${certId}`);
    try {
      const res = await certificateService.retryEmail(certId);
      if (res.success) {
        toast.success('Email re-sent successfully');
      } else {
        toast.warn('Email dispatch failed during attempt');
      }
      await fetchRegistry(registryPagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to retry email delivery');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Retry Issuance
  const handleRetryIssuance = async (certId) => {
    setActionLoadingId(`issue-${certId}`);
    try {
      await certificateService.retryIssuance(certId);
      toast.success('Certificate re-issued successfully');
      await fetchRegistry(registryPagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to retry issuance');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Confirm Revocation
  const handleRevokeSubmit = async () => {
    if (!revocationReason || revocationReason.trim().length < 3) {
      toast.error('Revocation reason is mandatory and must be at least 3 characters');
      return;
    }

    try {
      setIsRevoking(true);
      await certificateService.revokeCertificate(revokeCertTarget._id, revocationReason.trim());
      toast.success('Certificate revoked and logged to AuditLog');
      setRevokeCertTarget(null);
      setRevocationReason('');
      await Promise.all([fetchRegistry(registryPagination.page), fetchAnalytics()]);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to revoke certificate');
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Platform Administration
            </span>
            <span className="text-slate-300 dark:text-slate-600">/</span>
            <span className="text-xs font-medium text-brand-primary dark:text-brand-peach">
              Certification Studio
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <span>Certification Studio</span>
            <span className="inline-flex items-center justify-center p-1.5 rounded-xl bg-[#FDF1EC] dark:bg-[#341C16] text-[#E05D38] dark:text-[#F4A261]">
              <Award className="w-5 h-5" />
            </span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
            Authoritative certificate templates, institutional branding, automated issuance tracking, and credential revocation.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            isLoading={isRefreshing}
            icon={RefreshCw}
            iconClassName={isRefreshing ? 'animate-spin' : ''}
            title="Refresh Studio Data"
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleOpenEditor()}
            icon={Plus}
          >
            New Template
          </Button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center space-x-1 border-b border-surface-light-border dark:border-surface-dark-border overflow-x-auto pb-px">
        <button
          type="button"
          onClick={() => handleTabSwitch('analytics')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'analytics'
              ? 'border-brand-primary text-brand-primary dark:text-brand-peach'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Dashboard & Analytics</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabSwitch('templates')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'templates'
              ? 'border-brand-primary text-brand-primary dark:text-brand-peach'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Certificate Templates ({templates.length})</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabSwitch('registry')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'registry'
              ? 'border-brand-primary text-brand-primary dark:text-brand-peach'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <FileCheck2 className="w-4 h-4" />
          <span>Issued Registry ({registryPagination.total})</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabSwitch('settings')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'settings'
              ? 'border-brand-primary text-brand-primary dark:text-brand-peach'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Institutional Settings</span>
        </button>

        {activeTab === 'editor' && (
          <button
            type="button"
            className="flex items-center space-x-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 border-brand-primary text-brand-primary dark:text-brand-peach whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4" />
            <span>{editingTemplate ? `Editing: ${editingTemplate.title}` : 'New Template Builder'}</span>
          </button>
        )}
      </div>

      {/* Main Studio Views */}
      {loading ? (
        <Card className="p-6">
          <TableSkeleton rows={4} columns={4} />
        </Card>
      ) : activeTab === 'analytics' ? (
        /* TAB 1: Analytics & Metrics */
        <div className="space-y-6">
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 border-l-4 border-l-brand-primary">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">Total Issued</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                    {analytics?.overview?.totalCertificates || 0}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-orange-50 text-brand-primary dark:bg-orange-950/40">
                  <Award className="w-6 h-6" />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">Accredited institutional awards</p>
            </Card>

            <Card className="p-4 border-l-4 border-l-emerald-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">Active Credentials</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">
                    {analytics?.overview?.activeCertificates || 0}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">Tamper-evident verified records</p>
            </Card>

            <Card className="p-4 border-l-4 border-l-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">Email Delivery Rate</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">
                    {analytics?.overview?.emailDeliveryRate || 0}%
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40">
                  <Mail className="w-6 h-6" />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                {analytics?.emailDelivery?.sent || 0} delivered / {analytics?.emailDelivery?.failed || 0} failed
              </p>
            </Card>

            <Card className="p-4 border-l-4 border-l-rose-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">Revoked</p>
                  <p className="text-2xl font-bold text-rose-600 mt-1">
                    {analytics?.overview?.revokedCertificates || 0}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40">
                  <XCircle className="w-6 h-6" />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">Administrative integrity actions</p>
            </Card>
          </div>

          {/* Quick Overview Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Certified Assessments */}
            <Card className="p-5">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-3 flex items-center justify-between">
                <span>Top Certified Assessments</span>
                <Badge variant="neutral" size="sm">Authoritative</Badge>
              </h3>
              {(!analytics?.topAssessments || analytics.topAssessments.length === 0) ? (
                <p className="text-xs text-slate-400 py-4 text-center">No certifications issued yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {analytics.topAssessments.map((asmt, idx) => (
                    <div
                      key={asmt._id || idx}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border text-xs"
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {asmt.title || 'Untitled Assessment'}
                        </p>
                        <p className="text-[11px] text-slate-400">{asmt.category || 'General'}</p>
                      </div>
                      <Badge variant="primary" size="sm">
                        {asmt.count} awarded
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Template Status & Email Delivery Summary */}
            <Card className="p-5 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-3">
                  Studio Operational Overview
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border">
                    <span className="text-slate-400 block mb-0.5">Published Templates</span>
                    <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                      {analytics?.templates?.published || 0}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border">
                    <span className="text-slate-400 block mb-0.5">Draft Templates</span>
                    <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                      {analytics?.templates?.draft || 0}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FFF8F5] dark:bg-surface-dark-muted/80 border border-orange-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                  <p className="font-semibold text-[#9A3412] dark:text-orange-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    Automatic Issuance Guardrails Active
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Students automatically receive credentials when evaluations are finalized with percentage meeting assessment threshold.
                  </p>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end space-x-2 border-t border-surface-light-border dark:border-surface-dark-border mt-4">
                <Button variant="outline" size="sm" onClick={() => handleTabSwitch('templates')}>
                  Manage Templates
                </Button>
                <Button variant="primary" size="sm" onClick={() => handleTabSwitch('registry')}>
                  View Registry
                </Button>
              </div>
            </Card>
          </div>
        </div>
      ) : activeTab === 'templates' ? (
        /* TAB 2: Certificate Templates Management */
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <select
                  value={templateFilter}
                  onChange={(e) => setTemplateFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs sm:text-sm rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-slate-50 dark:bg-surface-dark-muted text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                >
                  <option value="all">All Templates ({templates.length})</option>
                  <option value="published">Published</option>
                  <option value="draft">Drafts</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <Button variant="primary" size="sm" icon={Plus} onClick={() => handleOpenEditor()}>
                Create Template
              </Button>
            </div>
          </Card>

          {templates.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No certificate templates found"
              description="Create an institutional default template or custom assessment layouts."
              actionLabel="Create First Template"
              onAction={() => handleOpenEditor()}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((tpl) => {
                const isDefault = Boolean(tpl.isDefault);
                const isPublished = tpl.status === 'published';

                return (
                  <Card
                    key={tpl._id || tpl.id}
                    hoverEffect
                    className={`flex flex-col justify-between border-t-4 ${
                      isDefault ? 'border-t-brand-primary ring-2 ring-brand-primary/20' : 'border-t-slate-400'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-1.5">
                          <Badge
                            variant={
                              tpl.status === 'published'
                                ? 'success'
                                : tpl.status === 'draft'
                                ? 'warning'
                                : 'neutral'
                            }
                            size="sm"
                            dot
                          >
                            {tpl.status.toUpperCase()}
                          </Badge>
                          <Badge variant="neutral" size="sm">
                            v{tpl.version || 1}
                          </Badge>
                        </div>
                        {isDefault && (
                          <Badge variant="primary" size="sm" className="font-semibold">
                            Default
                          </Badge>
                        )}
                      </div>

                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug">
                        {tpl.title}
                      </h3>
                      {tpl.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                          {tpl.description}
                        </p>
                      )}

                      <div className="mt-4 pt-3 border-t border-surface-light-border dark:border-surface-dark-border text-xs space-y-1.5 text-slate-600 dark:text-slate-400">
                        <div className="flex justify-between">
                          <span>Format:</span>
                          <span className="font-semibold capitalize text-slate-800 dark:text-slate-200">
                            {tpl.pageSize || 'A4'} ({tpl.orientation || 'landscape'})
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Border Style:</span>
                          <span className="capitalize text-slate-700 dark:text-slate-300">
                            {tpl.canvas?.borderStyle || 'Classic Gold'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Signatory:</span>
                          <span className="truncate max-w-[150px] text-slate-700 dark:text-slate-300">
                            {tpl.branding?.signatoryName || 'Default Institutional'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 flex items-center justify-between gap-1.5 mt-3 border-t border-surface-light-border dark:border-surface-dark-border">
                      {!isDefault && isPublished && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetDefaultTemplate(tpl._id)}
                          title="Designate as Institutional Fallback Default"
                        >
                          Make Default
                        </Button>
                      )}
                      <div className="flex items-center space-x-1.5 ml-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditor(tpl)}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : activeTab === 'editor' ? (
        /* TAB 3: Template Visual Editor & Real-Time Preview */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Column (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {editingTemplate ? 'Edit Certificate Template' : 'Create Certificate Template'}
                </h3>
                <Badge variant={templateForm.status === 'published' ? 'success' : 'warning'} size="sm">
                  {templateForm.status.toUpperCase()}
                </Badge>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Template Title *
                </label>
                <Input
                  value={templateForm.title}
                  onChange={(e) => setTemplateForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Masterclass Excellence Award"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <Input
                  value={templateForm.description}
                  onChange={(e) => setTemplateForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Usage context or assessment scope"
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Orientation
                  </label>
                  <select
                    value={templateForm.orientation}
                    onChange={(e) => setTemplateForm((p) => ({ ...p, orientation: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-slate-50 dark:bg-surface-dark-muted"
                  >
                    <option value="landscape">Landscape (Recommended)</option>
                    <option value="portrait">Portrait</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Page Size
                  </label>
                  <select
                    value={templateForm.pageSize}
                    onChange={(e) => setTemplateForm((p) => ({ ...p, pageSize: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-slate-50 dark:bg-surface-dark-muted"
                  >
                    <option value="A4">A4 Standard</option>
                    <option value="Letter">US Letter</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Border Style
                  </label>
                  <select
                    value={templateForm.canvas.borderStyle}
                    onChange={(e) =>
                      setTemplateForm((p) => ({
                        ...p,
                        canvas: { ...p.canvas, borderStyle: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-slate-50 dark:bg-surface-dark-muted"
                  >
                    <option value="classic-gold">Classic Gold</option>
                    <option value="modern-slate">Modern Slate</option>
                    <option value="ornate-bronze">Ornate Bronze</option>
                    <option value="minimal-navy">Minimal Navy</option>
                    <option value="none">No Border</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Publication Status
                  </label>
                  <select
                    value={templateForm.status}
                    onChange={(e) => setTemplateForm((p) => ({ ...p, status: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-slate-50 dark:bg-surface-dark-muted"
                  >
                    <option value="draft">Draft (Testing)</option>
                    <option value="published">Published (Active)</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              {/* Branding Overrides */}
              <div className="pt-2 border-t border-surface-light-border dark:border-surface-dark-border space-y-3">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Institutional Branding & Signatory
                </p>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Institution Name
                  </label>
                  <Input
                    value={templateForm.branding.institutionName}
                    onChange={(e) =>
                      setTemplateForm((p) => ({
                        ...p,
                        branding: { ...p.branding, institutionName: e.target.value },
                      }))
                    }
                    placeholder="Institutional Name"
                    className="w-full text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Signatory Name
                    </label>
                    <Input
                      value={templateForm.branding.signatoryName}
                      onChange={(e) =>
                        setTemplateForm((p) => ({
                          ...p,
                          branding: { ...p.branding, signatoryName: e.target.value },
                        }))
                      }
                      placeholder="e.g. Dr. Jane Smith"
                      className="w-full text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Signatory Title
                    </label>
                    <Input
                      value={templateForm.branding.signatoryTitle}
                      onChange={(e) =>
                        setTemplateForm((p) => ({
                          ...p,
                          branding: { ...p.branding, signatoryTitle: e.target.value },
                        }))
                      }
                      placeholder="Dean of Academic Affairs"
                      className="w-full text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-between border-t gap-2">
                <Button variant="outline" size="sm" onClick={() => setActiveTab('templates')}>
                  Cancel
                </Button>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Download}
                    isLoading={isPreviewingPdf}
                    onClick={handleDownloadPreviewPdf}
                  >
                    PDF Preview
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    isLoading={isSavingTemplate}
                    onClick={handleSaveTemplate}
                  >
                    Save Template
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Interactive Live Canvas Column (7 cols) */}
          <div className="lg:col-span-7">
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Eye className="w-4 h-4" />
                  Live Preview Canvas (Dynamic Interpolation)
                </h4>
                <Badge variant="neutral" size="sm">
                  {templateForm.pageSize} {templateForm.orientation}
                </Badge>
              </div>

              {/* Scaled Visual Certificate Canvas */}
              <div
                className="w-full aspect-[1.414/1] bg-white rounded-xl shadow-warm-md p-6 flex flex-col justify-between text-center relative border transition-all select-none overflow-hidden"
                style={{
                  borderColor: templateForm.canvas.borderStyle === 'modern-slate' ? '#475569' : '#D4AF37',
                  borderWidth: templateForm.canvas.borderStyle === 'none' ? '0px' : '6px',
                  borderStyle: 'solid',
                  backgroundColor: templateForm.canvas.backgroundColor || '#FFFFFF',
                }}
              >
                {/* Inner Border */}
                {templateForm.canvas.borderStyle !== 'none' && (
                  <div
                    className="absolute inset-2 border pointer-events-none"
                    style={{
                      borderColor: templateForm.canvas.borderStyle === 'modern-slate' ? '#94A3B8' : '#D4AF37',
                      borderWidth: '1px',
                    }}
                  />
                )}

                {/* Header */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                    {templateForm.branding.institutionName || 'UNIFIED ASSESSMENT PLATFORM'}
                  </p>
                  <div className="w-32 h-0.5 bg-amber-600/40 mx-auto my-1" />
                  <h2 className="text-xl sm:text-2xl font-serif font-bold text-amber-800 tracking-wide mt-2">
                    CERTIFICATE OF ACHIEVEMENT
                  </h2>
                  <p className="text-[10px] text-slate-400 italic mt-0.5">
                    This is proudly and authoritatively presented to
                  </p>
                  <p className="text-lg sm:text-xl font-bold font-serif text-slate-900 mt-2 uppercase tracking-wide">
                    ALEXANDER MERCER
                  </p>
                  <p className="text-[9px] text-slate-400 font-mono">Institutional ID: STU-2026-888</p>
                  <div className="w-48 h-0.5 bg-amber-600/30 mx-auto my-1.5" />
                  <p className="text-[10px] text-slate-500">
                    for satisfying all examination requirements for
                  </p>
                  <p className="text-sm sm:text-base font-bold text-slate-800 mt-0.5">
                    {templateForm.title || 'Course Certificate of Completion'}
                  </p>
                  <p className="text-[9px] text-slate-500 mt-0.5">
                    Score: 94% | Grade: A+ (Outstanding) | Passing Threshold: 60%
                  </p>
                </div>

                {/* Footer Signatures and QR Code */}
                <div className="flex items-end justify-between pt-4 border-t border-slate-100 text-[9px] text-slate-600">
                  <div className="text-left w-36">
                    <div className="border-b border-slate-400 pb-0.5 font-bold text-slate-800">
                      {templateForm.branding.signatoryName || 'Dr. Jane Smith'}
                    </div>
                    <div className="text-slate-400 text-[8px]">
                      {templateForm.branding.signatoryTitle || 'Dean of Academic Affairs'}
                    </div>
                  </div>

                  {/* Simulated Vector QR */}
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-slate-900 text-white rounded p-1 flex items-center justify-center font-mono text-[7px] text-center leading-tight">
                      [ QR ]
                    </div>
                    <span className="font-mono text-[8px] text-slate-500 mt-0.5">CERT-2026-PREVIEW</span>
                  </div>

                  <div className="text-right w-36">
                    <div className="border-b border-slate-400 pb-0.5 font-bold text-slate-800">
                      Prof. David Clark
                    </div>
                    <div className="text-slate-400 text-[8px]">Academic Faculty Lead</div>
                  </div>
                </div>
              </div>

              {/* Dynamic Tokens Cheat Sheet */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border text-xs">
                <p className="font-bold text-slate-700 dark:text-slate-300 text-[11px] mb-1">
                  Supported Dynamic Tokens
                </p>
                <div className="flex flex-wrap gap-1 text-[10px] font-mono text-brand-primary dark:text-brand-peach">
                  <span className="p-1 rounded bg-white dark:bg-surface-dark border">{'{{studentName}}'}</span>
                  <span className="p-1 rounded bg-white dark:bg-surface-dark border">{'{{assessmentTitle}}'}</span>
                  <span className="p-1 rounded bg-white dark:bg-surface-dark border">{'{{grade}}'}</span>
                  <span className="p-1 rounded bg-white dark:bg-surface-dark border">{'{{percentage}}'}</span>
                  <span className="p-1 rounded bg-white dark:bg-surface-dark border">{'{{certificateId}}'}</span>
                  <span className="p-1 rounded bg-white dark:bg-surface-dark border">{'{{signatoryName}}'}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : activeTab === 'registry' ? (
        /* TAB 4: Issued Certificates Registry */
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by student, assessment, or certificate ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-slate-50 dark:bg-surface-dark-muted text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>

              <div className="flex items-center space-x-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-slate-50 dark:bg-surface-dark-muted"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="revoked">Revoked</option>
                </select>

                <select
                  value={emailFilter}
                  onChange={(e) => setEmailFilter(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-slate-50 dark:bg-surface-dark-muted"
                >
                  <option value="all">All Email States</option>
                  <option value="sent">Email Sent</option>
                  <option value="failed">Email Failed</option>
                  <option value="pending">Email Pending</option>
                </select>
              </div>
            </div>
          </Card>

          {certificates.length === 0 ? (
            <EmptyState
              icon={Award}
              title="No certificates found"
              description="No issued certificates matched your search criteria."
            />
          ) : (
            <div className="w-full overflow-x-auto rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark shadow-warm-xs">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>Certificate ID</TableHeader>
                    <TableHeader>Recipient Student</TableHeader>
                    <TableHeader>Assessment</TableHeader>
                    <TableHeader>Performance</TableHeader>
                    <TableHeader>Email Status</TableHeader>
                    <TableHeader>Status</TableHeader>
                    <TableHeader className="text-right">Actions</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {certificates.map((cert) => {
                    const snap = cert.academicSnapshot || {};
                    const isRevoked = cert.status === 'revoked';
                    const emailStatus = cert.emailDelivery?.status || 'pending';
                    const isDownloading = actionLoadingId === `download-${cert._id}`;
                    const isEmailing = actionLoadingId === `email-${cert._id}`;

                    return (
                      <TableRow key={cert._id} hoverEffect>
                        <TableCell className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                          <div className="flex items-center space-x-1">
                            <span>{cert.certificateId}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(cert.certificateId)}
                              className="p-1 text-slate-400 hover:text-slate-600"
                              title="Copy Certificate ID"
                            >
                              {copiedCode === cert.certificateId ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div>
                            <p className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                              {snap.studentName || cert.studentId?.name || 'Student'}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              {snap.studentEmail || cert.studentId?.email}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell>
                          <p className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate max-w-[180px]">
                            {snap.assessmentTitle || cert.assessmentId?.title}
                          </p>
                        </TableCell>

                        <TableCell>
                          <div className="text-xs">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{snap.percentage}%</span>
                            <Badge variant="neutral" size="sm" className="ml-1.5">
                              {snap.grade || 'Pass'}
                            </Badge>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant={
                              emailStatus === 'sent'
                                ? 'success'
                                : emailStatus === 'failed'
                                ? 'error'
                                : 'warning'
                            }
                            size="sm"
                            dot
                          >
                            {emailStatus.toUpperCase()}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <Badge variant={isRevoked ? 'error' : 'success'} size="sm" dot>
                            {isRevoked ? 'Revoked' : 'Active'}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <Button
                              variant="outline"
                              size="sm"
                              icon={Download}
                              isLoading={isDownloading}
                              onClick={() => handleDownloadCertificate(cert)}
                              title="Download PDF"
                            />
                            {emailStatus === 'failed' && (
                              <Button
                                variant="outline"
                                size="sm"
                                icon={Mail}
                                isLoading={isEmailing}
                                onClick={() => handleRetryEmail(cert._id)}
                                title="Retry Email Delivery"
                              />
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Eye}
                              onClick={() => setSelectedCert(cert)}
                              title="Inspect Details"
                            />
                            {!isRevoked && (
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={XCircle}
                                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                onClick={() => setRevokeCertTarget(cert)}
                                title="Revoke Certificate"
                              />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      ) : activeTab === 'settings' ? (
        /* TAB 5: Institutional Certification Settings */
        <Card className="p-6 max-w-2xl space-y-4">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
              Institutional Certification Settings
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Configure institution-wide accredited credentials, default signatories, and automated email policies.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Official Institution Name
              </label>
              <Input
                value={settingsForm.institutionName}
                onChange={(e) => setSettingsForm((p) => ({ ...p, institutionName: e.target.value }))}
                placeholder="e.g. Unified Assessment Platform"
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Default Signatory Name
                </label>
                <Input
                  value={settingsForm.defaultSignatoryName}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, defaultSignatoryName: e.target.value }))}
                  placeholder="e.g. Dr. Jane Smith"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Default Signatory Title
                </label>
                <Input
                  value={settingsForm.defaultSignatoryTitle}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, defaultSignatoryTitle: e.target.value }))}
                  placeholder="Dean of Academic Affairs"
                  className="w-full"
                />
              </div>
            </div>

            <div className="pt-3 border-t space-y-2">
              <label className="flex items-center space-x-2.5 cursor-pointer text-xs font-medium text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={settingsForm.autoEmailCertificates}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, autoEmailCertificates: e.target.checked }))}
                  className="rounded text-brand-primary focus:ring-brand-primary h-4 w-4"
                />
                <span>Automatically dispatch email with certificate upon student qualification</span>
              </label>

              <label className="flex items-center space-x-2.5 cursor-pointer text-xs font-medium text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={settingsForm.includePdfAttachment}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, includePdfAttachment: e.target.checked }))}
                  className="rounded text-brand-primary focus:ring-brand-primary h-4 w-4"
                />
                <span>Attach print-ready PDF certificate directly to outgoing notification email</span>
              </label>
            </div>

            <div className="pt-4 flex justify-end">
              <Button
                variant="primary"
                size="sm"
                isLoading={isSavingSettings}
                onClick={handleSaveSettings}
              >
                Save Institutional Settings
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Revocation Modal */}
      {revokeCertTarget && (
        <Modal
          isOpen={Boolean(revokeCertTarget)}
          onClose={() => setRevokeCertTarget(null)}
          title="Revoke Certificate Award"
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
              <p className="font-bold mb-1">Warning: Irreversible Credential Revocation</p>
              <p>
                Revoking certificate <strong>{revokeCertTarget.certificateId}</strong> will invalidate public verification and record an immutable entry in the system AuditLog.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mandatory Revocation Reason *
              </label>
              <textarea
                value={revocationReason}
                onChange={(e) => setRevocationReason(e.target.value)}
                placeholder="State the formal academic or administrative justification..."
                rows={3}
                className="w-full p-2.5 text-xs rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-slate-50 dark:bg-surface-dark-muted focus:ring-2 focus:ring-brand-primary outline-none"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setRevokeCertTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="bg-rose-600 hover:bg-rose-700 text-white"
                isLoading={isRevoking}
                onClick={handleRevokeSubmit}
              >
                Confirm Revocation
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Certificate Details Modal */}
      {selectedCert && (
        <Modal
          isOpen={Boolean(selectedCert)}
          onClose={() => setSelectedCert(null)}
          title="Authoritative Certificate Record"
          maxWidth="max-w-lg"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border space-y-1">
              <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200">
                <span>{selectedCert.academicSnapshot?.certificateTitle}</span>
                <Badge variant={selectedCert.status === 'revoked' ? 'error' : 'success'} size="sm">
                  {selectedCert.status.toUpperCase()}
                </Badge>
              </div>
              <p className="text-slate-500">{selectedCert.academicSnapshot?.assessmentTitle}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-lg border">
                <span className="text-slate-400 block text-[10px]">Student:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedCert.academicSnapshot?.studentName}
                </span>
                <span className="block text-slate-400 text-[10px] truncate">
                  {selectedCert.academicSnapshot?.studentEmail}
                </span>
              </div>
              <div className="p-2.5 rounded-lg border">
                <span className="text-slate-400 block text-[10px]">Score & Grade:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedCert.academicSnapshot?.percentage}% ({selectedCert.academicSnapshot?.grade})
                </span>
              </div>
              <div className="p-2.5 rounded-lg border">
                <span className="text-slate-400 block text-[10px]">Certificate ID:</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {selectedCert.certificateId}
                </span>
              </div>
              <div className="p-2.5 rounded-lg border">
                <span className="text-slate-400 block text-[10px]">Verification Token:</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {selectedCert.verificationCode}
                </span>
              </div>
            </div>

            {selectedCert.status === 'revoked' && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                <span className="font-bold block">Revocation Reason:</span>
                <span>{selectedCert.revocation?.reason || 'Administrative revocation'}</span>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setSelectedCert(null)}>
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Download}
                onClick={() => handleDownloadCertificate(selectedCert)}
              >
                Download PDF
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default CertificationStudio;
