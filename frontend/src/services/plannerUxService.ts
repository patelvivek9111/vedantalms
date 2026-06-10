import api from './api';

export function isPlannerUxEnabled(): boolean {
  return (import.meta as any).env?.VITE_PLANNER_UX_ENABLED === 'true';
}

export type PlannerFeedMeta = {
  capped?: boolean;
  totalBeforeCap?: number;
  hiddenByUx?: number;
};

export async function fetchPlannerFeed(): Promise<{ items: any[]; meta: PlannerFeedMeta }> {
  const res = await api.get('/api/planner/feed');
  return {
    items: Array.isArray(res.data?.data) ? res.data.data : [],
    meta: res.data?.meta || {},
  };
}

export async function dismissPlannerItem(itemKey: string) {
  await api.post(`/api/planner/items/${encodeURIComponent(itemKey)}/dismiss`);
}

export async function snoozePlannerItem(itemKey: string, hours = 24) {
  await api.post(`/api/planner/items/${encodeURIComponent(itemKey)}/snooze`, { hours });
}
