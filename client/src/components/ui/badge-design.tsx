import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center justify-center gap-1 rounded-full font-medium transition-colors duration-shorter',
  {
    variants: {
      variant: {
        orange:
          'bg-orange-light text-orange-darker hover:bg-orange-light/80 border border-orange-base/20',
        purple:
          'bg-purple-light text-purple-darker hover:bg-purple-light/80 border border-purple-base/20',
        emerald:
          'bg-emerald-light text-emerald-darker hover:bg-emerald-light/80 border border-emerald-base/20',
        red: 'bg-red-light text-red-darker hover:bg-red-light/80 border border-red-base/20',
        amber:
          'bg-amber-light text-amber-darker hover:bg-amber-light/80 border border-amber-base/20',
        teal: 'bg-teal-light text-teal-darker hover:bg-teal-light/80 border border-teal-base/20',
        gray: 'bg-gray-light text-gray-darker hover:bg-gray-light/80 border border-gray-base/20',
        blue: 'bg-blue-light text-blue-darker hover:bg-blue-light/80 border border-blue-base/20',
      },
      size: {
        sm: 'px-2 py-1 text-xs',
        md: 'px-3 py-1.5 text-sm',
        lg: 'px-4 py-2 text-base',
      },
    },
    defaultVariants: {
      variant: 'orange',
      size: 'md',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  icon?: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  (
    {
      className,
      variant = 'orange',
      size = 'md',
      icon,
      dismissible = false,
      onDismiss,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant, size }), className)}
        role="status"
        {...props}
      >
        {icon && <span className="flex items-center">{icon}</span>}
        <span>{children}</span>
        {dismissible && (
          <button
            onClick={onDismiss}
            className="ml-1 hover:opacity-70 transition-opacity"
            aria-label="Dismiss badge"
          >
            <svg
              width="1em"
              height="1em"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge, badgeVariants };
