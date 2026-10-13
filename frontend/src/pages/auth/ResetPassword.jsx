// Import React core library and the useState hook for managing local state
import { useState } from 'react';
// Import routing hooks and components from react-router-dom for navigation and query parameter parsing
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
// Import Formik state management and Form wrapper components
import { Formik, Form } from 'formik';
// Import Yup schema validation library
import * as Yup from 'yup';
// Import toast notification utility from react-toastify
import { toast } from 'react-toastify';
// Import reusable Input component for password fields
import Input from '../../components/ui/Input';
// Import reusable Button component for interactive form actions
import Button from '../../components/ui/Button';
// Import reusable Badge component for tag displays
import Badge from '../../components/ui/Badge';
// Import visual editorial illustration component for auth views
import AuthIllustration from '../../components/common/AuthIllustration';
// Import vector icons from the lucide-react icon library
import { Lock, ArrowLeft, ArrowRight, CheckCircle, ShieldCheck, AlertCircle } from 'lucide-react';
// Import authentication service to submit password reset requests to the backend
import { authService } from '../../services/auth.service';

// Define the Yup validation schema for password reset inputs
const resetPasswordSchema = Yup.object().shape({
  // Enforce password requirements: minimum 6 characters and required
  password: Yup.string()
    // Enforce minimum character length requirement of 6 characters
    .min(6, 'Password must be at least 6 characters')
    // Make password a required input
    .required('New password is required'),
  // Enforce confirm password requirement: must match the password value
  confirmPassword: Yup.string()
    // Verify that confirmPassword matches the password field value
    .oneOf([Yup.ref('password'), null], 'Passwords must match')
    // Make confirm password a required input
    .required('Please confirm your new password'),
// Conclude the resetPasswordSchema definition
});

