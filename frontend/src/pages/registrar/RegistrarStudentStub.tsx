import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { registrarGet, registrarPatch, registrarPost, downloadPdfBase64 } from './registrarApi';
import { ru } from './registrarUi';

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
    system?: { action?: string; createdAt?: string; actor?: { email?: string }; metadata?: Record<string, unknown> }[];
    registrar?: { action?: string; createdAt?: string; actor?: { email?: string }; metadata?: Record<string, unknown> }[];
    enrollmentHistory?: { at?: string; status?: string; reason?: string; course?: { title?: string } }[];
    amendments?: { reason?: string; createdAt?: string; course?: { title?: string } }[];
  };
  documents?: { type?: string; label?: string; verifiedAt?: string }[];
  documentRequests?: {
    _id: string;
    type: string;
    status: string;
    term?: string;
    year?: number;
    notes?: string;
    requestedAt?: string;
    issuedAt?: string;
  }[];
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
  const [docForm, setDocForm] = useState({
    type: 'bonafide',
    term: 'Fall',
    year: String(new Date().getFullYear()),
    notes: '',
  });
  const [docBusy, setDocBusy] = useState(false);

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

  const createDocumentRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) return;
    setDocBusy(true);
    setError('');
    setMessage('');
    try {
      await registrarPost('/api/registrar/transcripts/requests', {
        studentId,
        type: docForm.type,
        term: docForm.term.trim(),
        year: Number(docForm.year),
        notes: docForm.notes,
      });
      setMessage(`${docForm.type} request queued`);
      await load();
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Request failed'
      );
    } finally {
      setDocBusy(false);
    }
  };

  const fulfillDocumentRequest = async (requestId: string) => {
    setDocBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await registrarPost<{
        data: { pdfBase64?: string; type?: string; transcriptHash?: string; certificate?: boolean };
      }>(`/api/registrar/transcripts/requests/${requestId}/fulfill`);
      if (res.data?.pdfBase64) {
        const label = res.data.certificate
          ? `${res.data.type || 'certificate'}-${requestId.slice(-6)}`
          : `transcript-${(res.data.transcriptHash || requestId).slice(0, 8)}`;
        downloadPdfBase64(res.data.pdfBase64, `${label}.pdf`);
        setMessage('PDF downloaded');
      } else {
        setMessage('Request fulfilled');
      }
      await load();
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Fulfill failed'
      );
    } finally {
      setDocBusy(false);
    }
  };

  if (loading) return <p className={ru.muted}>Loading student…</p>;
  if (error && !data) {
    return <div className={ru.alertError}>{error}</div>;
  }
  if (!data) return null;

  const s = data.student;
  const program =
    typeof s.studentProfile?.programId === 'object' ? s.studentProfile.programId : null;

  return (
    <div className={ru.page}>
      <div>
        <Link to="/registrar/students" className={`${ru.link} text-sm`}>
          ← Back to search
        </Link>
        <h2 className={`${ru.title} mt-2 text-xl`}>
          {s.firstName} {s.lastName}
        </h2>
        <p className={ru.muted}>
          {s.email} · {s.accountStatus || 'active'}
          {s.studentProfile?.admissionNumber ? ` · Adm ${s.studentProfile.admissionNumber}` : ''}
          {program?.code ? ` · ${program.code}` : ''}
        </p>
      </div>

      {error && (
        <div className={ru.alertError}>{error}</div>
      )}
      {message && (
        <div className={ru.alertOk}>
          {message}
        </div>
      )}

      <div className={ru.tabRow}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={tab === t.id ? ru.tabActive : ru.tab}
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
            <label key={key} className={ru.label}>
              {label}
              <input
                className={ru.input}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </label>
          ))}
          <label className={`${ru.label} sm:col-span-2`}>
            Program
            <select
              className={ru.select}
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
            className={`sm:col-span-2 ${ru.btnPrimary} w-fit`}
          >
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      )}

      {tab === 'enrollments' && (
        <ul className={ru.list}>
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
          {!data.enrollments.length && <li className={ru.empty}>No enrollments.</li>}
        </ul>
      )}

      {tab === 'grades' && (
        <div className={`overflow-x-auto ${ru.card} !p-0`}>
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
                  <td colSpan={5} className={ru.empty}>
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
          <Link className={`${ru.link} text-sm`} to={`/registrar/transcripts?studentId=${s._id}`}>
            Issue official transcript
          </Link>
          <ul className={ru.list}>
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
              <li className={ru.empty}>No official issuances yet.</li>
            )}
          </ul>
        </div>
      )}

      {tab === 'holds' && (
        <ul className={ru.list}>
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
          {!data.holds.length && <li className={ru.empty}>No holds on record.</li>}
        </ul>
      )}

      {tab === 'audit' && (
        <div className="space-y-4 text-sm">
          <section>
            <h3 className="font-medium mb-2">Registrar events</h3>
            <ul className={ru.list}>
              {(data.audit?.registrar || []).map((ev, i) => (
                <li key={i} className="px-3 py-2">
                  <div className="font-medium">{ev.action}</div>
                  <div className="text-gray-600 dark:text-gray-400">
                    {ev.actor?.email || 'system'}
                    {ev.metadata?.type ? ` · ${String(ev.metadata.type)}` : ''}
                    {ev.metadata?.holdType ? ` · ${String(ev.metadata.holdType)}` : ''}
                    {ev.metadata?.term ? ` · ${String(ev.metadata.term)} ${String(ev.metadata.year || '')}` : ''}
                  </div>
                  <div className="text-xs text-gray-500">
                    {ev.createdAt ? new Date(ev.createdAt).toLocaleString() : ''}
                  </div>
                </li>
              ))}
              {!data.audit?.registrar?.length && (
                <li className={ru.empty}>No registrar.* events for this student yet.</li>
              )}
            </ul>
          </section>
          <section>
            <h3 className="font-medium mb-2">Enrollment history</h3>
            <ul className={ru.list}>
              {(data.audit?.enrollmentHistory || []).map((h, i) => (
                <li key={i} className="px-3 py-2">
                  {h.status} — {h.reason || '—'} · {h.course?.title || ''}
                  <div className="text-xs text-gray-500">{h.at ? new Date(h.at).toLocaleString() : ''}</div>
                </li>
              ))}
              {!data.audit?.enrollmentHistory?.length && (
                <li className={ru.empty}>No enrollment status history.</li>
              )}
            </ul>
          </section>
          <section>
            <h3 className="font-medium mb-2">Amendments</h3>
            <ul className={ru.list}>
              {(data.audit?.amendments || []).map((a, i) => (
                <li key={i} className="px-3 py-2">
                  {a.course?.title || 'Course'} — {a.reason || 'amendment'}
                  <div className="text-xs text-gray-500">
                    {a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}
                  </div>
                </li>
              ))}
              {!data.audit?.amendments?.length && (
                <li className={ru.empty}>No amendments.</li>
              )}
            </ul>
          </section>
          <section>
            <h3 className="font-medium mb-2">System events</h3>
            <ul className={ru.list}>
              {(data.audit?.system || []).map((ev, i) => (
                <li key={i} className="px-3 py-2">
                  {ev.action} · {ev.actor?.email || 'system'}
                  <div className="text-xs text-gray-500">
                    {ev.createdAt ? new Date(ev.createdAt).toLocaleString() : ''}
                  </div>
                </li>
              ))}
              {!data.audit?.system?.length && (
                <li className={ru.empty}>No system audit events yet.</li>
              )}
            </ul>
          </section>
        </div>
      )}

      {tab === 'documents' && (
        <div className="space-y-4 text-sm">
          <p className="text-gray-600 dark:text-gray-400">
            {data.note || 'Queue and fulfill bonafide / transfer certificates for this student.'}
          </p>
          <form
            onSubmit={createDocumentRequest}
            className={`${ru.card} grid gap-2 sm:grid-cols-2 max-w-2xl`}
          >
            <label>
              Type
              <select
                className={ru.input}
                value={docForm.type}
                onChange={(e) => setDocForm((f) => ({ ...f, type: e.target.value }))}
              >
                <option value="bonafide">Bonafide</option>
                <option value="migration_tc">Transfer / migration TC</option>
                <option value="official">Official transcript</option>
                <option value="unofficial">Unofficial transcript</option>
              </select>
            </label>
            <label>
              Term
              <input
                className={ru.input}
                value={docForm.term}
                onChange={(e) => setDocForm((f) => ({ ...f, term: e.target.value }))}
                required
              />
            </label>
            <label>
              Year
              <input
                type="number"
                className={ru.input}
                value={docForm.year}
                onChange={(e) => setDocForm((f) => ({ ...f, year: e.target.value }))}
                required
              />
            </label>
            <label>
              Notes
              <input
                className={ru.input}
                value={docForm.notes}
                onChange={(e) => setDocForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>
            <button
              type="submit"
              disabled={docBusy}
              className={`sm:col-span-2 ${ru.btnPrimary} w-fit`}
            >
              {docBusy ? 'Working…' : 'Create request'}
            </button>
          </form>

          <div>
            <h3 className="font-medium mb-2">Requests</h3>
            <ul className={ru.list}>
              {(data.documentRequests || []).map((r) => (
                <li key={r._id} className="px-3 py-2 flex justify-between gap-2 items-start">
                  <div>
                    <div className="font-medium">
                      {r.type} · {r.status}
                    </div>
                    <div className="text-gray-500">
                      {r.term} {r.year}
                      {r.notes ? ` · ${r.notes}` : ''}
                    </div>
                    <div className="text-xs text-gray-500">
                      {r.requestedAt ? new Date(r.requestedAt).toLocaleString() : ''}
                      {r.issuedAt ? ` · issued ${new Date(r.issuedAt).toLocaleString()}` : ''}
                    </div>
                  </div>
                  {['pending', 'approved'].includes(r.status) && (
                    <button
                      type="button"
                      className={`${ru.link} shrink-0`}
                      disabled={docBusy}
                      onClick={() => void fulfillDocumentRequest(r._id)}
                    >
                      Fulfill PDF
                    </button>
                  )}
                </li>
              ))}
              {!(data.documentRequests || []).length && (
                <li className={ru.empty}>No document requests yet.</li>
              )}
            </ul>
          </div>

          <div>
            <h3 className="font-medium mb-2">Profile documents</h3>
            <ul className={ru.list}>
              {(data.documents || data.student.studentProfile?.documents || []).map((d, i) => (
                <li key={i} className="px-3 py-2">
                  {d.label || d.type || 'Document'}
                  {d.verifiedAt ? ` · verified ${new Date(d.verifiedAt).toLocaleDateString()}` : ''}
                </li>
              ))}
              {!(data.documents || data.student.studentProfile?.documents || []).length && (
                <li className={ru.empty}>No documents on file.</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

/** Back-compat export name used by App.tsx */
export { RegistrarStudent360 as RegistrarStudentStub };
export default RegistrarStudent360;
