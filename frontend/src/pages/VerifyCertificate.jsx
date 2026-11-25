import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import certificateService from '../services/certificate.service';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { formatDate, formatDateTime } from '../utils/formatters';
import {
  ShieldCheck,
  ShieldAlert,
  Award,
  CheckCircle2,
  XCircle,
  Search,
  ExternalLink,
  Copy,
  Check,
  Calendar,
  Building2,
  Lock,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

/**
 * Public Certificate Verification Page
 * Authoritative registry verification endpoint accessible by employers, academic institutions, and students.
 * Enforces strict zero-PII security (no emails, passwords, student IDs, or raw answers exposed).
 */
const VerifyCertificate = () => {
  const { code: urlCode } = useParams();
  const navigate = useNavigate();

  const [inputCode, setInputCode] = useState(urlCode || '');
  const [activeCode, setActiveCode] = useState(urlCode || '');
  const [certificate, setCertificate] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.title = 'Credential Verification | Unified Assessment Platform';
  }, []);

  const verifyCode = useCallback(async (codeToVerify) => {
    const cleanCode = (codeToVerify || '').trim();
    if (!cleanCode) {
      setCertificate(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await certificateService.verifyCertificate(cleanCode);
      setCertificate(data);
    } catch (err) {
      console.error('[VerifyCertificate] Verification lookup failed:', err);
      setCertificate(null);
      const message =
        err.response?.status === 404
          ? 'Credential not found. Please ensure the verification code or certificate number is entered correctly.'
          : err.response?.data?.message || 'Unable to complete verification lookup. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (urlCode) {
      setInputCode(urlCode);
      setActiveCode(urlCode);
      verifyCode(urlCode);
    }
  }, [urlCode, verifyCode]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanCode = inputCode.trim();
    if (!cleanCode) {
      toast.warning('Please enter a verification code or certificate ID');
      return;
    }
    setActiveCode(cleanCode);
    navigate(`/verify/${encodeURIComponent(cleanCode)}`, { replace: true });
    verifyCode(cleanCode);
  };

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Verification code copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const isRevoked = certificate?.status === 'revoked';

  return (
    <div className="py-8 sm:py-12 max-w-4xl mx-auto px-4">
      {/* Top Banner & Header */}
      <div className="text-center space-y-3 mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800/60 shadow-warm-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Authoritative Credential Registry</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
          Certificate Verification
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          Verify the authenticity and current standing of academic credentials and certificates issued by the Unified Assessment Platform.
        </p>
      </div>

      {/* Verification Lookup Input Card */}
      <Card className="p-4 sm:p-6 mb-8 border border-surface-light-border dark:border-surface-dark-border shadow-warm-md">
        <form onSubmit={handleSubmit} className="space-y-3">
          <label
            htmlFor="verificationCode"
            className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Enter Verification Code or Certificate ID
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="verificationCode"
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="e.g. 7f9b8c2a1e4d or UAP-2026-XXXX"
                className="w-full pl-10 pr-4 py-2.5 text-sm font-mono rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-slate-50 dark:bg-surface-dark-muted text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-primary uppercase tracking-wide"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading}
              loadingText="Verifying..."
              icon={ShieldCheck}
            >
              Verify Credential
            </Button>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Codes can be found printed on the certificate document or embedded within the QR verification matrix.
          </p>
        </form>
      </Card>

      {/* Result Display Area */}
      {isLoading ? (
        <Card className="p-12 text-center border border-surface-light-border dark:border-surface-dark-border">
          <RefreshCw className="w-8 h-8 text-brand-primary animate-spin mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Consulting Authoritative Registry...
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Validating cryptographic token and certificate issuance records.
          </p>
        </Card>
      ) : error ? (
        <Card className="p-8 border border-red-200 dark:border-red-900/40 bg-red-50/40 dark:bg-red-950/10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-3">
            <XCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-red-900 dark:text-red-200">
            Verification Unsuccessful
          </h3>
          <p className="text-sm text-red-700 dark:text-red-300 max-w-md mx-auto mt-1">
            {error}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setInputCode('');
                setError(null);
                navigate('/verify', { replace: true });
              }}
            >
              Try Another Code
            </Button>
          </div>
        </Card>
      ) : certificate ? (
        <div className="space-y-6">
          {/* Status Verdict Header Card */}
          <div
            className={`p-6 rounded-2xl border ${
              isRevoked
                ? 'bg-red-50/80 dark:bg-red-950/30 border-red-300 dark:border-red-800'
                : 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start space-x-3.5">
                <div
                  className={`p-3 rounded-2xl ${
                    isRevoked
                      ? 'bg-red-600 text-white shadow-warm-xs'
                      : 'bg-emerald-600 text-white shadow-warm-xs'
                  }`}
                >
                  {isRevoked ? (
                    <ShieldAlert className="w-7 h-7" />
                  ) : (
                    <ShieldCheck className="w-7 h-7" />
                  )}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h2
                      className={`text-lg sm:text-xl font-bold ${
                        isRevoked
                          ? 'text-red-900 dark:text-red-200'
                          : 'text-emerald-900 dark:text-emerald-200'
                      }`}
                    >
                      {isRevoked ? 'REVOKED CREDENTIAL' : 'AUTHENTIC & VERIFIED CREDENTIAL'}
                    </h2>
                    <Badge variant={isRevoked ? 'error' : 'success'} size="md" dot>
                      {isRevoked ? 'Revoked' : 'Active Credential'}
                    </Badge>
                  </div>
                  <p
                    className={`text-xs sm:text-sm mt-1 ${
                      isRevoked
                        ? 'text-red-800 dark:text-red-300'
                        : 'text-emerald-800 dark:text-emerald-300'
                    }`}
                  >
                    {isRevoked
                      ? `This credential was officially revoked by institutional authority on ${formatDateTime(
                          certificate.revokedAt
                        )}. Reason: "${certificate.revocationReason || 'Administrative revocation'}"`
                      : `This credential is confirmed authentic, valid, and on permanent record with ${
                          certificate.institution || 'Unified Assessment Platform'
                        }.`}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2 self-start sm:self-auto">
                <Button
                  variant="outline"
                  size="sm"
                  icon={copied ? Check : Copy}
                  onClick={() => handleCopy(certificate.verificationCode)}
                >
                  {copied ? 'Copied' : 'Copy Code'}
                </Button>
              </div>
            </div>
          </div>

          {/* Detailed Credential Certificate Record */}
          <Card className="p-6 sm:p-8 border border-surface-light-border dark:border-surface-dark-border shadow-warm-md">
            {/* Institution Badge */}
            <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-brand-primary mb-4">
              <Building2 className="w-4 h-4" />
              <span>{certificate.institution || 'Unified Assessment Platform'}</span>
            </div>

            {/* Recipient and Title */}
            <div className="border-b border-surface-light-border dark:border-surface-dark-border pb-6 mb-6">
              <span className="text-xs uppercase tracking-wider text-slate-400 block mb-1">
                Conferred Upon
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 mb-2">
                {certificate.studentName}
              </h3>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
                For successful performance and fulfillment of certification criteria in{' '}
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {certificate.assessmentName}
                </span>
                .
              </p>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs sm:text-sm">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border">
                <span className="text-slate-400 text-xs block mb-1">Certificate Number</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 break-all">
                  {certificate.certificateId}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border">
                <span className="text-slate-400 text-xs block mb-1">Cryptographic Token</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 break-all">
                  {certificate.verificationCode}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border">
                <span className="text-slate-400 text-xs block mb-1">Date of Issuance</span>
                <div className="flex items-center space-x-1.5 font-semibold text-slate-800 dark:text-slate-200">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>{formatDate(certificate.issuedAt)}</span>
                </div>
              </div>

              {certificate.grade && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border">
                  <span className="text-slate-400 text-xs block mb-1">Awarded Grade</span>
                  <Badge variant="primary" size="md">
                    Grade: {certificate.grade}
                  </Badge>
                </div>
              )}

              {typeof certificate.percentage === 'number' && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border">
                  <span className="text-slate-400 text-xs block mb-1">Official Percentage Score</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-base">
                    {certificate.percentage}%
                    {certificate.score !== undefined && certificate.totalPoints ? (
                      <span className="text-xs font-normal text-slate-400 ml-1.5">
                        ({certificate.score} / {certificate.totalPoints} pts)
                      </span>
                    ) : null}
                  </span>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border">
                <span className="text-slate-400 text-xs block mb-1">Registry Standing</span>
                <Badge variant={isRevoked ? 'error' : 'success'} size="md" dot>
                  {isRevoked ? 'Revoked' : 'Active & Conferred'}
                </Badge>
              </div>
            </div>

            {/* Zero-PII Security Assurance */}
            <div className="mt-6 p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 flex items-start space-x-3 text-xs text-blue-900 dark:text-blue-300">
              <Lock className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
              <div>
                <span className="font-bold block mb-0.5">Authoritative Zero-PII Academic Registry</span>
                <span>
                  This verification snapshot confirms the legal conferral of this credential without exposing student email addresses, private identity numbers, or internal assessment answers.
                </span>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        /* Empty prompt state */
        <div className="p-10 text-center rounded-2xl border border-dashed border-surface-light-border dark:border-surface-dark-border bg-white/50 dark:bg-surface-dark/30">
          <div className="p-3 rounded-2xl bg-slate-100 dark:bg-surface-dark-muted inline-flex mb-3 text-slate-400">
            <Award className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Ready to Verify
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
            Enter any credential verification token or certificate number above to retrieve verified institutional records.
          </p>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="mt-12 text-center text-xs text-slate-400">
        <Link
          to="/"
          className="inline-flex items-center space-x-1.5 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          <span>Return to Unified Assessment Platform Home</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};

export default VerifyCertificate;
