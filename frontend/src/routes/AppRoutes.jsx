// Import routing primitives from react-router-dom for route definition and navigation
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

// Layouts section
// Import the public/main layout wrapper component
import MainLayout from '../layouts/MainLayout';
// Import the public landing page layout wrapper component
import PublicLayout from '../layouts/PublicLayout';
// Import the authentication pages layout wrapper component
import AuthLayout from '../layouts/AuthLayout';
// Import the student workspace layout wrapper component
import StudentLayout from '../layouts/StudentLayout';
// Import the instructor workspace layout wrapper component
import InstructorLayout from '../layouts/InstructorLayout';
// Import the administrator workspace layout wrapper component
import AdminLayout from '../layouts/AdminLayout';

// Route Guards section
// Import the route wrapper that enforces user authentication
import ProtectedRoute from './ProtectedRoute';
// Import the route wrapper that restricts access based on user role
import RoleRoute from './RoleRoute';

// Pages section
// Import the public landing page component
import LandingPage from '../pages/LandingPage';
// Import the user authentication login page component
import Login from '../pages/auth/Login';
// Import the user registration signup page component
import Signup from '../pages/auth/Signup';
// Import the forgotten password recovery request page component
import ForgotPassword from '../pages/auth/ForgotPassword';
// Import the password reset token confirmation page component
import ResetPassword from '../pages/auth/ResetPassword';
// Import the Google OAuth redirect callback handler component
import GoogleCallback from '../pages/auth/GoogleCallback';
// Import the two-factor authentication TOTP verification page component
import MfaVerify from '../pages/auth/MfaVerify';
// Import the two-factor authentication authenticator app enrollment page component
import MfaSetup from '../pages/auth/MfaSetup';
// Import the student main dashboard page component
import StudentDashboard from '../pages/student/Dashboard';
// Import the student interactive assessment taking component
import StudentAttempt from '../pages/student/Attempt';
// Import the student account profile and credentials settings page component
import StudentProfile from '../pages/student/Profile';
// Import the student certifications and earned credential awards page component
import StudentCertifications from '../pages/student/Certifications';
// Import the instructor main dashboard page component
import InstructorDashboard from '../pages/instructor/Dashboard';
// Import the instructor account profile page component
import InstructorProfile from '../pages/instructor/Profile';
// Import the instructor assessment list overview component
import AssessmentsList from '../pages/instructor/AssessmentsList';
// Import the assessment creation and editing builder component
import AssessmentBuilder from '../pages/instructor/AssessmentBuilder';
// Import the instructor enrolled students roster component
import StudentsList from '../pages/instructor/StudentsList';
// Import the student submissions grading queue component
import SubmissionsQueue from '../pages/instructor/SubmissionsQueue';
// Import the rubric and submission evaluation studio component
import EvaluationStudio from '../pages/instructor/EvaluationStudio';
// Import the assessment analytics and performance breakdown component
import AssessmentAnalytics from '../pages/instructor/AssessmentAnalytics';
// Import the question bank listing and management component
import QuestionBankList from '../pages/instructor/QuestionBankList';
// Import the question bank creation and editing component
import QuestionBankCreate from '../pages/instructor/QuestionBankCreate';
// Import the bulk question file upload component
import QuestionImportUpload from '../pages/instructor/QuestionImportUpload';
// Import the question import review and mapping component
import QuestionImportReview from '../pages/instructor/QuestionImportReview';
// Import the administrative system dashboard component
import AdminDashboard from '../pages/admin/Dashboard';
// Import the administrator student account management component
import StudentsManagement from '../pages/admin/StudentsManagement';
// Import the administrator faculty account management component
import FacultyManagement from '../pages/admin/FacultyManagement';
// Import the student authoritative master registry component
import StudentRegistryPage from '../pages/admin/StudentRegistry';
// Import the faculty authoritative master registry component
import FacultyRegistryPage from '../pages/admin/FacultyRegistry';
// Import the administrator account profile page component
import AdminProfile from '../pages/admin/Profile';
// Import the generic 404 page not found fallback component
import NotFound from '../pages/NotFound';

