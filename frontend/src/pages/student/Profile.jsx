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
  Award,
  BookOpen,
  Camera,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  Save,
} from 'lucide-react';
import { toast } from 'react-toastify';
import TwoFactorAuthSection from '../../components/auth/TwoFactorAuthSection';

const StudentProfile = () => {
  const { user, setUser } = useAuth();
  const fileInputRef = useRef(null);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  // Editable fields
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [department, setDepartment] = useState('');

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

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const updated = await authService.updateProfile({
        name,
        bio,
        department,
      });
      setProfile(updated);
      toast.success('Academic profile updated successfully');
    } catch (err) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type & size
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
      const res = await authService.uploadAvatar(formData);
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
        <p className="mt-3 text-xs text-slate-500 font-medium">Loading academic identity...</p>
      </div>
    );
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

      {error && <Alert variant="error">{error}</Alert>}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left: Identity & Avatar Card (5 Cols) */}
        <div className="md:col-span-5 space-y-6">
          <Card>
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="relative group">
                {profile?.avatar ? (
                  <img
                    src={profile.avatar}
                    alt={profile.name}
                    className="w-24 h-24 rounded-3xl object-cover border-2 border-brand-peach shadow-warm-sm"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-brand-peach/20 to-brand-terracotta/20 border-2 border-brand-peach/40 flex items-center justify-center text-brand-terracotta text-3xl font-extrabold shadow-warm-xs">
                    {profile?.name?.charAt(0) || 'S'}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="absolute -bottom-1.5 -right-1.5 p-2 rounded-xl bg-brand-terracotta text-white shadow-warm-sm hover:bg-brand-terracotta/90 transition-all cursor-pointer"
                  title="Upload profile picture"
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
                <Badge variant="secondary" size="sm" className="mt-1.5 uppercase tracking-wider text-[10px]">
                  Student Candidate
                </Badge>
              </div>

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
                    <span>{profile?.studentId || 'STU-2026-001'}</span>
                    <span className="text-[11px] font-sans font-normal text-slate-400">🔒 Immutable</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Permanent institution identifier assigned by university registry.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Academic Summary Badge Card */}
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
            </div>
          </Card>
        </div>

        {/* Right: Academic Details & Form (7 Cols) */}
        <div className="md:col-span-7 space-y-6">
          <Card title="Institutional Information" subtitle="Update your profile information">
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border rounded-xl focus:outline-none focus:border-brand-terracotta text-slate-800 dark:text-slate-100"
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
                <p className="text-[10px] text-slate-400 mt-1">Managed via institutional administrator.</p>
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
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border rounded-xl focus:outline-none focus:border-brand-terracotta text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Academic Biography & Interests
                </label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Share your focus area, semester goals, or technical interests..."
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border rounded-xl focus:outline-none focus:border-brand-terracotta text-slate-800 dark:text-slate-100"
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
                  Save Profile Changes
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

export default StudentProfile;
