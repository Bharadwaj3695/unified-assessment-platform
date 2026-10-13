// Import React core library and essential React hooks for component state, lifecycle, and memoization
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
// Import routing hooks from react-router-dom to access URL location and perform programmatic navigation
import { useLocation, useNavigate } from 'react-router-dom';
// Import debounce hook for rate-limiting search queries
import { useDebounce } from '../../hooks/useDebounce';
// Import toast notification utility for displaying feedback messages to the administrator
import { toast } from 'react-toastify';
// Import authentication context hook to retrieve the currently logged-in user profile
import { useAuth } from '../../hooks/useAuth';
// Import utility function that computes a time-sensitive greeting message based on the hour
import { getTimeBasedGreeting } from '../../utils/greeting';
// Import API service layer containing administrative endpoints for stats, users, assessments, and logs
import adminService from '../../services/admin.service';
// Import API service layer for retrieving system analytics and platform telemetry
import analyticsService from '../../services/analytics.service';
// Import reusable Card container component for wrapping dashboard panels
import Card from '../../components/ui/Card';
// Import Badge component for rendering status tags and chips
import Badge from '../../components/ui/Badge';
// Import standard Button component for interactive controls
import Button from '../../components/ui/Button';
// Import reusable text Input component with icon and validation styling
import Input from '../../components/ui/Input';
// Import custom Select dropdown component for filtering lists and form options
import Select from '../../components/ui/Select';
// Import accessible Modal dialog component for user details and confirmation prompts
import Modal from '../../components/ui/Modal';
// Import loading Spinner indicator component
import Spinner from '../../components/ui/Spinner';
// Import DashboardSkeleton, SectionLoader, and TableSkeleton components
import DashboardSkeleton from '../../components/ui/DashboardSkeleton';
import SectionLoader from '../../components/ui/SectionLoader';
import TableSkeleton from '../../components/ui/TableSkeleton';
// Import EmptyState placeholder component displayed when collections contain no items
import EmptyState from '../../components/ui/EmptyState';
// Import ErrorState component for handling failed data requests with retry functionality
import ErrorState from '../../components/ui/ErrorState';
// Import StatCard component for displaying high-level summary KPIs
import StatCard from '../../components/common/StatCard';
// Import ActivityBarChart visualization component for rendering attempt trends
import ActivityBarChart from '../../components/charts/ActivityBarChart';
// Import hero SVG graphic illustration for the administrator console header
import { AdminHeroIllustration } from '../../components/illustrations';
// Import TwoFactorAuthSection component allowing administrator to configure multi-factor authentication
import TwoFactorAuthSection from '../../components/auth/TwoFactorAuthSection';
// Import ProfilePhotoUploader component for profile picture management
import ProfilePhotoUploader from '../../components/common/ProfilePhotoUploader';
// Import structured Table components for rendering tabulated data records
import {
  Table, // Base table wrapper component
  TableHead, // Table header section component
  TableBody, // Table body container component
  TableRow, // Individual table row component
  TableHeader, // Table column header cell component
  TableCell, // Table data cell component
} from '../../components/ui/Table';
// Import Lucide icons used across the administrator dashboard tabs, cards, and modal dialogs
import {
  ShieldCheck, // Icon representing security validation and faculty role
  Users, // Icon representing user management and active student metrics
  GraduationCap,// Icon representing operational telemetry and system activity
  Award,// Icon representing verified or active user status
  UserX, // Icon representing user revocation or deactivation
  Eye, // Icon for inspecting detailed user information
  Search, // Icon for search input fields
  CheckCircle, // Icon for confirming account approvals
  XCircle, // Icon for rejecting registration applications
  RefreshCw, // Icon for manual data synchronization trigger
  Clock,// Icon representing institutional organization code
  Mail, // Icon for institutional email addresses
  Calendar,// Icon representing security alerts
  Archive, // Icon for archiving assessments
  Save,// Icon for operational configuration parameters
  Power,
  Edit, // Icon for modifying registry records
  Trash2, // Icon for deleting registry records
  Plus, // Icon for creating new registry entries
  User, // Icon representing user identity
  Lock, // Icon representing immutable identifiers
} from 'lucide-react';

