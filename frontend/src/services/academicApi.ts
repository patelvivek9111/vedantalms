import api from './api';
import { API_URL } from '../config';
import { getMemoryAuthToken } from '../utils/authToken';

export type InstitutionMode = 'college' | 'school' | 'mixed';
export type CalendarPresetKey =
  | 'us_quarters'
  | 'us_terms'
  | 'india_terms'
  | 'college_semesters';

export interface AcademicSettings {
  institutionMode: InstitutionMode;
  defaultScheduleType: 'single_term' | 'full_year' | 'custom';
  calendarStyle: 'us' | 'india';
  calendarPreset: CalendarPresetKey;
  academicYearStart: number | null;
  useInstitutionCalendar: boolean;
  defaultCreditHoursSchool: number;
  defaultCreditHoursCollege: number;
  reportingTermSchool: string;
  reportingTermCollege: string;
  defaultEnrollmentMethod?: 'open' | 'approval' | 'registrar_only' | 'sis_only';
  holdDefaults?: {
    holdType?: string;
    blocksRegistration?: boolean;
    blocksTranscript?: boolean;
    blocksGrades?: boolean;
  };
}

export interface AcademicSettingsResponse extends AcademicSettings {
  calendarPresets?: Array<{ key: string; calendarType: string; periodCount: number }>;
  termOptions?: Array<{ value: string; label: string }>;
}

export async function fetchAcademicSettings() {
  const res = await api.get('/academic/settings');
  return res.data as { success: boolean; data: AcademicSettingsResponse };
}

export async function updateAcademicSettings(patch: Partial<AcademicSettings>) {
  const res = await api.patch('/academic/settings', patch);
  return res.data as { success: boolean; data: AcademicSettings };
}

export async function applyInstitutionCalendarToCourses() {
  const res = await api.post('/admin/academic/apply-calendar');
  return res.data;
}

export async function downloadReportCard(term: string, year: number) {
  const token = getMemoryAuthToken();
  const url = `${API_URL}/api/reports/report-card?term=${encodeURIComponent(term)}&year=${year}`;
  const r = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!r.ok) throw new Error('Download failed');
  const blob = await r.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `report-card-${term}-${year}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
}
