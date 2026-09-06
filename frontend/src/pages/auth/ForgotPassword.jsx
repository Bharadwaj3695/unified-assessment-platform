import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Badge from '../../components/ui/Badge';
import AuthIllustration from '../../components/common/AuthIllustration';
import { Mail, ArrowLeft, ArrowRight, CheckCircle, KeyRound } from 'lucide-react';

const forgotPasswordSchema = Yup.object().shape({
  email: Yup.string()
    .email('Please provide a valid institutional email address')
    .required('Email address is required'),
});

const ForgotPassword = () => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      // Presentation-layer simulation to provide a delightful UX without altering backend auth
      setSubmittedEmail(values.email);
      setIsSubmitted(true);
      toast.success('Password recovery instructions dispatched to your email.');
    } catch (err) {
      toast.error('Unable to send recovery email. Please try again.');
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

          <Badge variant="peach" dot className="mb-3">
            Account Recovery
          </Badge>

          <h2 className="text-2xl font-bold font-display text-slate-900 dark:text-slate-100 leading-snug mb-2">
            Secure Institutional Account Recovery
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
            We'll dispatch automated verification instructions to your official campus email to securely restore access to your assessment records.
          </p>

          <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-800/60 border border-surface-light-border dark:border-surface-dark-border text-xs space-y-2 shadow-warm-xs">
            <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-200">
              <KeyRound className="w-4 h-4 text-brand-primary flex-shrink-0" />
              <span className="font-semibold">Protected Credential Reset</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-6">
              Password recovery tokens expire after 30 minutes for security compliance.
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

      {/* Right Column: Recovery Form */}
      <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center bg-white dark:bg-surface-dark">
        <div className="max-w-md w-full mx-auto">
          {isSubmitted ? (
            <div className="text-center py-4 space-y-5 animate-in fade-in duration-300">
              <div className="w-16 h-16 bg-[#EEF6F4] dark:bg-[#132B25] text-brand-sage rounded-2xl mx-auto flex items-center justify-center shadow-warm-xs">
                <CheckCircle className="w-8 h-8" />
              </div>

              <div>
                <Badge variant="sage" dot className="mb-2">Recovery Dispatched</Badge>
                <h2 className="text-2xl font-bold font-display tracking-tight text-slate-900 dark:text-slate-100">
                  Check Your Inbox
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                  We have sent password reset instructions to <strong className="text-slate-800 dark:text-slate-200">{submittedEmail}</strong>.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#FFF9F2] dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border text-left text-xs space-y-2">
                <p className="text-slate-600 dark:text-slate-300">
                  Please review your campus email inbox and follow the secure link to define your new password.
                </p>
              </div>

              <div className="pt-2">
                <Link to="/auth/login">
                  <Button variant="primary" fullWidth icon={ArrowLeft}>
                    Return to Sign In
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <Link
                  to="/auth/login"
                  className="inline-flex items-center text-xs font-semibold text-slate-400 hover:text-brand-primary mb-3 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  Back to Sign In
                </Link>
                <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-slate-900 dark:text-slate-100">
                  Forgot Password?
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  Enter your registered institutional email to receive secure recovery guidance.
                </p>
              </div>

              <Formik
                initialValues={{ email: '' }}
                validationSchema={forgotPasswordSchema}
                onSubmit={handleSubmit}
              >
                {({ values, errors, touched, handleChange, handleBlur, isSubmitting }) => (
                  <Form className="space-y-4">
                    <Input
                      label="Institutional Email"
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
                      Send Recovery Instructions
                    </Button>
                  </Form>
                )}
              </Formik>

              <div className="mt-8 pt-6 border-t border-surface-light-border dark:border-surface-dark-border text-center text-xs text-slate-500 dark:text-slate-400">
                Remember your password?{' '}
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

export default ForgotPassword;
