// Import React library and useState hook for component state management
import { useState } from 'react';
// Import Link component and useNavigate hook from react-router-dom for navigation
import { Link, useNavigate } from 'react-router-dom';
// Import Formik state container and Form component from formik
import { Formik, Form } from 'formik';
// Import Yup schema validation library
import * as Yup from 'yup';
// Import toast notification utility from react-toastify
import { toast } from 'react-toastify';
// Import authentication context hook to access the register method
import { useAuth } from '../../hooks/useAuth';
// Import reusable Input UI component
import Input from '../../components/ui/Input';
// Import reusable Select dropdown UI component
import Select from '../../components/ui/Select';
// Import reusable Button UI component
import Button from '../../components/ui/Button';
// Import reusable Alert notification UI component
import Alert from '../../components/ui/Alert';
// Import reusable Badge tag UI component
import Badge from '../../components/ui/Badge';
// Import visual editorial illustration component for auth views
import AuthIllustration from '../../components/common/AuthIllustration';
// Import vector icons from the lucide-react icon library
import { User, Mail, Lock, Building, ArrowRight, ShieldCheck, GraduationCap, Calendar, CheckCircle } from 'lucide-react';

// Define the Yup validation schema for user registration fields
const signupSchema = Yup.object().shape({
  // Enforce full name length and requirement
  name: Yup.string()
    // Require at least 2 characters for full name
    .min(2, 'Name must be at least 2 characters')
    // Make full name mandatory
    .required('Full name is required'),
  // Enforce valid email format and requirement
  email: Yup.string()
    // Require standard email syntax
    .email('Please provide a valid institutional email address')
    // Make email address mandatory
    .required('Email address is required'),
  // Enforce account role selection
  role: Yup.string()
    // Allow only student or instructor roles during self-registration
    .oneOf(['student', 'instructor'], 'Role must be Student or Instructor')
    // Make role selection mandatory
    .required('Account type is required'),
  // Conditionally validate studentId when role is student
  studentId: Yup.string().when('role', {
    // Condition check: role equals student
    is: 'student',
    // Apply trimmed required validation when role is student
    then: (schema) => schema.trim().required('Student ID is required for verification'),
    // Make not required when role is not student
    otherwise: (schema) => schema.notRequired(),
  // Conclude studentId conditional validation
  }),
  // Conditionally validate dateOfBirth when role is student
  dateOfBirth: Yup.string().when('role', {
    // Condition check: role equals student
    is: 'student',
    // Apply required validation when role is student
    then: (schema) => schema.required('Date of birth is required for verification'),
    // Make not required when role is not student
    otherwise: (schema) => schema.notRequired(),
  // Conclude dateOfBirth conditional validation
  }),
  // Enforce password complexity and requirement
  password: Yup.string()
    // Require minimum 6 characters for password
    .min(6, 'Password must be at least 6 characters')
    // Make password mandatory
    .required('Password is required'),
  // Enforce password confirmation matching
  confirmPassword: Yup.string()
    // Require confirmPassword to match password
    .oneOf([Yup.ref('password'), null], 'Passwords must match')
    // Make confirm password mandatory
    .required('Please confirm your password'),
  // Optional institutional campus tracking code
  instituteCode: Yup.string().trim().optional(),
// Conclude signupSchema definition
});

