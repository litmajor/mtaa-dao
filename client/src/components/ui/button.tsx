import React from 'react';
import clsx from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'default';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** token name from --gradient-<name> or raw gradient string */
  gradient?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

const base = 'inline-flex items-center justify-center font-medium rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition-colors duration-150';

const variantMap: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--semantic-primary)] text-[var(--semantic-primary-foreground)] hover:brightness-95',
  secondary: 'bg-[var(--semantic-secondary)] text-[var(--semantic-secondary-foreground)] hover:brightness-95',
  ghost: 'bg-transparent text-[var(--semantic-foreground)] hover:bg-[var(--semantic-muted)]',
  outline: 'bg-transparent border border-[var(--semantic-border)] text-[var(--semantic-foreground)] hover:bg-[var(--semantic-muted)]',
  danger: 'bg-[var(--semantic-destructive)] text-[var(--semantic-destructive-foreground)] hover:brightness-95',
  default: 'bg-[var(--semantic-card)] text-[var(--semantic-card-foreground)] hover:brightness-98',
};

const sizeMap: Record<ButtonSize, string> = {
  sm: 'h-[var(--size-btn-sm)] px-3 text-sm',
  md: 'h-[var(--size-btn-md)] px-4 text-base',
  lg: 'h-[var(--size-btn-lg)] px-5 text-base',
  icon: 'h-[var(--size-btn-md)] w-[var(--size-btn-md)] p-0',
};

export const Button: React.FC<ButtonProps> = ({ variant = 'default', size = 'md', className, children, loading = false, gradient, icon, iconPosition = 'left', ...rest }) => {
  const isDisabled = !!(rest.disabled || loading);

  const style: React.CSSProperties = { ...(rest.style || {}) };
  if (gradient) {
    if (/^[a-zA-Z0-9_-]+$/.test(gradient)) style.background = `var(--gradient-${gradient})`;
    else if (gradient.trim().startsWith('linear-gradient')) style.background = gradient;
  }

  const classes = clsx(
    base,
    variantMap[variant],
    sizeMap[size],
    className,
    isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:translate-y-0.5 active:translate-y-0'
  );

  return (
    <button className={classes} style={style} aria-disabled={isDisabled} {...rest} disabled={isDisabled}>
      {loading ? (
        <svg className="w-4 h-4 animate-spin mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth="4" strokeOpacity="0.15"></circle><path d="M22 12a10 10 0 00-10-10" strokeWidth="4"></path></svg>
      ) : null}
      {icon && iconPosition === 'left' ? <span className="mr-2 inline-flex items-center">{icon}</span> : null}
      <span>{children}</span>
      {icon && iconPosition === 'right' ? <span className="ml-2 inline-flex items-center">{icon}</span> : null}
    </button>
  );
};

export default Button;

export const buttonVariants = ({ variant = 'default', size = 'md', className = '', loading = false }: { variant?: ButtonVariant; size?: ButtonSize; className?: string; loading?: boolean } = {}) => {
  const isDisabled = loading;
  return clsx(
    base,
    variantMap[variant],
    sizeMap[size],
    className,
    isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:translate-y-0.5 active:translate-y-0'
  );
};
