import type { Location } from 'react-router-dom';

/** After login, return to the protected route the user tried to open (or dashboard). */
export function loginRedirectPath(state: unknown): string {
  const from = (state as { from?: Pick<Location, 'pathname' | 'search' | 'hash'> })?.from;
  if (!from?.pathname?.startsWith('/') || from.pathname.startsWith('//')) {
    return '/dashboard';
  }
  return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`;
}