// Define the Signup page component
const Signup = () => {
  // Extract register method from auth context
  const { register } = useAuth();
  // Initialize navigation function for route redirects
  const navigate = useNavigate();
  // State for storing registration error messages
  const [authError, setAuthError] = useState(null);
  // State for storing submitted registration details upon success
  const [registrationSubmitted, setRegistrationSubmitted] = useState(null);

  // Dropdown options array for selecting user role
  const roleOptions = [
    // Option for student registration
    { value: 'student', label: '🎓 Student / Learner' },
    // Option for instructor/faculty registration
    { value: 'instructor', label: '👨‍🏫 Instructor / Faculty' },
    // Disabled informational option for admin accounts
    { value: 'admin', label: '🛡️ Administration (Invite Only)', disabled: true },
  // Conclude roleOptions array
  ];

  // Handler invoked when submitting the registration form
  const handleSignupSubmit = async (values, { setSubmitting }) => {
    // Reset previous authentication error message
    setAuthError(null);
    // Begin try block for user registration request
    try {
      // Call register authentication action with submitted form values
      const response = await register({
        // Full name of user
        name: values.name,
        // Institutional email address
        email: values.email,
        // Chosen account password
        password: values.password,
        // Password confirmation
        confirmPassword: values.confirmPassword,
        // User account type
        role: values.role,
        // Pass student ID if role is student, otherwise undefined
        studentId: values.role === 'student' ? values.studentId : undefined,
        // Pass date of birth if role is student, otherwise undefined
        dateOfBirth: values.role === 'student' ? values.dateOfBirth : undefined,
        // Institutional campus code
        instituteCode: values.instituteCode,
      // Conclude register payload
      });

      // Check whether user account was automatically verified via master registry
      const isVerified = response.status === 'active' || response.verified === true;

      // Display appropriate notification based on verification outcome
      if (isVerified) {
        // Show success notification for auto-verified student
        toast.success('Identity verified! Your student account is active.');
      // Handle pending approval case
      } else {
        // Show informative notification for pending admin approval
        toast.info(response.message || 'Registration received. Your account is pending administrator approval.');
      // Conclude verification notification conditional
      }

      // Record submitted registration details to render status confirmation view
      setRegistrationSubmitted({
        // Registered full name
        name: values.name,
        // Registered email
        email: values.email,
        // Registered role
        role: values.role,
        // Student ID from server or input
        studentId: response.user?.studentId || values.studentId,
        // Date of birth
        dateOfBirth: values.dateOfBirth,
        // Campus code
        instituteCode: values.instituteCode,
        // Account status
        status: response.status || (isVerified ? 'active' : 'pending'),
        // Verified flag
        verified: isVerified,
        // Server message
        message: response.message,
      // Conclude registrationSubmitted object
      });
    // Handle registration submission errors
    } catch (err) {
      // Update authError state with error message from backend or exception
      setAuthError(err.message || 'Registration failed. Please try again.');
    // Cleanup submission state
    } finally {
      // Re-enable submit button by setting submitting state to false
      setSubmitting(false);
    // Conclude try-catch-finally block
    }
  // Conclude handleSignupSubmit function
  };

  // Render the Signup component UI layout
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

          {/* New registration feature badge */}
          <Badge variant="terracotta" dot className="mb-2">New Registration</Badge>

          {/* Main feature headline */}
          <h2 className="text-xl lg:text-2xl font-bold font-display text-slate-900 dark:text-slate-100 leading-snug mb-1.5">
            Join the Next Generation Evaluation Suite
          </h2>
          {/* Description of automated verification features */}
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3 sm:mb-4">
            Students whose academic identity exists in the institution master registry receive immediate, automated account activation.
          </p>

          {/* Master registry advisory info box */}
          <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-800/60 border border-surface-light-border dark:border-surface-dark-border text-xs space-y-1 shadow-warm-xs">
            {/* Advisory title row */}
            <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-200">
              {/* ShieldCheck icon */}
              <ShieldCheck className="w-4 h-4 text-brand-primary flex-shrink-0" />
              {/* Advisory title */}
              <span className="font-semibold">Master Registry Verification</span>
            {/* Close title row */}
            </div>
            {/* Guidance on required verification inputs */}
            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 pl-6">
              Enter your Student ID, Name, DOB, and Institutional Email for real-time verification.
            </p>
          {/* Close advisory box */}
          </div>
        {/* Close brand description container */}
        </div>

        {/* Editorial graphic illustration wrapper */}
        <div className="my-1">
          {/* Render auth illustration for student role */}
          <AuthIllustration role="student" />
        {/* Close illustration wrapper */}
        </div>

        {/* Copyright notice with current year */}
        <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
          © {new Date().getFullYear()} Unified Assessment Platform
        </p>
      {/* Close left column */}
      </div>

      {/* Right Column: Registration Form or Status Confirmation */}
      <div className="lg:col-span-7 p-5 sm:p-6 lg:py-5 lg:px-8 xl:py-6 xl:px-9 flex flex-col justify-center bg-white dark:bg-surface-dark">
        {/* Max width wrapper for form content */}
        <div className="max-w-md w-full mx-auto">
          {/* Conditionally render confirmation view if registration was submitted, else render form */}
          {registrationSubmitted ? (
            // Status confirmation container
            <div className="text-center py-2 sm:py-3 space-y-3 sm:space-y-4 animate-in fade-in duration-300">
              {/* Check if user identity was verified and account is active */}
              {registrationSubmitted.verified || registrationSubmitted.status === 'active' ? (
                // Verified active account fragment
                <>
                  {/* Circular success badge icon container */}
                  <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl mx-auto flex items-center justify-center shadow-inner">
                    {/* CheckCircle icon */}
                    <CheckCircle className="w-7 h-7" />
                  {/* Close icon container */}
                  </div>

                  {/* Header text for active account */}
                  <div>
                    {/* Verified badge */}
                    <Badge variant="success" dot className="mb-1.5">Academic Identity Verified</Badge>
                    {/* Active account title */}
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                      Account Provisioned & Active
                    </h2>
                    {/* Welcome message with user's name */}
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                      Welcome, <span className="font-semibold text-slate-700 dark:text-slate-200">{registrationSubmitted.name}</span>! Your academic record was verified in the institution master registry. You can sign in immediately.
                    </p>
                  {/* Close header text container */}
                  </div>

                  {/* Details card displaying verified credentials */}
                  <div className="p-3 sm:p-4 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border text-left text-xs space-y-2">
                    {/* Render Student ID if present */}
                    {registrationSubmitted.studentId && (
                      // Student ID row
                      <div className="flex justify-between">
                        {/* Student ID label */}
                        <span className="text-slate-500 dark:text-slate-400">Student ID:</span>
                        {/* Student ID value */}
                        <span className="font-medium text-slate-800 dark:text-slate-200">{registrationSubmitted.studentId}</span>
                      {/* Close Student ID row */}
                      </div>
                    )}
                    {/* Email row */}
                    <div className="flex justify-between">
                      {/* Email label */}
                      <span className="text-slate-500 dark:text-slate-400">Institutional Email:</span>
                      {/* Email value */}
                      <span className="font-medium text-slate-800 dark:text-slate-200">{registrationSubmitted.email}</span>
                    {/* Close email row */}
                    </div>
                    {/* Role row */}
                    <div className="flex justify-between">
                      {/* Role label */}
                      <span className="text-slate-500 dark:text-slate-400">Assigned Role:</span>
                      {/* Role value */}
                      <span className="font-medium capitalize text-slate-800 dark:text-slate-200">{registrationSubmitted.role}</span>
                    {/* Close role row */}
                    </div>
                    {/* Status row */}
                    <div className="flex justify-between border-t border-surface-light-border dark:border-surface-dark-border pt-2">
                      {/* Status label */}
                      <span className="text-slate-500 dark:text-slate-400">Account Status:</span>
                      {/* Status badge */}
                      <Badge variant="success">Active (Verified)</Badge>
                    {/* Close status row */}
                    </div>
                  {/* Close details card */}
                  </div>

                  {/* Action button to sign in */}
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={() => navigate('/auth/login')}
                    icon={ArrowRight}
                    iconPosition="right"
                    className="h-10 sm:h-[42px]"
                  >
                    Proceed to Sign In
                  </Button>
                {/* Close verified fragment */}
                </>
              ) : (
                // Pending administrator review fragment
                <>
                  {/* Warning shield icon container */}
                  <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl mx-auto flex items-center justify-center shadow-inner">
                    {/* ShieldCheck icon */}
                    <ShieldCheck className="w-7 h-7" />
                  {/* Close icon container */}
                  </div>

                  {/* Header text for pending approval */}
                  <div>
                    {/* Pending review badge */}
                    <Badge variant="warning" dot className="mb-1.5">Pending Administrator Review</Badge>
                    {/* Pending title */}
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                      Application Submitted
                    </h2>
                    {/* Explanation text regarding administrative verification */}
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                      Thank you, <span className="font-semibold text-slate-700 dark:text-slate-200">{registrationSubmitted.name}</span>. Your details could not be automatically verified with the master registry. Your application has been queued for administrator verification.
                    </p>
                  {/* Close header text container */}
                  </div>

                  {/* Details card for submitted application */}
                  <div className="p-3 sm:p-4 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border text-left text-xs space-y-2">
                    {/* Email row */}
                    <div className="flex justify-between">
                      {/* Email label */}
                      <span className="text-slate-500 dark:text-slate-400">Institutional Email:</span>
                      {/* Email value */}
                      <span className="font-medium text-slate-800 dark:text-slate-200">{registrationSubmitted.email}</span>
                    {/* Close email row */}
                    </div>
                    {/* Role row */}
                    <div className="flex justify-between">
                      {/* Role label */}
                      <span className="text-slate-500 dark:text-slate-400">Requested Role:</span>
                      {/* Role value */}
                      <span className="font-medium capitalize text-slate-800 dark:text-slate-200">{registrationSubmitted.role}</span>
                    {/* Close role row */}
                    </div>
                    {/* Render institute code if provided */}
                    {registrationSubmitted.instituteCode && (
                      // Institute code row
                      <div className="flex justify-between">
                        {/* Institute code label */}
                        <span className="text-slate-500 dark:text-slate-400">Institute Code:</span>
                        {/* Institute code value */}
                        <span className="font-medium text-slate-800 dark:text-slate-200">{registrationSubmitted.instituteCode}</span>
                      {/* Close institute code row */}
                      </div>
                    )}
                    {/* Status row */}
                    <div className="flex justify-between border-t border-surface-light-border dark:border-surface-dark-border pt-2">
                      {/* Status label */}
                      <span className="text-slate-500 dark:text-slate-400">Account Status:</span>
                      {/* Pending status badge */}
                      <Badge variant="warning">Pending Approval</Badge>
                    {/* Close status row */}
                    </div>
                  {/* Close details card */}
                  </div>

                  {/* Informational disclaimer */}
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    You will be granted access to the platform once an administrator confirms your institutional credentials.
                  </p>

                  {/* Return to sign in button */}
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={() => navigate('/auth/login')}
                    icon={ArrowRight}
                    iconPosition="right"
                    className="h-10 sm:h-[42px]"
                  >
                    Return to Sign In
                  </Button>
                {/* Close pending fragment */}
                </>
              )}
            {/* Close status confirmation view */}
            </div>
          ) : (
            // Registration form view
            <>
              {/* Form title header container */}
              <div className="mb-3.5 sm:mb-4">
                {/* Main title */}
                <h1 className="text-xl sm:text-2xl lg:text-[1.65rem] font-bold font-display tracking-tight text-slate-900 dark:text-slate-100 leading-snug">
                  Create an Account
                </h1>
                {/* Subtitle instructions */}
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Submit your verified institutional credentials for automated or administrative provisioning.
                </p>
              {/* Close title header */}
              </div>

              {/* Render error alert if auth error exists */}
              {authError && (
                // Error alert box
                <Alert type="error" className="mb-3 py-2.5 px-3 text-xs">
                  {/* Error message string */}
                  {authError}
                {/* Close error alert */}
                </Alert>
              )}

              {/* Formik state and validation container */}
              <Formik
                initialValues={{
                  name: '',
                  email: '',
                  password: '',
                  confirmPassword: '',
                  role: 'student',
                  studentId: '',
                  dateOfBirth: '',
                  instituteCode: '',
                }}
                validationSchema={signupSchema}
                onSubmit={handleSignupSubmit}
              >
                {/* Render function exposing Formik values and handlers */}
                {({ values, errors, touched, handleChange, handleBlur, isSubmitting }) => (
                  // Formik Form HTML wrapper
                  <Form className="space-y-3">
                    {/* Account role selector dropdown */}
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

                    {/* Student Master Registry Fields */}
                    {values.role === 'student' && (
                      // Grid container for student-specific verification fields
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl">
                        {/* Student ID input field */}
                        <Input
                          label="Student ID"
                          id="studentId"
                          name="studentId"
                          placeholder="e.g. STU001 or STU-2026-101"
                          icon={GraduationCap}
                          value={values.studentId}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={touched.studentId && errors.studentId}
                          helperText="Authoritative institutional student ID"
                          required
                        />

                        {/* Date of Birth input field */}
                        <Input
                          label="Date of Birth"
                          id="dateOfBirth"
                          name="dateOfBirth"
                          type="date"
                          icon={Calendar}
                          value={values.dateOfBirth}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={touched.dateOfBirth && errors.dateOfBirth}
                          helperText="Official DOB on academic registry"
                          required
                        />
                      {/* Close student verification fields container */}
                      </div>
                    )}

                    {/* Two-column grid for name and email fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                      {/* Full Name input field */}
                      <Input
                        label="Full Name"
                        id="name"
                        name="name"
                        placeholder="e.g. Rahul Kumar"
                        icon={User}
                        value={values.name}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={touched.name && errors.name}
                        required
                      />

                      {/* Institutional Email input field */}
                      <Input
                        label="Institutional Email"
                        id="email"
                        name="email"
                        type="email"
                        placeholder="name@college.edu"
                        icon={Mail}
                        value={values.email}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={touched.email && errors.email}
                        required
                      />
                    {/* Close name and email grid */}
                    </div>

                    {/* Two-column grid for password fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                      {/* Password input field */}
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

                      {/* Confirm Password input field */}
                      <Input
                        label="Confirm Password"
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        placeholder="Re-type password"
                        icon={Lock}
                        value={values.confirmPassword}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={touched.confirmPassword && errors.confirmPassword}
                        required
                      />
                    {/* Close password fields grid */}
                    </div>

                    {/* Institute Code optional input field */}
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

                    {/* Submit button dynamically adapting label based on selected role */}
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      fullWidth
                      isLoading={isSubmitting}
                      icon={ArrowRight}
                      iconPosition="right"
                      className="mt-3.5 h-10 sm:h-[42px]"
                    >
                      {/* Dynamic label based on role */}
                      {values.role === 'student' ? 'Verify & Create Account' : 'Submit for Approval'}
                    </Button>
                  {/* Close Formik Form */}
                  </Form>
                )}
              {/* Close Formik component */}
              </Formik>

              {/* Login link footer */}
              <div className="mt-3.5 sm:mt-4 pt-2.5 sm:pt-3 border-t border-surface-light-border dark:border-surface-dark-border text-center text-xs text-slate-500 dark:text-slate-400">
                {/* Prompt text */}
                Already have an active account?{' '}
                {/* Sign in link */}
                <Link
                  to="/auth/login"
                  className="font-semibold text-brand-primary hover:text-brand-primary-hover hover:underline"
                >
                  Sign in
                </Link>
              {/* Close login link footer */}
              </div>
            {/* Close registration form view */}
            </>
          )}
        {/* Close form wrapper */}
        </div>
      {/* Close right column */}
      </div>
    {/* Close outer grid card */}
    </div>
  );
// Conclude Signup component definition
};

// Export Signup as the default export of this module
export default Signup;
