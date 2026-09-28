import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth.service';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Badge from '../../components/ui/Badge';
import { ShieldCheck, KeyRound, ArrowRight, ArrowLeft, RotateCcw } from 'lucide-react';

const MfaVerify = () => {
  const { completeMfaLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [challengeData, setChallengeData] = useState(null);

  const totpInputRef = useRef(null);
  const recoveryInputRef = useRef(null);

  // Retrieve challenge token from location.state or sessionStorage
  useEffect(() => {
    let token = location.state?.mfaToken;
    let email = location.state?.email || '';
    let from = location.state?.from || null;
    let role = null;

    if (!token) {
      try {
        const stored = sessionStorage.getItem('uap_mfa_challenge');
        if (stored) {
          const parsed = JSON.parse(stored);
          token = parsed.mfaToken;
          email = parsed.email || '';
          from = parsed.from || null;
          role = parsed.role || null;
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

    setChallengeData({ mfaToken: token, email, from, role });
  }, [location.state, navigate]);

  // Focus appropriate input on mount or mode toggle
  useEffect(() => {
    if (isRecoveryMode) {
      recoveryInputRef.current?.focus();
    } else {
      totpInputRef.current?.focus();
    }
  }, [isRecoveryMode]);

  const handleTotpChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setTotpCode(val);
    if (errorMessage) setErrorMessage('');
  };

  const handleRecoveryChange = (e) => {
    const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    // Format as XXXXX-XXXXX
    let formatted = raw;
    if (raw.length > 5) {
      formatted = `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
    }
    setRecoveryCode(formatted);
    if (errorMessage) setErrorMessage('');
  };

  const handleSuccessfulAuth = (authPayload) => {
    sessionStorage.removeItem('uap_mfa_challenge');
    const user = completeMfaLogin(authPayload);
    toast.success(`Welcome back, ${user.name}!`);

    const targetFrom = challengeData?.from;
    if (targetFrom && targetFrom.startsWith(`/${user.role}`)) {
      navigate(targetFrom, { replace: true });
    } else if (user.role === 'admin') {
      navigate('/admin/dashboard', { replace: true });
    } else if (user.role === 'instructor') {
      navigate('/instructor/dashboard', { replace: true });
    } else {
      navigate('/student/dashboard', { replace: true });
    }
  };

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

  const handleCancel = () => {
    sessionStorage.removeItem('uap_mfa_challenge');
    navigate('/auth/login', { replace: true });
  };

  if (!challengeData) {
    return null;
  }

  return (
    <div className="w-full max-w-lg mx-auto py-8 sm:py-12 px-4">
      <div className="rounded-3xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark shadow-warm-lg overflow-hidden p-6 sm:p-9 text-center">
        {/* Header Icon */}
        <div className="w-14 h-14 rounded-2xl bg-brand-peach/20 dark:bg-brand-peach/10 border border-brand-peach/30 flex items-center justify-center text-brand-terracotta mx-auto mb-4 shadow-warm-xs">
          {isRecoveryMode ? (
            <KeyRound className="w-7 h-7" aria-hidden="true" />
          ) : (
            <ShieldCheck className="w-7 h-7" aria-hidden="true" />
          )}
        </div>

        <Badge variant="peach" size="sm" className="mb-2 uppercase tracking-wider text-[10px]">
          Two-Factor Authentication
        </Badge>

        <h1 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-slate-900 dark:text-slate-100 mb-1.5">
          {isRecoveryMode ? 'Use Backup Recovery Code' : 'Verify Your Identity'}
        </h1>

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

        {errorMessage && (
          <Alert type="error" className="mb-4 text-left py-2.5 px-3 text-xs">
            {errorMessage}
          </Alert>
        )}

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
              disabled={recoveryCode.length !== 11}
              icon={ArrowRight}
              iconPosition="right"
              className="h-11 font-semibold"
            >
              Use Recovery Code
            </Button>

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

export default MfaVerify;
