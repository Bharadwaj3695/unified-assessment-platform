# UAP Responsive UI & Role-Specific Top-Navigation Search Implementation Guide

**Project:** Unified Assessment Platform (UAP)  
**Document:** `docs/RESPONSIVE_UI_IMPLEMENTATION_GUIDE.md`  
**Scope:** Role-Specific Compact Search, Elimination of Redundant Page-Level Search Fields, RBAC Protection, Responsive Design across Viewports (320px–1920px+), Keyboard Navigation, and Shared Layout Consistency.

---

## 1. Architectural Architecture & Core Principles

The Unified Assessment Platform (UAP) serves three distinct institutional roles:
1. **Student:** Candidates browsing examination catalogs, taking scheduled assessments, reviewing submission feedback, and managing profile security (TOTP MFA).
2. **Instructor / Faculty:** Educators designing assessments, authoring Bloom-taxonomy question banks, reviewing submission attempts, and evaluating student performance.
3. **Administrator:** Institutional authorities managing users, reviewing applicant queues, auditing security logs, overseeing campus-wide examinations, and configuring master registries.

### Primary Design Goal
Implement a compact, role-specific search bar directly in the top navigation header (`Header.jsx`) for each portal while maintaining strict RBAC boundaries and eliminating competing duplicate search fields from page bodies.

---

## 2. Portal-Specific Search Specifications

| Specification | Student Portal | Admin Portal | Instructor Portal |
| :--- | :--- | :--- | :--- |
| **Component** | `StudentSearchBar.jsx` | `AdminSearchBar.jsx` | `InstructorSearchBar.jsx` |
| **Placeholder** | `Search assessments...` | `Search users, assessments...` | `Search students, questions...` |
| **Authorized Scope** | • Available & published assessments<br>• Student's own submissions & results<br>• Student navigation destinations | • User directory & student/faculty registries<br>• Platform assessment oversight<br>• Pending registration approval queue<br>• System security & audit logs<br>• Platform settings & admin navigation | • Instructor-owned assessments<br>• Question bank items & Bloom levels<br>• Enrolled students roster<br>• Submission evaluation queue<br>• Instructor studio navigation |
| **Backend Data Sources** | • `GET /assessments` (scoped by role)<br>• `GET /submissions/student` (scoped by `req.user.id`) | • `GET /admin/users` (name, email, role)<br>• `GET /admin/users/pending`<br>• `GET /admin/assessments`<br>• `GET /admin/student-registry`<br>• `GET /admin/logs` | • `GET /assessments`<br>• `GET /question-bank`<br>• `GET /users/students`<br>• `GET /evaluations/instructor/submissions` |
| **Primary Deep Links** | • `/student/attempt/:id`<br>• `/student/submissions?submissionId=:id`<br>• `/student/catalog` | • `/admin/users?applicantId=:id`<br>• `/admin/assessments`<br>• `/admin/student-registry`<br>• `/admin/logs` | • `/instructor/edit/:id`<br>• `/instructor/question-bank?search=...`<br>• `/instructor/evaluate/:id`<br>• `/instructor/students` |

---

## 3. Top-Navigation Search Bar Design & Geometry

### Desktop Specifications (≥ 1024px)
- **Width:** `w-[200px] sm:w-[210px] md:w-[220px] lg:w-[225px] xl:w-[230px]`
- **Height:** `h-[38px]` (compact vertical footprint aligned with `h-16` header)
- **Border:** `border border-surface-light-border dark:border-surface-dark-border`
- **Corners:** `rounded-xl`
- **Background:** `bg-slate-50/90 dark:bg-surface-dark-muted/70 hover:bg-white dark:hover:bg-surface-dark`
- **Focus State:** `focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary focus:bg-white dark:focus:bg-surface-dark`
- **Typography:** `text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500`
- **Internal Padding:** `pl-8 pr-7 py-1.5`
- **Left Icon:** Lucide `Search` (`w-3.5 h-3.5 text-slate-400`), replaced by spinning `Loader2` during active asynchronous fetch.
- **Clear Action:** Quick-clear 'X' button (`absolute right-2`) visible when input text is present.

### Placement & Header Alignment
- **Position:** Directly preceding the theme toggle (`Sun` / `Moon`) and notification popover (`NotificationPopover`) in `Header.jsx`.
- **Vertical Centering:** Inside `header.h-16 flex items-center justify-between` alongside brand logo, role badge, avatar, and sign-out controls.

### Responsive Breakpoint Strategy
- **Desktop (≥ 1024px):** Compact inline input displayed at full 220–230px width.
- **Tablet (640px – 1023px):** Compact inline input smoothly adjusts to 170–190px width.
- **Mobile (< 640px / 320px – 480px):**
  - Header displays a compact icon toggle button (`w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100`).
  - Clicking toggle opens an animated top overlay search bar with auto-focused input, cancel button, and full-width dropdown below.
  - Prevents horizontal overflow, control collisions, and off-screen clipping on narrow displays down to 320px.

