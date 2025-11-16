import React from 'react';
import { cn } from '@/lib/utils';
import './spinner.css';

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  speed?: 'slow' | 'normal' | 'fast';
  ariaLabel?: string;
}

const sizeMap = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

const speedMap = {
  slow: 'spinner-slow',
  normal: 'spinner-normal',
  fast: 'spinner-fast',
};

const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
  (
    {
      size = 'md',
      color = 'currentColor',
      speed = 'normal',
      className,
      ariaLabel = 'Loading',
      style,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(sizeMap[size], 'inline-block', speedMap[speed], className)}
        role="status"
        aria-label={ariaLabel}
        {...props}
      >
        <svg
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke={color}
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill={color}
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
    );
  }
);

Spinner.displayName = 'Spinner';

export { Spinner };
