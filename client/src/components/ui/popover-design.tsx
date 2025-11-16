import React, { useState, useRef, useEffect } from 'react';
import { Card } from './card-design';
import { Button } from './button-design';
import { Icon } from './icon-design';

export interface PopoverProps {
  // Structure
  trigger: React.ReactNode;
  children: React.ReactNode;
  
  // State
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  
  // Positioning
  placement?: 'top' | 'bottom' | 'left' | 'right';
  offset?: number;
  showArrow?: boolean;
  
  // Behavior
  closeOnEscape?: boolean;
  closeOnClickOutside?: boolean;
  
  // Styling
  className?: string;
  triggerClassName?: string;
  arrowClassName?: string;
}

interface UsePopoverProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function usePopover(props: UsePopoverProps) {
  const { open: controlledOpen, onOpenChange } = props;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
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

function calculatePopoverPosition(
  triggerEl: HTMLElement,
  contentEl: HTMLElement | null,
  placement: string = 'bottom',
  offset: number = 12,
  showArrow: boolean = true
) {
  const triggerRect = triggerEl.getBoundingClientRect();
  const contentHeight = contentEl?.offsetHeight || 200;
  const contentWidth = contentEl?.offsetWidth || 250;
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  const arrowSize = showArrow ? 8 : 0;

  let top = 0;
  let left = 0;
  let finalPlacement = placement;

  // Vertical positioning
  if (placement === 'bottom') {
    top = triggerRect.bottom + offset + arrowSize;
    if (top + contentHeight > viewportHeight) {
      finalPlacement = 'top';
      top = triggerRect.top - offset - contentHeight - arrowSize;
    }
  } else if (placement === 'top') {
    top = triggerRect.top - offset - contentHeight - arrowSize;
    if (top < 0) {
      finalPlacement = 'bottom';
      top = triggerRect.bottom + offset + arrowSize;
    }
  } else if (placement === 'left') {
    top = triggerRect.top + triggerRect.height / 2 - contentHeight / 2;
  } else if (placement === 'right') {
    top = triggerRect.top + triggerRect.height / 2 - contentHeight / 2;
  }

  // Horizontal positioning
  if (placement === 'bottom' || placement === 'top') {
    left = triggerRect.left + triggerRect.width / 2 - contentWidth / 2;
    if (left < 8) {
      left = 8;
    } else if (left + contentWidth + 8 > viewportWidth) {
      left = viewportWidth - contentWidth - 8;
    }
  } else if (placement === 'left') {
    left = triggerRect.left - offset - contentWidth - arrowSize;
    if (left < 0) {
      finalPlacement = 'right';
      left = triggerRect.right + offset + arrowSize;
    }
  } else if (placement === 'right') {
    left = triggerRect.right + offset + arrowSize;
    if (left + contentWidth > viewportWidth) {
      finalPlacement = 'left';
      left = triggerRect.left - offset - contentWidth - arrowSize;
    }
  }

  return { top, left, placement: finalPlacement };
}

export const Popover = React.forwardRef<HTMLDivElement, PopoverProps>(
  (
    {
      trigger,
      children,
      placement = 'bottom',
      offset = 12,
      showArrow = true,
      closeOnEscape = true,
      closeOnClickOutside = true,
      className,
      triggerClassName,
      arrowClassName,
    },
    ref
  ) => {
    const { isOpen, triggerRef, contentRef, handleOpenChange } = usePopover({});
    const [position, setPosition] = useState({ top: 0, left: 0, placement });

    // Update position when open
    useEffect(() => {
      if (isOpen && triggerRef.current && contentRef.current) {
        const pos = calculatePopoverPosition(
          triggerRef.current,
          contentRef.current,
          placement,
          offset,
          showArrow
        );
        setPosition(pos);
      }
    }, [isOpen, placement, offset, showArrow]);

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

    const getArrowStyle = () => {
      const baseClasses = 'absolute w-4 h-4 bg-white border border-neutral-200';
      const rotationMap = {
        top: 'rotate-45 bottom-[-8px]',
        bottom: 'rotate-45 top-[-8px]',
        left: 'rotate-45 right-[-8px]',
        right: 'rotate-45 left-[-8px]',
      };
      return `${baseClasses} ${rotationMap[position.placement as keyof typeof rotationMap] || rotationMap.bottom}`;
    };

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

        {/* Popover Content */}
        {isOpen && (
          <div
            ref={contentRef}
            className="fixed bg-white border border-neutral-200 rounded-lg shadow-lg z-50"
            style={{
              top: `${position.top}px`,
              left: `${position.left}px`,
            }}
            role="dialog"
            aria-modal="false"
          >
            {/* Arrow */}
            {showArrow && <div className={`${getArrowStyle()} ${arrowClassName || ''}`} />}

            {/* Content */}
            <div className="relative">{children}</div>
          </div>
        )}
      </div>
    );
  }
);

Popover.displayName = 'Popover';

export interface PopoverBodyProps {
  children: React.ReactNode;
  className?: string;
}

export const PopoverBody = React.forwardRef<HTMLDivElement, PopoverBodyProps>(
  ({ children, className }, ref) => {
    return (
      <div ref={ref} className={`p-4 ${className || ''}`}>
        {children}
      </div>
    );
  }
);

PopoverBody.displayName = 'PopoverBody';

export interface PopoverHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const PopoverHeader = React.forwardRef<HTMLDivElement, PopoverHeaderProps>(
  ({ children, className }, ref) => {
    return (
      <div ref={ref} className={`border-b border-neutral-200 p-4 font-semibold ${className || ''}`}>
        {children}
      </div>
    );
  }
);

PopoverHeader.displayName = 'PopoverHeader';
