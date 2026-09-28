import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../hooks/useAuth';
import Alert from '../../components/ui/Alert';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { CheckCircle2, Clock, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';

const GoogleCallback = () => {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [status, setStatus] = useState('processing'); // 'processing' | 'pending' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [applicantInfo, setApplicantInfo] = useState(null);

  const processingRef = useRef(false);

  useEffect(() => {
    if (processingRef.current) return;
    processingRef.current = true;

    const queryParams = new URLSearchParams(location.search);
    const code = queryParams.get('code');
    const state = queryParams.get('state');
    const errorParam = queryParams.get('error');

    if (errorParam) {
      setStatus('error');
      setErrorMessage(
        errorParam === 'access_denied'
          ? 'Google authorization request was cancelled or denied.'
          : `Google OAuth error: ${errorParam}`
      );
      return;
    }

    if (!code) {
      setStatus('error');
      setErrorMessage('Missing Google authorization code in callback redirect.');
      return;
    }

    const storedState = sessionStorage.getItem('google_oauth_state');
    if (storedState && state && storedState !== state) {
      console.warn('[GoogleCallback] State parameter mismatch. Proceeding with caution.');
    }
    sessionStorage.removeItem('google_oauth_state');

    const executeLogin = async () => {
      try {
        const response = await loginWithGoogle({ code, state });

        if (response && response.mfaRequired && response.mfaToken) {
          sessionStorage.setItem(
            'uap_mfa_challenge',
            JSON.stringify({
              mfaToken: response.mfaToken,
              email: response.user?.email || '',
              role: response.user?.role || 'student',
            })
          );
          navigate('/auth/mfa-verify', {
            replace: true,
            state: {
              mfaToken: response.mfaToken,
              email: response.user?.email || '',
            },
          });
          return;
        }

        if (response.status === 'pending' || response.pendingApproval || !response.accessToken) {
          setStatus('pending');
          setApplicantInfo(response.user || null);
          return;
        }

        const activeUser = response.user;
        toast.success(`Welcome, ${activeUser.name}!`);

        if (activeUser.role === 'admin') {
          navigate('/admin/dashboard', { replace: true });
        } else if (activeUser.role === 'instructor') {
          navigate('/instructor/dashboard', { replace: true });
        } else {
          navigate('/student/dashboard', { replace: true });
        }
      } catch (err) {
        const serverMsg =
          err.response?.data?.message || err.message || 'Authentication failed. Please try again.';

        if (
          serverMsg.toLowerCase().includes('pending') ||
          err.response?.status === 202 ||
          err.response?.data?.status === 'pending'
        ) {
          setStatus('pending');
          setApplicantInfo(err.response?.data?.data?.user || null);
        } else {
          setStatus('error');
          setErrorMessage(serverMsg);
        }
      }
    };

    executeLogin();
  }, [location.search, loginWithGoogle, navigate]);

  return (
    <div className="w-full max-w-lg mx-auto py-12 px-4 sm:px-6">
      <div className="rounded-3xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark shadow-warm-lg overflow-hidden p-8 sm:p-10 text-center">
        {status === 'processing' && (
          <div className="py-8">
            <div className="w-14 h-14 border-4 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin mx-auto mb-6" />
            <h2 className="text-xl font-bold font-display text-slate-900 dark:text-slate-100 mb-2">
              Verifying Google Credentials
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Exchanging secure tokens and verifying institutional identity...
            </p>
          </div>
        )}

        {status === 'pending' && (
          <div className="py-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400 mx-auto mb-5 shadow-warm-xs">
              <Clock className="w-7 h-7" />
            </div>

            <Badge variant="peach" dot className="mb-3">
              Application Under Review
            </Badge>

            <h2 className="text-2xl font-bold font-display text-slate-900 dark:text-slate-100 mb-3">
              Registration Received
            </h2>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
              Your Google account has been registered with the <strong>Student</strong> role.
              Per institutional policy, an administrator must review and approve your account before access is granted.
            </p>

            {applicantInfo && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-left text-xs text-slate-600 dark:text-slate-300 mb-6 space-y-1">
                <div><strong>Name:</strong> {applicantInfo.name}</div>
                <div><strong>Email:</strong> {applicantInfo.email}</div>
                <div><strong>Role:</strong> {applicantInfo.role}</div>
                <div><strong>Status:</strong> <span className="capitalize text-amber-600 font-semibold">{applicantInfo.status || 'Pending'}</span></div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/auth/login" className="w-full sm:w-auto">
                <Button variant="outline" size="md" fullWidth icon={ArrowLeft}>
                  Back to Sign In
                </Button>
              </Link>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="py-4">
            <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 flex items-center justify-center text-red-600 dark:text-red-400 mx-auto mb-5 shadow-warm-xs">
              <AlertCircle className="w-7 h-7" />
            </div>

            <Badge variant="terracotta" className="mb-3">
              Authentication Error
            </Badge>

            <h2 className="text-2xl font-bold font-display text-slate-900 dark:text-slate-100 mb-3">
              Sign-In Failed
            </h2>

            <Alert type="error" className="mb-6 text-left">
              {errorMessage || 'Unable to authenticate with Google.'}
            </Alert>

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

export default GoogleCallback;
