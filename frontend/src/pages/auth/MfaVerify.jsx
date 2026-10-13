// Import React core library and hooks for state, effect lifecycles, and DOM input element references
import { useState, useEffect, useRef } from 'react';
// Import routing hooks from react-router-dom for programmatic navigation, route location inspection, and links
import { useNavigate, useLocation} from 'react-router-dom';
// Import toast notification utility for displaying feedback messages to the user
import { toast } from 'react-toastify';
// Import authentication context hook to complete session establishment upon successful second factor verification
import { useAuth } from '../../hooks/useAuth';
// Import authentication service layer communicating with backend MFA verification endpoints
import { authService } from '../../services/auth.service';
// Import reusable Button component with loading spinner support
import Button from '../../components/ui/Button';
// Import reusable Alert component for displaying verification failure errors
import Alert from '../../components/ui/Alert';
// Import Badge component for pill labels
import Badge from '../../components/ui/Badge';
// Import PageLoader for post-login branded transition
import PageLoader from '../../components/ui/PageLoader';
// Import branded transition duration constant
import { BRANDED_TRANSITION_MIN_DURATION_MS } from '../../utils/constants';
// Import icons from lucide-react for security shields, keys, arrows, and mode toggles
import { ShieldCheck, KeyRound, ArrowRight, ArrowLeft, RotateCcw } from 'lucide-react';

