import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { AcademicTerm, registrarGet, registrarPost } from './registrarApi';
import {
  fetchEffectiveCoursePolicy,
  fetchInstitutionPolicyImpactSummary,
  previewCoursePolicyImpact,
  type InstitutionPolicyImpactSummary,
  type PolicyImpactPreview as PolicyImpactPreviewData,
} from '../../services/gradingApi';
import PolicyImpactPreview from '../../components/grades/PolicyImpactPreview';
import { downloadPolicyImpactCsv } from '../../utils/exportImpactCsv';

type GradeRow = {
  courseId: string;
  title: string;
  courseCode: string;
  sectionNumber: string;
  lifecycleStatus: string;
  finalizedAt: string | null;
  studentSnapshotCount: number;
  studentCount?: number;
};

type Widgets = {
  unfinalized: number;
  amendmentsThisTerm: number;
  missingSnapshots: number;
  policyChangesSinceFinalize: number;
  openInstitutionPeriods: number;
  unlinkedSections?: number;
};

type UnlinkedSection = {
  sectionId: string;
  sectionNumber?: string;
  status?: string;
  offeringCode?: string;
  offeringTitle?: string;
  repairHint?: string;
};

type PolicyChange = {
  _id: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  createdAt?: string;
  actor?: { email?: string };
  after?: { policyHash?: string };
};

type Amendment = {
  _id: string;
  reason?: string;
  createdAt?: string;
  sequence?: number;
  course?: { title?: string; catalog?: { courseCode?: string } };
  amendedBy?: { email?: string };
};

type Period = {
  _id: string;
  name: string;
  position: number;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  closeDate?: string | null;
  weight?: number | null;
};

type Tab = 'matrix' | 'finalize' | 'amendments' | 'repair' | 'periods' | 'policy';

