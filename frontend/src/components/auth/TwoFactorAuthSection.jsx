// Import React core library and hooks for state and lifecycle tracking
import { useState, useEffect } from 'react';
// Import toast notification utility for displaying alerts and feedback
import { toast } from 'react-toastify';
// Import custom useAuth hook to access active user profile and profile refresh action
import { useAuth } from '../../hooks/useAuth';
// Import authentication service layer communicating with backend MFA endpoints
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
  AlertTriangle,
  Eye,
  EyeOff,
  Mail,
  Send,
  Lock,
} from 'lucide-react';

/**
 * Masks an institutional email address for secure display in settings.
 * Example: 'b*****@uap.edu' or 's*****t@uap.edu'
 */
const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return '';
  const parts = email.trim().split('@');
  if (parts.length !== 2) return email;
  const [local, domain] = parts;
  if (local.length <= 1) return `*@${domain}`;
  if (local.length === 2) return `${local[0]}*@${domain}`;
  const maskedLocal = `${local[0]}${'*'.repeat(Math.min(local.length - 2, 5))}${local[local.length - 1]}`;
  return `${maskedLocal}@${domain}`;
};

// Profile section component providing end-to-end self-service management of Two-Factor Authentication (TOTP & Email OTP)
const TwoFactorAuthSection = ({ profile, onProfileUpdate }) => {
  // Destructure authenticated user profile and refreshProfile method from AuthContext
  const { user, refreshProfile } = useAuth();
  const currentProfile = profile || user;

  // Derive independent MFA states
  const isTotpEnabled = Boolean(currentProfile?.mfaEnabled ?? user?.mfaEnabled);
  const isEmailOtpEnabled = Boolean(currentProfile?.emailOtpEnabled ?? user?.emailOtpEnabled);
  const isGoogleAccount = user?.authProvider === 'google';
  const isStudent = (currentProfile?.role || user?.role) === 'student';
  const accountEmail = currentProfile?.email || user?.email || '';

  // --- TOTP Setup Modal State ---
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [setupStep, setSetupStep] = useState('scan'); // 'scan' | 'recovery'
  const [setupData, setSetupData] = useState(null); // { secret, otpauthUri, qrCode }
  const [setupCode, setSetupCode] = useState('');
  const [isInitiatingSetup, setIsInitiatingSetup] = useState(false);
  const [isVerifyingSetup, setIsVerifyingSetup] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [initialRecoveryCodes, setInitialRecoveryCodes] = useState([]);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [showManualKey, setShowManualKey] = useState(false);
  const [copiedSetupCodes, setCopiedSetupCodes] = useState(false);

  // --- Manage Authenticator MFA Modal State ---
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);

  // --- Disable TOTP Modal State ---
  const [isDisableModalOpen, setIsDisableModalOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [isDisabling, setIsDisabling] = useState(false);
  const [disableError, setDisableError] = useState('');

  // --- Regenerate Recovery Codes Modal State ---
  const [isRegenModalOpen, setIsRegenModalOpen] = useState(false);
  const [regenPassword, setRegenPassword] = useState('');
  const [regenCode, setRegenCode] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenError, setRegenError] = useState('');
  const [showRegenCodesModal, setShowRegenCodesModal] = useState(false);
  const [newRecoveryCodes, setNewRecoveryCodes] = useState([]);
  const [copiedRegenCodes, setCopiedRegenCodes] = useState(false);

  // --- Email OTP Setup Modal State ---
  const [isEmailSetupModalOpen, setIsEmailSetupModalOpen] = useState(false);
  const [emailSetupStep, setEmailSetupStep] = useState('password'); // 'password' | 'code'
  const [emailSetupPassword, setEmailSetupPassword] = useState('');
  const [emailSetupTotpCode, setEmailSetupTotpCode] = useState('');
  const [emailSetupCode, setEmailSetupCode] = useState('');
  const [isSendingEmailSetupCode, setIsSendingEmailSetupCode] = useState(false);
  const [isConfirmingEmailSetup, setIsConfirmingEmailSetup] = useState(false);
  const [emailSetupError, setEmailSetupError] = useState('');
  const [emailSetupCooldown, setEmailSetupCooldown] = useState(0);

  // --- Disable Email OTP Modal State ---
  const [isEmailDisableModalOpen, setIsEmailDisableModalOpen] = useState(false);
  const [emailDisablePassword, setEmailDisablePassword] = useState('');
  const [emailDisableTotpCode, setEmailDisableTotpCode] = useState('');
  const [isDisablingEmail, setIsDisablingEmail] = useState(false);
  const [emailDisableError, setEmailDisableError] = useState('');

  // --- Send Test Code State ---
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);

  // Cooldown countdown timer for Email OTP setup
  useEffect(() => {
    if (emailSetupCooldown <= 0) return;
    const timer = setInterval(() => {
      setEmailSetupCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [emailSetupCooldown]);

  // Helper: Download Recovery Codes as a .txt file
  const handleDownloadCodes = (codes) => {
    const email = accountEmail || 'User';
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
      '• Do NOT share these codes with anyone or store them in plaintext on public devices.',
      '=================================================================',
      '',
      ...codes.map((code, idx) => `[${idx + 1}]  ${code}`),
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
    toast.info('Recovery codes downloaded to file.');
  };

  // Helper: Copy array of codes to clipboard
  const handleCopyCodes = (codes, setCopiedState) => {
    if (!codes || codes.length === 0) return;
    navigator.clipboard.writeText(codes.join('\n'));
    setCopiedState(true);
    toast.success('Recovery codes copied to clipboard');
    setTimeout(() => setCopiedState(false), 2500);
  };

  // Helper: Copy secret
  const handleCopySecret = (secret) => {
    if (!secret) return;
    navigator.clipboard.writeText(secret);
    setCopiedSecret(true);
    toast.success('MFA secret copied to clipboard');
    setTimeout(() => setCopiedSecret(false), 2500);
  };

  // ==========================================
  // 1. TOTP ACTIONS
  // ==========================================
  const handleStartSetup = async () => {
    try {
      setIsInitiatingSetup(true);
      setSetupError('');
      const data = await authService.setupMfa();
      setSetupData(data);
      setShowManualKey(false);
      setSetupStep('scan');
      setSetupCode('');
      setInitialRecoveryCodes([]);
      setIsSetupModalOpen(true);
    } catch (err) {
      toast.error(err.message || 'Failed to initiate MFA setup');
    } finally {
      setIsInitiatingSetup(false);
    }
  };

  const handleConfirmSetup = async (e) => {
    e.preventDefault();
    if (!setupCode || setupCode.length !== 6) {
      setSetupError('Please enter a valid 6-digit verification code.');
      return;
    }

    try {
      setIsVerifyingSetup(true);
      setSetupError('');
      const response = await authService.setupConfirmMfa(setupCode);
      const newAccessToken = response?.accessToken || response?.data?.accessToken;
      if (newAccessToken) {
        storage.setToken(newAccessToken);
      }
      const codes = response?.recoveryCodes || response?.data?.recoveryCodes || [];
      setInitialRecoveryCodes(codes);
      setSetupStep('recovery');
      toast.success('MFA verified successfully! Please save your recovery codes.');
    } catch (err) {
      const msg = err.message || 'Invalid verification code. Please check your authenticator app.';
      setSetupError(msg);
    } finally {
      setIsVerifyingSetup(false);
    }
  };

  const handleCloseSetupModal = async () => {
    if (setupStep === 'recovery') {
      setIsSetupModalOpen(false);
      setSetupData(null);
      setSetupStep('scan');
      setSetupCode('');
      setInitialRecoveryCodes([]);
      toast.success('Two-factor authentication is now active.');
      await refreshProfile?.();
      onProfileUpdate?.();
    } else {
      setIsSetupModalOpen(false);
      setSetupData(null);
      setSetupCode('');
    }
  };

  const handleDisableMfa = async (e) => {
    e.preventDefault();
    if (isStudent) {
      toast.error('MFA is mandatory for student accounts and cannot be disabled.');
      setIsDisableModalOpen(false);
      return;
    }
    try {
      setIsDisabling(true);
      setDisableError('');

      const response = await authService.disableMfa({
        password: disablePassword || undefined,
        code: disableCode || undefined,
      });

      const newAccessToken = response?.accessToken || response?.data?.accessToken;
      if (newAccessToken) {
        storage.setToken(newAccessToken);
      }

      toast.success('Two-factor authentication has been disabled.');
      setIsDisableModalOpen(false);
      setIsManageModalOpen(false);
      setDisablePassword('');
      setDisableCode('');

      await refreshProfile?.();
      onProfileUpdate?.();
    } catch (err) {
      setDisableError(err.message || 'Failed to disable MFA. Please verify your credentials.');
    } finally {
      setIsDisabling(false);
    }
  };

  const handleRegenerateCodes = async (e) => {
    e.preventDefault();
    try {
      setIsRegenerating(true);
      setRegenError('');

      const response = await authService.regenerateRecoveryCodes({
        password: regenPassword || undefined,
        code: regenCode || undefined,
      });

      const codes = response?.recoveryCodes || response?.data?.recoveryCodes || [];
      setNewRecoveryCodes(codes);
      setIsRegenModalOpen(false);
      setIsManageModalOpen(false);
      setRegenPassword('');
      setRegenCode('');
      setShowRegenCodesModal(true);
      toast.success('New recovery codes generated successfully.');
    } catch (err) {
      setRegenError(err.message || 'Failed to regenerate recovery codes. Please check your credentials.');
    } finally {
      setIsRegenerating(false);
    }
  };

  // ==========================================
  // 2. EMAIL OTP ACTIONS
  // ==========================================
  const handleStartEmailOtpSetup = () => {
    setEmailSetupPassword('');
    setEmailSetupTotpCode('');
    setEmailSetupCode('');
    setEmailSetupError('');
    setEmailSetupStep('password');
    setIsEmailSetupModalOpen(true);
  };

  const handleSendEmailSetupCode = async (e) => {
    if (e) e.preventDefault();
    try {
      setIsSendingEmailSetupCode(true);
      setEmailSetupError('');

      const response = await authService.setupEmailOtp({
        password: emailSetupPassword || undefined,
        code: emailSetupTotpCode || undefined,
      });

      setEmailSetupStep('code');
      setEmailSetupCooldown(response?.resendCooldown || 60);
      toast.info(response?.message || `Verification code sent to ${maskEmail(accountEmail)}.`);
    } catch (err) {
      setEmailSetupError(err.message || 'Failed to send verification code. Please check your password.');
    } finally {
      setIsSendingEmailSetupCode(false);
    }
  };

  const handleConfirmEmailSetup = async (e) => {
    e.preventDefault();
    if (!emailSetupCode || emailSetupCode.length !== 6) {
      setEmailSetupError('Please enter a valid 6-digit verification code.');
      return;
    }

    try {
      setIsConfirmingEmailSetup(true);
      setEmailSetupError('');

      const response = await authService.setupConfirmEmailOtp(emailSetupCode);
      toast.success(response?.message || 'Email Verification Code (OTP) enabled successfully!');
      setIsEmailSetupModalOpen(false);
      setEmailSetupCode('');
      setEmailSetupPassword('');
      setEmailSetupTotpCode('');

      await refreshProfile?.();
      onProfileUpdate?.();
    } catch (err) {
      setEmailSetupError(err.message || 'Invalid verification code. Please try again.');
    } finally {
      setIsConfirmingEmailSetup(false);
    }
  };

  const handleStartDisableEmailOtp = () => {
    setEmailDisablePassword('');
    setEmailDisableTotpCode('');
    setEmailDisableError('');
    setIsEmailDisableModalOpen(true);
  };

  const handleConfirmDisableEmailOtp = async (e) => {
    e.preventDefault();
    if (isStudent && !isTotpEnabled) {
      setEmailDisableError('MFA is mandatory for student accounts. You must have Authenticator App active before disabling Email OTP.');
      return;
    }

    try {
      setIsDisablingEmail(true);
      setEmailDisableError('');

      const response = await authService.disableEmailOtp({
        password: emailDisablePassword || undefined,
        code: emailDisableTotpCode || undefined,
      });

      toast.success(response?.message || 'Email OTP has been disabled.');
      setIsEmailDisableModalOpen(false);
      setEmailDisablePassword('');
      setEmailDisableTotpCode('');

      await refreshProfile?.();
      onProfileUpdate?.();
    } catch (err) {
      setEmailDisableError(err.message || 'Failed to disable Email OTP. Please check your credentials.');
    } finally {
      setIsDisablingEmail(false);
    }
  };

  const handleSendTestCode = async () => {
    try {
      setIsSendingTestEmail(true);
      const response = await authService.sendEmailOtpTest();
      toast.success(response?.message || `Test verification code dispatched to ${maskEmail(accountEmail)}.`);
    } catch (err) {
      toast.error(err.message || 'Failed to send test code. Please check SMTP configuration.');
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  return (
    <Card
      title="Two-Factor Authentication (2FA)"
      subtitle="Configure independent multi-factor authentication methods to protect your examination profile and academic records"
      className="overflow-hidden"
    >
      <div className="space-y-4">
        {/* ======================================================== */}
        {/* METHOD A: AUTHENTICATOR APP (TOTP) CARD                  */}
        {/* ======================================================== */}
        <div
          className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
            isTotpEnabled
              ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'
              : 'bg-slate-50 dark:bg-surface-dark-muted border-surface-light-border dark:border-surface-dark-border'
          }`}
          data-testid="totp-card"
        >
          <div className="flex items-start sm:items-center space-x-3.5">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isTotpEnabled
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
              }`}
            >
              {isTotpEnabled ? (
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
                <Badge
                  variant={isTotpEnabled ? 'success' : isStudent ? 'warning' : 'default'}
                  size="sm"
                  data-testid="totp-status-badge"
                >
                  {isTotpEnabled
                    ? 'Enabled'
                    : isStudent
                    ? 'Required — Disabled'
                    : 'Disabled'}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Support standard TOTP authentication compatible with Google Authenticator, Microsoft Authenticator, and Authy.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            {!isTotpEnabled ? (
              <Button
                variant="primary"
                size="sm"
                onClick={handleStartSetup}
                isLoading={isInitiatingSetup}
                icon={ShieldCheck}
                data-testid="setup-authenticator-btn"
                aria-label="Set Up MFA / Set Up 2FA Authenticator App"
              >
                Set Up MFA
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsManageModalOpen(true)}
                  icon={KeyRound}
                  data-testid="manage-authenticator-btn"
                  aria-label="Manage MFA"
                >
                  Manage MFA
                </Button>
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

        {/* ======================================================== */}
        {/* METHOD B: EMAIL VERIFICATION CODE (OTP) CARD             */}
        {/* ======================================================== */}
        <div
          className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
            isEmailOtpEnabled
              ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'
              : 'bg-slate-50 dark:bg-surface-dark-muted border-surface-light-border dark:border-surface-dark-border'
          }`}
          data-testid="email-otp-card"
        >
          <div className="flex items-start sm:items-center space-x-3.5">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isEmailOtpEnabled
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
              }`}
            >
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Email Verification Code (OTP)
                </span>
                <Badge
                  variant={isEmailOtpEnabled ? 'success' : 'default'}
                  size="sm"
                  data-testid="email-otp-status-badge"
                >
                  {isEmailOtpEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Receive a one-time verification code at your registered institutional email address during sign-in.
              </p>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <span className="text-slate-400 dark:text-slate-500 font-medium">Registered Email:</span>
                <code
                  className="font-mono font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px]"
                  data-testid="masked-email-display"
                >
                  {maskEmail(accountEmail)}
                </code>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            {!isEmailOtpEnabled ? (
              <Button
                variant="primary"
                size="sm"
                onClick={handleStartEmailOtpSetup}
                icon={Mail}
                data-testid="enable-email-otp-btn"
                aria-label="Enable Email OTP"
              >
                Enable Email OTP
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSendTestCode}
                  isLoading={isSendingTestEmail}
                  icon={Send}
                  data-testid="send-test-code-btn"
                  aria-label="Send Test Code"
                >
                  Send Test Code
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleStartDisableEmailOtp}
                  data-testid="disable-email-otp-btn"
                  aria-label="Disable Email OTP"
                >
                  Disable Email OTP
                </Button>
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
          Two-factor authentication ensures that only you can access your examination papers, graded submissions, and academic evaluations. Authenticator app TOTP and Email OTP are independently configurable secondary verification methods.
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: TOTP SETUP & RECOVERY CODES ONBOARDING          */}
      {/* ======================================================== */}
      <Modal
        isOpen={isSetupModalOpen}
        onClose={handleCloseSetupModal}
        title={setupStep === 'scan' ? 'Set Up Two-Factor Authentication' : 'Important: Save Your Recovery Codes'}
        maxWidth={setupStep === 'scan' ? 'max-w-md' : 'max-w-lg'}
      >
        {setupStep === 'scan' && setupData && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Open your authenticator app (such as Google Authenticator, Microsoft Authenticator, Authy, or 1Password) and scan the QR code below.
            </p>

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-slate-200 dark:border-slate-700 shadow-warm-xs">
              {setupData.qrCode ? (
                <img
                  src={setupData.qrCode}
                  alt="MFA QR Code"
                  className="w-44 h-44 object-contain"
                  data-testid="mfa-qr-code-image"
                />
              ) : (
                <div className="w-44 h-44 flex items-center justify-center text-slate-400 text-xs">
                  Loading QR Code...
                </div>
              )}
            </div>

            {/* Manual Secret Key Fallback */}
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
                    : setupData.secret
                    ? `${setupData.secret.slice(0, 4)} •••• •••• ${setupData.secret.slice(-4)}`
                    : '••••••••••••••••'}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopySecret(setupData.secret)}
                  icon={copiedSecret ? Check : Copy}
                  className="flex-shrink-0"
                  aria-label="Copy setup key to clipboard"
                >
                  {copiedSecret ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            {/* Verification Form */}
            <form onSubmit={handleConfirmSetup} className="space-y-3 pt-2 border-t border-surface-light-border dark:border-surface-dark-border">
              <div>
                <label
                  htmlFor="totp-setup-code-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Enter 6-Digit Code from Authenticator App
                </label>
                <input
                  id="totp-setup-code-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  aria-label="Six-digit code from authenticator app"
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
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 flex items-start space-x-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                <p className="font-bold text-sm">Authenticator App Enrolled Successfully!</p>
                <p>
                  Two-factor authentication is now active on your account. At future logins, enter your account password first, then open your authenticator app to enter your current six-digit verification code.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <p className="font-bold">Important: Save Your Recovery Codes</p>
                <p>
                  If you lose your phone or cannot access your authenticator app, these recovery codes are the <strong>only way</strong> to regain access to your account. Each code can only be used once.
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
      {/* MODAL 2: MANAGE MFA MODAL                                */}
      {/* ======================================================== */}
      <Modal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        title="Manage Authenticator App (TOTP)"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 flex items-start space-x-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-800 dark:text-emerald-300">
              <p className="font-bold mb-0.5">Authenticator App Active</p>
              Your account is protected by RFC 6238 Time-based One-Time Passwords (TOTP).
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <Button
              variant="outline"
              size="md"
              fullWidth
              onClick={() => {
                setIsManageModalOpen(false);
                setRegenPassword('');
                setRegenCode('');
                setRegenError('');
                setIsRegenModalOpen(true);
              }}
              icon={RefreshCw}
              className="justify-start"
            >
              Regenerate Backup Recovery Codes
            </Button>

            {!isStudent ? (
              <Button
                variant="danger"
                size="md"
                fullWidth
                onClick={() => {
                  setIsManageModalOpen(false);
                  setDisablePassword('');
                  setDisableCode('');
                  setDisableError('');
                  setIsDisableModalOpen(true);
                }}
                className="justify-start"
              >
                Disable Authenticator App
              </Button>
            ) : (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 italic px-1">
                Note: MFA is mandatory for student accounts and cannot be disabled.
              </p>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-surface-light-border dark:border-surface-dark-border">
            <Button variant="outline" size="sm" onClick={() => setIsManageModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 3: DISABLE TOTP CONFIRMATION MODAL                 */}
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
                Disabling Authenticator App removes the TOTP verification requirement. If Email OTP is enabled, Email OTP will remain active.
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              For security, please verify your credentials to confirm disabling Authenticator 2FA.
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
                Confirm & Disable
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: REGENERATE RECOVERY CODES AUTH MODAL            */}
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
      {/* MODAL 5: NEW RECOVERY CODES DISPLAY MODAL                */}
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

      {/* ======================================================== */}
      {/* MODAL 6: ENABLE EMAIL OTP MODAL                          */}
      {/* ======================================================== */}
      <Modal
        isOpen={isEmailSetupModalOpen}
        onClose={() => {
          setIsEmailSetupModalOpen(false);
          setEmailSetupPassword('');
          setEmailSetupTotpCode('');
          setEmailSetupCode('');
          setEmailSetupError('');
        }}
        title="Set Up Email Verification Code (OTP)"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          {emailSetupStep === 'password' ? (
            <form onSubmit={handleSendEmailSetupCode} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border text-xs text-slate-600 dark:text-slate-300">
                <p className="font-semibold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-brand-primary" />
                  Institutional Email Verification
                </p>
                We will send a 6-digit confirmation code to your registered institutional email:
                <div className="mt-1.5 font-mono font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-surface-dark p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                  {maskEmail(accountEmail)}
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300">
                Please re-verify your credentials to authorize enabling Email OTP.
              </p>

              {isGoogleAccount && !user?.password ? (
                isTotpEnabled ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Current Authenticator Code (6 digits)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      value={emailSetupTotpCode}
                      onChange={(e) => {
                        setEmailSetupTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                        if (emailSetupError) setEmailSetupError('');
                      }}
                      className="w-full text-center tracking-[0.3em] font-mono font-bold text-base h-10 px-3 rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                      autoFocus
                      required
                    />
                  </div>
                ) : null
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Account Password
                  </label>
                  <Input
                    type="password"
                    placeholder="Enter account password"
                    value={emailSetupPassword}
                    onChange={(e) => {
                      setEmailSetupPassword(e.target.value);
                      if (emailSetupError) setEmailSetupError('');
                    }}
                    autoFocus
                    required
                  />
                </div>
              )}

              {emailSetupError && (
                <Alert variant="danger" dismissible={false}>
                  {emailSetupError}
                </Alert>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-surface-light-border dark:border-surface-dark-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEmailSetupModalOpen(false)}
                  disabled={isSendingEmailSetupCode}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isSendingEmailSetupCode}
                  icon={Send}
                >
                  Send Verification Code
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleConfirmEmailSetup} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-300">
                <p className="font-bold mb-0.5">Verification Code Dispatched</p>
                We sent a 6-digit code to <strong>{maskEmail(accountEmail)}</strong>. Enter it below to enable Email OTP.
              </div>

              <div>
                <label
                  htmlFor="email-setup-code-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 text-center"
                >
                  Enter 6-Digit Email Verification Code
                </label>
                <input
                  id="email-setup-code-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={emailSetupCode}
                  onChange={(e) => {
                    setEmailSetupCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                    if (emailSetupError) setEmailSetupError('');
                  }}
                  className="w-full text-center tracking-[0.4em] font-mono font-bold text-lg h-11 px-3 rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  autoFocus
                  required
                />
              </div>

              {emailSetupError && (
                <Alert variant="danger" dismissible={false}>
                  {emailSetupError}
                </Alert>
              )}

              <div className="flex items-center justify-between pt-1">
                {emailSetupCooldown > 0 ? (
                  <span className="text-xs text-slate-400 font-medium">
                    Resend code in <strong className="font-mono">{emailSetupCooldown}s</strong>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendEmailSetupCode}
                    disabled={isSendingEmailSetupCode}
                    className="text-xs text-brand-primary hover:text-brand-primary-hover font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSendingEmailSetupCode ? 'animate-spin' : ''}`} />
                    <span>Resend verification code</span>
                  </button>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-surface-light-border dark:border-surface-dark-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEmailSetupModalOpen(false)}
                  disabled={isConfirmingEmailSetup}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isConfirmingEmailSetup}
                  disabled={emailSetupCode.length !== 6}
                >
                  Verify & Enable
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 7: DISABLE EMAIL OTP CONFIRMATION MODAL            */}
      {/* ======================================================== */}
      <Modal
        isOpen={isEmailDisableModalOpen}
        onClose={() => setIsEmailDisableModalOpen(false)}
        title="Disable Email Verification Code (OTP)"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleConfirmDisableEmailOtp} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 flex items-start space-x-3">
            <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-red-800 dark:text-red-300">
              <p className="font-bold mb-0.5">Warning: Reduced Account Protection</p>
              Disabling Email OTP removes secondary email verification during login. Authenticator App (TOTP) status will remain completely independent and unaffected.
            </div>
          </div>

          {isStudent && !isTotpEnabled ? (
            <Alert variant="danger" dismissible={false}>
              MFA is mandatory for student accounts. You must have Authenticator App active before disabling Email OTP.
            </Alert>
          ) : (
            <>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Please verify your credentials to confirm disabling Email OTP.
              </p>

              {isGoogleAccount && !user?.password ? (
                isTotpEnabled ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Authenticator Code (6 digits)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      value={emailDisableTotpCode}
                      onChange={(e) => {
                        setEmailDisableTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                        if (emailDisableError) setEmailDisableError('');
                      }}
                      className="w-full text-center tracking-[0.3em] font-mono font-bold text-base h-10 px-3 rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                      autoFocus
                      required
                    />
                  </div>
                ) : null
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Current Account Password
                  </label>
                  <Input
                    type="password"
                    placeholder="Enter current password"
                    value={emailDisablePassword}
                    onChange={(e) => {
                      setEmailDisablePassword(e.target.value);
                      if (emailDisableError) setEmailDisableError('');
                    }}
                    autoFocus
                    required
                  />
                </div>
              )}
            </>
          )}

          {emailDisableError && (
            <Alert variant="danger" dismissible={false}>
              {emailDisableError}
            </Alert>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-surface-light-border dark:border-surface-dark-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEmailDisableModalOpen(false)}
              disabled={isDisablingEmail}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              isLoading={isDisablingEmail}
              disabled={isStudent && !isTotpEnabled}
            >
              Confirm & Disable
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
};

// Export TwoFactorAuthSection component
export default TwoFactorAuthSection;
