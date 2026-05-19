import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_GRADING_POLICY,
  type GradingPolicyConfig,
  type ResolvedGradingPolicy,
} from '../utils/gradeUtils';
import {
  fetchCourseGradingPolicy,
  previewCourseGradingPolicy,
  saveCourseGradingPolicy,
} from '../services/gradingApi';

export type { ResolvedGradingPolicy };

export function useGradingPolicy(courseId: string | undefined) {
  const [resolved, setResolved] = useState<ResolvedGradingPolicy | null>(null);
  const [editPolicy, setEditPolicy] = useState<GradingPolicyConfig>({ ...DEFAULT_GRADING_POLICY });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ totalPercent: number; letterGrade: string } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [dirty, setDirty] = useState(false);

  const fetchPolicy = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetchCourseGradingPolicy(courseId);
      if (res.success) {
        const r = res.data.resolved;
        setResolved(r);
        setEditPolicy({
          missingAssignment: r.missingAssignment ?? DEFAULT_GRADING_POLICY.missingAssignment,
          latePenalty: { ...DEFAULT_GRADING_POLICY.latePenalty, ...r.latePenalty },
          dropLowest: { ...DEFAULT_GRADING_POLICY.dropLowest, ...r.dropLowest },
          categoryCaps: { ...DEFAULT_GRADING_POLICY.categoryCaps, ...r.categoryCaps },
          attendance: { ...DEFAULT_GRADING_POLICY.attendance, ...r.attendance },
          gpaScale: { ...DEFAULT_GRADING_POLICY.gpaScale, ...r.gpaScale },
        });
        setDirty(false);
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

  const handleSave = async () => {
    if (!courseId) return;
    setSaving(true);
    setError('');
    try {
      const res = await saveCourseGradingPolicy(courseId, editPolicy);
      if (res.success) {
        await fetchPolicy();
        setShowModal(false);
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message || 'Failed to save grading policy');
    } finally {
      setSaving(false);
    }
  };

  const runPreview = async () => {
    if (!courseId) return;
    setError('');
    try {
      const res = await previewCourseGradingPolicy(courseId, {
        policy: editPolicy,
        sampleAssignments: [
          { id: 's1', group: 'Assignments', totalPoints: 100, dueDate: '2020-01-01' },
          { id: 's2', group: 'Assignments', totalPoints: 100, dueDate: '2020-01-01' },
        ],
        sampleGrades: [
          { assignmentId: 's1', points: 80 },
          { assignmentId: 's2', points: 60 },
        ],
      });
      if (res.success) setPreview(res.data);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message || 'Preview failed');
    }
  };

  const setEditPolicyTracked: typeof setEditPolicy = (action) => {
    setDirty(true);
    setEditPolicy(action);
  };

  return {
    resolved,
    editPolicy,
    setEditPolicy: setEditPolicyTracked,
    loading,
    saving,
    error,
    setError,
    preview,
    showModal,
    setShowModal,
    dirty,
    fetchPolicy,
    handleSave,
    runPreview,
  };
}
