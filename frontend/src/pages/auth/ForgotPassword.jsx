// Import React core library and the useState hook for local component state management
import { useState } from 'react';
// Import the Link component from react-router-dom for client-side navigation
import { Link } from 'react-router-dom';
// Import Formik state management and Form wrapper components from formik
import { Formik, Form } from 'formik';
// Import Yup validation library for schema-based form input validation
import * as Yup from 'yup';
// Import toast notification utility from react-toastify to show success/error alerts
import { toast } from 'react-toastify';
// Import reusable Input component for form fields
import Input from '../../components/ui/Input';
// Import reusable Button component for interactive actions
import Button from '../../components/ui/Button';
// Import reusable Badge component for tag displays
import Badge from '../../components/ui/Badge';
// Import visual editorial illustration component for auth views
import AuthIllustration from '../../components/common/AuthIllustration';
// Import UI vector icons from lucide-react library
import { Mail, ArrowLeft, ArrowRight, CheckCircle, KeyRound } from 'lucide-react';
// Import the authentication service to communicate with backend auth endpoints
import { authService } from '../../services/auth.service';

// Define the Yup validation schema for the forgot password email submission
const forgotPasswordSchema = Yup.object().shape({
  // Specify that email must be a valid email format string and is mandatory
  email: Yup.string()
    // Validate format as a valid email address with an institutional prompt
    .email('Please provide a valid institutional email address')
    // Enforce that email cannot be omitted
    .required('Email address is required'),
// Conclude the forgotPasswordSchema definition
});

