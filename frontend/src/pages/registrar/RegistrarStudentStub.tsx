import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { registrarGet, registrarPatch } from './registrarApi';

type Tab = 'profile' | 'enrollments' | 'grades' | 'transcripts' | 'holds' | 'audit' | 'documents';

type ProgramRef = { _id?: string; code?: string; name?: string; level?: string };
type Student360 = {
  student: {
    _id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    accountStatus?: string;
    studentProfile?: {
      studentId?: string;
      admissionNumber?: string;
      programId?: ProgramRef | string | null;
      batch?: string;
      currentYear?: number | null;
      division?: string;
      dateOfBirth?: string | null;
      guardianName?: string;
      guardianPhone?: string;
      address?: {
        line1?: string;
        city?: string;
        state?: string;
        pincode?: string;
        country?: string;
      };
      externalIds?: { sis?: string };
      documents?: { type?: string; label?: string; verifiedAt?: string }[];
    };
  };
  enrollments: {
    _id: string;
    status: string;
    enrollmentType?: string;
    lmsCourseId?: { title?: string; catalog?: { courseCode?: string } };
    academicTermId?: { name?: string; code?: string };
  }[];
  holds: {
    _id: string;
    holdType: string;
    reason: string;
    isActive?: boolean;
    placedAt?: string;
    blocksRegistration?: boolean;
    blocksTranscript?: boolean;
  }[];
  grades: {
    _id: string;
    term?: string;
    year?: number;
    finalPercent?: number;
    letterGrade?: string;
    lifecycleStatus?: string;
    course?: { title?: string; catalog?: { courseCode?: string } };
  }[];
  transcripts: {
    _id: string;
    term: string;
    year: number;
    transcriptHash?: string;
    courseCount?: number;
    createdAt?: string;
    issuedBy?: { email?: string };
  }[];
  audit?: {
    system?: { action?: string; createdAt?: string; actor?: { email?: string } }[];
    enrollmentHistory?: { at?: string; status?: string; reason?: string; course?: { title?: string } }[];
    amendments?: { reason?: string; createdAt?: string; course?: { title?: string } }[];
  };
  documents?: { type?: string; label?: string; verifiedAt?: string }[];
  note?: string;
};

type Program = { _id: string; code: string; name: string };

const TABS: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'enrollments', label: 'Enrollments' },
  { id: 'grades', label: 'Grades' },
  { id: 'transcripts', label: 'Transcripts' },
  { id: 'holds', label: 'Holds' },
  { id: 'audit', label: 'Audit' },
  { id: 'documents', label: 'Documents' },
];

