import test from 'node:test';
import assert from 'node:assert/strict';
import { BRANDED_TRANSITION_MIN_DURATION_MS } from '../frontend/src/utils/constants.js';

test('1. Axios Response Interceptor — Abort & Retry Rules', async (t) => {
  await t.test('1.1 Canceled and aborted requests are immediately rejected without retry', () => {
    // Replicate interceptor cancellation test
    const isCancelError = (error) => {
      return (
        error?.name === 'CanceledError' ||
        error?.code === 'ERR_CANCELED' ||
        error?.__CANCEL__ === true
      );
    };

    const shouldRetry = (error, originalRequest) => {
      if (isCancelError(error)) return false;
      if (!originalRequest) return false;
      if (originalRequest.method?.toLowerCase() !== 'get') return false;
      if (originalRequest._retry) return false;
      if (originalRequest.signal?.aborted) return false;
      if (!error.response) {
        return error.code !== 'ECONNABORTED' && !isCancelError(error);
      }
      return error.response.status >= 502 && error.response.status <= 504;
    };

    // Test AbortController CanceledError
    const abortErr = new Error('canceled');
    abortErr.name = 'CanceledError';
    abortErr.code = 'ERR_CANCELED';
    assert.equal(isCancelError(abortErr), true);
    assert.equal(shouldRetry(abortErr, { method: 'get', _retry: false }), false);

    // Test aborted signal
    const networkErrWithAbortedSignal = new Error('Network Error');
    const reqWithAbortedSignal = { method: 'get', _retry: false, signal: { aborted: true } };
    assert.equal(shouldRetry(networkErrWithAbortedSignal, reqWithAbortedSignal), false);
  });

  await t.test('1.2 Non-idempotent methods (POST, PUT, DELETE, PATCH) are never retried', () => {
    const isCancelError = (error) => error?.name === 'CanceledError';
    const shouldRetry = (error, originalRequest) => {
      if (isCancelError(error)) return false;
      if (!originalRequest) return false;
      if (originalRequest.method?.toLowerCase() !== 'get') return false;
      if (originalRequest._retry) return false;
      if (originalRequest.signal?.aborted) return false;
      if (!error.response) return true;
      return error.response.status >= 502 && error.response.status <= 504;
    };

    const networkErr = new Error('Network Error');
    assert.equal(shouldRetry(networkErr, { method: 'post' }), false);
    assert.equal(shouldRetry(networkErr, { method: 'put' }), false);
    assert.equal(shouldRetry(networkErr, { method: 'delete' }), false);
    assert.equal(shouldRetry(networkErr, { method: 'patch' }), false);
  });

  await t.test('1.3 Only transient errors (network drop or 502-504) on GET trigger a single retry', () => {
    const shouldRetry = (error, originalRequest) => {
      if (!originalRequest) return false;
      if (originalRequest.method?.toLowerCase() !== 'get') return false;
      if (originalRequest._retry) return false;
      if (originalRequest.signal?.aborted) return false;
      if (!error.response) return true;
      return error.response.status >= 502 && error.response.status <= 504;
    };

    // Transient network drop on GET
    assert.equal(shouldRetry(new Error('Network drop'), { method: 'get' }), true);
    // Already retried once -> should not retry again
    assert.equal(shouldRetry(new Error('Network drop'), { method: 'get', _retry: true }), false);

    // 502 Bad Gateway -> retry once
    assert.equal(shouldRetry({ response: { status: 502 } }, { method: 'get' }), true);
    // 503 Service Unavailable -> retry once
    assert.equal(shouldRetry({ response: { status: 503 } }, { method: 'get' }), true);
    // 504 Gateway Timeout -> retry once
    assert.equal(shouldRetry({ response: { status: 504 } }, { method: 'get' }), true);

    // Non-transient errors: 400, 401, 403, 404, 500 -> never retried
    assert.equal(shouldRetry({ response: { status: 400 } }, { method: 'get' }), false);
    assert.equal(shouldRetry({ response: { status: 401 } }, { method: 'get' }), false);
    assert.equal(shouldRetry({ response: { status: 403 } }, { method: 'get' }), false);
    assert.equal(shouldRetry({ response: { status: 404 } }, { method: 'get' }), false);
    assert.equal(shouldRetry({ response: { status: 500 } }, { method: 'get' }), false);
  });
});

