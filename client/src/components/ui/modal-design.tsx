import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Card } from './card-design';
import { Button } from './button-design';
import { Icon } from './icon-design';

export interface ModalProps {
  // Structure
  children: React.ReactNode;
  title?: string;
  description?: string;
  
  // State
  open: boolean;
  onOpenChange: (open: boolean) => void;
  
  // Behavior
  closeOnEscape?: boolean;
  closeOnBackdropClick?: boolean;
  closeButton?: boolean;
  
  // Styling
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  overlayClassName?: string;
  
  // Advanced
  portal?: boolean;
  trapFocus?: boolean;
}

function useFocusTrap(enabled: boolean) {
  const contentRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled || !contentRef.current) return;

    // Save current focus
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus first interactive element
    const focusableElements = contentRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements.length > 0) {
      (focusableElements[0] as HTMLElement).focus();
    }

    // Handle tab key within modal
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableEls = Array.from(contentRef.current!.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )) as HTMLElement[];

      if (focusableEls.length === 0) return;

      const firstEl = focusableEls[0];
      const lastEl = focusableEls[focusableEls.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };

    contentRef.current.addEventListener('keydown', handleKeyDown);

    return () => {
      contentRef.current?.removeEventListener('keydown', handleKeyDown);
      // Restore previous focus
      previousFocusRef.current?.focus();
    };
  }, [enabled]);

  return contentRef;
}

function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (locked) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, [locked]);
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

export const Modal = React.forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      children,
      title,
      description,
      open,
      onOpenChange,
      closeOnEscape = true,
      closeOnBackdropClick = true,
      closeButton = true,
      size = 'md',
      className,
      overlayClassName,
      portal = true,
      trapFocus = true,
    },
    ref
  ) => {
    const contentRef = useFocusTrap(trapFocus && open);
    useScrollLock(open);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
      setMounted(true);
    }, []);

    useEffect(() => {
      if (!open) return;

      const handleEscape = (e: KeyboardEvent) => {
        if (closeOnEscape && e.key === 'Escape') {
          onOpenChange(false);
        }
      };

      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }, [open, closeOnEscape, onOpenChange]);

    if (!mounted) return null;

    const content = (
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'} transition-opacity ${overlayClassName || ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        aria-describedby={description ? 'modal-description' : undefined}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/50 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => closeOnBackdropClick && onOpenChange(false)}
          aria-hidden="true"
        />

        {/* Modal Content */}
        <div
          ref={contentRef || ref}
          className={`relative bg-white rounded-lg shadow-2xl ${sizeClasses[size]} mx-4 ${open ? 'scale-100' : 'scale-95'} transition-transform ${className || ''}`}
        >
          {/* Header */}
          {title && (
            <div className="border-b border-neutral-200 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="modal-title" className="text-lg font-semibold text-neutral-900">
                    {title}
                  </h2>
                  {description && (
                    <p id="modal-description" className="text-sm text-neutral-500 mt-1">
                      {description}
                    </p>
                  )}
                </div>
                {closeButton && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onOpenChange(false)}
                    aria-label="Close modal"
                    className="h-8 w-8 p-0"
                  >
                    <Icon name="x" size="sm" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Body */}
          <div className="p-6">{children}</div>
        </div>
      </div>
    );

    if (portal) {
      return ReactDOM.createPortal(content, document.body);
    }

    return content;
  }
);

Modal.displayName = 'Modal';

// Fallback for ReactDOM if not available
let ReactDOM: any;
try {
  ReactDOM = require('react-dom');
} catch {
  ReactDOM = null;
}
