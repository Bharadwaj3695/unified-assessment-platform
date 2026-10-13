# UAP Master Engineering Progress Checkpoint (`docs/AGY_PROGRESS.md`)

## Project: Unified Assessment Platform (UAP)
**Scope:** Dynamic Greetings, RBAC Layout Polish, Loading Architecture, Authentication Transitions & Global Sidebar Collapse/Expand for All Roles.

---

## 1. Executive Status Summary

| Milestone | Status | Test Status | Notes |
|:---|:---:|:---:|:---|
| **Phase 1: Repository Audit** | Verified | Verified | Completed exhaustive role-by-role matrix for Student, Instructor, and Admin. |
| **Phase 2: Loading State Contract** | Verified | 26/26 Unit Tests Passing | Axios interceptors, double-submit protection, debounce & race condition guards. |
| **Phase 3: Component Loaders** | Verified | Production Build Passing | TableSkeleton, CardSkeleton, DashboardSkeleton, and SectionLoader. |
| **Phase 4: Student Layout & Banner Scoping** | Verified | 5/5 Playwright E2E Passing | Welcome Hero Banner & Date filter toolbar strictly scoped to `/student/dashboard`. Catalog and Submissions start cleanly at page top with dedicated skeletons. |
| **Phase 5: MainLayout Scroll Reset Contract** | Verified | 4/4 Playwright E2E Tests Passing | Deterministic scroll-to-top on route `pathname` change (`behavior: 'instant'`). In-page search, filter, and pagination do not reset scroll. |
| **Phase 6: Admin Dashboard Layout & Banner Scoping** | Verified | 7/7 Playwright E2E Tests Passing | Header Banner (`AdminHeroIllustration`, greeting, tab bar) and 4 Overview StatCards strictly scoped to `activeTab === 'overview'`. Dedicated admin tabs start cleanly with dedicated headers. |
| **Phase 7: Dynamic Greetings & Boundary Matrix** | Verified | 20/20 Boundary Tests Passing | Local time-of-day greeting (5:00-11:59 "Good morning", 12:00-16:59 "Good afternoon", 17:00-4:59 "Good evening"). Resilient against null, undefined, whitespace, timestamps, and invalid dates. |
| **Phase 8: Instructor Layout Polish & Skeletons** | Verified | 5/5 Playwright E2E Passing | Removed redundant wrapper padding in `QuestionBankList`. Added intentional `flex-wrap` to action button rows across all instructor views. Matched TableSkeleton geometries (Submissions: 8 cols, Assessments: 7 cols, Students: 5 cols, Evaluations: 6 cols). |
| **Phase 9: Auth Transitions & Protected Route Guards** | Verified | 8/8 Playwright E2E Passing | `ProtectedRoute` uses `PageLoader fullScreen` during auth resolution. `Header` and `Sidebar` logout handlers strictly await server session revocation before navigating with `{ replace: true }`. |
| **Phase 10: Global Sidebar Collapse for All Roles** | Verified | 8/8 Playwright E2E + 10/10 Admin E2E Passing | Enabled collapsible sidebar across Student, Instructor, and Admin workspaces on desktop. Icon-only narrow view (`w-20`), tooltip rendering (`group-focus-visible`), smooth width transition with `motion-reduce:transition-none`, active-link highlighting, and role-aware `localStorage` persistence. |
| **Phase 11: Production Build & Regression Verification** | Verified | Zero Errors (Exit Code 0) | Frontend Vite build (`npm run build`) completed successfully with 0 errors in 8.39s. All 36 unit/contract tests passing. |
| **Phase 12: Authentication & Session Lifecycle Verification** | Verified | 78/78 Node Tests Passing | Verified Stages 1, 2, 3, Bulk Reject & Student MFA, and Phase 9A. Exposed `logoutAll` in `AuthContext.jsx` and enforced student MFA disablement suppression in UI and service layers. |
| **Phase 13: Question Bank Action Alignment & Skeletons** | Verified | 43/43 Tests Passing | Fixed vertical stacking of action buttons on desktop cards (`md:flex-row`). Aligned Details, Edit, and Delete in a balanced horizontal group with responsive wrap. Created `QuestionCardSkeleton` matching authentic question layout and `ChartSkeleton` for analytical silhouettes. |
| **Phase 14: Global Branded Visual Effect Architecture (2.5s Duration)** | Verified | 43/43 Tests Passing + Vite Build Clean | Implemented branded preloader with ~2.5-second (2500ms) minimum presentation for Initial Application Entry (`ProtectedRoute`) and Post-Login transitions (`Login`, `MfaVerify`, `GoogleCallback`). Resolves immediately on failed auth, waits for slow auth (> 2.5s) without extra hold, and remains strictly immune from search/filter/pagination delays. Zero delay on logout revocation. |
| **Phase 15: Notification Routing and Deep-Link Integrity Across All RBAC Roles** | Verified | 21/21 Tests Passing + Vite Build Clean | Fixed notification "View details" navigation across Admin, Instructor, and Student. Admin applicant notifications deep-link directly to `/admin/users?applicantId=...` and auto-open details modal without first-record fallbacks. Extracted email disambiguation for legacy notifications. Normalized Student submission feedback links (`/student/submissions?submissionId=...`) preventing 404s. Enforced strict RBAC route boundaries and event propagation isolation. |