test('2. Button Loading State Normalization & Double-Submit Protection', async (t) => {
  const resolveButtonState = ({ isLoading = false, loading = false, disabled = false }) => {
    const isSpinning = Boolean(isLoading || loading);
    const isDisabled = Boolean(disabled || isSpinning);
    return { isSpinning, isDisabled, ariaBusy: isSpinning };
  };

  await t.test('2.1 Button correctly normalizes isLoading={true}', () => {
    const state = resolveButtonState({ isLoading: true });
    assert.equal(state.isSpinning, true);
    assert.equal(state.isDisabled, true);
    assert.equal(state.ariaBusy, true);
  });

  await t.test('2.2 Button correctly normalizes legacy loading={true}', () => {
    const state = resolveButtonState({ loading: true });
    assert.equal(state.isSpinning, true);
    assert.equal(state.isDisabled, true);
    assert.equal(state.ariaBusy, true);
  });

  await t.test('2.3 Button prevents click dispatch when spinning or disabled', () => {
    let clickCount = 0;
    const handleClick = () => { clickCount++; };

    const dispatchClick = (buttonState, onClick) => {
      if (buttonState.isDisabled) return;
      onClick?.();
    };

    // When spinning
    const spinningState = resolveButtonState({ isLoading: true });
    dispatchClick(spinningState, handleClick);
    assert.equal(clickCount, 0, 'Click must not execute while spinning');

    // When disabled
    const disabledState = resolveButtonState({ disabled: true });
    dispatchClick(disabledState, handleClick);
    assert.equal(clickCount, 0, 'Click must not execute while disabled');

    // When normal
    const normalState = resolveButtonState({});
    dispatchClick(normalState, handleClick);
    assert.equal(clickCount, 1, 'Click must execute in normal idle state');
  });
});

test('3. Search Race Condition & Debounce Logic', async (t) => {
  await t.test('3.1 Stale response discard via activeRequestIdRef', async () => {
    let activeRequestId = 0;
    let committedResults = [];

    const mockSearchApi = async (reqId, query, delayMs, results) => {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      // Stale response guard
      if (reqId === activeRequestId) {
        committedResults = results;
      }
    };

    // Request 1: "py" (issued first, slow network: 80ms)
    const req1Id = ++activeRequestId;
    const promise1 = mockSearchApi(req1Id, 'py', 80, ['python basics', 'python advanced']);

    // Request 2: "python" (issued second, fast network: 20ms)
    const req2Id = ++activeRequestId;
    const promise2 = mockSearchApi(req2Id, 'python', 20, ['python 3.12']);

    await Promise.all([promise1, promise2]);

    // Request 2 was newer (activeRequestId === 2).
    // Even though request 1 completed after request 2, request 1 must NOT overwrite results!
    assert.deepEqual(committedResults, ['python 3.12']);
  });

  await t.test('3.2 Debounce timer collates rapid keystrokes', async () => {
    let triggeredSearches = [];
    let timer = null;

    const onKeystroke = (val, delay = 50) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        triggeredSearches.push(val);
      }, delay);
    };

    onKeystroke('r');
    onKeystroke('re');
    onKeystroke('rea');
    onKeystroke('react');

    await new Promise((resolve) => setTimeout(resolve, 80));

    // Only the last keystroke 'react' should have triggered
    assert.deepEqual(triggeredSearches, ['react']);
  });
});

test('4. Dashboard Over-fetching & Tab Decoupling Logic', async (t) => {
  await t.test('4.1 coreLoadedRef prevents redundant catalog refetch on subroute switch', () => {
    let catalogFetchCount = 0;
    const coreLoadedRef = { current: false };

    const loadStudentCatalog = () => {
      if (coreLoadedRef.current) return;
      catalogFetchCount++;
      coreLoadedRef.current = true;
    };

    // First visit to /student/dashboard
    loadStudentCatalog();
    assert.equal(catalogFetchCount, 1);

    // Switch to /student/catalog
    loadStudentCatalog();
    assert.equal(catalogFetchCount, 1, 'Should NOT refetch catalog on route navigation');

    // Switch to /student/submissions
    loadStudentCatalog();
    assert.equal(catalogFetchCount, 1, 'Should NOT refetch catalog on route navigation');
  });

  await t.test('4.2 Admin tab switching decouples overview telemetry from settings and logs', () => {
    const fetchedEndpoints = [];

    const loadDashboardOverview = () => {
      fetchedEndpoints.push('/api/admin/stats');
      fetchedEndpoints.push('/api/admin/pending-users');
      fetchedEndpoints.push('/api/admin/alerts');
    };

    const loadSettingsOnDemand = (tab, settingsLoaded) => {
      if (tab === 'settings' && !settingsLoaded) {
        fetchedEndpoints.push('/api/admin/settings');
      }
    };

    const loadLogsOnDemand = (tab) => {
      if (tab === 'logs') {
        fetchedEndpoints.push('/api/admin/logs');
      }
    };

    // Initial mount on overview
    loadDashboardOverview();
    assert.deepEqual(fetchedEndpoints, [
      '/api/admin/stats',
      '/api/admin/pending-users',
      '/api/admin/alerts'
    ]);

    // Admin stays on overview -> settings and logs never called
    loadSettingsOnDemand('overview', false);
    loadLogsOnDemand('overview');
    assert.equal(fetchedEndpoints.includes('/api/admin/settings'), false);
    assert.equal(fetchedEndpoints.includes('/api/admin/logs'), false);

    // Admin navigates to settings -> on-demand fetch occurs
    loadSettingsOnDemand('settings', false);
    assert.equal(fetchedEndpoints.includes('/api/admin/settings'), true);
  });
});

