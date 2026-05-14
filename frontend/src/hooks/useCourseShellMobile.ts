import { useEffect, useState } from 'react';

/** Same breakpoint / UA logic as CourseDetail / PageViewWrapper for course shell layout. */
export function useCourseShellMobile(): boolean {
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const screenWidth = window.screen.width;
      const viewportWidth = window.innerWidth;

      const isTablet =
        /ipad|tablet|playbook|silk|(android(?!.*mobile))|kindle/i.test(userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
        (screenWidth >= 768 && screenWidth <= 1024 && 'ontouchstart' in window);

      const isPhone =
        ((/android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent) ||
          (/mobile/i.test(userAgent) && !isTablet)) &&
          !isTablet);

      setIsMobileDevice(isPhone && screenWidth < 768 && viewportWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobileDevice;
}