---

## 2. Implemented Architecture & Behavioral Contracts

### Problem A — Dashboard Banner & Page Positioning Resolution
1. **Student Workspace (`frontend/src/pages/student/Dashboard.jsx`):**
   - The personalized hero banner (`StudentHeroIllustration`), academic-year badge, and date-range filter toolbar render **only** when `currentView === 'dashboard'` (`/student/dashboard`).
   - Dedicated views (`/student/catalog`, `/student/submissions`) render their respective `<Card title="Assessment Catalog">` or `<Card title="Your Assessment Submissions & Results">` directly at the top.
   - Initial loading state displays `<CardSkeleton count={6} />` for catalog and `<TableSkeleton rows={5} columns={6} />` for submissions instead of flashing the overview dashboard skeleton.

2. **Admin Master Console (`frontend/src/pages/admin/Dashboard.jsx`):**
   - The institutional header banner card (`AdminHeroIllustration`, greeting, manual data refresh button, tab bar) and 4 Overview StatCards (`Active Students`, `Pending Approvals`, `Faculty Instructors`, `Platform Pass Rate`) render **only** when `activeTab === 'overview'` (`/admin/dashboard`).
   - Dedicated admin pages (`/admin/users`, `/admin/assessments`, `/admin/logs`, `/admin/settings`) start cleanly at the top with their dedicated Cards and controls without inheriting the overview banner or stat cards.
   - Initial loading state displays tab-specific skeletons (`UsersTableSkeleton`, `AssessmentsTableSkeleton`, `LogsTableSkeleton`, `SettingsFormSkeleton`) on route load instead of flashing `DashboardSkeleton`.

3. **Global Layout Scroll Reset Contract (`frontend/src/layouts/MainLayout.jsx`):**
   - Deterministic scroll restoration on route `pathname` change resets both `mainRef.current` and `window` to `(0, 0)` with `behavior: 'instant'`.
   - In-page interactions (keystrokes in search inputs, dropdown filter selections, tab toggles within the same pathname, and pagination changes) retain the active vertical scroll position.

### Problem B — Loading State Architecture & Stale Data Prevention
1. **Empty-State Suppression During Requests:**
   - Introduced `isUsersLoading`, `isAssessmentsLoading`, and `isLogsLoading` in `AdminDashboard.jsx`.
   - Replaced premature empty state renders with `<TableSkeleton>` matching exact column geometries.
   - `EmptyState` displays only after requests complete successfully with zero matching records.

2. **Race Condition & Out-of-Order Overwrite Protection:**
   - Search inputs are debounced via `useDebounce(..., 300)`.
   - Async request handlers utilize `usersRequestIdRef`, `assessmentsRequestIdRef`, and `logsRequestIdRef`.
   - Slower or out-of-order network responses are rejected when a newer request ID has taken precedence.

3. **Double-Submit & Mutation Protection:**
   - Normalization in `<Button>` component maps both `isLoading` and legacy `loading` props to disabled spinning state, blocking duplicate form submissions.

