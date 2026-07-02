import { useEffect, useState } from 'react';

function detectTablet(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return (
    /ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** True on phones — admin tools are blocked; tablets and desktops are allowed. */
export function isAdminPhoneDevice(): boolean {
  if (typeof window === 'undefined') return false;
  if (detectTablet()) return false;

  const ua = navigator.userAgent;
  if (/Android.*Mobile|iPhone|iPod|Windows Phone|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }

  // Narrow touch viewport without a tablet UA (e.g. small Android phones).
  return window.innerWidth < 640 && 'ontouchstart' in window;
}

export function useAdminPhoneDevice(): boolean {
  const [isPhone, setIsPhone] = useState(() => isAdminPhoneDevice());

  useEffect(() => {
    const update = () => setIsPhone(isAdminPhoneDevice());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return isPhone;
}
