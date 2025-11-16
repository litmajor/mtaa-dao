import React from 'react';
import { Card } from '../ui/card-design';
import { Button } from '../ui/button-design';
import { Icon } from '../ui/icon-design';

export interface DetailLayoutProps {
  // Metadata
  title: string;
  subtitle?: string;
  
  // Status badge
  status?: string;
  statusColor?: 'success' | 'warning' | 'error' | 'info';
  
  // Header actions
  actions?: DetailAction[];
  onAction?: (action: string) => void;
  
  // Tabs
  tabs?: TabDefinition[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  
  // Content
  children?: React.ReactNode;
  
  // Sidebar
  sidebar?: React.ReactNode;
  
  // Breadcrumb
  breadcrumbs?: BreadcrumbItem[];
  onBreadcrumbClick?: (path: string) => void;
  
  // Loading
  isLoading?: boolean;
  
  // Back button
  onBack?: () => void;
  
  // Styling
  className?: string;
}

export interface DetailAction {
  id: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: string;
  disabled?: boolean;
}

export interface TabDefinition {
  id: string;
  label: string;
  icon?: string;
  badge?: number;
}

export interface BreadcrumbItem {
  label: string;
  path?: string;
  isActive?: boolean;
}

export interface DetailSectionProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

export interface DetailFieldProps {
  label: string;
  value?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export interface DetailRowProps {
  children: React.ReactNode;
  className?: string;
}

export const DetailLayout = React.forwardRef<HTMLDivElement, DetailLayoutProps>(
  (
    {
      title,
      subtitle,
      status,
      statusColor = 'info',
      actions = [],
      onAction,
      tabs = [],
      activeTab,
      onTabChange,
      children,
      sidebar,
      breadcrumbs = [],
      onBreadcrumbClick,
      isLoading = false,
      onBack,
      className,
    },
    ref
  ) => {
    const statusColorMap = {
      success: 'bg-green-100 text-green-800',
      warning: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800',
      info: 'bg-blue-100 text-blue-800',
    };

    return (
      <div ref={ref} className={`w-full flex flex-col gap-6 ${className || ''}`}>
        {/* Breadcrumb */}
        {breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-2 text-sm text-neutral-600">
            {breadcrumbs.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                {idx > 0 && <Icon name="chevron-right" size="sm" />}
                {item.path && !item.isActive ? (
                  <button
                    onClick={() => onBreadcrumbClick?.(item.path!)}
                    className="text-blue-600 hover:text-blue-700 underline"
                  >
                    {item.label}
                  </button>
                ) : (
                  <span className={item.isActive ? 'text-neutral-900 font-medium' : ''}>
                    {item.label}
                  </span>
                )}
              </div>
            ))}
          </nav>
        )}

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
              >
                <Icon name="arrow-left" size="sm" />
                Back
              </button>
            )}
            <div className="flex items-start gap-4 md:items-center">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-neutral-900">{title}</h1>
                  {status && (
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColorMap[statusColor]}`}>
                      {status}
                    </span>
                  )}
                </div>
                {subtitle && (
                  <p className="mt-2 text-neutral-600">{subtitle}</p>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          {actions.length > 0 && (
            <div className="flex flex-wrap gap-2 md:flex-nowrap">
              {actions.map(action => (
                <Button
                  key={action.id}
                  variant={action.variant || 'secondary'}
                  onClick={() => onAction?.(action.id)}
                  disabled={action.disabled}
                >
                  {action.icon && (
                    <Icon name={action.icon} size="sm" className="mr-2" />
                  )}
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        {tabs.length > 0 && (
          <div className="border-b border-neutral-200">
            <div className="flex gap-8 overflow-x-auto">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => onTabChange?.(tab.id)}
                  className={`flex items-center gap-2 px-0 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  {tab.icon && <Icon name={tab.icon} size="sm" />}
                  {tab.label}
                  {tab.badge && (
                    <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-semibold text-white bg-blue-600 rounded-full">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main Content */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-neutral-500">Loading...</div>
          </div>
        ) : sidebar ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">{children}</div>
            <div className="lg:col-span-1">{sidebar}</div>
          </div>
        ) : (
          <div>{children}</div>
        )}
      </div>
    );
  }
);

DetailLayout.displayName = 'DetailLayout';

export const DetailSection = React.forwardRef<HTMLDivElement, DetailSectionProps>(
  ({ title, subtitle, children, className }, ref) => (
    <Card ref={ref} className={`p-6 ${className || ''}`}>
      {(title || subtitle) && (
        <div className="mb-6 pb-6 border-b border-neutral-200">
          {title && (
            <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
          )}
          {subtitle && (
            <p className="mt-2 text-sm text-neutral-600">{subtitle}</p>
          )}
        </div>
      )}
      {children}
    </Card>
  )
);

DetailSection.displayName = 'DetailSection';

export const DetailField = React.forwardRef<HTMLDivElement, DetailFieldProps>(
  ({ label, value, children, className }, ref) => (
    <div ref={ref} className={`mb-4 pb-4 border-b border-neutral-200 last:mb-0 last:pb-0 last:border-0 ${className || ''}`}>
      <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">{label}</p>
      {children ? children : value ? (
        <p className="mt-2 text-sm text-neutral-900">{value}</p>
      ) : (
        <p className="mt-2 text-sm text-neutral-400">Not provided</p>
      )}
    </div>
  )
);

DetailField.displayName = 'DetailField';

export const DetailRow = React.forwardRef<HTMLDivElement, DetailRowProps>(
  ({ children, className }, ref) => (
    <div ref={ref} className={`grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 ${className || ''}`}>
      {children}
    </div>
  )
);

DetailRow.displayName = 'DetailRow';
