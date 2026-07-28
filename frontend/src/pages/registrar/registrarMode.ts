import type { InstitutionMode } from '../../services/academicApi';

/**
 * Registrar Office feature visibility by institution mode.
 * - school: K–12 / board schools — lean office
 * - college: HE / university — full catalog + cross-list
 * - mixed: show everything (default / demos)
 */

export type RegistrarNavId =
  | 'dashboard'
  | 'terms'
  | 'students'
  | 'programs'
  | 'sections'
  | 'grades'
  | 'transcripts'
  | 'reports'
  | 'operations'
  | 'sis'
  | 'settings';

export type SectionsSubTab = 'sections' | 'offerings' | 'crosslist' | 'structure';
export type GradeSubTab = 'matrix' | 'finalize' | 'amendments' | 'repair' | 'periods' | 'policy';
export type SisSubTab = 'import' | 'inbox' | 'jobs' | 'export' | 'health' | 'config';

type ModeFlags = {
  nav: RegistrarNavId[];
  navLabels: Partial<Record<RegistrarNavId, string>>;
  sectionsTabs: SectionsSubTab[];
  gradeTabs: GradeSubTab[];
  sisTabs: SisSubTab[];
  subtitle: string;
  programsTitle: string;
  programsHint: string;
};

const SCHOOL: ModeFlags = {
  nav: [
    'dashboard',
    'terms',
    'students',
    'programs',
    'sections',
    'grades',
    'transcripts',
    'reports',
    'operations',
    'sis',
    'settings',
  ],
  navLabels: {
    programs: 'Streams',
    sections: 'Classes',
    transcripts: 'Report cards',
  },
  sectionsTabs: ['sections'],
  gradeTabs: ['matrix', 'finalize', 'amendments', 'periods', 'policy'],
  sisTabs: ['import', 'inbox', 'jobs', 'export', 'health', 'config'],
  subtitle:
    'School office: terms, class sections, enrollments, grade close, report cards, and optional CSV/SIS sync.',
  programsTitle: 'Streams / tracks',
  programsHint:
    'Optional school streams (e.g. Science, Commerce). Not the same as a teacher creating a class/course.',
};

const COLLEGE: ModeFlags = {
  nav: [
    'dashboard',
    'terms',
    'students',
    'programs',
    'sections',
    'grades',
    'transcripts',
    'reports',
    'operations',
    'sis',
    'settings',
  ],
  navLabels: {
    programs: 'Programs',
    sections: 'Sections',
    transcripts: 'Transcripts',
  },
  sectionsTabs: ['sections', 'offerings', 'crosslist', 'structure'],
  gradeTabs: ['matrix', 'finalize', 'amendments', 'repair', 'periods', 'policy'],
  sisTabs: ['import', 'inbox', 'jobs', 'export', 'health', 'config'],
  subtitle:
    'College office: terms, degree programs, offerings/sections, cross-lists, finalize, transcripts, and SIS.',
  programsTitle: 'Degree programs',
  programsHint:
    'Degree / diploma tracks students belong to (e.g. B.Sc. CS). Separate from LMS courses teachers create.',
};

const MIXED: ModeFlags = {
  nav: COLLEGE.nav,
  navLabels: {},
  sectionsTabs: COLLEGE.sectionsTabs,
  gradeTabs: COLLEGE.gradeTabs,
  sisTabs: COLLEGE.sisTabs,
  subtitle:
    'Manage terms, enrollments, grade status, transcripts, SIS sync, and institutional reports.',
  programsTitle: 'Programs',
  programsHint:
    'Program or stream catalog. Teachers still create LMS courses separately; link students to a program here.',
};

export function getRegistrarModeFlags(mode: InstitutionMode | string | null | undefined): ModeFlags {
  if (mode === 'school') return SCHOOL;
  if (mode === 'college') return COLLEGE;
  return MIXED;
}

export function isRegistrarNavVisible(
  mode: InstitutionMode | string | null | undefined,
  id: RegistrarNavId
): boolean {
  return getRegistrarModeFlags(mode).nav.includes(id);
}