export function RegistrarStudent360() {
  const { studentId } = useParams<{ studentId: string }>();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'profile';
  const [data, setData] = useState<Student360 | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    studentId: '',
    admissionNumber: '',
    programId: '',
    batch: '',
    currentYear: '',
    division: '',
    guardianName: '',
    guardianPhone: '',
    sisExternalId: '',
    city: '',
    state: '',
    pincode: '',
  });

  const setTab = (id: Tab) => {
    const next = new URLSearchParams(params);
    next.set('tab', id);
    setParams(next, { replace: true });
  };

  const load = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setError('');
    try {
      const [res, progRes] = await Promise.all([
        registrarGet<{ data: Student360 }>(`/api/registrar/students/${studentId}`),
        registrarGet<{ data: Program[] }>('/api/registrar/programs'),
      ]);
      setData(res.data);
      setPrograms(progRes.data || []);
      const p = res.data?.student?.studentProfile || {};
      const programId =
        typeof p.programId === 'object' && p.programId ? String(p.programId._id || '') : String(p.programId || '');
      setForm({
        studentId: p.studentId || '',
        admissionNumber: p.admissionNumber || '',
        programId,
        batch: p.batch || '',
        currentYear: p.currentYear != null ? String(p.currentYear) : '',
        division: p.division || '',
        guardianName: p.guardianName || '',
        guardianPhone: p.guardianPhone || '',
        sisExternalId: p.externalIds?.sis || '',
        city: p.address?.city || '',
        state: p.address?.state || '',
        pincode: p.address?.pincode || '',
      });
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Failed to load student'
      );
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await registrarPatch(`/api/registrar/students/${studentId}/profile`, {
        studentId: form.studentId,
        admissionNumber: form.admissionNumber,
        programId: form.programId || null,
        batch: form.batch,
        currentYear: form.currentYear ? Number(form.currentYear) : null,
        division: form.division,
        guardianName: form.guardianName,
        guardianPhone: form.guardianPhone,
        externalIds: { sis: form.sisExternalId },
        address: { city: form.city, state: form.state, pincode: form.pincode },
      });
      setMessage('Profile saved');
      await load();
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Save failed'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-gray-500">Loading student…</p>;
  if (error && !data) {
    return <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>;
  }
  if (!data) return null;

  const s = data.student;
  const program =
    typeof s.studentProfile?.programId === 'object' ? s.studentProfile.programId : null;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/registrar/students" className="text-sm text-blue-600 hover:underline">
          ← Back to search
        </Link>
        <h2 className="text-xl font-semibold mt-2">
          {s.firstName} {s.lastName}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {s.email} · {s.accountStatus || 'active'}
          {s.studentProfile?.admissionNumber ? ` · Adm ${s.studentProfile.admissionNumber}` : ''}
          {program?.code ? ` · ${program.code}` : ''}
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}
      {message && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </div>
      )}

      <div className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700 pb-2">
        {TABS.map((t) => (
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

      {tab === 'profile' && (
        <form onSubmit={saveProfile} className="grid gap-3 sm:grid-cols-2 text-sm max-w-3xl">
          {(
            [
              ['studentId', 'Student ID'],
              ['admissionNumber', 'Admission number'],
              ['batch', 'Batch'],
              ['currentYear', 'Current year'],
              ['division', 'Division'],
              ['guardianName', 'Guardian name'],
              ['guardianPhone', 'Guardian phone'],
              ['sisExternalId', 'SIS external ID'],
              ['city', 'City'],
              ['state', 'State'],
              ['pincode', 'Pincode'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block">
              {label}
              <input
                className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </label>
          ))}
          <label className="block sm:col-span-2">
            Program
            <select
              className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
              value={form.programId}
              onChange={(e) => setForm((f) => ({ ...f, programId: e.target.value }))}
            >
              <option value="">— None —</option>
              {programs.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={saving}
            className="sm:col-span-2 rounded bg-indigo-600 text-white px-3 py-1.5 w-fit"
          >
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      )}

      {tab === 'enrollments' && (
        <ul className="divide-y border rounded-md text-sm border-gray-200 dark:border-gray-700">
          {data.enrollments.map((e) => (
            <li key={e._id} className="px-3 py-2 flex justify-between gap-2">
              <span>
                {e.lmsCourseId?.catalog?.courseCode || ''} {e.lmsCourseId?.title || 'Course'}
                {e.academicTermId?.name ? ` · ${e.academicTermId.name}` : ''}
              </span>
              <span className="text-gray-500">
                {e.status}
                {e.enrollmentType ? ` · ${e.enrollmentType}` : ''}
              </span>
            </li>
          ))}
          {!data.enrollments.length && <li className="px-3 py-3 text-gray-500">No enrollments.</li>}
        </ul>
      )}

      {tab === 'grades' && (
        <div className="overflow-x-auto border rounded-md border-gray-200 dark:border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-left">
              <tr>
                <th className="px-3 py-2">Course</th>
                <th className="px-3 py-2">Term</th>
                <th className="px-3 py-2">Letter</th>
                <th className="px-3 py-2">%</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.grades.map((g) => (
                <tr key={g._id}>
                  <td className="px-3 py-2">
                    {g.course?.catalog?.courseCode || ''} {g.course?.title || '—'}
                  </td>
                  <td className="px-3 py-2">
                    {g.term || '—'} {g.year || ''}
                  </td>
                  <td className="px-3 py-2 font-medium">{g.letterGrade}</td>
                  <td className="px-3 py-2">{g.finalPercent ?? '—'}</td>
                  <td className="px-3 py-2">{g.lifecycleStatus || '—'}</td>
                </tr>
              ))}
              {!data.grades.length && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-gray-500">
                    No frozen grade snapshots yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'transcripts' && (
        <div className="space-y-3">
          <Link className="text-sm text-blue-600 hover:underline" to={`/registrar/transcripts?studentId=${s._id}`}>
            Issue official transcript
          </Link>
          <ul className="divide-y border rounded-md text-sm border-gray-200 dark:border-gray-700">
            {data.transcripts.map((t) => (
              <li key={t._id} className="px-3 py-2">
                {t.term} {t.year} · {t.courseCount ?? 0} courses · {t.transcriptHash || 'no hash'}
                <div className="text-xs text-gray-500">
                  {t.createdAt ? new Date(t.createdAt).toLocaleString() : ''}
                  {t.issuedBy?.email ? ` · ${t.issuedBy.email}` : ''}
                </div>
              </li>
            ))}
            {!data.transcripts.length && (
              <li className="px-3 py-3 text-gray-500">No official issuances yet.</li>
            )}
          </ul>
        </div>
      )}

      {tab === 'holds' && (
        <ul className="divide-y border rounded-md text-sm border-gray-200 dark:border-gray-700">
          {data.holds.map((h) => (
            <li key={h._id} className="px-3 py-2">
              <div className="font-medium">
                {h.holdType}{' '}
                <span className="font-normal text-gray-500">{h.isActive === false ? '(released)' : '(active)'}</span>
              </div>
              <div className="text-gray-600 dark:text-gray-400">{h.reason}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {h.blocksRegistration ? 'blocks registration · ' : ''}
                {h.blocksTranscript ? 'blocks transcript · ' : ''}
                {h.placedAt ? new Date(h.placedAt).toLocaleString() : ''}
              </div>
            </li>
          ))}
          {!data.holds.length && <li className="px-3 py-3 text-gray-500">No holds on record.</li>}
        </ul>
      )}

      {tab === 'audit' && (
        <div className="space-y-4 text-sm">
          <section>
            <h3 className="font-medium mb-2">Enrollment history</h3>
            <ul className="divide-y border rounded-md border-gray-200 dark:border-gray-700">
              {(data.audit?.enrollmentHistory || []).map((h, i) => (
                <li key={i} className="px-3 py-2">
                  {h.status} — {h.reason || '—'} · {h.course?.title || ''}
                  <div className="text-xs text-gray-500">{h.at ? new Date(h.at).toLocaleString() : ''}</div>
                </li>
              ))}
              {!data.audit?.enrollmentHistory?.length && (
                <li className="px-3 py-3 text-gray-500">No enrollment status history.</li>
              )}
            </ul>
          </section>
          <section>
            <h3 className="font-medium mb-2">Amendments</h3>
            <ul className="divide-y border rounded-md border-gray-200 dark:border-gray-700">
              {(data.audit?.amendments || []).map((a, i) => (
                <li key={i} className="px-3 py-2">
                  {a.course?.title || 'Course'} — {a.reason || 'amendment'}
                  <div className="text-xs text-gray-500">
                    {a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}
                  </div>
                </li>
              ))}
              {!data.audit?.amendments?.length && (
                <li className="px-3 py-3 text-gray-500">No amendments.</li>
              )}
            </ul>
          </section>
          <section>
            <h3 className="font-medium mb-2">System events</h3>
            <ul className="divide-y border rounded-md border-gray-200 dark:border-gray-700">
              {(data.audit?.system || []).map((ev, i) => (
                <li key={i} className="px-3 py-2">
                  {ev.action} · {ev.actor?.email || 'system'}
                  <div className="text-xs text-gray-500">
                    {ev.createdAt ? new Date(ev.createdAt).toLocaleString() : ''}
                  </div>
                </li>
              ))}
              {!data.audit?.system?.length && (
                <li className="px-3 py-3 text-gray-500">No system audit events yet.</li>
              )}
            </ul>
          </section>
        </div>
      )}

      {tab === 'documents' && (
        <div className="space-y-3 text-sm">
          <p className="text-gray-600 dark:text-gray-400">
            {data.note || 'Bonafide / transfer certificate request workflows land in Phase R8.'}
          </p>
          <ul className="divide-y border rounded-md border-gray-200 dark:border-gray-700">
            {(data.documents || data.student.studentProfile?.documents || []).map((d, i) => (
              <li key={i} className="px-3 py-2">
                {d.label || d.type || 'Document'}
                {d.verifiedAt ? ` · verified ${new Date(d.verifiedAt).toLocaleDateString()}` : ''}
              </li>
            ))}
            {!(data.documents || data.student.studentProfile?.documents || []).length && (
              <li className="px-3 py-3 text-gray-500">No documents on file.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Back-compat export name used by App.tsx */
export { RegistrarStudent360 as RegistrarStudentStub };
export default RegistrarStudent360;
