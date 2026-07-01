export const MIN_PASSWORD_LENGTH = 8;

export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (!password) {
    return { valid: false, message: 'Password is required' };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one letter' };
  }
  if (!/\d/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  return { valid: true };
}

export function passwordPolicyHint(): string {
  return 'At least 8 characters with one letter and one number';
}

/** Use cookie-based auth for fetch calls (httpOnly session cookie). */
export function authFetchInit(init: RequestInit = {}): RequestInit {
  return {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.headers || {}),
    },
  };
}
