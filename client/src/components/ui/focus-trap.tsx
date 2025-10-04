import React, { useEffect, useRef, ReactNode } from 'react';

interface FocusTrapProps {
  children: ReactNode;
  enabled?: boolean;
  autoFocus?: boolean;
  restoreFocus?: boolean;
  initialFocus?: string; // CSS selector
  finalFocus?: string; // CSS selector
}

export function FocusTrap({
  children,
  enabled = true,
  autoFocus = true,
  restoreFocus = true,
  initialFocus,
  finalFocus
}: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  const getFocusableElements = (): HTMLElement[] => {
    if (!containerRef.current) return [];

    const focusableSelectors = [
      'button:not([disabled]):not([aria-hidden="true"])',
      'input:not([disabled]):not([aria-hidden="true"])',
      'select:not([disabled]):not([aria-hidden="true"])',
      'textarea:not([disabled]):not([aria-hidden="true"])',
      'a[href]:not([aria-hidden="true"])',
      '[tabindex]:not([tabindex="-1"]):not([aria-hidden="true"])',
      '[contenteditable="true"]:not([aria-hidden="true"])'
    ].join(', ');

    return Array.from(containerRef.current.querySelectorAll(focusableSelectors))
      .filter((el) => {
        const element = el as HTMLElement;
        return element.offsetWidth > 0 && element.offsetHeight > 0;
      }) as HTMLElement[];
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!enabled || event.key !== 'Tab') return;

    const focusableElements = getFocusableElements();
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  };

  useEffect(() => {
    if (!enabled) return;

    // Store the previously focused element
    previouslyFocusedElementRef.current = document.activeElement as HTMLElement;

    // Focus initial element
    if (autoFocus) {
      const focusableElements = getFocusableElements();

      let elementToFocus: HTMLElement | null = null;

      if (initialFocus) {
        elementToToFocus = containerRef.current?.querySelector(initialFocus) as HTMLElement;
      }

      if (!elementToFocus && focusableElements.length > 0) {
        elementToFocus = focusableElements[0];
      }

      if (elementToFocus) {
        // Use setTimeout to ensure the element is rendered
        setTimeout(() => elementToFocus?.focus(), 0);
      }
    }

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);

      // Restore focus to previously focused element
      if (restoreFocus && previouslyFocusedElementRef.current) {
        let elementToFocus = previouslyFocusedElementRef.current;

        if (finalFocus) {
          const finalElement = document.querySelector(finalFocus) as HTMLElement;
          if (finalElement) {
            elementToFocus = finalElement;
          }
        }

        setTimeout(() => elementToFocus?.focus(), 0);
      }
    };
  }, [enabled, autoFocus, restoreFocus, initialFocus, finalFocus]);

  return (
    <div ref={containerRef} style={{ outline: 'none' }}>
      {children}
    </div>
  );
}