import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { registrarGet, registrarPost, registrarPatch, downloadPdfBase64, downloadRegistrarJobFile } from './registrarApi';

type Tab = 'issue' | 'requests' | 'templates' | 'bulk';

type IssueHistory = {
  _id: string;
  term: string;
  year: number;
  transcriptHash?: string;
  verifyUrl?: string;
  issuedAt?: string;
  createdAt?: string;
};

type Template = {
  _id: string;
  name: string;
  format: string;
  locale: string;
  gpaScale: string;
  repeatedCoursePolicy: string;
  isDefault?: boolean;
  includes?: string[];
};

type TranscriptRequest = {
  _id: string;
  term: string;
  year: number;
  type: string;
  status: string;
  studentId?: { _id: string; firstName?: string; lastName?: string; email?: string };
  requestedAt?: string;
};

export function RegistrarTranscripts() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>('issue');
  const [studentId, setStudentId] = useState(params.get('studentId') || '');
  const [term, setTerm] = useState('Fall');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [notes, setNotes] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [history, setHistory] = useState<IssueHistory[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [requests, setRequests] = useState<TranscriptRequest[]>([]);
  const [bulkPreview, setBulkPreview] = useState<{
    ready?: number;
    blocked?: number;
    rows?: Array<{ studentId: string; ok: boolean; message?: string }>;
  } | null>(null);
  const [bulkJobId, setBulkJobId] = useState('');
  const [bulkJobStatus, setBulkJobStatus] = useState('');
  const [bulkDownloadToken, setBulkDownloadToken] = useState('');
  const [bulkFileName, setBulkFileName] = useState('');

  const [tplName, setTplName] = useState('Official PDF');
  const [tplScale, setTplScale] = useState('india_10');
  const [tplRepeat, setTplRepeat] = useState('highest');
  const [tplLocale, setTplLocale] = useState('en');
  const [requestType, setRequestType] = useState('official');

  useEffect(() => {
    const fromQuery = params.get('studentId');
    if (fromQuery) setStudentId(fromQuery);
  }, [params]);

  useEffect(() => {
    void loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const res = await registrarGet<{ data: Template[] }>('/api/registrar/transcripts/templates');
      setTemplates(res.data || []);
      const def = (res.data || []).find((t) => t.isDefault) || (res.data || [])[0];
      if (def && !templateId) setTemplateId(def._id);
    } catch {
      setTemplates([]);
    }
  };

  const loadRequests = async () => {
    try {
      const res = await registrarGet<{ data: TranscriptRequest[] }>(
        '/api/registrar/transcripts/requests'
      );
      setRequests(res.data || []);
    } catch {
      setRequests([]);
    }
  };

  const loadHistory = async () => {
    if (!studentId || !term || !year) return;
    try {
      const res = await registrarGet<{ data: IssueHistory[] }>(
        `/api/reports/transcript/issue-history/${studentId}`,
        { term, year: Number(year) }
      );
      setHistory(res.data || []);
    } catch {
      setHistory([]);
    }
  };

  const issue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const res = await registrarPost<{
        data: {
          transcriptHash?: string;
          courseCount?: number;
          verifyUrl?: string;
          pdfBase64?: string;
        };
      }>('/api/registrar/transcripts/issue', {
        studentId: studentId.trim(),
        term: term.trim(),
        year: Number(year),
        notes: notes.trim() || undefined,
        templateId: templateId || undefined,
      });
      setMessage(
        `Issued official PDF (${res.data?.courseCount ?? 0} courses). Hash: ${
          res.data?.transcriptHash || 'n/a'
        }`
      );
      if (res.data?.pdfBase64) {
        downloadPdfBase64(
          res.data.pdfBase64,
          `transcript-${term}-${year}-${(res.data.transcriptHash || '').slice(0, 8)}.pdf`
        );
      }
      await loadHistory();
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Issue failed'
      );
    }
  };

  const createTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await registrarPost('/api/registrar/transcripts/templates', {
        name: tplName,
        format: 'pdf',
        locale: tplLocale,
        gpaScale: tplScale,
        repeatedCoursePolicy: tplRepeat,
        isDefault: templates.length === 0,
        includes: ['gpa', 'credits', 'grading_scale_legend', 'affiliation'],
      });
      setMessage('Template created');
      await loadTemplates();
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Template create failed'
      );
    }
  };

  const createRequest = async () => {
    setError('');
    try {
      await registrarPost('/api/registrar/transcripts/requests', {
        studentId: studentId.trim(),
        term: term.trim(),
        year: Number(year),
        type: requestType,
        notes: notes.trim() || undefined,
        templateId: templateId || undefined,
      });
      setMessage('Request queued');
      setTab('requests');
      await loadRequests();
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Request failed'
      );
    }
  };

  const fulfillRequest = async (id: string) => {
    setError('');
    try {
      const res = await registrarPost<{
        data: { pdfBase64?: string; transcriptHash?: string };
      }>(`/api/registrar/transcripts/requests/${id}/fulfill`, {});
      setMessage(`Request fulfilled. Hash: ${res.data?.transcriptHash || 'n/a'}`);
      if (res.data?.pdfBase64) {
        downloadPdfBase64(res.data.pdfBase64, `transcript-${(res.data.transcriptHash || '').slice(0, 8)}.pdf`);
      }
      await loadRequests();
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Fulfill failed'
      );
    }
  };

  const rejectRequest = async (id: string) => {
    await registrarPatch(`/api/registrar/transcripts/requests/${id}`, {
      status: 'rejected',
      rejectionReason: 'Rejected by registrar',
    });
    await loadRequests();
  };

  const previewBulk = async () => {
    setError('');
    try {
      const res = await registrarPost<{ data: typeof bulkPreview & { ready: number } }>(
        '/api/registrar/transcripts/bulk/preview',
        { term: term.trim(), year: Number(year) }
      );
      setBulkPreview(res.data || null);
      setMessage(`Preview: ${res.data?.ready ?? 0} ready, ${res.data?.blocked ?? 0} blocked`);
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Bulk preview failed'
      );
    }
  };

  const applyBulk = async () => {
    setError('');
    setBulkDownloadToken('');
    setBulkFileName('');
    try {
      const res = await registrarPost<{
        data: { jobId?: string; issued?: number; failed?: number; toIssue?: number };
      }>('/api/registrar/transcripts/bulk', {
        term: term.trim(),
        year: Number(year),
        templateId: templateId || undefined,
        async: true,
      });
      if (res.data?.jobId) {
        setBulkJobId(String(res.data.jobId));
        setBulkJobStatus('pending');
        setMessage(`Bulk issue job queued (${res.data.toIssue || 0} students). Poll for ZIP when complete.`);
      } else {
        setMessage(`Issued ${res.data?.issued ?? 0}, failed ${res.data?.failed ?? 0}`);
      }
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Bulk issue failed'
      );
    }
  };

  const refreshBulkJob = async () => {
    if (!bulkJobId) return;
    try {
      const res = await registrarGet<{
        data: {
          status: string;
          progress?: { completed: number; total: number };
          hasDownload?: boolean;
          downloadToken?: string;
          fileName?: string;
          result?: { zip?: { downloadToken?: string; fileName?: string; pdfCount?: number } };
        };
      }>(`/api/registrar/jobs/${bulkJobId}`);
      setBulkJobStatus(res.data?.status || '');
      const token = res.data?.downloadToken || res.data?.result?.zip?.downloadToken || '';
      const name = res.data?.fileName || res.data?.result?.zip?.fileName || 'transcripts-bulk.zip';
      if (token) {
        setBulkDownloadToken(token);
        setBulkFileName(name);
      }
      const p = res.data?.progress;
      setMessage(
        `Bulk job ${res.data?.status}${p ? ` · ${p.completed}/${p.total}` : ''}${
          res.data?.hasDownload ? ' · ZIP ready' : ''
        }`
      );
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Could not refresh bulk job'
      );
    }
  };

  const downloadBulkZip = async () => {
    if (!bulkJobId || !bulkDownloadToken) return;
    try {
      await downloadRegistrarJobFile(bulkJobId, bulkDownloadToken, bulkFileName || 'transcripts-bulk.zip');
      setMessage('ZIP download started');
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'ZIP download failed'
      );
    }
  };

  useEffect(() => {
    if (tab === 'requests') void loadRequests();
  }, [tab]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'issue', label: 'Issue' },
    { id: 'requests', label: 'Requests' },
    { id: 'templates', label: 'Templates' },
    { id: 'bulk', label: 'Bulk' },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Official transcripts use FINALIZED/AMENDED grades only. PDFs include a QR verification link.
        Transcript holds block issuance.
      </p>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded px-3 py-1.5 text-sm ${
              tab === t.id
                ? 'bg-indigo-600 text-white'
                : 'border border-gray-300 dark:border-gray-600'
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

      {tab === 'issue' && (
        <form onSubmit={issue} className="grid gap-3 border rounded-md p-4 border-gray-200 dark:border-gray-700">
          <label className="text-sm">
            Student ID
            <input
              className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              required
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Term
              <input
                className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                required
              />
            </label>
            <label className="text-sm">
              Year
              <input
                type="number"
                className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                required
              />
            </label>
          </div>
          <label className="text-sm">
            Template
            <select
              className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="">Default</option>
              {templates.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name} ({t.gpaScale})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Request type
            <select
              className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
              value={requestType}
              onChange={(e) => setRequestType(e.target.value)}
            >
              <option value="official">Official transcript</option>
              <option value="unofficial">Unofficial</option>
              <option value="bonafide">Bonafide certificate</option>
              <option value="migration_tc">Transfer / migration TC</option>
            </select>
          </label>
          <label className="text-sm">
            Notes (optional)
            <input
              className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="rounded bg-indigo-600 text-white px-3 py-1.5 text-sm">
              Issue official PDF
            </button>
            <button
              type="button"
              className="rounded border px-3 py-1.5 text-sm"
              onClick={() => void createRequest()}
            >
              Queue request
            </button>
            <button
              type="button"
              className="rounded border px-3 py-1.5 text-sm"
              onClick={() => void loadHistory()}
            >
              Load history
            </button>
          </div>
        </form>
      )}

      {tab === 'issue' && history.length > 0 && (
        <ul className="divide-y border rounded-md text-sm border-gray-200 dark:border-gray-700">
          {history.map((h) => (
            <li key={h._id} className="px-3 py-2">
              {h.term} {h.year} ·{' '}
              <code className="text-xs">{(h.transcriptHash || '').slice(0, 12)}…</code>
              {h.verifyUrl ? (
                <>
                  {' '}
                  ·{' '}
                  <a className="text-indigo-600 underline" href={h.verifyUrl} target="_blank" rel="noreferrer">
                    verify
                  </a>
                </>
              ) : null}{' '}
              · {new Date(h.issuedAt || h.createdAt || '').toLocaleString()}
            </li>
          ))}
        </ul>
      )}

      {tab === 'requests' && (
        <div className="space-y-3">
          <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => void loadRequests()}>
            Refresh
          </button>
          <ul className="divide-y border rounded-md text-sm border-gray-200 dark:border-gray-700">
            {requests.length === 0 && <li className="px-3 py-2 text-gray-500">No requests</li>}
            {requests.map((r) => (
              <li key={r._id} className="px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                <span>
                  {r.studentId?.firstName} {r.studentId?.lastName} · {r.type} · {r.term} {r.year} ·{' '}
                  <strong>{r.status}</strong>
                </span>
                {(r.status === 'pending' || r.status === 'approved') && (
                  <span className="flex gap-2">
                    <button
                      type="button"
                      className="rounded bg-indigo-600 text-white px-2 py-1 text-xs"
                      onClick={() => void fulfillRequest(r._id)}
                    >
                      Fulfill
                    </button>
                    {r.status === 'pending' && (
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs"
                        onClick={() => void rejectRequest(r._id)}
                      >
                        Reject
                      </button>
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'templates' && (
        <div className="space-y-4">
          <form onSubmit={createTemplate} className="grid gap-3 border rounded-md p-4 border-gray-200 dark:border-gray-700">
            <label className="text-sm">
              Name
              <input
                className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
                required
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                GPA scale
                <select
                  className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
                  value={tplScale}
                  onChange={(e) => setTplScale(e.target.value)}
                >
                  <option value="india_10">India 10-point</option>
                  <option value="us_4">US 4.0</option>
                  <option value="cbse_cgpa">CBSE CGPA</option>
                </select>
              </label>
              <label className="text-sm">
                Locale
                <select
                  className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
                  value={tplLocale}
                  onChange={(e) => setTplLocale(e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi + English labels</option>
                </select>
              </label>
              <label className="text-sm">
                Repeated courses
                <select
                  className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
                  value={tplRepeat}
                  onChange={(e) => setTplRepeat(e.target.value)}
                >
                  <option value="highest">Highest</option>
                  <option value="latest">Latest</option>
                  <option value="average">Average</option>
                </select>
              </label>
            </div>
            <button type="submit" className="rounded bg-indigo-600 text-white px-3 py-1.5 text-sm w-fit">
              Create template
            </button>
          </form>
          <ul className="divide-y border rounded-md text-sm border-gray-200 dark:border-gray-700">
            {templates.map((t) => (
              <li key={t._id} className="px-3 py-2">
                {t.name} · {t.format}/{t.locale} · {t.gpaScale} · repeat:{t.repeatedCoursePolicy}
                {t.isDefault ? ' · default' : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'bulk' && (
        <div className="space-y-3 border rounded-md p-4 border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Preview graduating / enrolled students for the term, then queue a{' '}
            <code>transcript.bulk_issue</code> job. When complete, download all issued PDFs as a ZIP.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Term
              <input
                className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
              />
            </label>
            <label className="text-sm">
              Year
              <input
                type="number"
                className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => void previewBulk()}>
              Preview
            </button>
            <button
              type="button"
              className="rounded bg-indigo-600 text-white px-3 py-1.5 text-sm"
              onClick={() => void applyBulk()}
            >
              Queue bulk issue
            </button>
            {bulkJobId && (
              <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => void refreshBulkJob()}>
                Refresh job ({bulkJobStatus || '…'})
              </button>
            )}
            {bulkDownloadToken && (
              <button
                type="button"
                className="rounded bg-emerald-600 text-white px-3 py-1.5 text-sm"
                onClick={() => void downloadBulkZip()}
              >
                Download ZIP
              </button>
            )}
          </div>
          {bulkPreview?.rows && (
            <ul className="max-h-48 overflow-auto text-xs divide-y border rounded">
              {bulkPreview.rows.slice(0, 50).map((r) => (
                <li key={r.studentId} className="px-2 py-1">
                  {r.studentId} · {r.ok ? 'ready' : r.message || 'blocked'}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default RegistrarTranscripts;
