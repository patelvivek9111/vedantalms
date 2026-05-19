import { useCallback, useEffect, useState } from 'react';
import {
  amendCourseGrades,
  fetchCourseLifecycle,
  fetchLifecycleAuditTimeline,
  fetchLifecycleProvenance,
  finalizeCourseGrades,
  postCourseGrades,
} from '../services/gradingApi';
import { useAsyncJob } from './useAsyncJob';

export type LifecycleStatus = 'DRAFT' | 'POSTED' | 'FINALIZED' | 'AMENDED';

export interface CourseLifecycleData {
  lifecycle: {
    _id: string;
    status: LifecycleStatus;
    policyHash?: string;
    policyVersion?: number;
    gradingEngineVersion?: string;
    finalizedAt?: string;
    studentSnapshotCount?: number;
  };
  term: string;
  year: number;
  gradingEngineVersion: string;
}

export interface GradeProvenance {
  term: string;
  year: number;
  lifecycle: CourseLifecycleData['lifecycle'];
  gradingEngineVersion: string;
  lifecyclePolicyHash?: string | null;
  effectivePolicyHash: string;
  effectivePolicyVersion: number;
  policyChain: {
    institution: { version: number } | null;
    course: { version: number } | null;
    resolved: { version: number; hash: string };
  };
  snapshots: { current: number; superseded: number };
  amendmentCount: number;
}

export interface TimelineEntry {
  id: string;
  at: string;
  category: string;
  action: string;
  summary: string;
  severity: string;
  actor?: { name: string; role?: string } | null;
  metadata?: Record<string, unknown> | null;
}

const REGISTRAR_ROLES = new Set(['admin', 'registrar', 'department_admin']);

export function useCourseGradeLifecycle(courseId: string | undefined, userRole?: string) {
  const [lifecycleData, setLifecycleData] = useState<CourseLifecycleData | null>(null);
  const [provenance, setProvenance] = useState<GradeProvenance | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const asyncJob = useAsyncJob();

  const canFinalize = userRole ? REGISTRAR_ROLES.has(userRole) : false;
  const canAmend = canFinalize;
  const canPost = userRole === 'teacher' || canFinalize;

  const refresh = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    setError('');
    try {
      const [lc, prov, tl] = await Promise.all([
        fetchCourseLifecycle(courseId),
        fetchLifecycleProvenance(courseId),
        fetchLifecycleAuditTimeline(courseId),
      ]);
      if (lc.success) setLifecycleData(lc.data);
      if (prov.success) setProvenance(prov.data);
      if (tl.success) setTimeline(tl.data || []);
    } catch {
      setError('Could not load grade lifecycle data.');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runLifecycleAction = async (
    fn: () => Promise<{ success: boolean; data?: { jobId?: string; async?: boolean; downloadUrl?: string } }>
  ) => {
    if (!courseId) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await fn();
      if (res.data?.jobId && res.data.async) {
        await asyncJob.startFromEnqueue(res.data.jobId, {
          onComplete: () => void refresh(),
        });
      } else {
        await refresh();
      }
    } catch {
      setError('Action failed. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const postGrades = () => runLifecycleAction(() => postCourseGrades(courseId!));
  const finalizeGrades = () => runLifecycleAction(() => finalizeCourseGrades(courseId!));
  const amendGrades = (reason: string) =>
    runLifecycleAction(() => amendCourseGrades(courseId!, reason));

  return {
    lifecycleData,
    provenance,
    timeline,
    loading,
    error,
    actionLoading,
    canPost,
    canFinalize,
    canAmend,
    refresh,
    postGrades,
    finalizeGrades,
    amendGrades,
    asyncJob,
  };
}
