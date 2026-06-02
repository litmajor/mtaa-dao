import * as React from 'react'
import { cn } from '@/lib/utils'

type Direction = 'row' | 'col' | 'row-reverse' | 'col-reverse'

export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: Direction
  gap?: string | number
  align?: string
  justify?: string
}

export const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  ({ className, direction = 'col', gap = '4', align, justify, style, ...props }, ref) => {
    const gapClass = typeof gap === 'number' ? `gap-${gap}` : `gap-${gap}`
    const directionClass =
      direction === 'col'
        ? 'flex-col'
        : direction === 'col-reverse'
        ? 'flex-col-reverse'
        : direction === 'row-reverse'
        ? 'flex-row-reverse'
        : 'flex-row'

    return (
      <div
        ref={ref}
        className={cn(`flex ${directionClass} ${gapClass} ${className || ''}`)}
        style={{ ...(style || {}), alignItems: align, justifyContent: justify }}
        data-stack
        {...props}
      />
    )
  }
)

Stack.displayName = 'Stack'

export default Stack
