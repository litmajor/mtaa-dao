import React from 'react';
import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';

export interface IconProps extends Omit<React.SVGAttributes<SVGElement>, 'children'> {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  strokeWidth?: number;
  color?: string;
  ariaHidden?: boolean;
  ariaLabel?: string;
}

const sizeMap = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 48,
};

const Icon = React.forwardRef<SVGSVGElement, IconProps>(
  (
    {
      name,
      size = 'md',
      strokeWidth = 2,
      color = 'currentColor',
      className,
      ariaHidden = true,
      ariaLabel,
      ...props
    },
    ref
  ) => {
    const sizeValue = typeof size === 'number' ? size : sizeMap[size];

    // Convert kebab-case to PascalCase for lucide icon names
    const iconName = name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');

    const LucideIcon = (LucideIcons as Record<string, React.ComponentType<any>>)[iconName];

    if (!LucideIcon) {
      console.warn(`Icon "${name}" not found in lucide-react`);
      return null;
    }

    return (
      <LucideIcon
        ref={ref}
        size={sizeValue}
        strokeWidth={strokeWidth}
        color={color}
        className={cn('inline-block flex-shrink-0', className)}
        aria-hidden={ariaHidden}
        aria-label={ariaLabel}
        role={ariaLabel ? 'img' : undefined}
        {...props}
      />
    );
  }
);

Icon.displayName = 'Icon';

export { Icon };
