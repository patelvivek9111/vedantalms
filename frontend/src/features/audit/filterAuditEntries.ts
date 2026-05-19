import type { TimelineEntry } from '../../hooks/useCourseGradeLifecycle';
import type { AuditFilters } from './AuditFilterBar';

export function filterTimelineEntries(entries: TimelineEntry[], filters: AuditFilters): TimelineEntry[] {
  const q = filters.search.trim().toLowerCase();
  return entries.filter((e) => {
    if (filters.category && e.category !== filters.category) return false;
    if (filters.severity && e.severity !== filters.severity) return false;
    if (!q) return true;
    const hay = `${e.summary} ${e.action} ${e.category} ${e.actor?.name || ''}`.toLowerCase();
    return hay.includes(q);
  });
}

export interface PolicyAuditEntry {
  _id: string;
  createdAt: string;
  oldHash?: string;
  newHash?: string;
  oldPolicy?: Record<string, unknown>;
  newPolicy?: Record<string, unknown>;
  reason?: string;
  actor?: { firstName?: string; lastName?: string; email?: string };
}

export function filterPolicyAuditEntries(entries: PolicyAuditEntry[], filters: AuditFilters): PolicyAuditEntry[] {
  const q = filters.search.trim().toLowerCase();
  return entries.filter((e) => {
    if (!q) return true;
    const actor = e.actor
      ? `${e.actor.firstName || ''} ${e.actor.lastName || ''} ${e.actor.email || ''}`
      : '';
    return `${e.reason || ''} ${actor} ${e.createdAt}`.toLowerCase().includes(q);
  });
}
