// Import React core hooks for state management, component lifecycle, and DOM element referencing
import { useState, useEffect, useRef } from 'react';
// Import routing hooks for programmatic navigation and route history management
import { useNavigate, useLocation } from 'react-router-dom';
// Import toast notification utility for instant user feedback
import { toast } from 'react-toastify';
// Import authentication context hook to access active user and refresh profile
import { useAuth } from '../../hooks/useAuth';
// Import authentication service communicating with backend MFA endpoints
import { authService } from '../../services/auth.service';
// Import browser storage helper for updating rotated tokens
import { storage } from '../../utils/storage';
// Import reusable Button component
import Button from '../../components/ui/Button';
// Import reusable Alert component
import Alert from '../../components/ui/Alert';
// Import Lucide icons for visual affordance
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Download,
  Copy,
  Check,
  Eye,
  EyeOff,
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

/**
 * Dedicated Authenticator App Enrollment Page (RFC 6238 TOTP)
 * Provides authenticated users with a complete multi-step onboarding wizard:
 * 1. Generates ephemeral TOTP secret, otpauth:// URI, and scannable QR code.
 * 2. Displays masked manual setup key with controlled reveal toggle.
 * 3. Enforces 6-digit verification code check before enabling MFA on the account.
 * 4. Displays emergency backup recovery codes with download and copy options.
 */