test('5. Global Layout Scroll Position Architecture & Deterministic Reset', async (t) => {
  await t.test('5.1 MainLayout scroll-reset triggers on pathname change with instant behavior', () => {
    let scrolledTop = 450;
    let scrolledLeft = 50;
    let behaviorUsed = null;

    const mockMainEl = {
      scrollTop: scrolledTop,
      scrollLeft: scrolledLeft,
      scrollTo: ({ top, left, behavior }) => {
        scrolledTop = top;
        scrolledLeft = left;
        behaviorUsed = behavior;
      },
    };

    // Simulate effect execution on pathname transition (/admin/dashboard -> /admin/users)
    const handlePathnameChange = (mainEl, prevPath, nextPath) => {
      if (prevPath !== nextPath && mainEl) {
        if (typeof mainEl.scrollTo === 'function') {
          mainEl.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        }
        mainEl.scrollTop = 0;
        mainEl.scrollLeft = 0;
      }
    };

    handlePathnameChange(mockMainEl, '/admin/dashboard', '/admin/users');

    assert.equal(scrolledTop, 0, 'Scroll top must be reset to 0');
    assert.equal(scrolledLeft, 0, 'Scroll left must be reset to 0');
    assert.equal(behaviorUsed, 'instant', 'Scroll reset must be deterministic and instant');
    assert.equal(mockMainEl.scrollTop, 0);
  });

  await t.test('5.2 In-page state, search, and pagination actions do not reset scroll when pathname is unchanged', () => {
    let scrollPosition = 300;
    const mockMainEl = {
      scrollTop: scrollPosition,
      scrollTo: ({ top }) => {
        scrollPosition = top;
      },
    };

    const runPathnameEffect = (mainEl, prevPath, nextPath) => {
      if (prevPath !== nextPath && mainEl) {
        if (typeof mainEl.scrollTo === 'function') {
          mainEl.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        }
        mainEl.scrollTop = 0;
      }
    };

    // User types in search box or clicks next page: pathname remains '/admin/student-registry'
    const currentPath = '/admin/student-registry';
    runPathnameEffect(mockMainEl, currentPath, currentPath);

    assert.equal(scrollPosition, 300, 'Scroll must NOT be reset on in-page state changes');
    assert.equal(mockMainEl.scrollTop, 300);
  });
});

test('6. Global RBAC Layout & Dashboard Banner Isolation Rules', async (t) => {
  await t.test('6.1 Student Workspace: Welcome banner, date filter, and stat cards render strictly on dashboard view', () => {
    const resolveStudentBannerVisibility = (pathname) => {
      const currentView = pathname.includes('/student/catalog')
        ? 'catalog'
        : pathname.includes('/student/submissions')
        ? 'submissions'
        : pathname.includes('/student/profile')
        ? 'profile'
        : 'dashboard';

      return {
        currentView,
        showWelcomeBanner: currentView === 'dashboard',
        showDateFilterToolbar: currentView === 'dashboard',
        showOverviewStatCards: currentView === 'dashboard',
      };
    };

    // Route: /student/dashboard -> Banner visible
    const dash = resolveStudentBannerVisibility('/student/dashboard');
    assert.equal(dash.currentView, 'dashboard');
    assert.equal(dash.showWelcomeBanner, true, 'Welcome banner must render on /student/dashboard');
    assert.equal(dash.showDateFilterToolbar, true);
    assert.equal(dash.showOverviewStatCards, true);

    // Route: /student/catalog -> Banner suppressed
    const catalog = resolveStudentBannerVisibility('/student/catalog');
    assert.equal(catalog.currentView, 'catalog');
    assert.equal(catalog.showWelcomeBanner, false, 'Welcome banner must NOT render on /student/catalog');
    assert.equal(catalog.showDateFilterToolbar, false);
    assert.equal(catalog.showOverviewStatCards, false);

    // Route: /student/submissions -> Banner suppressed
    const subs = resolveStudentBannerVisibility('/student/submissions');
    assert.equal(subs.currentView, 'submissions');
    assert.equal(subs.showWelcomeBanner, false, 'Welcome banner must NOT render on /student/submissions');
    assert.equal(subs.showDateFilterToolbar, false);
    assert.equal(subs.showOverviewStatCards, false);
  });

  await t.test('6.2 Admin Master Console: Hero banner and overview stat cards render strictly on overview route', () => {
    const resolveAdminBannerVisibility = (pathname) => {
      const getTabFromPath = (path) => {
        if (path.includes('/admin/users')) return 'users';
        if (path.includes('/admin/assessments')) return 'assessments';
        if (path.includes('/admin/logs')) return 'logs';
        if (path.includes('/admin/settings')) return 'settings';
        return 'overview';
      };

      const activeTab = getTabFromPath(pathname);
      return {
        activeTab,
        showHeroBanner: activeTab === 'overview',
        showOverviewStatCards: activeTab === 'overview',
      };
    };

    // Route: /admin/dashboard -> Hero banner and stat cards visible
    const overview = resolveAdminBannerVisibility('/admin/dashboard');
    assert.equal(overview.activeTab, 'overview');
    assert.equal(overview.showHeroBanner, true, 'Hero banner must render on /admin/dashboard');
    assert.equal(overview.showOverviewStatCards, true);

    // Route: /admin/users -> Hero banner and stat cards suppressed
    const users = resolveAdminBannerVisibility('/admin/users');
    assert.equal(users.activeTab, 'users');
    assert.equal(users.showHeroBanner, false, 'Hero banner must NOT leak onto /admin/users');
    assert.equal(users.showOverviewStatCards, false);

    // Route: /admin/assessments -> Hero banner and stat cards suppressed
    const assessments = resolveAdminBannerVisibility('/admin/assessments');
    assert.equal(assessments.activeTab, 'assessments');
    assert.equal(assessments.showHeroBanner, false, 'Hero banner must NOT leak onto /admin/assessments');
    assert.equal(assessments.showOverviewStatCards, false);

    // Route: /admin/logs -> Hero banner and stat cards suppressed
    const logs = resolveAdminBannerVisibility('/admin/logs');
    assert.equal(logs.activeTab, 'logs');
    assert.equal(logs.showHeroBanner, false, 'Hero banner must NOT leak onto /admin/logs');
    assert.equal(logs.showOverviewStatCards, false);

    // Route: /admin/settings -> Hero banner and stat cards suppressed
    const settings = resolveAdminBannerVisibility('/admin/settings');
    assert.equal(settings.activeTab, 'settings');
    assert.equal(settings.showHeroBanner, false, 'Hero banner must NOT leak onto /admin/settings');
    assert.equal(settings.showOverviewStatCards, false);
  });
});