// Multi-Factor Authentication verification view validating time-based authenticator codes or single-use recovery codes
const MfaVerify = () => {
  // Destructure method to establish active session from AuthContext
  const { completeMfaLogin } = useAuth();
  // Initialize navigate function for route redirection
  const navigate = useNavigate();
  // Location hook to read route state passed from login or Google callback
  const location = useLocation();

  // Mode toggle: false = 6-digit TOTP code entry; true = 10-character backup recovery code entry
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  // State storing the 6-digit numeric TOTP code entered by user
  const [totpCode, setTotpCode] = useState('');
  // State storing the formatted 10-character backup recovery code entered by user
  const [recoveryCode, setRecoveryCode] = useState('');
  // Error message string returned from failed verification attempts
  const [errorMessage, setErrorMessage] = useState('');
  // Submitting flag disabling inputs and showing button spinner during network verification
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Challenge payload object containing intermediate mfaToken, email, target route, and user role
  const [challengeData, setChallengeData] = useState(null);
  // State tracking designated post-login branded transition
  const [postLoginTransition, setPostLoginTransition] = useState({
    active: false,
    user: null,
    role: null,
    targetPath: '',
  });

  // Reference to TOTP code text input element for autofocus
  const totpInputRef = useRef(null);
  // Reference to recovery code text input element for autofocus
  const recoveryInputRef = useRef(null);

  // Retrieve challenge token from location.state or sessionStorage
  // Mount effect extracting pending MFA challenge token from router state or browser session storage
  useEffect(() => {
    // Check router state for mfaToken
    let token = location.state?.mfaToken;
    // Check router state for user email
    let email = location.state?.email || '';
    // Check router state for original redirection target
    let from = location.state?.from || null;
    // Initialize role placeholder
    let role = null;

    // If router state does not have token, inspect browser sessionStorage
    if (!token) {
      // Begin parse try block
      try {
        // Retrieve serialized challenge object
        const stored = sessionStorage.getItem('uap_mfa_challenge');
        // If stored string exists
        if (stored) {
          // Parse JSON payload
          const parsed = JSON.parse(stored);
          // Extract token
          token = parsed.mfaToken;
          // Extract email
          email = parsed.email || '';
          // Extract destination route
          from = parsed.from || null;
          // Extract role
          role = parsed.role || null;
        }
      // Catch JSON parse failure
      } catch (err) {
        // Log warning notice
        console.warn('Failed to parse MFA challenge from storage', err);
      }
    }

    // If no valid challenge token could be located, redirect user back to login
    if (!token) {
      // Display alert toast
      toast.error('No pending MFA challenge found. Please sign in again.');
      // Redirect to login page
      navigate('/auth/login', { replace: true });
      // Return early
      return;
    }

    // Save recovered challenge data in component state
    setChallengeData({ mfaToken: token, email, from, role });
  // Re-run effect when location state changes
  }, [location.state, navigate]);

  // Focus appropriate input on mount or mode toggle
  // Effect focusing the active code input field whenever mode changes
  useEffect(() => {
    // If recovery mode is active, focus recovery input
    if (isRecoveryMode) {
      // Focus recovery input
      recoveryInputRef.current?.focus();
    // Otherwise focus standard 6-digit TOTP input
    } else {
      // Focus TOTP input
      totpInputRef.current?.focus();
    }
  // Trigger on mode toggle
  }, [isRecoveryMode]);

  // Input change handler for TOTP code enforcing numeric digits and maximum length of 6
  const handleTotpChange = (e) => {
    // Strip non-digit characters and limit to 6 digits
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    // Update TOTP code state
    setTotpCode(val);
    // Clear any previous error messages
    if (errorMessage) setErrorMessage('');
  };

  // Input change handler for backup recovery code formatting into standard XXXXX-XXXXX structure
  const handleRecoveryChange = (e) => {
    // Strip non-alphanumeric characters, uppercase, and limit to 10 characters
    const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    // Format as XXXXX-XXXXX
    let formatted = raw;
    // If user has entered more than 5 characters, insert middle hyphen
    if (raw.length > 5) {
      // Format with hyphen
      formatted = `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
    }
    // Update recovery code state
    setRecoveryCode(formatted);
    // Clear error message
    if (errorMessage) setErrorMessage('');
  };

  // Finalizes authentication session after verified code and redirects to dashboard or original target
  const handleSuccessfulAuth = (authPayload) => {
    // Purge temporary MFA challenge from session storage
    sessionStorage.removeItem('uap_mfa_challenge');
    // Store access token and user in AuthContext state and browser storage
    const user = completeMfaLogin(authPayload);
    // Display welcome notification
    toast.success(`Welcome back, ${user.name}!`);

    // Resolve intended destination route
    const targetFrom = challengeData?.from;
    let targetPath = '/student/dashboard';
    // If user attempted to reach a specific permitted page, complete transition
    if (targetFrom && targetFrom.startsWith(`/${user.role}`)) {
      targetPath = targetFrom;
    // Redirect admin accounts
    } else if (user.role === 'admin') {
      targetPath = '/admin/dashboard';
    // Redirect instructor accounts
    } else if (user.role === 'instructor') {
      targetPath = '/instructor/dashboard';
    // Redirect student accounts
    } else {
      targetPath = '/student/dashboard';
    }

    // If branded transition duration is active, initiate designated ~2.5-second post-login transition
    if (BRANDED_TRANSITION_MIN_DURATION_MS > 0) {
      setPostLoginTransition({
        active: true,
        user,
        role: user.role,
        targetPath,
      });
    } else {
      navigate(targetPath, { replace: true });
    }
  };

  // Form submission handler verifying 6-digit TOTP code against backend endpoint
  const handleTotpSubmit = async (e) => {
    // Prevent default browser form submission
    e.preventDefault();
    // Validate that code is exactly 6 digits
    if (!totpCode || totpCode.length !== 6) {
      // Display validation error
      setErrorMessage('Please enter a valid 6-digit verification code.');
      // Return early
      return;
    }

    // Clear previous error
    setErrorMessage('');
    // Set submitting flag
    setIsSubmitting(true);
    // Begin verification try block
    try {
      // Dispatch challenge token and candidate TOTP code to backend verification endpoint
      const result = await authService.verifyMfa({
        mfaToken: challengeData.mfaToken,
        code: totpCode,
      });
      // Complete login on success
      handleSuccessfulAuth(result);
    // Catch verification errors (e.g. invalid code, clock drift, expired challenge)
    } catch (err) {
      // Extract error message
      const msg = err.message || 'Verification failed. Please check your code and try again.';
      // Display error banner
      setErrorMessage(msg);
      // If challenge expired or was locked due to excessive attempts, purge challenge from storage
      if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('locked')) {
        // Clear challenge
        sessionStorage.removeItem('uap_mfa_challenge');
      }
    // Clear submission loading flag
    } finally {
      // Reset submitting
      setIsSubmitting(false);
    }
  };

  // Form submission handler verifying 10-character backup recovery code
  const handleRecoverySubmit = async (e) => {
    // Prevent default browser form submission
    e.preventDefault();
    // Clean and trim recovery code
    const cleanCode = recoveryCode.trim();
    // Validate that code is complete
    if (!cleanCode || cleanCode.length < 10) {
      // Display validation error
      setErrorMessage('Please enter a complete backup recovery code.');
      // Return early
      return;
    }

    // Clear previous error
    setErrorMessage('');
    // Set submitting flag
    setIsSubmitting(true);
    // Begin recovery verification try block
    try {
      // Dispatch challenge token and recovery code to backend
      const result = await authService.recoveryMfa({
        mfaToken: challengeData.mfaToken,
        recoveryCode: cleanCode,
      });
      // Complete login on success
      handleSuccessfulAuth(result);
    // Catch verification errors
    } catch (err) {
      // Extract error message
      const msg = err.message || 'Recovery verification failed. Please try again.';
      // Display error banner
      setErrorMessage(msg);
      // Purge challenge if expired or locked
      if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('locked')) {
        // Clear challenge
        sessionStorage.removeItem('uap_mfa_challenge');
      }
    // Clear submission loading flag
    } finally {
      // Reset submitting
      setIsSubmitting(false);
    }
  };

  // Aborts current MFA challenge, clears challenge tokens, and returns to login view
  const handleCancel = () => {
    // Remove pending challenge from session storage
    sessionStorage.removeItem('uap_mfa_challenge');
    // Navigate to login page
    navigate('/auth/login', { replace: true });
  };

  // If designated post-login transition is active, render full-page branded transition loader
  if (postLoginTransition.active) {
    return (
      <PageLoader
        fullScreen
        branded
        minDuration={BRANDED_TRANSITION_MIN_DURATION_MS}
        user={postLoginTransition.user}
        role={postLoginTransition.role}
        message="MFA verified. Preparing workspace..."
        onComplete={() => {
          navigate(postLoginTransition.targetPath, { replace: true });
        }}
      />
    );
  }

  // Render MFA verification UI markup
  return (
    <div className="w-full max-w-lg mx-auto py-8 sm:py-12 px-4">
      <div className="rounded-3xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark shadow-warm-lg overflow-hidden p-6 sm:p-9 text-center">
        {/* Header Icon */}
        <div className="w-14 h-14 rounded-2xl bg-brand-peach/20 dark:bg-brand-peach/10 border border-brand-peach/30 flex items-center justify-center text-brand-terracotta mx-auto mb-4 shadow-warm-xs">
          {/* Render KeyRound icon in recovery mode, ShieldCheck in TOTP mode */}
          {isRecoveryMode ? (
            <KeyRound className="w-7 h-7" aria-hidden="true" />
          ) : (
            <ShieldCheck className="w-7 h-7" aria-hidden="true" />
          )}
        </div>

        {/* Pill badge */}
        <Badge variant="peach" size="sm" className="mb-2 uppercase tracking-wider text-[10px]">
          Two-Factor Authentication
        </Badge>

        {/* View heading */}
        <h1 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-slate-900 dark:text-slate-100 mb-1.5">
          {isRecoveryMode ? 'Use Backup Recovery Code' : 'Verify Your Identity'}
        </h1>

        {/* Instructions paragraph */}
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-5 max-w-sm mx-auto leading-relaxed">
          {isRecoveryMode ? (
            <>
              Enter one of your 10-character recovery codes generated during enrollment.
            </>
          ) : (
            <>
              Enter the 6-digit security code generated by your authenticator app
              {challengeData.email ? ` for ${challengeData.email}` : ''}.
            </>
          )}
        </p>

        {/* Error notice banner */}
        {errorMessage && (
          <Alert type="error" className="mb-4 text-left py-2.5 px-3 text-xs">
            {errorMessage}
          </Alert>
        )}

        {/* Form conditional rendering: TOTP mode or Recovery mode */}
        {!isRecoveryMode ? (
          /* TOTP Verification Form */
          <form onSubmit={handleTotpSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="totp-code"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2"
              >
                6-Digit Security Code
              </label>
              {/* Monospaced large numeric code input */}
              <input
                ref={totpInputRef}
                id="totp-code"
                name="totpCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                value={totpCode}
                onChange={handleTotpChange}
                placeholder="000000"
                disabled={isSubmitting}
                className="w-full max-w-xs mx-auto text-center font-mono text-2xl sm:text-3xl tracking-[0.4em] sm:tracking-[0.5em] py-2.5 px-4 bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border rounded-2xl focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 text-slate-900 dark:text-slate-100 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                aria-label="6-digit verification code"
                required
              />
            </div>

            {/* Submit verification button */}
            <Button
              type="submit"
              variant="primary"
              size="md"
              fullWidth
              isLoading={isSubmitting}
              disabled={totpCode.length !== 6}
              icon={ArrowRight}
              iconPosition="right"
              className="h-11 font-semibold"
            >
              Verify & Continue
            </Button>

            {/* Mode switch and cancellation links */}
            <div className="pt-2 flex flex-col items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setIsRecoveryMode(true);
                  setErrorMessage('');
                }}
                className="font-medium text-brand-primary hover:text-brand-primary-hover transition-colors cursor-pointer"
              >
                Don't have your device? Use a recovery code
              </button>

              <button
                type="button"
                onClick={handleCancel}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex items-center gap-1 mt-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Sign In</span>
              </button>
            </div>
          </form>
        ) : (
          /* Recovery Code Form */
          <form onSubmit={handleRecoverySubmit} className="space-y-4">
            <div>
              <label
                htmlFor="recovery-code"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2"
              >
                10-Character Recovery Code
              </label>
              {/* Monospaced uppercase recovery code input */}
              <input
                ref={recoveryInputRef}
                id="recovery-code"
                name="recoveryCode"
                type="text"
                maxLength={11}
                value={recoveryCode}
                onChange={handleRecoveryChange}
                placeholder="XXXXX-XXXXX"
                disabled={isSubmitting}
                className="w-full max-w-xs mx-auto text-center font-mono text-lg sm:text-xl tracking-widest py-2.5 px-4 bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border rounded-2xl focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 text-slate-900 dark:text-slate-100 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 uppercase"
                aria-label="Backup recovery code"
                required
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">
                Format: 10 alphanumeric characters (e.g., A1B2C-D3E4F).
              </p>
            </div>

            {/* Submit recovery code button */}
            <Button
              type="submit"
              variant="primary"
              size="md"
              fullWidth
              isLoading={isSubmitting}
              disabled={recoveryCode.length !== 11}
              icon={ArrowRight}
              iconPosition="right"
              className="h-11 font-semibold"
            >
              Use Recovery Code
            </Button>

            {/* Back to TOTP and cancellation links */}
            <div className="pt-2 flex flex-col items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setIsRecoveryMode(false);
                  setErrorMessage('');
                }}
                className="font-medium text-brand-primary hover:text-brand-primary-hover transition-colors flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Back to authenticator code</span>
              </button>

              <button
                type="button"
                onClick={handleCancel}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex items-center gap-1 mt-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Sign In</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// Export MfaVerify component
export default MfaVerify;
