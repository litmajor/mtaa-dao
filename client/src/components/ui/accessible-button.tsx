
import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface AccessibleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  ({ 
    children, 
    loading = false, 
    loadingText = 'Loading...', 
    disabled,
    className,
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedby,
    ...props 
  }, ref) => {
    return (
      <Button
        ref={ref}
        disabled={disabled || loading}
        aria-label={loading ? loadingText : ariaLabel}
        aria-describedby={ariaDescribedby}
        aria-busy={loading}
        className={cn('touch-target', className)}
        {...props}
      >
        {loading ? (
          <div className="flex items-center space-x-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>{loadingText}</span>
          </div>
        ) : (
          children
        )}
      </Button>
    );
  }
);

AccessibleButton.displayName = 'AccessibleButton';
