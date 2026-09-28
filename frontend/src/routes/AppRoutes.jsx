import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import MainLayout from '../layouts/MainLayout';
import AuthLayout from '../layouts/AuthLayout';
import StudentLayout from '../layouts/StudentLayout';
import InstructorLayout from '../layouts/InstructorLayout';
import AdminLayout from '../layouts/AdminLayout';

// Route Guards
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';

// Pages
import LandingPage from '../pages/LandingPage';
import Login from '../pages/auth/Login';
import Signup from '../pages/auth/Signup';
import ForgotPassword from '../pages/auth/ForgotPassword';
import ResetPassword from '../pages/auth/ResetPassword';
import GoogleCallback from '../pages/auth/GoogleCallback';
import MfaVerify from '../pages/auth/MfaVerify';
import StudentDashboard from '../pages/student/Dashboard';
import StudentAttempt from '../pages/student/Attempt';
import StudentProfile from '../pages/student/Profile';
import InstructorDashboard from '../pages/instructor/Dashboard';
import InstructorProfile from '../pages/instructor/Profile';
import AssessmentsList from '../pages/instructor/AssessmentsList';
import AssessmentBuilder from '../pages/instructor/AssessmentBuilder';
import StudentsList from '../pages/instructor/StudentsList';
import SubmissionsQueue from '../pages/instructor/SubmissionsQueue';
import EvaluationStudio from '../pages/instructor/EvaluationStudio';
import AssessmentAnalytics from '../pages/instructor/AssessmentAnalytics';
import QuestionBankList from '../pages/instructor/QuestionBankList';
import QuestionBankCreate from '../pages/instructor/QuestionBankCreate';
import QuestionImportUpload from '../pages/instructor/QuestionImportUpload';
import QuestionImportReview from '../pages/instructor/QuestionImportReview';
import AdminDashboard from '../pages/admin/Dashboard';
import NotFound from '../pages/NotFound';

const AppRoutes = () => {
  return (
    <Routes>
      {/* Direct Auth Aliases */}
      <Route path="/login" element={<Navigate to="/auth/login" replace />} />
      <Route path="/signup" element={<Navigate to="/auth/signup" replace />} />
      <Route path="/forgot-password" element={<Navigate to="/auth/forgot-password" replace />} />
      <Route path="/reset-password" element={<Navigate to="/auth/reset-password" replace />} />
      <Route path="/mfa-verify" element={<Navigate to="/auth/mfa-verify" replace />} />

      {/* Public Landing & Design System Showcase */}
      <Route path="/" element={<MainLayout showSidebar={false} />}>
        <Route index element={<LandingPage />} />
      </Route>

      {/* Auth Routes */}
      <Route path="/auth" element={<AuthLayout />}>
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="google/callback" element={<GoogleCallback />} />
        <Route path="mfa-verify" element={<MfaVerify />} />
        <Route index element={<Navigate to="/auth/login" replace />} />
      </Route>

      {/* Protected Student Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<RoleRoute allowedRoles={['student']} />}>
          <Route path="/student" element={<StudentLayout />}>
            <Route path="dashboard" element={<StudentDashboard />} />
            <Route path="catalog" element={<StudentDashboard />} />
            <Route path="assessments" element={<Navigate to="/student/catalog" replace />} />
            <Route path="attempt/:id" element={<StudentAttempt />} />
            <Route path="submissions" element={<StudentDashboard />} />
            <Route path="profile" element={<StudentProfile />} />
            <Route index element={<Navigate to="/student/dashboard" replace />} />
          </Route>
        </Route>
      </Route>

      {/* Protected Instructor Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<RoleRoute allowedRoles={['instructor', 'admin']} />}>
          <Route path="/instructor" element={<InstructorLayout />}>
            <Route path="dashboard" element={<InstructorDashboard />} />
            <Route path="assessments" element={<AssessmentsList />} />
            <Route path="create" element={<AssessmentBuilder />} />
            <Route path="edit/:id" element={<AssessmentBuilder />} />
            <Route path="submissions" element={<SubmissionsQueue />} />
            <Route path="evaluate/:id" element={<EvaluationStudio />} />
            <Route path="analytics/:id" element={<AssessmentAnalytics />} />
            <Route path="question-bank" element={<QuestionBankList />} />
            <Route path="question-bank/create" element={<QuestionBankCreate />} />
            <Route path="question-bank/edit/:id" element={<QuestionBankCreate />} />
            <Route path="question-import" element={<QuestionImportUpload />} />
            <Route path="question-import/review/:id" element={<QuestionImportReview />} />
            <Route path="students" element={<StudentsList />} />
            <Route path="profile" element={<InstructorProfile />} />
            <Route index element={<Navigate to="/instructor/dashboard" replace />} />
          </Route>
        </Route>
      </Route>

      {/* Protected Admin Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<RoleRoute allowedRoles={['admin']} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="users" element={<AdminDashboard />} />
            <Route path="assessments" element={<AdminDashboard />} />
            <Route path="logs" element={<AdminDashboard />} />
            <Route path="settings" element={<AdminDashboard />} />
            <Route path="profile" element={<Navigate to="/admin/settings" replace />} />
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
          </Route>
        </Route>
      </Route>

      {/* 404 Fallback */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;
