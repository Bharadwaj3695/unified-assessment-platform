// Import React core library and state hook for tracking multi-step modal dialogs
import { useState } from 'react';
// Import toast notification utility for displaying alerts and feedback
import { toast } from 'react-toastify';
// Import custom useAuth hook to access active user profile and profile refresh action
import { useAuth } from '../../hooks/useAuth';
// Import authentication service layer communicating with backend MFA setup, verify, disable, and regen endpoints
import { authService } from '../../services/auth.service';
// Import browser storage helper for updating rotated access tokens
import { storage } from '../../utils/storage';
// Import Card container component
import Card from '../ui/Card';
// Import standard Button component
import Button from '../ui/Button';
// Import Badge component for status tags
import Badge from '../ui/Badge';
// Import reusable Input component
import Input from '../ui/Input';
// Import accessible Modal dialog component
import Modal from '../ui/Modal';
// Import reusable Alert component
import Alert from '../ui/Alert';
// Import Lucide icons used across modals, copy buttons, status banners, and download links
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Download,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle} from 'lucide-react';

// Profile section component providing end-to-end self-service management of Two-Factor Authentication (RFC 6238 TOTP)
const TwoFactorAuthSection = ({ profile, onProfileUpdate }) => {
  // Destructure authenticated user profile and refreshProfile method from AuthContext
  const { user, refreshProfile } = useAuth();

  // Derive MFA enabled state from profile or authenticated user
  const isMfaEnabled = Boolean(profile?.mfaEnabled ?? user?.mfaEnabled);
  // Check if account authenticates via Google OAuth (passwordless)
  const isGoogleAccount = user?.authProvider === 'google';
  // Check if current user is a student (MFA mandatory for students)
  const isStudent = (profile?.role || user?.role) === 'student';

  // --- Setup Modal State ---
  // Modal visibility flag for MFA onboarding setup wizard
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  // Onboarding wizard active step: 'scan' (QR code & code entry) or 'recovery' (display backup codes)
  const [setupStep, setSetupStep] = useState('scan'); // 'scan' | 'recovery'
  // Intermediate setup payload returned by backend: { secret, otpauthUri, qrCode }
  const [setupData, setSetupData] = useState(null); // { secret, otpauthUri, qrCode }
  // Verification code string entered by user during setup confirmation
  const [setupCode, setSetupCode] = useState('');
  // Loading flag for initial setup key generation request
  const [isInitiatingSetup, setIsInitiatingSetup] = useState(false);
  // Loading flag for verification code check request
  const [isVerifyingSetup, setIsVerifyingSetup] = useState(false);
  // Error string displayed within setup modal
  const [setupError, setSetupError] = useState('');
  // Newly generated 8 backup recovery codes returned after successful TOTP activation
  const [initialRecoveryCodes, setInitialRecoveryCodes] = useState([]);
  // Copy feedback state for manual Base32 secret key
  const [copiedSecret, setCopiedSecret] = useState(false);
  // Copy feedback state for setup recovery codes array
  const [copiedSetupCodes, setCopiedSetupCodes] = useState(false);

  // --- Disable Modal State ---
  // Modal visibility flag for disabling 2FA confirmation dialog
  const [isDisableModalOpen, setIsDisableModalOpen] = useState(false);
  // Password credential entered to confirm disabling 2FA
  const [disablePassword, setDisablePassword] = useState('');
  // Current 6-digit TOTP code entered if disabling on a passwordless Google account
  const [disableCode, setDisableCode] = useState('');
  // Loading flag while disable request is in flight
  const [isDisabling, setIsDisabling] = useState(false);
  // Error string displayed within disable modal
  const [disableError, setDisableError] = useState('');

  // --- Regenerate Recovery Codes Modal State ---
  // Modal visibility flag for regenerating backup recovery codes authorization prompt
  const [isRegenModalOpen, setIsRegenModalOpen] = useState(false);
  // Password credential entered to authorize code rotation
  const [regenPassword, setRegenPassword] = useState('');
  // Current TOTP code entered to authorize code rotation for Google SSO users
  const [regenCode, setRegenCode] = useState('');
  // Loading flag while regeneration request is processing
  const [isRegenerating, setIsRegenerating] = useState(false);
  // Error string displayed within regeneration authorization modal
  const [regenError, setRegenError] = useState('');
  // Modal visibility flag displaying the fresh set of rotated recovery codes
  const [showRegenCodesModal, setShowRegenCodesModal] = useState(false);
  // Fresh array of 8 newly generated recovery codes
  const [newRecoveryCodes, setNewRecoveryCodes] = useState([]);
  // Copy feedback state for rotated recovery codes
  const [copiedRegenCodes, setCopiedRegenCodes] = useState(false);

  // Helper: Download Recovery Codes as a .txt file
  // Generates and triggers browser download of an authoritative backup text file containing recovery codes
  const handleDownloadCodes = (codes) => {
    // Resolve user email
    const email = profile?.email || user?.email || 'User';
    // Current ISO timestamp string
    const timestamp = new Date().toISOString();
    // Assemble formatted plaintext document with security instructions and numbered recovery codes
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
      '• Do NOT share these codes with anyone or store them in plaintext on public devices.',
      '=================================================================',
      '',
      ...codes.map((code, idx) => `[${idx + 1}]  ${code}`),
      '',
      '=================================================================',
    ].join('\n');

    // Create browser Blob containing UTF-8 plaintext content
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    // Generate temporary object URL referencing Blob in memory
    const url = URL.createObjectURL(blob);
    // Create ephemeral anchor element to programmatically trigger download
    const link = document.createElement('a');
    // Set anchor href to Blob URL
    link.href = url;
    // Set file download name with current YYYY-MM-DD date stamp
    link.download = `uap-mfa-recovery-codes-${new Date().toISOString().slice(0, 10)}.txt`;
    // Append anchor to document body
    document.body.appendChild(link);
    // Programmatically click anchor to trigger browser download prompt
    link.click();
    // Remove temporary anchor from DOM
    document.body.removeChild(link);
    // Release Blob object URL memory allocation
    URL.revokeObjectURL(url);
    // Notify user with informational toast
    toast.info('Recovery codes downloaded to file.');
  };

  // Helper: Copy array of codes to clipboard
  // Copies all recovery codes separated by newlines to user's system clipboard
  const handleCopyCodes = (codes, setCopiedState) => {
    // Return early if codes array is empty
    if (!codes || codes.length === 0) return;
    // Write joined codes to navigator clipboard
    navigator.clipboard.writeText(codes.join('\n'));
    // Set copied state boolean to show checkmark feedback
    setCopiedState(true);
    // Notify user with success toast
    toast.success('Recovery codes copied to clipboard');
    // Reset checkmark icon back to copy icon after 2.5 seconds
    setTimeout(() => setCopiedState(false), 2500);
  };

  // Helper: Copy secret
  // Copies Base32 secret string to clipboard for manual authenticator enrollment
  const handleCopySecret = (secret) => {
    // Return if secret missing
    if (!secret) return;
    // Copy secret string
    navigator.clipboard.writeText(secret);
    // Set copied feedback flag
    setCopiedSecret(true);
    // Display success toast
    toast.success('MFA secret copied to clipboard');
    // Reset copy feedback after 2.5 seconds
    setTimeout(() => setCopiedSecret(false), 2500);
  };

  // 1. INITIATE MFA SETUP
  // Requests new TOTP secret and QR code from backend and opens setup onboarding modal
  const handleStartSetup = async () => {
    // Begin setup initialization try block
    try {
      // Set initiating loading flag
      setIsInitiatingSetup(true);
      // Clear previous error
      setSetupError('');
      // Request secret, otpauth URI, and QR data URL from backend
      const data = await authService.setupMfa();
      // Store setup payload in state
      setSetupData(data);
      // Set initial onboarding step to scan
      setSetupStep('scan');
      // Reset code input
      setSetupCode('');
      // Clear recovery codes array
      setInitialRecoveryCodes([]);
      // Open setup modal
      setIsSetupModalOpen(true);
    // Catch setup errors
    } catch (err) {
      // Display error toast
      toast.error(err.message || 'Failed to initiate MFA setup');
    // Reset initiating loading flag
    } finally {
      // Clear loading state
      setIsInitiatingSetup(false);
    }
  };

  // 2. CONFIRM MFA SETUP
  // Submits the first 6-digit TOTP code generated by user's authenticator app to finalize MFA activation
  const handleConfirmSetup = async (e) => {
    // Prevent default form submit
    e.preventDefault();
    // Validate 6-digit code format
    if (!setupCode || setupCode.length !== 6) {
      // Set error message
      setSetupError('Please enter a valid 6-digit verification code.');
      // Return early
      return;
    }

    // Begin confirmation try block
    try {
      // Set verifying loading flag
      setIsVerifyingSetup(true);
      // Clear error message
      setSetupError('');
      // Dispatch 6-digit code to backend confirmation endpoint
      const response = await authService.setupConfirmMfa(setupCode);
      // Extract refreshed access token carrying updated mfaEnabled claim
      const newAccessToken = response?.accessToken || response?.data?.accessToken;
      // Persist fresh access token to browser storage
      if (newAccessToken) {
        // Update stored token
        storage.setToken(newAccessToken);
      }
      // Extract newly generated 8 backup recovery codes
      const codes = response?.recoveryCodes || response?.data?.recoveryCodes || [];
      // Store recovery codes in state
      setInitialRecoveryCodes(codes);
      // Transition wizard step to recovery codes display
      setSetupStep('recovery');
      // Display success toast prompting user to store recovery codes
      toast.success('MFA verified successfully! Please save your recovery codes.');
    // Catch invalid code errors
    } catch (err) {
      // Extract error message
      const msg = err.message || 'Invalid verification code. Please check your authenticator app.';
      // Display error banner in modal
      setSetupError(msg);
    // Reset verifying loading flag
    } finally {
      // Clear loading state
      setIsVerifyingSetup(false);
    }
  };

  // Close Setup Modal (after user acknowledges recovery codes)
  // Handles modal dismissal and triggers profile sync once onboarding completes
  const handleCloseSetupModal = async () => {
    // If user completed verification and viewed recovery codes
    if (setupStep === 'recovery') {
      // Close modal
      setIsSetupModalOpen(false);
      // Reset setup data
      setSetupData(null);
      // Reset step to scan
      setSetupStep('scan');
      // Clear code
      setSetupCode('');
      // Clear recovery codes
      setInitialRecoveryCodes([]);
      // Display activation confirmation toast
      toast.success('Two-factor authentication is now active.');

      // Refresh AuthContext and Profile after user has saved recovery codes
      await refreshProfile?.();
      onProfileUpdate?.();
    // If user cancelled before completing verification
    } else {
      // Close modal
      setIsSetupModalOpen(false);
      // Reset setup data
      setSetupData(null);
      // Clear code
      setSetupCode('');
    }
  };

  // 3. DISABLE MFA
  // Submits password or TOTP code to disable Two-Factor Authentication on the account
  const handleDisableMfa = async (e) => {
    // Prevent default form submit
    e.preventDefault();
    if (isStudent) {
      toast.error('MFA is mandatory for student accounts and cannot be disabled.');
      setIsDisableModalOpen(false);
      return;
    }
    // Begin disable try block
    try {
      // Set disabling loading flag
      setIsDisabling(true);
      // Clear error message
      setDisableError('');

      // Dispatch disable payload to backend
      const response = await authService.disableMfa({
        password: disablePassword || undefined,
        code: disableCode || undefined,
      });

      // Extract new access token reflecting mfaEnabled: false
      const newAccessToken = response?.accessToken || response?.data?.accessToken;
      // Persist fresh access token
      if (newAccessToken) {
        // Update stored token
        storage.setToken(newAccessToken);
      }

      // Display success toast
      toast.success('Two-factor authentication has been disabled.');
      // Close disable modal
      setIsDisableModalOpen(false);
      // Reset password field
      setDisablePassword('');
      // Reset code field
      setDisableCode('');

      // Refresh state
      await refreshProfile?.();
      onProfileUpdate?.();
    // Catch verification errors during disable
    } catch (err) {
      // Display error banner
      setDisableError(err.message || 'Failed to disable MFA. Please verify your credentials.');
    // Reset disabling loading flag
    } finally {
      // Clear loading state
      setIsDisabling(false);
    }
  };

  // 4. REGENERATE RECOVERY CODES
  // Submits credentials to invalidate all prior recovery codes and issue a fresh set of 8 codes
  const handleRegenerateCodes = async (e) => {
    // Prevent default form submit
    e.preventDefault();
    // Begin regeneration try block
    try {
      // Set regenerating loading flag
      setIsRegenerating(true);
      // Clear error message
      setRegenError('');

      // Dispatch credential payload to backend regeneration endpoint
      const response = await authService.regenerateRecoveryCodes({
        password: regenPassword || undefined,
        code: regenCode || undefined,
      });

      // Extract fresh recovery codes array
      const codes = response?.recoveryCodes || response?.data?.recoveryCodes || [];
      // Store new recovery codes in state
      setNewRecoveryCodes(codes);
      // Close auth prompt modal
      setIsRegenModalOpen(false);
      // Clear password field
      setRegenPassword('');
      // Clear code field
      setRegenCode('');
      // Open recovery codes display modal
      setShowRegenCodesModal(true);
      // Display success toast
      toast.success('New recovery codes generated successfully.');
    // Catch authorization errors
    } catch (err) {
      // Display error banner
      setRegenError(err.message || 'Failed to regenerate recovery codes. Please check your credentials.');
    // Reset regenerating loading flag
    } finally {
      // Clear loading state
      setIsRegenerating(false);
    }
  };

  // Render TwoFactorAuthSection markup
  return (
    <Card
      title="Two-Factor Authentication (2FA)"
      subtitle="Enhance institutional account security with RFC 6238 Time-based One-Time Passwords (TOTP)"
      className="overflow-hidden"
    >
      <div className="space-y-4">
        {/* Status Banner */}
        <div
          className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
            isMfaEnabled
              ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'
              : 'bg-slate-50 dark:bg-surface-dark-muted border-surface-light-border dark:border-surface-dark-border'
          }`}
        >
          <div className="flex items-start sm:items-center space-x-3.5">
            {/* Status icon badge */}
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isMfaEnabled
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
              }`}
            >
              {isMfaEnabled ? (
                <ShieldCheck className="w-6 h-6" />
              ) : (
                <ShieldAlert className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Authenticator App (TOTP)
                </span>
                {/* Active status pill */}
                <Badge
                  variant={isMfaEnabled ? 'success' : isStudent ? 'warning' : 'default'}
                  size="sm"
                >
                  {isMfaEnabled
                    ? isStudent
                      ? 'Required & Active'
                      : 'Enabled & Active'
                    : isStudent
                    ? 'Required — Setup Pending'
                    : 'Disabled'}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isMfaEnabled
                  ? isStudent
                    ? 'MFA is required for student accounts. Your account requires an authenticator code on each sign-in attempt.'
                    : 'Your account requires an authenticator code on each sign-in attempt.'
                  : isStudent
                  ? 'MFA is required for student accounts. Please complete setup to activate your account access.'
                  : 'Protect your examination profile with an authenticator app (e.g. Google Authenticator, Authy, 1Password).'}
              </p>
            </div>
          </div>

          {/* Action buttons: Enable/Setup, Regenerate Codes, or Disable */}
          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            {!isMfaEnabled ? (
              <Button
                variant="primary"
                size="sm"
                onClick={handleStartSetup}
                isLoading={isInitiatingSetup}
                icon={ShieldCheck}
              >
                {isStudent ? 'Set Up 2FA' : 'Enable 2FA'}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRegenPassword('');
                    setRegenCode('');
                    setRegenError('');
                    setIsRegenModalOpen(true);
                  }}
                  icon={RefreshCw}
                >
                  Regenerate Codes
                </Button>
                {!isStudent && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setDisablePassword('');
                      setDisableCode('');
                      setDisableError('');
                      setIsDisableModalOpen(true);
                    }}
                  >
                    Disable 2FA
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Mandatory Student MFA Notice Banner */}
        {isStudent && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300 font-medium flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span>
              <strong>MFA is required for student accounts.</strong> Two-factor authentication is mandatory for all students to protect examination security and academic integrity.
            </span>
          </div>
        )}

        {/* Security Recommendations Box */}
        <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed bg-surface-light dark:bg-surface-dark p-3.5 rounded-xl border border-surface-light-border dark:border-surface-dark-border">
          <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-brand-primary" />
            Institutional Security Compliance
          </p>
          Two-factor authentication ensures that only you can access your examination papers, graded submissions, and academic evaluations. Even if your password is compromised, an unauthorized user cannot access your account without your physical authenticator device.
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: MFA SETUP & RECOVERY CODES ONBOARDING           */}
      {/* ======================================================== */}
      <Modal
        isOpen={isSetupModalOpen}
        onClose={handleCloseSetupModal}
        title={setupStep === 'scan' ? 'Set Up Two-Factor Authentication' : 'Important: Save Your Recovery Codes'}
        maxWidth={setupStep === 'scan' ? 'max-w-md' : 'max-w-lg'}
      >
        {setupStep === 'scan' && setupData && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Scan this QR code using your authenticator application (Google Authenticator, Microsoft Authenticator, Authy, or 1Password).
            </p>

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-slate-200 dark:border-slate-700 shadow-warm-xs">
              {setupData.qrCode ? (
                <img
                  src={setupData.qrCode}
                  alt="MFA QR Code"
                  className="w-44 h-44 object-contain"
                />
              ) : (
                <div className="w-44 h-44 flex items-center justify-center text-slate-400 text-xs">
                  Loading QR Code...
                </div>
              )}
            </div>

            {/* Manual Secret Key Fallback */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border">
              <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Can't scan? Enter code manually
              </span>
              <div className="flex items-center justify-between gap-2">
                <code className="text-xs font-mono font-bold text-slate-800 dark:text-slate-100 break-all select-all">
                  {setupData.secret}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopySecret(setupData.secret)}
                  icon={copiedSecret ? Check : Copy}
                  className="flex-shrink-0"
                >
                  {copiedSecret ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            {/* Verification Form */}
            <form onSubmit={handleConfirmSetup} className="space-y-3 pt-2 border-t border-surface-light-border dark:border-surface-dark-border">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Enter 6-Digit Code from App
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={setupCode}
                  onChange={(e) => {
                    setSetupCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                    if (setupError) setSetupError('');
                  }}
                  className="w-full text-center tracking-[0.4em] font-mono font-bold text-lg h-11 px-3 rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  autoFocus
                />
              </div>

              {setupError && (
                <Alert variant="danger" dismissible={false}>
                  {setupError}
                </Alert>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={handleCloseSetupModal} disabled={isVerifyingSetup}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isVerifyingSetup}
                  disabled={setupCode.length !== 6}
                >
                  Verify & Activate
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 2: RECOVERY CODES DISPLAY */}
        {setupStep === 'recovery' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <p className="font-bold">Save your recovery codes right now.</p>
                <p>
                  If you lose your device or cannot access your authenticator app, these recovery codes are the <strong>only way</strong> to regain access to your account. Each code can only be used once.
                </p>
              </div>
            </div>

            {/* Codes Grid */}
            <div
              data-testid="recovery-codes-grid"
              className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-surface-dark-muted rounded-xl border border-surface-light-border dark:border-surface-dark-border font-mono text-xs"
            >
              {initialRecoveryCodes.map((code, idx) => (
                <div
                  key={idx}
                  data-testid="recovery-code-item"
                  className="p-2 bg-white dark:bg-surface-dark rounded-lg border border-surface-light-border dark:border-surface-dark-border text-center font-bold text-slate-800 dark:text-slate-200 select-all"
                >
                  <span className="text-slate-400 text-[10px] mr-1.5 font-normal">#{idx + 1}</span>
                  {code}
                </div>
              ))}
            </div>

            {/* Actions: Download & Copy */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopyCodes(initialRecoveryCodes, setCopiedSetupCodes)}
                icon={copiedSetupCodes ? Check : Copy}
              >
                {copiedSetupCodes ? 'Codes Copied' : 'Copy All'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownloadCodes(initialRecoveryCodes)}
                icon={Download}
              >
                Download (.txt)
              </Button>
            </div>

            {/* Done Button */}
            <div className="pt-3 border-t border-surface-light-border dark:border-surface-dark-border flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={handleCloseSetupModal}
                icon={Check}
              >
                I Have Saved My Recovery Codes
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 2: DISABLE 2FA CONFIRMATION MODAL (Non-students only) */}
      {/* ======================================================== */}
      {!isStudent && (
        <Modal
          isOpen={isDisableModalOpen}
          onClose={() => setIsDisableModalOpen(false)}
          title="Disable Two-Factor Authentication"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleDisableMfa} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 flex items-start space-x-3">
              <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-red-800 dark:text-red-300">
                <p className="font-bold mb-0.5">Warning: Reduced Account Protection</p>
                Disabling 2FA removes the secondary verification step. Your account will rely only on your primary login credentials.
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              For security, please verify your credentials to confirm disabling 2FA.
            </p>

            {isGoogleAccount ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Authenticator Code (6 digits)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={disableCode}
                  onChange={(e) => {
                    setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                    if (disableError) setDisableError('');
                  }}
                  className="w-full text-center tracking-[0.3em] font-mono font-bold text-base h-10 px-3 rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                  autoFocus
                  required
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Current Account Password
                </label>
                <Input
                  type="password"
                  placeholder="Enter current password"
                  value={disablePassword}
                  onChange={(e) => {
                    setDisablePassword(e.target.value);
                    if (disableError) setDisableError('');
                  }}
                  autoFocus
                  required
                />
              </div>
            )}

            {disableError && (
              <Alert variant="danger" dismissible={false}>
                {disableError}
              </Alert>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDisableModalOpen(false)}
                disabled={isDisabling}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="danger"
                size="sm"
                isLoading={isDisabling}
              >
                Confirm & Disable 2FA
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: REGENERATE RECOVERY CODES AUTH MODAL            */}
      {/* ======================================================== */}
      <Modal
        isOpen={isRegenModalOpen}
        onClose={() => setIsRegenModalOpen(false)}
        title="Regenerate Recovery Codes"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleRegenerateCodes} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200">
            <p className="font-bold mb-0.5">Notice: Invalidation of Old Codes</p>
            Generating new recovery codes will immediately invalidate all previously issued recovery codes. Make sure to download or save your new set.
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300">
            Please confirm your identity to generate a fresh set of recovery codes.
          </p>

          {isGoogleAccount ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Authenticator Code (6 digits)
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={regenCode}
                onChange={(e) => {
                  setRegenCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                  if (regenError) setRegenError('');
                }}
                className="w-full text-center tracking-[0.3em] font-mono font-bold text-base h-10 px-3 rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                autoFocus
                required
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Current Account Password
              </label>
              <Input
                type="password"
                placeholder="Enter current password"
                value={regenPassword}
                onChange={(e) => {
                  setRegenPassword(e.target.value);
                  if (regenError) setRegenError('');
                }}
                autoFocus
                required
              />
            </div>
          )}

          {regenError && (
            <Alert variant="danger" dismissible={false}>
              {regenError}
            </Alert>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRegenModalOpen(false)}
              disabled={isRegenerating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isRegenerating}
            >
              Generate New Codes
            </Button>
          </div>
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 4: NEW RECOVERY CODES DISPLAY MODAL                */}
      {/* ======================================================== */}
      <Modal
        isOpen={showRegenCodesModal}
        onClose={() => setShowRegenCodesModal(false)}
        title="Your New Recovery Codes"
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-900 dark:text-emerald-200">
            <p className="font-bold mb-0.5">Success! Fresh recovery codes generated.</p>
            All prior recovery codes have been revoked. Store these codes in a secure location.
          </div>

          {/* Codes Grid */}
          <div
            data-testid="new-recovery-codes-grid"
            className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-surface-dark-muted rounded-xl border border-surface-light-border dark:border-surface-dark-border font-mono text-xs"
          >
            {newRecoveryCodes.map((code, idx) => (
              <div
                key={idx}
                data-testid="new-recovery-code-item"
                className="p-2 bg-white dark:bg-surface-dark rounded-lg border border-surface-light-border dark:border-surface-dark-border text-center font-bold text-slate-800 dark:text-slate-200 select-all"
              >
                <span className="text-slate-400 text-[10px] mr-1.5 font-normal">#{idx + 1}</span>
                {code}
              </div>
            ))}
          </div>

          {/* Actions: Download & Copy */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopyCodes(newRecoveryCodes, setCopiedRegenCodes)}
              icon={copiedRegenCodes ? Check : Copy}
            >
              {copiedRegenCodes ? 'Codes Copied' : 'Copy All'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownloadCodes(newRecoveryCodes)}
              icon={Download}
            >
              Download (.txt)
            </Button>
          </div>

          <div className="pt-3 border-t border-surface-light-border dark:border-surface-dark-border flex justify-end">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowRegenCodesModal(false)}
              icon={Check}
            >
              Done
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
};

// Export TwoFactorAuthSection component
export default TwoFactorAuthSection;
