
import { useEffect, useCallback, useRef } from 'react';

interface UseKeyboardNavigationProps {
  onEscape?: () => void;
  onEnter?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onTab?: () => void;
  onShiftTab?: () => void;
  onHome?: () => void;
  onEnd?: () => void;
  onPageUp?: () => void;
  onPageDown?: () => void;
  enabled?: boolean;
  preventDefaultOnArrows?: boolean;
  trapFocus?: boolean;
  autoFocus?: boolean;
}

export const useKeyboardNavigation = ({
  onEscape,
  onEnter,
  onArrowUp,
  onArrowDown,
  onArrowLeft,
  onArrowRight,
  onTab,
  onShiftTab,
  onHome,
  onEnd,
  onPageUp,
  onPageDown,
  enabled = true,
  preventDefaultOnArrows = true,
  trapFocus = false,
  autoFocus = false
}: UseKeyboardNavigationProps) => {
  const containerRef = useRef<HTMLElement | null>(null);

  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];
    
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(', ');
    
    return Array.from(containerRef.current.querySelectorAll(focusableSelectors)) as HTMLElement[];
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    const { key, shiftKey, ctrlKey, altKey, metaKey } = event;

    // Don't handle if modifier keys are pressed (except Shift for certain keys)
    if (ctrlKey || altKey || metaKey) return;

    switch (key) {
      case 'Escape':
        onEscape?.();
        break;
      case 'Enter':
        onEnter?.();
        break;
      case 'ArrowUp':
        if (preventDefaultOnArrows) event.preventDefault();
        onArrowUp?.();
        break;
      case 'ArrowDown':
        if (preventDefaultOnArrows) event.preventDefault();
        onArrowDown?.();
        break;
      case 'ArrowLeft':
        if (preventDefaultOnArrows) event.preventDefault();
        onArrowLeft?.();
        break;
      case 'ArrowRight':
        if (preventDefaultOnArrows) event.preventDefault();
        onArrowRight?.();
        break;
      case 'Tab':
        if (trapFocus) {
          event.preventDefault();
          const focusableElements = getFocusableElements();
          if (focusableElements.length === 0) return;
          
          const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement);
          let nextIndex;
          
          if (shiftKey) {
            nextIndex = currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1;
            onShiftTab?.();
          } else {
            nextIndex = currentIndex >= focusableElements.length - 1 ? 0 : currentIndex + 1;
            onTab?.();
          }
          
          focusableElements[nextIndex]?.focus();
        } else {
          if (shiftKey) {
            onShiftTab?.();
          } else {
            onTab?.();
          }
        }
        break;
      case 'Home':
        onHome?.();
        break;
      case 'End':
        onEnd?.();
        break;
      case 'PageUp':
        onPageUp?.();
        break;
      case 'PageDown':
        onPageDown?.();
        break;
    }
  }, [
    enabled, onEscape, onEnter, onArrowUp, onArrowDown, onArrowLeft, onArrowRight,
    onTab, onShiftTab, onHome, onEnd, onPageUp, onPageDown,
    preventDefaultOnArrows, trapFocus, getFocusableElements
  ]);

  useEffect(() => {
    if (enabled) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [enabled, handleKeyDown]);

  useEffect(() => {
    if (autoFocus && enabled && containerRef.current) {
      const focusableElements = getFocusableElements();
      focusableElements[0]?.focus();
    }
  }, [autoFocus, enabled, getFocusableElements]);

  return {
    containerRef,
    setContainer: (element: HTMLElement | null) => {
      containerRef.current = element;
    }
  };
};