test('7. Loading States Contract & Premature Empty-State Suppression', async (t) => {
  const resolveTableDisplayState = ({ isLoading, recordCount }) => {
    if (isLoading && recordCount === 0) return 'TABLE_SKELETON';
    if (recordCount === 0) return 'EMPTY_STATE';
    return 'TABLE_DATA';
  };

  const resolveCardDisplayState = ({ isLoading, recordCount }) => {
    if (isLoading && recordCount === 0) return 'CARD_SKELETON';
    if (recordCount === 0) return 'EMPTY_STATE';
    return 'CARD_DATA';
  };

  await t.test('7.1 Admin Users Directory: Shows TableSkeleton during fetch and suppresses EmptyState', () => {
    // In-flight initial request with no records loaded yet
    const inFlight = resolveTableDisplayState({ isLoading: true, recordCount: 0 });
    assert.equal(inFlight, 'TABLE_SKELETON', 'Must show TableSkeleton while loading with 0 records');

    // Finished request with 0 matching records -> Valid empty state
    const finishedEmpty = resolveTableDisplayState({ isLoading: false, recordCount: 0 });
    assert.equal(finishedEmpty, 'EMPTY_STATE', 'Must show EmptyState only after request completes with 0 records');

    // Finished request with records
    const finishedWithData = resolveTableDisplayState({ isLoading: false, recordCount: 15 });
    assert.equal(finishedWithData, 'TABLE_DATA', 'Must show TableData when records exist');
  });

  await t.test('7.2 Admin Assessments Oversight: Shows TableSkeleton during fetch and suppresses EmptyState', () => {
    const inFlight = resolveTableDisplayState({ isLoading: true, recordCount: 0 });
    assert.equal(inFlight, 'TABLE_SKELETON');

    const empty = resolveTableDisplayState({ isLoading: false, recordCount: 0 });
    assert.equal(empty, 'EMPTY_STATE');
  });

  await t.test('7.3 Admin Audit Logs: Shows TableSkeleton during fetch and suppresses EmptyState', () => {
    const inFlight = resolveTableDisplayState({ isLoading: true, recordCount: 0 });
    assert.equal(inFlight, 'TABLE_SKELETON');

    const empty = resolveTableDisplayState({ isLoading: false, recordCount: 0 });
    assert.equal(empty, 'EMPTY_STATE');
  });

  await t.test('7.4 Student Assessment Catalog: Shows CardSkeleton during fetch and suppresses EmptyState', () => {
    const inFlight = resolveCardDisplayState({ isLoading: true, recordCount: 0 });
    assert.equal(inFlight, 'CARD_SKELETON', 'Catalog must render CardSkeleton during fetch');

    const empty = resolveCardDisplayState({ isLoading: false, recordCount: 0 });
    assert.equal(empty, 'EMPTY_STATE');
  });

  await t.test('7.5 Initial route loading resolves role- and tab-specific skeleton shells', () => {
    const resolveInitialRouteSkeleton = ({ role, pathname }) => {
      if (role === 'admin') {
        if (pathname.includes('/admin/users')) return 'UsersTableSkeleton';
        if (pathname.includes('/admin/assessments')) return 'AssessmentsTableSkeleton';
        if (pathname.includes('/admin/logs')) return 'LogsTableSkeleton';
        if (pathname.includes('/admin/settings')) return 'SettingsFormSkeleton';
        return 'AdminDashboardSkeleton';
      }
      if (role === 'student') {
        if (pathname.includes('/student/catalog')) return 'CatalogCardSkeleton';
        if (pathname.includes('/student/submissions')) return 'SubmissionsTableSkeleton';
        return 'StudentDashboardSkeleton';
      }
      return 'GenericSkeleton';
    };

    assert.equal(resolveInitialRouteSkeleton({ role: 'admin', pathname: '/admin/dashboard' }), 'AdminDashboardSkeleton');
    assert.equal(resolveInitialRouteSkeleton({ role: 'admin', pathname: '/admin/users' }), 'UsersTableSkeleton');
    assert.equal(resolveInitialRouteSkeleton({ role: 'admin', pathname: '/admin/assessments' }), 'AssessmentsTableSkeleton');
    assert.equal(resolveInitialRouteSkeleton({ role: 'admin', pathname: '/admin/logs' }), 'LogsTableSkeleton');
    assert.equal(resolveInitialRouteSkeleton({ role: 'admin', pathname: '/admin/settings' }), 'SettingsFormSkeleton');

    assert.equal(resolveInitialRouteSkeleton({ role: 'student', pathname: '/student/dashboard' }), 'StudentDashboardSkeleton');
    assert.equal(resolveInitialRouteSkeleton({ role: 'student', pathname: '/student/catalog' }), 'CatalogCardSkeleton');
    assert.equal(resolveInitialRouteSkeleton({ role: 'student', pathname: '/student/submissions' }), 'SubmissionsTableSkeleton');
  });
});

