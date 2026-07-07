import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_GRADING_POLICY,
  type GradingPolicyConfig,
  type ResolvedGradingPolicy,
} from '../utils/gradeUtils';
import type { PolicyApplyMode } from '../components/grades/PolicyApplyModeSelector';
import {
  fetchCourseGradingPolicy,
  previewCoursePolicyImpact,
  saveCourseGradingPolicy,
  fetchCourseLifecycleStatus,
  type PolicyImpactPreview,
} from '../services/gradingApi';

export type { ResolvedGradingPolicy };

function defaultApplyModeForLifecycle(status: string): PolicyApplyMode {
  return status === 'POSTED' ? 'prospective_only' : 'retroactive_all';
}

export function useGradingPolicy(
  courseId: string | undefined,
  options?: { onSaved?: () => void }
) {
  const [resolved, setResolved] = useState<ResolvedGradingPolicy | null>(null);
  const [editPolicy, setEditPolicy] = useState<GradingPolicyConfig>({ ...DEFAULT_GRADING_POLICY });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [impactPreview, setImpactPreview] = useState<PolicyImpactPreview | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [lifecycleStatus, setLifecycleStatus] = useState<string>('DRAFT');
  const [applyMode, setApplyMode] = useState<PolicyApplyMode>('retroactive_all');
  const [effectiveAssignmentId, setEffectiveAssignmentId] = useState<string | null>(null);
  const [saveReason, setSaveReason] = useState('');
  const [impactStep, setImpactStep] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedApplyMode, setSavedApplyMode] = useState<PolicyApplyMode>('retroactive_all');

  const fetchPolicy = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    setError('');
    try {
      const [policyRes, lifecycleRes] = await Promise.all([
        fetchCourseGradingPolicy(courseId),
        fetchCourseLifecycleStatus(courseId).catch(() => null),
      ]);
      if (policyRes.success) {
        const r = policyRes.data.resolved;
        const coursePolicy = policyRes.data.coursePolicy as
          | {
              applyMode?: PolicyApplyMode;
              effectiveAssignmentId?: string;
            }
          | null
          | undefined;
        setResolved(r);
        setEditPolicy({
          missingAssignment: r.missingAssignment ?? DEFAULT_GRADING_POLICY.missingAssignment,
          latePenalty: { ...DEFAULT_GRADING_POLICY.latePenalty, ...r.latePenalty },
          dropLowest: { ...DEFAULT_GRADING_POLICY.dropLowest, ...r.dropLowest },
          categoryCaps: { ...DEFAULT_GRADING_POLICY.categoryCaps, ...r.categoryCaps },
          attendance: { ...DEFAULT_GRADING_POLICY.attendance, ...r.attendance },
          gpaScale: { ...DEFAULT_GRADING_POLICY.gpaScale, ...r.gpaScale },
        });
        const lifecycleDefault = defaultApplyModeForLifecycle(
          lifecycleRes?.success ? lifecycleRes.data?.status || 'DRAFT' : 'DRAFT'
        );
        const loadedApplyMode = coursePolicy?.applyMode || lifecycleDefault;
        setApplyMode(loadedApplyMode);
        setSavedApplyMode(loadedApplyMode);
        if (coursePolicy?.effectiveAssignmentId) {
          setEffectiveAssignmentId(String(coursePolicy.effectiveAssignmentId));
        }
        setDirty(false);
        setImpactPreview(null);
        setImpactStep(false);
        setSaveReason('');
      }
      if (lifecycleRes?.success) {
        setLifecycleStatus(lifecycleRes.data?.status || 'DRAFT');
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message || 'Failed to load grading policy');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (courseId) fetchPolicy();
  }, [courseId, fetchPolicy]);

  useEffect(() => {
    if (showModal && courseId) fetchPolicy();
  }, [showModal, courseId, fetchPolicy]);

  const loadImpactPreview = useCallback(
    async (mode: PolicyApplyMode, assignmentId?: string | null) => {
      if (!courseId) return;
      if (mode === 'from_assignment' && !assignmentId) {
        setError('Select a cutoff assignment for from-assignment apply mode.');
        return;
      }
      setImpactLoading(true);
      setError('');
      try {
        const res = await previewCoursePolicyImpact(courseId, {
          policy: editPolicy,
          applyMode: mode,
          effectiveAssignmentId: assignmentId || undefined,
        });
        if (res.success) {
          setImpactPreview(res.data);
          if (res.data.effectiveAssignmentId) {
            setEffectiveAssignmentId(res.data.effectiveAssignmentId);
          } else if (res.data.assignments?.length && mode === 'from_assignment' && !assignmentId) {
            setEffectiveAssignmentId(res.data.assignments[0].id);
          }
        }
      } catch (err: unknown) {
        const ax = err as { response?: { data?: { message?: string } } };
        setError(ax.response?.data?.message || 'Impact preview failed');
      } finally {
        setImpactLoading(false);
      }
    },
    [courseId, editPolicy]
  );

  const runImpactPreview = async () => {
    setImpactStep(true);
    if (applyMode === 'from_assignment' && !effectiveAssignmentId && courseId) {
      try {
        const bootstrap = await previewCoursePolicyImpact(courseId, {
          policy: editPolicy,
          applyMode: 'retroactive_all',
        });
        const firstId = bootstrap.data?.assignments?.[0]?.id;
        if (firstId) {
          setEffectiveAssignmentId(firstId);
          await loadImpactPreview('from_assignment', firstId);
          return;
        }
      } catch {
        /* fall through */
      }
    }
    await loadImpactPreview(applyMode, effectiveAssignmentId);
  };

  const handleApplyModeChange = async (mode: PolicyApplyMode) => {
    setApplyMode(mode);
    setDirty(true);
    setImpactPreview(null);
    if (impactStep) {
      await loadImpactPreview(mode, effectiveAssignmentId);
    }
  };

  const handleEffectiveAssignmentChange = async (assignmentId: string) => {
    setEffectiveAssignmentId(assignmentId);
    setDirty(true);
    setImpactPreview(null);
    if (impactStep && applyMode === 'from_assignment') {
      await loadImpactPreview('from_assignment', assignmentId);
    }
  };

  const effectiveSavedApplyMode =
    resolved?.policyApplication?.applyMode ?? savedApplyMode;
  const canReviewImpact =
    lifecycleStatus !== 'POSTED' ||
    dirty ||
    applyMode !== savedApplyMode ||
    effectiveSavedApplyMode !== 'retroactive_all';

  const handleSave = async () => {
    if (!courseId) return;

  const reasonRequired = lifecycleStatus === 'POSTED';
    if (reasonRequired && !saveReason.trim()) {
      setError('Please provide a reason for this policy change.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const res = await saveCourseGradingPolicy(courseId, editPolicy, {
        reason: saveReason.trim() || undefined,
        applyMode,
        effectiveAt: impactPreview?.effectiveAt || undefined,
        effectiveAssignmentId:
          impactPreview?.effectiveAssignmentId || effectiveAssignmentId || undefined,
        impactSummary: impactPreview?.summary,
      });
      if (res.success) {
        await fetchPolicy();
        setShowModal(false);
        setImpactStep(false);
        options?.onSaved?.();
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message || 'Failed to save grading policy');
    } finally {
      setSaving(false);
    }
  };

  const setEditPolicyTracked: typeof setEditPolicy = (action) => {
    setDirty(true);
    setImpactPreview(null);
    setEditPolicy(action);
  };

  const closeModal = () => {
    setShowModal(false);
    setImpactStep(false);
    setImpactPreview(null);
    setSaveReason('');
  };

  return {
    resolved,
    editPolicy,
    setEditPolicy: setEditPolicyTracked,
    loading,
    saving,
    error,
    setError,
    impactPreview,
    impactLoading,
    lifecycleStatus,
    applyMode,
    setApplyMode: handleApplyModeChange,
    effectiveAssignmentId,
    setEffectiveAssignmentId: handleEffectiveAssignmentChange,
    saveReason,
    setSaveReason,
    impactStep,
    setImpactStep,
    showModal,
    setShowModal: (open: boolean) => {
      if (!open) closeModal();
      else setShowModal(true);
    },
    dirty,
    canReviewImpact,
    savedApplyMode,
    fetchPolicy,
    handleSave,
    runImpactPreview,
  };
}