// Define the ResetPassword component
const ResetPassword = () => {
  // Initialize the navigate function for programmatic route transitions
  const navigate = useNavigate();
  // Access URL search query parameters using the useSearchParams hook
  const [searchParams] = useSearchParams();
  // Extract the reset token parameter from the URL query string, defaulting to empty string
  const token = searchParams.get('token') || '';
  // State tracking whether the password update was successfully completed
  const [isResetComplete, setIsResetComplete] = useState(false);

  // Form submission handler to submit the new password with the reset token
  const handleSubmit = async (values, { setSubmitting }) => {
    // Check if the recovery token is missing from the URL
    if (!token) {
      // Display error notification when token is absent
      toast.error('Password reset token is missing from the URL. Please request a new recovery link.');
      // Terminate submission early since token is missing
      return;
    // Conclude token presence check
    }
    // Begin try block for the asynchronous password reset request
    try {
      // Send the reset password request payload to the authentication API
      await authService.resetPassword({
        // Include the token parsed from the URL
        token,
        // Include the user-entered new password
        password: values.password,
        // Include the confirmation password
        confirmPassword: values.confirmPassword,
      // Conclude API payload object
      });
      // Update state to indicate reset is complete, switching to success view
      setIsResetComplete(true);
      // Display success toast message confirming password update
      toast.success('Your password has been reset successfully!');
    // Handle any network or validation errors during reset
    } catch (err) {
      // Extract specific error message or fall back to defaults
      const errorMsg =
        // Extract server response error message
        err.response?.data?.message ||
        // Extract generic error message
        err.message ||
        // Fallback default error message
        'Password reset failed. Please request a new recovery link.';
      // Display error notification
      toast.error(errorMsg);
    // Execute cleanup regardless of outcome
    } finally {
      // Release Formik submitting state
      setSubmitting(false);
    // Conclude try-catch-finally block
    }
  // Conclude handleSubmit definition
  };

  // Render the ResetPassword interface
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

          {/* Credential reset feature badge */}
          <Badge variant="terracotta" dot className="mb-2">
            Credential Reset
          </Badge>

          {/* Section heading explaining the passcode update */}
          <h2 className="text-xl lg:text-2xl font-bold font-display text-slate-900 dark:text-slate-100 leading-snug mb-1.5">
            Establish a New Account Passcode
          </h2>
          {/* Descriptive text regarding password uniqueness and safety */}
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3 sm:mb-4">
            Choose a strong, unique password to secure your institutional coursework and examination history.
          </p>

          {/* Security best practices advisory box */}
          <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-800/60 border border-surface-light-border dark:border-surface-dark-border text-xs space-y-1 shadow-warm-xs">
            {/* Security advisory title row */}
            <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-200">
              {/* ShieldCheck security icon */}
              <ShieldCheck className="w-4 h-4 text-brand-primary flex-shrink-0" />
              {/* Security best practice title label */}
              <span className="font-semibold">Security Best Practice</span>
            {/* Close advisory title row */}
            </div>
            {/* Password complexity recommendation guidance */}
            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 pl-6">
              Use at least 6 characters including letters, numbers, and symbols.
            </p>
          {/* Close security advisory box */}
          </div>
        {/* Close brand description container */}
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

      {/* Right Column: Reset Form or Success Confirmation */}
      <div className="lg:col-span-7 p-5 sm:p-7 lg:py-6 lg:px-8 xl:py-7 xl:px-10 flex flex-col justify-center bg-white dark:bg-surface-dark">
        {/* Inner centered form container with maximum width constraint */}
        <div className="max-w-md w-full mx-auto">
          {/* Conditionally render success view if reset completed, else render password form */}
          {isResetComplete ? (
            // Success confirmation view container
            <div className="text-center py-2 sm:py-3 space-y-3 sm:space-y-4 animate-in fade-in duration-300">
              {/* Circular icon container with check mark */}
              <div className="w-14 h-14 bg-[#EEF6F4] dark:bg-[#132B25] text-brand-sage rounded-2xl mx-auto flex items-center justify-center shadow-warm-xs">
                {/* CheckCircle icon indicating successful password reset */}
                <CheckCircle className="w-7 h-7" />
              {/* Close icon wrapper */}
              </div>

              {/* Status title and updated credential confirmation message */}
              <div>
                {/* Sage badge confirming updated security */}
                <Badge variant="sage" dot className="mb-1.5">Security Updated</Badge>
                {/* Primary confirmation title */}
                <h2 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-slate-900 dark:text-slate-100">
                  Password Updated
                </h2>
                {/* Confirmation description text */}
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  Your credentials have been updated. You can now sign in to your assessment workspace.
                </p>
              {/* Close confirmation message container */}
              </div>

              {/* Button container to proceed to sign in */}
              <div className="pt-1 sm:pt-2">
                {/* Button navigating to login route */}
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => navigate('/auth/login')}
                  icon={ArrowRight}
                  iconPosition="right"
                >
                  Proceed to Sign In
                </Button>
              {/* Close button container */}
              </div>
            {/* Close success confirmation view */}
            </div>
          ) : (
            // Form fragment shown when reset is in progress
            <>
              {/* Form heading container */}
              <div className="mb-4 sm:mb-5">
                {/* Back link navigating to sign in */}
                <Link
                  to="/auth/login"
                  className="inline-flex items-center text-xs font-semibold text-slate-400 hover:text-brand-primary mb-2 transition-colors"
                >
                  {/* ArrowLeft icon indicating return to login */}
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  Back to Sign In
                </Link>
                {/* Form headline title */}
                <h1 className="text-2xl sm:text-2xl lg:text-[1.65rem] font-bold font-display tracking-tight text-slate-900 dark:text-slate-100 leading-snug">
                  Reset Password
                </h1>
                {/* Form helper subtitle */}
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                  Define a new password for your institutional account.
                </p>
              {/* Close form heading container */}
              </div>

              {/* Conditionally display warning if token is missing from URL query string */}
              {!token && (
                // Missing token warning alert container
                <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-start space-x-2">
                  {/* AlertCircle warning icon */}
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  {/* Warning explanation text container */}
                  <div>
                    {/* Warning header text */}
                    <span className="font-semibold block">Missing Recovery Token</span>
                    {/* Guidance on resolving missing token */}
                    No reset token detected in the URL. Please open the link received in your email or{' '}
                    {/* Link to request a new recovery email */}
                    <Link to="/auth/forgot-password" className="underline font-semibold hover:text-amber-900 dark:hover:text-amber-100">
                      request a new recovery email
                    </Link>.
                  {/* Close warning text container */}
                  </div>
                {/* Close warning alert container */}
                </div>
              )}

              {/* Formik state wrapper for form validation and submission handling */}
              <Formik
                initialValues={{ password: '', confirmPassword: '' }}
                validationSchema={resetPasswordSchema}
                onSubmit={handleSubmit}
              >
                {/* Render function providing Formik form props and state */}
                {({ values, errors, touched, handleChange, handleBlur, isSubmitting }) => (
                  // Formik Form HTML wrapper
                  <Form className="space-y-3 sm:space-y-3.5">
                    {/* Input field for new password */}
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

                    {/* Input field for confirming new password */}
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

                    {/* Submit button updating password and proceeding to sign in */}
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
                  {/* Close Formik Form */}
                  </Form>
                )}
              {/* Close Formik wrapper */}
              </Formik>
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
// Conclude ResetPassword component definition
};

// Export ResetPassword as the default export of this module
export default ResetPassword;
