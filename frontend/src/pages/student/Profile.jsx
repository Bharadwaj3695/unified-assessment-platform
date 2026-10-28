import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth.service';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import SectionLoader from '../../components/ui/SectionLoader';
import Alert from '../../components/ui/Alert';
import { Lock, Sparkles, Save, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-toastify';
import TwoFactorAuthSection from '../../components/auth/TwoFactorAuthSection';
import ProfilePhotoUploader from '../../components/common/ProfilePhotoUploader';
import ProfileImageSection from '../../components/common/ProfileImageSection';

const StudentProfile = () => {
  const { user, refreshProfile } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // Editable fields
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
      setDepartment(data.department || 'Computer Science');
    } catch (err) {
      setError(err.message || 'Failed to load profile data');
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
    setDepartment(profile?.department || 'Computer Science');
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
      toast.success('Academic profile updated successfully');
    } catch (err) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <SectionLoader message="Loading academic identity..." minHeight="min-h-[350px]" />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Student Academic Profile
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Institutional identity credentials, department enrollment, and derived academic record.
        </p>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {(!profile?.mfaEnabled && !user?.mfaEnabled) && (
        <Alert type="warning" title="MFA Setup Required">
          MFA is required for student accounts. Please complete the Two-Factor Authentication setup below to unlock all student features.
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left: Identity & Avatar Card (5 Cols) */}
        <div className="md:col-span-5 space-y-6">
          <Card>
            <div className="flex flex-col items-center text-center space-y-3 pt-1">
              <ProfilePhotoUploader
                avatar={effectiveAvatar}
                name={profile?.name}
                role="student"
              />

              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {profile?.name}
                </h2>
                <p className="text-xs text-slate-400 dark:text-slate-500">{profile?.email}</p>
                <Badge variant="secondary" size="sm" className="mt-1.5 uppercase tracking-wider text-[10px]">
                  Student Candidate
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

              {/* Immutable Student ID Box */}
              <div className="w-full pt-3 border-t border-surface-light-border dark:border-surface-dark-border">
                <div className="p-3.5 rounded-2xl bg-[#FFF9F2] dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Student ID
                    </span>
                    <span className="text-xs text-slate-400" title="Permanent institutional identifier">
                      <Lock className="w-3.5 h-3.5 text-slate-400 inline" />
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-mono font-bold text-brand-terracotta flex items-center justify-between">
                    <span>{profile?.studentId || user?.studentId || 'STU-2026-001'}</span>
                    <span className="text-[11px] font-sans font-normal text-slate-400">🔒 Immutable</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Permanent institution identifier assigned by university registry.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Academic Standing & Record Card */}
          <Card title="Academic Summary" subtitle="Derived from verified examination evaluations">
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 flex items-start space-x-3">
                <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                    {profile?.academicSummary || 'Enrolled Student — Ready for First Assessment'}
                  </div>
                  <p className="text-[11px] text-indigo-700 dark:text-indigo-400 mt-0.5">
                    Real-time performance metric computed from completed examinations.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1 text-center">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Completed</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {profile?.academicMetrics?.totalCompleted || 0} Exams
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Average Score</span>
                  <span className="text-sm font-bold text-brand-terracotta">
                    {profile?.academicMetrics?.averagePercentage || 0}%
                  </span>
                </div>
              </div>

              {/* Academic Milestones Checklist */}
              <div className="space-y-2 pt-2 border-t border-surface-light-border dark:border-surface-dark-border text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Enrolled Degree Candidate</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Verified Assessment Record</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Two-Factor Authentication Security</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Academic Details & Form (7 Cols) */}
        <div className="md:col-span-7 space-y-6">
          <Card title="Institutional Information" subtitle="Manage your academic credentials and profile details">
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
                  placeholder="e.g. Alex Johnson"
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border rounded-xl focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Institutional Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={profile?.email || user?.email || ''}
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
                  Department / Academic Program
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Computer Science, Software Engineering"
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border rounded-xl focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Academic Biography &amp; Interests
                </label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Share your focus area, semester goals, or technical interests..."
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border rounded-xl focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary text-slate-900 dark:text-slate-100 resize-none leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
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

          {/* Multi-Factor Authentication (2FA) */}
          <TwoFactorAuthSection profile={profile || user} onProfileUpdate={fetchProfile} />
        </div>
      </div>
    </div>
  );
};

export default StudentProfile;
