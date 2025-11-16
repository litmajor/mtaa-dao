import React from 'react';
import { Card } from './card-design';

export interface DashboardLayoutProps {
  // Metadata
  title?: string;
  subtitle?: string;
  
  // Grid customization
  columns?: 'auto' | 1 | 2 | 3 | 4 | 6;
  gap?: 'sm' | 'md' | 'lg';
  
  // Header section
  headerContent?: React.ReactNode;
  headerAction?: React.ReactNode;
  
  // Children (dashboard cards/widgets)
  children: React.ReactNode;
  
  // Sidebar
  showSidebar?: boolean;
  sidebarContent?: React.ReactNode;
  
  // Responsive
  responsiveColumns?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  
  // Styling
  className?: string;
  containerClassName?: string;
}

export interface DashboardGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4 | 6;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

export interface DashboardCardProps {
  // Content
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  
  // Styling
  colspan?: number;
  rowspan?: number;
  elevation?: 0 | 1 | 2 | 3 | 4;
  
  // States
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  
  // Actions
  headerAction?: React.ReactNode;
  footerAction?: React.ReactNode;
  
  // Styling
  className?: string;
}

const gapClasses = {
  sm: 'gap-3',
  md: 'gap-4',
  lg: 'gap-6',
};

const columnClasses = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  6: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
};

export const DashboardLayout = React.forwardRef<HTMLDivElement, DashboardLayoutProps>(
  (
    {
      title,
      subtitle,
      children,
      columns = 3,
      gap = 'md',
      headerContent,
      headerAction,
      showSidebar = false,
      sidebarContent,
      responsiveColumns,
      className,
      containerClassName,
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={`w-full h-full flex flex-col ${className || ''}`}
      >
        {/* Header Section */}
        {(title || headerContent || headerAction) && (
          <div className="mb-6 pb-6 border-b border-neutral-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                {title && (
                  <h1 className="text-3xl font-bold text-neutral-900">{title}</h1>
                )}
                {subtitle && (
                  <p className="mt-1 text-neutral-600">{subtitle}</p>
                )}
                {headerContent && <div className="mt-4">{headerContent}</div>}
              </div>
              {headerAction && <div className="flex-shrink-0">{headerAction}</div>}
            </div>
          </div>
        )}

        {/* Main Content & Sidebar */}
        <div className="flex-1 flex gap-6">
          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <DashboardGrid
              columns={columns}
              gap={gap}
              className={containerClassName}
            >
              {children}
            </DashboardGrid>
          </div>

          {/* Sidebar */}
          {showSidebar && sidebarContent && (
            <aside className="w-64 flex-shrink-0">
              {sidebarContent}
            </aside>
          )}
        </div>
      </div>
    );
  }
);

DashboardLayout.displayName = 'DashboardLayout';

export const DashboardGrid = React.forwardRef<HTMLDivElement, DashboardGridProps>(
  ({ children, columns = 3, gap = 'md', className }, ref) => {
    const columnClass = typeof columns === 'number' ? columnClasses[columns] : '';
    const gapClass = gapClasses[gap];

    return (
      <div
        ref={ref}
        className={`grid ${columnClass} ${gapClass} w-full ${className || ''}`}
        role="region"
        aria-label="Dashboard grid"
      >
        {children}
      </div>
    );
  }
);

DashboardGrid.displayName = 'DashboardGrid';

export const DashboardCard = React.forwardRef<HTMLDivElement, DashboardCardProps>(
  (
    {
      title,
      subtitle,
      children,
      colspan = 1,
      rowspan = 1,
      elevation = 1,
      isLoading = false,
      isEmpty = false,
      emptyMessage = 'No data available',
      headerAction,
      footerAction,
      className,
    },
    ref
  ) => {
    const colspanClass = colspan > 1 ? `col-span-1 md:col-span-${Math.min(colspan, 2)} lg:col-span-${colspan}` : '';

    return (
      <Card
        ref={ref}
        elevation={elevation}
        className={`flex flex-col h-full ${colspanClass} ${className || ''}`}
      >
        {/* Header */}
        {(title || headerAction) && (
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-neutral-200">
            <div>
              {title && (
                <h3 className="font-semibold text-neutral-900">{title}</h3>
              )}
              {subtitle && (
                <p className="text-sm text-neutral-600 mt-1">{subtitle}</p>
              )}
            </div>
            {headerAction && <div className="flex-shrink-0">{headerAction}</div>}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-neutral-500">Loading...</div>
            </div>
          ) : isEmpty ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <p className="text-neutral-500">{emptyMessage}</p>
              </div>
            </div>
          ) : (
            children
          )}
        </div>

        {/* Footer */}
        {footerAction && (
          <div className="pt-4 border-t border-neutral-200">
            {footerAction}
          </div>
        )}
      </Card>
    );
  }
);

DashboardCard.displayName = 'DashboardCard';
