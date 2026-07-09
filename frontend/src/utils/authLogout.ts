import type { NavigateFunction } from 'react-router-dom';

/**
 * Complete sign-out: wait for the server to clear the httpOnly cookie, then navigate.
 * Do not use window.location.href here — it aborts the in-flight logout request.
 */
export async function performLogout(
  logout: () => Promise<void>,
  navigate: NavigateFunction
): Promise<void> {
  await logout();
  navigate('/login', { replace: true });
}
