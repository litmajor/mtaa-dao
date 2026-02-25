
import React, { ReactNode, useState, useEffect } from 'react';
import ErrorBoundary from './ErrorBoundary';

interface AsyncErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export const AsyncErrorBoundary: React.FC<AsyncErrorBoundaryProps> = ({ 
  children, 
  fallback 
}) => {
  const [asyncError, setAsyncError] = useState<Error | null>(null);

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      setAsyncError(new Error(event.reason));
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  if (asyncError) {
    throw asyncError;
  }

  return (
    <ErrorBoundary fallbackTitle="Network Error" fallbackMessage="Failed to load data. Please check your connection and try again.">
      {children}
    </ErrorBoundary>
  );
};
