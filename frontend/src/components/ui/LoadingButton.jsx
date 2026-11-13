import Button from './Button';

/**
 * Standard LoadingButton component for asynchronous actions across all workspaces.
 * Encapsulates disabled state, loading spinner, and contextual loading text.
 */
const LoadingButton = ({
  loadingText = 'Processing...',
  isLoading = false,
  loading = false,
  ...props
}) => {
  return (
    <Button
      isLoading={isLoading}
      loading={loading}
      loadingText={loadingText}
      {...props}
    />
  );
};

export default LoadingButton;