### Problem C — Dynamic Greetings Specification
- **Implementation (`frontend/src/utils/greeting.js`):**
  - Evaluates local time:
    - 05:00:00 – 11:59:59: "Good morning"
    - 12:00:00 – 16:59:59: "Good afternoon"
    - 17:00:00 – 04:59:59: "Good evening"
  - Handles string trimming, null/undefined names, numbers, timestamps, and invalid dates gracefully.
  - Shared identically across Student, Instructor, and Admin dashboards without hardcoded fallbacks.

### Problem D — Global RBAC Collapsible Sidebar Architecture
- **Desktop Sidebar Toggle (`frontend/src/components/common/Sidebar.jsx`):**
  - `isCollapsible` is evaluated dynamically as `collapsible !== undefined ? collapsible : (!onItemClick && Boolean(role))`.
  - Enables hamburger button and collapse behavior on desktop for Student, Instructor, and Admin.
  - Mobile drawer explicitly sets `onItemClick={onClose}`, ensuring the drawer displays the full-width navigation and never collapses into icon-only mode on mobile viewports.
- **State & Persistence Contract (`frontend/src/utils/storage.js` & `constants.js`):**
  - Admin state persists to `localStorage.getItem('uap_admin_sidebar_collapsed')` (backward compatible with existing test suite).
  - Student state persists to `localStorage.getItem('uap_student_sidebar_collapsed')`.
  - Instructor state persists to `localStorage.getItem('uap_instructor_sidebar_collapsed')`.
  - Switching routes within the same role does not unmount or reset the sidebar collapse state.
- **Visual Presentation & Accessibility:**
  - Expanded: Full `w-64` width, section headers, accordions, badges, and full labels.
  - Collapsed: Narrow `w-20` icon-only layout. Navigation labels and group headings are hidden.
  - Navigation icons remain centered, visible, and clickable.
  - Accessible tooltips render for icon links, avatar badge, and sign-out buttons with `group-hover:opacity-100 group-focus-visible:opacity-100`.
  - Smooth animation with `transition-[width,padding] duration-300 ease-in-out` and `motion-reduce:transition-none`.
  - Main content container automatically expands/contracts without clipping or content overlap.

### Problem E — Authentication & Session Lifecycle Guarantees
- **Session Model & Cryptography (`backend/src/models/Session.js` & `utils/sessionCrypto.js`):**
  - Authenticated session documents with SHA-256 hashed refresh tokens, AES-256-GCM recovery token encryption, and unique index on `familyId`.
- **Atomic Rotation & Lost Response Recovery (`backend/src/services/auth.service.js`):**
  - CAS concurrency guarantees atomic single-use refresh token exchange.
  - 30-second multi-rotation recovery ring buffer (`recentRotations`) gracefully handles lost responses without false-positive session revocation.
  - Replay attempts beyond the grace window trigger immediate session family revocation.
- **Single & Global Device Logout:**
  - `authService.logout`: Revokes the specific calling session family.
  - `authService.logoutAll`: Revokes all active user sessions and increments `tokenVersion`.
  - Frontend `AuthContext.jsx` exposes both `logout` and `logoutAll`, ensuring client state (`token`, `user`) and storage are cleanly reset.
- **Mandatory Student MFA Policy:**
  - At the service layer (`authService.disableMfa`), student requests to disable MFA are blocked with HTTP 403 Forbidden.
  - In `TwoFactorAuthSection.jsx`, the "Disable 2FA" button is completely hidden for students, and an educational institutional compliance banner is rendered instead.

### Problem F — Question Bank Action Alignment & 7-Second Visual Effect Architecture
1. **Question Bank Action-Button Alignment (`frontend/src/pages/instructor/QuestionBankList.jsx`):**
   - **Root Cause:** Action container was configured with `md:flex-col`, which explicitly forced the Details, Edit, and Delete action buttons to stack vertically on desktop screens (`≥ 768px`).
   - **Solution:** Replaced `md:flex-col` with `flex flex-wrap items-center justify-end gap-2 flex-shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800 w-full md:w-auto`.
   - **Content Protection:** Left question content container constrained with `min-w-0 pr-0 md:pr-4 break-words` to eliminate any possible overlap with the action group.
   - **Buttons:** Converted icon-only buttons into consistent buttons with descriptive text labels (`Details`, `Edit`, `Delete`) and unified heights, icon sizes, and padding across all viewport breakpoints.
   - **Responsive Behavior:** Horizontal alignment on desktop; responsive wrap below card content on mobile and tablet without clipping or horizontal overflow.