// Define the primary AdminDashboard functional React component
const AdminDashboard = () => {
  // Extract authenticated user object and refreshProfile method from the authentication context
  const { user, refreshProfile } = useAuth();
  // Retrieve the current router location to inspect URL pathname
  const location = useLocation();
  // Initialize navigate function for programmatic route transitions
  const navigate = useNavigate();

  // Helper function to resolve the active dashboard tab identifier from the URL path
  const getTabFromPath = (path) => {
    // If route path matches admin users directory, return 'users' tab key
    if (path.includes('/admin/users')) return 'users';
    // If route path matches assessment oversight, return 'assessments' tab key
    if (path.includes('/admin/assessments')) return 'assessments';
    // If route path matches audit logging, return 'logs' tab key
    if (path.includes('/admin/logs')) return 'logs';
    // If route path matches platform configuration, return 'settings' tab key
    if (path.includes('/admin/settings')) return 'settings';
    // Default fallback to 'overview' tab for base admin route
    return 'overview';
  };

  // State hook tracking the current active tab initialized from current URL path
  const [activeTab, setActiveTab] = useState(() => getTabFromPath(location.pathname));

  // Effect hook synchronizing activeTab state whenever the browser URL pathname changes
  useEffect(() => {
    // Recompute and update the active tab based on new location pathname
    setActiveTab(getTabFromPath(location.pathname));
  }, [location.pathname]); // Dependency array triggers on route changes

  // Handler function invoked when switching tabs, updating internal state and URL history
  const handleTabChange = (tab, path) => {
    // Update local active tab state
    setActiveTab(tab);
    // Navigate browser to the corresponding route URL
    navigate(path);
  };

  // State variable storing high-level platform summary metrics
  const [stats, setStats] = useState(null);
  // State variable storing deep analytics trends, submission counts, and category breakdowns
  const [platformAnalytics, setPlatformAnalytics] = useState(null);
  // State variable storing all registered platform user records
  const [users, setUsers] = useState([]);
  // State variable storing pending applicant accounts awaiting institutional verification
  const [pendingUsers, setPendingUsers] = useState([]);
  // State variable storing all institutional assessment records
  const [assessments, setAssessments] = useState([]);
  // State variable storing platform audit log entries
  const [logs, setLogs] = useState([]);
  // State variable storing real-time security alerts and summary counters
  const [alertsData, setAlertsData] = useState({ alerts: [], summary: {} });
  // State variable holding controlled form fields for editing system configuration
  const [settingsForm, setSettingsForm] = useState({
    platformName: 'Unified Assessment Platform', // Name of the assessment platform instance
    registrationOpen: true, // Flag indicating whether public account registration is open
    maintenanceMode: false, // Flag indicating whether maintenance mode is activated
    announcementBanner: '', // Global announcement banner message text
    defaultPassingScore: 60, // Standard passing score percentage threshold
    enableEmailNotifications: true, // Flag to toggle transactional email notifications
    maxAttemptDurationHours: 4, // Maximum duration limit for assessment attempts in hours
    supportEmail: 'support@uap.edu', // Official contact email address for institutional support
    allowStudentReview: true, // Flag permitting students to view post-exam evaluation reports
  });
  // State flag tracking whether settings are currently being saved to the backend
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  // State flag indicating initial loading state for dashboard telemetry
  const [isLoading, setIsLoading] = useState(true);
  // State variable storing any fatal error message during data fetching
  const [error, setError] = useState(null);

  // Filter state for filtering the users table by assigned role
  const [userRoleFilter, setUserRoleFilter] = useState('');
  // Filter state for filtering the users table by account status
  const [userStatusFilter, setUserStatusFilter] = useState('');
  // State variable holding the search query string for filtering users
  const [userSearch, setUserSearch] = useState('');
  // State variable tracking the active user management sub-section: 'pending', 'all', or 'registry'
  const [userSection, setUserSection] = useState('pending'); // 'pending', 'all', or 'registry'

  // Pending registration queue state: search query, role filter, selected user IDs, and bulk approval modal
  const [pendingSearch, setPendingSearch] = useState('');
  const [pendingRoleFilter, setPendingRoleFilter] = useState('all');
  const [selectedPendingUserIds, setSelectedPendingUserIds] = useState([]);
  const [isBulkApproveModalOpen, setIsBulkApproveModalOpen] = useState(false);
  const [isBulkRejectModalOpen, setIsBulkRejectModalOpen] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState('');

  // All accounts directory bulk selection and modal state
  const [selectedAllUserIds, setSelectedAllUserIds] = useState([]);
  const [isBulkRevokeModalOpen, setIsBulkRevokeModalOpen] = useState(false);
  const [bulkRevokeReason, setBulkRevokeReason] = useState('');
  const [isBulkApproveAllModalOpen, setIsBulkApproveAllModalOpen] = useState(false);
  const [isBulkRejectAllModalOpen, setIsBulkRejectAllModalOpen] = useState(false);
  const [bulkRejectAllReason, setBulkRejectAllReason] = useState('');

  // State array storing student records fetched from the Master Student Registry
  const [registryRecords, setRegistryRecords] = useState([]);
  // State integer tracking total count of student records in registry for pagination
  const [registryTotal, setRegistryTotal] = useState(0);
  // State integer tracking current pagination page for the student registry table
  const [registryPage, setRegistryPage] = useState(1);
  // State variable holding search term for student registry filtering
  const [registrySearch, setRegistrySearch] = useState('');
  // State variable holding enrollment status filter for student registry
  const [registryStatusFilter, setRegistryStatusFilter] = useState('');
  // State flag indicating loading state while querying the student registry API
  const [isRegistryLoading, setIsRegistryLoading] = useState(false);
  // State flag controlling visibility of the Add/Edit Student Registry modal
  const [isRegistryModalOpen, setIsRegistryModalOpen] = useState(false);
  // State flag differentiating between editing an existing registry record or creating a new one
  const [isEditingRegistry, setIsEditingRegistry] = useState(false);
  // State variable storing the database ID of the student registry record being edited
  const [selectedRegistryId, setSelectedRegistryId] = useState(null);
  // Controlled form state for student registry record creation and modification
  const [registryForm, setRegistryForm] = useState({
    studentId: '', // Official institutional student ID
    name: '', // Full legal name of student
    dateOfBirth: '', // Date of birth formatted string
    email: '', // Academic institutional email
    status: 'active', // Registry status: active, inactive, suspended, or graduated
  });

  // Filter state for filtering assessments table by status: draft, published, archived
  const [assessmentStatusFilter, setAssessmentStatusFilter] = useState('');
  // State variable holding search keyword for assessment titles or categories
  const [assessmentSearch, setAssessmentSearch] = useState('');

  // Filter state for filtering audit logs by specific security action
  const [logActionFilter, setLogActionFilter] = useState('');
  // State variable holding search query for filtering audit log entries
  const [logSearchQuery, setLogSearchQuery] = useState('');

  // Loading states for individual tabs to avoid premature empty states
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [isAssessmentsLoading, setIsAssessmentsLoading] = useState(false);
  const [isLogsLoading, setIsLogsLoading] = useState(false);

  // Request ID refs for preventing race conditions / out-of-order responses
  const usersRequestIdRef = useRef(0);
  const assessmentsRequestIdRef = useRef(0);
  const logsRequestIdRef = useRef(0);

  // Debounced search terms for users, assessments, and logs
  const debouncedUserSearch = useDebounce(userSearch, 300);
  const debouncedAssessmentSearch = useDebounce(assessmentSearch, 300);
  const debouncedLogSearch = useDebounce(logSearchQuery, 300);

  // State variable holding user record selected for inspection or action modals
  const [selectedUser, setSelectedUser] = useState(null);
  // State flag controlling visibility of the detailed user inspection modal
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  // State flag controlling visibility of account approval confirmation modal
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  // State flag controlling visibility of registration rejection confirmation modal
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  // State flag controlling visibility of active access revocation confirmation modal
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  // State string holding administrative reason for account rejection or revocation
  const [actionReason, setActionReason] = useState('');
  // State variable storing role to assign during account approval
  const [assignedRole, setAssignedRole] = useState('student');
  // State flag indicating an asynchronous administrative action is currently submitting
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);

  // State tracking whether settings are currently being loaded
  const [isSettingsLoading, setIsSettingsLoading] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Memoized callback function to fetch core telemetry and dashboard data from the backend
  const loadDashboardData = useCallback(async () => {
    // Set loading indicator to true before issuing network requests
    setIsLoading(true);
    // Clear any previous error message state
    setError(null);
    try {
      // Execute parallel asynchronous requests for core overview administrative datasets
      const [statsData, pendingData, assessmentsRes, alertsRes, analyticsRes] = await Promise.all([
        adminService.getStats(), // Retrieve high-level counts and pass rates
        adminService.getPendingUsers(), // Retrieve pending user registrations
        adminService.getAssessments({ limit: 10 }), // Retrieve overview assessment exams
        adminService.getAlerts().catch(() => ({ alerts: [], summary: {} })), // Fallback on error to empty alerts
        analyticsService.getAdminOverview().catch(() => null), // Fallback on error to null analytics
      ]);

      // Populate dashboard stats state with response data
      setStats(statsData);
      // Populate pending registrations state with response array or fallback empty array
      setPendingUsers(pendingData || []);
      // Populate assessments state with returned array data
      setAssessments(assessmentsRes.data || assessmentsRes.assessments || []);
      // Populate alerts state if response exists
      if (alertsRes) setAlertsData(alertsRes);
      // Populate platform analytics state if response exists
      if (analyticsRes) setPlatformAnalytics(analyticsRes);
    } catch (err) {
      // Catch network or authorization errors and store human-readable message
      setError(err.message || 'Failed to load administrator data from server.');
    } finally {
      // Ensure loading indicator is deactivated upon completion of requests
      setIsLoading(false);
    }
  }, []); // Empty dependency array ensures reference stability

  // Memoized callback to query system configuration on demand
  const loadSettings = useCallback(async () => {
    setIsSettingsLoading(true);
    try {
      const settingsRes = await adminService.getSettings();
      if (settingsRes) {
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
        setSettingsLoaded(true);
      }
    } catch (err) {
      toast.error('Failed to load system settings: ' + err.message);
    } finally {
      setIsSettingsLoading(false);
    }
  }, []);

  // Memoized callback to query the users directory with active role, status, and search filters
  const loadUsersList = useCallback(async (customSearch = null) => {
    const reqId = ++usersRequestIdRef.current;
    setIsUsersLoading(true);
    try {
      // Initialize query parameters object
      const params = {};
      // Include role filter if set
      if (userRoleFilter) params.role = userRoleFilter;
      // Include status filter if set
      if (userStatusFilter) params.status = userStatusFilter;
      // Include trimmed search string if populated
      const effectiveSearch = customSearch !== null && typeof customSearch === 'string'
        ? customSearch.trim()
        : debouncedUserSearch.trim();
      if (effectiveSearch) params.search = effectiveSearch;

      // Send API request to retrieve filtered user records from the backend
      const res = await adminService.getUsers(params);
      if (reqId === usersRequestIdRef.current) {
        // Update users state with response data array or fallback empty list
        setUsers(res.data || res.users || []);
      }
    } catch (err) {
      if (reqId === usersRequestIdRef.current) {
        // Display error toast notification if user retrieval fails
        toast.error('Failed to update users table: ' + err.message);
      }
    } finally {
      if (reqId === usersRequestIdRef.current) {
        setIsUsersLoading(false);
      }
    }
  }, [userRoleFilter, userStatusFilter, debouncedUserSearch]); // Recreate callback when user filters or search terms change

  // Memoized callback to query assessments list matching status and keyword filters
  const loadAssessmentsList = useCallback(async (customSearch = null) => {
    const reqId = ++assessmentsRequestIdRef.current;
    setIsAssessmentsLoading(true);
    try {
      // Initialize query parameters object for assessments
      const params = {};
      // Append status filter parameter if specified
      if (assessmentStatusFilter) params.status = assessmentStatusFilter;
      // Append trimmed search string if specified
      const effectiveSearch = customSearch !== null && typeof customSearch === 'string'
        ? customSearch.trim()
        : debouncedAssessmentSearch.trim();
      if (effectiveSearch) params.search = effectiveSearch;
      // Invoke administrative service endpoint to fetch matching assessments
      const res = await adminService.getAssessments(params);
      if (reqId === assessmentsRequestIdRef.current) {
        // Update assessments state with response array or fallback empty array
        setAssessments(res.data || res.assessments || []);
      }
    } catch (err) {
      if (reqId === assessmentsRequestIdRef.current) {
        // Display error toast message if assessment query encounters an exception
        toast.error('Failed to update assessments table: ' + err.message);
      }
    } finally {
      if (reqId === assessmentsRequestIdRef.current) {
        setIsAssessmentsLoading(false);
      }
    }
  }, [assessmentStatusFilter, debouncedAssessmentSearch]); // Recreate callback when assessment filters change

  // Memoized callback to query audit logs based on selected action filter
  const loadLogsList = useCallback(async () => {
    const reqId = ++logsRequestIdRef.current;
    setIsLogsLoading(true);
    try {
      // Set query parameters requesting up to 50 log records
      const params = { limit: 50 };
      // Include action filter if a specific action type is selected
      if (logActionFilter) params.action = logActionFilter;
      // Invoke administrative service endpoint to fetch audit logs
      const res = await adminService.getLogs(params);
      if (reqId === logsRequestIdRef.current) {
        // Update logs state with response data or fallback empty array
        setLogs(res.data || res.logs || []);
      }
    } catch (err) {
      if (reqId === logsRequestIdRef.current) {
        // Display error toast message if audit log fetching fails
        toast.error('Failed to filter audit logs: ' + err.message);
      }
    } finally {
      if (reqId === logsRequestIdRef.current) {
        setIsLogsLoading(false);
      }
    }
  }, [logActionFilter]); // Recreate callback when log action filter changes

  // Memoized callback to fetch paginated authoritative student records from the master registry
  const loadRegistryList = useCallback(async () => {
    // Set registry loading spinner state to true
    setIsRegistryLoading(true);
    try {
      // Invoke administrative endpoint with pagination page, limit, search query, and status
      const res = await adminService.getStudentRegistry({
        page: registryPage, // Current page index
        limit: 10, // Items per page
        search: registrySearch, // Keyword search string
        status: registryStatusFilter || undefined, // Filter by registry status or undefined
      });
      // Update registry records state with returned data array
      setRegistryRecords(res.data || []);
      // Update total registry count from pagination object or data length
      setRegistryTotal(res.pagination?.total ?? (res.data ? res.data.length : 0));
    } catch (err) {
      // Display error notification toast if registry fetch fails
      toast.error('Failed to load student registry: ' + err.message);
    } finally {
      // Deactivate registry loading indicator
      setIsRegistryLoading(false);
    }
  }, [registryPage, registrySearch, registryStatusFilter]); // Recreate callback when registry pagination or filters change

  // Initial effect hook to trigger initial dashboard data loading on mount
  useEffect(() => {
    // Execute dashboard data loader
    loadDashboardData();
  }, [loadDashboardData]); // Dependency array referencing stable loader callback

  // Effect hook to process deep-linked applicant or user inspections from notifications
  const lastProcessedSearchRef = useRef('');

  useEffect(() => {
    // Only process if location.search has changed and is non-empty
    if (!location.search || location.search === lastProcessedSearchRef.current) return;

    const searchParams = new URLSearchParams(location.search);
    const applicantId = searchParams.get('applicantId') || searchParams.get('userId');
    const applicantEmail = searchParams.get('applicantEmail') || searchParams.get('email');
    const linkedAssessmentId = searchParams.get('assessmentId');
    const linkedAction = searchParams.get('action');

    if (!applicantId && !applicantEmail && !linkedAssessmentId && !linkedAction) return;

    lastProcessedSearchRef.current = location.search;

    // Handle deep-linked assessment administration
    if (linkedAssessmentId) {
      setActiveTab('assessments');
      setAssessmentSearch(linkedAssessmentId);
      return;
    }

    // Handle deep-linked audit logs
    if (linkedAction) {
      setActiveTab('logs');
      setLogActionFilter(linkedAction);
      return;
    }

    // Handle deep-linked applicant / user inspection
    const resolveAndOpenApplicant = async () => {
      // Ensure we switch to the users tab and pending queue
      setActiveTab('users');
      setUserSection('pending');

      if (applicantId) {
        try {
          // Authoritative lookup via backend user details endpoint
          const fullDetails = await adminService.getUserDetails(applicantId);
          if (fullDetails) {
            setSelectedUser(fullDetails);
            setIsDetailsModalOpen(true);
            return;
          }
        } catch (err) {
          console.warn('[AdminDashboard] Deep-link applicant ID lookup failed:', err.message);
          // Show clear feedback instead of opening an unrelated record
          toast.info('Applicant record not found or already processed.');
          return;
        }
      }

      if (applicantEmail) {
        // Pre-fill pending search filter so the table filters directly to this applicant
        setPendingSearch(applicantEmail);

        try {
          // Query pending users matching this email
          const pendingRes = await adminService.getPendingUsers();
          const matchInPending = (pendingRes || []).find(
            (u) => u.email?.toLowerCase() === applicantEmail.toLowerCase()
          );

          if (matchInPending) {
            const fullDetails = await adminService.getUserDetails(matchInPending._id || matchInPending.id);
            setSelectedUser(fullDetails);
            setIsDetailsModalOpen(true);
            return;
          }

          // If not in pending queue, check general users directory
          const usersRes = await adminService.getUsers({ search: applicantEmail });
          const userList = usersRes.data || usersRes.users || [];
          const matchInUsers = userList.find(
            (u) => u.email?.toLowerCase() === applicantEmail.toLowerCase()
          );

          if (matchInUsers) {
            const fullDetails = await adminService.getUserDetails(matchInUsers._id || matchInUsers.id);
            setSelectedUser(fullDetails);
            setIsDetailsModalOpen(true);
            return;
          }

          toast.info(`No applicant found with email ${applicantEmail}.`);
        } catch (err) {
          console.warn('[AdminDashboard] Deep-link applicant email lookup error:', err.message);
          toast.info('Could not resolve applicant details from notification.');
        }
      }
    };

    resolveAndOpenApplicant();
  }, [location.search]);

  // Effect hook that responds to activeTab and userSection switching within the users area
  useEffect(() => {
    // If the active tab is users and section is all accounts, load all users
    if (activeTab === 'users' && userSection === 'all') {
      loadUsersList();
    // Else if the active tab is users and section is master registry, load registry list
    } else if (activeTab === 'users' && userSection === 'registry') {
      loadRegistryList();
    }
  }, [activeTab, userSection, loadUsersList, loadRegistryList]); // Trigger on tab, section, or handler updates

  // Effect hook to fetch assessments list whenever the assessments tab becomes active
  useEffect(() => {
    // Verify assessments tab is selected
    if (activeTab === 'assessments') {
      // Fetch assessments with current filters
      loadAssessmentsList();
    }
  }, [activeTab, loadAssessmentsList]); // Trigger on tab switch or handler change

  // Effect hook to fetch audit logs list whenever the logs tab becomes active
  useEffect(() => {
    // Verify audit logs tab is selected
    if (activeTab === 'logs') {
      // Fetch logs with current filters
      loadLogsList();
    }
  }, [activeTab, loadLogsList]); // Trigger on tab switch or handler change

  // Effect hook to fetch system settings on demand when settings tab is active
  useEffect(() => {
    if (activeTab === 'settings' && !settingsLoaded) {
      loadSettings();
    }
  }, [activeTab, settingsLoaded, loadSettings]);

  // Memoized transformation formatting platform activity telemetry into chart-ready data points
  const activityChartData = useMemo(() => {
    // Verify that activity trend data exists and is populated
    if (platformAnalytics?.activityTrend && platformAnalytics.activityTrend.length > 0) {
      // Map raw analytics objects to chart dataset format
      return platformAnalytics.activityTrend.map((item) => ({
        name: item.date, // Label displayed on chart horizontal axis
        submissions: item.submissions, // Bar height metric for total submissions
        passes: item.passed, // Metric for successful passed submissions
      }));
    }
    // Return undefined if analytics trend data is unavailable
    return undefined;
  }, [platformAnalytics]); // Recompute only when platformAnalytics changes

  // Helper utility function to format audit timestamp into human-readable 12-hour clock format
  const formatAuditTime = (dateString) => {
    // Return placeholder dash if dateString is empty or null
    if (!dateString) return '—';
    // Instantiate Date object from string
    const d = new Date(dateString);
    // Return placeholder dash if date string is invalid
    if (isNaN(d.getTime())) return '—';
    // Format to local US time string with hours, minutes, seconds, and AM/PM indicator
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric', // Numeric hour format
      minute: '2-digit', // Two-digit minute format
      second: '2-digit', // Two-digit second format
      hour12: true, // Use 12-hour notation with AM/PM
    });
  };

  // Helper utility function to format audit timestamp into short date representation (e.g. 15 Mar 2026)
  const formatAuditDate = (dateString) => {
    // Return empty string if dateString is falsy
    if (!dateString) return '';
    // Instantiate Date object
    const d = new Date(dateString);
    // Return empty string if date is invalid
    if (isNaN(d.getTime())) return '';
    // Extract day of month
    const day = d.getDate();
    // Month abbreviations lookup table
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    // Lookup abbreviated month name
    const month = months[d.getMonth()];
    // Extract full 4-digit year
    const year = d.getFullYear();
    // Format and return day month year string
    return `${day} ${month} ${year}`;
  };

  // Helper utility to normalize audit user data across various schema shapes into standard fields
  const getNormalizedAuditUser = (log) => {
    // Resolve raw role string across nested userId, log details, or fallback to 'Admin'
    const rawRole =
      log.userId?.role ||
      log.details?.role ||
      log.details?.targetRole ||
      'Admin';
    // Capitalize first letter of role and lowercase remainder
    const role = rawRole.charAt(0).toUpperCase() + rawRole.slice(1).toLowerCase();

    // Resolve username across user object, details name, or details username
    let username =
      log.userId?.name ||
      log.details?.name ||
      log.details?.username;

    // If username is still not resolved, attempt fallback heuristics
    if (!username) {
      // Derive name from target email prefix if available
      if (log.details?.targetEmail) {
        // Extract local email part before '@'
        const localPart = log.details.targetEmail.split('@')[0];
        // Capitalize local email part as display username
        username = localPart.charAt(0).toUpperCase() + localPart.slice(1);
      // Fallback for admin role
      } else if (role === 'Admin') {
        username = 'System Administrator';
      // Generic operator fallback
      } else {
        username = 'System Operator';
      }
    }

    // Resolve email across user object, details email, targetEmail, or institutional admin address
    const email =
      log.userId?.email ||
      log.details?.email ||
      log.details?.targetEmail ||
      (role === 'Admin' ? 'admin@uap.edu' : '—');

    // Return normalized user info object
    return { username, email, role };
  };

  // Memoized filter that filters audit logs by keyword match against action, username, email, or role
  const filteredLogs = useMemo(() => {
    // If no search query provided, return full logs array
    if (!debouncedLogSearch.trim()) return logs;
    // Lowercase and trim search query string
    const q = debouncedLogSearch.toLowerCase().trim();
    // Filter logs by checking whether query matches action or normalized user fields
    return logs.filter((log) => {
      // Extract normalized user details for current log
      const { username, email, role } = getNormalizedAuditUser(log);
      // Check for partial substring match in any key attribute
      return (
        (log.action && log.action.toLowerCase().includes(q)) ||
        username.toLowerCase().includes(q) ||
        email.toLowerCase().includes(q) ||
        role.toLowerCase().includes(q)
      );
    });
  }, [logs, debouncedLogSearch]); // Recompute when logs array or debounced search query changes

  // Handler function to fetch complete profile and open the detailed account modal
  const handleOpenDetails = async (targetUser) => {
    try {
      // Fetch comprehensive user profile from admin service using MongoDB id
      const fullDetails = await adminService.getUserDetails(targetUser._id || targetUser.id);
      // Store loaded user record in selectedUser state
      setSelectedUser(fullDetails);
      // Open the user details inspection modal
      setIsDetailsModalOpen(true);
    } catch (err) {
      // Display error notification toast if details request fails
      toast.error('Failed to load user details: ' + err.message);
    }
  };

  // Handler function to open account approval confirmation modal with initial role pre-selected
  const handleOpenApprove = (targetUser) => {
    // Store user targeted for approval
    setSelectedUser(targetUser);
    // Pre-select role requested by applicant or default to student
    setAssignedRole(targetUser.role || 'student');
    // Open approval confirmation dialog
    setIsApproveModalOpen(true);
  };

  // Asynchronous handler confirming user approval and role assignment
  const handleConfirmApprove = async () => {
    // Guard clause verifying a target user is selected
    if (!selectedUser) return;
    // Set submitting flag to true to show loading state
    setIsActionSubmitting(true);
    try {
      const targetId = (selectedUser._id || selectedUser.id).toString();
      // Invoke administrative approval endpoint with user ID and assigned role
      await adminService.approveUser(targetId, { role: assignedRole });
      // Notify admin with success toast message
      toast.success(`Account approved for ${selectedUser.name}!`);
      // Dismiss the approval modal dialog
      setIsApproveModalOpen(false);
      // Remove approved user from pending list immediately
      setPendingUsers((prev) => prev.filter((u) => (u._id || u.id).toString() !== targetId));
      setSelectedPendingUserIds((prev) => prev.filter((id) => id !== targetId));
      // Refresh top-level dashboard telemetry and counters
      loadDashboardData();
      // If currently viewing the all accounts section, refresh users list
      if (userSection === 'all') loadUsersList();
    } catch (err) {
      // Notify admin of approval error with toast message
      toast.error(err.message || 'Failed to approve account');
    } finally {
      // Deactivate submitting loading state
      setIsActionSubmitting(false);
    }
  };

  // Handler function to open rejection confirmation modal and clear previous rejection reason
  const handleOpenReject = (targetUser) => {
    // Store target user record
    setSelectedUser(targetUser);
    // Reset rejection reason text field
    setActionReason('');
    // Open rejection confirmation modal
    setIsRejectModalOpen(true);
  };

  // Asynchronous handler confirming user rejection with administrative justification
  const handleConfirmReject = async () => {
    // Guard clause ensuring a target user is defined
    if (!selectedUser) return;
    // Activate submission loading state
    setIsActionSubmitting(true);
    try {
      const targetId = (selectedUser._id || selectedUser.id).toString();
      // Invoke reject endpoint with user ID and either specified or default justification reason
      await adminService.rejectUser(targetId, {
        reason: actionReason.trim() || 'Institutional eligibility verification unsuccessful.',
      });
      // Display warning toast notifying administrator of application rejection
      toast.warning(`Application rejected for ${selectedUser.name}`);
      // Close rejection modal dialog
      setIsRejectModalOpen(false);
      // Remove rejected user from pending list immediately
      setPendingUsers((prev) => prev.filter((u) => (u._id || u.id).toString() !== targetId));
      setSelectedPendingUserIds((prev) => prev.filter((id) => id !== targetId));
      // Reload dashboard telemetry counters
      loadDashboardData();
      // If on all users section, reload users list
      if (userSection === 'all') loadUsersList();
    } catch (err) {
      // Display error notification toast if rejection request fails
      toast.error(err.message || 'Failed to reject application');
    } finally {
      // Deactivate submitting loading state
      setIsActionSubmitting(false);
    }
  };

  // Asynchronous handler confirming bulk approval of selected pending users
  const handleConfirmBulkApprove = async () => {
    if (selectedPendingUserIds.length === 0) return;
    setIsActionSubmitting(true);
    try {
      // Reconcile with currently visible/filtered users as safety guarantee
      const idsToApprove = selectedPendingUserIds.filter((id) =>
        filteredPendingUsers.some((u) => (u._id || u.id).toString() === id)
      );

      const res = await adminService.bulkApproveUsers(idsToApprove);
      const data = res.data || res;
      const approvedCount = data.approvedCount || 0;
      const skippedCount = data.skippedCount || 0;
      const approvedIds = data.approvedUserIds || [];

      if (skippedCount > 0) {
        toast.info(`Bulk approval completed: ${approvedCount} approved, ${skippedCount} skipped.`);
      } else {
        toast.success(`Successfully approved ${approvedCount} registration${approvedCount !== 1 ? 's' : ''}!`);
      }

      // Remove successfully approved users from pending list immediately
      setPendingUsers((prev) =>
        prev.filter((u) => !approvedIds.includes((u._id || u.id).toString()))
      );

      // Deselect approved user IDs
      setSelectedPendingUserIds((prev) => prev.filter((id) => !approvedIds.includes(id)));

      // Dismiss modal
      setIsBulkApproveModalOpen(false);

      // Refresh top-level dashboard telemetry and counters
      loadDashboardData();
    } catch (err) {
      toast.error(err.message || 'Failed to bulk approve users');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  // Asynchronous handler confirming bulk rejection of selected pending users
  const handleConfirmBulkReject = async () => {
    if (selectedPendingUserIds.length === 0) return;
    setIsActionSubmitting(true);
    try {
      // Reconcile with currently visible/filtered users as safety guarantee
      const idsToReject = selectedPendingUserIds.filter((id) =>
        filteredPendingUsers.some((u) => (u._id || u.id).toString() === id)
      );

      const res = await adminService.bulkRejectUsers(idsToReject, {
        reason: bulkRejectReason.trim() || 'Institutional eligibility verification unsuccessful.',
      });
      const data = res.data || res;
      const rejectedCount = data.rejectedCount || 0;
      const skippedCount = data.skippedCount || 0;
      const rejectedIds = data.rejectedUserIds || [];

      if (skippedCount > 0) {
        toast.info(`Bulk rejection completed: ${rejectedCount} rejected, ${skippedCount} skipped.`);
      } else {
        toast.warning(`Successfully rejected ${rejectedCount} registration${rejectedCount !== 1 ? 's' : ''}.`);
      }

      // Remove successfully rejected users from pending list immediately
      setPendingUsers((prev) =>
        prev.filter((u) => !rejectedIds.includes((u._id || u.id).toString()))
      );

      // Deselect rejected user IDs
      setSelectedPendingUserIds((prev) => prev.filter((id) => !rejectedIds.includes(id)));

      // Dismiss modal
      setIsBulkRejectModalOpen(false);

      // Refresh top-level dashboard telemetry and counters
      loadDashboardData();
    } catch (err) {
      toast.error(err.message || 'Failed to bulk reject users');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  // Filter pending users by search string and role filter
  const filteredPendingUsers = useMemo(() => {
    return pendingUsers.filter((u) => {
      // Role filter: 'all', 'student', or 'instructor'
      if (pendingRoleFilter !== 'all' && u.role !== pendingRoleFilter) {
        return false;
      }
      // Search query across name, email, studentId, facultyId, instituteCode
      if (pendingSearch.trim()) {
        const q = pendingSearch.trim().toLowerCase();
        const nameMatch = u.name?.toLowerCase().includes(q);
        const emailMatch = u.email?.toLowerCase().includes(q);
        const studentIdMatch = u.studentId?.toLowerCase().includes(q);
        const facultyIdMatch = u.facultyId?.toLowerCase().includes(q);
        const instituteMatch = u.instituteCode?.toLowerCase().includes(q);
        return Boolean(nameMatch || emailMatch || studentIdMatch || facultyIdMatch || instituteMatch);
      }
      return true;
    });
  }, [pendingUsers, pendingRoleFilter, pendingSearch]);

  // Reconcile selected user IDs with visible filtered users to prevent accidental approval of hidden records
  useEffect(() => {
    setSelectedPendingUserIds((prev) => {
      const visibleIds = new Set(filteredPendingUsers.map((u) => (u._id || u.id).toString()));
      const next = prev.filter((id) => visibleIds.has(id));
      if (next.length !== prev.length) {
        return next;
      }
      return prev;
    });
  }, [filteredPendingUsers]);

  // Master checkbox selection state for visible items
  const isAllPendingSelected =
    filteredPendingUsers.length > 0 &&
    filteredPendingUsers.every((u) =>
      selectedPendingUserIds.includes((u._id || u.id).toString())
    );

  const isPendingPartiallySelected =
    selectedPendingUserIds.length > 0 && !isAllPendingSelected;

  // Toggle selection for all currently visible pending users
  const handleToggleSelectAllPending = (e) => {
    if (e.target.checked) {
      const allVisibleIds = filteredPendingUsers.map((u) => (u._id || u.id).toString());
      setSelectedPendingUserIds(allVisibleIds);
    } else {
      setSelectedPendingUserIds([]);
    }
  };

  // Toggle selection for an individual applicant
  const handleToggleSelectPendingUser = (userId) => {
    const idStr = (userId || '').toString();
    setSelectedPendingUserIds((prev) =>
      prev.includes(idStr) ? prev.filter((id) => id !== idStr) : [...prev, idStr]
    );
  };

  // Reconcile selected user IDs with loaded all-users array to avoid stale selections
  useEffect(() => {
    setSelectedAllUserIds((prev) => {
      const visibleIds = new Set(users.map((u) => (u._id || u.id).toString()));
      const next = prev.filter((id) => visibleIds.has(id));
      if (next.length !== prev.length) {
        return next;
      }
      return prev;
    });
  }, [users]);

  // Derived selections for All Platform Accounts directory
  const selectedAllUsersList = useMemo(() => {
    const selectedSet = new Set(selectedAllUserIds);
    return users.filter((u) => selectedSet.has((u._id || u.id).toString()));
  }, [users, selectedAllUserIds]);

  // Active accounts within current selection (eligible for revocation)
  const selectedActiveUsers = useMemo(() => {
    return selectedAllUsersList.filter((u) => u.status === 'active');
  }, [selectedAllUsersList]);

  // Pending accounts within current selection (eligible for approval or rejection)
  const selectedPendingInAllUsers = useMemo(() => {
    return selectedAllUsersList.filter((u) => u.status === 'pending');
  }, [selectedAllUsersList]);

  // Master checkbox selection state for All Platform Accounts visible items
  const isAllUsersSelected =
    users.length > 0 &&
    users.every((u) => selectedAllUserIds.includes((u._id || u.id).toString()));

  const isUsersPartiallySelected =
    selectedAllUserIds.length > 0 && !isAllUsersSelected;

  // Toggle selection for all currently visible users in All Platform Accounts
  const handleToggleSelectAllUsers = (e) => {
    if (e.target.checked) {
      const allIds = users.map((u) => (u._id || u.id).toString());
      setSelectedAllUserIds(allIds);
    } else {
      setSelectedAllUserIds([]);
    }
  };

  // Toggle selection for a single user in All Platform Accounts
  const handleToggleSelectUserRow = (userId) => {
    const idStr = (userId || '').toString();
    setSelectedAllUserIds((prev) =>
      prev.includes(idStr) ? prev.filter((id) => id !== idStr) : [...prev, idStr]
    );
  };

  // Handler confirming bulk revocation of active users
  const handleConfirmBulkRevoke = async () => {
    const activeIds = selectedActiveUsers.map((u) => (u._id || u.id).toString());
    if (activeIds.length === 0) {
      toast.warning('No active users selected for revocation.');
      return;
    }

    try {
      setIsActionSubmitting(true);
      const res = await adminService.bulkRevokeUsers(activeIds, {
        reason: bulkRevokeReason.trim() || 'Account access revoked by administrator',
      });

      toast.success(res.message || `${res.data?.revokedCount || activeIds.length} active account(s) revoked successfully`);
      setSelectedAllUserIds([]);
      setIsBulkRevokeModalOpen(false);
      loadDashboardData();
      loadUsersList();
    } catch (err) {
      toast.error(err.message || 'Failed to bulk revoke users');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  // Handler confirming bulk approval of pending users from All Accounts directory
  const handleConfirmBulkApproveFromAll = async () => {
    const pendingIds = selectedPendingInAllUsers.map((u) => (u._id || u.id).toString());
    if (pendingIds.length === 0) {
      toast.warning('No pending users selected for approval.');
      return;
    }

    try {
      setIsActionSubmitting(true);
      const res = await adminService.bulkApproveUsers(pendingIds);
      toast.success(res.message || `${res.data?.approvedCount || pendingIds.length} user(s) approved successfully`);
      setSelectedAllUserIds([]);
      setIsBulkApproveAllModalOpen(false);
      loadDashboardData();
      loadUsersList();
    } catch (err) {
      toast.error(err.message || 'Failed to bulk approve users');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  // Handler confirming bulk rejection of pending users from All Accounts directory
  const handleConfirmBulkRejectFromAll = async () => {
    const pendingIds = selectedPendingInAllUsers.map((u) => (u._id || u.id).toString());
    if (pendingIds.length === 0) {
      toast.warning('No pending users selected for rejection.');
      return;
    }

    try {
      setIsActionSubmitting(true);
      const res = await adminService.bulkRejectUsers(pendingIds, {
        reason: bulkRejectAllReason.trim() || 'Registration rejected by administrator',
      });
      toast.success(res.message || `${res.data?.rejectedCount || pendingIds.length} user(s) rejected successfully`);
      setSelectedAllUserIds([]);
      setIsBulkRejectAllModalOpen(false);
      loadDashboardData();
      loadUsersList();
    } catch (err) {
      toast.error(err.message || 'Failed to bulk reject users');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  // Handler restoring an individual revoked or deactivated user account
  const handleRestoreUser = async (targetUser) => {
    try {
      setIsActionSubmitting(true);
      const res = await adminService.restoreUser(targetUser._id || targetUser.id);
      toast.success(res.message || `Account access restored for ${targetUser.name}`);
      loadDashboardData();
      loadUsersList();
    } catch (err) {
      toast.error(err.message || 'Failed to restore account');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  // Handler function to open active account access revocation modal
  const handleOpenRevoke = (targetUser) => {
    // Store user targeted for access revocation
    setSelectedUser(targetUser);
    // Clear previous revocation reason
    setActionReason('');
    // Open revocation confirmation modal
    setIsRevokeModalOpen(true);
  };

  // Asynchronous handler confirming immediate revocation of active user credentials
  const handleConfirmRevoke = async () => {
    // Guard clause ensuring a target user is defined
    if (!selectedUser) return;
    // Set submitting flag to true to render loading state
    setIsActionSubmitting(true);
    try {
      // Invoke administrative revocation endpoint with user ID and reason
      await adminService.revokeUser(selectedUser._id || selectedUser.id, {
        reason: actionReason.trim() || 'Access revoked by administrator.',
      });
      // Notify administrator with error/revocation toast
      toast.error(`Account revoked for ${selectedUser.name}`);
      // Close revocation modal dialog
      setIsRevokeModalOpen(false);
      // Reload dashboard metrics and revoked count
      loadDashboardData();
      // If viewing all accounts, refresh users list
      if (userSection === 'all') loadUsersList();
    } catch (err) {
      // Display error toast message if revocation API call fails
      toast.error(err.message || 'Failed to revoke account access');
    } finally {
      // Reset submitting loading state
      setIsActionSubmitting(false);
    }
  };

  // Asynchronous handler toggling account active / inactive status for non-admin accounts
  const handleToggleUserStatus = async (targetUser) => {
    try {
      // Invoke service endpoint to toggle user activation status
      const res = await adminService.toggleUserStatus(targetUser._id || targetUser.id);
      // Display success toast with response message
      toast.success(res.message || 'Account status updated');
      // Reload dashboard telemetry
      loadDashboardData();
      // If viewing all accounts, refresh users list
      if (userSection === 'all') loadUsersList();
    } catch (err) {
      // Display error toast if toggle operation fails
      toast.error(err.message || 'Failed to toggle account status');
    }
  };

  // Handler function preparing the modal to add a brand new student to the master registry
  const handleOpenAddRegistry = () => {
    // Set edit mode flag to false indicating creation mode
    setIsEditingRegistry(false);
    // Clear any selected registry ID
    setSelectedRegistryId(null);
    // Reset registry form fields to empty defaults
    setRegistryForm({
      studentId: '', // Empty initial student ID
      name: '', // Empty initial student name
      dateOfBirth: '', // Empty initial date of birth
      email: '', // Empty initial email
      status: 'active', // Default initial status set to active
    });
    // Open registry modal dialog
    setIsRegistryModalOpen(true);
  };

  // Handler function preparing the modal to edit an existing student in the master registry
  const handleOpenEditRegistry = (record) => {
    // Set edit mode flag to true
    setIsEditingRegistry(true);
    // Store MongoDB id of selected registry record
    setSelectedRegistryId(record._id || record.id);
    // Initialize variable for formatted birth date string
    let dobFormatted = '';
    // If date of birth exists, format to standard YYYY-MM-DD string for date input
    if (record.dateOfBirth) {
      dobFormatted = typeof record.dateOfBirth === 'string'
        ? record.dateOfBirth.slice(0, 10)
        : new Date(record.dateOfBirth).toISOString().slice(0, 10);
    }
    // Populate registry form state with existing record details
    setRegistryForm({
      studentId: record.studentId || '', // Pre-fill student identifier
      name: record.name || '', // Pre-fill student full name
      dateOfBirth: dobFormatted, // Pre-fill formatted birth date
      email: record.email || '', // Pre-fill student academic email
      status: record.status || 'active', // Pre-fill enrollment status
    });
    // Open registry modal dialog
    setIsRegistryModalOpen(true);
  };

  // Asynchronous form submit handler saving student registry additions or updates
  const handleSaveRegistryRecord = async (e) => {
    // Prevent default browser form submission refresh
    e.preventDefault();
    // Activate submission loading state
    setIsActionSubmitting(true);
    try {
      // If editing an existing record, invoke update endpoint
      if (isEditingRegistry && selectedRegistryId) {
        // Send update request to server
        await adminService.updateStudentRegistryRecord(selectedRegistryId, registryForm);
        // Display success toast notification
        toast.success(`Registry record updated for ${registryForm.name}`);
      } else {
        // Else send create request for new authoritative student entry
        await adminService.createStudentRegistryRecord(registryForm);
        // Display creation success toast
        toast.success(`Student ${registryForm.name} added to master registry`);
      }
      // Dismiss the student registry modal
      setIsRegistryModalOpen(false);
      // Refresh registry table records
      loadRegistryList();
    } catch (err) {
      // Notify administrator of failure with error toast
      toast.error(err.message || 'Registry operation failed');
    } finally {
      // Deactivate submitting loading state
      setIsActionSubmitting(false);
    }
  };

  // Asynchronous handler deleting an authoritative student record from the master registry
  const handleDeleteRegistryRecord = async (record) => {
    // Resolve record identifier
    const id = record._id || record.id;
    // Display browser confirmation prompt before permanent record deletion
    if (!window.confirm(`Are you sure you want to remove student "${record.name}" (${record.studentId}) from the master registry?`)) {
      return; // Abort operation if admin cancels prompt
    }
    try {
      // Call service endpoint to delete student registry record
      await adminService.deleteStudentRegistryRecord(id);
      // Display success toast confirming removal
      toast.success(`Student record removed from registry`);
      // Reload registry table records
      loadRegistryList();
    } catch (err) {
      // Display error toast if deletion fails
      toast.error(err.message || 'Failed to remove registry record');
    }
  };

  // Asynchronous handler allowing administrator to archive, publish, or draft an assessment
  const handleUpdateAssessmentStatus = async (assessmentId, newStatus) => {
    try {
      // Send update status request to administrative assessment endpoint
      await adminService.updateAssessmentStatus(assessmentId, newStatus);
      // Display success toast confirming new status transition
      toast.success(`Assessment marked as ${newStatus}`);
      // Refresh overall dashboard statistics
      loadDashboardData();
      // Refresh assessments list
      loadAssessmentsList();
    } catch (err) {
      // Display error toast if status update fails
      toast.error(err.message || 'Failed to update assessment status');
    }
  };

  // Asynchronous handler for persisting updated platform and system settings
  const handleSaveSettings = async (e) => {
    // Prevent default form submission event if triggered from form submit
    e?.preventDefault();
    // Activate settings saving state
    setIsSavingSettings(true);
    try {
      // Send updated settings object to backend service
      await adminService.updateSettings(settingsForm);
      // Display success toast notification
      toast.success('System settings updated successfully!');
      // Reload dashboard telemetry to reflect updated rules
      loadDashboardData();
    } catch (err) {
      // Display error toast if settings update fails
      toast.error(err.message || 'Failed to update system settings');
    } finally {
      // Deactivate saving loading state
      setIsSavingSettings(false);
    }
  };

  // Render loading skeleton matching current active tab while initial telemetry is loading
  if (isLoading && !stats) {
    if (activeTab === 'users') {
      return (
        <div className="space-y-5">
          <Card title="User Management" subtitle="Review pending applicant accounts and directory">
            <TableSkeleton rows={5} columns={6} />
          </Card>
        </div>
      );
    }
    if (activeTab === 'assessments') {
      return (
        <Card title="Platform Assessment Oversight" subtitle="System-wide review of examinations, author assignments, access types, and status moderation">
          <TableSkeleton rows={5} columns={6} />
        </Card>
      );
    }
    if (activeTab === 'logs') {
      return (
        <Card title="System Audit Logs" subtitle="Immutable compliance trail of administrative decisions, authentication challenges, and system events">
          <TableSkeleton rows={5} columns={4} />
        </Card>
      );
    }
    if (activeTab === 'settings') {
      return (
        <Card title="Global Platform Settings" subtitle="Institutional configuration parameters, registration policies, and maintenance mode">
          <TableSkeleton rows={4} columns={3} />
        </Card>
      );
    }
    return <DashboardSkeleton />;
  }

  // Render full-screen ErrorState component if data fetching encountered an unrecoverable error
  if (error && !stats) {
    return (
      // Render standard error state with retry callback
      <ErrorState
        title="Admin Telemetry Unavailable" // Error heading
        message={error} // Displayed error message description
        onRetry={loadDashboardData} // Retry button callback function
      />
    );
  }

  // Helper function returning appropriate badge color variant string based on audit action name
  const getActionBadgeVariant = (action) => {
    // Return 'danger' variant for security failures, unauthorized attempts, and revocations
    if (['LOGIN_FAILED', 'REVOKED_USER_LOGIN_ATTEMPT', 'USER_REVOKED', 'FACULTY_REGISTRY_DELETED'].includes(action)) return 'danger';
    // Return 'warning' variant for rejections and status modifications
    if (['USER_REJECTED', 'ASSESSMENT_STATUS_UPDATED', 'FACULTY_REGISTRY_UPDATED'].includes(action)) return 'warning';
    // Return 'success' variant for account approvals, activations, and creations
    if (['USER_APPROVED', 'USER_ACTIVATED', 'STUDENT_ACCOUNT_CREATED', 'STUDENT_REGISTRY_CREATED', 'STUDENT_BULK_IMPORT_COMPLETED', 'FACULTY_ACCOUNT_CREATED', 'FACULTY_REGISTRY_CREATED'].includes(action)) return 'success';
    // Return 'primary' variant for system configuration changes
    if (['SETTINGS_UPDATED'].includes(action)) return 'primary';
    // Default fallback to 'neutral' variant
    return 'neutral';
  };

  // Return the main administrative dashboard view JSX hierarchy
  return (
    // Top-level container div with responsive vertical spacing
    <div className="space-y-4 sm:space-y-5 lg:space-y-6">
      {/* Overview Header Banner card & Stat Cards - strictly scoped to overview route */}
      {activeTab === 'overview' && (
        <>
          {/* Header Banner card with warm gradient background and subtle border */}
          <div className="rounded-2xl border border-[#EBE3D8] dark:border-[#2D3748] bg-gradient-to-r from-[#FFF4ED] via-[#FFFDFB] to-[#F3F7FB] dark:from-[#341C16] dark:via-[#1A202C] dark:to-[#12161F] p-5 sm:p-6 lg:py-5 lg:px-7 shadow-warm-xs relative overflow-hidden">
            {/* Responsive flex row separating headline and action illustration */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 sm:gap-6 relative z-10">
              {/* Left container enclosing title and greeting metadata */}
              <div className="max-w-xl">
                {/* Tagline wrapper with status badge and subtitle dot */}
                <div className="flex items-center space-x-2 mb-1.5 sm:mb-2">
                  {/* Branded terracotta badge for System Governance */}
                  <Badge variant="terracotta" size="sm" dot>System Governance</Badge>
                  {/* Subtitle label marking institutional master console */}
                  <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">· Institutional Master Console</span>
                {/* Close tag wrapper */}
                </div>
                {/* Main dashboard greeting heading incorporating user name */}
                <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-[#1F2937] dark:text-[#F9FAFB]">
                  {getTimeBasedGreeting(user?.name)}
                </h1>
                {/* Welcoming descriptive subheader text */}
                <p className="mt-1.5 sm:mt-2 text-sm text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                  Welcome back. Here's your platform administration overview.
                </p>
              {/* Close headline container */}
              </div>

              {/* Right action container with hero graphic illustration and manual refresh button */}
              <div className="flex items-center space-x-4">
                {/* Decorative hero illustration visible on medium screens and larger */}
                <div className="hidden md:flex flex-shrink-0 items-center justify-center">

                  {/* SVG vector illustration for institutional admin hero banner */}
                  <AdminHeroIllustration className="w-36 h-24 sm:w-44 sm:h-28 lg:w-48 lg:h-32 object-contain drop-shadow-sm" />
                {/* Close hero illustration wrapper */}
                </div>
                {/* Button to manually refresh and synchronize all platform datasets */}
                <Button
                  variant="outline" /* Outline styling variant */
                  size="sm" /* Small button size */
                  icon={RefreshCw} /* Refresh clockwise icon */
                  onClick={() => {
                    // Fetch fresh telemetry and counter stats
                    loadDashboardData();
                    // If currently on users tab, reload users table
                    if (activeTab === 'users') loadUsersList();
                    // If currently on assessments tab, reload assessments table
                    if (activeTab === 'assessments') loadAssessmentsList();
                    // If currently on audit logs tab, reload audit logs
                    if (activeTab === 'logs') loadLogsList();
                  }}
                >
                  Refresh Data
                </Button>
              {/* Close right action container */}
              </div>
            {/* Close flex row container */}
            </div>

            {/* Tab Navigation Bar container with top separator border and pill layout */}
            <div className="mt-4 sm:mt-5 flex flex-wrap gap-2 border-t border-[#EBE3D8] dark:border-[#2D3748] pt-3 sm:pt-3.5">
              {/* Tab Button: System Overview */}
              <button
                type="button" /* Explicit button type */
                onClick={() => handleTabChange('overview', '/admin/dashboard')} /* Route to admin overview */
                className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                  activeTab === 'overview'
                    ? 'bg-[#E05D38] text-white shadow-warm-xs' // Active terracotta accent styling
                    : 'bg-white dark:bg-[#1A202C] text-[#64748B] dark:text-[#94A3B8] hover:text-[#1F2937] hover:bg-[#FFF9F2] dark:hover:bg-[#2D3748] border border-[#EBE3D8] dark:border-[#2D3748]' // Inactive subtle styling
                }`}
              >
                System Overview
              </button>

              {/* Tab Button: User Management with dynamic pending counter badge */}
              <button
                type="button" /* Explicit button type */
                onClick={() => {
                  // Reset sub-section view to pending queue
                  setUserSection('pending');
                  // Switch tab and navigate to /admin/users route
                  handleTabChange('users', '/admin/users');
                }}
                className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer ${
                  activeTab === 'users'
                    ? 'bg-[#E05D38] text-white shadow-warm-xs' // Active terracotta accent styling
                    : 'bg-white dark:bg-[#1A202C] text-[#64748B] dark:text-[#94A3B8] hover:text-[#1F2937] hover:bg-[#FFF9F2] dark:hover:bg-[#2D3748] border border-[#EBE3D8] dark:border-[#2D3748]' // Inactive subtle styling
                }`}
              >
                {/* Tab label text */}
                <span>User Management</span>
                {/* Conditional badge indicating unreviewed pending applicant count */}
                {pendingUsers.length > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    activeTab === 'users' ? 'bg-white text-[#E05D38]' : 'bg-[#F4A261] text-white'
                  }`}>
                    {pendingUsers.length}
                  </span>
                )}
              </button>

              {/* Tab Button: All Assessments with total exam count */}
              <button
                type="button" /* Explicit button type */
                onClick={() => handleTabChange('assessments', '/admin/assessments')} /* Route to assessment oversight */
                className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                  activeTab === 'assessments'
                    ? 'bg-[#E05D38] text-white shadow-warm-xs' // Active terracotta accent styling
                    : 'bg-white dark:bg-[#1A202C] text-[#64748B] dark:text-[#94A3B8] hover:text-[#1F2937] hover:bg-[#FFF9F2] dark:hover:bg-[#2D3748] border border-[#EBE3D8] dark:border-[#2D3748]' // Inactive subtle styling
                }`}
              >
                All Assessments ({stats?.totalAssessments || assessments.length})
              </button>

              {/* Tab Button: Audit Logs */}
              <button
                type="button" /* Explicit button type */
                onClick={() => handleTabChange('logs', '/admin/logs')} /* Route to audit logs */
                className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                  activeTab === 'logs'
                    ? 'bg-[#E05D38] text-white shadow-warm-xs' // Active terracotta accent styling
                    : 'bg-white dark:bg-[#1A202C] text-[#64748B] dark:text-[#94A3B8] hover:text-[#1F2937] hover:bg-[#FFF9F2] dark:hover:bg-[#2D3748] border border-[#EBE3D8] dark:border-[#2D3748]' // Inactive subtle styling
                }`}
              >
                Audit Logs
              </button>

              {/* Tab Button: System Settings */}
              <button
                type="button" /* Explicit button type */
                onClick={() => handleTabChange('settings', '/admin/settings')} /* Route to platform settings */
                className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-[#E05D38] text-white shadow-warm-xs' // Active terracotta accent styling
                    : 'bg-white dark:bg-[#1A202C] text-[#64748B] dark:text-[#94A3B8] hover:text-[#1F2937] hover:bg-[#FFF9F2] dark:hover:bg-[#2D3748] border border-[#EBE3D8] dark:border-[#2D3748]' // Inactive subtle styling
                }`}
              >
                System Settings
              </button>
            {/* Close tab navigation bar container */}
            </div>
          {/* Close header banner card */}
          </div>

          {/* Overview Stat Cards responsive 4-column grid container */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* StatCard 1: Active Enrolled Students */}
            <StatCard
              title="Active Students" /* Title of summary metric */
              value={platformAnalytics?.totalActiveStudents ?? stats?.activeUsersCount ?? '—'} /* Active student count or fallback */
              subtitle={`${stats?.totalUsers ?? 0} total registered · ${stats?.revokedUsersCount ?? 0} revoked`} /* Subtitle with registered and revoked totals */
              icon={Users} /* Users icon */
              color="primary" /* Terracotta primary color accent */
            />
            {/* StatCard 2: Pending Institutional Account Approvals */}
            <StatCard
              title="Pending Approvals" /* Title of pending metric */
              value={pendingUsers.length} /* Count of pending applicants */
              subtitle="Applicants awaiting review" /* Explanatory subtitle */
              icon={Clock} /* Clock icon indicating queue waiting time */
              color="peach" /* Warm peach color accent */
            />
            {/* StatCard 3: Faculty Instructors Count */}
            <StatCard
              title="Faculty Instructors" /* Title of instructor metric */
              value={platformAnalytics?.totalInstructors ?? stats?.totalInstructors ?? '—'} /* Instructor total count */
              subtitle={`${platformAnalytics?.publishedAssessments ?? 0} published · ${platformAnalytics?.totalAssessments ?? assessments.length} total exams`} /* Assessment summary counts */
              icon={ShieldCheck} /* Shield check icon */
              color="sage" /* Calming sage green color accent */
            />
            {/* StatCard 4: Platform Overall Pass Rate */}
            <StatCard
              title="Platform Pass Rate" /* Title of pass rate achievement */
              value={
                // Compute percentage string from analytics or fallback stats
                platformAnalytics?.overallPassRate !== undefined
                  ? `${platformAnalytics.overallPassRate}%`
                  : stats?.passRate !== undefined
                  ? `${stats.passRate}%`
                  : '—'
              }
              subtitle={`Avg Score: ${platformAnalytics?.overallAverageScore ?? stats?.averageScore ?? 0}% · ${platformAnalytics?.completedSubmissions ?? stats?.passedSubmissions ?? 0} completed`} /* Detailed score and submission totals */
              icon={Award} /* Award medal icon */
              color="secondary" /* Secondary accent styling */
            />
          {/* Close overview stat cards grid */}
          </div>
        </>
      )}

      {/* TAB 1: SYSTEM OVERVIEW PANEL */}
      {activeTab === 'overview' && (
        // Wrapper for system overview tab panels
        <div className="space-y-6">
          {/* Quick Pending Alert banner conditionally shown if any applicant registrations are pending */}
          {pendingUsers.length > 0 && (
            // Amber alert container with rounded borders and responsive flex layout
            <div className="p-4 rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Alert icon and descriptive text container */}
              <div className="flex items-center space-x-3">
                {/* Exclamation point visual badge */}
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold">
                  !
                </div>
                {/* Alert copy and context */}
                <div>
                  {/* Alert title stating count of registrations requiring review */}
                  <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    {pendingUsers.length} Registration{pendingUsers.length > 1 ? 's' : ''} Awaiting Approval
                  </h4>
                  {/* Instructional description regarding pending verification */}
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    New institutional users have registered and require verification before they can authenticate.
                  </p>
                {/* Close alert copy container */}
                </div>
              {/* Close alert icon/text container */}
              </div>
              {/* Navigation button directing admin directly to pending applications queue */}
              <Button
                variant="primary" /* Primary accent style */
                size="sm" /* Small button size */
                onClick={() => {
                  // Switch to pending user section
                  setUserSection('pending');
                  // Switch tab and navigate to /admin/users
                  handleTabChange('users', '/admin/users');
                }}
              >
                Review Applications →
              </Button>
            {/* Close quick pending alert container */}
            </div>
          )}

          {/* Operational Alerts & Security Overview Card shown if alerts exist */}
          {alertsData?.alerts?.length > 0 && (
            // Card container for real-time security events
            <Card
              title="Operational & Security Alerts" /* Card title */
              subtitle="Real-time detection of failed logins, revoked access attempts, and audit events" /* Explanatory subtitle */
            >
              {/* 3-column metric cards highlighting critical security incident counters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                {/* Metric 1: Failed Login attempts */}
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40">
                  {/* Metric label */}
                  <span className="text-xs font-semibold text-rose-700 dark:text-rose-300 block">
                    Failed Logins
                  </span>
                  {/* Metric counter value */}
                  <span className="text-xl font-bold text-rose-900 dark:text-rose-100">
                    {alertsData?.summary?.failedLoginsCount ?? 0}
                  </span>
                {/* Close failed logins metric box */}
                </div>
                {/* Metric 2: Revoked User Access attempts */}
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40">
                  {/* Metric label */}
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 block">
                    Revoked User Attempts
                  </span>
                  {/* Metric counter value */}
                  <span className="text-xl font-bold text-amber-900 dark:text-amber-100">
                    {alertsData?.summary?.revokedAttemptsCount ?? 0}
                  </span>
                {/* Close revoked user metric box */}
                </div>
                {/* Metric 3: Pending verification count */}
                <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40">
                  {/* Metric label */}
                  <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 block">
                    Pending Verification
                  </span>
                  {/* Metric counter value */}
                  <span className="text-xl font-bold text-indigo-900 dark:text-indigo-100">
                    {pendingUsers.length}
                  </span>
                {/* Close pending verification metric box */}
                </div>
              {/* Close 3-column metric cards container */}
              </div>

              {/* Scrollable list of recent security incident items */}
              <div className="divide-y divide-surface-light-border dark:divide-surface-dark-border max-h-56 overflow-y-auto">
                {/* Map over the 6 most recent alert items */}
                {alertsData.alerts.slice(0, 6).map((item) => (
                  // Alert list row with flex alignment
                  <div key={item._id || item.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    {/* Left side displaying indicator dot, action badge, and target email */}
                    <div className="flex items-center space-x-2.5">
                      {/* Red status indicator dot */}
                      <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />

                      {/* Badge displaying the action name with dynamic variant styling */}
                      <Badge variant={getActionBadgeVariant(item.action)} size="sm" className="font-mono text-[10px]">
                        {item.action}
                      </Badge>
                      {/* Monospace truncated target email or stringified payload details */}
                      <span className="text-slate-600 dark:text-slate-400 font-mono truncate max-w-xs sm:max-w-md">
                        {item.details?.email || item.details?.targetEmail || (typeof item.details === 'string' ? item.details : JSON.stringify(item.details))}
                      </span>
                    {/* Close left side alert container */}
                    </div>
                    {/* Timestamp display for the security alert */}
                    <span className="text-slate-400 whitespace-nowrap text-[11px]">
                      {item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  {/* Close alert list row item */}
                  </div>
                ))}
              {/* Close scrollable alerts container */}
              </div>
            {/* Close operational alerts Card */}
            </Card>
          )}

          {/* 12-column responsive grid pairing examinations table with activity telemetry */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7-column card showing live platform examinations */}
            <div className="lg:col-span-7 space-y-4">
              {/* Card wrapper for institutional examinations */}
              <Card
                title="Institutional Examinations" /* Card heading */
                subtitle="Live platform assessments and active cohorts" /* Card subtitle */
                action={
                  // Header action button linking to assessments tab
                  <button
                    onClick={() => handleTabChange('assessments', '/admin/assessments')} /* Switch to assessments tab */
                    className="text-xs font-semibold text-brand-primary hover:underline cursor-pointer" /* Styling */
                  >
                    View All →
                  </button>
                }
              >
                {/* Conditional rendering: check if assessments collection is empty */}
                {assessments.length === 0 ? (
                  // Empty state placeholder when no exams exist
                  <EmptyState
                    title="No assessments" /* Empty state title */
                    description="No examinations are currently created." /* Empty state description */
                  />
                ) : (
                  // Render tabulated assessments
                  <Table>
                    {/* Table column headers */}
                    <TableHead>
                      <TableRow>
                        <TableHeader>Title</TableHeader>
                        <TableHeader>Author</TableHeader>
                        <TableHeader>Passing Score</TableHeader>
                        <TableHeader className="text-right">Status</TableHeader>
                      </TableRow>
                    </TableHead>
                    {/* Table body listing up to 5 recent assessments */}
                    <TableBody>
                      {assessments.slice(0, 5).map((item) => (
                        // Individual assessment row
                        <TableRow key={item._id || item.id}>
                          {/* Title and Category cell */}
                          <TableCell>
                            {/* Assessment title in bold */}
                            <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                              {item.title}
                            </span>
                            {/* Category caption */}
                            <span className="text-xs text-slate-400">{item.category}</span>
                          </TableCell>
                          {/* Author cell displaying instructor name or fallback */}
                          <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                            {item.instructorId?.name || 'Faculty'}
                          </TableCell>
                          {/* Passing score threshold cell */}
                          <TableCell className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {item.passingScore}%
                          </TableCell>
                          {/* Status badge cell with color coding */}
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
              {/* Close examinations card */}
              </Card>
            {/* Close 7-column wrapper */}
            </div>

            {/* Right 5-column card rendering attempt telemetry bar chart */}
            <div className="lg:col-span-5 space-y-4">
              {/* Card wrapper for attempt telemetry */}
              <Card
                title="Attempt Telemetry" /* Card heading */
                subtitle="Platform submission activity" /* Card subtitle */
              >
                {/* Render bar chart visualization of submission attempts */}
                <ActivityBarChart
                  data={activityChartData} /* Chart dataset array */
                  barKey="submissions" /* Data key for bar values */
                  barLabel="Total Attempts" /* Legend label for attempts */
                  barColor="#E05D38" /* Terracotta accent bar color */
                  height={220} /* Chart display height in pixels */
                />
                {/* Telemetry footer summary counters */}
                <div className="mt-4 pt-3 border-t border-surface-light-border dark:border-surface-dark-border flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  {/* Completed submissions counter */}
                  <span>Completed: <strong>{platformAnalytics?.completedSubmissions ?? stats?.totalSubmissions ?? 0}</strong></span>
                  {/* Total evaluations counter */}
                  <span>Evaluations: <strong>{platformAnalytics?.evaluatedSubmissions ?? 0} Total</strong></span>
                {/* Close telemetry footer */}
                </div>
              {/* Close telemetry card */}
              </Card>
            {/* Close 5-column wrapper */}
            </div>
          {/* Close 12-column grid */}
          </div>

          {/* Curriculum Category Distribution card conditionally shown if categories exist */}
          {platformAnalytics?.categories && platformAnalytics.categories.length > 0 && (
            // Card wrapper for category distribution metrics
            <Card
              title="Curriculum & Category Distribution" /* Card heading */
              subtitle="Breakdown of assessment examinations across institutional categories" /* Card subtitle */
            >
              {/* Responsive grid displaying category cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {/* Map over platform curriculum categories */}
                {platformAnalytics.categories.map((cat) => (
                  // Individual category card container
                  <div
                    key={cat.category}
                    className="p-4 rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark flex items-center justify-between"
                  >
                    {/* Category name and published ratio */}
                    <div>
                      {/* Category label */}
                      <span className="font-bold text-slate-900 dark:text-slate-100 block text-xs">
                        {cat.category}
                      </span>
                      {/* Publication status caption */}
                      <span className="text-[11px] text-slate-500">
                        {cat.published} of {cat.totalAssessments} published
                      </span>
                    {/* Close category info */}
                    </div>
                    {/* Badge displaying total count of exams in this category */}
                    <Badge variant={cat.published > 0 ? 'success' : 'neutral'} size="sm">
                      {cat.totalAssessments} Exam{cat.totalAssessments !== 1 ? 's' : ''}
                    </Badge>
                  {/* Close category card */}
                  </div>
                ))}
              {/* Close category cards grid */}
              </div>
            {/* Close category distribution card */}
            </Card>
          )}
        {/* Close system overview panel */}
        </div>
      )}

      {/* TAB 2: USER MANAGEMENT & ACCOUNT APPROVAL */}
      {activeTab === 'users' && (
        // User management container with vertical spacing
        <div className="space-y-5">
          {/* Sub-section switcher navigation bar */}
          <div className="flex items-center justify-between">
            {/* Pill button toggle group */}
            <div className="flex items-center space-x-2 bg-slate-100 dark:bg-surface-dark-muted p-1 rounded-xl">
              {/* Button switching to Pending Approvals queue */}
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
              {/* Button switching to All Platform Accounts directory */}
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
              {/* Button switching to Student Master Registry management */}
              <button
                type="button"
                onClick={() => {
                  setUserSection('registry');
                  loadRegistryList();
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1.5 ${
                  userSection === 'registry'
                    ? 'bg-white dark:bg-surface-dark text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <span>Student Master Registry</span>
              </button>
            {/* Close toggle group */}
            </div>

            {/* Explanatory description shown for pending queue */}
            {userSection === 'pending' && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Displaying unverified accounts awaiting institutional action
              </span>
            )}
            {/* Explanatory description shown for student master registry */}
            {userSection === 'registry' && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Authoritative institutional registry used for instant student verification
              </span>
            )}
          {/* Close sub-section switcher */}
          </div>

          {/* Pending Accounts Queue View displayed when userSection is 'pending' */}
          {userSection === 'pending' && (
            // Card wrapper for pending registration queue
            <Card
              title="Pending Registration Queue" /* Card heading */
              subtitle="Inspect applicant details, verify institutional credentials, and approve or reject accounts" /* Card subtitle */
            >
              {/* Search and Role Filter Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
                <div className="flex-1 max-w-md">
                  <Input
                    id="pendingSearchInput"
                    placeholder="Search name, email, ID..."
                    value={pendingSearch}
                    onChange={(e) => setPendingSearch(e.target.value)}
                    icon={Search}
                  />
                </div>
                <div className="w-full sm:w-48">
                  <Select
                    id="pendingRoleFilterSelect"
                    value={pendingRoleFilter}
                    onChange={(e) => setPendingRoleFilter(e.target.value)}
                    options={[
                      { value: 'all', label: 'All' },
                      { value: 'student', label: 'Students' },
                      { value: 'instructor', label: 'Faculty' },
                    ]}
                  />
                </div>
              </div>

              {/* Bulk Selection and Action Header Bar */}
              <div className="flex items-center justify-between bg-slate-50 dark:bg-surface-dark-muted/60 p-2.5 px-3 rounded-xl border border-surface-light-border dark:border-surface-dark-border mb-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="selectAllPending"
                    checked={isAllPendingSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isPendingPartiallySelected;
                    }}
                    onChange={handleToggleSelectAllPending}
                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary dark:bg-surface-dark cursor-pointer"
                  />
                  <label
                    htmlFor="selectAllPending"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none"
                  >
                    Select All
                  </label>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Selected: <span className="font-bold text-slate-900 dark:text-slate-100">{selectedPendingUserIds.length}</span>
                  </span>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={CheckCircle}
                    disabled={selectedPendingUserIds.length === 0}
                    onClick={() => setIsBulkApproveModalOpen(true)}
                  >
                    Approve Selected
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={XCircle}
                    disabled={selectedPendingUserIds.length === 0}
                    onClick={() => {
                      setBulkRejectReason('');
                      setIsBulkRejectModalOpen(true);
                    }}
                  >
                    Reject Selected
                  </Button>
                </div>
              </div>

              {/* Check if pending queue is empty or filter produces no results */}
              {pendingUsers.length === 0 ? (
                // Empty state when all registrations are processed
                <EmptyState
                  title="No pending registrations."
                  description="No Pending Approvals — All submitted registrations have been verified and processed."
                />
              ) : filteredPendingUsers.length === 0 ? (
                // Empty state when filters/search yield no matches
                <EmptyState
                  title={
                    pendingSearch.trim()
                      ? 'No pending registrations match your search.'
                      : pendingRoleFilter === 'student'
                      ? 'No pending student registrations.'
                      : pendingRoleFilter === 'instructor'
                      ? 'No pending faculty registrations.'
                      : 'No pending registrations.'
                  }
                  description={
                    pendingSearch.trim()
                      ? 'No registrations matched your search query. Try clearing or modifying your search terms.'
                      : pendingRoleFilter === 'student'
                      ? 'There are currently no student accounts awaiting registration approval.'
                      : pendingRoleFilter === 'instructor'
                      ? 'There are currently no faculty accounts awaiting registration approval.'
                      : 'All applicant registrations have been processed.'
                  }
                />
              ) : (
                // Table of pending registrations
                <>
                  <Table>
                    {/* Column headers for pending applications */}
                    <TableHead>
                      <TableRow>
                        <TableHeader className="w-10 text-center">
                          <span className="sr-only">Select</span>
                        </TableHeader>
                        <TableHeader>Applicant</TableHeader>
                        <TableHeader>Academic ID / DOB</TableHeader>
                        <TableHeader>Requested Role</TableHeader>
                        <TableHeader>Institute Code</TableHeader>
                        <TableHeader>Registration Date</TableHeader>
                        <TableHeader>Status</TableHeader>
                        <TableHeader className="text-right">Actions</TableHeader>
                      </TableRow>
                    </TableHead>
                    {/* Table body listing pending applicant rows */}
                    <TableBody>
                      {filteredPendingUsers.map((u) => (
                        // Row for individual applicant
                        <TableRow key={u._id || u.id}>
                          {/* Row Selection Checkbox */}
                          <TableCell className="w-10 text-center">
                            <input
                              type="checkbox"
                              checked={selectedPendingUserIds.includes((u._id || u.id).toString())}
                              onChange={() => handleToggleSelectPendingUser(u._id || u.id)}
                              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary dark:bg-surface-dark cursor-pointer"
                              aria-label={`Select ${u.name}`}
                            />
                          </TableCell>
                          {/* Applicant Name and Email */}
                          <TableCell>
                            <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                              {u.name}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">{u.email}</span>
                          </TableCell>
                          {/* Academic Student ID/Faculty ID and Date of Birth */}
                          <TableCell className="text-xs">
                            <span className="font-mono font-medium text-slate-800 dark:text-slate-200 block">
                              {u.role === 'instructor'
                                ? u.facultyId || (u.studentId ? `ID: ${u.studentId}` : 'Faculty ID pending')
                                : u.studentId || 'To be assigned'}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {u.dateOfBirth ? new Date(u.dateOfBirth).toLocaleDateString() : 'DOB not provided'}
                            </span>
                          </TableCell>
                          {/* Requested Role badge */}
                          <TableCell>
                            <Badge variant={u.role === 'instructor' ? 'sage' : 'secondary'} size="sm">
                              {u.role === 'instructor' ? 'Faculty' : 'Student'}
                            </Badge>
                          </TableCell>
                          {/* Institutional college code */}
                          <TableCell className="text-xs font-mono text-slate-600 dark:text-slate-400">
                            {u.instituteCode || 'None provided'}
                          </TableCell>
                          {/* Registration creation date */}
                          <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                          </TableCell>
                          {/* Pending Review status badge */}
                          <TableCell>
                            <Badge variant="warning" size="sm" dot>Pending</Badge>
                          </TableCell>
                          {/* Actions column: Details, Approve, Reject buttons */}
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              {/* View complete applicant details button */}
                              <Button
                                variant="outline"
                                size="sm"
                                icon={Eye}
                                onClick={() => handleOpenDetails(u)}
                              >
                                Details
                              </Button>
                              {/* Open approve application modal button */}
                              <Button
                                variant="primary"
                                size="sm"
                                icon={CheckCircle}
                                onClick={() => handleOpenApprove(u)}
                              >
                                Approve
                              </Button>
                              {/* Open reject application modal button */}
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
                  {/* Bottom bulk action buttons */}
                  <div className="flex justify-center items-center space-x-3 pt-4 border-t border-surface-light-border dark:border-surface-dark-border mt-3">
                    <Button
                      variant="primary"
                      size="md"
                      icon={CheckCircle}
                      disabled={selectedPendingUserIds.length === 0}
                      onClick={() => setIsBulkApproveModalOpen(true)}
                    >
                      Approve Selected
                    </Button>
                    <Button
                      variant="danger"
                      size="md"
                      icon={XCircle}
                      disabled={selectedPendingUserIds.length === 0}
                      onClick={() => {
                        setBulkRejectReason('');
                        setIsBulkRejectModalOpen(true);
                      }}
                    >
                      Reject Selected
                    </Button>
                  </div>
                </>
              )}
            </Card>
          )}

            {/* All Users Directory View with Search & Role Filters */}
            {userSection === 'all' && (
              // Card wrapper for comprehensive all-accounts repository
              <Card
                title="All Platform Accounts" /* Card heading */
                subtitle="Comprehensive repository of active, pending, rejected, and revoked users" /* Card subtitle */
              >
                {/* 12-column responsive filter bar */}
                <div className="mb-4 grid grid-cols-1 sm:grid-cols-12 gap-3">
                  {/* Search input column taking 5 spans */}
                  <div className="sm:col-span-5">
                    {/* Search text input for name, email, or institutional code */}
                    <Input
                      placeholder="Search by name, email, or code..."
                      icon={Search}
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      onKeyDown={(e) => {
                        // Execute users search on Enter key press
                        if (e.key === 'Enter') loadUsersList();
                      }}
                    />
                  {/* Close search column */}
                  </div>
                  {/* Role filter dropdown taking 3 spans */}
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
                  {/* Close role filter column */}
                  </div>
                  {/* Status filter dropdown taking 3 spans */}
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
                  {/* Close status filter column */}
                  </div>
                  {/* Search action button taking 1 span */}
                  <div className="sm:col-span-1">
                    <Button
                      variant="outline"
                      size="md"
                      fullWidth
                      icon={Search}
                      onClick={loadUsersList}
                      aria-label="Search users"
                    />
                  {/* Close search button column */}
                  </div>
                {/* Close filter bar grid */}
                </div>

                {/* Bulk Selection and Action Header Bar for All Platform Accounts */}
                {users.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 dark:bg-surface-dark-muted/60 p-2.5 px-3 rounded-xl border border-surface-light-border dark:border-surface-dark-border mb-3">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="selectAllUsers"
                        checked={isAllUsersSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = isUsersPartiallySelected;
                        }}
                        onChange={handleToggleSelectAllUsers}
                        className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary dark:bg-surface-dark cursor-pointer"
                      />
                      <label
                        htmlFor="selectAllUsers"
                        className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none"
                      >
                        Select All
                      </label>
                    </div>
                    <div className="flex items-center flex-wrap gap-2 sm:gap-2.5">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 mr-1">
                        Selected: <span className="font-bold text-slate-900 dark:text-slate-100">{selectedAllUserIds.length}</span>
                      </span>

                      {/* Status-aware bulk actions: Pending users support Approve and Reject */}
                      {(userStatusFilter === 'pending' || selectedPendingInAllUsers.length > 0 || userStatusFilter === '') && (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            icon={CheckCircle}
                            disabled={selectedPendingInAllUsers.length === 0}
                            onClick={() => setIsBulkApproveAllModalOpen(true)}
                          >
                            Approve Selected {selectedPendingInAllUsers.length > 0 ? `(${selectedPendingInAllUsers.length})` : ''}
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            icon={XCircle}
                            disabled={selectedPendingInAllUsers.length === 0}
                            onClick={() => {
                              setBulkRejectAllReason('');
                              setIsBulkRejectAllModalOpen(true);
                            }}
                          >
                            Reject Selected {selectedPendingInAllUsers.length > 0 ? `(${selectedPendingInAllUsers.length})` : ''}
                          </Button>
                        </>
                      )}

                      {/* Status-aware bulk actions: Active users support Revoke */}
                      {(userStatusFilter === 'active' || selectedActiveUsers.length > 0 || userStatusFilter === '') && (
                        <Button
                          variant="danger"
                          size="sm"
                          icon={UserX}
                          disabled={selectedActiveUsers.length === 0}
                          onClick={() => {
                            setBulkRevokeReason('');
                            setIsBulkRevokeModalOpen(true);
                          }}
                        >
                          Revoke Selected {selectedActiveUsers.length > 0 ? `(${selectedActiveUsers.length})` : ''}
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Conditional loading skeleton and empty state for users directory */}
                {isUsersLoading && users.length === 0 ? (
                  <TableSkeleton rows={5} columns={6} />
                ) : users.length === 0 ? (
                  <EmptyState
                    title="No matching users"
                    description="Try adjusting your search criteria or role filters."
                  />
                ) : (
                  // Render tabulated accounts directory
                  <>
                  <Table>
                    {/* Column headers for users directory */}
                    <TableHead>
                      <TableRow>
                        <TableHeader className="w-10">
                          <input
                            type="checkbox"
                            id="selectAllUsersTh"
                            checked={isAllUsersSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = isUsersPartiallySelected;
                            }}
                            onChange={handleToggleSelectAllUsers}
                            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary dark:bg-surface-dark cursor-pointer"
                            aria-label="Select all users"
                          />
                        </TableHeader>
                        <TableHeader>Name / Email</TableHeader>
                        <TableHeader>Role</TableHeader>
                        <TableHeader>Institute Code</TableHeader>
                        <TableHeader>Status</TableHeader>
                        <TableHeader>Registered</TableHeader>
                        <TableHeader className="text-right">Actions</TableHeader>
                      </TableRow>
                    </TableHead>
                    {/* Table body rendering user rows */}
                    <TableBody>
                      {users.map((u) => (
                        // Individual user record row
                        <TableRow key={u._id || u.id}>
                          {/* Selection Checkbox cell */}
                          <TableCell className="w-10">
                            <input
                              type="checkbox"
                              checked={selectedAllUserIds.includes((u._id || u.id).toString())}
                              onChange={() => handleToggleSelectUserRow(u._id || u.id)}
                              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary dark:bg-surface-dark cursor-pointer"
                              aria-label={`Select user ${u.name}`}
                            />
                          </TableCell>
                          {/* Name and email cell */}
                          <TableCell>
                            {/* User full name in bold */}
                            <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                              {u.name}
                            </span>
                            {/* Email address caption */}
                            <span className="text-xs text-slate-500 dark:text-slate-400">{u.email}</span>
                          </TableCell>
                          {/* User Role Badge */}
                          <TableCell>
                            <Badge
                              variant={u.role === 'admin' ? 'primary' : u.role === 'instructor' ? 'sage' : 'secondary'}
                              size="sm"
                            >
                              {u.role}
                            </Badge>
                          </TableCell>
                          {/* Institutional code cell */}
                          <TableCell className="text-xs font-mono text-slate-600 dark:text-slate-400">
                            {u.instituteCode || '—'}
                          </TableCell>
                          {/* Account status badge */}
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
                          {/* Registration date cell */}
                          <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                          </TableCell>
                          {/* Contextual actions column based on user state */}
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              {/* View full user profile modal button */}
                              <Button
                                variant="outline"
                                size="sm"
                                icon={Eye}
                                onClick={() => handleOpenDetails(u)}
                              >
                                View
                              </Button>

                              {/* If account is pending, render quick Approve and Reject buttons */}
                              {u.status === 'pending' && (
                                <>
                                  {/* Approve pending applicant button */}
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    icon={CheckCircle}
                                    onClick={() => handleOpenApprove(u)}
                                  >
                                    Approve
                                  </Button>
                                  {/* Reject pending applicant button */}
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

                              {/* If account is not admin, allow toggling active/inactive status */}
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

                              {/* If account is active and non-admin, render access Revocation button */}
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

                              {/* If account is revoked and non-admin, render Restore button */}
                              {u.status === 'revoked' && u.role !== 'admin' && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  icon={CheckCircle}
                                  onClick={() => handleRestoreUser(u)}
                                  title="Restore Account Access"
                                >
                                  Restore
                                </Button>
                              )}
                            {/* Close actions wrapper */}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Bulk Selection Footer Bar */}
                  {selectedAllUserIds.length > 0 && (
                    <div className="flex items-center justify-between bg-slate-50 dark:bg-surface-dark-muted/60 p-2.5 px-3 rounded-xl border border-surface-light-border dark:border-surface-dark-border mt-3">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        Selected: <span className="font-bold text-slate-900 dark:text-slate-100">{selectedAllUserIds.length}</span> user(s)
                      </span>
                      <div className="flex items-center gap-2">
                        {selectedPendingInAllUsers.length > 0 && (
                          <>
                            <Button
                              variant="primary"
                              size="sm"
                              icon={CheckCircle}
                              onClick={() => setIsBulkApproveAllModalOpen(true)}
                            >
                              Approve Selected ({selectedPendingInAllUsers.length})
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              icon={XCircle}
                              onClick={() => {
                                setBulkRejectAllReason('');
                                setIsBulkRejectAllModalOpen(true);
                              }}
                            >
                              Reject Selected ({selectedPendingInAllUsers.length})
                            </Button>
                          </>
                        )}
                        {selectedActiveUsers.length > 0 && (
                          <Button
                            variant="danger"
                            size="sm"
                            icon={UserX}
                            onClick={() => {
                              setBulkRevokeReason('');
                              setIsBulkRevokeModalOpen(true);
                            }}
                          >
                            Revoke Selected ({selectedActiveUsers.length})
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  </>
                )}
              {/* Close all accounts directory card */}
              </Card>
            )}

          {/* Master Student Registry Management View */}
          {userSection === 'registry' && (
            // Card wrapper for institution student master registry
            <Card
              title="Institution Student Master Registry" /* Card heading */
              subtitle="Authoritative student records for automated verification and identity validation" /* Card subtitle */
              headerAction={
                // Primary action button to open Add Master Student modal
                <Button
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  onClick={handleOpenAddRegistry}
                >
                  Add Master Student
                </Button>
              }
            >
              {/* Registry Search & Status Filters Bar */}
              <div className="mb-4 grid grid-cols-1 sm:grid-cols-12 gap-3">
                {/* Search input column taking 8 grid columns */}
                <div className="sm:col-span-8">
                  {/* Search input for student ID, name, or institutional email */}
                  <Input
                    placeholder="Search by student ID, name, or institutional email..."
                    icon={Search}
                    value={registrySearch}
                    onChange={(e) => setRegistrySearch(e.target.value)}
                    onKeyDown={(e) => {
                      // Execute registry search on Enter key press
                      if (e.key === 'Enter') loadRegistryList();
                    }}
                  />
                {/* Close search column */}
                </div>
                {/* Status filter dropdown taking 3 grid columns */}
                <div className="sm:col-span-3">
                  <Select
                    options={[
                      { value: '', label: 'All Registry Statuses' },
                      { value: 'active', label: 'Active' },
                      { value: 'inactive', label: 'Inactive' },
                      { value: 'suspended', label: 'Suspended' },
                      { value: 'graduated', label: 'Graduated' },
                    ]}
                    value={registryStatusFilter}
                    onChange={(e) => setRegistryStatusFilter(e.target.value)}
                  />
                {/* Close status dropdown column */}
                </div>
                {/* Search submit button taking 1 grid column */}
                <div className="sm:col-span-1">
                  <Button
                    variant="outline"
                    size="md"
                    fullWidth
                    icon={Search}
                    onClick={loadRegistryList}
                    aria-label="Search registry"
                  />
                {/* Close button column */}
                </div>
              {/* Close filters bar grid */}
              </div>

              {/* Conditional loading spinner while querying registry */}
              {isRegistryLoading ? (
                <div className="py-12 flex justify-center">
                  <Spinner size="lg" />
                </div>
              // Conditional empty state when no registry records exist
              ) : registryRecords.length === 0 ? (
                <EmptyState
                  title="No Student Registry Records Found"
                  description="No master records match your search criteria. Add authoritative student entries to enable automated registration."
                  actionLabel="Add Master Student"
                  onAction={handleOpenAddRegistry}
                />
              // Render tabulated master student registry records
              ) : (
                <>
                  {/* Registry records Table */}
                  <Table>
                    {/* Registry column headers */}
                    <TableHead>
                      <TableRow>
                        <TableHeader>Student ID</TableHeader>
                        <TableHeader>Full Name</TableHeader>
                        <TableHeader>Date of Birth</TableHeader>
                        <TableHeader>Institutional Email</TableHeader>
                        <TableHeader>Registry Status</TableHeader>
                        <TableHeader className="text-right">Actions</TableHeader>
                      </TableRow>
                    </TableHead>
                    {/* Registry body with student rows */}
                    <TableBody>
                      {registryRecords.map((r) => (
                        // Individual student registry row
                        <TableRow key={r._id || r.id}>
                          {/* Student ID in bold terracotta monospace font */}
                          <TableCell className="font-mono font-bold text-xs text-brand-terracotta dark:text-brand-peach">
                            {r.studentId}
                          </TableCell>
                          {/* Full Name in semibold font */}
                          <TableCell className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                            {r.name}
                          </TableCell>
                          {/* Date of Birth formatted as YYYY-MM-DD */}
                          <TableCell className="text-xs text-slate-600 dark:text-slate-300">
                            {r.dateOfBirth
                              ? (typeof r.dateOfBirth === 'string' ? r.dateOfBirth.slice(0, 10) : new Date(r.dateOfBirth).toISOString().slice(0, 10))
                              : '—'}
                          </TableCell>
                          {/* Institutional email */}
                          <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                            {r.email}
                          </TableCell>
                          {/* Registry Status Badge */}
                          <TableCell>
                            <Badge
                              variant={
                                r.status === 'active'
                                  ? 'success'
                                  : r.status === 'graduated'
                                  ? 'secondary'
                                  : 'warning'
                              }
                              size="sm"
                              dot
                            >
                              {r.status}
                            </Badge>
                          </TableCell>
                          {/* Row Actions: Edit and Delete buttons */}
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              {/* Edit registry record button */}
                              <Button
                                variant="outline"
                                size="sm"
                                icon={Edit}
                                onClick={() => handleOpenEditRegistry(r)}
                                title="Edit Record"
                              >
                                Edit
                              </Button>
                              {/* Delete registry record button */}
                              <Button
                                variant="danger"
                                size="sm"
                                icon={Trash2}
                                onClick={() => handleDeleteRegistryRecord(r)}
                                title="Delete Record"
                              >
                                Delete
                              </Button>
                            {/* Close actions wrapper */}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination control footer bar */}
                  <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                    {/* Total records counter display */}
                    <span>Total Authoritative Records: {registryTotal}</span>
                    {/* Pagination buttons and current page indicator */}
                    <div className="flex items-center space-x-2">
                      {/* Previous page button */}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={registryPage <= 1}
                        onClick={() => setRegistryPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </Button>
                      {/* Current page indicator */}
                      <span>Page {registryPage}</span>
                      {/* Next page button */}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={registryPage * 10 >= registryTotal}
                        onClick={() => setRegistryPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    {/* Close pagination buttons */}
                    </div>
                  {/* Close pagination footer */}
                  </div>
                </>
              )}
            {/* Close student master registry card */}
            </Card>
          )}
        {/* Close User Management tab container */}
        </div>
      )}

      {/* TAB 3: ALL PLATFORM ASSESSMENTS */}
      {activeTab === 'assessments' && (
        // Card wrapper for platform assessment oversight
        <Card
          title="Platform Assessment Oversight" /* Card heading */
          subtitle="System-wide review of examinations, author assignments, access types, and status moderation" /* Card subtitle */
        >
          {/* Assessment Filter Bar */}
          <div className="mb-4 grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Search input column taking 8 grid columns */}
            <div className="sm:col-span-8">
              {/* Text input to search examinations */}
              <Input
                placeholder="Search assessments by title, description, or category..."
                icon={Search}
                value={assessmentSearch}
                onChange={(e) => setAssessmentSearch(e.target.value)}
                onKeyDown={(e) => {
                  // Execute assessments query on Enter key press
                  if (e.key === 'Enter') loadAssessmentsList();
                }}
              />
            {/* Close search column */}
            </div>
            {/* Status filter dropdown taking 3 grid columns */}
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
            {/* Close status dropdown column */}
            </div>
            {/* Search submit button taking 1 grid column */}
            <div className="sm:col-span-1">
              <Button
                variant="outline"
                size="md"
                fullWidth
                icon={Search}
                onClick={loadAssessmentsList}
              />
            {/* Close button column */}
            </div>
          {/* Close assessment filter bar grid */}
          </div>

          {/* Conditional loading skeleton and empty state when no assessments match criteria */}
          {isAssessmentsLoading && assessments.length === 0 ? (
            <TableSkeleton rows={5} columns={6} />
          ) : assessments.length === 0 ? (
            <EmptyState
              title="No assessments found"
              description="Instructors have not yet published assessments matching your criteria."
            />
          // Render tabulated platform assessments
          ) : (
            <Table>
              {/* Table header with assessment attributes */}
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
              {/* Table body listing assessment rows */}
              <TableBody>
                {assessments.map((a) => {
                  // Resolve assessment identifier
                  const id = a._id || a.id;
                  return (
                    // Assessment row
                    <TableRow key={id}>
                      {/* Title and description cell */}
                      <TableCell>
                        {/* Assessment title in bold */}
                        <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                          {a.title}
                        </span>
                        {/* Truncated description caption */}
                        <span className="text-xs text-slate-400 line-clamp-1">{a.description}</span>
                      </TableCell>
                      {/* Faculty Author cell */}
                      <TableCell className="text-xs text-slate-700 dark:text-slate-300">
                        {a.instructorId?.name || 'Faculty Author'}
                      </TableCell>
                      {/* Examination Category */}
                      <TableCell className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        {a.category}
                      </TableCell>
                      {/* Duration in minutes */}
                      <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                        {a.durationMinutes} mins
                      </TableCell>

                      {/* Passing score threshold */}
                      <TableCell className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {a.passingScore}%
                      </TableCell>
                      {/* Access policy badge */}
                      <TableCell>
                        <Badge variant={a.accessType === 'restricted' ? 'warning' : 'neutral'} size="sm">
                          {a.accessType || 'public'}
                        </Badge>
                      </TableCell>
                      {/* Lifecycle status badge */}
                      <TableCell>
                        <Badge
                          variant={a.status === 'published' ? 'success' : a.status === 'draft' ? 'warning' : 'neutral'}
                          size="sm"
                          dot
                        >
                          {a.status}
                        </Badge>
                      </TableCell>
                      {/* Moderation actions column */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* If published, offer Archive action */}
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
                          // Else offer Publish action
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
                        {/* Close moderation actions wrapper */}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        {/* Close assessment oversight Card */}
        </Card>
      )}

      {/* TAB 4: AUDIT LOGS */}
      {activeTab === 'logs' && (
        // Card wrapper for system security and audit trail
        <Card
          title="System Security & Operations Audit Trail" /* Card heading */
          subtitle="Immutable chronological ledger of all platform administrative, authentication, and security actions" /* Card subtitle */
        >
          {/* Action Filter & Search Bar */}
          <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Filter controls wrapper */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto flex-1 max-w-xl">
              {/* Action type dropdown wrapper */}
              <div className="w-full sm:w-64">
                {/* Select dropdown offering all logged action types */}
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
                    { value: 'STUDENT_ACCOUNT_CREATED', label: 'STUDENT_ACCOUNT_CREATED' },
                    { value: 'STUDENT_REGISTRY_CREATED', label: 'STUDENT_REGISTRY_CREATED' },
                    { value: 'STUDENT_BULK_IMPORT_COMPLETED', label: 'STUDENT_BULK_IMPORT_COMPLETED' },
                    { value: 'FACULTY_ACCOUNT_CREATED', label: 'FACULTY_ACCOUNT_CREATED' },
                    { value: 'FACULTY_REGISTRY_CREATED', label: 'FACULTY_REGISTRY_CREATED' },
                    { value: 'FACULTY_REGISTRY_UPDATED', label: 'FACULTY_REGISTRY_UPDATED' },
                    { value: 'FACULTY_REGISTRY_DELETED', label: 'FACULTY_REGISTRY_DELETED' },
                    { value: 'SETTINGS_UPDATED', label: 'SETTINGS_UPDATED' },
                    { value: 'ASSESSMENT_STATUS_UPDATED', label: 'ASSESSMENT_STATUS_UPDATED' },
                  ]}
                />
              {/* Close dropdown wrapper */}
              </div>
              {/* Text search input wrapper */}
              <div className="relative flex-1">
                <Input
                  type="text"
                  placeholder="Search by action, username, email, or role..."
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  icon={Search}
                  className="w-full"
                />
              {/* Close search input wrapper */}
              </div>
            {/* Close filter controls wrapper */}
            </div>
            {/* Total matching records counter */}
            <span className="text-xs text-slate-400 whitespace-nowrap">
              Showing {filteredLogs.length} audit record{filteredLogs.length !== 1 ? 's' : ''}
            </span>
          {/* Close filter bar */}
          </div>

          {/* Conditional loading skeleton and empty state when no audit events match */}
          {isLogsLoading && logs.length === 0 ? (
            <TableSkeleton rows={5} columns={4} />
          ) : filteredLogs.length === 0 ? (
            <EmptyState
              title="No audit events found"
              description="System activities matching your filter will appear here."
            />
          // Render list of filtered audit log cards
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => {
                // Normalize audit log details
                const auditUser = getNormalizedAuditUser(log);
                return (
                  // Individual audit event card
                  <div
                    key={log._id || log.id}
                    className="p-4 rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-slate-50/40 dark:bg-slate-900/30 hover:bg-slate-50/70 dark:hover:bg-slate-900/50 transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                  >
                    {/* Left event details section */}
                    <div className="space-y-2.5 flex-1">
                      {/* Action & Role Badges row */}
                      <div className="flex items-center space-x-2">
                        {/* Action badge */}
                        <Badge
                          variant={getActionBadgeVariant(log.action)}
                          size="sm"
                          className="font-mono text-xs font-bold tracking-wide"
                        >
                          {log.action}
                        </Badge>
                        {/* Role badge */}
                        <Badge
                          variant="neutral"
                          size="sm"
                          className="text-[11px] font-bold tracking-wide uppercase px-2 py-0.5"
                        >
                          {auditUser.role.toUpperCase()}
                        </Badge>
                      {/* Close badges row */}
                      </div>

                      {/* Normalized User Details summary */}
                      <div className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                        {/* Username row */}
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">Username: </span>
                          <span>{auditUser.username}</span>
                        </div>
                        {/* Email address row */}
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">Email: </span>
                          <span className="font-mono">{auditUser.email}</span>
                        </div>
                        {/* Role row */}
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">Role: </span>
                          <span>{auditUser.role}</span>
                        </div>
                      {/* Close user details */}
                      </div>
                    {/* Close left details section */}
                    </div>

                    {/* Time & Date timestamp on right side */}
                    <div className="text-left sm:text-right text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap flex-shrink-0 sm:pt-0.5 space-y-0.5">
                      {/* 12-hour formatted time */}
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {formatAuditTime(log.createdAt)}
                      </div>
                      {/* Day month year formatted date */}
                      <div className="text-[11px]">
                        {formatAuditDate(log.createdAt)}
                      </div>
                    {/* Close timestamp section */}
                    </div>
                  {/* Close audit log item card */}
                  </div>
                );
              })}
            {/* Close audit logs list container */}
            </div>
          )}
        {/* Close audit trail Card */}
        </Card>
      )}

      {/* TAB 5: SYSTEM & PLATFORM SETTINGS */}
      {activeTab === 'settings' && (
        // Settings tab wrapper
        <div className="space-y-6">
          {/* Card wrapper for settings form */}
          {isSettingsLoading && !settingsLoaded ? (
            <SectionLoader message="Loading platform settings..." minHeight="min-h-[320px]" />
          ) : (
            <Card
              title="Platform & System Settings" /* Card heading */
              subtitle="Configure institutional rules, registration availability, maintenance status, and default exam parameters" /* Card subtitle */
            >
          {/* System settings form */}
          <form onSubmit={handleSaveSettings} className="space-y-6">
            {/* 2-column responsive layout for configuration fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Field 1: Platform Name */}
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

              {/* Field 2: Institutional Support Email */}
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

              {/* Field 3: Default Passing Score */}
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

              {/* Field 4: Max Attempt Duration */}
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
            {/* Close 2-column fields grid */}
            </div>

            {/* Field 5: System-wide Announcement Banner */}
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

            {/* Operational Policies & Feature Toggles box */}
            <div className="p-4 rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-slate-50/60 dark:bg-surface-dark-muted/40 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Operational Policies & Feature Toggles
              </h4>

              {/* 2-column toggles grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Toggle 1: Public Registration Open */}
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

                {/* Toggle 2: SMTP Email Notifications */}
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

                {/* Toggle 3: Student Post-Exam Score Review */}
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

                {/* Toggle 4: Platform Maintenance Mode */}
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
              {/* Close toggles grid */}
              </div>
            {/* Close operational toggles box */}
            </div>

            {/* Save Settings Form submit button wrapper */}
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
            {/* Close save button wrapper */}
            </div>
          {/* Close settings form */}
          </form>
        {/* Close settings Card */}
        </Card>
        )}

        {/* Administrator Profile & Identity Card */}
        <Card
          title="Administrator Profile"
          subtitle="Account identity credentials, administrative access, and profile picture"
        >
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <ProfilePhotoUploader
              avatar={user?.avatar}
              name={user?.name}
              role="admin"
              onPhotoUpdated={() => refreshProfile?.()}
            />

            <div className="flex-1 space-y-4 text-center sm:text-left w-full">
              <div>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {user?.name}
                  </h3>
                  <Badge variant="primary" size="sm" className="uppercase tracking-wider text-[10px]">
                    Administrator
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{user?.email}</p>
              </div>

              {/* Immutable Admin ID Box */}
              <div className="p-3.5 rounded-2xl bg-[#FFF9F2] dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Admin ID
                  </span>
                  <span className="text-xs text-slate-400" title="Permanent institutional identifier">
                    <Lock className="w-3.5 h-3.5 text-slate-400 inline" />
                  </span>
                </div>
                <div className="mt-1 text-sm font-mono font-bold text-indigo-700 dark:text-indigo-400 flex items-center justify-between">
                  <span>{user?.adminId || 'ADM-2026-001'}</span>
                  <span className="text-[11px] font-sans font-normal text-slate-400">🔒 Immutable</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Permanent administrative identifier assigned by institutional registry.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Administrator Two-Factor Authentication Section */}
        <TwoFactorAuthSection profile={user} onProfileUpdate={() => {}} />
      {/* Close Settings tab container */}
      </div>
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
        {/* Render user profile when selectedUser is populated */}
        {selectedUser && (
          <div className="space-y-4">
            {/* Header section with user avatar initial and name */}
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

            {/* 2-column grid of user metadata cards */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              {/* Account Role */}
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-surface-dark-muted">
                <span className="text-slate-400 block mb-0.5">Account Role</span>
                <span className="font-semibold capitalize text-slate-800 dark:text-slate-200">
                  {selectedUser.role}
                </span>
              </div>
              {/* Account Status */}
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-surface-dark-muted">
                <span className="text-slate-400 block mb-0.5">Account Status</span>
                <span className="font-semibold uppercase text-slate-800 dark:text-slate-200">
                  {selectedUser.status}
                </span>
              </div>
              {/* Institute Code */}
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-surface-dark-muted">
                <span className="text-slate-400 block mb-0.5">Institute Code</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedUser.instituteCode || 'None provided'}
                </span>
              </div>
              {/* Registered On timestamp */}
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-surface-dark-muted">
                <span className="text-slate-400 block mb-0.5">Registered On</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleString() : '—'}
                </span>
              </div>
              {/* Student ID if present */}
              {selectedUser.studentId && (
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-surface-dark-muted">
                  <span className="text-slate-400 block mb-0.5">Student ID</span>
                  <span className="font-semibold font-mono text-slate-800 dark:text-slate-200">
                    {selectedUser.studentId}
                  </span>
                </div>
              )}
              {/* Date of Birth if present */}
              {selectedUser.dateOfBirth && (
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-surface-dark-muted">
                  <span className="text-slate-400 block mb-0.5">Date of Birth</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {new Date(selectedUser.dateOfBirth).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            {/* Applicant Bio if present */}
            {selectedUser.bio && (
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-surface-dark-muted text-xs">
                <span className="text-slate-400 block mb-0.5">Applicant Bio</span>
                <p className="text-slate-700 dark:text-slate-300">{selectedUser.bio}</p>
              </div>
            )}

            {/* Approval Record if available */}
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

            {/* Revocation Record if available */}
            {selectedUser.revokedAt && (
              <div className="p-3 rounded-lg border border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/20 text-xs">
                <span className="font-semibold text-red-800 dark:text-red-300 block mb-0.5">
                  Revocation Record
                </span>
                <p className="text-red-700 dark:text-red-400">
                  Revoked on {new Date(selectedUser.revokedAt).toLocaleString()}
                  {selectedUser.revokedBy?.name ? ` by ${selectedUser.revokedBy.name}` : ''}
                </p>

                {/* Specific rejection reason description if recorded */}
                {selectedUser.rejectionReason && (
                  <p className="text-red-600 dark:text-red-300 mt-1 italic">
                    Reason: {selectedUser.rejectionReason}
                  </p>
                )}
              {/* Close revocation record box */}
              </div>
            )}
          {/* Close user details space-y-4 container */}
          </div>
        )}
      {/* Close Modal 1 */}
      </Modal>

      {/* MODAL 2: APPROVE ACCOUNT CONFIRMATION */}
      <Modal
        isOpen={isApproveModalOpen}
        onClose={() => setIsApproveModalOpen(false)}
        title="Approve Account Registration"
        footer={
          <>
            {/* Cancel approval button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsApproveModalOpen(false)}
              disabled={isActionSubmitting}
            >
              Cancel
            </Button>
            {/* Confirm approval button */}
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
          {/* Confirmation prompt text displaying target user name and email */}
          <p className="text-sm text-slate-600 dark:text-slate-300">
            You are approving institutional access for{' '}
            <strong className="text-slate-900 dark:text-slate-100">{selectedUser?.name}</strong> (
            {selectedUser?.email}).
          </p>

          {/* Assigned role selection dropdown */}
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

          {/* Explanatory informational notice */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border text-xs text-slate-500 dark:text-slate-400">
            Once approved, the user's status transitions to <strong>active</strong> and they will be permitted to authenticate to their assigned workspace.
          </div>
        </div>
      {/* Close Modal 2 */}
      </Modal>

      {/* BULK APPROVAL CONFIRMATION MODAL */}
      <Modal
        isOpen={isBulkApproveModalOpen}
        onClose={() => !isActionSubmitting && setIsBulkApproveModalOpen(false)}
        title={`Approve ${selectedPendingUserIds.length} Registration${selectedPendingUserIds.length === 1 ? '' : 's'}?`}
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBulkApproveModalOpen(false)}
              disabled={isActionSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmBulkApprove}
              isLoading={isActionSubmitting}
              icon={CheckCircle}
            >
              Approve {selectedPendingUserIds.length} User{selectedPendingUserIds.length === 1 ? '' : 's'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            These users will be approved and activated.
          </p>

          <div className="max-h-48 overflow-y-auto space-y-2 border border-surface-light-border dark:border-surface-dark-border rounded-xl p-3 bg-slate-50 dark:bg-surface-dark-muted text-xs">
            {pendingUsers
              .filter((u) => selectedPendingUserIds.includes((u._id || u.id).toString()))
              .map((u) => (
                <div
                  key={u._id || u.id}
                  className="flex justify-between items-center py-1.5 border-b border-slate-200 dark:border-slate-800 last:border-0"
                >
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                      {u.name}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 text-[11px] block">
                      {u.email}
                    </span>
                  </div>
                  <Badge variant={u.role === 'instructor' ? 'sage' : 'secondary'} size="xs">
                    {u.role === 'instructor' ? 'Faculty' : 'Student'}
                  </Badge>
                </div>
              ))}
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border text-xs text-slate-500 dark:text-slate-400">
            Once approved, each user's status transitions to <strong>active</strong> and they will be permitted to authenticate to their assigned workspace.
          </div>
        </div>
      </Modal>

      {/* BULK REJECTION CONFIRMATION MODAL */}
      <Modal
        isOpen={isBulkRejectModalOpen}
        onClose={() => !isActionSubmitting && setIsBulkRejectModalOpen(false)}
        title={`Reject ${selectedPendingUserIds.length} Registration${selectedPendingUserIds.length === 1 ? '' : 's'}?`}
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBulkRejectModalOpen(false)}
              disabled={isActionSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmBulkReject}
              isLoading={isActionSubmitting}
              icon={XCircle}
            >
              Reject {selectedPendingUserIds.length} User{selectedPendingUserIds.length === 1 ? '' : 's'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            These selected registrations will be rejected. Accounts will not be activated.
          </p>

          <div className="max-h-48 overflow-y-auto space-y-2 border border-surface-light-border dark:border-surface-dark-border rounded-xl p-3 bg-slate-50 dark:bg-surface-dark-muted text-xs">
            {pendingUsers
              .filter((u) => selectedPendingUserIds.includes((u._id || u.id).toString()))
              .map((u) => (
                <div
                  key={u._id || u.id}
                  className="flex justify-between items-center py-1.5 border-b border-slate-200 dark:border-slate-800 last:border-0"
                >
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                      {u.name}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 text-[11px] block">
                      {u.email}
                    </span>
                  </div>
                  <Badge variant={u.role === 'instructor' ? 'sage' : 'secondary'} size="xs">
                    {u.role === 'instructor' ? 'Faculty' : 'Student'}
                  </Badge>
                </div>
              ))}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Rejection Reason (optional)
            </label>
            <input
              type="text"
              value={bulkRejectReason}
              onChange={(e) => setBulkRejectReason(e.target.value)}
              placeholder="e.g. Institutional eligibility verification unsuccessful."
              className="w-full px-3 py-2 text-xs bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border rounded-xl focus:outline-none focus:border-red-500 text-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300">
            Once rejected, each user's status transitions to <strong>rejected</strong> and an advisory notification/email will be dispatched.
          </div>
        </div>
      </Modal>

      {/* BULK REVOCATION CONFIRMATION MODAL */}
      <Modal
        isOpen={isBulkRevokeModalOpen}
        onClose={() => !isActionSubmitting && setIsBulkRevokeModalOpen(false)}
        title={`Revoke ${selectedActiveUsers.length} Active Account${selectedActiveUsers.length === 1 ? '' : 's'}?`}
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBulkRevokeModalOpen(false)}
              disabled={isActionSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmBulkRevoke}
              isLoading={isActionSubmitting}
              icon={UserX}
            >
              Revoke {selectedActiveUsers.length} Account{selectedActiveUsers.length === 1 ? '' : 's'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            You are about to revoke workspace access for <strong>{selectedActiveUsers.length}</strong> active user account{selectedActiveUsers.length === 1 ? '' : 's'}. All active sessions will be terminated immediately.
          </p>

          <div className="max-h-48 overflow-y-auto space-y-2 border border-surface-light-border dark:border-surface-dark-border rounded-xl p-3 bg-slate-50 dark:bg-surface-dark-muted text-xs">
            {selectedActiveUsers.map((u) => (
              <div
                key={u._id || u.id}
                className="flex justify-between items-center py-1.5 border-b border-slate-200 dark:border-slate-800 last:border-0"
              >
                <div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                    {u.name}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px] block">
                    {u.email}
                  </span>
                </div>
                <Badge variant={u.role === 'instructor' ? 'sage' : u.role === 'admin' ? 'primary' : 'secondary'} size="xs">
                  {u.role === 'instructor' ? 'Faculty' : u.role === 'admin' ? 'Admin' : 'Student'}
                </Badge>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Revocation Reason (optional)
            </label>
            <input
              type="text"
              value={bulkRevokeReason}
              onChange={(e) => setBulkRevokeReason(e.target.value)}
              placeholder="e.g. Account access revoked by administrator"
              className="w-full px-3 py-2 text-xs bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border rounded-xl focus:outline-none focus:border-red-500 text-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-xs text-red-700 dark:text-red-300">
            <strong>Warning:</strong> The account status will transition to <strong>revoked</strong>. Session tokens will be invalidated immediately and a revocation advisory will be sent.
          </div>
        </div>
      </Modal>

      {/* BULK APPROVAL FROM ALL ACCOUNTS CONFIRMATION MODAL */}
      <Modal
        isOpen={isBulkApproveAllModalOpen}
        onClose={() => !isActionSubmitting && setIsBulkApproveAllModalOpen(false)}
        title={`Approve ${selectedPendingInAllUsers.length} Registration${selectedPendingInAllUsers.length === 1 ? '' : 's'}?`}
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBulkApproveAllModalOpen(false)}
              disabled={isActionSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmBulkApproveFromAll}
              isLoading={isActionSubmitting}
              icon={CheckCircle}
            >
              Approve {selectedPendingInAllUsers.length} User{selectedPendingInAllUsers.length === 1 ? '' : 's'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            These pending registrations will be approved and activated.
          </p>

          <div className="max-h-48 overflow-y-auto space-y-2 border border-surface-light-border dark:border-surface-dark-border rounded-xl p-3 bg-slate-50 dark:bg-surface-dark-muted text-xs">
            {selectedPendingInAllUsers.map((u) => (
              <div
                key={u._id || u.id}
                className="flex justify-between items-center py-1.5 border-b border-slate-200 dark:border-slate-800 last:border-0"
              >
                <div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                    {u.name}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px] block">
                    {u.email}
                  </span>
                </div>
                <Badge variant={u.role === 'instructor' ? 'sage' : 'secondary'} size="xs">
                  {u.role === 'instructor' ? 'Faculty' : 'Student'}
                </Badge>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border text-xs text-slate-500 dark:text-slate-400">
            Once approved, each user's status transitions to <strong>active</strong> and they will be permitted to authenticate to their assigned workspace.
          </div>
        </div>
      </Modal>

      {/* BULK REJECTION FROM ALL ACCOUNTS CONFIRMATION MODAL */}
      <Modal
        isOpen={isBulkRejectAllModalOpen}
        onClose={() => !isActionSubmitting && setIsBulkRejectAllModalOpen(false)}
        title={`Reject ${selectedPendingInAllUsers.length} Registration${selectedPendingInAllUsers.length === 1 ? '' : 's'}?`}
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBulkRejectAllModalOpen(false)}
              disabled={isActionSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmBulkRejectFromAll}
              isLoading={isActionSubmitting}
              icon={XCircle}
            >
              Reject {selectedPendingInAllUsers.length} User{selectedPendingInAllUsers.length === 1 ? '' : 's'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            These selected registrations will be rejected. Accounts will not be activated.
          </p>

          <div className="max-h-48 overflow-y-auto space-y-2 border border-surface-light-border dark:border-surface-dark-border rounded-xl p-3 bg-slate-50 dark:bg-surface-dark-muted text-xs">
            {selectedPendingInAllUsers.map((u) => (
              <div
                key={u._id || u.id}
                className="flex justify-between items-center py-1.5 border-b border-slate-200 dark:border-slate-800 last:border-0"
              >
                <div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                    {u.name}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px] block">
                    {u.email}
                  </span>
                </div>
                <Badge variant={u.role === 'instructor' ? 'sage' : 'secondary'} size="xs">
                  {u.role === 'instructor' ? 'Faculty' : 'Student'}
                </Badge>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Rejection Reason (optional)
            </label>
            <input
              type="text"
              value={bulkRejectAllReason}
              onChange={(e) => setBulkRejectAllReason(e.target.value)}
              placeholder="e.g. Institutional eligibility verification unsuccessful."
              className="w-full px-3 py-2 text-xs bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border rounded-xl focus:outline-none focus:border-red-500 text-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300">
            Once rejected, each user's status transitions to <strong>rejected</strong> and an advisory notification/email will be dispatched.
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
            {/* Cancel rejection button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRejectModalOpen(false)}
              disabled={isActionSubmitting}
            >
              Cancel
            </Button>
            {/* Confirm rejection button */}
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
          {/* Warning confirmation text displaying applicant name */}
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Are you sure you want to reject the registration for{' '}
            <strong className="text-slate-900 dark:text-slate-100">{selectedUser?.name}</strong>?
          </p>

          {/* Optional rejection reason input field */}
          <Input
            label="Rejection Reason (Optional)"
            placeholder="e.g. Unrecognized institute code or invalid campus email"
            value={actionReason}
            onChange={(e) => setActionReason(e.target.value)}
          />

          {/* Warning banner detailing impact of rejection */}
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-xs text-red-700 dark:text-red-300">
            The account status will transition to <strong>rejected</strong>. The user will be blocked from logging in.
          </div>
        </div>
      {/* Close Modal 3 */}
      </Modal>

      {/* MODAL 4: REVOKE ACTIVE ACCOUNT CONFIRMATION */}
      <Modal
        isOpen={isRevokeModalOpen}
        onClose={() => setIsRevokeModalOpen(false)}
        title="Revoke Active Account Access"
        footer={
          <>
            {/* Cancel revocation button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRevokeModalOpen(false)}
              disabled={isActionSubmitting}
            >
              Cancel
            </Button>
            {/* Confirm revocation button */}
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
          {/* Revocation confirmation warning displaying active user name and email */}
          <p className="text-sm text-slate-600 dark:text-slate-300">
            You are about to revoke workspace access for active user{' '}
            <strong className="text-slate-900 dark:text-slate-100">{selectedUser?.name}</strong> (
            {selectedUser?.email}).
          </p>

          {/* Revocation justification input field */}
          <Input
            label="Revocation Reason"
            placeholder="e.g. Academic integrity violation or graduation status"
            value={actionReason}
            onChange={(e) => setActionReason(e.target.value)}
          />

          {/* High-priority danger notice detailing immediate session termination */}
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-xs text-red-700 dark:text-red-300">
            <strong>Warning:</strong> The account status will transition to <strong>revoked</strong> and all active sessions will be terminated immediately.
          </div>
        </div>
      {/* Close Modal 4 */}
      </Modal>

      {/* MODAL 5: ADD / EDIT STUDENT MASTER RECORD */}
      <Modal
        isOpen={isRegistryModalOpen}
        onClose={() => setIsRegistryModalOpen(false)}
        title={isEditingRegistry ? 'Edit Master Student Record' : 'Add Authoritative Student Record'}
        maxWidth="max-w-lg"
      >
        {/* Form handling submission of student registry data with vertical field spacing */}
        <form onSubmit={handleSaveRegistryRecord} className="space-y-4">
          {/* Input component for institutional Student ID code */}
          <Input
            label="Student ID"
            id="regStudentId"
            value={registryForm.studentId}
            onChange={(e) => setRegistryForm({ ...registryForm, studentId: e.target.value })}
            placeholder="e.g. STU001 or STU-2026-101"
            icon={GraduationCap}
            required
            helperText="Permanent authoritative institutional identifier"
          />

          {/* Input component for student's full name */}
          <Input
            label="Full Name"
            id="regName"
            value={registryForm.name}
            onChange={(e) => setRegistryForm({ ...registryForm, name: e.target.value })}
            placeholder="e.g. Rahul Kumar"
            icon={User}
            required
          />

          {/* Input component for date of birth */}
          <Input
            label="Date of Birth"
            id="regDob"
            type="date"
            value={registryForm.dateOfBirth}
            onChange={(e) => setRegistryForm({ ...registryForm, dateOfBirth: e.target.value })}
            icon={Calendar}
            required
            helperText="Official birth date used for real-time verification matching"
          />

          {/* Input component for institutional email */}
          <Input
            label="Institutional Email"
            id="regEmail"
            type="email"
            value={registryForm.email}
            onChange={(e) => setRegistryForm({ ...registryForm, email: e.target.value })}
            placeholder="name@college.edu"
            icon={Mail}
            required
          />

          {/* Select dropdown for registry enrollment standing */}
          <Select
            label="Registry Status"
            id="regStatus"
            value={registryForm.status}
            onChange={(e) => setRegistryForm({ ...registryForm, status: e.target.value })}
            options={[
              { value: 'active', label: 'Active (Eligible for auto-registration)' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'suspended', label: 'Suspended' },
              { value: 'graduated', label: 'Graduated' },
            ]}
          />

          {/* Action buttons footer */}
          <div className="pt-3 border-t border-surface-light-border dark:border-surface-dark-border flex justify-end space-x-2">
            {/* Cancel button */}
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsRegistryModalOpen(false)}
            >
              Cancel
            </Button>
            {/* Submit button */}
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isActionSubmitting}
            >
              {isEditingRegistry ? 'Save Changes' : 'Add to Registry'}
            </Button>
          {/* Close action buttons footer */}
          </div>
        {/* Close registry form */}
        </form>
      {/* Close Modal 5 */}
      </Modal>
    {/* Close top-level dashboard layout container */}
    </div>
  ); // Return statement closing parenthesis and semicolon
}; // AdminDashboard functional component definition closing bracket

// Export AdminDashboard as default export of this module
export default AdminDashboard;
