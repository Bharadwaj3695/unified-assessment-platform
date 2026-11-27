// Import React core library and hooks for state, effect lifecycles, and DOM input element references
import { useState, useEffect, useRef } from 'react';
// Import routing hooks from react-router-dom for programmatic navigation, route location inspection, and links
import { useNavigate, useLocation } from 'react-router-dom';
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
// Import icons from lucide-react for security shields, keys, arrows, email, and mode toggles
import { ShieldCheck, KeyRound, Mail, ArrowRight, ArrowLeft, RotateCcw, RefreshCw } from 'lucide-react';

/**
 * Masks an email address for safe display in the verification screen.
 * Never exposes the full email unnecessarily (e.g., student@uap.edu -> s***t@uap.edu).
 */
const maskEmailAddress = (email) => {
  if (!email || typeof email !== 'string') return '';
  const parts = email.trim().split('@');
  if (parts.length !== 2) return email;
  const [local, domain] = parts;
  if (local.length <= 1) {
    return `*@${domain}`;
  }
  if (local.length === 2) {
    return `${local[0]}*@${domain}`;
  }
  const maskedLocal = `${local[0]}${'*'.repeat(Math.min(local.length - 2, 4))}${local[local.length - 1]}`;
  return `${maskedLocal}@${domain}`;
};