2. **Dedicated Skeletons (`QuestionCardSkeleton.jsx` & `ChartSkeleton.jsx`):**
   - **QuestionCardSkeleton:** Matches authentic wide single-column card geometry (difficulty and type badges, prompt lines, 4-option preview grid, metadata tags, and horizontal action button area). Eliminates layout shift caused by the previous 3-column grid skeleton.
   - **ChartSkeleton:** Provides authentic silhouettes (`bar`, `area`, `donut`) to replace circular spinners with genuine data visualization placeholders.

3. **Branded Preloader & 2.5-Second Visual Effect Architecture:**
   - **Component (`frontend/src/components/ui/PageLoader.jsx`):** Radiant orbital glowing halos, UAP emblem, dynamic 4-phase status messages ("Establishing secure cryptographic session...", "Verifying institutional role permissions...", "Synchronizing academic workspace...", "Preparing {role}..."), and animated progress indicator with `motion-reduce:transition-none` and `role="status"`, `aria-live="polite"`. Added `completedRef` to guarantee single-invocation callback execution.
   - **Duration Contract (`BRANDED_TRANSITION_MIN_DURATION_MS = 2500`):** Configurable in `constants.js` with test override support (`window.__UAP_TRANSITION_MIN_DURATION_MS`).
   - **Scoped Enforcement:**
     1. **Transition 1 (Initial Application Entry):** In `ProtectedRoute.jsx`, displays branded preloader for ~2.5 seconds on initial entry/session hydration.
        - **Fast auth:** presentation holds for the minimum 2.5s duration before rendering protected content.
        - **Slow auth (> 2.5s):** keeps loader visible until auth genuinely resolves, then completes immediately without extra delay.
        - **Failed auth:** stops loader immediately and redirects to `/auth/login` without holding the 2.5s timer.
        - **In-app client route changes:** zero delay.
     2. **Transition 2 (Post-Login Transition):** In `Login.jsx`, `MfaVerify.jsx`, and `GoogleCallback.jsx`, authentication and token persistence occur immediately. On success, the branded ~2.5-second hold displays before navigating with `{ replace: true }`. On failure, the error is displayed immediately and no branded hold is activated.
   - **Immunity Contract:** Standard interactions (in-page search, debounce, dropdown filters, pagination, table sorts, and background refreshes) are strictly immune and execute instantaneously.
   - **Security Guarantee:** Logout immediately revokes server sessions and purges tokens; no delay is imposed on security revocation.

---

## 3. Verified Test Matrix & Evidence

### 1. Full Backend Test Suite (Node Test Runner)
- **Command:** `npm test` (in `backend/`)
- **Exit Code:** `0`
- **Results:** **599 passed, 0 failed (119 suites, duration 3.6m)**

### 2. Complete Playwright E2E Suite Run
- **Instructor E2E (`tests/e2e/instructor/instructor.spec.js`):** **5/5 passed (1.6m)**
- **Auth & Password E2E (`tests/e2e/auth/auth.spec.js`):** **8/8 passed (41.9s)** (accelerated with 2.5s branded transition)
- **Student & Autosave E2E (`tests/e2e/student/student.spec.js`):** **5/5 passed (2.0m)**
- **Global Sidebar Collapse E2E (`tests/e2e/global-sidebar-collapse.spec.js`):** **8/8 passed (55.6s)**
- **Admin Collapsible Sidebar & Scroll Reset (`tests/e2e/admin/`):** **14/14 passed (3.5m)**

### 3. Architecture & Contract Unit Tests (`tests/loading_architecture_verification.test.js`)
- **Command:** `node tests/loading_architecture_verification.test.js`
- **Exit Code:** `0`
- **Results:** **43 passed, 0 failed (duration 432ms)**
  - Includes Section 10: Question Bank action alignment, `QuestionCardSkeleton`, 2.5-second minimum entry guarantee, fast failed auth exit, post-login transition hold, in-page filter immunity, and `ChartSkeleton` silhouette.