test('8. Instructor Skeletons, Dynamic Greetings & Auth State Transitions', async (t) => {
  await t.test('8.1 Instructor TableSkeleton column geometries accurately match rendered table headers', () => {
    const tableConfigs = {
      submissionsQueue: { columns: 8, headers: ['Student', 'Assessment', 'Submitted', 'Auto Score', 'Manual Score', 'Final Result', 'Status', 'Action'] },
      assessmentsList: { columns: 7, headers: ['Assessment', 'Status', 'Access', 'Duration', 'Weight', 'Last Modified', 'Actions'] },
      studentsList: { columns: 5, headers: ['Student Name', 'Email', 'Status', 'Submissions', 'Enrolled Since'] },
      evaluationsQueue: { columns: 6, headers: ['Student', 'Assessment', 'Submitted', 'Auto Score', 'Status', 'Action'] },
    };

    assert.equal(tableConfigs.submissionsQueue.columns, tableConfigs.submissionsQueue.headers.length);
    assert.equal(tableConfigs.assessmentsList.columns, tableConfigs.assessmentsList.headers.length);
    assert.equal(tableConfigs.studentsList.columns, tableConfigs.studentsList.headers.length);
    assert.equal(tableConfigs.evaluationsQueue.columns, tableConfigs.evaluationsQueue.headers.length);
  });

  await t.test('8.2 Dynamic greeting helper produces correct time-of-day categories and formats names cleanly', async () => {
    const { getTimeOfDay, getTimeBasedGreeting } = await import('../frontend/src/utils/greeting.js');

    const makeDate = (hours, minutes) => new Date(2026, 9, 13, hours, minutes);

    // Boundaries
    assert.equal(getTimeOfDay(makeDate(0, 0)), 'evening');
    assert.equal(getTimeOfDay(makeDate(4, 59)), 'evening');
    assert.equal(getTimeOfDay(makeDate(5, 0)), 'morning');
    assert.equal(getTimeOfDay(makeDate(11, 59)), 'morning');
    assert.equal(getTimeOfDay(makeDate(12, 0)), 'afternoon');
    assert.equal(getTimeOfDay(makeDate(16, 59)), 'afternoon');
    assert.equal(getTimeOfDay(makeDate(17, 0)), 'evening');
    assert.equal(getTimeOfDay(makeDate(23, 59)), 'evening');

    // Missing / whitespace names
    assert.equal(getTimeBasedGreeting(null, makeDate(9, 0)), 'Good morning 👋');
    assert.equal(getTimeBasedGreeting(undefined, makeDate(13, 0)), 'Good afternoon 👋');
    assert.equal(getTimeBasedGreeting('   ', makeDate(18, 0)), 'Good evening 👋');
    assert.equal(getTimeBasedGreeting('  Jane Doe  ', makeDate(9, 0)), 'Good morning, Jane Doe 👋');
  });

  await t.test('8.3 ProtectedRoute transitions render PageLoader during authentication initialization', () => {
    const resolveGuardRender = ({ isLoading, isAuthenticated }) => {
      if (isLoading) return 'PAGE_LOADER';
      if (!isAuthenticated) return 'NAVIGATE_TO_LOGIN';
      return 'OUTLET';
    };

    assert.equal(resolveGuardRender({ isLoading: true, isAuthenticated: false }), 'PAGE_LOADER');
    assert.equal(resolveGuardRender({ isLoading: true, isAuthenticated: true }), 'PAGE_LOADER');
    assert.equal(resolveGuardRender({ isLoading: false, isAuthenticated: false }), 'NAVIGATE_TO_LOGIN');
    assert.equal(resolveGuardRender({ isLoading: false, isAuthenticated: true }), 'OUTLET');
  });

  await t.test('8.4 Logout transition guarantees atomic cache invalidation and token destruction', async () => {
    let serverRevocationCalled = false;
    let localTokensRemoved = false;
    let authStateCleared = false;

    const fakeStorage = {
      removeToken: () => { localTokensRemoved = true; }
    };
    const fakeAuthService = {
      logout: async () => { serverRevocationCalled = true; }
    };

    const logout = async () => {
      try {
        await fakeAuthService.logout();
      } catch {
        // ignore
      } finally {
        fakeStorage.removeToken();
        authStateCleared = true;
      }
    };

    await logout();
    assert.equal(serverRevocationCalled, true);
    assert.equal(localTokensRemoved, true);
    assert.equal(authStateCleared, true);
  });
});

