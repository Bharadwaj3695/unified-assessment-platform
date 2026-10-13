import { useState, useRef, useEffect } from 'react';
import { Upload, Trash2, Loader2, ImagePlus } from 'lucide-react';
import { toast } from 'react-toastify';
import { authService } from '../../services/auth.service';
import { useAuth } from '../../hooks/useAuth';
import { getInitials } from '../../utils/formatters';

/**
 * Reusable Profile Photo Management Component for UAP RBAC Roles:
 * Supports:
 * - Initials fallback when no photo exists (e.g. Alex Johnson -> AJ, Prof. Alan Turing -> AT)
 * - Upload Image (opens file picker)
 * - View profile photo
 * - Upload/Change Image (replaces existing image with validation and cleanup)
 * - Remove Photo (unlinks stored file and returns to initials)
 * - Preserves RBAC ownership via JWT req.user.id
 */
const ProfilePhotoUploader = ({
  avatar = null,
  name = '',
  role = 'student',
  onPhotoUpdated,
  size = 'w-24 h-24',
  textSize = 'text-3xl',
  rounded = 'rounded-3xl',
}) => {
  const { refreshProfile } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);

  const isBusy = isUploading || isRemoving;

  // Role-specific aesthetic themes adhering to UAP design system
  const roleThemes = {
    student: {
      border: 'border-2 border-brand-peach shadow-warm-sm',
      fallbackBg: 'bg-gradient-to-br from-brand-peach/20 to-brand-terracotta/20 border-2 border-brand-peach/40 text-brand-terracotta',
      buttonBg: 'bg-brand-terracotta hover:bg-brand-terracotta/90 text-white',
      fallbackChar: 'S',
    },
    instructor: {
      border: 'border-2 border-brand-sage shadow-warm-sm',
      fallbackBg: 'bg-gradient-to-br from-emerald-100 to-teal-200 dark:from-emerald-950 dark:to-teal-900 border-2 border-brand-sage/40 text-brand-sage',
      buttonBg: 'bg-brand-sage hover:bg-brand-sage/90 text-white',
      fallbackChar: 'F',
    },
    admin: {
      border: 'border-2 border-indigo-400/40 shadow-warm-sm',
      fallbackBg: 'bg-gradient-to-br from-indigo-100 to-blue-200 dark:from-indigo-950 dark:to-blue-900 border-2 border-indigo-400/40 text-indigo-700 dark:text-indigo-300',
      buttonBg: 'bg-indigo-600 hover:bg-indigo-700 text-white',
      fallbackChar: 'A',
    },
  };

  const currentTheme = roleThemes[role] || roleThemes.student;
  const initials = getInitials(name, currentTheme.fallbackChar);

  // Close menu on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isMenuOpen]);

  // Handle file selection, client-side validation, and upload
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    // Reset file input so identical file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (!file) return;

    // Validate MIME type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only image files (JPEG, PNG, WEBP) are permitted for profile pictures');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Profile image cannot exceed 5MB');
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('avatar', file);

      const res = await authService.uploadAvatar(formData);
      toast.success(res?.message || 'Profile photo updated successfully');

      // Update global auth context and trigger parent callback
      if (refreshProfile) {
        await refreshProfile();
      }
      if (onPhotoUpdated) {
        onPhotoUpdated(res?.avatar || res?.data?.avatar);
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to upload profile picture';
      toast.error(errMsg);
    } finally {
      setIsUploading(false);
      setIsMenuOpen(false);
    }
  };

  // Handle removing profile photo
  const handleRemovePhoto = async () => {
    if (isBusy) return;
    try {
      setIsRemoving(true);
      const res = await authService.deleteAvatar();
      toast.success(res?.message || 'Profile photo removed successfully');

      if (refreshProfile) {
        await refreshProfile();
      }
      if (onPhotoUpdated) {
        onPhotoUpdated(null);
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to remove profile photo';
      toast.error(errMsg);
    } finally {
      setIsRemoving(false);
      setIsMenuOpen(false);
    }
  };

  // Button click: toggle action menu/popover (Upload/Change or Remove if photo exists; Upload Image if no photo)
  const handleActionClick = () => {
    if (isBusy) return;
    setIsMenuOpen((prev) => !prev);
  };

  return (
    <div className="flex flex-col items-center" ref={menuRef}>
      <div className="relative group inline-block">
        {/* Avatar Image or Initials Fallback */}
        {avatar ? (
          <img
            src={avatar}
            alt={name || 'Profile photo'}
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

        {/* Loading overlay spinner when uploading or removing */}
        {isBusy && (
          <div className={`absolute inset-0 ${rounded} bg-slate-900/50 flex flex-col items-center justify-center text-white backdrop-blur-[1px] transition-all`}>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-[10px] font-semibold mt-1">
              {isUploading ? 'Uploading...' : 'Removing...'}
            </span>
          </div>
        )}

        {/* Upload Action Badge Button */}
        <button
          type="button"
          onClick={handleActionClick}
          disabled={isBusy}
          className={`absolute -bottom-1.5 -right-1.5 p-2 rounded-xl ${currentTheme.buttonBg} shadow-warm-sm transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-primary disabled:opacity-60 disabled:cursor-not-allowed`}
          title={avatar ? 'Upload/Change Image' : 'Upload Image'}
          aria-label={avatar ? 'Upload/Change Image' : 'Upload Image'}
          aria-haspopup="true"
          aria-expanded={isMenuOpen}
        >
          {isBusy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
        </button>

        {/* Action Dropdown Menu / Popover */}
        {isMenuOpen && (
          <div
            className="absolute right-0 top-full mt-2 w-48 rounded-2xl bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border shadow-warm-lg z-30 py-1.5 animate-in fade-in zoom-in-95 duration-100 text-left"
            role="menu"
            aria-orientation="vertical"
          >
            {avatar ? (
              <>
                {/* Upload / Change Image Action */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsMenuOpen(false);
                    fileInputRef.current?.click();
                  }}
                  disabled={isBusy}
                  className="w-full flex items-center px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-surface-dark-muted transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 mr-2 text-slate-500 dark:text-slate-400" />
                  Upload/Change Image
                </button>

                {/* Remove Image Action */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleRemovePhoto}
                  disabled={isBusy}
                  className="w-full flex items-center px-3.5 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer border-t border-surface-light-border/60 dark:border-surface-dark-border/60 mt-0.5 pt-2"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  Remove
                </button>
              </>
            ) : (
              /* Upload Image Action */
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsMenuOpen(false);
                  fileInputRef.current?.click();
                }}
                disabled={isBusy}
                className="w-full flex items-center px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-surface-dark-muted transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 mr-2 text-slate-500 dark:text-slate-400" />
                Upload Image
              </button>
            )}
          </div>
        )}
      </div>

      {/* User-facing action controls: NO IMAGE: [Upload Image] | IMAGE EXISTS: [Upload/Change Image] [Remove] */}
      <div className="mt-2.5 flex items-center justify-center gap-2">
        {avatar ? (
          <>
            <button
              type="button"
              onClick={() => {
                if (!isBusy) fileInputRef.current?.click();
              }}
              disabled={isBusy}
              className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors shadow-warm-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              aria-label="Upload/Change Image"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5 text-slate-500 dark:text-slate-400" />
              Upload/Change Image
            </button>
            <button
              type="button"
              onClick={handleRemovePhoto}
              disabled={isBusy}
              className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 transition-colors shadow-warm-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              aria-label="Remove"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Remove
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (!isBusy) fileInputRef.current?.click();
            }}
            disabled={isBusy}
            className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors shadow-warm-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            aria-label="Upload Image"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5 text-slate-500 dark:text-slate-400" />
            Upload Image
          </button>
        )}
      </div>

      {/* Hidden File Input for Native File Selection */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        aria-hidden="true"
      />
    </div>
  );
};

export default ProfilePhotoUploader;
