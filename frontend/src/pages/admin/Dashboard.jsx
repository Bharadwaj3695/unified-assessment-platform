import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../hooks/useAuth';
import adminService from '../../services/admin.service';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import StatCard from '../../components/common/StatCard';
import ActivityBarChart from '../../components/charts/ActivityBarChart';
import { AdminHeroIllustration } from '../../components/illustrations';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from '../../components/ui/Table';
import {
  ShieldCheck,
  Users,
  GraduationCap,
  BookOpen,
  Activity,
  Award,
  AlertTriangle,
  UserCheck,
  UserX,
  Eye,
  Search,
  CheckCircle,
  XCircle,
  RefreshCw,
  Clock,
  Building,
  Mail,
  Calendar,
  ShieldAlert,
  Archive,
  Save,
  Sliders,
  Power,
  Bell,
  SlidersHorizontal,
} from 'lucide-react';

const AdminDashboard = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Tab state derived from URL route
  const getTabFromPath = (path) => {
    if (path.includes('/admin/users')) return 'users';
    if (path.includes('/admin/assessments')) return 'assessments';
    if (path.includes('/admin/logs')) return 'logs';
    if (path.includes('/admin/settings')) return 'settings';
    return 'overview';
  };

  const [activeTab, setActiveTab] = useState(() => getTabFromPath(location.pathname));

  useEffect(() => {
    setActiveTab(getTabFromPath(location.pathname));
  }, [location.pathname]);

  const handleTabChange = (tab, path) => {
    setActiveTab(tab);
    navigate(path);
  };

  // Data states
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [logs, setLogs] = useState([]);
  const [alertsData, setAlertsData] = useState({ alerts: [], summary: {} });
  const [settings, setSettings] = useState(null);
  const [settingsForm, setSettingsForm] = useState({
    platformName: 'Unified Assessment Platform',
    registrationOpen: true,
    maintenanceMode: false,
    announcementBanner: '',
    defaultPassingScore: 60,
    enableEmailNotifications: true,
    maxAttemptDurationHours: 4,
    supportEmail: 'support@uap.edu',
    allowStudentReview: true,
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters for User Management
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userSection, setUserSection] = useState('pending'); // 'pending' or 'all'

  // Filters for Assessments
  const [assessmentStatusFilter, setAssessmentStatusFilter] = useState('');
  const [assessmentSearch, setAssessmentSearch] = useState('');

  // Filters for Logs
  const [logActionFilter, setLogActionFilter] = useState('');

  // Modal states
  const [selectedUser, setSelectedUser] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [actionReason, setActionReason] = useState('');
  const [assignedRole, setAssignedRole] = useState('student');
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);

  // Load telemetry data from backend
  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statsData, pendingData, assessmentsRes, logsRes, alertsRes, settingsRes] = await Promise.all([
        adminService.getStats(),
        adminService.getPendingUsers(),
        adminService.getAssessments({ limit: 50 }),
        adminService.getLogs({ limit: 50 }),
        adminService.getAlerts().catch(() => ({ alerts: [], summary: {} })),
        adminService.getSettings().catch(() => null),
      ]);

      setStats(statsData);
      setPendingUsers(pendingData || []);
      setAssessments(assessmentsRes.data || assessmentsRes.assessments || []);
      setLogs(logsRes.data || logsRes.logs || []);
      if (alertsRes) setAlertsData(alertsRes);
      if (settingsRes) {
        setSettings(settingsRes);
        setSettingsForm({
          platformName: settingsRes.platformName || 'Unified Assessment Platform',
          registrationOpen: settingsRes.registrationOpen ?? true,
          maintenanceMode: settingsRes.maintenanceMode ?? false,
          announcementBanner: settingsRes.announcementBanner || '',
          defaultPassingScore: settingsRes.defaultPassingScore ?? 60,
          enableEmailNotifications: settingsRes.enableEmailNotifications ?? true,
          maxAttemptDurationHours: settingsRes.maxAttemptDurationHours ?? 4,
          supportEmail: settingsRes.supportEmail || 'support@uap.edu',
          allowStudentReview: settingsRes.allowStudentReview ?? true,
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to load administrator data from server.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load Users table with current filters
  const loadUsersList = useCallback(async () => {
    try {
      const params = {};
      if (userRoleFilter) params.role = userRoleFilter;
      if (userStatusFilter) params.status = userStatusFilter;
      if (userSearch.trim()) params.search = userSearch.trim();

      const res = await adminService.getUsers(params);
      setUsers(res.data || res.users || []);
    } catch (err) {
      toast.error('Failed to update users table: ' + err.message);
    }
  }, [userRoleFilter, userStatusFilter, userSearch]);

  // Load Assessments with current filters
  const loadAssessmentsList = useCallback(async () => {
    try {
      const params = {};
      if (assessmentStatusFilter) params.status = assessmentStatusFilter;
      if (assessmentSearch.trim()) params.search = assessmentSearch.trim();
      const res = await adminService.getAssessments(params);
      setAssessments(res.data || res.assessments || []);
    } catch (err) {
      toast.error('Failed to update assessments table: ' + err.message);
    }
  }, [assessmentStatusFilter, assessmentSearch]);

  // Load Logs with current filters
  const loadLogsList = useCallback(async () => {
    try {
      const params = { limit: 50 };
      if (logActionFilter) params.action = logActionFilter;
      const res = await adminService.getLogs(params);
      setLogs(res.data || res.logs || []);
    } catch (err) {
      toast.error('Failed to filter audit logs: ' + err.message);
    }
  }, [logActionFilter]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    if (activeTab === 'users' && userSection === 'all') {
      loadUsersList();
    }
  }, [activeTab, userSection, loadUsersList]);

  useEffect(() => {
    if (activeTab === 'assessments') {
      loadAssessmentsList();
    }
  }, [activeTab, loadAssessmentsList]);

  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogsList();
    }
  }, [activeTab, loadLogsList]);

  // Inspect user full details
  const handleOpenDetails = async (targetUser) => {
    try {
      const fullDetails = await adminService.getUserDetails(targetUser._id || targetUser.id);
      setSelectedUser(fullDetails);
      setIsDetailsModalOpen(true);
    } catch (err) {
      toast.error('Failed to load user details: ' + err.message);
    }
  };

  // Open approve modal
  const handleOpenApprove = (targetUser) => {
    setSelectedUser(targetUser);
    setAssignedRole(targetUser.role || 'student');
    setIsApproveModalOpen(true);
  };

  // Confirm approve
  const handleConfirmApprove = async () => {
    if (!selectedUser) return;
    setIsActionSubmitting(true);
    try {
      await adminService.approveUser(selectedUser._id || selectedUser.id, { role: assignedRole });
      toast.success(`Account approved for ${selectedUser.name}!`);
      setIsApproveModalOpen(false);
      loadDashboardData();
      if (userSection === 'all') loadUsersList();
    } catch (err) {
      toast.error(err.message || 'Failed to approve account');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  // Open reject modal
  const handleOpenReject = (targetUser) => {
    setSelectedUser(targetUser);
    setActionReason('');
    setIsRejectModalOpen(true);
  };

  // Confirm reject
  const handleConfirmReject = async () => {
    if (!selectedUser) return;
    setIsActionSubmitting(true);
    try {
      await adminService.rejectUser(selectedUser._id || selectedUser.id, {
        reason: actionReason.trim() || 'Institutional eligibility verification unsuccessful.',
      });
      toast.warning(`Application rejected for ${selectedUser.name}`);
      setIsRejectModalOpen(false);
      loadDashboardData();
      if (userSection === 'all') loadUsersList();
    } catch (err) {
      toast.error(err.message || 'Failed to reject application');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  // Open revoke modal
  const handleOpenRevoke = (targetUser) => {
    setSelectedUser(targetUser);
    setActionReason('');
    setIsRevokeModalOpen(true);
  };

  // Confirm revoke
  const handleConfirmRevoke = async () => {
    if (!selectedUser) return;
    setIsActionSubmitting(true);
    try {
      await adminService.revokeUser(selectedUser._id || selectedUser.id, {
        reason: actionReason.trim() || 'Access revoked by administrator.',
      });
      toast.error(`Account revoked for ${selectedUser.name}`);
      setIsRevokeModalOpen(false);
      loadDashboardData();
      if (userSection === 'all') loadUsersList();
    } catch (err) {
      toast.error(err.message || 'Failed to revoke account access');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  // Toggle user active/deactive status
  const handleToggleUserStatus = async (targetUser) => {
    try {
      const res = await adminService.toggleUserStatus(targetUser._id || targetUser.id);
      toast.success(res.message || 'Account status updated');
      loadDashboardData();
      if (userSection === 'all') loadUsersList();
    } catch (err) {
      toast.error(err.message || 'Failed to toggle account status');
    }
  };

  // Assessment oversight: update assessment status (archive / publish / draft)
  const handleUpdateAssessmentStatus = async (assessmentId, newStatus) => {
    try {
      await adminService.updateAssessmentStatus(assessmentId, newStatus);
      toast.success(`Assessment marked as ${newStatus}`);
      loadDashboardData();
      loadAssessmentsList();
    } catch (err) {
      toast.error(err.message || 'Failed to update assessment status');
    }
  };

  // Save system settings
  const handleSaveSettings = async (e) => {
    e?.preventDefault();
    setIsSavingSettings(true);
    try {
      const updated = await adminService.updateSettings(settingsForm);
      setSettings(updated);
      toast.success('System settings updated successfully!');
      loadDashboardData();
    } catch (err) {
      toast.error(err.message || 'Failed to update system settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  if (isLoading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Spinner size="lg" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Connecting to institutional admin services...
        </p>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <ErrorState
        title="Admin Telemetry Unavailable"
        message={error}
        onRetry={loadDashboardData}
      />
    );
  }

  const getActionBadgeVariant = (action) => {
    if (['LOGIN_FAILED', 'REVOKED_USER_LOGIN_ATTEMPT', 'USER_REVOKED'].includes(action)) return 'danger';
    if (['USER_REJECTED', 'ASSESSMENT_STATUS_UPDATED'].includes(action)) return 'warning';
    if (['USER_APPROVED', 'USER_ACTIVATED'].includes(action)) return 'success';
    if (['SETTINGS_UPDATED'].includes(action)) return 'primary';
    return 'neutral';
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-[#EBE3D8] dark:border-[#2D3748] bg-gradient-to-r from-[#FFF4ED] via-[#FFFDFB] to-[#F3F7FB] dark:from-[#341C16] dark:via-[#1A202C] dark:to-[#12161F] p-6 sm:p-7 shadow-warm-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
          <div className="max-w-xl">
            <div className="flex items-center space-x-2 mb-2">
              <Badge variant="terracotta" size="sm" dot>System Governance</Badge>
              <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">· Institutional Master Console</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-[#1F2937] dark:text-[#F9FAFB]">
              Welcome, {user?.name || 'Administrator'}
            </h1>
            <p className="mt-2 text-sm text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
              Platform telemetry, applicant verification queue, assessment oversight, audit trails, and system governance.
            </p>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden md:flex flex-shrink-0 items-center justify-center">
              <AdminHeroIllustration className="w-52 h-36 object-contain drop-shadow-sm" />
            </div>
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              onClick={() => {
                loadDashboardData();
                if (activeTab === 'users') loadUsersList();
                if (activeTab === 'assessments') loadAssessmentsList();
                if (activeTab === 'logs') loadLogsList();
              }}
            >
              Refresh Data
            </Button>
          </div>
        </div>

        {/* Tab Navigation Bar */}
        <div className="mt-6 flex flex-wrap gap-2 border-t border-[#EBE3D8] dark:border-[#2D3748] pt-4">
          <button
            type="button"
            onClick={() => handleTabChange('overview', '/admin/dashboard')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-[#E05D38] text-white shadow-warm-xs'
                : 'bg-white dark:bg-[#1A202C] text-[#64748B] dark:text-[#94A3B8] hover:text-[#1F2937] hover:bg-[#FFF9F2] dark:hover:bg-[#2D3748] border border-[#EBE3D8] dark:border-[#2D3748]'
            }`}
          >
            System Overview
          </button>

          <button
            type="button"
            onClick={() => {
              setUserSection('pending');
              handleTabChange('users', '/admin/users');
            }}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'users'
                ? 'bg-[#E05D38] text-white shadow-warm-xs'
                : 'bg-white dark:bg-[#1A202C] text-[#64748B] dark:text-[#94A3B8] hover:text-[#1F2937] hover:bg-[#FFF9F2] dark:hover:bg-[#2D3748] border border-[#EBE3D8] dark:border-[#2D3748]'
            }`}
          >
            <span>User Management</span>
            {pendingUsers.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'users' ? 'bg-white text-[#E05D38]' : 'bg-[#F4A261] text-white'
              }`}>
                {pendingUsers.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('assessments', '/admin/assessments')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'assessments'
                ? 'bg-[#E05D38] text-white shadow-warm-xs'
                : 'bg-white dark:bg-[#1A202C] text-[#64748B] dark:text-[#94A3B8] hover:text-[#1F2937] hover:bg-[#FFF9F2] dark:hover:bg-[#2D3748] border border-[#EBE3D8] dark:border-[#2D3748]'
            }`}
          >
            All Assessments ({stats?.totalAssessments || assessments.length})
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('logs', '/admin/logs')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-[#E05D38] text-white shadow-warm-xs'
                : 'bg-white dark:bg-[#1A202C] text-[#64748B] dark:text-[#94A3B8] hover:text-[#1F2937] hover:bg-[#FFF9F2] dark:hover:bg-[#2D3748] border border-[#EBE3D8] dark:border-[#2D3748]'
            }`}
          >
            Audit Logs
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('settings', '/admin/settings')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-[#E05D38] text-white shadow-warm-xs'
                : 'bg-white dark:bg-[#1A202C] text-[#64748B] dark:text-[#94A3B8] hover:text-[#1F2937] hover:bg-[#FFF9F2] dark:hover:bg-[#2D3748] border border-[#EBE3D8] dark:border-[#2D3748]'
            }`}
          >
            System Settings
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={stats?.totalUsers ?? '—'}
          subtitle={`${stats?.activeUsersCount ?? 0} active, ${stats?.revokedUsersCount ?? 0} revoked`}
          icon={Users}
          color="primary"
        />
        <StatCard
          title="Pending Approvals"
          value={pendingUsers.length}
          subtitle="Applicants awaiting review"
          icon={Clock}
          color="peach"
        />
        <StatCard
          title="Faculty Instructors"
          value={stats?.totalInstructors ?? '—'}
          subtitle="Course creators"
          icon={ShieldCheck}
          color="sage"
        />
        <StatCard
          title="Submissions Pass Rate"
          value={stats?.passRate !== undefined ? `${stats.passRate}%` : '—'}
          subtitle={`Avg Score: ${stats?.averageScore ?? 0}% · ${stats?.passedSubmissions ?? 0}/${stats?.totalSubmissions ?? 0} passed`}
          icon={Award}
          color="secondary"
        />
      </div>

      {/* TAB 1: SYSTEM OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Pending Alert if any exist */}
          {pendingUsers.length > 0 && (
            <div className="p-4 rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold">
                  !
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    {pendingUsers.length} Registration{pendingUsers.length > 1 ? 's' : ''} Awaiting Approval
                  </h4>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    New institutional users have registered and require verification before they can authenticate.
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setUserSection('pending');
                  handleTabChange('users', '/admin/users');
                }}
              >
                Review Applications →
              </Button>
            </div>
          )}

          {/* Operational Alerts & Security Overview */}
          {alertsData?.alerts?.length > 0 && (
            <Card
              title="Operational & Security Alerts"
              subtitle="Real-time detection of failed logins, revoked access attempts, and audit events"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40">
                  <span className="text-xs font-semibold text-rose-700 dark:text-rose-300 block">
                    Failed Logins
                  </span>
                  <span className="text-xl font-bold text-rose-900 dark:text-rose-100">
                    {alertsData?.summary?.failedLoginsCount ?? 0}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40">
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 block">
                    Revoked User Attempts
                  </span>
                  <span className="text-xl font-bold text-amber-900 dark:text-amber-100">
                    {alertsData?.summary?.revokedAttemptsCount ?? 0}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40">
                  <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 block">
                    Pending Verification
                  </span>
                  <span className="text-xl font-bold text-indigo-900 dark:text-indigo-100">
                    {pendingUsers.length}
                  </span>
                </div>
              </div>

              <div className="divide-y divide-surface-light-border dark:divide-surface-dark-border max-h-56 overflow-y-auto">
                {alertsData.alerts.slice(0, 6).map((item) => (
                  <div key={item._id || item.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center space-x-2.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />
                      <Badge variant={getActionBadgeVariant(item.action)} size="sm" className="font-mono text-[10px]">
                        {item.action}
                      </Badge>
                      <span className="text-slate-600 dark:text-slate-400 font-mono truncate max-w-xs sm:max-w-md">
                        {item.details?.email || item.details?.targetEmail || (typeof item.details === 'string' ? item.details : JSON.stringify(item.details))}
                      </span>
                    </div>
                    <span className="text-slate-400 whitespace-nowrap text-[11px]">
                      {item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-4">
              <Card
                title="Institutional Examinations"
                subtitle="Live platform assessments and active cohorts"
                action={
                  <button
                    onClick={() => handleTabChange('assessments', '/admin/assessments')}
                    className="text-xs font-semibold text-brand-primary hover:underline cursor-pointer"
                  >
                    View All →
                  </button>
                }
              >
                {assessments.length === 0 ? (
                  <EmptyState
                    title="No assessments"
                    description="No examinations are currently created."
                  />
                ) : (
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeader>Title</TableHeader>
                        <TableHeader>Author</TableHeader>
                        <TableHeader>Passing Score</TableHeader>
                        <TableHeader className="text-right">Status</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {assessments.slice(0, 5).map((item) => (
                        <TableRow key={item._id || item.id}>
                          <TableCell>
                            <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                              {item.title}
                            </span>
                            <span className="text-xs text-slate-400">{item.category}</span>
                          </TableCell>
                          <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                            {item.instructorId?.name || 'Faculty'}
                          </TableCell>
                          <TableCell className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {item.passingScore}%
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={item.status === 'published' ? 'success' : item.status === 'draft' ? 'warning' : 'neutral'}
                              size="sm"
                              dot
                            >
                              {item.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </div>

            <div className="lg:col-span-5 space-y-4">
              <Card
                title="Attempt Telemetry"
                subtitle="Platform submission activity"
              >
                <ActivityBarChart
                  barKey="submissions"
                  barLabel="Total Attempts"
                  barColor="#E05D38"
                  height={220}
                />
                <div className="mt-4 pt-3 border-t border-surface-light-border dark:border-surface-dark-border flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>MongoDB Atlas Storage: <strong>Optimal</strong></span>
                  <span>Evaluations: <strong>{stats?.totalSubmissions || 0} Total</strong></span>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USER MANAGEMENT & ACCOUNT APPROVAL */}
      {activeTab === 'users' && (
        <div className="space-y-5">
          {/* Sub-section Switcher */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 bg-slate-100 dark:bg-surface-dark-muted p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setUserSection('pending')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  userSection === 'pending'
                    ? 'bg-white dark:bg-surface-dark text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Pending Approvals ({pendingUsers.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setUserSection('all');
                  loadUsersList();
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  userSection === 'all'
                    ? 'bg-white dark:bg-surface-dark text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                All Platform Accounts
              </button>
            </div>

            {userSection === 'pending' && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Displaying unverified accounts awaiting institutional action
              </span>
            )}
          </div>

          {/* Pending Accounts Queue View */}
          {userSection === 'pending' && (
            <Card
              title="Pending Registration Queue"
              subtitle="Inspect applicant details, verify institutional credentials, and approve or reject accounts"
            >
              {pendingUsers.length === 0 ? (
                <EmptyState
                  title="No Pending Approvals"
                  description="All submitted registrations have been verified and processed."
                />
              ) : (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeader>Applicant</TableHeader>
                      <TableHeader>Requested Role</TableHeader>
                      <TableHeader>Institute Code</TableHeader>
                      <TableHeader>Registration Date</TableHeader>
                      <TableHeader>Status</TableHeader>
                      <TableHeader className="text-right">Actions</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pendingUsers.map((u) => (
                      <TableRow key={u._id || u.id}>
                        <TableCell>
                          <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                            {u.name}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">{u.email}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.role === 'instructor' ? 'sage' : 'secondary'} size="sm">
                            {u.role === 'instructor' ? 'Faculty / Instructor' : 'Student'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-slate-600 dark:text-slate-400">
                          {u.instituteCode || 'None provided'}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="warning" size="sm" dot>Pending Review</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              icon={Eye}
                              onClick={() => handleOpenDetails(u)}
                            >
                              Details
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              icon={CheckCircle}
                              onClick={() => handleOpenApprove(u)}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              icon={XCircle}
                              onClick={() => handleOpenReject(u)}
                            >
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          )}

          {/* All Users Directory View with Search & Filters */}
          {userSection === 'all' && (
            <Card
              title="All Platform Accounts"
              subtitle="Comprehensive repository of active, pending, rejected, and revoked users"
            >
              {/* Filter Bar */}
              <div className="mb-4 grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-5">
                  <Input
                    placeholder="Search by name, email, or code..."
                    icon={Search}
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') loadUsersList();
                    }}
                  />
                </div>
                <div className="sm:col-span-3">
                  <Select
                    options={[
                      { value: '', label: 'All Roles' },
                      { value: 'student', label: 'Student' },
                      { value: 'instructor', label: 'Instructor' },
                      { value: 'admin', label: 'Admin' },
                    ]}
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-3">
                  <Select
                    options={[
                      { value: '', label: 'All Statuses' },
                      { value: 'active', label: 'Active' },
                      { value: 'pending', label: 'Pending' },
                      { value: 'rejected', label: 'Rejected' },
                      { value: 'revoked', label: 'Revoked' },
                    ]}
                    value={userStatusFilter}
                    onChange={(e) => setUserStatusFilter(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-1">
                  <Button
                    variant="outline"
                    size="md"
                    fullWidth
                    icon={Search}
                    onClick={loadUsersList}
                    aria-label="Search users"
                  />
                </div>
              </div>

              {users.length === 0 ? (
                <EmptyState
                  title="No matching users"
                  description="Try adjusting your search criteria or role filters."
                />
              ) : (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeader>Name / Email</TableHeader>
                      <TableHeader>Role</TableHeader>
                      <TableHeader>Institute Code</TableHeader>
                      <TableHeader>Status</TableHeader>
                      <TableHeader>Registered</TableHeader>
                      <TableHeader className="text-right">Actions</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u._id || u.id}>
                        <TableCell>
                          <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                            {u.name}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">{u.email}</span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={u.role === 'admin' ? 'primary' : u.role === 'instructor' ? 'sage' : 'secondary'}
                            size="sm"
                          >
                            {u.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-slate-600 dark:text-slate-400">
                          {u.instituteCode || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              u.status === 'active'
                                ? 'success'
                                : u.status === 'pending'
                                ? 'warning'
                                : 'danger'
                            }
                            size="sm"
                            dot
                          >
                            {u.status || (u.isActive ? 'active' : 'inactive')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              icon={Eye}
                              onClick={() => handleOpenDetails(u)}
                            >
                              View
                            </Button>

                            {u.status === 'pending' && (
                              <>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  icon={CheckCircle}
                                  onClick={() => handleOpenApprove(u)}
                                >
                                  Approve
                                </Button>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  icon={XCircle}
                                  onClick={() => handleOpenReject(u)}
                                >
                                  Reject
                                </Button>
                              </>
                            )}

                            {u.role !== 'admin' && (
                              <Button
                                variant={u.isActive ? 'outline' : 'primary'}
                                size="sm"
                                icon={Power}
                                onClick={() => handleToggleUserStatus(u)}
                                title={u.isActive ? 'Deactivate User' : 'Activate User'}
                              >
                                {u.isActive ? 'Deactivate' : 'Activate'}
                              </Button>
                            )}

                            {u.status === 'active' && u.role !== 'admin' && (
                              <Button
                                variant="danger"
                                size="sm"
                                icon={UserX}
                                onClick={() => handleOpenRevoke(u)}
                              >
                                Revoke
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          )}
        </div>
      )}

      {/* TAB 3: ALL PLATFORM ASSESSMENTS */}
      {activeTab === 'assessments' && (
        <Card
          title="Platform Assessment Oversight"
          subtitle="System-wide review of examinations, author assignments, access types, and status moderation"
        >
          {/* Assessment Filter Bar */}
          <div className="mb-4 grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-8">
              <Input
                placeholder="Search assessments by title, description, or category..."
                icon={Search}
                value={assessmentSearch}
                onChange={(e) => setAssessmentSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') loadAssessmentsList();
                }}
              />
            </div>
            <div className="sm:col-span-3">
              <Select
                options={[
                  { value: '', label: 'All Statuses' },
                  { value: 'published', label: 'Published' },
                  { value: 'draft', label: 'Draft' },
                  { value: 'archived', label: 'Archived' },
                ]}
                value={assessmentStatusFilter}
                onChange={(e) => setAssessmentStatusFilter(e.target.value)}
              />
            </div>
            <div className="sm:col-span-1">
              <Button
                variant="outline"
                size="md"
                fullWidth
                icon={Search}
                onClick={loadAssessmentsList}
              />
            </div>
          </div>

          {assessments.length === 0 ? (
            <EmptyState
              title="No assessments found"
              description="Instructors have not yet published assessments matching your criteria."
            />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Assessment Title</TableHeader>
                  <TableHeader>Instructor</TableHeader>
                  <TableHeader>Category</TableHeader>
                  <TableHeader>Duration</TableHeader>
                  <TableHeader>Pass Score</TableHeader>
                  <TableHeader>Access</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader className="text-right">Moderation</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {assessments.map((a) => {
                  const id = a._id || a.id;
                  return (
                    <TableRow key={id}>
                      <TableCell>
                        <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                          {a.title}
                        </span>
                        <span className="text-xs text-slate-400 line-clamp-1">{a.description}</span>
                      </TableCell>
                      <TableCell className="text-xs text-slate-700 dark:text-slate-300">
                        {a.instructorId?.name || 'Faculty Author'}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        {a.category}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                        {a.durationMinutes} mins
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {a.passingScore}%
                      </TableCell>
                      <TableCell>
                        <Badge variant={a.accessType === 'restricted' ? 'warning' : 'neutral'} size="sm">
                          {a.accessType || 'public'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={a.status === 'published' ? 'success' : a.status === 'draft' ? 'warning' : 'neutral'}
                          size="sm"
                          dot
                        >
                          {a.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {a.status === 'published' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              icon={Archive}
                              onClick={() => handleUpdateAssessmentStatus(id, 'archived')}
                              title="Archive assessment"
                            >
                              Archive
                            </Button>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              icon={CheckCircle}
                              onClick={() => handleUpdateAssessmentStatus(id, 'published')}
                              title="Publish assessment"
                            >
                              Publish
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {/* TAB 4: AUDIT LOGS */}
      {activeTab === 'logs' && (
        <Card
          title="System Security & Operations Audit Trail"
          subtitle="Immutable chronological ledger of all platform administrative, authentication, and security actions"
        >
          {/* Action Filter Bar */}
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="w-full sm:w-72">
              <Select
                value={logActionFilter}
                onChange={(e) => setLogActionFilter(e.target.value)}
                options={[
                  { value: '', label: 'All Logged Actions' },
                  { value: 'USER_LOGIN', label: 'USER_LOGIN' },
                  { value: 'LOGIN_FAILED', label: 'LOGIN_FAILED (Security)' },
                  { value: 'REVOKED_USER_LOGIN_ATTEMPT', label: 'REVOKED_USER_LOGIN_ATTEMPT' },
                  { value: 'USER_REGISTER', label: 'USER_REGISTER' },
                  { value: 'USER_APPROVED', label: 'USER_APPROVED' },
                  { value: 'USER_REJECTED', label: 'USER_REJECTED' },
                  { value: 'USER_REVOKED', label: 'USER_REVOKED' },
                  { value: 'USER_ACTIVATED', label: 'USER_ACTIVATED' },
                  { value: 'USER_DEACTIVATED', label: 'USER_DEACTIVATED' },
                  { value: 'SETTINGS_UPDATED', label: 'SETTINGS_UPDATED' },
                  { value: 'ASSESSMENT_STATUS_UPDATED', label: 'ASSESSMENT_STATUS_UPDATED' },
                ]}
              />
            </div>
            <span className="text-xs text-slate-400">
              Showing latest {logs.length} audit records
            </span>
          </div>

          {logs.length === 0 ? (
            <EmptyState
              title="No audit events found"
              description="System activities matching your filter will appear here."
            />
          ) : (
            <div className="divide-y divide-surface-light-border dark:divide-surface-dark-border">
              {logs.map((log) => (
                <div key={log._id || log.id} className="py-3.5 flex items-start justify-between gap-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5 text-brand-primary">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={getActionBadgeVariant(log.action)} size="sm" className="font-mono text-[10px]">
                          {log.action}
                        </Badge>
                        {log.userId?.role && (
                          <Badge variant="neutral" size="sm" className="text-[10px] uppercase">
                            {log.userId.role}
                          </Badge>
                        )}
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {log.userId?.name || 'System Operator'}
                        </span>
                        {log.ipAddress && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({log.ipAddress})
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-mono break-all">
                        {typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}
                      </p>
                    </div>
                  </div>

                  <div className="text-right text-xs text-slate-400 whitespace-nowrap flex-shrink-0">
                    <div>{log.createdAt ? new Date(log.createdAt).toLocaleTimeString() : '—'}</div>
                    <div>{log.createdAt ? new Date(log.createdAt).toLocaleDateString() : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* TAB 5: SYSTEM & PLATFORM SETTINGS */}
      {activeTab === 'settings' && (
        <Card
          title="Platform & System Settings"
          subtitle="Configure institutional rules, registration availability, maintenance status, and default exam parameters"
        >
          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Platform Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Platform Name
                </label>
                <Input
                  value={settingsForm.platformName}
                  onChange={(e) => setSettingsForm({ ...settingsForm, platformName: e.target.value })}
                  placeholder="Unified Assessment Platform"
                  required
                />
              </div>

              {/* Support Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Institutional Support Email
                </label>
                <Input
                  type="email"
                  value={settingsForm.supportEmail}
                  onChange={(e) => setSettingsForm({ ...settingsForm, supportEmail: e.target.value })}
                  placeholder="support@uap.edu"
                  required
                />
              </div>

              {/* Default Passing Score */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Default Passing Threshold (%)
                </label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={settingsForm.defaultPassingScore}
                  onChange={(e) => setSettingsForm({ ...settingsForm, defaultPassingScore: Number(e.target.value) })}
                  required
                />
              </div>

              {/* Max Attempt Duration */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Maximum Attempt Duration (Hours)
                </label>
                <Input
                  type="number"
                  min="1"
                  max="24"
                  value={settingsForm.maxAttemptDurationHours}
                  onChange={(e) => setSettingsForm({ ...settingsForm, maxAttemptDurationHours: Number(e.target.value) })}
                  required
                />
              </div>
            </div>

            {/* Announcement Banner */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                System-wide Announcement Banner (Optional)
              </label>
              <textarea
                className="w-full px-3 py-2 rounded-xl text-xs border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark-muted text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                rows="2"
                placeholder="Broadcast a message across all user dashboards..."
                value={settingsForm.announcementBanner}
                onChange={(e) => setSettingsForm({ ...settingsForm, announcementBanner: e.target.value })}
              />
            </div>

            {/* Operational Toggles */}
            <div className="p-4 rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-slate-50/60 dark:bg-surface-dark-muted/40 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Operational Policies & Feature Toggles
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Registration Open Toggle */}
                <label className="flex items-start space-x-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settingsForm.registrationOpen}
                    onChange={(e) => setSettingsForm({ ...settingsForm, registrationOpen: e.target.checked })}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                      Public Registration Open
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      When enabled, prospective applicants can submit new accounts into the verification queue.
                    </span>
                  </div>
                </label>

                {/* Email Notifications Toggle */}
                <label className="flex items-start space-x-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settingsForm.enableEmailNotifications}
                    onChange={(e) => setSettingsForm({ ...settingsForm, enableEmailNotifications: e.target.checked })}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                      SMTP Email Notifications
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Send transactional notifications via Nodemailer SMTP for registration, approvals, and grades.
                    </span>
                  </div>
                </label>

                {/* Allow Student Review */}
                <label className="flex items-start space-x-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settingsForm.allowStudentReview}
                    onChange={(e) => setSettingsForm({ ...settingsForm, allowStudentReview: e.target.checked })}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                      Student Post-Exam Score Review
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Permit students to review detailed evaluation feedback after grades are finalized.
                    </span>
                  </div>
                </label>

                {/* Maintenance Mode */}
                <label className="flex items-start space-x-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settingsForm.maintenanceMode}
                    onChange={(e) => setSettingsForm({ ...settingsForm, maintenanceMode: e.target.checked })}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block text-amber-600 dark:text-amber-400">
                      Platform Maintenance Mode
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Restrict student examination sessions during scheduled platform database maintenance.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                icon={Save}
                isLoading={isSavingSettings}
              >
                Save System Settings
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* MODAL 1: USER DETAILS INSPECTION MODAL */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title="Complete Account Details"
        maxWidth="max-w-xl"
        footer={
          <Button variant="outline" size="sm" onClick={() => setIsDetailsModalOpen(false)}>
            Close
          </Button>
        }
      >
        {selectedUser && (
          <div className="space-y-4">
            <div className="flex items-center space-x-3 pb-3 border-b border-surface-light-border dark:border-surface-dark-border">
              <div className="w-12 h-12 rounded-xl bg-brand-primary/10 text-brand-primary font-bold text-lg flex items-center justify-center">
                {selectedUser.name?.charAt(0) || 'U'}
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {selectedUser.name}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">{selectedUser.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-surface-dark-muted">
                <span className="text-slate-400 block mb-0.5">Account Role</span>
                <span className="font-semibold capitalize text-slate-800 dark:text-slate-200">
                  {selectedUser.role}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-surface-dark-muted">
                <span className="text-slate-400 block mb-0.5">Account Status</span>
                <span className="font-semibold uppercase text-slate-800 dark:text-slate-200">
                  {selectedUser.status}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-surface-dark-muted">
                <span className="text-slate-400 block mb-0.5">Institute Code</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedUser.instituteCode || 'None provided'}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-surface-dark-muted">
                <span className="text-slate-400 block mb-0.5">Registered On</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleString() : '—'}
                </span>
              </div>
            </div>

            {selectedUser.bio && (
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-surface-dark-muted text-xs">
                <span className="text-slate-400 block mb-0.5">Applicant Bio</span>
                <p className="text-slate-700 dark:text-slate-300">{selectedUser.bio}</p>
              </div>
            )}

            {/* Approval / Revocation Details if available */}
            {selectedUser.approvedAt && (
              <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-950/20 text-xs">
                <span className="font-semibold text-emerald-800 dark:text-emerald-300 block mb-0.5">
                  Approval Record
                </span>
                <p className="text-emerald-700 dark:text-emerald-400">
                  Approved on {new Date(selectedUser.approvedAt).toLocaleString()}
                  {selectedUser.approvedBy?.name ? ` by ${selectedUser.approvedBy.name}` : ''}
                </p>
              </div>
            )}

            {selectedUser.revokedAt && (
              <div className="p-3 rounded-lg border border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/20 text-xs">
                <span className="font-semibold text-red-800 dark:text-red-300 block mb-0.5">
                  Revocation Record
                </span>
                <p className="text-red-700 dark:text-red-400">
                  Revoked on {new Date(selectedUser.revokedAt).toLocaleString()}
                  {selectedUser.revokedBy?.name ? ` by ${selectedUser.revokedBy.name}` : ''}
                </p>
                {selectedUser.rejectionReason && (
                  <p className="text-red-600 dark:text-red-300 mt-1 italic">
                    Reason: {selectedUser.rejectionReason}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* MODAL 2: APPROVE ACCOUNT CONFIRMATION */}
      <Modal
        isOpen={isApproveModalOpen}
        onClose={() => setIsApproveModalOpen(false)}
        title="Approve Account Registration"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsApproveModalOpen(false)}
              disabled={isActionSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmApprove}
              isLoading={isActionSubmitting}
              icon={CheckCircle}
            >
              Confirm & Activate Account
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            You are approving institutional access for{' '}
            <strong className="text-slate-900 dark:text-slate-100">{selectedUser?.name}</strong> (
            {selectedUser?.email}).
          </p>

          <Select
            label="Confirm Assigned Role"
            id="assignedRole"
            value={assignedRole}
            onChange={(e) => setAssignedRole(e.target.value)}
            options={[
              { value: 'student', label: '🎓 Student / Learner' },
              { value: 'instructor', label: '👨‍🏫 Instructor / Faculty' },
            ]}
          />

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border text-xs text-slate-500 dark:text-slate-400">
            Once approved, the user's status transitions to <strong>active</strong> and they will be permitted to authenticate to their assigned workspace.
          </div>
        </div>
      </Modal>

      {/* MODAL 3: REJECT REGISTRATION CONFIRMATION */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="Reject Account Registration"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRejectModalOpen(false)}
              disabled={isActionSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmReject}
              isLoading={isActionSubmitting}
              icon={XCircle}
            >
              Reject Application
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Are you sure you want to reject the registration for{' '}
            <strong className="text-slate-900 dark:text-slate-100">{selectedUser?.name}</strong>?
          </p>

          <Input
            label="Rejection Reason (Optional)"
            placeholder="e.g. Unrecognized institute code or invalid campus email"
            value={actionReason}
            onChange={(e) => setActionReason(e.target.value)}
          />

          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-xs text-red-700 dark:text-red-300">
            The account status will transition to <strong>rejected</strong>. The user will be blocked from logging in.
          </div>
        </div>
      </Modal>

      {/* MODAL 4: REVOKE ACTIVE ACCOUNT CONFIRMATION */}
      <Modal
        isOpen={isRevokeModalOpen}
        onClose={() => setIsRevokeModalOpen(false)}
        title="Revoke Active Account Access"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRevokeModalOpen(false)}
              disabled={isActionSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmRevoke}
              isLoading={isActionSubmitting}
              icon={UserX}
            >
              Revoke Account Access
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            You are about to revoke workspace access for active user{' '}
            <strong className="text-slate-900 dark:text-slate-100">{selectedUser?.name}</strong> (
            {selectedUser?.email}).
          </p>

          <Input
            label="Revocation Reason"
            placeholder="e.g. Academic integrity violation or graduation status"
            value={actionReason}
            onChange={(e) => setActionReason(e.target.value)}
          />

          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-xs text-red-700 dark:text-red-300">
            <strong>Warning:</strong> The account status will transition to <strong>revoked</strong> and all active sessions will be terminated immediately.
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminDashboard;
