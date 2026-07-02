import api from './api';

export interface PostureCheck {
  label: string;
  ok: boolean;
  detail: string;
}

export interface SecurityConfig {
  passwordMinLength: number;
  requireStrongPassword: boolean;
  maxLoginAttempts: number;
  disablePublicRegistration: boolean;
  maintenanceMode: boolean;
  enableTwoFactor: boolean;
  passwordPolicyHint?: string;
  envRegistrationLocked?: boolean;
}

export async function fetchSecurityPosture() {
  const res = await api.get('/admin/security/posture');
  return res.data as {
    success: boolean;
    data: { checks: PostureCheck[]; summary: { passed: number; total: number } };
  };
}

export async function fetchSecurityConfig() {
  const res = await api.get('/admin/security/config');
  return res.data as { success: boolean; data: SecurityConfig };
}

export async function patchSecurityConfig(body: Partial<SecurityConfig>) {
  const res = await api.patch('/admin/security/config', body);
  return res.data as { success: boolean; data: SecurityConfig; message?: string };
}

export async function downloadLoginLog(days = 90) {
  const res = await api.get('/admin/security/login-export', {
    params: { days },
    responseType: 'blob',
  });
  const blob = new Blob([res.data], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `signed-login-activity-${days}d.csv`;
  link.click();
  window.URL.revokeObjectURL(url);
}
