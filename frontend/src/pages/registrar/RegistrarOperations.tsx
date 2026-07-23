import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import {
  AcademicTerm,
  registrarAuthHeaders,
  registrarGet,
  registrarPatch,
  registrarPost,
  registrarUrl,
} from './registrarApi';

type Tab = 'summary' | 'enrollments' | 'bulk' | 'waitlist' | 'holds' | 'sis';

type Summary = { byStatus: { _id: string; count: number }[]; total: number };
type Hold = {
  _id: string;
  holdType: string;
  reason: string;
  isActive: boolean;
  studentId?: { firstName?: string; lastName?: string; email?: string; _id?: string };
};
type EnrollmentRow = {
  _id: string;
  status: string;
  enrollmentType?: string;
  studentId?: { firstName?: string; lastName?: string; email?: string; _id?: string };
  lmsCourseId?: { _id?: string; title?: string; catalog?: { courseCode?: string } };
  statusHistory?: { status: string; reason?: string; at?: string }[];
};
type SisRow = {
  _id: string;
  batchId: string;
  status: string;
  studentEmail?: string;
  courseCode?: string;
  applyError?: string;
};
type PreviewRow = {
  studentId?: string;
  courseId?: string;
  allowed: boolean;
  violations?: { code: string; message: string; overrideable?: boolean }[];
  warnings?: { code: string; message: string }[];
  student?: { email?: string; firstName?: string; lastName?: string };
  studentRef?: string;
  courseRef?: string;
};
type WaitlistEntry = {
  position?: number;
  student?: { _id?: string; firstName?: string; lastName?: string; email?: string };
};

