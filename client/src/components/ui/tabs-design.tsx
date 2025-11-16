import React, { useState, useCallback } from 'react';

export interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined);

export function useTabs() {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error('useTabs must be used within Tabs component');
  }
  return context;
}

export interface TabsProps {
  // Structure
  children: React.ReactNode;
  
  // State
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  
  // Behavior
  disabled?: boolean;
  orientation?: 'horizontal' | 'vertical';
  
  // Styling
  variant?: 'underline' | 'pill' | 'card';
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
}

export const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  (
    {
      children,
      value: controlledValue,
      defaultValue = '',
      onValueChange,
      disabled = false,
      orientation = 'horizontal',
      variant = 'underline',
      className,
      triggerClassName,
      contentClassName,
    },
    ref
  ) => {
    const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : uncontrolledValue;

    const handleValueChange = useCallback(
      (newValue: string) => {
        if (!isControlled) {
          setUncontrolledValue(newValue);
        }
        onValueChange?.(newValue);
      },
      [isControlled, onValueChange]
    );

    const contextValue: TabsContextValue = {
      value,
      onValueChange: handleValueChange,
    };

    return (
      <TabsContext.Provider value={contextValue}>
        <div
          ref={ref}
          className={`flex ${orientation === 'vertical' ? 'flex-col' : 'flex-row'} ${className || ''}`}
          data-orientation={orientation}
        >
          <div className={triggerClassName} />
          <div className={contentClassName} />
          {React.Children.map(children, child => {
            if (!React.isValidElement(child)) return null;
            return React.cloneElement(child as React.ReactElement<any>, {
              variant,
              orientation,
            });
          })}
        </div>
      </TabsContext.Provider>
    );
  }
);

Tabs.displayName = 'Tabs';

export interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

export const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ children, className }, ref) => {
    return (
      <div
        ref={ref}
        role="tablist"
        className={`flex border-b border-neutral-200 ${className || ''}`}
      >
        {children}
      </div>
    );
  }
);

TabsList.displayName = 'TabsList';

export interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  variant?: 'underline' | 'pill' | 'card';
}

export const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ value, children, disabled = false, className, variant = 'underline' }, ref) => {
    const { value: activeValue, onValueChange } = useTabs();
    const isActive = activeValue === value;

    const variantClasses = {
      underline: isActive ? 'border-b-2 border-primary-base text-primary-base' : 'border-b-2 border-transparent text-neutral-600 hover:text-neutral-900',
      pill: isActive ? 'bg-primary-base text-white rounded-full' : 'bg-neutral-100 text-neutral-600 rounded-full hover:bg-neutral-200',
      card: isActive ? 'bg-white border border-neutral-200 border-b-0 rounded-t-lg' : 'bg-neutral-50 border border-neutral-200 border-b-0 rounded-t-lg hover:bg-neutral-100',
    };

    return (
      <button
        ref={ref}
        role="tab"
        aria-selected={isActive}
        aria-disabled={disabled}
        onClick={() => !disabled && onValueChange(value)}
        disabled={disabled}
        className={`px-4 py-2 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${className || ''}`}
      >
        {children}
      </button>
    );
  }
);

TabsTrigger.displayName = 'TabsTrigger';

export interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ value, children, className }, ref) => {
    const { value: activeValue } = useTabs();
    const isActive = activeValue === value;

    if (!isActive) return null;

    return (
      <div
        ref={ref}
        role="tabpanel"
        className={`py-4 ${className || ''}`}
        data-value={value}
      >
        {children}
      </div>
    );
  }
);

TabsContent.displayName = 'TabsContent';