const MfaSetup = () => {
  const { user, isAuthenticated, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Wizard step: 'scan' (QR code & code confirmation) or 'recovery' (backup codes presentation)
  const [step, setStep] = useState('scan');
  // Ephemeral setup payload: { secret, otpauthUri, qrCode, expiresInMinutes }
  const [setupData, setSetupData] = useState(null);
  // User-submitted 6-digit verification code
  const [code, setCode] = useState('');
  // Loading flags
  const [isLoadingSecret, setIsLoadingSecret] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  // Error states
  const [errorMessage, setErrorMessage] = useState('');
  // Controlled visibility for manual setup key
  const [showManualKey, setShowManualKey] = useState(false);
  // Feedback flags for copy buttons
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  // Backup recovery codes issued upon successful activation
  const [recoveryCodes, setRecoveryCodes] = useState([]);

  const codeInputRef = useRef(null);

  // Determine redirection target upon cancellation or completion
  const resolveFallbackPath = () => {
    if (location.state?.from) return location.state.from;
    const role = user?.role || 'student';
    if (role === 'admin') return '/admin/dashboard';
    if (role === 'instructor') return '/instructor/dashboard';
    return '/student/dashboard';
  };

  // 1. Fetch ephemeral TOTP enrollment secret and QR code on mount
  const fetchEnrollmentData = async () => {
    setIsLoadingSecret(true);
    setErrorMessage('');
    try {
      const data = await authService.setupMfa();
      setSetupData(data);
      setShowManualKey(false);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to initialize authenticator enrollment';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsLoadingSecret(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated && !storage.getToken()) {
      toast.info('Please sign in to configure your authenticator app.');
      navigate('/auth/login', { replace: true });
      return;
    }
    fetchEnrollmentData();
  }, [isAuthenticated, navigate]);

  // Focus input element when scan step is active
  useEffect(() => {
    if (step === 'scan' && !isLoadingSecret) {
      codeInputRef.current?.focus();
    }
  }, [step, isLoadingSecret]);

  // Handle manual setup key clipboard copy
  const handleCopyKey = () => {
    if (!setupData?.secret) return;
    navigator.clipboard.writeText(setupData.secret);
    setCopiedKey(true);
    toast.success('Setup key copied to clipboard');
    setTimeout(() => setCopiedKey(false), 2500);
  };

  // Handle recovery codes copy
  const handleCopyCodes = () => {
    if (!recoveryCodes.length) return;
    navigator.clipboard.writeText(recoveryCodes.join('\n'));
    setCopiedCodes(true);
    toast.success('Recovery codes copied to clipboard');
    setTimeout(() => setCopiedCodes(false), 2500);
  };

  // Handle downloading recovery codes backup file
  const handleDownloadCodes = () => {
    const email = user?.email || 'Account';
    const timestamp = new Date().toISOString();
    const content = [
      '=================================================================',
      'UNIFIED ASSESSMENT PLATFORM (UAP) - MULTI-FACTOR RECOVERY CODES',
      '=================================================================',
      `Account:   ${email}`,
      `Generated: ${timestamp}`,
      '',
      'INSTRUCTIONS:',
      '• Each recovery code can be used ONCE to access your account if',
      '  you lose access to your primary authenticator application.',
      '• Store these codes securely offline or in an encrypted password manager.',
      '• Do NOT share these codes with anyone.',
      '=================================================================',
      '',
      ...recoveryCodes.map((c, idx) => `[${idx + 1}]  ${c}`),
      '',
      '=================================================================',
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `uap-mfa-recovery-codes-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.info('Recovery codes saved to text file.');
  };

  // Submit initial 6-digit confirmation code
  const handleVerifyAndActivate = async (e) => {
    e.preventDefault();
    if (code.length !== 6) {
      setErrorMessage('Please enter the 6-digit code from your authenticator app.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage('');
    try {
      const response = await authService.setupConfirmMfa(code);
      const newAccessToken = response?.accessToken || response?.data?.accessToken;
      if (newAccessToken) {
        storage.setToken(newAccessToken);
      }
      const issuedCodes = response?.recoveryCodes || response?.data?.recoveryCodes || [];
      setRecoveryCodes(issuedCodes);
      setStep('recovery');
      toast.success('Authenticator app verified successfully!');
      await refreshProfile?.();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Invalid verification code. Please check your authenticator app.';
      setErrorMessage(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  // Complete onboarding and return to dashboard
  const handleFinish = async () => {
    toast.success('Two-factor authentication is active on your account.');
    await refreshProfile?.();
    navigate(resolveFallbackPath(), { replace: true });
  };

  // Cancel and safely exit
  const handleCancel = () => {
    navigate(resolveFallbackPath(), { replace: true });
  };

  return (
    <div className="w-full max-w-lg mx-auto py-4 sm:py-6 px-2.5 xs:px-4 sm:px-6">
      {/* Brand Header */}
      <div className="text-center mb-5 sm:mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 xs:w-14 xs:h-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-3 shadow-warm-xs border border-amber-200 dark:border-amber-800/40">
          <ShieldCheck className="w-7 h-7 xs:w-8 xs:h-8" />
        </div>
        <h1 className="text-xl xs:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-display">
          {step === 'scan' ? 'Set up Authenticator App' : 'Authenticator App Active'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
          {step === 'scan'
            ? 'Scan the QR code with your authenticator application to protect your examinations and account.'
            : 'Save your emergency recovery codes to complete enrollment.'}
        </p>
      </div>

      {/* Main Card Container */}
      <div className="bg-white dark:bg-surface-dark rounded-2xl border border-surface-light-border dark:border-surface-dark-border shadow-warm-sm p-4 xs:p-6 space-y-5 sm:space-y-6">
        {/* Loading State */}
        {isLoadingSecret && (
          <div className="py-12 flex flex-col items-center justify-center space-y-3 text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin text-brand-primary" />
            <p className="text-xs font-medium">Generating your unique authenticator credentials...</p>
          </div>
        )}

        {/* API Error State on Initialization */}
        {!isLoadingSecret && errorMessage && !setupData && (
          <div className="space-y-4">
            <Alert variant="danger" dismissible={false}>
              {errorMessage}
            </Alert>
            <div className="flex justify-center gap-3">
              <Button variant="outline" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={fetchEnrollmentData} icon={RefreshCw}>
                Retry Setup
              </Button>
            </div>
          </div>
        )}

        {/* STEP 1: SCAN QR CODE & ENTER 6-DIGIT CODE */}
        {!isLoadingSecret && step === 'scan' && setupData && (
          <div className="space-y-5">
            {/* Instruction Banner */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border text-xs text-slate-600 dark:text-slate-300 space-y-1">
              <p className="font-semibold text-slate-800 dark:text-slate-100">Step 1: Scan with Authenticator</p>
              <p>
                Open Google Authenticator, Microsoft Authenticator, Authy, or 1Password on your mobile device and scan the QR code below.
              </p>
            </div>

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center p-5 bg-white rounded-2xl border border-slate-200 dark:border-slate-700 shadow-warm-xs">
              {setupData.qrCode ? (
                <img
                  src={setupData.qrCode}
                  alt="Authenticator App QR Code"
                  className="w-48 h-48 object-contain"
                  data-testid="mfa-qr-code-image"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-slate-400 text-xs">
                  Loading QR Code...
                </div>
              )}
            </div>

            {/* Manual Secret Key Fallback with Masking / Reveal Control */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Can't scan? Enter setup key manually
                </span>
                <button
                  type="button"
                  onClick={() => setShowManualKey((prev) => !prev)}
                  className="text-xs text-brand-primary hover:text-brand-primary-hover font-medium flex items-center gap-1 focus:outline-none"
                  aria-label={showManualKey ? 'Mask setup key' : 'Reveal setup key'}
                >
                  {showManualKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showManualKey ? 'Mask Key' : 'Reveal Key'}</span>
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 bg-white dark:bg-surface-dark p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                <code
                  className="text-xs font-mono font-bold text-slate-800 dark:text-slate-100 break-all select-all tracking-wider"
                  data-testid="manual-setup-key"
                  aria-label="Authenticator setup key"
                >
                  {showManualKey
                    ? setupData.secret
                    : (setupData.secret ? `${setupData.secret.slice(0, 4)} •••• •••• ${setupData.secret.slice(-4)}` : '••••••••••••••••')}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyKey}
                  icon={copiedKey ? Check : Copy}
                  className="flex-shrink-0"
                  aria-label="Copy setup key to clipboard"
                >
                  {copiedKey ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            {/* Step 2: Code Verification Form */}
            <form onSubmit={handleVerifyAndActivate} className="space-y-4 pt-2 border-t border-surface-light-border dark:border-surface-dark-border">
              <div>
                <label
                  htmlFor="totp-setup-code-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Step 2: Enter 6-Digit Code from Authenticator App
                </label>
                <input
                  id="totp-setup-code-input"
                  ref={codeInputRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  aria-label="Six-digit code from authenticator app"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                    if (errorMessage) setErrorMessage('');
                  }}
                  className="w-full text-center tracking-[0.4em] font-mono font-bold text-xl h-12 px-3 rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  autoFocus
                />
              </div>

              {errorMessage && (
                <Alert variant="danger" dismissible={false}>
                  {errorMessage}
                </Alert>
              )}

              <div className="flex justify-between items-center gap-3 pt-2">
                <Button variant="outline" size="sm" onClick={handleCancel} disabled={isVerifying} icon={ArrowLeft}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isVerifying}
                  disabled={code.length !== 6}
                >
                  Verify & Activate
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 2: ENROLLMENT CONFIRMATION & RECOVERY CODES DISPLAY */}
        {step === 'recovery' && (
          <div className="space-y-5">
            {/* Activation Success Banner */}
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 flex items-start space-x-3.5">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-900 dark:text-emerald-200 space-y-1.5">
                <p className="font-bold text-sm">Authenticator App Enrolled Successfully!</p>
                <p className="leading-relaxed">
                  Two-factor authentication is now active on your account. At future logins, enter your account password first, then open your authenticator app to enter the current six-digit verification code.
                </p>
              </div>
            </div>

            {/* Warning Banner */}
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 flex items-start space-x-3.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <p className="font-bold">Save your emergency backup recovery codes right now.</p>
                <p className="leading-relaxed">
                  If you lose your device or cannot access your authenticator app, these recovery codes are the <strong>only way</strong> to regain access to your account. Each code can only be used once.
                </p>
              </div>
            </div>

            {/* Recovery Codes Grid */}
            <div
              data-testid="recovery-codes-grid"
              className="grid grid-cols-1 xs:grid-cols-2 gap-2 sm:gap-2.5 p-2.5 sm:p-3.5 bg-slate-50 dark:bg-surface-dark-muted rounded-xl border border-surface-light-border dark:border-surface-dark-border font-mono text-xs"
            >
              {recoveryCodes.map((c, idx) => (
                <div
                  key={idx}
                  data-testid="recovery-code-item"
                  className="p-2.5 bg-white dark:bg-surface-dark rounded-lg border border-surface-light-border dark:border-surface-dark-border text-center font-bold text-slate-800 dark:text-slate-200 select-all"
                >
                  <span className="text-slate-400 text-[10px] mr-1.5 font-normal">#{idx + 1}</span>
                  {c}
                </div>
              ))}
            </div>

            {/* Actions: Download & Copy */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyCodes}
                icon={copiedCodes ? Check : Copy}
              >
                {copiedCodes ? 'Codes Copied' : 'Copy All'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadCodes}
                icon={Download}
              >
                Download (.txt)
              </Button>
            </div>

            {/* Complete Setup Button */}
            <div className="pt-3 border-t border-surface-light-border dark:border-surface-dark-border flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={handleFinish}
                icon={Check}
              >
                I Have Saved My Recovery Codes
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MfaSetup;