/** Enrollments / holds / SIS + R2 preview, CSV, transfer, waitlist, history. */
export function RegistrarOperations() {
  const { user } = useAuth();
  const canHolds = ['admin', 'registrar', 'platform_admin'].includes(user?.role || '');
  const canSis = canHolds;

  const [tab, setTab] = useState<Tab>('summary');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [holds, setHolds] = useState<Hold[]>([]);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [termId, setTermId] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [sisRows, setSisRows] = useState<SisRow[]>([]);
  const [sisCsv, setSisCsv] = useState('');
  const [bulkCourseId, setBulkCourseId] = useState('');
  const [bulkStudentIds, setBulkStudentIds] = useState('');
  const [bulkCsv, setBulkCsv] = useState('');
  const [override, setOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [transferEnrollmentId, setTransferEnrollmentId] = useState('');
  const [transferToCourseId, setTransferToCourseId] = useState('');
  const [transferReason, setTransferReason] = useState('Section transfer');
  const [patchId, setPatchId] = useState('');
  const [patchStatus, setPatchStatus] = useState('dropped');
  const [patchReason, setPatchReason] = useState('');
  const [waitlistCourseId, setWaitlistCourseId] = useState('');
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [holdForm, setHoldForm] = useState({
    studentId: '',
    holdType: 'registration',
    reason: '',
    blocksTranscript: false,
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const loadCore = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const requests: Promise<unknown>[] = [
        registrarGet<{ data: Summary }>('/api/registrar/reports/enrollment-summary'),
        registrarGet<{ data: AcademicTerm[] }>('/api/academic-structure/terms'),
      ];
      if (canHolds) {
        requests.push(registrarGet<{ data: Hold[] }>('/api/registrar/holds'));
      }
      const results = await Promise.all(requests);
      const sumRes = results[0] as { data: Summary };
      const termRes = results[1] as { data: AcademicTerm[] };
      setSummary(sumRes.data || null);
      const termList = termRes.data || [];
      setTerms(Array.isArray(termList) ? termList : []);
      setTermId((prev) => prev || termList[0]?._id || '');
      if (canHolds && results[2]) {
        setHolds((results[2] as { data: Hold[] }).data || []);
      }
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Failed to load registrar data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [canHolds]);

  useEffect(() => {
    void loadCore();
  }, [loadCore]);

  const loadEnrollments = async (id: string, status = statusFilter) => {
    if (!id) return;
    const res = await registrarGet<{ data: EnrollmentRow[] }>(`/api/registrar/terms/${id}/enrollments`, {
      status: status === 'all' ? undefined : status,
    });
    setEnrollments(res.data || []);
  };

  const loadSis = async () => {
    const res = await registrarGet<{ data: SisRow[] }>('/api/registrar/sis/staging');
    setSisRows(res.data || []);
  };

  useEffect(() => {
    if ((tab === 'enrollments' || tab === 'bulk') && termId) void loadEnrollments(termId);
    if (tab === 'sis' && canSis) void loadSis();
  }, [tab, termId, canSis, statusFilter]);

  const releaseHold = async (id: string) => {
    await registrarPost(`/api/registrar/holds/${id}/release`, {});
    await loadCore();
  };

  const placeHold = async (e: React.FormEvent) => {
    e.preventDefault();
    await registrarPost('/api/registrar/holds', holdForm);
    setHoldForm({ studentId: '', holdType: 'registration', reason: '', blocksTranscript: false });
    setMessage('Hold placed');
    await loadCore();
  };

  const runPreview = async () => {
    setError('');
    setMessage('');
    try {
      const body = bulkCsv.trim()
        ? { csv: bulkCsv }
        : {
            courseId: bulkCourseId,
            studentIds: bulkStudentIds
              .split(/[\s,]+/)
              .map((s) => s.trim())
              .filter(Boolean),
          };
      const res = await registrarPost<{ data: { results: PreviewRow[]; allowed: number; blocked: number } }>(
        '/api/registrar/enrollments/preview',
        body
      );
      setPreview(res.data?.results || []);
      setMessage(`Preview: ${res.data?.allowed || 0} allowed, ${res.data?.blocked || 0} blocked`);
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Preview failed'
      );
    }
  };

  const bulkEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const body: Record<string, unknown> = bulkCsv.trim()
        ? { csv: bulkCsv }
        : {
            courseId: bulkCourseId,
            studentIds: bulkStudentIds
              .split(/[\s,]+/)
              .map((s) => s.trim())
              .filter(Boolean),
          };
      if (override) {
        body.override = true;
        body.overrideReason = overrideReason;
      }
      const res = await registrarPost<{
        data: { enrolled?: number; failed?: number; skipped?: number };
      }>('/api/registrar/enrollments/bulk', body);
      setMessage(
        `Bulk enroll: ${res.data?.enrolled || 0} ok, ${res.data?.skipped || 0} skipped, ${
          res.data?.failed || 0
        } failed`
      );
      if (termId) await loadEnrollments(termId);
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Bulk enroll failed'
      );
    }
  };

  const doTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await registrarPost(`/api/registrar/enrollments/${transferEnrollmentId}/transfer`, {
        toCourseId: transferToCourseId,
        reason: transferReason,
      });
      setMessage('Transfer complete');
      if (termId) await loadEnrollments(termId);
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Transfer failed'
      );
    }
  };

  const doPatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await registrarPatch(`/api/registrar/enrollments/${patchId}`, {
        status: patchStatus,
        reason: patchReason,
      });
      setMessage('Enrollment updated');
      if (termId) await loadEnrollments(termId);
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Update failed'
      );
    }
  };

  const loadWaitlist = async () => {
    if (!waitlistCourseId) return;
    const res = await registrarGet<{ data: { waitlist: WaitlistEntry[] } }>(
      `/api/registrar/courses/${waitlistCourseId}/waitlist`
    );
    setWaitlist(res.data?.waitlist || []);
  };

  const promoteWaitlist = async (studentId?: string) => {
    setError('');
    try {
      const res = await registrarPost<{ data: { remainingWaitlist?: number } }>(
        `/api/registrar/courses/${waitlistCourseId}/waitlist/promote`,
        studentId ? { studentId } : {}
      );
      setMessage(`Promoted. Remaining on waitlist: ${res.data?.remainingWaitlist ?? 0}`);
      await loadWaitlist();
      if (termId) await loadEnrollments(termId);
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Promote failed'
      );
    }
  };

  const stageSis = async () => {
    const lines = sisCsv.trim().split(/\r?\n/).filter(Boolean);
    const rows = lines.map((line) => {
      const [studentEmail, courseCode, externalStudentId, externalCourseId] = line.split(',').map((x) => x.trim());
      return {
        studentEmail,
        courseCode,
        externalStudentId: externalStudentId || studentEmail,
        externalCourseId: externalCourseId || courseCode,
      };
    });
    const res = await registrarPost<{ data: { batchId?: string; staged?: number } }>(
      '/api/registrar/sis/stage',
      { provider: 'csv', rows }
    );
    setMessage(`Staged batch ${res.data?.batchId} (${res.data?.staged} rows)`);
    await loadSis();
  };

  const applySis = async (batchId: string) => {
    const res = await axios.post(
      registrarUrl('/api/registrar/sis/apply'),
      { batchId },
      { headers: registrarAuthHeaders() }
    );
    setMessage(`Applied ${res.data?.data?.applied || 0}, rejected ${res.data?.data?.rejected || 0}`);
    await loadSis();
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'summary', label: 'Summary' },
    { id: 'enrollments', label: 'History' },
    { id: 'bulk', label: 'Bulk / CSV' },
    { id: 'waitlist', label: 'Waitlist' },
    ...(canHolds ? [{ id: 'holds' as const, label: 'Holds' }] : []),
    ...(canSis ? [{ id: 'sis' as const, label: 'SIS import' }] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
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
        <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-sm text-emerald-800">
          {message}
        </div>
      )}

      {tab === 'summary' && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Enrollment summary</h2>
          {loading && !summary ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : (
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                Total: <span className="font-semibold">{summary?.total ?? 0}</span>
              </div>
              {(summary?.byStatus || []).map((row) => (
                <div key={row._id}>
                  {row._id}: <span className="font-medium">{row.count}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'enrollments' && (
        <section className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <label className="text-sm">
              Term
              <select
                className="mt-1 block rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-800 px-2 py-1"
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
            <label className="text-sm">
              Status
              <select
                className="mt-1 block rounded border dark:bg-gray-800 px-2 py-1"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {['all', 'active', 'dropped', 'withdrawn', 'completed', 'invited', 'inactive'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="text-sm text-blue-600"
              onClick={() => termId && void loadEnrollments(termId)}
            >
              Refresh
            </button>
          </div>

          <form
            onSubmit={doTransfer}
            className="grid gap-2 sm:grid-cols-3 text-sm border rounded-md p-3 border-gray-200 dark:border-gray-700"
          >
            <h3 className="sm:col-span-3 font-medium">Transfer enrollment</h3>
            <input
              className="rounded border px-2 py-1 dark:bg-gray-800"
              placeholder="Enrollment ID"
              value={transferEnrollmentId}
              onChange={(e) => setTransferEnrollmentId(e.target.value)}
              required
            />
            <input
              className="rounded border px-2 py-1 dark:bg-gray-800"
              placeholder="Target course ID"
              value={transferToCourseId}
              onChange={(e) => setTransferToCourseId(e.target.value)}
              required
            />
            <input
              className="rounded border px-2 py-1 dark:bg-gray-800"
              placeholder="Reason"
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              required
            />
            <button type="submit" className="sm:col-span-3 rounded bg-indigo-600 text-white px-3 py-1.5">
              Transfer
            </button>
          </form>

          <form
            onSubmit={doPatch}
            className="grid gap-2 sm:grid-cols-3 text-sm border rounded-md p-3 border-gray-200 dark:border-gray-700"
          >
            <h3 className="sm:col-span-3 font-medium">Update enrollment status</h3>
            <input
              className="rounded border px-2 py-1 dark:bg-gray-800"
              placeholder="Enrollment ID"
              value={patchId}
              onChange={(e) => setPatchId(e.target.value)}
              required
            />
            <select
              className="rounded border px-2 py-1 dark:bg-gray-800"
              value={patchStatus}
              onChange={(e) => setPatchStatus(e.target.value)}
            >
              {['active', 'dropped', 'withdrawn', 'completed', 'inactive'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              className="rounded border px-2 py-1 dark:bg-gray-800"
              placeholder="Audit reason (required)"
              value={patchReason}
              onChange={(e) => setPatchReason(e.target.value)}
              required
            />
            <button type="submit" className="sm:col-span-3 rounded border px-3 py-1.5">
              Save status
            </button>
          </form>

          <ul className="divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-md text-sm">
            {enrollments.map((row) => (
              <li key={row._id} className="px-3 py-2 space-y-1">
                <div className="flex justify-between gap-2">
                  <span>
                    {row.studentId?.firstName} {row.studentId?.lastName} ·{' '}
                    {row.lmsCourseId?.catalog?.courseCode || ''} {row.lmsCourseId?.title || 'Course'}
                  </span>
                  <span className="text-gray-500">{row.status}</span>
                </div>
                <div className="text-xs text-gray-500 font-mono">
                  {row._id}
                  <button
                    type="button"
                    className="ml-2 text-blue-600"
                    onClick={() => setTransferEnrollmentId(row._id)}
                  >
                    use for transfer
                  </button>
                  <button type="button" className="ml-2 text-blue-600" onClick={() => setPatchId(row._id)}>
                    use for patch
                  </button>
                </div>
                {(row.statusHistory || []).slice(-2).length > 0 && (
                  <div className="text-xs text-gray-500">
                    Last: {(row.statusHistory || []).slice(-1)[0]?.reason || row.status}
                  </div>
                )}
              </li>
            ))}
            {!enrollments.length && (
              <li className="px-3 py-4 text-gray-500">No enrollments for this term/filter.</li>
            )}
          </ul>
        </section>
      )}

      {tab === 'bulk' && (
        <section className="space-y-4 text-sm">
          <p className="text-gray-600 dark:text-gray-400">
            Preview runs the enrollment rules engine. CSV format:{' '}
            <code>studentEmailOrId,courseCodeOrId</code>
          </p>
          <form onSubmit={bulkEnroll} className="grid gap-2 border rounded-md p-3 border-gray-200 dark:border-gray-700">
            <input
              className="rounded border px-2 py-1 dark:bg-gray-800"
              placeholder="Course ID (single-course mode)"
              value={bulkCourseId}
              onChange={(e) => setBulkCourseId(e.target.value)}
            />
            <input
              className="rounded border px-2 py-1 dark:bg-gray-800"
              placeholder="Student IDs (comma/space separated)"
              value={bulkStudentIds}
              onChange={(e) => setBulkStudentIds(e.target.value)}
            />
            <textarea
              className="w-full min-h-[100px] rounded border px-2 py-1 font-mono text-xs dark:bg-gray-800"
              placeholder={'student@school.edu,CS101\n68abc...,MATH201'}
              value={bulkCsv}
              onChange={(e) => setBulkCsv(e.target.value)}
            />
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
              Override soft rule violations (capacity, holds, window, prereqs)
            </label>
            {override && (
              <input
                className="rounded border px-2 py-1 dark:bg-gray-800"
                placeholder="Override reason (required)"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                required
              />
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void runPreview()} className="rounded border px-3 py-1.5">
                Preview rules
              </button>
              <button type="submit" className="rounded bg-indigo-600 text-white px-3 py-1.5">
                Apply bulk enroll
              </button>
            </div>
          </form>

          {preview && (
            <ul className="divide-y border rounded-md border-gray-200 dark:border-gray-700">
              {preview.map((row, i) => (
                <li key={i} className="px-3 py-2">
                  <div className="font-medium">
                    {row.student?.email || row.studentId || row.studentRef} →{' '}
                    {row.courseId || row.courseRef}{' '}
                    <span className={row.allowed ? 'text-emerald-600' : 'text-red-600'}>
                      {row.allowed ? 'allowed' : 'blocked'}
                    </span>
                  </div>
                  {(row.violations || []).map((v) => (
                    <div key={v.code} className="text-xs text-red-700">
                      {v.message}
                      {v.overrideable ? ' (overrideable)' : ''}
                    </div>
                  ))}
                  {(row.warnings || []).map((w) => (
                    <div key={w.code} className="text-xs text-amber-700">
                      Warning: {w.message}
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'waitlist' && (
        <section className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-2 items-end">
            <label className="flex-1 min-w-[200px]">
              Course ID
              <input
                className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
                value={waitlistCourseId}
                onChange={(e) => setWaitlistCourseId(e.target.value)}
              />
            </label>
            <button type="button" className="rounded border px-3 py-1.5" onClick={() => void loadWaitlist()}>
              Load waitlist
            </button>
            <button
              type="button"
              className="rounded bg-indigo-600 text-white px-3 py-1.5"
              onClick={() => void promoteWaitlist()}
            >
              Promote first
            </button>
          </div>
          <ul className="divide-y border rounded-md border-gray-200 dark:border-gray-700">
            {waitlist.map((w, i) => (
              <li key={i} className="px-3 py-2 flex justify-between gap-2">
                <span>
                  #{w.position ?? i + 1} {w.student?.firstName} {w.student?.lastName} · {w.student?.email}
                </span>
                <button
                  type="button"
                  className="text-blue-600"
                  onClick={() => void promoteWaitlist(w.student?._id)}
                >
                  Promote
                </button>
              </li>
            ))}
            {!waitlist.length && <li className="px-3 py-4 text-gray-500">No waitlist loaded.</li>}
          </ul>
        </section>
      )}

      {tab === 'holds' && canHolds && (
        <section className="space-y-4">
          <form
            onSubmit={placeHold}
            className="grid gap-2 sm:grid-cols-2 text-sm border rounded-md p-3 border-gray-200 dark:border-gray-700"
          >
            <input
              className="rounded border px-2 py-1 dark:bg-gray-800"
              placeholder="Student ID"
              value={holdForm.studentId}
              onChange={(e) => setHoldForm((f) => ({ ...f, studentId: e.target.value }))}
              required
            />
            <select
              className="rounded border px-2 py-1 dark:bg-gray-800"
              value={holdForm.holdType}
              onChange={(e) => setHoldForm((f) => ({ ...f, holdType: e.target.value }))}
            >
              <option value="registration">registration</option>
              <option value="transcript">transcript</option>
              <option value="financial">financial</option>
              <option value="disciplinary">disciplinary</option>
              <option value="other">other</option>
            </select>
            <input
              className="rounded border px-2 py-1 dark:bg-gray-800 sm:col-span-2"
              placeholder="Reason"
              value={holdForm.reason}
              onChange={(e) => setHoldForm((f) => ({ ...f, reason: e.target.value }))}
              required
            />
            <label className="flex items-center gap-2 text-xs sm:col-span-2">
              <input
                type="checkbox"
                checked={holdForm.blocksTranscript}
                onChange={(e) => setHoldForm((f) => ({ ...f, blocksTranscript: e.target.checked }))}
              />
              Blocks transcript
            </label>
            <button type="submit" className="sm:col-span-2 rounded bg-indigo-600 text-white px-3 py-1.5">
              Place hold
            </button>
          </form>

          <ul className="divide-y divide-gray-200 dark:divide-gray-700 border rounded-md border-gray-200 dark:border-gray-700">
            {holds.map((h) => (
              <li key={h._id} className="flex items-start justify-between gap-3 px-3 py-3 text-sm">
                <div>
                  <div className="font-medium">
                    {h.studentId?.firstName} {h.studentId?.lastName}{' '}
                    <span className="font-normal text-gray-500">({h.holdType})</span>
                  </div>
                  <div className="text-gray-600 dark:text-gray-400 mt-0.5">{h.reason}</div>
                </div>
                <button type="button" onClick={() => void releaseHold(h._id)} className="text-blue-600">
                  Release
                </button>
              </li>
            ))}
            {!holds.length && <li className="px-3 py-4 text-sm text-gray-500">No active holds.</li>}
          </ul>
        </section>
      )}

      {tab === 'sis' && canSis && (
        <section className="space-y-4 text-sm">
          <p className="text-gray-600 dark:text-gray-400">
            Full SIS import / staging inbox / grade export moved to{' '}
            <a className="text-indigo-600 underline" href="/registrar/sis">
              Registrar → SIS
            </a>
            . Quick enrollment CSV still works below.
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            CSV lines: <code>studentEmail,courseCode[,externalStudentId,externalCourseId]</code>
          </p>
          <textarea
            className="w-full min-h-[120px] rounded border px-2 py-1 font-mono text-xs dark:bg-gray-800"
            value={sisCsv}
            onChange={(e) => setSisCsv(e.target.value)}
            placeholder="student@school.edu,CS101"
          />
          <button type="button" onClick={() => void stageSis()} className="rounded bg-indigo-600 text-white px-3 py-1.5">
            Stage import
          </button>

          <ul className="divide-y border rounded-md border-gray-200 dark:border-gray-700">
            {sisRows.map((row) => (
              <li key={row._id} className="px-3 py-2 flex flex-wrap justify-between gap-2">
                <span>
                  {row.studentEmail || '—'} → {row.courseCode || '—'} · {row.status}
                  {row.applyError ? ` (${row.applyError})` : ''}
                </span>
                {row.status === 'pending' && (
                  <button type="button" className="text-blue-600" onClick={() => void applySis(row.batchId)}>
                    Apply batch
                  </button>
                )}
              </li>
            ))}
            {!sisRows.length && <li className="px-3 py-4 text-gray-500">No staged rows.</li>}
          </ul>
        </section>
      )}
    </div>
  );
}

export default RegistrarOperations;
