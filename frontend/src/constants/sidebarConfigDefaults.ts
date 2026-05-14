import { navigationItems } from './courseNavigation';

/** Persisted sidebar row (no icon — icons come from `navigationItems`). */
export interface DefaultSidebarConfigItem {
  id: string;
  label: string;
  visible: boolean;
  order: number;
  fixed?: boolean;
}

/** Keys allowed on `course.sidebarConfig.studentVisibility` (includes flags without a nav row). */
export const ALLOWED_STUDENT_VISIBILITY_KEYS = new Set<string>([
  ...navigationItems.map((n) => n.id),
  'quizwave',
]);

/**
 * Default student-visibility flags — single source shared with `useSidebarConfig`
 * and Sidebar “Reset to default”.
 */
export const DEFAULT_SIDEBAR_STUDENT_VISIBILITY: Record<string, boolean> = {
  overview: true,
  syllabus: true,
  modules: true,
  pages: true,
  assignments: true,
  quizzes: true,
  quizwave: true,
  discussions: true,
  announcements: true,
  polls: true,
  groups: true,
  meetings: true,
  attendance: true,
  grades: true,
  gradebook: false,
  students: true,
};

/** Sidebar rows derived from canonical `navigationItems` (order + labels stay in sync). */
export function getDefaultSidebarConfigItems(): DefaultSidebarConfigItem[] {
  return navigationItems.map((navItem, index) => ({
    id: navItem.id,
    label: navItem.label,
    visible: true,
    order: index,
    fixed: navItem.id === 'overview',
  }));
}

/** Merge DB/partial sidebar rows with canonical `navigationItems` and assign unique sequential `order`. */
export function normalizeSidebarItemsForModal(
  raw: DefaultSidebarConfigItem[] | undefined
): DefaultSidebarConfigItem[] {
  const existing = raw?.filter(Boolean) ?? [];
  const map = new Map(existing.map((item) => [item.id, item]));

  const merged = navigationItems.map((navItem, index) => {
    const existingItem = map.get(navItem.id);
    if (existingItem) {
      return {
        id: navItem.id,
        label: navItem.label,
        visible: existingItem.visible !== false,
        order: typeof existingItem.order === 'number' ? existingItem.order : index,
        fixed: navItem.id === 'overview',
      };
    }
    return {
      id: navItem.id,
      label: navItem.label,
      visible: true,
      order: 1000 + index,
      fixed: navItem.id === 'overview',
    };
  });

  merged.sort((a, b) => a.order - b.order);
  return merged.map((item, index) => ({
    ...item,
    order: index,
    fixed: item.id === 'overview',
  }));
}

/** Payload for API: every allowed student-visibility key as a boolean. */
export function buildStudentVisibilityForSave(
  state: Record<string, boolean | undefined>
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const key of ALLOWED_STUDENT_VISIBILITY_KEYS) {
    const v = state[key];
    out[key] = typeof v === 'boolean' ? v : (DEFAULT_SIDEBAR_STUDENT_VISIBILITY[key] ?? true);
  }
  return out;
}

/** Left “Sidebar Items” column: rows the editor cannot reorder (wrong audience for that list). */
export function shouldHideFromSidebarItemsColumn(role: string | undefined, itemId: string): boolean {
  const r = String(role || '').toLowerCase();
  if (r === 'teacher' || r === 'admin') {
    return itemId === 'grades';
  }
  if (r === 'student') {
    return itemId === 'gradebook';
  }
  return false;
}

/** Right “Student Visibility” column: omit toggles for links students never get. */
export function shouldHideFromStudentVisibilityColumn(_role: string | undefined, itemId: string): boolean {
  return itemId === 'gradebook';
}
