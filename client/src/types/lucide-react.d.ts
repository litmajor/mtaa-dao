/**
 * Type declarations for lucide-react
 * Icon library for React components
 */

declare module 'lucide-react' {
  import React from 'react';

  export interface IconProps extends React.SVGAttributes<SVGSVGElement> {
    size?: number | string;
    absoluteStrokeWidth?: boolean;
  }

  // Common icons used in the application
  export const TrendingUp: React.ComponentType<IconProps>;
  export const Users: React.ComponentType<IconProps>;
  export const DollarSign: React.ComponentType<IconProps>;
  export const Plus: React.ComponentType<IconProps>;
  export const Wallet: React.ComponentType<IconProps>;
  export const Shield: React.ComponentType<IconProps>;
  export const CheckCircle: React.ComponentType<IconProps>;
  export const Settings: React.ComponentType<IconProps>;
  export const Activity: React.ComponentType<IconProps>;
  export const Send: React.ComponentType<IconProps>;
  export const Gift: React.ComponentType<IconProps>;
  export const MoreHorizontal: React.ComponentType<IconProps>;
  export const ArrowUpRight: React.ComponentType<IconProps>;
  export const ArrowDownLeft: React.ComponentType<IconProps>;
  export const Link: React.ComponentType<IconProps>;

  // Re-export for alias
  export { Link as LinkIcon };
}
