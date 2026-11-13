import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth.service';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import SectionLoader from '../../components/ui/SectionLoader';
import Alert from '../../components/ui/Alert';
import { Lock, Save, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-toastify';
import TwoFactorAuthSection from '../../components/auth/TwoFactorAuthSection';
import ProfilePhotoUploader from '../../components/common/ProfilePhotoUploader';
import ProfileImageSection from '../../components/common/ProfileImageSection';

const InstructorProfile = () => {
  const { user, refreshProfile } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [department, setDepartment] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [subjectDescription, setSubjectDescription] = useState('');

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
      setDepartment(data.department || 'Computer Science & Engineering');
      setSubjectId(data.subjectId || 'CS-301');
      setSubjectName(data.subjectName || 'Artificial Intelligence & Machine Learning');
      setSubjectDescription(
        data.subjectDescription ||
          'Advanced foundational principles of machine learning, neural networks, and automated reasoning.'
      );
    } catch (err) {
      setError(err.message || 'Failed to load faculty profile');
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
    setDepartment(profile?.department || 'Computer Science & Engineering');
    setSubjectId(profile?.subjectId || 'CS-301');
    setSubjectName(profile?.subjectName || 'Artificial Intelligence & Machine Learning');
    setSubjectDescription(
      profile?.subjectDescription ||
        'Advanced foundational principles of machine learning, neural networks, and automated reasoning.'
    );
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
        subjectId,
        subjectName,
        subjectDescription,
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
      toast.success('Faculty profile and subject information updated successfully');
    } catch (err) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <SectionLoader message="Loading faculty academic profile..." minHeight="min-h-[350px]" />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Faculty Academic Profile
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Academic credentials, department affiliation, and subject curriculum portfolio.
        </p>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column: Avatar & Immutable Identity (5 Cols) */}
        <div className="md:col-span-5 space-y-6">
          <Card>
            <div className="flex flex-col items-center text-center space-y-3 pt-1">
              <ProfilePhotoUploader
                avatar={effectiveAvatar}
                name={profile?.name}
                role="instructor"
              />

              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {profile?.name}
                </h2>
                <p className="text-xs text-slate-400 dark:text-slate-500">{profile?.email}</p>
                <Badge variant="sage" size="sm" className="mt-1.5 uppercase tracking-wider text-[10px]">
                  Academic Faculty
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

              {/* Immutable Faculty ID Box */}
              <div className="w-full pt-3 border-t border-surface-light-border dark:border-surface-dark-border">
                <div className="p-3.5 rounded-2xl bg-[#FFF9F2] dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Faculty ID
                    </span>
                    <span className="text-xs text-slate-400" title="Permanent institutional identifier">
                      <Lock className="w-3.5 h-3.5 text-slate-400 inline" />
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-mono font-bold text-brand-sage flex items-center justify-between">
                    <span>{profile?.facultyId || user?.facultyId || 'FAC-2026-001'}</span>
                    <span className="text-[11px] font-sans font-normal text-slate-400">🔒 Immutable</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Permanent faculty registration ID.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Subject Portfolio & Academic Authority Card */}
          <Card title="Subject Portfolio" subtitle="Active academic course oversight and curriculum">
            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">
                    Course Identifier
                  </span>
                  <Badge variant="terracotta" size="sm" className="font-mono">
                    {subjectId || 'CS-301'}
                  </Badge>
                </div>
                <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {subjectName || 'Artificial Intelligence'}
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-xs pt-0.5">
                  {subjectDescription || 'Academic course curriculum and examination evaluations.'}
                </p>
              </div>

              {/* Faculty Academic Authority Checklist */}
              <div className="space-y-2 pt-2 border-t border-surface-light-border dark:border-surface-dark-border text-xs text-slate-600 dark:text-slate-300">
                <div className="p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold text-emerald-900 dark:text-emerald-200">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Verified Faculty Examiner</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Clearance to design assessments, publish question banks, and grade student attempts.
                  </p>
                </div>

                <div className="space-y-2 pt-1">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Course Curriculum &amp; Syllabus Oversight</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Bloom Taxonomy Question Bank Authoring</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Submissions &amp; Rubric Evaluation Studio</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Profile & Subject Forms (7 Cols) */}
        <div className="md:col-span-7 space-y-6">
          <Card title="Faculty Details & Academic Curriculum" subtitle="Edit subject information, department, and biography">
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Faculty Full Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. Prof. Alan Turing"
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
                  Academic Department *
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  required
                  placeholder="e.g. Computer Science & Engineering"
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border rounded-xl focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Subject Information Section */}
              <div className="pt-3 border-t border-surface-light-border dark:border-surface-dark-border space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Primary Subject / Course Context
                  </h3>
                  <span className="text-[11px] text-slate-400">Curriculum Portfolio</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Subject ID
                    </label>
                    <input
                      type="text"
                      value={subjectId}
                      onChange={(e) => setSubjectId(e.target.value)}
                      placeholder="e.g. CS-301"
                      className="w-full px-3.5 py-2 text-sm bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border rounded-xl focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary text-slate-900 dark:text-slate-100 font-mono font-medium"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Subject Name
                    </label>
                    <input
                      type="text"
                      value={subjectName}
                      onChange={(e) => setSubjectName(e.target.value)}
                      placeholder="e.g. Artificial Intelligence & Machine Learning"
                      className="w-full px-3.5 py-2 text-sm bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border rounded-xl focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary text-slate-900 dark:text-slate-100 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Subject Description &amp; Scope
                  </label>
                  <textarea
                    rows={3}
                    value={subjectDescription}
                    onChange={(e) => setSubjectDescription(e.target.value)}
                    placeholder="Comprehensive course description suitable for student catalog & dashboard display..."
                    className="w-full px-3.5 py-2 text-sm bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border rounded-xl focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary text-slate-900 dark:text-slate-100 resize-none leading-relaxed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Faculty Bio &amp; Research Overview
                </label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Share academic background, research publications, or office hours..."
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
                  Save Changes
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

export default InstructorProfile;
