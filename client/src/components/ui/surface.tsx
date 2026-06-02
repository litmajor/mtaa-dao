import * as React from 'react'
import { cn } from '@/lib/utils'

export type SurfaceElevation = 'none' | 'sm' | 'md' | 'lg'

export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  elevation?: SurfaceElevation
}

const elevationMap: Record<SurfaceElevation, string> = {
  none: 'shadow-none',
  sm: 'shadow-sm',
  md: 'shadow',
  lg: 'shadow-lg',
}

export const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(
  ({ className, elevation = 'md', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('rounded-lg bg-card text-card-foreground', elevationMap[elevation], className)}
        {...props}
      />
    )
  }
)

Surface.displayName = 'Surface'

export default Surface
