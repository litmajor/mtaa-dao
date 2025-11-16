import React, { useState, useRef, useEffect } from 'react';
import { Button } from './button-design';
import { Input } from './input-design';
import { Icon } from './icon-design';

export interface SelectOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps {
  // Structure
  options: SelectOption[];
  placeholder?: string;
  
  // State
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  
  // Behavior
  disabled?: boolean;
  searchable?: boolean;
  clearable?: boolean;
  multiple?: boolean;
  
  // Styling
  className?: string;
  triggerClassName?: string;
}

interface UseSelectProps {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function useSelect(props: UseSelectProps) {
  const { value: controlledValue, defaultValue, onValueChange, open: controlledOpen, onOpenChange } = props;
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue || '');
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);

  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;
  
  const isOpenControlled = controlledOpen !== undefined;
  const isOpen = isOpenControlled ? controlledOpen : uncontrolledOpen;

  const handleValueChange = (newValue: string) => {
    if (!isControlled) {
      setUncontrolledValue(newValue);
    }
    onValueChange?.(newValue);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isOpenControlled) {
      setUncontrolledOpen(newOpen);
    }
    onOpenChange?.(newOpen);
  };

  const filteredOptions = props.options.filter(opt =>
    opt.label.toString().toLowerCase().includes(searchQuery.toLowerCase())
  );

  return {
    value,
    isOpen,
    searchQuery,
    filteredOptions,
    contentRef,
    handleValueChange,
    handleOpenChange,
    setSearchQuery,
  };
}

export const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  (
    {
      options,
      placeholder = 'Select an option',
      disabled = false,
      searchable = false,
      clearable = false,
      className,
      triggerClassName,
      ...props
    },
    ref
  ) => {
    const { value, isOpen, searchQuery, filteredOptions, contentRef, handleValueChange, handleOpenChange, setSearchQuery } =
      useSelect({ options, ...props });

    const selectedOption = options.find(opt => opt.value === value);
    const handleClickOutside = (e: MouseEvent) => {
      if (ref && typeof ref !== 'function' && !ref.current?.contains(e.target as Node)) {
        handleOpenChange(false);
      }
    };

    useEffect(() => {
      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
      }
    }, [isOpen]);

    return (
      <div ref={ref} className={`relative ${className || ''}`}>
        {/* Trigger Button */}
        <Button
          onClick={() => handleOpenChange(!isOpen)}
          disabled={disabled}
          className={`w-full justify-between ${triggerClassName || ''}`}
          variant="outline"
        >
          <span>{selectedOption?.label || placeholder}</span>
          <Icon name="chevron-down" size="sm" className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </Button>

        {/* Dropdown Content */}
        {isOpen && (
          <div
            ref={contentRef}
            className="absolute top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-md shadow-lg z-50"
            role="listbox"
          >
            {/* Search Input */}
            {searchable && (
              <div className="p-2 border-b border-neutral-200">
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="h-8"
                />
              </div>
            )}

            {/* Options */}
            <div className="max-h-60 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="p-4 text-center text-neutral-500 text-sm">No options found</div>
              ) : (
                filteredOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => {
                      handleValueChange(option.value);
                      handleOpenChange(false);
                    }}
                    disabled={option.disabled}
                    className={`w-full text-left px-4 py-2 hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed flex items-center ${
                      value === option.value ? 'bg-primary-light text-primary-dark' : ''
                    }`}
                    role="option"
                    aria-selected={value === option.value}
                  >
                    {option.label}
                    {value === option.value && <Icon name="check" size="sm" className="ml-auto" />}
                  </button>
                ))
              )}
            </div>

            {/* Clear Button */}
            {clearable && value && (
              <div className="border-t border-neutral-200 p-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    handleValueChange('');
                    handleOpenChange(false);
                  }}
                  className="w-full"
                >
                  Clear selection
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
