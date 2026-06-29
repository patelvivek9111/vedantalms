import { useEffect, useState } from 'react';

/** Tailwind `lg` breakpoint — matches bottom nav and mobile layout hooks. */
const MOBILE_SHELL_MAX_WIDTH = 1023;

function detectTablet(): boolean {
  if (typeof window === 'undefined') return false;
  const userAgent = navigator.userAgent.toLowerCase();
  const screenWidth = window.screen.width;
  return (
    /ipad|tablet|playbook|silk|(android(?!.*mobile))|kindle/i.test(userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
    (screenWidth >= 768 && screenWidth <= 1024 && 'ontouchstart' in window)
  );
}

/** Course shell mobile chrome: drawer sidebar + top bar. Tablets keep desktop shell. */
export function detectCourseShellMobile(): boolean {
  if (typeof window === 'undefined') return false;
  const viewportWidth = window.innerWidth;
  const screenWidth = window.screen.width;
  const isTablet = detectTablet();

  if (isTablet && screenWidth >= 768) {
    return false;
  }

  return viewportWidth <= MOBILE_SHELL_MAX_WIDTH;
}

/** Same breakpoint / UA logic as CourseDetail for course shell layout. */
export function useCourseShellMobile(): boolean {
  const [isMobileDevice, setIsMobileDevice] = useState(() => detectCourseShellMobile());

  useEffect(() => {
    const checkMobile = () => setIsMobileDevice(detectCourseShellMobile());

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobileDevice;
}
