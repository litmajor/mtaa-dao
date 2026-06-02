import * as React from 'react'

type GridProps = {
  columns?: 1 | 2 | 3 | 4
  gap?: 'sm' | 'md' | 'lg'
  className?: string
  children?: React.ReactNode
}

const gapMap: Record<string, string> = {
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
}

export function Grid({ columns = 3, gap = 'lg', className = '', children }: GridProps) {
  const colsClass =
    columns === 1
      ? 'grid-cols-1'
      : columns === 2
      ? 'grid-cols-1 md:grid-cols-2'
      : columns === 3
      ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
      : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'

  return (
    <div className={`grid ${colsClass} ${gapMap[gap]} ${className}`.trim()}>
      {children}
    </div>
  )
}

Grid.displayName = 'Grid'
