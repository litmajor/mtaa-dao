import React from 'react';
import { cn } from '@/lib/utils';
import '@/styles/glowing-branding.css';

export interface GlowingBrandingProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  intensity?: 'subtle' | 'normal' | 'intense';
  className?: string;
  showHands?: boolean;
}

export const GlowingBranding: React.FC<GlowingBrandingProps> = ({
  size = 'lg',
  intensity = 'normal',
  className,
  showHands = true,
}) => {
  const sizeClasses = {
    sm: 'text-2xl',
    md: 'text-4xl',
    lg: 'text-6xl',
    xl: 'text-8xl',
  };

  const glowIntensity = {
    subtle: 'drop-shadow-[0_0_8px_rgba(255,165,0,0.4)]',
    normal: 'drop-shadow-[0_0_20px_rgba(255,165,0,0.6)] drop-shadow-[0_0_40px_rgba(255,140,0,0.3)]',
    intense: 'drop-shadow-[0_0_30px_rgba(255,165,0,0.8)] drop-shadow-[0_0_60px_rgba(255,140,0,0.5)] drop-shadow-[0_0_90px_rgba(255,100,0,0.2)]',
  };

  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      {/* Animated glow background */}
      {/* Main text */}
      <div className={cn('font-bold text-center relative z-10 glow-text', sizeClasses[size], glowIntensity[intensity])}>
        <div className="text-glow leading-tight">
          <div>MTAA</div>
          <div>DAO</div>
        </div>
      </div>
    </div>
  );
};

export default GlowingBranding;
