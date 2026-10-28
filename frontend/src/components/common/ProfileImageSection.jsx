import React, { useRef } from 'react';
import { Upload, Trash2, AlertCircle } from 'lucide-react';
import Button from '../ui/Button';

/**
 * Dedicated Profile Image Section in Profile Left Column.
 *
 * Requirements:
 * - Displays controls: "Upload Photo" when no photo exists, or "Change Photo" & "Remove Photo" when photo exists.
 * - Native device image selection (JPEG, PNG, WEBP, max 5MB).
 * - Real-time staged preview via parent effectiveAvatar before saving.
 * - Changing/removing image updates state; changes only persist when user saves.
 * - Canceling discards unsaved image changes.
 * - No floating buttons or duplicate icons.
 */
const ProfileImageSection = ({
  hasPhoto: hasPhotoProp,
  currentAvatar = null,
  previewUrl = null,
  action = 'none', // 'none' | 'change' | 'remove'
  onPhotoChange,
  disabled = false,
}) => {
  const fileInputRef = useRef(null);

  // Determine whether an active photo is present or staged
  const hasPhoto =
    hasPhotoProp !== undefined
      ? hasPhotoProp
      : Boolean(previewUrl || (action !== 'remove' && currentAvatar));

  // Handle user selecting an image file from device
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so re-selecting same file triggers onChange
    e.target.value = '';

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Only JPEG, PNG, and WEBP image files are allowed.');
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      alert('Image file size must be less than 5MB.');
      return;
    }

    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    if (onPhotoChange) {
      onPhotoChange({
        file,
        previewUrl: objectUrl,
        action: 'change',
      });
    }
  };

  // Handle user requesting removal of current/staged photo
  const handleRemovePhoto = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    if (onPhotoChange) {
      onPhotoChange({
        file: null,
        previewUrl: null,
        action: 'remove',
      });
    }
  };

  return (
    <div className="w-full p-3.5 rounded-2xl bg-[#FFF9F2] dark:bg-surface-dark-muted/50 border border-surface-light-border dark:border-surface-dark-border space-y-2.5">
      <div className="flex flex-col items-center text-center space-y-1.5">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Profile Photo
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            JPG, PNG, or WEBP up to 5MB. Photo changes take effect when saving your profile.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {hasPhoto ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={Upload}
                disabled={disabled}
                onClick={() => fileInputRef.current?.click()}
                aria-label="Change Photo"
              >
                Change Photo
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                icon={Trash2}
                disabled={disabled}
                onClick={handleRemovePhoto}
                aria-label="Remove Photo"
              >
                Remove Photo
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={Upload}
              disabled={disabled}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload Photo"
            >
              Upload Photo
            </Button>
          )}
        </div>

        {/* Staged State Indicators */}
        {action === 'change' && (
          <div className="flex items-center justify-center space-x-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium pt-1">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>New photo selected (click Save Changes to apply)</span>
          </div>
        )}
        {action === 'remove' && (
          <div className="flex items-center justify-center space-x-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium pt-1">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Photo marked for removal (click Save Changes to apply)</span>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        aria-label="Select profile image"
      />
    </div>
  );
};

export default ProfileImageSection;
