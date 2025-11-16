import React from 'react';
import { Button } from '../ui/button-design';

export interface FormLayoutProps {
  // Metadata
  title?: string;
  subtitle?: string;
  
  // Form content
  children: React.ReactNode;
  
  // Form handling
  onSubmit?: (e: React.FormEvent) => void;
  onCancel?: () => void;
  
  // Layout
  columns?: 1 | 2;
  gap?: 'sm' | 'md' | 'lg';
  
  // Actions
  submitLabel?: string;
  cancelLabel?: string;
  showActions?: boolean;
  
  // States
  isLoading?: boolean;
  isSubmitting?: boolean;
  errors?: Record<string, string>;
  
  // Styling
  className?: string;
  containerClassName?: string;
}

export interface FormFieldProps {
  // Structure
  label?: string;
  name?: string;
  description?: string;
  error?: string;
  
  // Content
  children: React.ReactNode;
  
  // Layout
  colspan?: number;
  required?: boolean;
  
  // State
  isDisabled?: boolean;
  isTouched?: boolean;
  
  // Styling
  className?: string;
  labelClassName?: string;
}

export interface FormActionsProps {
  onSubmit?: () => void;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  alignment?: 'left' | 'center' | 'right';
  className?: string;
}

export interface FormSectionProps {
  // Structure
  title?: string;
  description?: string;
  
  // Content
  children: React.ReactNode;
  
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
};

const alignmentClasses = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
};

export const FormLayout = React.forwardRef<HTMLFormElement, FormLayoutProps>(
  (
    {
      title,
      subtitle,
      children,
      onSubmit,
      onCancel,
      columns = 1,
      gap = 'md',
      submitLabel = 'Submit',
      cancelLabel = 'Cancel',
      showActions = true,
      isLoading = false,
      isSubmitting = false,
      errors = {},
      className,
      containerClassName,
    },
    ref
  ) => {
    return (
      <form
        ref={ref}
        onSubmit={e => {
          e.preventDefault();
          onSubmit?.(e);
        }}
        className={`w-full ${className || ''}`}
      >
        {/* Header */}
        {(title || subtitle) && (
          <div className="mb-6 pb-6 border-b border-neutral-200">
            {title && (
              <h1 className="text-2xl font-bold text-neutral-900">{title}</h1>
            )}
            {subtitle && (
              <p className="mt-2 text-neutral-600">{subtitle}</p>
            )}
          </div>
        )}

        {/* Form Content */}
        <div className={`grid ${columnClasses[columns]} ${gapClasses[gap]} mb-6 ${containerClassName || ''}`}>
          {children}
        </div>

        {/* Actions */}
        {showActions && (
          <FormActions
            onSubmit={() => {}}
            onCancel={onCancel}
            submitLabel={submitLabel}
            cancelLabel={cancelLabel}
            isLoading={isSubmitting || isLoading}
          />
        )}
      </form>
    );
  }
);

FormLayout.displayName = 'FormLayout';

export const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  (
    {
      label,
      name,
      description,
      error,
      children,
      colspan = 1,
      required = false,
      isDisabled = false,
      isTouched = false,
      className,
      labelClassName,
    },
    ref
  ) => {
    const colspanClass = colspan > 1 ? `col-span-1 md:col-span-${colspan}` : '';
    const hasError = isTouched && error;

    return (
      <div ref={ref} className={`flex flex-col gap-1 ${colspanClass} ${className || ''}`}>
        {label && (
          <label className={`text-sm font-medium text-neutral-900 ${labelClassName || ''}`}>
            {label}
            {required && <span className="text-red-600 ml-1">*</span>}
          </label>
        )}

        {description && (
          <p className="text-xs text-neutral-500">{description}</p>
        )}

        <div className={`${hasError ? 'opacity-75' : ''}`}>
          {children}
        </div>

        {hasError && (
          <p className="text-xs text-red-600 mt-1">{error}</p>
        )}
      </div>
    );
  }
);

FormField.displayName = 'FormField';

export const FormActions = React.forwardRef<HTMLDivElement, FormActionsProps>(
  (
    {
      onSubmit,
      onCancel,
      submitLabel = 'Submit',
      cancelLabel = 'Cancel',
      isLoading = false,
      alignment = 'right',
      className,
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={`flex gap-3 pt-6 border-t border-neutral-200 ${alignmentClasses[alignment]} ${className || ''}`}
      >
        {onCancel && (
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
        )}
        <Button
          variant="primary"
          onClick={onSubmit}
          disabled={isLoading}
          type="submit"
        >
          {isLoading ? 'Saving...' : submitLabel}
        </Button>
      </div>
    );
  }
);

FormActions.displayName = 'FormActions';

export const FormSection = React.forwardRef<HTMLDivElement, FormSectionProps>(
  ({ title, description, children, className }, ref) => {
    return (
      <div ref={ref} className={`flex flex-col gap-4 mb-6 ${className || ''}`}>
        {(title || description) && (
          <div className="pb-4 border-b border-neutral-200">
            {title && (
              <h3 className="font-semibold text-neutral-900">{title}</h3>
            )}
            {description && (
              <p className="text-sm text-neutral-600 mt-1">{description}</p>
            )}
          </div>
        )}
        {children}
      </div>
    );
  }
);

FormSection.displayName = 'FormSection';
