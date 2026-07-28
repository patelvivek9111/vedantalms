import api from './api';
import type { RubricSnapshot } from '../components/assignments/RubricViewer';

export type RubricBankScope = 'course' | 'account' | 'all';

export type RubricBankItem = RubricSnapshot & {
  _id: string;
  courseId?: string | null;
  scope?: 'course' | 'account';
  workflowState?: string;
  pointsPossible?: number;
  updatedAt?: string;
  freeFormCriterionComments?: boolean;
  /** Assignments currently linked via rubricId (Canvas associations). */
  associationCount?: number;
};

function unwrap<T>(payload: any): T {
  if (payload?.data !== undefined) return payload.data as T;
  return payload as T;
}

export async function listRubrics(params: {
  courseId?: string;
  scope?: RubricBankScope;
  q?: string;
  includeArchived?: boolean;
}): Promise<RubricBankItem[]> {
  const { data } = await api.get('/rubrics', { params });
  return unwrap<RubricBankItem[]>(data) || [];
}

export async function getRubric(id: string): Promise<RubricBankItem> {
  const { data } = await api.get(`/rubrics/${id}`);
  return unwrap<RubricBankItem>(data);
}

export async function getRubricAssociations(id: string): Promise<{
  associationCount: number;
  assignments: Array<{ _id: string; title: string }>;
}> {
  const { data } = await api.get(`/rubrics/${id}/associations`);
  return unwrap(data);
}

export async function createRubric(body: {
  title: string;
  criteria: RubricSnapshot['criteria'];
  courseId?: string | null;
  freeFormCriterionComments?: boolean;
}): Promise<RubricBankItem> {
  const { data } = await api.post('/rubrics', body);
  return unwrap<RubricBankItem>(data);
}

export async function updateRubric(
  id: string,
  body: Partial<{
    title: string;
    criteria: RubricSnapshot['criteria'];
    freeFormCriterionComments: boolean;
    workflowState: 'active' | 'archived' | 'deleted';
  }>
): Promise<RubricBankItem> {
  const { data } = await api.put(`/rubrics/${id}`, body);
  return unwrap<RubricBankItem>(data);
}

export async function deleteRubric(id: string): Promise<{
  _id: string;
  workflowState: string;
  detachedAssignmentCount?: number;
}> {
  const { data } = await api.delete(`/rubrics/${id}`);
  return unwrap(data);
}

export async function copyRubric(
  id: string,
  body: { courseId?: string | null; title?: string } = {}
): Promise<RubricBankItem> {
  const { data } = await api.post(`/rubrics/${id}/copy`, body);
  return unwrap<RubricBankItem>(data);
}

export function bankItemToSnapshot(item: RubricBankItem): RubricSnapshot {
  return {
    title: item.title || 'Rubric',
    pointsPossible: item.pointsPossible ?? 0,
    freeFormCriterionComments: item.freeFormCriterionComments !== false,
    criteria: item.criteria || [],
    rubricId: String(item._id),
  };
}
