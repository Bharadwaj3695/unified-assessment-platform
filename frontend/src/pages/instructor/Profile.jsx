import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth.service';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import Alert from '../../components/ui/Alert';
import {
  User as UserIcon,
  Mail,
  Lock,
  Building,
  BookOpen,
  Camera,
  Save,
  CheckCircle2,
  GraduationCap,
  Layers,
} from 'lucide-react';
import { toast } from 'react-toastify';
import TwoFactorAuthSection from '../../components/auth/TwoFactorAuthSection';

const InstructorProfile = () => {
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [department, setDepartment] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [subjectDescription, setSubjectDescription] = useState('');

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

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const updated = await authService.updateProfile({
        name,
        bio,
        department,
        subjectId,
        subjectName,
        subjectDescription,
      });
      setProfile(updated);
      toast.success('Faculty profile and subject information updated successfully');
    } catch (err) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('Only image files (JPEG, PNG, WEBP) are permitted for profile pictures');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Profile image cannot exceed 5MB');
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('avatar', file);
      await authService.uploadAvatar(formData);
      toast.success('Profile picture updated successfully');
      fetchProfile();
    } catch (err) {
      toast.error(err.message || 'Failed to upload profile picture');
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center">
        <Spinner size="lg" />
        <p className="mt-3 text-xs text-slate-500 font-medium">Loading faculty academic profile...</p>
      </div>
    );
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

      {error && <Alert variant="error">{error}</Alert>}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column: Avatar & Immutable Identity (5 Cols) */}
        <div className="md:col-span-5 space-y-6">
          <Card>
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="relative group">
                {profile?.avatar ? (
                  <img
                    src={profile.avatar}
                    alt={profile.name}
                    className="w-24 h-24 rounded-3xl object-cover border-2 border-brand-sage shadow-warm-sm"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-100 to-teal-200 dark:from-emerald-950 dark:to-teal-900 border-2 border-brand-sage/40 flex items-center justify-center text-brand-sage text-3xl font-extrabold shadow-warm-xs">
                    {profile?.name?.charAt(0) || 'F'}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="absolute -bottom-1.5 -right-1.5 p-2 rounded-xl bg-brand-sage text-white shadow-warm-sm hover:bg-brand-sage/90 transition-all cursor-pointer"
                  title="Upload faculty profile picture"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                />
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {profile?.name}
                </h2>
                <p className="text-xs text-slate-400 dark:text-slate-500">{profile?.email}</p>
                <Badge variant="sage" size="sm" className="mt-1.5 uppercase tracking-wider text-[10px]">
                  Academic Faculty
                </Badge>
              </div>

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
                    <span>{profile?.facultyId || 'FAC-2026-001'}</span>
                    <span className="text-[11px] font-sans font-normal text-slate-400">🔒 Immutable</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Permanent faculty registration ID.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Subject Preview Card */}
          <Card title="Subject Portfolio" subtitle="Active academic course oversight">
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-dark-muted border border-surface-light-border dark:border-surface-dark-border">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Course Identifier</span>
                  <Badge variant="terracotta" size="sm">
                    {subjectId || 'CS-301'}
                  </Badge>
                </div>
                <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {subjectName || 'Artificial Intelligence'}
                </div>
                <p className="text-slate-600 dark:text-slate-300 mt-1 leading-relaxed text-[11px]">
                  {subjectDescription || 'Academic course curriculum and examination evaluations.'}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Profile & Subject Forms (7 Cols) */}
        <div className="md:col-span-7 space-y-6">
          <Card title="Faculty Details & Academic Curriculum" subtitle="Edit subject information and biography">
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Faculty Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border rounded-xl focus:outline-none focus:border-brand-sage text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Institutional Email Address
                </label>
                <input
                  type="email"
                  value={profile?.email || ''}
                  disabled
                  className="w-full px-3 py-2 text-xs bg-slate-100 dark:bg-slate-800/60 border border-surface-light-border dark:border-surface-dark-border rounded-xl text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Academic Department
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Computer Science & Engineering"
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border rounded-xl focus:outline-none focus:border-brand-sage text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Subject Information Section */}
              <div className="pt-2 border-t border-surface-light-border dark:border-surface-dark-border space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Primary Subject / Course Context
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Subject ID
                    </label>
                    <input
                      type="text"
                      value={subjectId}
                      onChange={(e) => setSubjectId(e.target.value)}
                      placeholder="e.g. CS-301"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border rounded-xl focus:outline-none focus:border-brand-sage text-slate-800 dark:text-slate-100 font-mono font-medium"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Subject Name
                    </label>
                    <input
                      type="text"
                      value={subjectName}
                      onChange={(e) => setSubjectName(e.target.value)}
                      placeholder="e.g. Artificial Intelligence"
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border rounded-xl focus:outline-none focus:border-brand-sage text-slate-800 dark:text-slate-100 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Short Subject Description
                  </label>
                  <textarea
                    rows={2}
                    value={subjectDescription}
                    onChange={(e) => setSubjectDescription(e.target.value)}
                    placeholder="Short course description suitable for student catalog & dashboard display..."
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border rounded-xl focus:outline-none focus:border-brand-sage text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Faculty Bio / Research Overview
                </label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Share academic background, research publications, or office hours..."
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border rounded-xl focus:outline-none focus:border-brand-sage text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  icon={Save}
                  loading={isSaving}
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </Card>

          {/* Multi-Factor Authentication (2FA) */}
          <TwoFactorAuthSection profile={profile} onProfileUpdate={fetchProfile} />
        </div>
      </div>
    </div>
  );
};

export default InstructorProfile;
