import EmptyState from './EmptyState';

type ErrorStateProps = {
  title?: string;
  message?: string;
  retryLabel?: string;
  onRetry?: () => void;
};

export default function ErrorState({
  title = 'Something went wrong',
  message,
  retryLabel = 'Try Again',
  onRetry,
}: ErrorStateProps) {
  return (
    <EmptyState
      title={title}
      message={message}
      icon="warning-outline"
      actionLabel={onRetry ? retryLabel : undefined}
      onActionPress={onRetry}
    />
  );
}
