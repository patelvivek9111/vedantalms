import axios from 'axios';
import { API_URL } from '../../config';
import { getMemoryAuthToken } from '../../utils/authToken';

export function registrarAuthHeaders() {
  const token = getMemoryAuthToken();
  return { Authorization: `Bearer ${token}` };
}

export function registrarUrl(path: string) {
  return `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function registrarGet<T = unknown>(path: string, params?: Record<string, string | number | undefined>) {
  const res = await axios.get(registrarUrl(path), {
    headers: registrarAuthHeaders(),
    params,
  });
  return res.data as T;
}

export async function registrarPost<T = unknown>(path: string, body?: unknown) {
  const res = await axios.post(registrarUrl(path), body ?? {}, {
    headers: registrarAuthHeaders(),
  });
  return res.data as T;
}

export async function registrarPatch<T = unknown>(path: string, body?: unknown) {
  const res = await axios.patch(registrarUrl(path), body ?? {}, {
    headers: registrarAuthHeaders(),
  });
  return res.data as T;
}

export function downloadCsv(filename: string, csvText: string) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type AcademicTerm = {
  _id: string;
  name: string;
  code: string;
  termType?: string;
  status?: string;
  startDate?: string | null;
  endDate?: string | null;
  enrollmentOpenDate?: string | null;
  enrollmentCloseDate?: string | null;
  gradingPeriodCloseDate?: string | null;
  finalizeDeadline?: string | null;
  academicYearLabel?: string;
  legacyTermLabel?: string;
  legacyYear?: number | null;
  sisTermCode?: string;
  isDefault?: boolean;
};
