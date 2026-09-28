import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth.service';
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
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const from = location.state?.from?.pathname;

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setIsGoogleLoading(true);
    try {
      const response = await authService.getGoogleAuthUrl();
      const authUrl = response?.url || response?.data?.url;
      const state = response?.state || response?.data?.state;
      if (authUrl) {
        if (state) {
          sessionStorage.setItem('google_oauth_state', state);
        }
        window.location.href = authUrl;
      } else {
        throw new Error('Could not initialize Google authentication URL');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to start Google sign-in';
      setAuthError(msg);
      setIsGoogleLoading(false);
    }
  };

  const handleLoginSubmit = async (values, { setSubmitting }) => {
    setAuthError(null);
    try {
      const response = await login({
        email: values.email,
        password: values.password,
      });

      if (response && response.mfaRequired) {
        sessionStorage.setItem(
          'uap_mfa_challenge',
          JSON.stringify({
            mfaToken: response.mfaToken,
            email: values.email,
            role: response.user?.role || 'student',
            from: from || null,
          })
        );
        navigate('/auth/mfa-verify', {
          state: {
            mfaToken: response.mfaToken,
            email: values.email,
            from,
          },
        });
        return;
      }

      const loggedInUser = response;
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
        <div className="hidden lg:flex lg:col-span-5 flex-col justify-between bg-gradient-to-br from-[#FFF4EB] via-[#FFF9F2] to-[#EEF6F4] dark:from-[#241712] dark:via-surface-dark dark:to-[#132822] p-5 sm:p-6 lg:p-6 xl:p-7 border-r border-surface-light-border dark:border-surface-dark-border">
          <div>
            <div className="flex items-center space-x-3 mb-4 sm:mb-5">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-gradient-to-br from-brand-terracotta to-brand-peach flex items-center justify-center text-white font-extrabold text-base shadow-warm-xs">
                U
              </div>
              <div>
                <span className="font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-slate-100 block leading-tight">
                  Unified Assessment
                </span>
                <span className="text-[9px] sm:text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  EdTech Academic Suite
                </span>
              </div>
            </div>

            <Badge variant="terracotta" dot className="mb-2">
              Academic & Institutional Suite
            </Badge>

            <h2 className="text-xl lg:text-2xl font-bold font-display text-slate-900 dark:text-slate-100 leading-snug mb-1.5">
              Rigorous evaluations. Transparent outcomes.
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3 sm:mb-4">
              A human-centered platform for automated multiple-choice scoring, long-form essay evaluations, and institutional oversight.
            </p>

            <div className="space-y-1.5 sm:space-y-2 text-xs text-slate-600 dark:text-slate-300">
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

          <div className="my-1">
            <AuthIllustration role="student" />
          </div>

          <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
            © {new Date().getFullYear()} Unified Assessment Platform · All rights reserved
          </p>
        </div>

        {/* Right Column: Interactive Login Form */}
        <div className="lg:col-span-7 p-5 sm:p-6 lg:py-5 lg:px-8 xl:py-6 xl:px-9 flex flex-col justify-center bg-white dark:bg-surface-dark">
          <div className="max-w-md w-full mx-auto">
            <div className="mb-3.5 sm:mb-4">
              <Badge variant="peach" size="sm" className="mb-1">Welcome Back</Badge>
              <h1 className="text-xl sm:text-2xl lg:text-[1.65rem] font-bold font-display tracking-tight text-slate-900 dark:text-slate-100 leading-snug">
                Sign In to Your Portal
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-normal">
                Enter your institutional credentials to access your assessment workspace.
              </p>
            </div>

            {authError && (
              <Alert type="error" className="mb-3 py-2.5 px-3 text-xs">
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
                  <Form className="space-y-3">
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

                    <div className="flex items-center justify-between text-xs pt-0.5">
                      <label className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          name="rememberMe"
                          checked={values.rememberMe}
                          onChange={handleChange}
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-brand-primary focus:ring-brand-primary/30 dark:bg-surface-dark cursor-pointer"
                        />
                        <span className="font-medium">Remember my session</span>
                      </label>

                      <Link
                        to="/auth/forgot-password"
                        className="font-medium text-slate-500 hover:text-brand-primary dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
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
                      className="mt-2.5 h-10 sm:h-[42px]"
                    >
                      Sign In to Workspace
                    </Button>
                  </Form>
                </>
              )}
            </Formik>

            {/* Divider */}
            <div className="relative my-2.5 sm:my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-surface-light-border dark:border-surface-dark-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-surface-dark px-3 text-slate-400 dark:text-slate-500 font-semibold text-[11px] tracking-wider">
                  Or continue with
                </span>
              </div>
            </div>

            {/* Google SSO Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading}
              className="w-full h-10 sm:h-[42px] flex items-center justify-center gap-3 px-4 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-xl bg-white dark:bg-surface-dark hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-xs sm:text-sm transition-colors shadow-xs disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isGoogleLoading ? 'Connecting to Google...' : 'Continue with Google'}</span>
            </button>

            <div className="mt-3.5 sm:mt-4 pt-2.5 sm:pt-3 border-t border-surface-light-border dark:border-surface-dark-border text-center text-xs text-slate-500 dark:text-slate-400">
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

      <div className="mt-2 sm:mt-2.5 border-t border-surface-light-border dark:border-surface-dark-border pt-1.5 sm:pt-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-surface-light-border dark:divide-surface-dark-border">
          <div className="flex items-center gap-2.5 px-3 py-1 text-center sm:text-left">
            <Users className="w-4 h-4 shrink-0 text-brand-peach mx-auto sm:mx-0" />
            <div>
              <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">For Students</p>
              <p className="text-[9.5px] text-slate-400 dark:text-slate-500">Take assessments, track progress</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 px-3 py-1 text-center sm:text-left">
            <GraduationCap className="w-4 h-4 shrink-0 text-brand-peach mx-auto sm:mx-0" />
            <div>
              <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">For Instructors</p>
              <p className="text-[9.5px] text-slate-400 dark:text-slate-500">Create, evaluate, provide feedback</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 px-3 py-1 text-center sm:text-left">
            <BarChart3 className="w-4 h-4 shrink-0 text-brand-peach mx-auto sm:mx-0" />
            <div>
              <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">For Administrators</p>
              <p className="text-[9.5px] text-slate-400 dark:text-slate-500">Manage users, assessments, and insights</p>
            </div>
          </div>
        </div>
        <p className="mt-1 border-t border-surface-light-border/60 dark:border-surface-dark-border/60 pt-1 text-center text-[10px] text-slate-400 dark:text-slate-500">
          © {new Date().getFullYear()} Unified Assessment Platform. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Login;
