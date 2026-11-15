import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../../services/admin.service';
import Badge from '../../ui/Badge';
import {
  Search,
  X,
  Loader2,
  Users,
  BookOpen,
  UserCheck,
  ShieldCheck,
  Settings,
  Database,
  LayoutDashboard,
  GraduationCap,
  Award,
  User,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

const ADMIN_NAV_ITEMS = [
  {
    id: 'admin-nav-overview',
    title: 'Platform Overview',
    subtitle: 'System health, telemetry, and live metrics',
    path: '/admin/dashboard',
    category: 'Navigation',
    icon: LayoutDashboard,
  },
  {
    id: 'admin-nav-pending',
    title: 'Pending Registration Approvals',
    subtitle: 'Applicant verification and onboarding queue',
    path: '/admin/users',
    category: 'Navigation',
    icon: UserCheck,
  },
  {
    id: 'admin-nav-users',
    title: 'User Directory Management',
    subtitle: 'Search and inspect student, faculty, and admin accounts',
    path: '/admin/users',
    category: 'Navigation',
    icon: Users,
  },
  {
    id: 'admin-nav-students',
    title: 'Student Platform Accounts',
    subtitle: 'View and manage student logins and credentials',
    path: '/admin/students',
    category: 'Navigation',
    icon: GraduationCap,
  },
  {
    id: 'admin-nav-faculty',
    title: 'Faculty Platform Accounts',
    subtitle: 'Manage instructor privileges and departmental roles',
    path: '/admin/faculty',
    category: 'Navigation',
    icon: Award,
  },
  {
    id: 'admin-nav-student-reg',
    title: 'Student Master Registry',
    subtitle: 'Authoritative enrollment directory and roster import',
    path: '/admin/student-registry',
    category: 'Navigation',
    icon: Database,
  },
  {
    id: 'admin-nav-faculty-reg',
    title: 'Faculty Master Registry',
    subtitle: 'Authoritative institutional instructor records',
    path: '/admin/faculty-registry',
    category: 'Navigation',
    icon: Database,
  },
  {
    id: 'admin-nav-assessments',
    title: 'Assessment Oversight',
    subtitle: 'Platform-wide examination moderation and publication',
    path: '/admin/assessments',
    category: 'Navigation',
    icon: BookOpen,
  },
  {
    id: 'admin-nav-logs',
    title: 'Security & Audit Logs',
    subtitle: 'Immutable chronological ledger of administrative events',
    path: '/admin/logs',
    category: 'Navigation',
    icon: ShieldCheck,
  },
  {
    id: 'admin-nav-settings',
    title: 'Platform System Settings',
    subtitle: 'Global platform configuration, operational preferences, and MFA security',
    path: '/admin/settings',
    category: 'Navigation',
    icon: Settings,
  },
  {
    id: 'admin-nav-profile',
    title: 'Administrator Profile',
    subtitle: 'Personal credentials, institutional identity, and admin ID',
    path: '/admin/profile',
    category: 'Navigation',
    icon: User,
  },
];

const AdminSearchBar = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({
    users: [],
    pending: [],
    assessments: [],
    registry: [],
    facultyRegistry: [],
    logs: [],
    pages: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const mobileInputRef = useRef(null);
  const requestIdRef = useRef(0);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setIsMobileExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search logic querying admin endpoints concurrently
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults({
        users: [],
        pending: [],
        assessments: [],
        registry: [],
        facultyRegistry: [],
        logs: [],
        pages: [],
      });
      setIsLoading(false);
      setError(null);
      setSelectedIndex(-1);
      return;
    }

    const currentReqId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const lowerQ = trimmed.toLowerCase();

        // 1. Navigation items matching query
        const matchedPages = ADMIN_NAV_ITEMS.filter(
          (item) =>
            item.title.toLowerCase().includes(lowerQ) ||
            item.subtitle.toLowerCase().includes(lowerQ)
        );

        // 2. Query administrative resources in parallel
        const [usersRes, pendingRes, assessmentsRes, registryRes, facultyRegistryRes, logsRes] =
          await Promise.allSettled([
            adminService.getUsers({ search: trimmed, limit: 4 }),
            adminService.getPendingUsers({ search: trimmed }),
            adminService.getAssessments({ search: trimmed, limit: 4 }),
            adminService.getStudentRegistry({ search: trimmed, limit: 3 }),
            adminService.getFacultyRegistry({ search: trimmed, limit: 3 }),
            adminService.getLogs({ page: 1, limit: 4, action: trimmed, search: trimmed }),
          ]);

        if (currentReqId !== requestIdRef.current) return;

        // Extract users safely without exposing secrets
        let users = [];
        if (usersRes.status === 'fulfilled') {
          const val = usersRes.value;
          const raw = val?.data?.data || val?.data?.users || val?.data || [];
          if (Array.isArray(raw)) {
            users = raw.map((u) => ({
              _id: u._id || u.id,
              name: u.name,
              email: u.email,
              role: u.role,
              status: u.status,
              studentId: u.studentId,
              facultyId: u.facultyId,
            }));
          }
        }

        // Extract pending applicant records
        let pending = [];
        if (pendingRes.status === 'fulfilled') {
          const raw = pendingRes.value?.data || pendingRes.value || [];
          if (Array.isArray(raw)) {
            pending = raw.slice(0, 4).map((u) => ({
              _id: u._id || u.id,
              name: u.name,
              email: u.email,
              role: u.role,
              status: u.status,
            }));
          }
        }

        // Extract assessments
        let assessments = [];
        if (assessmentsRes.status === 'fulfilled') {
          const val = assessmentsRes.value;
          const raw = val?.data?.assessments || val?.data || val?.assessments || [];
          if (Array.isArray(raw)) {
            assessments = raw.slice(0, 4);
          }
        }

        // Extract student registry records
        let registry = [];
        if (registryRes.status === 'fulfilled') {
          const val = registryRes.value;
          const raw = val?.data?.records || val?.data || [];
          if (Array.isArray(raw)) {
            registry = raw.slice(0, 3);
          }
        }

        // Extract faculty registry records
        let facultyRegistry = [];
        if (facultyRegistryRes.status === 'fulfilled') {
          const val = facultyRegistryRes.value;
          const raw = val?.data?.records || val?.data || val?.records || [];
          if (Array.isArray(raw)) {
            facultyRegistry = raw.slice(0, 3);
          }
        }

        // Extract audit logs
        let logs = [];
        if (logsRes.status === 'fulfilled') {
          const val = logsRes.value;
          const raw = val?.data?.logs || val?.data || [];
          if (Array.isArray(raw)) {
            logs = raw.slice(0, 3);
          }
        }

        setResults({
          users,
          pending,
          assessments,
          registry,
          facultyRegistry,
          logs,
          pages: matchedPages,
        });
        setIsOpen(true);
        setSelectedIndex(-1);
      } catch (err) {
        if (currentReqId === requestIdRef.current) {
          console.error('Admin search failed:', err);
          setError('Unable to load administrative search results.');
        }
      } finally {
        if (currentReqId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Flattened items for keyboard navigation
  const flattenedItems = [
    ...results.pages.map((p) => ({ ...p, resultCategory: 'page' })),
    ...results.pending.map((u) => ({ ...u, resultCategory: 'pending' })),
    ...results.users.map((u) => ({ ...u, resultCategory: 'user' })),
    ...results.assessments.map((a) => ({ ...a, resultCategory: 'assessment' })),
    ...results.registry.map((r) => ({ ...r, resultCategory: 'registry' })),
    ...results.facultyRegistry.map((fr) => ({ ...fr, resultCategory: 'facultyRegistry' })),
    ...results.logs.map((l) => ({ ...l, resultCategory: 'log' })),
  ];

  const totalResultsCount = flattenedItems.length;

  const handleSelect = useCallback(
    (item) => {
      setIsOpen(false);
      setIsMobileExpanded(false);
      setQuery('');

      if (item.resultCategory === 'page') {
        navigate(item.path);
      } else if (item.resultCategory === 'pending') {
        navigate(`/admin/users?applicantId=${item._id}`);
      } else if (item.resultCategory === 'user') {
        navigate(`/admin/users?applicantId=${item._id}`);
      } else if (item.resultCategory === 'assessment') {
        navigate('/admin/assessments');
      } else if (item.resultCategory === 'registry') {
        navigate('/admin/student-registry');
      } else if (item.resultCategory === 'facultyRegistry') {
        navigate('/admin/faculty-registry');
      } else if (item.resultCategory === 'log') {
        navigate('/admin/logs');
      }
    },
    [navigate]
  );

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' && query.trim().length >= 2) {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      setIsOpen(false);
      setIsMobileExpanded(false);
      inputRef.current?.blur();
      mobileInputRef.current?.blur();
      return;
    }

    if (flattenedItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < flattenedItems.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : flattenedItems.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < flattenedItems.length) {
        handleSelect(flattenedItems[selectedIndex]);
      } else if (flattenedItems.length > 0) {
        handleSelect(flattenedItems[0]);
      } else if (query.trim()) {
        setIsOpen(false);
        setIsMobileExpanded(false);
        navigate('/admin/users');
      }
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults({
      users: [],
      pending: [],
      assessments: [],
      registry: [],
      facultyRegistry: [],
      logs: [],
      pages: [],
    });
    setIsOpen(false);
    setError(null);
    inputRef.current?.focus();
  };

  const renderDropdownContent = () => (
    <div
      role="listbox"
      id="admin-search-results"
      className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 p-1.5 focus:outline-none"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-7 text-xs text-slate-500 dark:text-slate-400">
          <Loader2 className="w-4 h-4 mr-2 animate-spin text-brand-primary" />
          Searching administrative resources...
        </div>
      ) : error ? (
        <div className="py-6 px-4 text-center">
          <AlertCircle className="w-5 h-5 mx-auto text-amber-500 mb-1.5" />
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{error}</p>
        </div>
      ) : totalResultsCount === 0 ? (
        <div className="py-6 px-4 text-center">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            No matching administrative records found
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Try searching by username, institutional email, student ID, or assessment title.
          </p>
        </div>
      ) : (
        <>
          {/* Admin Navigation Destinations */}
          {results.pages.length > 0 && (
            <div className="py-1">
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Administrative Destinations
              </div>
              <div className="mt-0.5 space-y-0.5">
                {results.pages.map((p) => {
                  const itemIndex = flattenedItems.findIndex((it) => it.id === p.id);
                  const isHighlighted = selectedIndex === itemIndex;
                  const Icon = p.icon;
                  return (
                    <div
                      key={p.id}
                      role="option"
                      aria-selected={isHighlighted}
                      onClick={() => handleSelect({ ...p, resultCategory: 'page' })}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer text-xs transition-colors ${
                        isHighlighted
                          ? 'bg-brand-peach/15 dark:bg-brand-peach/20 text-brand-terracotta dark:text-brand-peach font-semibold'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-brand-peach/10 text-brand-terracotta flex items-center justify-center flex-shrink-0">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate">
                          <div className="font-medium truncate">{p.title}</div>
                          <div className="text-[11px] text-slate-400 truncate">{p.subtitle}</div>
                        </div>
                      </div>
                      <ArrowRight className="w-3 h-3 text-slate-400 flex-shrink-0 ml-2" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pending Approval Queue */}
          {results.pending.length > 0 && (
            <div className="py-1">
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-500 flex items-center">
                <UserCheck className="w-3 h-3 mr-1" />
                Pending Approval Queue
              </div>
              <div className="mt-0.5 space-y-0.5">
                {results.pending.map((u) => {
                  const itemIndex = flattenedItems.findIndex(
                    (it) => it._id === u._id && it.resultCategory === 'pending'
                  );
                  const isHighlighted = selectedIndex === itemIndex;
                  return (
                    <div
                      key={u._id}
                      role="option"
                      aria-selected={isHighlighted}
                      onClick={() => handleSelect({ ...u, resultCategory: 'pending' })}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer text-xs transition-colors ${
                        isHighlighted
                          ? 'bg-brand-peach/15 dark:bg-brand-peach/20 text-brand-terracotta dark:text-brand-peach font-semibold'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                          {u.name?.charAt(0) || 'P'}
                        </div>
                        <div className="truncate">
                          <div className="font-medium truncate">{u.name}</div>
                          <div className="text-[11px] text-slate-400 truncate">{u.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1.5 flex-shrink-0 ml-2">
                        <Badge variant="warning" size="sm">
                          Pending {u.role}
                        </Badge>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Platform Users */}
          {results.users.length > 0 && (
            <div className="py-1">
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center">
                <Users className="w-3 h-3 mr-1 text-brand-primary" />
                Registered Platform Users
              </div>
              <div className="mt-0.5 space-y-0.5">
                {results.users.map((u) => {
                  const itemIndex = flattenedItems.findIndex(
                    (it) => it._id === u._id && it.resultCategory === 'user'
                  );
                  const isHighlighted = selectedIndex === itemIndex;
                  return (
                    <div
                      key={u._id}
                      role="option"
                      aria-selected={isHighlighted}
                      onClick={() => handleSelect({ ...u, resultCategory: 'user' })}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer text-xs transition-colors ${
                        isHighlighted
                          ? 'bg-brand-peach/15 dark:bg-brand-peach/20 text-brand-terracotta dark:text-brand-peach font-semibold'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                          {u.name?.charAt(0) || 'U'}
                        </div>
                        <div className="truncate">
                          <div className="font-medium truncate">{u.name}</div>
                          <div className="text-[11px] text-slate-400 truncate">{u.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1.5 flex-shrink-0 ml-2">
                        <Badge
                          variant={
                            u.role === 'admin'
                              ? 'primary'
                              : u.role === 'instructor'
                              ? 'sage'
                              : 'secondary'
                          }
                          size="sm"
                        >
                          {u.role}
                        </Badge>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Assessment Oversight */}
          {results.assessments.length > 0 && (
            <div className="py-1">
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center">
                <BookOpen className="w-3 h-3 mr-1 text-emerald-600" />
                Platform Assessments
              </div>
              <div className="mt-0.5 space-y-0.5">
                {results.assessments.map((a) => {
                  const id = a._id || a.id;
                  const itemIndex = flattenedItems.findIndex(
                    (it) => (it._id || it.id) === id && it.resultCategory === 'assessment'
                  );
                  const isHighlighted = selectedIndex === itemIndex;
                  return (
                    <div
                      key={id}
                      role="option"
                      aria-selected={isHighlighted}
                      onClick={() => handleSelect({ ...a, resultCategory: 'assessment' })}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer text-xs transition-colors ${
                        isHighlighted
                          ? 'bg-brand-peach/15 dark:bg-brand-peach/20 text-brand-terracotta dark:text-brand-peach font-semibold'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center flex-shrink-0">
                          <BookOpen className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate">
                          <div className="font-medium truncate">{a.title}</div>
                          <div className="text-[11px] text-slate-400">
                            {a.category || 'General'} · {a.durationMinutes || 60}m
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1.5 flex-shrink-0 ml-2">
                        <Badge
                          variant={a.status === 'published' ? 'success' : 'warning'}
                          size="sm"
                        >
                          {a.status}
                        </Badge>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Student Registry */}
          {results.registry.length > 0 && (
            <div className="py-1">
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center">
                <Database className="w-3 h-3 mr-1 text-brand-primary" />
                Student Master Registry
              </div>
              <div className="mt-0.5 space-y-0.5">
                {results.registry.map((r) => {
                  const id = r._id || r.id;
                  const itemIndex = flattenedItems.findIndex(
                    (it) => (it._id || it.id) === id && it.resultCategory === 'registry'
                  );
                  const isHighlighted = selectedIndex === itemIndex;
                  return (
                    <div
                      key={id}
                      role="option"
                      aria-selected={isHighlighted}
                      onClick={() => handleSelect({ ...r, resultCategory: 'registry' })}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer text-xs transition-colors ${
                        isHighlighted
                          ? 'bg-brand-peach/15 dark:bg-brand-peach/20 text-brand-terracotta dark:text-brand-peach font-semibold'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center flex-shrink-0 font-mono text-[10px]">
                          ID
                        </div>
                        <div className="truncate">
                          <div className="font-medium truncate">{r.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {r.studentId} · {r.email}
                          </div>
                        </div>
                      </div>
                      <Badge variant="neutral" size="sm">
                        {r.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Faculty Registry */}
          {results.facultyRegistry.length > 0 && (
            <div className="py-1">
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center">
                <Award className="w-3 h-3 mr-1 text-purple-600" />
                Faculty Master Registry
              </div>
              <div className="mt-0.5 space-y-0.5">
                {results.facultyRegistry.map((fr) => {
                  const id = fr._id || fr.id;
                  const itemIndex = flattenedItems.findIndex(
                    (it) => (it._id || it.id) === id && it.resultCategory === 'facultyRegistry'
                  );
                  const isHighlighted = selectedIndex === itemIndex;
                  return (
                    <div
                      key={id}
                      role="option"
                      aria-selected={isHighlighted}
                      onClick={() => handleSelect({ ...fr, resultCategory: 'facultyRegistry' })}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer text-xs transition-colors ${
                        isHighlighted
                          ? 'bg-brand-peach/15 dark:bg-brand-peach/20 text-brand-terracotta dark:text-brand-peach font-semibold'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center flex-shrink-0 font-mono text-[10px]">
                          FAC
                        </div>
                        <div className="truncate">
                          <div className="font-medium truncate">{fr.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono truncate">
                            {fr.facultyId} · {fr.email} {fr.department ? `· ${fr.department}` : ''}
                          </div>
                        </div>
                      </div>
                      <Badge variant="sage" size="sm">
                        {fr.status || 'Active'}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Security & Audit Logs */}
          {results.logs.length > 0 && (
            <div className="py-1">
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center">
                <ShieldCheck className="w-3 h-3 mr-1 text-indigo-500" />
                Security & Audit Events
              </div>
              <div className="mt-0.5 space-y-0.5">
                {results.logs.map((l) => {
                  const id = l._id || l.id;
                  const itemIndex = flattenedItems.findIndex(
                    (it) => (it._id || it.id) === id && it.resultCategory === 'log'
                  );
                  const isHighlighted = selectedIndex === itemIndex;
                  return (
                    <div
                      key={id}
                      role="option"
                      aria-selected={isHighlighted}
                      onClick={() => handleSelect({ ...l, resultCategory: 'log' })}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer text-xs transition-colors ${
                        isHighlighted
                          ? 'bg-brand-peach/15 dark:bg-brand-peach/20 text-brand-terracotta dark:text-brand-peach font-semibold'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center flex-shrink-0">
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate">
                          <div className="font-medium truncate font-mono text-[11px]">{l.action}</div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {l.performedBy?.name || l.performedBy?.email || 'System'} {l.ipAddress ? `· ${l.ipAddress}` : ''}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 flex-shrink-0 ml-2">
                        {l.createdAt ? new Date(l.createdAt).toLocaleDateString() : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className="relative flex items-center">
      {/* Mobile Search Icon Button (< 640px) */}
      <button
        type="button"
        onClick={() => {
          setIsMobileExpanded(true);
          setIsOpen(query.trim().length >= 2);
          setTimeout(() => mobileInputRef.current?.focus(), 50);
        }}
        className="sm:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary flex-shrink-0"
        aria-label="Open admin search"
      >
        <Search className="w-4 h-4" />
      </button>

      {/* Desktop & Tablet Inline Search Input (>= 640px) */}
      <div className="hidden sm:relative sm:flex sm:items-center">
        <div className="absolute inset-y-0 left-0 pl-2.5 sm:pl-3 flex items-center pointer-events-none text-slate-400">
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-primary" />
          ) : (
            <Search className="w-3.5 h-3.5" />
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen && e.target.value.trim().length >= 2) setIsOpen(true);
          }}
          onFocus={() => {
            if (query.trim().length >= 2) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search users, assessments..."
          aria-label="Search administrative resources"
          aria-expanded={isOpen}
          aria-controls="admin-search-results"
          role="combobox"
          className="w-[170px] md:w-[190px] lg:w-[220px] xl:w-[230px] h-[38px] pl-8 pr-7 py-1.5 text-xs bg-slate-50/90 dark:bg-surface-dark-muted/70 hover:bg-white dark:hover:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary focus:bg-white dark:focus:bg-surface-dark transition-all shadow-xs"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            title="Clear search"
            aria-label="Clear search input"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Desktop Live Dropdown */}
        {isOpen && query.trim().length >= 2 && (
          <div className="absolute right-0 top-full mt-2 w-[340px] md:w-[400px] bg-white dark:bg-surface-dark rounded-2xl border border-surface-light-border dark:border-surface-dark-border shadow-2xl z-50 overflow-hidden animate-in fade-in-50 slide-in-from-top-1 duration-150">
            <div className="px-3 py-1.5 border-b border-surface-light-border dark:border-surface-dark-border bg-slate-50/70 dark:bg-surface-dark-muted/50 flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                Admin Search Results ({totalResultsCount})
              </span>
              <span>Esc to close</span>
            </div>
            {renderDropdownContent()}
          </div>
        )}
      </div>

      {/* Mobile Expandable Search Overlay (< 640px) */}
      {isMobileExpanded && (
        <div className="fixed inset-x-2 top-2 z-50 flex flex-col sm:hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border rounded-xl shadow-2xl p-1.5 gap-2">
            <div className="pl-2 text-slate-400">
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-brand-primary" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </div>
            <input
              ref={mobileInputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!isOpen && e.target.value.trim().length >= 2) setIsOpen(true);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search users, assessments..."
              className="flex-1 h-9 px-1 text-xs bg-transparent border-0 outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400"
            />
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Clear input"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsMobileExpanded(false);
                setIsOpen(false);
              }}
              className="px-2 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
          </div>

          {isOpen && query.trim().length >= 2 && (
            <div className="mt-2 bg-white dark:bg-surface-dark rounded-xl border border-surface-light-border dark:border-surface-dark-border shadow-2xl overflow-hidden max-h-[65vh]">
              {renderDropdownContent()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminSearchBar;
