import type { Location } from 'react-router-dom';

/** Default post-login home by role (teaching dashboard vs admin vs registrar office). */
export function homePathForRole(role: string | undefined | null): string {
  const r = String(role || '').toLowerCase();
  if (r === 'registrar' || r === 'department_admin') return '/registrar';
  if (r === 'admin' || r === 'platform_admin') return '/dashboard';
  return '/dashboard';
}

function roleCanAccessPath(role: string | undefined | null, pathname: string): boolean {
  const r = String(role || '').toLowerCase();
  if (pathname.startsWith('/admin')) {
    return r === 'admin' || r === 'platform_admin';
  }
  if (pathname.startsWith('/registrar')) {
    return ['admin', 'registrar', 'department_admin', 'platform_admin'].includes(r);
  }
  if (pathname.startsWith('/teacher/')) {
    return r === 'teacher' || r === 'admin';
  }
  if (pathname.startsWith('/reports/transcript')) {
    return r === 'student' || r === 'admin';
  }
  return true;
}

/** After login, return to the protected route the user tried to open (or role home). */
export function loginRedirectPath(state: unknown, role?: string | null): string {
  const from = (state as { from?: Pick<Location, 'pathname' | 'search' | 'hash'> })?.from;
  if (!from?.pathname?.startsWith('/') || from.pathname.startsWith('//')) {
    return homePathForRole(role);
  }
  if (!roleCanAccessPath(role, from.pathname)) {
    return homePathForRole(role);
  }
  return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`;
}
