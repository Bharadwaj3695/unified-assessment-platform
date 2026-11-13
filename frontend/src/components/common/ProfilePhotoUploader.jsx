import React, { useState, useEffect } from 'react';
import { getInitials } from '../../utils/formatters';

/**
 * Reusable Profile Avatar Component for UAP RBAC Roles (Student, Instructor, Admin).
 *
 * Renders:
 * - Profile avatar image when photo URL is present
 * - Formatted initials fallback when no photo exists (e.g. Alex Johnson -> AJ, System Admin -> SA)
 * - Strict role-based border, background, and accent styling adhering to UAP design system
 * - Clean presentation without floating upload icons or redundant upload buttons
 */
const ProfilePhotoUploader = ({
  avatar = null,
  name = '',
  role = 'student',
  onPhotoUpdated, // Preserved for caller prop interface compatibility
  size = 'w-24 h-24',
  textSize = 'text-3xl',
  rounded = 'rounded-3xl',
}) => {
  const [hasImgError, setHasImgError] = useState(false);

  useEffect(() => {
    setHasImgError(false);
  }, [avatar]);

  // Role-specific aesthetic themes adhering to UAP design system
  const roleThemes = {
    student: {
      border: 'border-2 border-brand-peach shadow-warm-sm',
      fallbackBg: 'bg-gradient-to-br from-brand-peach/20 to-brand-terracotta/20 border-2 border-brand-peach/40 text-brand-terracotta',
      fallbackChar: 'S',
    },
    instructor: {
      border: 'border-2 border-brand-sage shadow-warm-sm',
      fallbackBg: 'bg-gradient-to-br from-emerald-100 to-teal-200 dark:from-emerald-950 dark:to-teal-900 border-2 border-brand-sage/40 text-brand-sage',
      fallbackChar: 'F',
    },
    admin: {
      border: 'border-2 border-indigo-400/40 shadow-warm-sm',
      fallbackBg: 'bg-gradient-to-br from-indigo-100 to-blue-200 dark:from-indigo-950 dark:to-blue-900 border-2 border-indigo-400/40 text-indigo-700 dark:text-indigo-300',
      fallbackChar: 'A',
    },
  };

  const currentTheme = roleThemes[role] || roleThemes.student;
  const initials = getInitials(name, currentTheme.fallbackChar);

  return (
    <div className="flex flex-col items-center">
      <div className="relative inline-block">
        {/* Avatar Image or Initials Fallback */}
        {avatar && !hasImgError ? (
          <img
            src={avatar}
            alt={name || 'Profile photo'}
            onError={() => setHasImgError(true)}
            className={`${size} ${rounded} object-cover ${currentTheme.border}`}
          />
        ) : (
          <div
            className={`${size} ${rounded} ${currentTheme.fallbackBg} flex items-center justify-center ${textSize} font-extrabold shadow-warm-xs select-none`}
            title={name}
          >
            {initials}
          </div>
        )}
      </div>
    </div>
  );
};

export { ProfilePhotoUploader as ProfileAvatar };
export default ProfilePhotoUploader;