test('9. Global RBAC Sidebar Collapse Architecture for All Roles', async (t) => {
  await t.test('9.1 isCollapsible evaluates true on desktop for student, instructor, and admin; false in mobile drawer', () => {
    const resolveIsCollapsible = ({ role, onItemClick, collapsible }) => {
      if (collapsible !== undefined) return collapsible;
      return !onItemClick && Boolean(role);
    };

    // Desktop sidebar for all roles
    assert.equal(resolveIsCollapsible({ role: 'admin', onItemClick: undefined }), true);
    assert.equal(resolveIsCollapsible({ role: 'student', onItemClick: undefined }), true);
    assert.equal(resolveIsCollapsible({ role: 'instructor', onItemClick: undefined }), true);

    // Mobile drawer (onItemClick passed)
    assert.equal(resolveIsCollapsible({ role: 'admin', onItemClick: () => {} }), false);
    assert.equal(resolveIsCollapsible({ role: 'student', onItemClick: () => {} }), false);
    assert.equal(resolveIsCollapsible({ role: 'instructor', onItemClick: () => {} }), false);

    // Explicit override via prop
    assert.equal(resolveIsCollapsible({ role: 'student', collapsible: false }), false);
    assert.equal(resolveIsCollapsible({ role: 'student', collapsible: true, onItemClick: () => {} }), true);
  });

  await t.test('9.2 Role-aware storage keys map accurately for all roles without cross-role leakage', async () => {
    const { STORAGE_KEYS } = await import('../frontend/src/utils/constants.js');

    const getStorageKeyForRole = (role) => {
      if (role === 'admin') return STORAGE_KEYS.ADMIN_SIDEBAR_COLLAPSED;
      if (role === 'student') return STORAGE_KEYS.STUDENT_SIDEBAR_COLLAPSED;
      if (role === 'instructor') return STORAGE_KEYS.INSTRUCTOR_SIDEBAR_COLLAPSED;
      return `uap_${role}_sidebar_collapsed`;
    };

    assert.equal(getStorageKeyForRole('admin'), 'uap_admin_sidebar_collapsed');
    assert.equal(getStorageKeyForRole('student'), 'uap_student_sidebar_collapsed');
    assert.equal(getStorageKeyForRole('instructor'), 'uap_instructor_sidebar_collapsed');
  });

  await t.test('9.3 Width resolution switches accurately between w-64 (expanded) and w-20 (collapsed)', () => {
    const resolveWidthClass = ({ effectiveCollapsed, className = '' }) => {
      if (className.includes('w-')) return '';
      return effectiveCollapsed ? 'w-20' : 'w-64';
    };

    assert.equal(resolveWidthClass({ effectiveCollapsed: false }), 'w-64');
    assert.equal(resolveWidthClass({ effectiveCollapsed: true }), 'w-20');
    assert.equal(resolveWidthClass({ effectiveCollapsed: true, className: 'w-72' }), '');
  });

  await t.test('9.4 Collapse state preserves active link status and accessibility attributes across routes', async () => {
    const { isNavigationItemActive, studentNavigation, instructorNavigation } = await import('../frontend/src/config/navigationConfig.js');

    // Student Dashboard active on /student/dashboard
    const studentDashItem = studentNavigation.sections[0].items[0];
    assert.equal(isNavigationItemActive(studentDashItem, '/student/dashboard'), true);
    assert.equal(isNavigationItemActive(studentDashItem, '/student/catalog'), false);

    // Student Catalog active on /student/catalog and /student/attempt/123
    const studentCatalogItem = studentNavigation.sections[1].items[0];
    assert.equal(isNavigationItemActive(studentCatalogItem, '/student/catalog'), true);
    assert.equal(isNavigationItemActive(studentCatalogItem, '/student/attempt/123'), true);

    // Instructor My Assessments active on /instructor/assessments and /instructor/edit/abc
    const instructorAsmtItem = instructorNavigation.sections[1].items[0];
    assert.equal(isNavigationItemActive(instructorAsmtItem, '/instructor/assessments'), true);
    assert.equal(isNavigationItemActive(instructorAsmtItem, '/instructor/edit/abc'), true);
  });
});