// SearchPreservingNavigate forwards URL query strings (e.g. ?token=...) to the destination route
const SearchPreservingNavigate = ({ to }) => {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}`} replace />;
};

// Define the root application router component managing all route hierarchies
const AppRoutes = () => {
  // Return the declarative router layout configuration
  return (
    // Top-level container matching browser URL against defined route paths
    <Routes>
      {/* Route redirect alias forwarding /login directly to canonical /auth/login */}
      <Route path="/login" element={<SearchPreservingNavigate to="/auth/login" />} />
      {/* Route redirect alias forwarding /signup directly to canonical /auth/signup */}
      <Route path="/signup" element={<SearchPreservingNavigate to="/auth/signup" />} />
      {/* Route redirect alias forwarding /forgot-password directly to canonical /auth/forgot-password */}
      <Route path="/forgot-password" element={<SearchPreservingNavigate to="/auth/forgot-password" />} />
      {/* Route redirect alias forwarding /reset-password directly to canonical /auth/reset-password */}
      <Route path="/reset-password" element={<SearchPreservingNavigate to="/auth/reset-password" />} />
      {/* Route redirect alias forwarding /mfa-verify directly to canonical /auth/mfa-verify */}
      <Route path="/mfa-verify" element={<SearchPreservingNavigate to="/auth/mfa-verify" />} />
      {/* Route redirect alias forwarding /mfa-setup directly to canonical /auth/mfa-setup */}
      <Route path="/mfa-setup" element={<SearchPreservingNavigate to="/auth/mfa-setup" />} />

      {/* Route container wrapping public landing page with PublicLayout */}
      <Route path="/" element={<PublicLayout />}>
        {/* Default index route rendering the LandingPage component */}
        <Route index element={<LandingPage />} />
      {/* Conclude public landing page route container */}
      </Route>

      {/* Parent route grouping all authentication views within AuthLayout */}
      <Route path="/auth" element={<AuthLayout />}>
        {/* Child route for user login screen */}
        <Route path="login" element={<Login />} />
        {/* Child route for user registration and role selection screen */}
        <Route path="signup" element={<Signup />} />
        {/* Child route for requesting password recovery email */}
        <Route path="forgot-password" element={<ForgotPassword />} />
        {/* Child route for setting new password via recovery token */}
        <Route path="reset-password" element={<ResetPassword />} />
        {/* Child route for receiving Google OAuth callback parameters */}
        <Route path="google/callback" element={<GoogleCallback />} />
        {/* Child route for two-factor authentication challenge */}
        <Route path="mfa-verify" element={<MfaVerify />} />
        {/* Child route for authenticator app enrollment */}
        <Route path="mfa-setup" element={<MfaSetup />} />
        {/* Index route redirecting default /auth path to /auth/login */}
        <Route index element={<Navigate to="/auth/login" replace />} />
      {/* Conclude authentication route container */}
      </Route>

      {/* Protected route branch requiring user authentication */}
      <Route element={<ProtectedRoute />}>
        {/* Route guard restricting access strictly to users with the 'student' role */}
        <Route element={<RoleRoute allowedRoles={['student']} />}>
          {/* Layout route container wrapping all student views in StudentLayout */}
          <Route path="/student" element={<StudentLayout />}>
            {/* Student workspace main dashboard overview */}
            <Route path="dashboard" element={<StudentDashboard />} />
            {/* Assessment catalog browsing route */}
            <Route path="catalog" element={<StudentDashboard />} />
            {/* Route alias redirecting /student/assessments to /student/catalog */}
            <Route path="assessments" element={<Navigate to="/student/catalog" replace />} />
            {/* Dynamic route for active assessment examination session */}
            <Route path="attempt/:id" element={<StudentAttempt />} />
            {/* Student certifications and earned credential awards */}
            <Route path="certifications" element={<StudentCertifications />} />
            {/* Route alias forwarding /student/my-certifications to /student/certifications */}
            <Route path="my-certifications" element={<Navigate to="/student/certifications" replace />} />
            {/* Student submission history and score review */}
            <Route path="submissions" element={<StudentDashboard />} />
            {/* Direct deep-link to submission evaluation feedback */}
            <Route path="submissions/:id" element={<StudentDashboard />} />
            {/* Legacy alias forwarding /student/results/:id to submissions feedback */}
            <Route path="results/:id" element={<StudentDashboard />} />
            {/* Student personal profile, credentials, and MFA settings */}
            <Route path="profile" element={<StudentProfile />} />
            {/* Default student index redirecting root /student path to /student/dashboard */}
            <Route index element={<Navigate to="/student/dashboard" replace />} />
          {/* Conclude student layout route container */}
          </Route>
        {/* Conclude student role guard route */}
        </Route>
      {/* Conclude protected route branch for students */}
      </Route>

      {/* Protected route branch requiring user authentication */}
      <Route element={<ProtectedRoute />}>
        {/* Route guard restricting access to users with 'instructor' or 'admin' roles */}
        <Route element={<RoleRoute allowedRoles={['instructor', 'admin']} />}>
          {/* Layout route container wrapping instructor views in InstructorLayout */}
          <Route path="/instructor" element={<InstructorLayout />}>
            {/* Instructor workspace main dashboard */}
            <Route path="dashboard" element={<InstructorDashboard />} />
            {/* Instructor assessments management list */}
            <Route path="assessments" element={<AssessmentsList />} />
            {/* Assessment creation builder screen */}
            <Route path="create" element={<AssessmentBuilder />} />
            {/* Assessment editing builder screen by ID */}
            <Route path="edit/:id" element={<AssessmentBuilder />} />
            {/* Student exam submissions queue for grading */}
            <Route path="submissions" element={<SubmissionsQueue />} />
            {/* Detailed submission grading and evaluation studio by attempt ID */}
            <Route path="evaluate/:id" element={<EvaluationStudio />} />
            {/* Assessment metrics and cohort analytics breakdown by assessment ID */}
            <Route path="analytics/:id" element={<AssessmentAnalytics />} />
            {/* Question repository management list */}
            <Route path="question-bank" element={<QuestionBankList />} />
            {/* Question bank creation screen */}
            <Route path="question-bank/create" element={<QuestionBankCreate />} />
            {/* Question bank editing screen by question bank ID */}
            <Route path="question-bank/edit/:id" element={<QuestionBankCreate />} />
            {/* Question spreadsheet bulk upload screen */}
            <Route path="question-import" element={<QuestionImportUpload />} />
            {/* Question bulk import preview and verification screen by import job ID */}
            <Route path="question-import/review/:id" element={<QuestionImportReview />} />
            {/* Enrolled students roster and performance records */}
            <Route path="students" element={<StudentsList />} />
            {/* Faculty profile and credentials management */}
            <Route path="profile" element={<InstructorProfile />} />
            {/* Default instructor index redirecting root /instructor to /instructor/dashboard */}
            <Route index element={<Navigate to="/instructor/dashboard" replace />} />
          {/* Conclude instructor layout route container */}
          </Route>
        {/* Conclude instructor/admin role guard route */}
        </Route>
      {/* Conclude protected route branch for instructors */}
      </Route>

      {/* Protected route branch requiring user authentication */}
      <Route element={<ProtectedRoute />}>
        {/* Route guard restricting access strictly to users with the 'admin' role */}
        <Route element={<RoleRoute allowedRoles={['admin']} />}>
          {/* Layout route container wrapping administrator views in AdminLayout */}
          <Route path="/admin" element={<AdminLayout />}>
            {/* Administrator main system overview and telemetry dashboard */}
            <Route path="dashboard" element={<AdminDashboard />} />
            {/* Administrative student accounts and identity management */}
            <Route path="students" element={<StudentsManagement />} />
            {/* Administrative faculty accounts and role assignment */}
            <Route path="faculty" element={<FacultyManagement />} />
            {/* Authoritative student master registry configuration */}
            <Route path="student-registry" element={<StudentRegistryPage />} />
            {/* Authoritative faculty master registry configuration */}
            <Route path="faculty-registry" element={<FacultyRegistryPage />} />
            {/* Pending user approval queue overview */}
            <Route path="users" element={<AdminDashboard />} />
            {/* System-wide assessment oversight overview */}
            <Route path="assessments" element={<AdminDashboard />} />
            {/* Immutable security audit logs and event history */}
            <Route path="logs" element={<AdminDashboard />} />
            {/* Global platform configuration, operational preferences, and MFA security settings */}
            <Route path="settings" element={<AdminDashboard />} />
            {/* Administrator personal and institutional identity, credentials, and profile details */}
            <Route path="profile" element={<AdminProfile />} />
            {/* Default admin index redirecting root /admin to /admin/dashboard */}
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
          {/* Conclude admin layout route container */}
          </Route>
        {/* Conclude admin role guard route */}
        </Route>
      {/* Conclude protected route branch for admins */}
      </Route>

      {/* Catch-all fallback route matching any unrecognized URL to render NotFound 404 */}
      <Route path="*" element={<NotFound />} />
    {/* Conclude top-level Routes container */}
    </Routes>
  );
// Conclude the AppRoutes component definition
};

// Export AppRoutes as the default export of this module
export default AppRoutes;
