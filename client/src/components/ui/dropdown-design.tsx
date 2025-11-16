import React, { useState, useRef, useEffect } from 'react';
import { Button } from './button-design';
import { Icon } from './icon-design';

export interface DropdownProps {
  // Structure
  trigger: React.ReactNode;
  children: React.ReactNode;
  
  // State
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  
  // Positioning
  placement?: 'top' | 'bottom' | 'left' | 'right';
  offset?: number;
  align?: 'start' | 'center' | 'end';
  
  // Behavior
  closeOnItemClick?: boolean;
  closeOnEscape?: boolean;
  
  // Styling
  className?: string;
  triggerClassName?: string;
}

interface UseDropdownProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function useDropdown(props: UseDropdownProps) {
  const { open: controlledOpen, onOpenChange } = props;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;

  const handleOpenChange = (newOpen: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(newOpen);
    }
    onOpenChange?.(newOpen);
  };

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        contentRef.current &&
        !contentRef.current.contains(e.target as Node)
      ) {
        handleOpenChange(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return { isOpen, triggerRef, contentRef, handleOpenChange };
}

function calculatePosition(
  triggerEl: HTMLElement,
  placement: string = 'bottom',
  align: string = 'start',
  offset: number = 8
) {
  const triggerRect = triggerEl.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  let top = 0;
  let left = 0;

  // Vertical positioning
  if (placement === 'bottom') {
    top = triggerRect.bottom + offset;
    if (top + 200 > viewportHeight) {
      // Auto-flip to top
      top = triggerRect.top - offset - 200;
    }
  } else if (placement === 'top') {
    top = triggerRect.top - offset - 200;
    if (top < 0) {
      // Auto-flip to bottom
      top = triggerRect.bottom + offset;
    }
  } else if (placement === 'left') {
    top = triggerRect.top + triggerRect.height / 2 - 100;
  } else if (placement === 'right') {
    top = triggerRect.top + triggerRect.height / 2 - 100;
  }

  // Horizontal positioning
  if (placement === 'bottom' || placement === 'top') {
    if (align === 'start') {
      left = triggerRect.left;
    } else if (align === 'center') {
      left = triggerRect.left + triggerRect.width / 2 - 75;
    } else {
      left = triggerRect.right - 150;
    }
  } else if (placement === 'left') {
    left = triggerRect.left - 150 - offset;
  } else if (placement === 'right') {
    left = triggerRect.right + offset;
  }

  return { top, left };
}

export const Dropdown = React.forwardRef<HTMLDivElement, DropdownProps>(
  (
    {
      trigger,
      children,
      placement = 'bottom',
      offset = 8,
      align = 'start',
      closeOnItemClick = true,
      closeOnEscape = true,
      className,
      triggerClassName,
      ...props
    },
    ref
  ) => {
    const { isOpen, triggerRef, contentRef, handleOpenChange } = useDropdown(props);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    // Update position when open
    useEffect(() => {
      if (isOpen && triggerRef.current) {
        const pos = calculatePosition(triggerRef.current, placement, align, offset);
        setPosition(pos);
      }
    }, [isOpen, placement, align, offset]);

    // Handle escape key
    useEffect(() => {
      if (!isOpen) return;

      const handleEscape = (e: KeyboardEvent) => {
        if (closeOnEscape && e.key === 'Escape') {
          handleOpenChange(false);
        }
      };

      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, closeOnEscape]);

    return (
      <div ref={ref} className={`relative ${className || ''}`}>
        {/* Trigger */}
        <div
          ref={triggerRef}
          onClick={() => handleOpenChange(!isOpen)}
          className={triggerClassName}
        >
          {trigger}
        </div>

        {/* Menu Content */}
        {isOpen && (
          <div
            ref={contentRef}
            className="fixed bg-white border border-neutral-200 rounded-md shadow-lg z-50 min-w-max"
            style={{
              top: `${position.top}px`,
              left: `${position.left}px`,
            }}
            role="menu"
          >
            {children}
          </div>
        )}
      </div>
    );
  }
);

Dropdown.displayName = 'Dropdown';

export interface DropdownItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export const DropdownItem = React.forwardRef<HTMLButtonElement, DropdownItemProps>(
  ({ children, onClick, disabled = false, className }, ref) => {
    return (
      <button
        ref={ref}
        onClick={onClick}
        disabled={disabled}
        className={`w-full text-left px-4 py-2 hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors ${className || ''}`}
        role="menuitem"
      >
        {children}
      </button>
    );
  }
);

DropdownItem.displayName = 'DropdownItem';

export interface DropdownDividerProps {
  className?: string;
}

export const DropdownDivider = React.forwardRef<HTMLDivElement, DropdownDividerProps>(
  ({ className }, ref) => {
    return <div ref={ref} className={`border-t border-neutral-200 my-1 ${className || ''}`} role="separator" />;
  }
);

DropdownDivider.displayName = 'DropdownDivider';

export interface DropdownLabelProps {
  children: React.ReactNode;
  className?: string;
}

export const DropdownLabel = React.forwardRef<HTMLDivElement, DropdownLabelProps>(
  ({ children, className }, ref) => {
    return (
      <div
        ref={ref}
        className={`px-4 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wide ${className || ''}`}
        role="presentation"
      >
        {children}
      </div>
    );
  }
);

DropdownLabel.displayName = 'DropdownLabel';