### 4. Dynamic Greeting Boundary Tests (`tests/greeting_boundaries.test.js`)
- **Command:** `node tests/greeting_boundaries.test.js`
- **Exit Code:** `0`
- **Results:** **20 passed, 0 failed**

### 5. Notification Routing & Deep-Link Verification (`tests/notification_routing_verification.test.js`)
- **Command:** `node --test tests/notification_routing_verification.test.js`
- **Exit Code:** `0`
- **Results:** **21 passed, 0 failed (duration 145ms)**
  - Verifies Admin applicant notification with ID, two distinct applicants without first-record fallback, email extraction from message, safe missing/unresolvable fallback, Instructor evaluate and authoring links, Student feedback links and legacy route normalization without 404, strict RBAC route boundary protection, and event propagation isolation.

### 6. Frontend Production Build Verification (`frontend/`)
- **Command:** `npm run build`
- **Exit Code:** `0`
- **Results:** Vite production build completed in 15.25s with 2494 modules transformed and 0 errors.

---

## 4. Key Files Modified / Added
1. `frontend/src/utils/constants.js` — Defined `BRANDED_TRANSITION_MIN_DURATION_MS = 2500` (~2.5s).
2. `frontend/src/routes/ProtectedRoute.jsx` — Enforced ~2.5-second minimum branded preloader on initial application entry, with immediate exit on unauthenticated failed resolution.
3. `frontend/src/pages/auth/Login.jsx` — Post-login branded hold (~2.5s) after immediate backend token issuance; immediate error presentation on failure.
4. `frontend/src/pages/auth/MfaVerify.jsx` — Post-MFA branded hold (~2.5s) after immediate backend token issuance.
5. `frontend/src/pages/auth/GoogleCallback.jsx` — Post-OAuth branded hold (~2.5s) after immediate backend token issuance.
6. `frontend/src/components/ui/PageLoader.jsx` — Branded visual preloader with orbital animation, dynamic message progression, progress bar, `completedRef` guard, and accessibility support.
7. `frontend/src/pages/instructor/QuestionBankList.jsx` — Fixed desktop vertical stacking to horizontal aligned group with responsive wrap; constrained content to avoid overlap.
8. `frontend/src/components/ui/QuestionCardSkeleton.jsx` — Dedicated wide question card skeleton with metadata pills, prompt lines, 4-option preview, and action area.
9. `frontend/src/components/ui/ChartSkeleton.jsx` — Authentic chart silhouettes (bar, area, donut) replacing spinners.
10. `frontend/src/components/ui/CardSkeleton.jsx` — Added `variant="question"` support routing to `QuestionCardSkeleton`.
11. `tests/loading_architecture_verification.test.js` — Added Section 10 test suite (43 total tests passing).
12. `frontend/src/utils/notificationRouter.js` — Centralized RBAC notification route resolver mapping notifications across Admin, Instructor, and Student with entity ID resolution and malicious scheme protection.
13. `frontend/src/components/common/NotificationPopover.jsx` — Updated notification card click and "View details" action button to resolve via `resolveNotificationRoute`, isolate event propagation, and close popover.
14. `frontend/src/pages/admin/Dashboard.jsx` — Added deep-link URL search listener auto-opening applicant details modal for `applicantId` / `userId` or `applicantEmail` without first-record fallbacks.
15. `frontend/src/pages/student/Dashboard.jsx` — Added deep-link URL search and route parameter listener auto-opening evaluation feedback modal for `submissionId` without 404s.
16. `frontend/src/routes/AppRoutes.jsx` — Added legacy routes (`submissions/:id`, `results/:id`) mapping to `StudentDashboard` to handle historical notification links.
17. `backend/src/services/auth.service.js` — Fixed applicant notification generation to link to `/admin/users?applicantId=${user._id}` across student, instructor, and Google registrations.
18. `backend/src/services/evaluation.service.js` — Fixed evaluation notification generation to link to `/student/submissions?submissionId=${submission._id}`.
19. `backend/src/config/seed.js` — Updated demo seed notifications to use `/student/submissions?submissionId=${submission._id}`.
20. `tests/notification_routing_verification.test.js` — Automated 21-test test suite verifying all notification routing scenarios across all RBAC roles.


