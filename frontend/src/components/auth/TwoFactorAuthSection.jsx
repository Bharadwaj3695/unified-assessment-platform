import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth.service';
import { storage } from '../../utils/storage';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Input from '../ui/Input';
import Modal from '../ui/Modal';
import Alert from '../ui/Alert';
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Download,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  Lock,
  Smartphone,
  ExternalLink,
} from 'lucide-react';

const TwoFactorAuthSection = ({ profile, onProfileUpdate }) => {
  const { user, refreshProfile } = useAuth();

  // Derive MFA enabled state from profile or authenticated user
  const isMfaEnabled = Boolean(profile?.mfaEnabled ?? user?.mfaEnabled);
  const isGoogleAccount = user?.authProvider === 'google';

  // --- Setup Modal State ---
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [setupStep, setSetupStep] = useState('scan'); // 'scan' | 'recovery'
  const [setupData, setSetupData] = useState(null); // { secret, otpauthUri, qrCode }
  const [setupCode, setSetupCode] = useState('');
  const [isInitiatingSetup, setIsInitiatingSetup] = useState(false);
  const [isVerifyingSetup, setIsVerifyingSetup] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [initialRecoveryCodes, setInitialRecoveryCodes] = useState([]);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedSetupCodes, setCopiedSetupCodes] = useState(false);

  // --- Disable Modal State ---
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

  // Helper: Download Recovery Codes as a .txt file
  const handleDownloadCodes = (codes) => {
    const email = profile?.email || user?.email || 'User';
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

  // 1. INITIATE MFA SETUP
  const handleStartSetup = async () => {
    try {
      setIsInitiatingSetup(true);
      setSetupError('');
      const data = await authService.setupMfa();
      setSetupData(data);
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

  // 2. CONFIRM MFA SETUP
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

  // Close Setup Modal (after user acknowledges recovery codes)
  const handleCloseSetupModal = async () => {
    if (setupStep === 'recovery') {
      setIsSetupModalOpen(false);
      setSetupData(null);
      setSetupStep('scan');
      setSetupCode('');
      setInitialRecoveryCodes([]);
      toast.success('Two-factor authentication is now active.');

      // Refresh AuthContext and Profile after user has saved recovery codes
      await refreshProfile?.();
      onProfileUpdate?.();
    } else {
      setIsSetupModalOpen(false);
      setSetupData(null);
      setSetupCode('');
    }
  };

  // 3. DISABLE MFA
  const handleDisableMfa = async (e) => {
    e.preventDefault();
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
      setDisablePassword('');
      setDisableCode('');

      // Refresh state
      await refreshProfile?.();
      onProfileUpdate?.();
    } catch (err) {
      setDisableError(err.message || 'Failed to disable MFA. Please verify your credentials.');
    } finally {
      setIsDisabling(false);
    }
  };

  // 4. REGENERATE RECOVERY CODES
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
                <Badge variant={isMfaEnabled ? 'success' : 'default'} size="sm">
                  {isMfaEnabled ? 'Enabled & Active' : 'Disabled'}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isMfaEnabled
                  ? 'Your account requires an authenticator code on each sign-in attempt.'
                  : 'Protect your examination profile with an authenticator app (e.g. Google Authenticator, Authy, 1Password).'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            {!isMfaEnabled ? (
              <Button
                variant="primary"
                size="sm"
                onClick={handleStartSetup}
                isLoading={isInitiatingSetup}
                icon={ShieldCheck}
              >
                Enable 2FA
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
              </>
            )}
          </div>
        </div>

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
      {/* MODAL 2: DISABLE 2FA CONFIRMATION MODAL                  */}
      {/* ======================================================== */}
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

export default TwoFactorAuthSection;
