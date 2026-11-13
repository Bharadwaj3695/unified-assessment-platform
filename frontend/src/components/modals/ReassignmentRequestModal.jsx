import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { Calendar, AlertCircle, FileText } from 'lucide-react';
import { formatDateTime } from '../../utils/formatters';

/**
 * Reassignment Request Modal
 *
 * Conforms strictly to the approved specification:
 * - Title: Request Reassignment
 * - Close icon in the top-right corner
 * - Assessment information card (title, subject/category, due date when available)
 * - Required field label: Reason for Request
 * - Multiline textarea with placeholder: "Enter your reason here..."
 * - Character counter in format: 0/500
 * - Helper text: "Please provide a clear and valid reason for your reassignment request."
 * - Validation message when reason contains fewer than 10 non-whitespace characters
 * - Footer buttons: Cancel and Submit Request
 * - No reason categories, radio buttons, or dropdowns
 */
const ReassignmentRequestModal = ({
  isOpen,
  onClose,
  assessment,
  onSubmit,
}) => {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');

  // Reset form state whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      setReason('');
      setTouched(false);
      setIsSubmitting(false);
      setApiError('');
    }
  }, [isOpen]);

  if (!isOpen || !assessment) return null;

  // Validation calculations
  const nonWhitespaceLength = reason.replace(/\s+/g, '').length;
  const isTooShort = nonWhitespaceLength < 10;
  const isOverLimit = reason.length > 500;
  const isValid = !isTooShort && !isOverLimit;

  // Derive validation message
  let validationMessage = '';
  if (touched) {
    if (reason.length === 0) {
      validationMessage = 'Reason for request is required.';
    } else if (isTooShort) {
      validationMessage = 'Reason must contain at least 10 non-whitespace characters.';
    } else if (isOverLimit) {
      validationMessage = 'Reason cannot exceed 500 characters.';
    }
  }

  const handleReasonChange = (e) => {
    const nextVal = e.target.value;
    if (nextVal.length <= 500) {
      setReason(nextVal);
      if (apiError) setApiError('');
    }
  };

  const handleBlur = () => {
    setTouched(true);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setTouched(true);

    if (!isValid || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setApiError('');
      const targetId = assessment._id || assessment.id;
      await onSubmit(targetId, reason.trim());
      onClose();
    } catch (err) {
      setApiError(
        err.response?.data?.message ||
        err.message ||
        'Failed to submit reassignment request. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      title="Request Reassignment"
      maxWidth="max-w-lg"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            isLoading={isSubmitting}
            loadingText="Submitting Request..."
          >
            Submit Request
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Assessment Information Card */}
        <div className="p-3.5 sm:p-4 rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-slate-50 dark:bg-surface-dark-muted space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge variant="peach" size="sm">
              {assessment.category || 'General'}
            </Badge>
            {assessment.deadlineAt && (
              <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
                <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                <span>Due: {formatDateTime(assessment.deadlineAt)}</span>
              </div>
            )}
          </div>

          <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
            {assessment.title}
          </h4>

          {assessment.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
              {assessment.description}
            </p>
          )}
        </div>

        {/* Reason for Request Field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="reassignment-reason"
              className="text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              Reason for Request <span className="text-red-500">*</span>
            </label>
            <span
              className={`text-[11px] font-mono ${
                reason.length >= 480
                  ? 'text-amber-600 dark:text-amber-400 font-bold'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
              aria-live="polite"
            >
              {reason.length}/500
            </span>
          </div>

          <textarea
            id="reassignment-reason"
            name="reason"
            rows={4}
            value={reason}
            onChange={handleReasonChange}
            onBlur={handleBlur}
            maxLength={500}
            placeholder="Enter your reason here..."
            disabled={isSubmitting}
            className={`w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white dark:bg-surface-dark border rounded-xl placeholder-slate-400 text-slate-800 dark:text-slate-100 focus:outline-none transition-all resize-none ${
              validationMessage || apiError
                ? 'border-red-400 dark:border-red-500 focus:ring-2 focus:ring-red-400/20'
                : 'border-surface-light-border dark:border-surface-dark-border focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary'
            }`}
            aria-invalid={Boolean(validationMessage || apiError)}
            aria-describedby="reason-helper-text"
          />

          {/* Helper Text */}
          <p
            id="reason-helper-text"
            className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5"
          >
            Please provide a clear and valid reason for your reassignment request.
          </p>

          {/* Validation Message */}
          {validationMessage && (
            <div
              role="alert"
              className="flex items-center space-x-1.5 mt-1.5 text-xs text-red-600 dark:text-red-400"
            >
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{validationMessage}</span>
            </div>
          )}

          {/* Server / API Error Message */}
          {apiError && (
            <div
              role="alert"
              className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 mt-2 text-xs text-red-700 dark:text-red-300 flex items-start space-x-2"
            >
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-red-500" />
              <span>{apiError}</span>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
};

export default ReassignmentRequestModal;