// Define the ForgotPassword functional component
const ForgotPassword = () => {
  // State indicating whether the recovery instructions have been successfully dispatched
  const [isSubmitted, setIsSubmitted] = useState(false);
  // State storing the email address that instructions were dispatched to
  const [submittedEmail, setSubmittedEmail] = useState('');

  // Handler invoked when the user submits the password recovery form
  const handleSubmit = async (values, { setSubmitting }) => {
    // Begin try block for the asynchronous password reset request
    try {
      // Call backend forgot-password API with the user-entered email address
      await authService.forgotPassword(values.email);
      // Persist the submitted email in local component state for the confirmation view
      setSubmittedEmail(values.email);
      // Toggle submission state to display the success confirmation screen
      setIsSubmitted(true);
      // Display success toast notification confirming recovery instructions were sent
      toast.success('Password recovery instructions dispatched to your email.');
    // Catch any HTTP or network error encountered during submission
    } catch (err) {
      // Determine the most specific error message from the response or exception
      const errorMsg =
        // Extract server error message from Axios response data if present
        err.response?.data?.message ||
        // Fall back to general JavaScript error message
        err.message ||
        // Default generic error fallback message
        'Unable to send recovery email. Please try again.';
      // Display error notification to the user
      toast.error(errorMsg);
    // Execute cleanup logic regardless of outcome
    } finally {
      // Set Formik submitting state back to false to re-enable form submission controls
      setSubmitting(false);
    // Conclude try-catch-finally block
    }
  // Conclude handleSubmit function
  };

  // Render the forgot password UI layout
  return (
    // Outer card container with responsive grid layout and rounded styling
    <div className="w-full max-w-5xl mx-auto rounded-3xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark shadow-warm-lg overflow-hidden grid grid-cols-1 lg:grid-cols-12">
      {/* Left Column: Brand & Editorial Illustration */}
      <div className="hidden lg:flex lg:col-span-5 flex-col justify-between bg-gradient-to-br from-[#FFF4EB] via-[#FFF9F2] to-[#EEF6F4] dark:from-[#241712] dark:via-surface-dark dark:to-[#132822] p-5 sm:p-6 lg:p-6 xl:p-7 border-r border-surface-light-border dark:border-surface-dark-border">
        {/* Brand header, badge, and descriptive messaging container */}
        <div>
          {/* Header block with logo badge and platform branding title */}
          <div className="flex items-center space-x-3 mb-4 sm:mb-5">
            {/* Logo monogram container */}
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-gradient-to-br from-brand-terracotta to-brand-peach flex items-center justify-center text-white font-extrabold text-base shadow-warm-xs">
              {/* Logo initial character */}
              U
            {/* Close logo container */}
            </div>
            {/* Brand title and suite subtitle container */}
            <div>
              {/* Primary platform name */}
              <span className="font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-slate-100 block leading-tight">
                Unified Assessment
              {/* Close platform name */}
              </span>
              {/* Academic suite descriptive subtitle */}
              <span className="text-[9px] sm:text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                EdTech Academic Suite
              {/* Close subtitle */}
              </span>
            {/* Close brand text container */}
            </div>
          {/* Close branding header */}
          </div>

          {/* Account recovery feature badge */}
          <Badge variant="peach" dot className="mb-2">
            Account Recovery
          </Badge>

          {/* Section heading explaining the account recovery function */}
          <h2 className="text-xl lg:text-2xl font-bold font-display text-slate-900 dark:text-slate-100 leading-snug mb-1.5">
            Secure Institutional Account Recovery
          </h2>
          {/* Descriptive text informing the user about the verification process */}
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3 sm:mb-4">
            We'll dispatch automated verification instructions to your official campus email to securely restore access to your assessment records.
          </p>

          {/* Security advisory informational card */}
          <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-800/60 border border-surface-light-border dark:border-surface-dark-border text-xs space-y-1 shadow-warm-xs">
            {/* Advisory card title row */}
            <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-200">
              {/* KeyRound icon for credential reset */}
              <KeyRound className="w-4 h-4 text-brand-primary flex-shrink-0" />
              {/* Advisory title text */}
              <span className="font-semibold">Protected Credential Reset</span>
            {/* Close advisory title row */}
            </div>
            {/* Token expiry compliance information text */}
            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 pl-6">
              Password recovery tokens expire after 30 minutes for security compliance.
            </p>
          {/* Close advisory card */}
          </div>
        {/* Close brand descriptive section */}
        </div>

        {/* Editorial graphic illustration wrapper */}
        <div className="my-1">
          {/* Render auth illustration for student role */}
          <AuthIllustration role="student" />
        {/* Close illustration wrapper */}
        </div>

        {/* Copyright footer notice with dynamic year */}
        <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
          © {new Date().getFullYear()} Unified Assessment Platform
        </p>
      {/* Close left column */}
      </div>

      {/* Right Column: Recovery Form or Confirmation */}
      <div className="lg:col-span-7 p-5 sm:p-7 lg:py-6 lg:px-8 xl:py-7 xl:px-10 flex flex-col justify-center bg-white dark:bg-surface-dark">
        {/* Inner centered form container with maximum width constraint */}
        <div className="max-w-md w-full mx-auto">
          {/* Conditionally render confirmation view if request submitted, else render input form */}
          {isSubmitted ? (
            // Success confirmation view container
            <div className="text-center py-2 sm:py-3 space-y-3 sm:space-y-4 animate-in fade-in duration-300">
              {/* Circular icon container with check mark */}
              <div className="w-14 h-14 bg-[#EEF6F4] dark:bg-[#132B25] text-brand-sage rounded-2xl mx-auto flex items-center justify-center shadow-warm-xs">
                {/* CheckCircle icon indicating successful request dispatch */}
                <CheckCircle className="w-7 h-7" />
              {/* Close icon wrapper */}
              </div>

              {/* Status title and dispatched destination confirmation */}
              <div>
                {/* Sage badge confirming dispatch */}
                <Badge variant="sage" dot className="mb-1.5">Recovery Dispatched</Badge>
                {/* Primary confirmation title */}
                <h2 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-slate-900 dark:text-slate-100">
                  Check Your Inbox
                </h2>
                {/* Email delivery explanation text */}
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  We have sent password reset instructions to <strong className="text-slate-800 dark:text-slate-200">{submittedEmail}</strong>.
                </p>
              {/* Close title container */}
              </div>

              {/* Informational instruction box */}
              <div className="p-3 sm:p-4 rounded-xl bg-[#FFF9F2] dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border text-left text-xs space-y-2">
                {/* Action instruction text */}
                <p className="text-slate-600 dark:text-slate-300">
                  Please review your campus email inbox and follow the secure link to define your new password.
                </p>
              {/* Close instruction box */}
              </div>

              {/* Button container to navigate back to sign in */}
              <div className="pt-1 sm:pt-2">
                {/* React Router link redirecting to login page */}
                <Link to="/auth/login">
                  {/* Button returning to the sign in page */}
                  <Button variant="primary" fullWidth icon={ArrowLeft}>
                    Return to Sign In
                  </Button>
                {/* Close link */}
                </Link>
              {/* Close button container */}
              </div>
            {/* Close confirmation view */}
            </div>
          ) : (
            // Form fragment shown prior to submission
            <>
              {/* Form heading container */}
              <div className="mb-4 sm:mb-5">
                {/* Back link navigating to the sign in page */}
                <Link
                  to="/auth/login"
                  className="inline-flex items-center text-xs font-semibold text-slate-400 hover:text-brand-primary mb-2 transition-colors"
                >
                  {/* ArrowLeft icon indicating backward navigation */}
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  Back to Sign In
                </Link>
                {/* Form headline title */}
                <h1 className="text-2xl sm:text-2xl lg:text-[1.65rem] font-bold font-display tracking-tight text-slate-900 dark:text-slate-100 leading-snug">
                  Forgot Password?
                </h1>
                {/* Form helper subtitle */}
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                  Enter your registered institutional email to receive secure recovery guidance.
                </p>
              {/* Close form heading container */}
              </div>

              {/* Formik state wrapper for form validation and submission handling */}
              <Formik
                initialValues={{ email: '' }}
                validationSchema={forgotPasswordSchema}
                onSubmit={handleSubmit}
              >
                {/* Render function providing Formik form props and state */}
                {({ values, errors, touched, handleChange, handleBlur, isSubmitting }) => (
                  // Formik Form HTML wrapper
                  <Form className="space-y-3 sm:space-y-3.5">
                    {/* Controlled input field for institutional email */}
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

                    {/* Submit button initiating recovery instructions dispatch */}
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
                      Send Recovery Instructions
                    </Button>
                  {/* Close Formik Form */}
                  </Form>
                )}
              {/* Close Formik wrapper */}
              </Formik>

              {/* Bottom footer bar with sign in link */}
              <div className="mt-4 sm:mt-5 pt-3 sm:pt-3.5 border-t border-surface-light-border dark:border-surface-dark-border text-center text-xs text-slate-500 dark:text-slate-400">
                {/* Footer question prompt text */}
                Remember your password?{' '}
                {/* Link to navigate directly to login */}
                <Link
                  to="/auth/login"
                  className="font-semibold text-brand-primary hover:text-brand-primary-hover hover:underline"
                >
                  Sign in
                </Link>
              {/* Close footer bar */}
              </div>
            {/* Close form fragment */}
            </>
          )}
        {/* Close inner form container */}
        </div>
      {/* Close right column */}
      </div>
    {/* Close outer grid card */}
    </div>
  );
// Conclude ForgotPassword component definition
};

// Export ForgotPassword as the default export of this module
export default ForgotPassword;
