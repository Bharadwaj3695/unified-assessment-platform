import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth.service';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import SectionLoader from '../../components/ui/SectionLoader';
import Alert from '../../components/ui/Alert';
import { Lock, Save, Shield, ShieldCheck, CheckCircle2, UserCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import ProfilePhotoUploader from '../../components/common/ProfilePhotoUploader';
import ProfileImageSection from '../../components/common/ProfileImageSection';

const AdminProfile = () => {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [department, setDepartment] = useState('');

  // Staged profile photo state (persisted strictly on form save)
  const [photoState, setPhotoState] = useState({
    file: null,
    previewUrl: null,
    action: 'none', // 'none' | 'change' | 'remove'
  });

  const fetchProfile = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      setError(null);
      const data = await authService.getProfile();
      setProfile(data);
      setName(data.name || '');
      setBio(data.bio || '');
      setDepartment(data.department || 'Institutional Administration & Systems Governance');
    } catch (err) {
      setError(err.message || 'Failed to load administrator profile');
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile(true);
  }, []);

  // Compute effective avatar for real-time preview in the left profile card:
  // - If action is 'remove', preview shows fallback initials
  // - If action is 'change', preview immediately reflects selected file blob URL
  // - Otherwise, displays current saved profile avatar
  const effectiveAvatar =
    photoState.action === 'remove'
      ? null
      : photoState.action === 'change' && photoState.previewUrl
      ? photoState.previewUrl
      : profile?.avatar || null;

  const handleCancel = () => {
    setName(profile?.name || '');
    setBio(profile?.bio || '');
    setDepartment(profile?.department || 'Institutional Administration & Systems Governance');
    if (photoState.previewUrl && photoState.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(photoState.previewUrl);
    }
    setPhotoState({ file: null, previewUrl: null, action: 'none' });
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      setIsSaving(true);

      // 1. Persist photo update or removal if staged
      if (photoState.action === 'change' && photoState.file) {
        const formData = new FormData();
        formData.append('avatar', photoState.file);
        await authService.uploadAvatar(formData);
      } else if (photoState.action === 'remove') {
        await authService.deleteAvatar();
      }

      // 2. Persist text fields
      const updated = await authService.updateProfile({
        name,
        bio,
        department,
      });

      // 3. Clear staged photo state
      if (photoState.previewUrl && photoState.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(photoState.previewUrl);
      }
      setPhotoState({ file: null, previewUrl: null, action: 'none' });

      // 4. Update auth context globally (header, sidebar, etc.)
      if (refreshProfile) {
        await refreshProfile();
      }

      // 5. Update local profile state
      await fetchProfile(false);
      toast.success('Administrator profile updated successfully');
    } catch (err) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <SectionLoader message="Loading administrator profile..." minHeight="min-h-[350px]" />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Administrator Profile
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          System administrative credentials, security parameters, and account governance.
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column: Avatar & Immutable Identity (5 Cols) */}
        <div className="md:col-span-5 space-y-6">
          <Card>
            <div className="flex flex-col items-center text-center space-y-3 pt-1">
              <ProfilePhotoUploader
                avatar={effectiveAvatar}
                name={profile?.name}
                role="admin"
              />

              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {profile?.name}
                </h2>
                <p className="text-xs text-slate-400 dark:text-slate-500">{profile?.email}</p>
                <Badge variant="primary" size="sm" className="mt-1.5 uppercase tracking-wider text-[10px]">
                  System Administrator
                </Badge>
              </div>

              {/* Compact Profile Image Controls Section Below Profile Picture */}
              <ProfileImageSection
                hasPhoto={Boolean(profile?.avatar || (photoState.action === 'change' && photoState.previewUrl))}
                previewUrl={photoState.previewUrl}
                action={photoState.action}
                onPhotoChange={setPhotoState}
                disabled={isSaving}
              />

              {/* Immutable Admin ID Box */}
              <div className="w-full pt-3 border-t border-surface-light-border dark:border-surface-dark-border">
                <div className="p-3.5 rounded-2xl bg-[#FFF9F2] dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Admin ID
                    </span>
                    <span className="text-xs text-slate-400" title="Permanent institutional identifier">
                      <Lock className="w-3.5 h-3.5 text-slate-400 inline" />
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-mono font-bold text-indigo-700 dark:text-indigo-400 flex items-center justify-between">
                    <span>{profile?.adminId || user?.adminId || 'ADM-2026-001'}</span>
                    <span className="text-[11px] font-sans font-normal text-slate-400">🔒 Immutable</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Permanent administrative identifier assigned by institutional registry.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* System Governance Authority Card */}
          <Card title="Administrative Authority" subtitle="Assigned system oversight privileges">
            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 space-y-1.5">
                <div className="flex items-center space-x-1.5 font-bold text-indigo-900 dark:text-indigo-200">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Level 4 Institutional Governance</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Full clearance to provision faculty rosters, oversee student cohorts, manage system configurations, and inspect immutable audit logs.
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>User Provisioning &amp; Account Approval</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Platform System Settings &amp; Policies</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Immutable Audit &amp; Telemetry Logs</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Institutional Identity & Form (7 Cols) */}
        <div className="md:col-span-7 space-y-6">
          <Card title="Institutional Identity" subtitle="Manage your administrative credentials and profile details">
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. Dr. Eleanor Vance"
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border rounded-xl focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Administrative Department *
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  required
                  placeholder="e.g. Institutional Administration & Systems Governance"
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border rounded-xl focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Primary Institutional Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={profile?.email || ''}
                    disabled
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border rounded-xl text-slate-500 cursor-not-allowed"
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3.5 top-3" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Institutional email addresses are managed centrally by directory services.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Administrative Bio &amp; Institutional Scope
                </label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Add a brief executive summary of your administrative oversight..."
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border rounded-xl focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary text-slate-900 dark:text-slate-100 resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-surface-light-border dark:border-surface-dark-border">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  disabled={isSaving}
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  icon={Save}
                  loading={isSaving}
                  loadingText="Saving Changes..."
                >
                  Save Profile Changes
                </Button>
              </div>
            </form>
          </Card>

          {/* Two-Factor Authentication (2FA) Overview & Security Gateway */}
          <Card
            title="Two-Factor Authentication (2FA)"
            subtitle="Account security status and authentication parameters"
            className="overflow-hidden"
          >
            <div className="space-y-4 min-w-0">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-slate-50/60 dark:bg-surface-dark-muted/40 min-w-0">
                <div className="flex items-start space-x-3 min-w-0">
                  <div
                    className={`p-2 rounded-xl flex-shrink-0 ${
                      profile?.mfaEnabled || user?.mfaEnabled
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40'
                        : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40'
                    }`}
                  >
                    {profile?.mfaEnabled || user?.mfaEnabled ? (
                      <ShieldCheck className="w-5 h-5" />
                    ) : (
                      <Shield className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 break-words">
                        Authenticator App (TOTP)
                      </span>
                      <Badge
                        variant={profile?.mfaEnabled || user?.mfaEnabled ? 'success' : 'warning'}
                        size="sm"
                        className="text-[10px]"
                      >
                        {profile?.mfaEnabled || user?.mfaEnabled ? 'Active & Protected' : 'Setup Recommended'}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 break-words">
                      {profile?.mfaEnabled || user?.mfaEnabled
                        ? 'Administrative credentials require secondary TOTP verification code during login.'
                        : 'Two-factor authentication is currently inactive for this administrator account.'}
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={Shield}
                  onClick={() => navigate('/admin/settings')}
                  className="w-full lg:w-auto flex-shrink-0"
                >
                  Manage MFA in Settings
                </Button>
              </div>

              <p className="text-[11px] text-slate-400 dark:text-slate-500 break-words">
                Multi-factor authentication lifecycle, QR code enrollment, backup recovery codes, and platform security policies are centrally managed under{' '}
                <button
                  type="button"
                  onClick={() => navigate('/admin/settings')}
                  className="text-brand-primary hover:underline font-medium inline cursor-pointer"
                >
                  Platform &amp; System Settings
                </button>
                .
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminProfile;