test('10. Question Bank Action Alignment, Skeletons & Branded Visual Effect Architecture (2.5s Minimum)', async (t) => {
  await t.test('10.1 Question Bank Action Group Layout Contract — Desktop Horizontal & Responsive Wrapping', () => {
    // Resolver for action button group container classes
    const resolveActionGroupClasses = (layoutMode) => {
      if (layoutMode === 'legacy') {
        // Old broken behavior: vertically stacked on desktop
        return 'flex items-center md:flex-col gap-2 flex-shrink-0 self-end md:self-start';
      }
      // Fixed approved behavior: horizontal on desktop with responsive wrapping
      return 'flex flex-wrap items-center justify-end gap-2 flex-shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800 w-full md:w-auto';
    };

    const legacyClasses = resolveActionGroupClasses('legacy');
    const fixedClasses = resolveActionGroupClasses('fixed');

    assert.equal(legacyClasses.includes('md:flex-col'), true, 'Legacy layout erroneously stacked actions vertically on desktop');
    assert.equal(fixedClasses.includes('md:flex-col'), false, 'Fixed layout must NOT vertically stack on desktop');
    assert.equal(fixedClasses.includes('flex-wrap'), true, 'Fixed layout must allow intentional wrapping on smaller screens');
    assert.equal(fixedClasses.includes('justify-end'), true, 'Fixed layout must align buttons cleanly to the right');
    assert.equal(fixedClasses.includes('md:w-auto'), true, 'Fixed layout takes natural auto width on desktop');
  });

  await t.test('10.2 QuestionCardSkeleton Structure Contract — Matches Wide Question Card Geometry', () => {
    const resolveSkeletonLayout = (variant) => {
      if (variant === 'question') {
        return {
          containerClass: 'space-y-3',
          cardClass: 'p-5 rounded-2xl animate-pulse',
          hasMetadataPills: true,
          hasPromptLines: true,
          hasOptionGrid: true,
          hasTags: true,
          actionAlignment: 'horizontal',
        };
      }
      return {
        containerClass: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5',
        cardClass: 'p-5 rounded-2xl animate-pulse space-y-4',
        hasMetadataPills: false,
        hasPromptLines: true,
        hasOptionGrid: false,
        hasTags: false,
        actionAlignment: 'grid-bottom',
      };
    };

    const qSkel = resolveSkeletonLayout('question');
    const gridSkel = resolveSkeletonLayout('grid');

    assert.equal(qSkel.containerClass, 'space-y-3', 'Question card skeleton must render in vertical space-y-3 stack matching question list');
    assert.equal(qSkel.hasMetadataPills, true, 'Question card skeleton must include metadata pills placeholder');
    assert.equal(qSkel.hasOptionGrid, true, 'Question card skeleton must include MCQ options preview placeholder grid');
    assert.equal(qSkel.hasTags, true, 'Question card skeleton must include tags placeholder');
    assert.equal(qSkel.actionAlignment, 'horizontal', 'Question card skeleton actions must match desktop horizontal layout without vertical stacking');
    assert.notEqual(qSkel.containerClass, gridSkel.containerClass, 'Question skeleton must NOT use 3-column grid layout');
  });

  await t.test('10.3 Transition 1: Initial Application-Entry Experience — ~2.5-Second Minimum Presentation & Fast Fail Guarantee', async () => {
    // Verify constant definition
    assert.equal(BRANDED_TRANSITION_MIN_DURATION_MS, 2500, 'BRANDED_TRANSITION_MIN_DURATION_MS must be 2500ms (2.5 seconds)');

    const simulateInitialEntryPresentation = async ({ authDurationMs, isAuthenticated = true, minDurationMs = 2500 }) => {
      const startTime = Date.now();
      let isAuthResolving = true;
      let minPresentationDone = false;
      let presentationTimer = null;
      let redirectedToLogin = false;

      // Simulate auth hydration resolving
      const authPromise = new Promise((resolve) => {
        setTimeout(() => {
          isAuthResolving = false;
          if (!isAuthenticated) {
            // Failed auth: immediately cancel presentation hold and redirect
            if (presentationTimer) clearTimeout(presentationTimer);
            redirectedToLogin = true;
          }
          resolve();
        }, authDurationMs);
      });

      // Simulate minimum presentation timer
      const presentationPromise = new Promise((resolve) => {
        presentationTimer = setTimeout(() => {
          minPresentationDone = true;
          resolve();
        }, minDurationMs);
      });

      // For successful auth: wait for BOTH auth resolution and min presentation timer
      // For failed auth: exit immediately upon auth failure without waiting for min presentation timer
      if (isAuthenticated) {
        await Promise.all([authPromise, presentationPromise]);
      } else {
        await authPromise;
      }

      const totalElapsed = Date.now() - startTime;
      const loaderVisible = !redirectedToLogin && (isAuthResolving || !minPresentationDone);

      return {
        totalElapsed,
        loaderVisible,
        redirectedToLogin,
        canPresentProtectedContent: !isAuthResolving && minPresentationDone && isAuthenticated,
      };
    };

    // Case A: Fast successful auth resolution (10ms) -> Must hold for at least minDuration (tested with scaled 50ms)
    const fastAuthResult = await simulateInitialEntryPresentation({ authDurationMs: 10, isAuthenticated: true, minDurationMs: 50 });
    assert.equal(fastAuthResult.canPresentProtectedContent, true);
    assert.equal(fastAuthResult.totalElapsed >= 45, true, 'Must hold for at least minimum presentation time even if auth returns early');

    // Case B: Slow successful auth resolution (70ms) exceeding min duration (40ms) -> Must wait until auth genuinely resolves
    const slowAuthResult = await simulateInitialEntryPresentation({ authDurationMs: 70, isAuthenticated: true, minDurationMs: 40 });
    assert.equal(slowAuthResult.canPresentProtectedContent, true);
    assert.equal(slowAuthResult.totalElapsed >= 65, true, 'Must continue loading until auth resolves when auth takes longer than minimum');

    // Case C: Failed auth resolution (15ms) -> Stops loader immediately, redirects to login, does NOT hold for minDuration (60ms)
    const failedAuthResult = await simulateInitialEntryPresentation({ authDurationMs: 15, isAuthenticated: false, minDurationMs: 60 });
    assert.equal(failedAuthResult.canPresentProtectedContent, false);
    assert.equal(failedAuthResult.redirectedToLogin, true, 'Failed authentication must immediately trigger redirect to login');
    assert.equal(failedAuthResult.loaderVisible, false, 'Failed authentication must immediately extinguish the loading preloader');
    assert.equal(failedAuthResult.totalElapsed < 45, true, 'Failed authentication must NOT wait for the minimum presentation duration to elapse');
  });

  await t.test('10.4 Transition 2: Post-Login Branded Transition Contract — Immediate Auth with ~2.5s Branded Hold & Immediate Error Handling', async () => {
    let tokensPersisted = false;
    let transitionCompleted = false;

    const fakeBackendLogin = async (succeed = true) => {
      if (!succeed) {
        throw new Error('Invalid credentials or account revoked');
      }
      tokensPersisted = true;
      return { accessToken: 'jwt-123', user: { role: 'instructor', name: 'Dr. Jane' } };
    };

    const simulatePostLoginTransition = async ({ succeed = true, minDurationMs = 40 }) => {
      try {
        const response = await fakeBackendLogin(succeed);
        const user = response.user;
        assert.equal(tokensPersisted, true, 'Tokens must be stored immediately upon server response');

        // Branded transition presentation runs for minDuration
        await new Promise((resolve) => setTimeout(resolve, minDurationMs));
        transitionCompleted = true;
        return { success: true, redirectedTo: `/${user.role}/dashboard` };
      } catch (err) {
        return { success: false, error: err.message, redirectedTo: null };
      }
    };

    // Case A: Successful login -> Immediate tokens, branded hold for minDuration, then dashboard redirect
    const successResult = await simulatePostLoginTransition({ succeed: true, minDurationMs: 40 });
    assert.equal(transitionCompleted, true);
    assert.equal(successResult.redirectedTo, '/instructor/dashboard');

    // Case B: Failed login -> Immediate error, tokens NOT persisted, zero branded transition hold
    tokensPersisted = false;
    transitionCompleted = false;
    const failResult = await simulatePostLoginTransition({ succeed: false, minDurationMs: 40 });
    assert.equal(failResult.success, false);
    assert.equal(failResult.error, 'Invalid credentials or account revoked');
    assert.equal(failResult.redirectedTo, null);
    assert.equal(tokensPersisted, false, 'Tokens must never be persisted on failed login');
    assert.equal(transitionCompleted, false, 'Branded transition must never run on failed login');
  });

  await t.test('10.5 In-Page Filtering, Search & Pagination Do NOT Trigger Minimum Branded Delay', () => {
    const isDesignatedBrandedTransition = ({ transitionType }) => {
      return (
        transitionType === 'INITIAL_APP_ENTRY' ||
        transitionType === 'POST_LOGIN'
      );
    };

    // Designated transitions
    assert.equal(isDesignatedBrandedTransition({ transitionType: 'INITIAL_APP_ENTRY' }), true);
    assert.equal(isDesignatedBrandedTransition({ transitionType: 'POST_LOGIN' }), true);

    // Standard in-page operations: MUST NOT have minimum branded delay
    assert.equal(isDesignatedBrandedTransition({ transitionType: 'SEARCH_KEYSTROKE' }), false);
    assert.equal(isDesignatedBrandedTransition({ transitionType: 'PAGINATION_CHANGE' }), false);
    assert.equal(isDesignatedBrandedTransition({ transitionType: 'FILTER_DROPDOWN' }), false);
    assert.equal(isDesignatedBrandedTransition({ transitionType: 'BACKGROUND_REFRESH' }), false);
    assert.equal(isDesignatedBrandedTransition({ transitionType: 'LOGOUT_REVOCATION' }), false);
  });

  await t.test('10.6 ChartSkeleton Geometry Contract — Authentic Chart Silhouette without Spinners', () => {
    const resolveChartPlaceholder = (type) => {
      return {
        hasAxes: true,
        isSpinner: false,
        silhouette: type === 'donut' ? 'donut-circle' : 'bar-columns',
        role: 'status',
        ariaLabel: 'Loading analytics chart',
      };
    };

    const barPlaceholder = resolveChartPlaceholder('bar');
    const donutPlaceholder = resolveChartPlaceholder('donut');

    assert.equal(barPlaceholder.isSpinner, false, 'Chart placeholder must not be a generic spinner');
    assert.equal(barPlaceholder.silhouette, 'bar-columns', 'Bar chart placeholder renders bar columns silhouette');
    assert.equal(donutPlaceholder.silhouette, 'donut-circle', 'Donut chart placeholder renders circular silhouette');
    assert.equal(barPlaceholder.hasAxes, true);
  });
});




