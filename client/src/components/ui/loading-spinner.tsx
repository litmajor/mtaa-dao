import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'orange' | 'subtle';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  variant = 'orange', // Defaulting to your brand color
  className 
}) => {
  // Balanced size utilities
  const sizeClasses = {
    sm: 'h-4 w-4 stroke-[3]',
    md: 'h-8 w-8 stroke-[2.5]',
    lg: 'h-12 w-12 stroke-[2]',
    xl: 'h-16 w-16 stroke-[1.5]'
  };

  // Aesthetic theme color variants
  const variantClasses = {
    orange: 'text-orange-500',
    default: 'text-white',
    subtle: 'text-gray-500'
  };

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        className
      )}
      role="status"
      aria-label="Loading"
    >
      {/* Using an SVG instead of raw CSS borders gives you perfectly scaling, 
        smooth hardware-accelerated animations across all displays.
      */}
      <svg
        className={cn(
          "animate-spin", 
          sizeClasses[size], 
          variantClasses[variant]
        )}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        {/* Background Track Circle (Muted opacity for premium feel) */}
        <circle
          className="opacity-[0.08]"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
        />
        {/* Active Spinner Segment */}
        <path
          className="opacity-95"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          d="M12 2A10 10 0 0 1 22 12"
        />
      </svg>
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export default LoadingSpinner;