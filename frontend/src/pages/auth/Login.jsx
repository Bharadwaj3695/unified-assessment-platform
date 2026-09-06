import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import { useAuth } from '../../hooks/useAuth';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Badge from '../../components/ui/Badge';
import AuthIllustration from '../../components/common/AuthIllustration';
import { Mail, Lock, CheckCircle, ArrowRight, Users, GraduationCap, BarChart3 } from 'lucide-react';

const loginSchema = Yup.object().shape({
  email: Yup.string()
    .email('Please provide a valid institutional email address')
    .required('Email address is required'),
  password: Yup.string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
});

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [authError, setAuthError] = useState(null);

  const from = location.state?.from?.pathname;

  const handleLoginSubmit = async (values, { setSubmitting }) => {
    setAuthError(null);
    try {
      const loggedInUser = await login({
        email: values.email,
        password: values.password,
      });

      toast.success(`Welcome back, ${loggedInUser.name}!`);

      // Determine redirect target based on user role
      if (from && from.startsWith(`/${loggedInUser.role}`)) {
        navigate(from, { replace: true });
      } else if (loggedInUser.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else if (loggedInUser.role === 'instructor') {
        navigate('/instructor/dashboard', { replace: true });
      } else {
        navigate('/student/dashboard', { replace: true });
      }
    } catch (err) {
      setAuthError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="rounded-3xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark shadow-warm-lg overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Left Column: Editorial Brand & Illustration */}
        <div className="hidden lg:flex lg:col-span-5 flex-col justify-between bg-gradient-to-br from-[#FFF4EB] via-[#FFF9F2] to-[#EEF6F4] dark:from-[#241712] dark:via-surface-dark dark:to-[#132822] p-8 border-r border-surface-light-border dark:border-surface-dark-border">
        <div>
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-terracotta to-brand-peach flex items-center justify-center text-white font-extrabold text-lg shadow-warm-xs">
              U
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-slate-100 block leading-tight">
                Unified Assessment
              </span>
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                EdTech Academic Suite
              </span>
            </div>
          </div>

          <Badge variant="terracotta" dot className="mb-3">
            Academic & Institutional Suite
          </Badge>

          <h2 className="text-2xl font-bold font-display text-slate-900 dark:text-slate-100 leading-snug mb-2">
            Rigorous evaluations. Transparent outcomes.
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
            A human-centered platform for automated multiple-choice scoring, long-form essay evaluations, and institutional oversight.
          </p>

          <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-brand-primary flex-shrink-0" />
              <span>Real-time objective question auto-evaluation</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-brand-sage flex-shrink-0" />
              <span>Instructor grading rubrics for subjective analysis</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-brand-peach flex-shrink-0" />
              <span>Role-governed student, faculty & admin workspaces</span>
            </div>
          </div>
        </div>

        <div className="my-2">
          <AuthIllustration role="student" />
        </div>

        <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
          © {new Date().getFullYear()} Unified Assessment Platform · All rights reserved
        </p>
        </div>

        {/* Right Column: Interactive Login Form */}
        <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center bg-white dark:bg-surface-dark">
        <div className="max-w-md w-full mx-auto">
          <div className="mb-6">
            <Badge variant="peach" size="sm" className="mb-2">Welcome Back</Badge>
            <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-slate-900 dark:text-slate-100">
              Sign In to Your Portal
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              Enter your institutional credentials to access your assessment workspace.
            </p>
          </div>

          {authError && (
            <Alert type="error" className="mb-5">
              {authError}
            </Alert>
          )}

          <Formik
            initialValues={{ email: '', password: '', rememberMe: false }}
            validationSchema={loginSchema}
            onSubmit={handleLoginSubmit}
          >
            {({ values, errors, touched, handleChange, handleBlur, isSubmitting }) => (
              <>
                <Form className="space-y-4">
                <Input
                  label="Email Address"
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@uap.edu"
                  icon={Mail}
                  value={values.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={touched.email && errors.email}
                  required
                />

                <Input
                  label="Password"
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  icon={Lock}
                  value={values.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={touched.password && errors.password}
                  required
                />

                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center space-x-2 text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      name="rememberMe"
                      checked={values.rememberMe}
                      onChange={handleChange}
                      className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary/30"
                    />
                    <span>Remember my session</span>
                  </label>

                  <Link
                    to="/auth/forgot-password"
                    className="text-slate-400 hover:text-brand-primary dark:hover:text-slate-200 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  fullWidth
                  isLoading={isSubmitting}
                  icon={ArrowRight}
                  iconPosition="right"
                  className="mt-3"
                >
                  Sign In to Workspace
                </Button>
                </Form>

              </>
            )}
          </Formik>

          <div className="mt-8 pt-6 border-t border-surface-light-border dark:border-surface-dark-border text-center text-xs text-slate-500 dark:text-slate-400">
            Don't have an account?{' '}
            <Link
              to="/auth/signup"
              className="font-semibold text-brand-primary hover:text-brand-primary-hover hover:underline"
            >
              Create an account
            </Link>
          </div>
        </div>
        </div>
      </div>

      <div className="mt-6 border-t border-surface-light-border dark:border-surface-dark-border pt-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-surface-light-border dark:divide-surface-dark-border">
          <div className="flex items-center gap-3 px-4 py-2 text-center sm:text-left">
            <Users className="w-5 h-5 shrink-0 text-brand-peach mx-auto sm:mx-0" />
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">For Students</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Take assessments, track progress</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 text-center sm:text-left">
            <GraduationCap className="w-5 h-5 shrink-0 text-brand-peach mx-auto sm:mx-0" />
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">For Instructors</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Create, evaluate, provide feedback</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 text-center sm:text-left">
            <BarChart3 className="w-5 h-5 shrink-0 text-brand-peach mx-auto sm:mx-0" />
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">For Administrators</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Manage users, assessments, and insights</p>
            </div>
          </div>
        </div>
        <p className="mt-4 border-t border-surface-light-border dark:border-surface-dark-border pt-3 text-center text-[10px] text-slate-400 dark:text-slate-500">
          © {new Date().getFullYear()} Unified Assessment Platform. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Login;