// Multi-Factor Authentication verification view validating TOTP codes, Email OTP, or recovery codes
const MfaVerify = () => {
  // Destructure method to establish active session from AuthContext
  const { completeMfaLogin } = useAuth();
  // Initialize navigate function for route redirection
  const navigate = useNavigate();
  // Location hook to read route state passed from login or Google callback
  const location = useLocation();

  // Active verification mode: 'totp' (authenticator app) | 'email' (Email OTP) | 'recovery' (backup code)
  const [mode, setMode] = useState('totp'); // 'totp' | 'email' | 'recovery'
  // State storing the 6-digit numeric TOTP code entered by user
  const [totpCode, setTotpCode] = useState('');
  // State storing the 6-digit numeric Email OTP code entered by user
  const [emailCode, setEmailCode] = useState('');
  // State storing the formatted 10-character backup recovery code entered by user
  const [recoveryCode, setRecoveryCode] = useState('');

  // Email OTP workflow state
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);

  // Error message string returned from failed verification attempts
  const [errorMessage, setErrorMessage] = useState('');
  // Submitting flag disabling inputs and showing button spinner during network verification
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Challenge payload object containing intermediate mfaToken, email, target route, user role, and allowedMethods
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
  // Reference to Email OTP code text input element for autofocus
  const emailInputRef = useRef(null);
  // Reference to recovery code text input element for autofocus
  const recoveryInputRef = useRef(null);

  // Retrieve challenge token from location.state or sessionStorage
  useEffect(() => {
    let token = location.state?.mfaToken;
    let email = location.state?.email || '';
    let from = location.state?.from || null;
    let role = null;
    let allowedMethods = location.state?.allowedMethods || null;
    let defaultMethod = location.state?.defaultMethod || null;
    let emailOtpSentInitial = Boolean(location.state?.emailOtpSent);
    let initialMaskedEmail = location.state?.maskedEmail || '';

    if (!token) {
      try {
        const stored = sessionStorage.getItem('uap_mfa_challenge');
        if (stored) {
          const parsed = JSON.parse(stored);
          token = parsed.mfaToken;
          email = parsed.email || '';
          from = parsed.from || null;
          role = parsed.role || null;
          allowedMethods = parsed.allowedMethods || null;
          defaultMethod = parsed.defaultMethod || defaultMethod;
          if (parsed.emailOtpSent !== undefined) {
            emailOtpSentInitial = Boolean(parsed.emailOtpSent);
          }
          if (parsed.maskedEmail) {
            initialMaskedEmail = parsed.maskedEmail;
          }
        }
      } catch (err) {
        console.warn('Failed to parse MFA challenge from storage', err);
      }
    }

    if (!token) {
      toast.error('No pending MFA challenge found. Please sign in again.');
      navigate('/auth/login', { replace: true });
      return;
    }

    // Default allowed methods if not specified: TOTP, Email OTP, and Recovery codes
    const resolvedMethods = Array.isArray(allowedMethods) && allowedMethods.length > 0
      ? allowedMethods
      : ['totp', 'email_otp', 'recovery_code'];

    const hasTotp = resolvedMethods.includes('totp');
    const hasEmail = resolvedMethods.includes('email_otp');

    // Automatically set initial mode to email if defaultMethod is email_otp or totp is not available
    if ((defaultMethod === 'email_otp' || !hasTotp) && hasEmail) {
      setMode('email');
    }

    if (emailOtpSentInitial) {
      setEmailOtpSent(true);
      setResendCountdown(60);
    }

    setChallengeData({
      mfaToken: token,
      email,
      from,
      role,
      allowedMethods: resolvedMethods,
    });
    setMaskedEmail(initialMaskedEmail || maskEmailAddress(email));
  }, [location.state, navigate]);

  // Resend countdown timer effect for Email OTP
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => {
      setResendCountdown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  // Focus appropriate input on mount or mode toggle
  useEffect(() => {
    if (mode === 'recovery') {
      recoveryInputRef.current?.focus();
    } else if (mode === 'email') {
      emailInputRef.current?.focus();
    } else {
      totpInputRef.current?.focus();
    }
  }, [mode]);

  // Check whether Email OTP is an authorized method under institutional policy
  const isEmailOtpAuthorized = Boolean(
    challengeData?.allowedMethods?.includes('email_otp')
  );

  // Input change handler for TOTP code enforcing numeric digits and maximum length of 6
  const handleTotpChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setTotpCode(val);
    if (errorMessage) setErrorMessage('');
  };

  // Input change handler for Email OTP code enforcing numeric digits and maximum length of 6
  const handleEmailCodeChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setEmailCode(val);
    if (errorMessage) setErrorMessage('');
  };

  // Input change handler for backup recovery code formatting into standard XXXXX-XXXXX structure
  const handleRecoveryChange = (e) => {
    const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    let formatted = raw;
    if (raw.length > 5) {
      formatted = `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
    }
    setRecoveryCode(formatted);
    if (errorMessage) setErrorMessage('');
  };

  // Request a fresh 6-digit Email OTP from backend
  const handleRequestEmailOtp = async () => {
    if (!challengeData?.mfaToken) return;
    setErrorMessage('');
    setIsSendingEmail(true);
    try {
      const response = await authService.sendMfaEmailOtp({
        mfaToken: challengeData.mfaToken,
      });
      setEmailOtpSent(true);
      if (response?.maskedEmail) {
        setMaskedEmail(response.maskedEmail);
      }
      const cooldown = response?.resendCooldown || 60;
      setResendCountdown(cooldown);
      toast.success(response?.message || 'Verification code sent to your email.');
    } catch (err) {
      const msg = err.message || 'Failed to dispatch verification code. Please try again.';
      setErrorMessage(msg);
      // If institutional policy does not permit email OTP, inform user
      if (err.status === 403 || msg.toLowerCase().includes('institutional security policy')) {
        toast.error('Email OTP is restricted by institutional policy. Please use an authenticator app.');
      }
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Switch to Email OTP mode and trigger code dispatch if not already sent
  const handleSwitchToEmailMode = () => {
    setMode('email');
    setErrorMessage('');
    if (!emailOtpSent && resendCountdown === 0) {
      handleRequestEmailOtp();
    }
  };

  // Finalizes authentication session after verified code and redirects to dashboard or original target
  const handleSuccessfulAuth = (authPayload) => {
    sessionStorage.removeItem('uap_mfa_challenge');
    const user = completeMfaLogin(authPayload);
    toast.success(`Welcome back, ${user.name}!`);

    const targetFrom = challengeData?.from;
    let targetPath = '/student/dashboard';
    if (targetFrom && targetFrom.startsWith(`/${user.role}`)) {
      targetPath = targetFrom;
    } else if (user.role === 'admin') {
      targetPath = '/admin/dashboard';
    } else if (user.role === 'instructor') {
      targetPath = '/instructor/dashboard';
    } else {
      targetPath = '/student/dashboard';
    }

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
    e.preventDefault();
    if (!totpCode || totpCode.length !== 6) {
      setErrorMessage('Please enter a valid 6-digit verification code.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const result = await authService.verifyMfa({
        mfaToken: challengeData.mfaToken,
        code: totpCode,
      });
      handleSuccessfulAuth(result);
    } catch (err) {
      const msg = err.message || 'Verification failed. Please check your code and try again.';
      setErrorMessage(msg);
      if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('locked')) {
        sessionStorage.removeItem('uap_mfa_challenge');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Form submission handler verifying 6-digit Email OTP code against backend endpoint
  const handleEmailOtpSubmit = async (e) => {
    e.preventDefault();
    if (!emailCode || emailCode.length !== 6) {
      setErrorMessage('Please enter a valid 6-digit verification code.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const result = await authService.verifyMfaEmailOtp({
        mfaToken: challengeData.mfaToken,
        code: emailCode,
      });
      handleSuccessfulAuth(result);
    } catch (err) {
      const msg = err.message || 'Email verification failed. Please check your code and try again.';
      setErrorMessage(msg);
      if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('locked')) {
        sessionStorage.removeItem('uap_mfa_challenge');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Form submission handler verifying 10-character backup recovery code
  const handleRecoverySubmit = async (e) => {
    e.preventDefault();
    const cleanCode = recoveryCode.trim();
    if (!cleanCode || cleanCode.length < 10) {
      setErrorMessage('Please enter a complete backup recovery code.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const result = await authService.recoveryMfa({
        mfaToken: challengeData.mfaToken,
        recoveryCode: cleanCode,
      });
      handleSuccessfulAuth(result);
    } catch (err) {
      const msg = err.message || 'Recovery verification failed. Please try again.';
      setErrorMessage(msg);
      if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('locked')) {
        sessionStorage.removeItem('uap_mfa_challenge');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Aborts current MFA challenge, clears challenge tokens, and returns to login view
  const handleCancel = () => {
    sessionStorage.removeItem('uap_mfa_challenge');
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
    <div className="w-full max-w-lg mx-auto py-4 xs:py-6 sm:py-10 px-2.5 xs:px-4">
      <div className="rounded-3xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark shadow-warm-lg overflow-hidden p-4 xs:p-6 sm:p-9 text-center">
        {/* Header Icon */}
        <div className="w-14 h-14 rounded-2xl bg-brand-peach/20 dark:bg-brand-peach/10 border border-brand-peach/30 flex items-center justify-center text-brand-terracotta mx-auto mb-4 shadow-warm-xs">
          {mode === 'recovery' ? (
            <KeyRound className="w-7 h-7" aria-hidden="true" />
          ) : mode === 'email' ? (
            <Mail className="w-7 h-7" aria-hidden="true" />
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
          {mode === 'recovery'
            ? 'Use Backup Recovery Code'
            : mode === 'email'
            ? 'Verify with Email Code'
            : 'Verify Your Identity'}
        </h1>

        {/* Instructions paragraph */}
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-5 max-w-sm mx-auto leading-relaxed">
          {mode === 'recovery' ? (
            <>Enter one of your 10-character recovery codes generated during enrollment.</>
          ) : mode === 'email' ? (
            <>
              {emailOtpSent ? (
                <>
                  We sent a 6-digit code to{' '}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {maskedEmail || 'your verified email address'}
                  </span>
                  . Enter it below to sign in.
                </>
              ) : (
                <>
                  A single-use 6-digit verification code will be sent to{' '}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {maskedEmail || 'your registered email'}
                  </span>
                  .
                </>
              )}
            </>
          ) : (
            <>
              Enter the 6-digit security code generated by your authenticator app
              {maskedEmail ? ` for ${maskedEmail}` : ''}.
            </>
          )}
        </p>

        {/* Error notice banner */}
        {errorMessage && (
          <Alert type="error" className="mb-4 text-left py-2.5 px-3 text-xs">
            {errorMessage}
          </Alert>
        )}

        {/* --- 1. TOTP Verification Mode --- */}
        {mode === 'totp' && (
          <form onSubmit={handleTotpSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="totp-code"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2"
              >
                6-Digit Authenticator Code
              </label>
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
                className="w-full max-w-xs mx-auto text-center font-mono text-xl xs:text-2xl sm:text-3xl tracking-[0.25em] xs:tracking-[0.4em] sm:tracking-[0.5em] py-2.5 px-2 xs:px-4 bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border rounded-2xl focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 text-slate-900 dark:text-slate-100 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                aria-label="6-digit authenticator verification code"
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              fullWidth
              isLoading={isSubmitting}
              loadingText="Verifying Code..."
              disabled={totpCode.length !== 6}
              icon={ArrowRight}
              iconPosition="right"
              className="h-11 font-semibold"
            >
              Verify & Continue
            </Button>

            {/* Alternative options */}
            <div className="pt-3 flex flex-col items-center gap-2.5 text-xs">
              {isEmailOtpAuthorized && (
                <button
                  type="button"
                  onClick={handleSwitchToEmailMode}
                  disabled={isSubmitting}
                  className="font-medium text-brand-primary hover:text-brand-primary-hover transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Send Verification to Email</span>
                </button>
              )}

              {challengeData?.allowedMethods?.includes('recovery_code') && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('recovery');
                    setErrorMessage('');
                  }}
                  className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
                >
                  Don't have your device? Use a recovery code
                </button>
              )}

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

        {/* --- 2. Email OTP Verification Mode --- */}
        {mode === 'email' && (
          <form onSubmit={handleEmailOtpSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email-code"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2"
              >
                6-Digit Email Verification Code
              </label>
              <input
                ref={emailInputRef}
                id="email-code"
                name="emailCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                value={emailCode}
                onChange={handleEmailCodeChange}
                placeholder="000000"
                disabled={isSubmitting || isSendingEmail}
                className="w-full max-w-xs mx-auto text-center font-mono text-2xl sm:text-3xl tracking-[0.4em] sm:tracking-[0.5em] py-2.5 px-4 bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border rounded-2xl focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 text-slate-900 dark:text-slate-100 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                aria-label="6-digit email verification code"
                required
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">
                The code expires in 5 minutes. Check your inbox and spam folder.
              </p>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              fullWidth
              isLoading={isSubmitting}
              loadingText="Verifying Code..."
              disabled={emailCode.length !== 6 || isSendingEmail}
              icon={ArrowRight}
              iconPosition="right"
              className="h-11 font-semibold"
            >
              Verify Email Code
            </Button>

            {/* Resend button and countdown */}
            <div className="pt-1 flex items-center justify-center">
              {resendCountdown > 0 ? (
                <span className="text-xs text-slate-400">
                  Resend code in <strong className="font-mono">{resendCountdown}s</strong>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestEmailOtp}
                  disabled={isSendingEmail || isSubmitting}
                  className="text-xs font-medium text-brand-primary hover:text-brand-primary-hover flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSendingEmail ? 'animate-spin' : ''}`} />
                  <span>{isSendingEmail ? 'Sending code...' : 'Resend verification code'}</span>
                </button>
              )}
            </div>

            {/* Navigation and alternative modes */}
            <div className="pt-2 flex flex-col items-center gap-2 text-xs border-t border-slate-100 dark:border-slate-800">
              {challengeData?.allowedMethods?.includes('totp') && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('totp');
                    setErrorMessage('');
                  }}
                  className="font-medium text-brand-primary hover:text-brand-primary-hover transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Back to authenticator app code</span>
                </button>
              )}

              {challengeData?.allowedMethods?.includes('recovery_code') && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('recovery');
                    setErrorMessage('');
                  }}
                  className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
                >
                  Use a backup recovery code
                </button>
              )}

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

        {/* --- 3. Backup Recovery Code Mode --- */}
        {mode === 'recovery' && (
          <form onSubmit={handleRecoverySubmit} className="space-y-4">
            <div>
              <label
                htmlFor="recovery-code"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2"
              >
                10-Character Recovery Code
              </label>
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

            <Button
              type="submit"
              variant="primary"
              size="md"
              fullWidth
              isLoading={isSubmitting}
              loadingText="Verifying Recovery Key..."
              disabled={recoveryCode.length !== 11}
              icon={ArrowRight}
              iconPosition="right"
              className="h-11 font-semibold"
            >
              Use Recovery Code
            </Button>

            {/* Back to other modes */}
            <div className="pt-2 flex flex-col items-center gap-2 text-xs">
              {challengeData?.allowedMethods?.includes('totp') && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('totp');
                    setErrorMessage('');
                  }}
                  className="font-medium text-brand-primary hover:text-brand-primary-hover transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Back to authenticator code</span>
                </button>
              )}

              {isEmailOtpAuthorized && (
                <button
                  type="button"
                  onClick={handleSwitchToEmailMode}
                  className="font-medium text-brand-primary hover:text-brand-primary-hover transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Verify with Email code instead</span>
                </button>
              )}

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
