// Import React core library and hooks for state, effect lifecycles, and component instance references
import { useEffect, useState, useRef } from 'react';
// Import routing hooks and components from react-router-dom for URL inspection, programmatic navigation, and links
import { useNavigate, useLocation, Link } from 'react-router-dom';
// Import toast notification utility for displaying feedback messages to the user
import { toast } from 'react-toastify';
// Import custom useAuth hook to trigger Google authorization code exchange with backend
import { useAuth } from '../../hooks/useAuth';
// Import reusable Alert component for displaying OAuth error notices
import Alert from '../../components/ui/Alert';
// Import standard Button component for interactive controls
import Button from '../../components/ui/Button';
// Import Badge component for status tags
import Badge from '../../components/ui/Badge';
// Import PageLoader for post-login branded transition
import PageLoader from '../../components/ui/PageLoader';
// Import branded transition duration constant
import { BRANDED_TRANSITION_MIN_DURATION_MS } from '../../utils/constants';
// Import Lucide icons used across processing, pending review, and error states
import {Clock, AlertCircle,ArrowLeft } from 'lucide-react';

// Google OAuth 2.0 redirect callback component handling code exchange, MFA challenges, and pending account states
const GoogleCallback = () => {
  // Destructure Google authentication method from AuthContext
  const { loginWithGoogle } = useAuth();
  // Programmatic navigation hook
  const navigate = useNavigate();
  // Location hook to read URL query parameters
  const location = useLocation();

  // Screen status state: 'processing' (token exchange underway), 'pending' (awaiting admin review), or 'error'
  const [status, setStatus] = useState('processing'); // 'processing' | 'pending' | 'error'
  // Error message string for failed authentication attempts
  const [errorMessage, setErrorMessage] = useState('');
  // User applicant metadata displayed when an account is newly registered and awaiting administrator approval
  const [applicantInfo, setApplicantInfo] = useState(null);
  // State tracking designated post-login branded transition
  const [postLoginTransition, setPostLoginTransition] = useState({
    active: false,
    user: null,
    role: null,
    targetPath: '',
  });

  // Ref flag preventing duplicate code exchange execution in React StrictMode development mounts
  const processingRef = useRef(false);

  // Mount effect extracting query parameters and executing authorization code exchange
  useEffect(() => {
    // If code exchange was already initiated by a previous effect run, return early
    if (processingRef.current) return;
    // Lock execution ref to guarantee single-invocation behavior
    processingRef.current = true;

    // Parse URL search query parameters
    const queryParams = new URLSearchParams(location.search);
    // Extract Google authorization code
    const code = queryParams.get('code');
    // Extract CSRF anti-forgery state parameter
    const state = queryParams.get('state');
    // Extract Google OAuth error parameter if user cancelled or authorization was denied
    const errorParam = queryParams.get('error');

    // Handle Google OAuth authorization errors
    if (errorParam) {
      // Set view status to error
      setStatus('error');
      // Format friendly error message
      setErrorMessage(
        errorParam === 'access_denied'
          ? 'Google authorization request was cancelled or denied.'
          : `Google OAuth error: ${errorParam}`
      );
      // Terminate execution
      return;
    }

    // Verify that an authorization code parameter is present
    if (!code) {
      // Set view status to error
      setStatus('error');
      // Set missing code error message
      setErrorMessage('Missing Google authorization code in callback redirect.');
      // Terminate execution
      return;
    }

    // Retrieve stored anti-forgery state parameter from session storage
    const storedState = sessionStorage.getItem('google_oauth_state');
    // Validate anti-forgery state token to mitigate Cross-Site Request Forgery attacks
    if (storedState && state && storedState !== state) {
      // Log state parameter mismatch warning
      console.warn('[GoogleCallback] State parameter mismatch. Proceeding with caution.');
    }
    // Clean up state token from session storage
    sessionStorage.removeItem('google_oauth_state');

    // Asynchronously exchange code for JWT tokens with backend API
    const executeLogin = async () => {
      // Begin authorization code exchange try block
      try {
        // Dispatch code and state to backend endpoint via AuthContext
        const response = await loginWithGoogle({ code, state });

        // If the linked Google user account has MFA enabled, redirect to MFA challenge verification view
        if (response && response.mfaRequired && response.mfaToken) {
          // Store intermediate challenge token in session storage
          sessionStorage.setItem(
            'uap_mfa_challenge',
            JSON.stringify({
              mfaToken: response.mfaToken,
              email: response.user?.email || '',
              role: response.user?.role || 'student',
            })
          );
          // Navigate user to MFA verification page
          navigate('/auth/mfa-verify', {
            replace: true,
            state: {
              mfaToken: response.mfaToken,
              email: response.user?.email || '',
            },
          });
          // Terminate callback processing
          return;
        }

        // If account is newly registered and requires administrator review before activation
        if (response.status === 'pending' || response.pendingApproval || !response.accessToken) {
          // Switch view status to pending
          setStatus('pending');
          // Save applicant user profile to render confirmation card
          setApplicantInfo(response.user || null);
          // Terminate callback processing
          return;
        }

        // Capture authenticated active user profile
        const activeUser = response.user;
        // Display welcome toast
        toast.success(`Welcome, ${activeUser.name}!`);

        // Redirect to role-appropriate platform workspace
        let targetPath = '/student/dashboard';
        if (activeUser.role === 'admin') {
          targetPath = '/admin/dashboard';
        } else if (activeUser.role === 'instructor') {
          targetPath = '/instructor/dashboard';
        } else {
          targetPath = '/student/dashboard';
        }

        // If branded transition duration is active, initiate designated ~2.5-second post-login transition
        if (BRANDED_TRANSITION_MIN_DURATION_MS > 0) {
          setPostLoginTransition({
            active: true,
            user: activeUser,
            role: activeUser.role,
            targetPath,
          });
        } else {
          navigate(targetPath, { replace: true });
        }
      // Catch authentication errors or pending registration responses
      } catch (err) {
        // Extract server error message
        const serverMsg =
          err.response?.data?.message || err.message || 'Authentication failed. Please try again.';

        // Check if server rejected login specifically because account is awaiting administrator approval
        if (
          serverMsg.toLowerCase().includes('pending') ||
          err.response?.status === 202 ||
          err.response?.data?.status === 'pending'
        ) {
          // Switch view to pending review state
          setStatus('pending');
          // Extract user metadata from response payload
          setApplicantInfo(err.response?.data?.data?.user || null);
        // Handle all other authentication errors
        } else {
          // Switch view to error state
          setStatus('error');
          // Set error message
          setErrorMessage(serverMsg);
        }
      }
    };

    // Execute Google login exchange
    executeLogin();
  // Re-run effect if search parameters or login function change
  }, [location.search, loginWithGoogle, navigate]);

  // If designated post-login transition is active, render full-page branded transition loader
  if (postLoginTransition.active) {
    return (
      <PageLoader
        fullScreen
        branded
        minDuration={BRANDED_TRANSITION_MIN_DURATION_MS}
        user={postLoginTransition.user}
        role={postLoginTransition.role}
        message="Google account verified. Preparing workspace..."
        onComplete={() => {
          navigate(postLoginTransition.targetPath, { replace: true });
        }}
      />
    );
  }

  // Render callback state view markup
  return (
    <div className="w-full max-w-lg mx-auto py-12 px-4 sm:px-6">
      <div className="rounded-3xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark shadow-warm-lg overflow-hidden p-8 sm:p-10 text-center">
        {/* Processing Spinner State */}
        {status === 'processing' && (
          <div className="py-8">
            {/* Animated circular spinner */}
            <div className="w-14 h-14 border-4 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin mx-auto mb-6" />
            <h2 className="text-xl font-bold font-display text-slate-900 dark:text-slate-100 mb-2">
              Verifying Google Credentials
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Exchanging secure tokens and verifying institutional identity...
            </p>
          </div>
        )}

        {/* Pending Administrator Review State */}
        {status === 'pending' && (
          <div className="py-4">
            {/* Clock icon badge container */}
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400 mx-auto mb-5 shadow-warm-xs">
              <Clock className="w-7 h-7" />
            </div>

            {/* Status tag */}
            <Badge variant="peach" dot className="mb-3">
              Application Under Review
            </Badge>

            {/* State heading */}
            <h2 className="text-2xl font-bold font-display text-slate-900 dark:text-slate-100 mb-3">
              Registration Received
            </h2>

            {/* Explanation paragraph */}
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
              Your Google account has been registered with the <strong>Student</strong> role.
              Per institutional policy, an administrator must review and approve your account before access is granted.
            </p>

            {/* Applicant metadata summary card */}
            {applicantInfo && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-left text-xs text-slate-600 dark:text-slate-300 mb-6 space-y-1">
                <div><strong>Name:</strong> {applicantInfo.name}</div>
                <div><strong>Email:</strong> {applicantInfo.email}</div>
                <div><strong>Role:</strong> {applicantInfo.role}</div>
                <div><strong>Status:</strong> <span className="capitalize text-amber-600 font-semibold">{applicantInfo.status || 'Pending'}</span></div>
              </div>
            )}

            {/* Navigation back to sign in */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/auth/login" className="w-full sm:w-auto">
                <Button variant="outline" size="md" fullWidth icon={ArrowLeft}>
                  Back to Sign In
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Error Failure State */}
        {status === 'error' && (
          <div className="py-4">
            {/* Alert circle container */}
            <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 flex items-center justify-center text-red-600 dark:text-red-400 mx-auto mb-5 shadow-warm-xs">
              <AlertCircle className="w-7 h-7" />
            </div>

            {/* Error badge */}
            <Badge variant="terracotta" className="mb-3">
              Authentication Error
            </Badge>

            {/* Error heading */}
            <h2 className="text-2xl font-bold font-display text-slate-900 dark:text-slate-100 mb-3">
              Sign-In Failed
            </h2>

            {/* Detailed alert banner */}
            <Alert type="error" className="mb-6 text-left">
              {errorMessage || 'Unable to authenticate with Google.'}
            </Alert>

            {/* Return to login button */}
            <Link to="/auth/login">
              <Button variant="primary" size="md" fullWidth icon={ArrowLeft}>
                Return to Sign In
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

// Export GoogleCallback component
export default GoogleCallback;
