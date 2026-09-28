import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import AuthIllustration from '../../components/common/AuthIllustration';
import { Lock, ArrowLeft, ArrowRight, CheckCircle, ShieldCheck } from 'lucide-react';

const resetPasswordSchema = Yup.object().shape({
  password: Yup.string()
    .min(6, 'Password must be at least 6 characters')
    .required('New password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password'), null], 'Passwords must match')
    .required('Please confirm your new password'),
});

const ResetPassword = () => {
  const navigate = useNavigate();
  const [isResetComplete, setIsResetComplete] = useState(false);

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      setIsResetComplete(true);
      toast.success('Your password has been reset successfully!');
    } catch (err) {
      toast.error('Password reset failed. Please request a new recovery link.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto rounded-3xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark shadow-warm-lg overflow-hidden grid grid-cols-1 lg:grid-cols-12">
      {/* Left Column: Brand & Editorial Illustration */}
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
            Credential Reset
          </Badge>

          <h2 className="text-xl lg:text-2xl font-bold font-display text-slate-900 dark:text-slate-100 leading-snug mb-1.5">
            Establish a New Account Passcode
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3 sm:mb-4">
            Choose a strong, unique password to secure your institutional coursework and examination history.
          </p>

          <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-800/60 border border-surface-light-border dark:border-surface-dark-border text-xs space-y-1 shadow-warm-xs">
            <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-200">
              <ShieldCheck className="w-4 h-4 text-brand-primary flex-shrink-0" />
              <span className="font-semibold">Security Best Practice</span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 pl-6">
              Use at least 6 characters including letters, numbers, and symbols.
            </p>
          </div>
        </div>

        <div className="my-1">
          <AuthIllustration role="student" />
        </div>

        <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
          © {new Date().getFullYear()} Unified Assessment Platform
        </p>
      </div>

      {/* Right Column: Reset Form */}
      <div className="lg:col-span-7 p-5 sm:p-7 lg:py-6 lg:px-8 xl:py-7 xl:px-10 flex flex-col justify-center bg-white dark:bg-surface-dark">
        <div className="max-w-md w-full mx-auto">
          {isResetComplete ? (
            <div className="text-center py-2 sm:py-3 space-y-3 sm:space-y-4 animate-in fade-in duration-300">
              <div className="w-14 h-14 bg-[#EEF6F4] dark:bg-[#132B25] text-brand-sage rounded-2xl mx-auto flex items-center justify-center shadow-warm-xs">
                <CheckCircle className="w-7 h-7" />
              </div>

              <div>
                <Badge variant="sage" dot className="mb-1.5">Security Updated</Badge>
                <h2 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-slate-900 dark:text-slate-100">
                  Password Updated
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  Your credentials have been updated. You can now sign in to your assessment workspace.
                </p>
              </div>

              <div className="pt-1 sm:pt-2">
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => navigate('/auth/login')}
                  icon={ArrowRight}
                  iconPosition="right"
                >
                  Proceed to Sign In
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4 sm:mb-5">
                <Link
                  to="/auth/login"
                  className="inline-flex items-center text-xs font-semibold text-slate-400 hover:text-brand-primary mb-2 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  Back to Sign In
                </Link>
                <h1 className="text-2xl sm:text-2xl lg:text-[1.65rem] font-bold font-display tracking-tight text-slate-900 dark:text-slate-100 leading-snug">
                  Reset Password
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                  Define a new password for your institutional account.
                </p>
              </div>

              <Formik
                initialValues={{ password: '', confirmPassword: '' }}
                validationSchema={resetPasswordSchema}
                onSubmit={handleSubmit}
              >
                {({ values, errors, touched, handleChange, handleBlur, isSubmitting }) => (
                  <Form className="space-y-3 sm:space-y-3.5">
                    <Input
                      label="New Password"
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

                    <Input
                      label="Confirm New Password"
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      placeholder="Re-enter your new password"
                      icon={Lock}
                      value={values.confirmPassword}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.confirmPassword && errors.confirmPassword}
                      required
                    />

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
                      Update Password & Sign In
                    </Button>
                  </Form>
                )}
              </Formik>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
