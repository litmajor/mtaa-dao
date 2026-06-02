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
  export const Filter: React.ComponentType<IconProps>;
  export const AlertCircle: React.ComponentType<IconProps>;
  export const Activity: React.ComponentType<IconProps>;
  export const Send: React.ComponentType<IconProps>;
  export const Loader2: React.ComponentType<IconProps>;
  export const Sparkles: React.ComponentType<IconProps>;
  export const Gift: React.ComponentType<IconProps>;
  export const MessageCircle: React.ComponentType<IconProps>;
  export const X: React.ComponentType<IconProps>;
  export const HelpCircle: React.ComponentType<IconProps>;
  export const Minimize2: React.ComponentType<IconProps>;
  export const Maximize2: React.ComponentType<IconProps>;
  export const Brain: React.ComponentType<IconProps>;
  export const Heart: React.ComponentType<IconProps>;
  export const Zap: React.ComponentType<IconProps>;
  export const MoreHorizontal: React.ComponentType<IconProps>;
  export const ArrowUpRight: React.ComponentType<IconProps>;
  export const ArrowDownLeft: React.ComponentType<IconProps>;
  export const ArrowRight: React.ComponentType<IconProps>;
  export const ArrowLeft: React.ComponentType<IconProps>;
  export const ChevronLeft: React.ComponentType<IconProps>;
  export const ChevronRight: React.ComponentType<IconProps>;
  export const LoaderCircle: React.ComponentType<IconProps>;
  export const Link: React.ComponentType<IconProps>;
  export const Lock: React.ComponentType<IconProps>;
  export const Unlock: React.ComponentType<IconProps>;
  export const PieChart: React.ComponentType<IconProps>;
  export const Target: React.ComponentType<IconProps>;
  export const Crown: React.ComponentType<IconProps>;
  export const AlertTriangle: React.ComponentType<IconProps>;
  export const RefreshCw: React.ComponentType<IconProps>;

  // Re-export for alias
  export { Link as LinkIcon };
}
