import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import { useAuth } from '../../hooks/useAuth';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Badge from '../../components/ui/Badge';
import AuthIllustration from '../../components/common/AuthIllustration';
import { User, Mail, Lock, Building, ArrowRight, ShieldCheck } from 'lucide-react';

const signupSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, 'Name must be at least 2 characters')
    .required('Full name is required'),
  email: Yup.string()
    .email('Please provide a valid institutional email address')
    .required('Email address is required'),
  password: Yup.string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
  role: Yup.string()
    .oneOf(['student', 'instructor'], 'Role must be Student or Instructor')
    .required('Account type is required'),
  instituteCode: Yup.string().trim().optional(),
});

const Signup = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [authError, setAuthError] = useState(null);
  const [registrationSubmitted, setRegistrationSubmitted] = useState(null);

  const roleOptions = [
    { value: 'student', label: '🎓 Student / Learner' },
    { value: 'instructor', label: '👨‍🏫 Instructor / Faculty' },
    { value: 'admin', label: '🛡️ Administration (Invite Only)', disabled: true },
  ];

  const handleSignupSubmit = async (values, { setSubmitting }) => {
    setAuthError(null);
    try {
      const response = await register({
        name: values.name,
        email: values.email,
        password: values.password,
        role: values.role,
        instituteCode: values.instituteCode,
      });

      toast.info('Registration received. Your account is pending administrator approval.');
      setRegistrationSubmitted({
        name: values.name,
        email: values.email,
        role: values.role,
        instituteCode: values.instituteCode,
        status: response.status || 'pending',
      });
    } catch (err) {
      setAuthError(err.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto rounded-3xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark shadow-warm-lg overflow-hidden grid grid-cols-1 lg:grid-cols-12">
      {/* Left Column: Brand & Editorial Illustration */}
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

          <Badge variant="terracotta" dot className="mb-3">New Registration</Badge>

          <h2 className="text-2xl font-bold font-display text-slate-900 dark:text-slate-100 leading-snug mb-2">
            Join the Next Generation Evaluation Suite
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
            Establish your institutional identity to access curated coursework, take timed exams, 
            or manage academic assessments with verified integrity.
          </p>

          <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-800/60 border border-surface-light-border dark:border-surface-dark-border text-xs space-y-2 shadow-warm-xs">
            <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-200">
              <ShieldCheck className="w-4 h-4 text-brand-primary flex-shrink-0" />
              <span className="font-semibold">Strict Role-Based Authorization</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-6">
              Administrative registration requires verification of institutional credentials.
            </p>
          </div>
        </div>

        <div className="my-2">
          <AuthIllustration role="student" />
        </div>

        <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
          © {new Date().getFullYear()} Unified Assessment Platform
        </p>
      </div>
      {/* Right Column: Registration Form or Pending Confirmation */}
      <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center bg-white dark:bg-surface-dark">
        <div className="max-w-md w-full mx-auto">
          {registrationSubmitted ? (
            <div className="text-center py-4 space-y-5 animate-in fade-in duration-300">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl mx-auto flex items-center justify-center shadow-inner">
                <ShieldCheck className="w-8 h-8" />
              </div>

              <div>
                <Badge variant="warning" dot className="mb-2">Pending Administrator Review</Badge>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Application Submitted
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                  Thank you, <span className="font-semibold text-slate-700 dark:text-slate-200">{registrationSubmitted.name}</span>. Your institutional registration is currently pending administrative verification.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border text-left text-xs space-y-2.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Institutional Email:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{registrationSubmitted.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Requested Role:</span>
                  <span className="font-medium capitalize text-slate-800 dark:text-slate-200">{registrationSubmitted.role}</span>
                </div>
                {registrationSubmitted.instituteCode && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Institute Code:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{registrationSubmitted.instituteCode}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-surface-light-border dark:border-surface-dark-border pt-2">
                  <span className="text-slate-500 dark:text-slate-400">Account Status:</span>
                  <Badge variant="warning">Pending Approval</Badge>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                You will be granted access to the workspace once an administrator confirms your credentials.
              </p>

              <Button
                variant="primary"
                fullWidth
                onClick={() => navigate('/auth/login')}
                icon={ArrowRight}
                iconPosition="right"
              >
                Return to Sign In
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Create an Account
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Submit your details for institutional verification and account provisioning.
                </p>
              </div>

              {authError && (
                <Alert type="error" className="mb-5">
                  {authError}
                </Alert>
              )}

              <Formik
                initialValues={{
                  name: '',
                  email: '',
                  password: '',
                  role: 'student',
                  instituteCode: '',
                }}
                validationSchema={signupSchema}
                onSubmit={handleSignupSubmit}
              >
                {({ values, errors, touched, handleChange, handleBlur, isSubmitting }) => (
                  <Form className="space-y-3.5">
                    <Input
                      label="Full Name"
                      id="name"
                      name="name"
                      placeholder="e.g. Eleanor Vance"
                      icon={User}
                      value={values.name}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.name && errors.name}
                      required
                    />

                    <Input
                      label="Institutional Email"
                      id="email"
                      name="email"
                      type="email"
                      placeholder="name@university.edu"
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
                      placeholder="Minimum 6 characters"
                      icon={Lock}
                      value={values.password}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.password && errors.password}
                      required
                    />

                    <Select
                      label="Account Type"
                      id="role"
                      name="role"
                      options={roleOptions}
                      value={values.role}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.role && errors.role}
                      required
                    />

                    <Input
                      label="Institute / Campus Code"
                      id="instituteCode"
                      name="instituteCode"
                      placeholder="e.g. CAMPUS-101 (optional)"
                      icon={Building}
                      value={values.instituteCode}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.instituteCode && errors.instituteCode}
                      helperText="Optional institutional tracking or cohort code"
                    />

                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      fullWidth
                      isLoading={isSubmitting}
                      icon={ArrowRight}
                      iconPosition="right"
                      className="mt-4"
                    >
                      Submit for Approval
                    </Button>
                  </Form>
                )}
              </Formik>

              <div className="mt-6 pt-5 border-t border-surface-light-border dark:border-surface-dark-border text-center text-xs text-slate-500 dark:text-slate-400">
                Already have an active account?{' '}
                <Link
                  to="/auth/login"
                  className="font-semibold text-brand-primary hover:text-brand-primary-hover hover:underline"
                >
                  Sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Signup;
