
import { useState, useEffect } from 'react';

interface BreakpointValues {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  '2xl': number;
}

const defaultBreakpoints: BreakpointValues = {
  xs: 475,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

export type Breakpoint = keyof BreakpointValues;

interface ResponsiveState {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLandscape: boolean;
  isPortrait: boolean;
  currentBreakpoint: Breakpoint;
  isTouch: boolean;
}

export const useResponsive = (breakpoints: Partial<BreakpointValues> = {}) => {
  const bp = { ...defaultBreakpoints, ...breakpoints };
  
  const [state, setState] = useState<ResponsiveState>(() => {
    if (typeof window === 'undefined') {
      return {
        width: 1024,
        height: 768,
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        isLandscape: true,
        isPortrait: false,
        currentBreakpoint: 'lg' as Breakpoint,
        isTouch: false,
      };
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    
    return {
      width,
      height,
      isMobile: width < bp.md,
      isTablet: width >= bp.md && width < bp.lg,
      isDesktop: width >= bp.lg,
      isLandscape: width > height,
      isPortrait: height > width,
      currentBreakpoint: getCurrentBreakpoint(width, bp),
      isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    };
  });

  function getCurrentBreakpoint(width: number, breakpoints: BreakpointValues): Breakpoint {
    if (width >= breakpoints['2xl']) return '2xl';
    if (width >= breakpoints.xl) return 'xl';
    if (width >= breakpoints.lg) return 'lg';
    if (width >= breakpoints.md) return 'md';
    if (width >= breakpoints.sm) return 'sm';
    return 'xs';
  }

  useEffect(() => {
    const updateState = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setState({
        width,
        height,
        isMobile: width < bp.md,
        isTablet: width >= bp.md && width < bp.lg,
        isDesktop: width >= bp.lg,
        isLandscape: width > height,
        isPortrait: height > width,
        currentBreakpoint: getCurrentBreakpoint(width, bp),
        isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      });
    };

    let timeoutId: NodeJS.Timeout;
    const debouncedUpdate = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updateState, 100);
    };

    window.addEventListener('resize', debouncedUpdate);
    window.addEventListener('orientationchange', debouncedUpdate);

    return () => {
      window.removeEventListener('resize', debouncedUpdate);
      window.removeEventListener('orientationchange', debouncedUpdate);
      clearTimeout(timeoutId);
    };
  }, [bp]);

  const isBreakpoint = (breakpoint: Breakpoint) => {
    return state.currentBreakpoint === breakpoint;
  };

  const isBreakpointUp = (breakpoint: Breakpoint) => {
    const breakpointOrder: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
    const currentIndex = breakpointOrder.indexOf(state.currentBreakpoint);
    const targetIndex = breakpointOrder.indexOf(breakpoint);
    return currentIndex >= targetIndex;
  };

  const isBreakpointDown = (breakpoint: Breakpoint) => {
    const breakpointOrder: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
    const currentIndex = breakpointOrder.indexOf(state.currentBreakpoint);
    const targetIndex = breakpointOrder.indexOf(breakpoint);
    return currentIndex <= targetIndex;
  };

  return {
    ...state,
    isBreakpoint,
    isBreakpointUp,
    isBreakpointDown,
    breakpoints: bp,
  };
};
