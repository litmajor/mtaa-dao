import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const inputVariants = cva(
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-shorter',
  {
    variants: {
      error: {
        true: 'border-red-base focus-visible:ring-red-base',
        false: '',
      },
      disabled: {
        true: 'bg-muted cursor-not-allowed',
        false: '',
      },
    },
    defaultVariants: {
      error: false,
      disabled: false,
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'disabled'>,
    VariantProps<typeof inputVariants> {
  label?: string;
  error?: boolean;
  errorMessage?: string;
  helperText?: string;
  required?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  disabled?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = 'text',
      label,
      error = false,
      errorMessage,
      helperText,
      required = false,
      icon,
      iconPosition = 'left',
      id,
      disabled = false,
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const ariaInvalid = error ? 'true' : 'false';

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-foreground mb-2"
          >
            {label}
            {required && <span className="text-red-base ml-1">*</span>}
          </label>
        )}

        <div className="relative w-full">
          {icon && iconPosition === 'left' && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none flex items-center">
              {icon}
            </div>
          )}

          {/* eslint-disable-next-line jsx-a11y/aria-proptypes */}
          <input
            type={type}
            id={inputId}
            ref={ref}
            disabled={disabled}
            {...(error && { 'aria-invalid': 'true' })}
            className={cn(
              inputVariants({ error, disabled }),
              icon && iconPosition === 'left' && 'pl-10',
              icon && iconPosition === 'right' && 'pr-10',
              className
            )}
            aria-describedby={
              errorMessage ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
            }
            {...props}
          />

          {icon && iconPosition === 'right' && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none flex items-center">
              {icon}
            </div>
          )}
        </div>

        {errorMessage && error && (
          <p
            id={`${inputId}-error`}
            className="text-sm text-red-base mt-1 flex items-center gap-1"
          >
            {errorMessage}
          </p>
        )}

        {helperText && !error && (
          <p
            id={`${inputId}-helper`}
            className="text-sm text-muted-foreground mt-1"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input, inputVariants };
