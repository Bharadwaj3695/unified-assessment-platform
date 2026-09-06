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
import StudentDashboard from '../pages/student/Dashboard';
import StudentAttempt from '../pages/student/Attempt';
import InstructorDashboard from '../pages/instructor/Dashboard';
import AssessmentsList from '../pages/instructor/AssessmentsList';
import AssessmentBuilder from '../pages/instructor/AssessmentBuilder';
import StudentsList from '../pages/instructor/StudentsList';
import SubmissionsQueue from '../pages/instructor/SubmissionsQueue';
import EvaluationStudio from '../pages/instructor/EvaluationStudio';
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
        <Route index element={<Navigate to="/auth/login" replace />} />
      </Route>

      {/* Protected Student Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<RoleRoute allowedRoles={['student']} />}>
          <Route path="/student" element={<StudentLayout />}>
            <Route path="dashboard" element={<StudentDashboard />} />
            <Route path="catalog" element={<StudentDashboard />} />
            <Route path="attempt/:id" element={<StudentAttempt />} />
            <Route path="submissions" element={<StudentDashboard />} />
            <Route path="profile" element={<StudentDashboard />} />
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
            <Route path="students" element={<StudentsList />} />
            <Route path="profile" element={<InstructorDashboard />} />
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
