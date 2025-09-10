
import { useEffect, useState, useCallback } from 'react';

interface AccessibilityPreferences {
  reducedMotion: boolean;
  highContrast: boolean;
  increasedFontSize: boolean;
  screenReader: boolean;
}

export const useAccessibility = () => {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>({
    reducedMotion: false,
    highContrast: false,
    increasedFontSize: false,
    screenReader: false,
  });

  const detectReducedMotion = useCallback(() => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const detectHighContrast = useCallback(() => {
    return window.matchMedia('(prefers-contrast: high)').matches;
  }, []);

  const detectScreenReader = useCallback(() => {
    // Check for screen reader indicators
    return !!(
      navigator.userAgent.match(/NVDA|JAWS|VoiceOver|ORCA|WindowEyes|Dragon|ZoomText|MagPie/) ||
      window.speechSynthesis ||
      document.querySelector('[aria-live]')
    );
  }, []);

  const announceToScreenReader = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }, []);

  const setFontSize = useCallback((size: 'normal' | 'large' | 'larger') => {
    const root = document.documentElement;
    root.classList.remove('font-size-normal', 'font-size-large', 'font-size-larger');
    root.classList.add(`font-size-${size}`);
    
    setPreferences(prev => ({
      ...prev,
      increasedFontSize: size !== 'normal'
    }));
  }, []);

  const setHighContrast = useCallback((enabled: boolean) => {
    const root = document.documentElement;
    if (enabled) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }
    
    setPreferences(prev => ({
      ...prev,
      highContrast: enabled
    }));
  }, []);

  const skipToContent = useCallback(() => {
    const mainContent = document.querySelector('main, #main-content, [role="main"]') as HTMLElement;
    if (mainContent) {
      mainContent.focus();
      mainContent.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    // Initial detection
    setPreferences(prev => ({
      ...prev,
      reducedMotion: detectReducedMotion(),
      highContrast: detectHighContrast(),
      screenReader: detectScreenReader(),
    }));

    // Listen for media query changes
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)');

    const handleReducedMotionChange = (e: MediaQueryListEvent) => {
      setPreferences(prev => ({ ...prev, reducedMotion: e.matches }));
      
      if (e.matches) {
        document.documentElement.classList.add('reduce-motion');
      } else {
        document.documentElement.classList.remove('reduce-motion');
      }
    };

    const handleHighContrastChange = (e: MediaQueryListEvent) => {
      setPreferences(prev => ({ ...prev, highContrast: e.matches }));
    };

    reducedMotionQuery.addEventListener('change', handleReducedMotionChange);
    highContrastQuery.addEventListener('change', handleHighContrastChange);

    // Apply initial classes
    if (detectReducedMotion()) {
      document.documentElement.classList.add('reduce-motion');
    }

    return () => {
      reducedMotionQuery.removeEventListener('change', handleReducedMotionChange);
      highContrastQuery.removeEventListener('change', handleHighContrastChange);
    };
  }, [detectReducedMotion, detectHighContrast, detectScreenReader]);

  return {
    preferences,
    announceToScreenReader,
    setFontSize,
    setHighContrast,
    skipToContent,
  };
};