export function RegistrarGradeStatus() {
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [termId, setTermId] = useState('');
  const [tab, setTab] = useState<Tab>('matrix');
  const [rows, setRows] = useState<GradeRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [widgets, setWidgets] = useState<Widgets | null>(null);
  const [amendments, setAmendments] = useState<Amendment[]>([]);
  const [policyChanges, setPolicyChanges] = useState<PolicyChange[]>([]);
  const [missingSnapshotRows, setMissingSnapshotRows] = useState<GradeRow[]>([]);
  const [unlinkedSections, setUnlinkedSections] = useState<UnlinkedSection[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [preview, setPreview] = useState<{
    toFinalize?: number;
    alreadyFinalized?: number;
    unlinkedSectionCount?: number;
    blockedByUnlinkedSections?: boolean;
  } | null>(null);
  const [forceFinalize, setForceFinalize] = useState(false);
  const [periodForm, setPeriodForm] = useState({ name: '', position: '0', weight: '' });
  const [jobId, setJobId] = useState('');
  const [jobStatus, setJobStatus] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [institutionImpact, setInstitutionImpact] = useState<InstitutionPolicyImpactSummary | null>(null);
  const [impactCourseId, setImpactCourseId] = useState('');
  const [impactPreview, setImpactPreview] = useState<PolicyImpactPreviewData | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactSaveReason, setImpactSaveReason] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const res = await registrarGet<{ data: AcademicTerm[] }>('/api/academic-structure/terms');
        const list = res.data || [];
        setTerms(list);
        if (list[0]?._id) setTermId(list[0]._id);
      } catch (err: unknown) {
        setError(
          axios.isAxiosError(err) && err.response?.data?.message
            ? String(err.response.data.message)
            : 'Failed to load terms'
        );
      }
    })();
  }, []);

  const loadDashboard = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [res, impactRes] = await Promise.all([
        registrarGet<{
          data: {
            rows: GradeRow[];
            counts: Record<string, number>;
            widgets: Widgets;
            amendments: Amendment[];
            policyChangesSinceFinalize?: PolicyChange[];
            missingSnapshotRows?: GradeRow[];
            unlinkedSections?: UnlinkedSection[];
          };
        }>(`/api/registrar/terms/${id}/grades-dashboard`),
        fetchInstitutionPolicyImpactSummary().catch(() => null),
      ]);
      setRows(res.data?.rows || []);
      setCounts(res.data?.counts || {});
      setWidgets(res.data?.widgets || null);
      setAmendments(res.data?.amendments || []);
      setPolicyChanges(res.data?.policyChangesSinceFinalize || []);
      setMissingSnapshotRows(res.data?.missingSnapshotRows || []);
      setUnlinkedSections(res.data?.unlinkedSections || []);
      if (impactRes?.success) setInstitutionImpact(impactRes.data);
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Failed to load grade dashboard'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPeriods = useCallback(async (id: string) => {
    if (!id) return;
    const res = await registrarGet<{ data: Period[] }>(`/api/registrar/terms/${id}/grading-periods`);
    setPeriods(res.data || []);
  }, []);

  useEffect(() => {
    if (!termId) return;
    void loadDashboard(termId);
    void loadPeriods(termId);
  }, [termId, loadDashboard, loadPeriods]);

  const runPreview = async () => {
    setError('');
    const res = await registrarPost<{
      data: {
        toFinalize: number;
        alreadyFinalized: number;
        unlinkedSectionCount?: number;
        blockedByUnlinkedSections?: boolean;
        unlinkedSections?: UnlinkedSection[];
      };
    }>(`/api/registrar/terms/${termId}/finalize/preview`, {});
    setPreview(res.data);
    if (res.data?.unlinkedSections) setUnlinkedSections(res.data.unlinkedSections);
    setMessage(
      `Preview: ${res.data?.toFinalize || 0} to finalize, ${res.data?.alreadyFinalized || 0} already done` +
        (res.data?.unlinkedSectionCount
          ? `, ${res.data.unlinkedSectionCount} unlinked section(s) block finalize`
          : '')
    );
  };

  const applyFinalize = async () => {
    setError('');
    setMessage('');
    try {
      const res = await registrarPost<{
        data: {
          jobId?: string;
          status?: string;
          async?: boolean;
          finalized?: number;
          failed?: number;
          toFinalize?: number;
        };
      }>(`/api/registrar/terms/${termId}/finalize`, { async: true, force: forceFinalize });
      if (res.data?.jobId) {
        setJobId(String(res.data.jobId));
        setJobStatus(res.data.status || 'pending');
        setMessage(
          res.data.async
            ? `Term finalize job queued (${res.data.toFinalize || 0} courses)`
            : `Term finalize completed inline`
        );
      } else {
        setMessage(`Finalized ${res.data?.finalized || 0}, failed ${res.data?.failed || 0}`);
      }
      await loadDashboard(termId);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.code === 'UNLINKED_SECTIONS') {
        const data = err.response.data.data as { unlinkedSections?: UnlinkedSection[] } | undefined;
        if (data?.unlinkedSections) setUnlinkedSections(data.unlinkedSections);
        setTab('repair');
      }
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Finalize failed'
      );
    }
  };

  const createContentCourse = async (sectionId: string) => {
    setBusy(true);
    setError('');
    try {
      await registrarPost(`/api/registrar/sections/${sectionId}/link-course`, { create: true });
      setMessage('Content course created and linked');
      await loadDashboard(termId);
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Link/create failed'
      );
    } finally {
      setBusy(false);
    }
  };

  const repairSnapshots = async (courseId: string) => {
    setBusy(true);
    setError('');
    try {
      const res = await registrarPost<{ data: { frozenCount?: number } }>(
        `/api/registrar/courses/${courseId}/repair-snapshots`,
        {}
      );
      setMessage(`Repaired snapshots (${res.data?.frozenCount ?? 0} frozen)`);
      await loadDashboard(termId);
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Repair failed'
      );
    } finally {
      setBusy(false);
    }
  };

  const refreshJob = async () => {
    if (!jobId) return;
    const res = await registrarGet<{ data: { status: string; progress?: { completed: number; total: number }; result?: unknown } }>(
      `/api/registrar/jobs/${jobId}`
    );
    setJobStatus(res.data?.status || '');
    const p = res.data?.progress;
    setMessage(
      `Job ${res.data?.status}${p ? ` · ${p.completed}/${p.total}` : ''}`
    );
    if (res.data?.status === 'completed') await loadDashboard(termId);
  };

  const createPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    await registrarPost(`/api/registrar/terms/${termId}/grading-periods`, {
      name: periodForm.name,
      position: Number(periodForm.position) || 0,
      weight: periodForm.weight ? Number(periodForm.weight) : null,
    });
    setPeriodForm({ name: '', position: '0', weight: '' });
    setMessage('Period created');
    await loadPeriods(termId);
    await loadDashboard(termId);
  };

  const closePeriod = async (id: string) => {
    await registrarPost(`/api/registrar/grading-periods/${id}/close`, {});
    setMessage('Period closed (course periods mirrored when matching)');
    await loadPeriods(termId);
    await loadDashboard(termId);
  };

  const inheritPeriods = async () => {
    const res = await registrarPost<{ data: { applied: number; courses: number } }>(
      `/api/registrar/terms/${termId}/grading-periods/inherit`,
      {}
    );
    setMessage(`Inherited ${res.data?.applied || 0} period rows onto courses`);
  };

  const runCourseImpactPreview = async (courseId: string) => {
    setImpactLoading(true);
    setImpactCourseId(courseId);
    setError('');
    setImpactPreview(null);
    try {
      const effective = await fetchEffectiveCoursePolicy(courseId);
      const policy = effective?.data?.policy || effective?.data;
      const res = await previewCoursePolicyImpact(courseId, {
        policy,
        applyMode: 'retroactive_all',
      });
      setImpactPreview(res.data || res);
      setMessage(`Impact preview loaded for course ${courseId.slice(-6)}`);
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Policy impact preview failed'
      );
    } finally {
      setImpactLoading(false);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'matrix', label: 'Status matrix' },
    { id: 'finalize', label: 'Term finalize' },
    { id: 'amendments', label: 'Amendments' },
    { id: 'repair', label: 'Repair queue' },
    { id: 'periods', label: 'Grading periods' },
    { id: 'policy', label: 'Policy impact' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm">
          Term
          <select
            className="mt-1 block rounded border dark:bg-gray-800 px-2 py-1"
            value={termId}
            onChange={(e) => setTermId(e.target.value)}
          >
            {terms.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name || t.code}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="text-sm text-blue-600" onClick={() => void loadDashboard(termId)}>
          Refresh
        </button>
      </div>

      {widgets && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 text-sm">
          {(
            [
              ['Unfinalized', widgets.unfinalized],
              ['Amendments', widgets.amendmentsThisTerm],
              ['Missing snapshots', widgets.missingSnapshots],
              ['Unlinked sections', widgets.unlinkedSections ?? unlinkedSections.length],
              ['Policy changes since finalize', widgets.policyChangesSinceFinalize],
              ['Open periods', widgets.openInstitutionPeriods],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded border border-gray-200 dark:border-gray-700 px-3 py-2">
              <div className="text-xs text-gray-500 uppercase">{label}</div>
              <div className="text-xl font-semibold">{value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1 border-b pb-2 border-gray-200 dark:border-gray-700">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-sm rounded-md ${
              tab === t.id
                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}
      {message && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </div>
      )}

      {loading && <p className="text-sm text-gray-500">Loading…</p>}

      {tab === 'matrix' && (
        <>
          <div className="flex flex-wrap gap-2 text-sm">
            {Object.entries(counts).map(([k, v]) => (
              <span key={k} className="rounded bg-gray-100 dark:bg-gray-800 px-2 py-1">
                {k}: <strong>{v}</strong>
              </span>
            ))}
          </div>
          <div className="overflow-x-auto border rounded-md border-gray-200 dark:border-gray-700">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 text-left">
                <tr>
                  <th className="px-3 py-2">Course</th>
                  <th className="px-3 py-2">Section</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Students</th>
                  <th className="px-3 py-2">Snapshots</th>
                  <th className="px-3 py-2">Finalized</th>
                  <th className="px-3 py-2">Policy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {rows.map((r) => (
                  <tr key={r.courseId}>
                    <td className="px-3 py-2">
                      {r.courseCode ? `${r.courseCode} · ` : ''}
                      {r.title}
                    </td>
                    <td className="px-3 py-2">{r.sectionNumber || '—'}</td>
                    <td className="px-3 py-2 font-medium">{r.lifecycleStatus}</td>
                    <td className="px-3 py-2">{r.studentCount ?? '—'}</td>
                    <td className="px-3 py-2">{r.studentSnapshotCount}</td>
                    <td className="px-3 py-2">
                      {r.finalizedAt ? new Date(r.finalizedAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-blue-600 text-xs"
                        onClick={() => {
                          setTab('policy');
                          void runCourseImpactPreview(r.courseId);
                        }}
                      >
                        Preview impact
                      </button>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={7} className="px-3 py-4 text-gray-500">
                      No courses linked to this term.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'finalize' && (
        <div className="space-y-3 text-sm max-w-xl">
          <p className="text-gray-600 dark:text-gray-400">
            Preview then finalize all non-finalized courses in the term. Large runs use the{' '}
            <code>grades.term_finalize</code> async job. Unlinked sections must be repaired first (or force).
          </p>
          {(unlinkedSections.length > 0 || preview?.blockedByUnlinkedSections) && (
            <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100">
              {unlinkedSections.length || preview?.unlinkedSectionCount || 0} section(s) lack a content course.{' '}
              <button type="button" className="underline" onClick={() => setTab('repair')}>
                Open repair queue
              </button>
            </div>
          )}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={forceFinalize}
              onChange={(e) => setForceFinalize(e.target.checked)}
            />
            Force finalize (skip unlinked-section block)
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded border px-3 py-1.5" onClick={() => void runPreview()}>
              Preview
            </button>
            <button
              type="button"
              className="rounded bg-indigo-600 text-white px-3 py-1.5"
              onClick={() => void applyFinalize()}
            >
              Finalize term
            </button>
            {jobId && (
              <button type="button" className="rounded border px-3 py-1.5" onClick={() => void refreshJob()}>
                Refresh job ({jobStatus || '…'})
              </button>
            )}
          </div>
          {preview && (
            <div className="rounded border px-3 py-2">
              Ready: <strong>{preview.toFinalize}</strong> · Already finalized:{' '}
              <strong>{preview.alreadyFinalized}</strong>
              {preview.unlinkedSectionCount != null && (
                <>
                  {' '}
                  · Unlinked: <strong>{preview.unlinkedSectionCount}</strong>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'amendments' && (
        <ul className="divide-y border rounded-md text-sm border-gray-200 dark:border-gray-700">
          {amendments.map((a) => (
            <li key={a._id} className="px-3 py-2">
              <div className="font-medium">
                {a.course?.catalog?.courseCode || ''} {a.course?.title || 'Course'} · seq{' '}
                {a.sequence ?? '—'}
              </div>
              <div className="text-gray-600 dark:text-gray-400">{a.reason || 'Amendment'}</div>
              <div className="text-xs text-gray-500">
                {a.amendedBy?.email || ''} · {a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}
              </div>
            </li>
          ))}
          {!amendments.length && <li className="px-3 py-4 text-gray-500">No amendments this term.</li>}
        </ul>
      )}

      {tab === 'repair' && (
        <div className="space-y-6 text-sm">
          <section>
            <h3 className="font-medium mb-2">Unlinked sections (no lmsCourseId)</h3>
            <ul className="divide-y border rounded-md border-gray-200 dark:border-gray-700">
              {unlinkedSections.map((s) => (
                <li key={s.sectionId} className="px-3 py-2 flex justify-between gap-2 items-start">
                  <div>
                    <div className="font-medium">
                      {s.offeringCode || ''} {s.offeringTitle || 'Offering'} · sec {s.sectionNumber || '—'}
                    </div>
                    <div className="text-gray-500">{s.status} · {s.repairHint}</div>
                  </div>
                  <button
                    type="button"
                    className="text-blue-600 shrink-0"
                    disabled={busy}
                    onClick={() => void createContentCourse(s.sectionId)}
                  >
                    Create &amp; link course
                  </button>
                </li>
              ))}
              {!unlinkedSections.length && (
                <li className="px-3 py-3 text-gray-500">All sections in scope have a content course.</li>
              )}
            </ul>
          </section>
          <section>
            <h3 className="font-medium mb-2">Missing snapshots (FINALIZED/AMENDED)</h3>
            <ul className="divide-y border rounded-md border-gray-200 dark:border-gray-700">
              {missingSnapshotRows.map((r) => (
                <li key={r.courseId} className="px-3 py-2 flex justify-between gap-2 items-start">
                  <div>
                    <div className="font-medium">
                      {r.courseCode ? `${r.courseCode} · ` : ''}
                      {r.title}
                    </div>
                    <div className="text-gray-500">
                      {r.lifecycleStatus} · students {r.studentCount ?? '—'} · snapshots{' '}
                      {r.studentSnapshotCount}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-blue-600 shrink-0"
                    disabled={busy}
                    onClick={() => void repairSnapshots(r.courseId)}
                  >
                    Repair snapshots
                  </button>
                </li>
              ))}
              {!missingSnapshotRows.length && (
                <li className="px-3 py-3 text-gray-500">No missing-snapshot courses in scope.</li>
              )}
            </ul>
          </section>
        </div>
      )}

      {tab === 'periods' && (
        <div className="space-y-4 text-sm">
          <form onSubmit={createPeriod} className="grid gap-2 sm:grid-cols-4 border rounded-md p-3">
            <input
              className="rounded border dark:bg-gray-800 px-2 py-1"
              placeholder="Period name"
              value={periodForm.name}
              onChange={(e) => setPeriodForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
            <input
              className="rounded border dark:bg-gray-800 px-2 py-1"
              placeholder="Position"
              value={periodForm.position}
              onChange={(e) => setPeriodForm((f) => ({ ...f, position: e.target.value }))}
            />
            <input
              className="rounded border dark:bg-gray-800 px-2 py-1"
              placeholder="Weight %"
              value={periodForm.weight}
              onChange={(e) => setPeriodForm((f) => ({ ...f, weight: e.target.value }))}
            />
            <button type="submit" className="rounded bg-indigo-600 text-white px-3 py-1.5">
              Add period
            </button>
          </form>
          <button type="button" className="text-blue-600" onClick={() => void inheritPeriods()}>
            Inherit periods onto courses missing periods
          </button>
          <ul className="divide-y border rounded-md border-gray-200 dark:border-gray-700">
            {periods.map((p) => (
              <li key={p._id} className="px-3 py-2 flex justify-between gap-2">
                <div>
                  <div className="font-medium">
                    {p.name} <span className="text-gray-500 font-normal">#{p.position}</span>
                  </div>
                  <div className="text-gray-500">
                    {p.status}
                    {p.weight != null ? ` · weight ${p.weight}` : ''}
                  </div>
                </div>
                {p.status === 'open' && (
                  <button type="button" className="text-blue-600" onClick={() => void closePeriod(p._id)}>
                    Close
                  </button>
                )}
              </li>
            ))}
            {!periods.length && <li className="px-3 py-4 text-gray-500">No institution periods yet.</li>}
          </ul>
        </div>
      )}

      {tab === 'policy' && (
        <div className="space-y-4 text-sm">
          {institutionImpact && institutionImpact.totalPublishedCourses > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100">
              Institution defaults would recalculate live grades in{' '}
              <strong>{institutionImpact.liveRecalcCourseCount}</strong> published course
              {institutionImpact.liveRecalcCourseCount === 1 ? '' : 's'}.{' '}
              <strong>{institutionImpact.finalizedCourseCount}</strong> finalized course
              {institutionImpact.finalizedCourseCount === 1 ? '' : 's'} keep frozen snapshots.
            </div>
          )}

          <section>
            <h3 className="font-medium mb-2">Policy changes since earliest finalize</h3>
            <ul className="divide-y border rounded-md border-gray-200 dark:border-gray-700">
              {policyChanges.map((p) => (
                <li key={p._id} className="px-3 py-2">
                  <div className="font-medium">
                    {p.action || 'policy change'} · {p.entityType || 'entity'}
                  </div>
                  <div className="text-gray-500">
                    {p.actor?.email || 'system'}
                    {p.after?.policyHash ? ` · hash ${String(p.after.policyHash).slice(0, 10)}…` : ''}
                  </div>
                  <div className="text-xs text-gray-500">
                    {p.createdAt ? new Date(p.createdAt).toLocaleString() : ''}
                  </div>
                </li>
              ))}
              {!policyChanges.length && (
                <li className="px-3 py-3 text-gray-500">No policy audit rows since finalize for this term.</li>
              )}
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="font-medium">Per-course impact preview</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Uses the course&apos;s current effective policy with retroactive apply mode (same engine as the
              grading policy modal).
            </p>
            <div className="flex flex-wrap gap-2">
              {rows.slice(0, 12).map((r) => (
                <button
                  key={r.courseId}
                  type="button"
                  className={`rounded border px-2 py-1 text-xs ${
                    impactCourseId === r.courseId ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950' : ''
                  }`}
                  disabled={impactLoading}
                  onClick={() => void runCourseImpactPreview(r.courseId)}
                >
                  {r.courseCode || r.title.slice(0, 18) || r.courseId.slice(-6)}
                </button>
              ))}
            </div>
            {impactLoading && <p className="text-gray-500">Loading impact…</p>}
            {impactPreview && (
              <div className="space-y-2">
                <PolicyImpactPreview
                  impact={impactPreview}
                  loading={impactLoading}
                  saveReason={impactSaveReason}
                  onSaveReasonChange={setImpactSaveReason}
                  onExportCsv={() => downloadPolicyImpactCsv(impactPreview)}
                />
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default RegistrarGradeStatus;