---

## 4. Live Results Dropdown & Keyboard Navigation

### Visual Presentation
- Anchored to right of container: `absolute right-0 top-full mt-2`.
- Width: `w-[340px] md:w-[380px] lg:w-[400px]` with `max-w-[calc(100vw-2rem)]`.
- Container: `rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark shadow-2xl overflow-hidden`.
- Categorized result sections with metadata pills, status badges, and icon indicators.

### Keyboard Interaction Contract
- `ArrowDown`: Navigates to next item in the flattened results list.
- `ArrowUp`: Navigates to previous item in the flattened results list.
- `Enter`: Selects the currently highlighted item (or top result if none highlighted) and executes navigation.
- `Escape`: Closes the dropdown panel and restores focus.
- Outside Click: Closes dropdown and collapses mobile search overlay.

### Feedback States
- **Loading:** Animated spinner with descriptive text: `"Searching {role} workspace..."`
- **Empty:** Clean announcement: `"No matching {items} found for '{query}'"` with suggestion text.
- **Error:** Warning icon with: `"Unable to load search results. Please try again."`

---

## 5. Audit & Removal of Duplicate Page-Level Search Fields

To prevent visual competing search fields, page-level searches were evaluated against global top-nav search capabilities:

| Location | Component / Field | Audit Finding | Action Taken | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| `instructor/SubmissionsQueue.jsx` | `<InstructorSearchBar>` (Header Card) | Redundant | **Removed** | Global workspace search duplicated at top of page body; replaced by top nav. |
| `instructor/SubmissionsQueue.jsx` | `input[placeholder="Search queue..."]` | Essential | **Retained** | Filters active table rows by student/title alongside `All`, `Needs Review`, `Evaluated` tabs. |
| `instructor/AssessmentsList.jsx` | `<InstructorSearchBar>` (Header Card) | Redundant | **Removed** | Replaced by top nav search. |
| `instructor/AssessmentsList.jsx` | `input[placeholder="Filter list..."]` | Essential | **Retained** | Local table search verified by Playwright tests; drives table state and status tabs. |
| `instructor/StudentsList.jsx` | `<InstructorSearchBar>` (Header Card) | Redundant | **Removed** | Replaced by top nav search. |
| `instructor/StudentsList.jsx` | `input[placeholder="Search students..."]` | Essential | **Retained** | Local cohort filter in table toolbar. |
| `instructor/Dashboard.jsx` | `<InstructorSearchBar>` (Header Card) | Redundant | **Removed** | Replaced by top nav search; restores alignment with student/admin dashboards. |
| `student/Dashboard.jsx` | `input[placeholder="Search catalog..."]` | Essential | **Retained** | In-memory filter for catalog cards alongside category pills. |
| `admin/Dashboard.jsx` | Table search inputs (Users, Pending, Assessments, Registry, Logs) | Essential | **Retained** | Local table searches controlling backend pagination, sorting, and batch actions. |

---

## 6. Layout Consistency Normalization

1. **Header Consistency:**
   - Standardized height (`h-16`) across all RBAC roles.
   - Consistent left branding (`w-8 h-8 sm:w-9 sm:h-9` logo monogram + title) and right controls alignment.
2. **Container Widths & Gaps:**
   - Unified content width constrained by `max-w-7xl mx-auto w-full`.
   - Vertical flow standardized using `space-y-6` (or `space-y-4 sm:space-y-5 lg:space-y-6`).
3. **Card & Metric Geometries:**
   - Normalized card padding (`p-4 sm:p-5 lg:p-6`), borders (`border-surface-light-border dark:border-surface-dark-border`), and radii (`rounded-2xl`).
   - StatCard metric blocks aligned across Student, Instructor, and Admin workspaces.
4. **Sticky Footer Clearance:**
   - Compact `AppFooter` anchored via `mt-auto` with zero horizontal overflow down to 320px.

---

## 7. Security & RBAC Boundary Protection

- **Identity Isolation:** Student search queries `submissionService.getStudentSubmissions()` (bound strictly to `req.user.id` on server) and never accesses peers' records.
- **Sensitive Credential Suppression:** Admin search sanitizes user objects, completely omitting password hashes, salts, MFA secrets, and refresh tokens.
- **Ownership Scoping:** Instructor search queries only questions and assessments created by or assigned to the authenticated faculty member.
- **Concurrency & Debounce:** All search components employ a 300ms debounce timer and monotonic `requestIdRef` guards, guaranteeing slower network responses never overwrite newer search results.
