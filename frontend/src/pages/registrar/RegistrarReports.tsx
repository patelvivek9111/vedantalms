import React, { useState } from 'react';
import axios from 'axios';
import {
  downloadCsv,
  registrarAuthHeaders,
  registrarGet,
  registrarPost,
  registrarUrl,
} from './registrarApi';

type ReportKey = 'term-completion' | 'amendments' | 'policy-changes' | 'finalized-courses';

type IndiaKey =
  | 'cbse-mark-sheet'
  | 'class-summary'
  | 'udise-extract'
  | 'university-exam-form'
  | 'sgpa-cgpa'
  | 'naac-evidence';

const REPORTS: { key: ReportKey; label: string; supportsTermYear?: boolean }[] = [
  { key: 'term-completion', label: 'Term completion', supportsTermYear: true },
  { key: 'amendments', label: 'Amendments' },
  { key: 'policy-changes', label: 'Policy changes' },
  { key: 'finalized-courses', label: 'Finalized courses' },
];

const INDIA: { key: IndiaKey; label: string; needsStudent?: boolean; needsCourse?: boolean; needsTerm?: boolean }[] = [
  { key: 'cbse-mark-sheet', label: 'CBSE-style mark sheet', needsStudent: true, needsTerm: true },
  { key: 'class-summary', label: 'Class summary', needsCourse: true },
  { key: 'udise-extract', label: 'UDISE-ready extract' },
  { key: 'university-exam-form', label: 'University exam form', needsTerm: true },
  { key: 'sgpa-cgpa', label: 'SGPA / CGPA statement', needsStudent: true, needsTerm: true },
  { key: 'naac-evidence', label: 'NAAC evidence pack', needsTerm: true },
];

export function RegistrarReports() {
  const [mode, setMode] = useState<'core' | 'india'>('core');
  const [report, setReport] = useState<ReportKey>('term-completion');
  const [indiaKind, setIndiaKind] = useState<IndiaKey>('udise-extract');
  const [term, setTerm] = useState('Fall');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [studentId, setStudentId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [label, setLabel] = useState('');
  const [boardNote, setBoardNote] = useState('');
  const [submitMsg, setSubmitMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const queryParams = () => {
    const params: Record<string, string | number | undefined> = {};
    if (term) params.term = term;
    if (year) params.year = Number(year);
    return params;
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      if (mode === 'india') {
        const params: Record<string, string | number | undefined> = { ...queryParams() };
        if (studentId) params.studentId = studentId.trim();
        if (courseId) params.courseId = courseId.trim();
        const res = await registrarGet<{
          data: { rows?: Record<string, unknown>[]; label?: string };
        }>(`/api/registrar/reports/india/${indiaKind}`, params);
        setRows(res.data?.rows || []);
        setLabel(res.data?.label || indiaKind);
      } else {
        const res = await registrarGet<{ data: Record<string, unknown>[] }>(
          `/api/registrar/reports/${report}`,
          queryParams()
        );
        setRows(res.data || []);
        setLabel(report);
      }
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Failed to load report'
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const download = async () => {
    setError('');
    try {
      const path =
        mode === 'india'
          ? `/api/registrar/reports/india/${indiaKind}`
          : `/api/registrar/reports/${report}`;
      const params: Record<string, string | number | undefined> = {
        ...queryParams(),
        format: 'csv',
      };
      if (mode === 'india') {
        if (studentId) params.studentId = studentId.trim();
        if (courseId) params.courseId = courseId.trim();
      }
      const res = await axios.get(registrarUrl(path), {
        headers: registrarAuthHeaders(),
        params,
        responseType: 'text',
      });
      downloadCsv(`${mode === 'india' ? indiaKind : report}.csv`, typeof res.data === 'string' ? res.data : '');
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'CSV download failed'
      );
    }
  };

  const submitBoard = async () => {
    setError('');
    setSubmitMsg('');
    try {
      const res = await registrarPost<{
        data: { submitted?: boolean; mode?: string; message?: string; ok?: boolean };
      }>(`/api/registrar/reports/india/${indiaKind}/submit`, {
        term,
        year: Number(year),
        studentId: studentId || undefined,
        courseId: courseId || undefined,
      });
      const d = res.data;
      if (d?.submitted) {
        setSubmitMsg(`Submitted via ${d.mode}`);
      } else {
        setSubmitMsg(d?.message || `Mode: ${d?.mode || 'export_only'} (CSV download still available)`);
        setBoardNote(d?.message || '');
      }
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Partner submit failed'
      );
    }
  };

  const columns = rows[0] ? Object.keys(rows[0]) : [];
  const indiaMeta = INDIA.find((i) => i.key === indiaKind);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          className={`rounded px-3 py-1.5 text-sm ${mode === 'core' ? 'bg-indigo-600 text-white' : 'border'}`}
          onClick={() => setMode('core')}
        >
          Core reports
        </button>
        <button
          type="button"
          className={`rounded px-3 py-1.5 text-sm ${mode === 'india' ? 'bg-indigo-600 text-white' : 'border'}`}
          onClick={() => setMode('india')}
        >
          India pack
        </button>
      </div>

      {mode === 'india' && (
        <p className="text-xs text-gray-500">
          {boardNote ||
            'CSV extracts by default. Partner webhook submit when BOARD_SUBMIT_MODE=partner_webhook is configured.'}
        </p>
      )}

      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm">
          Report
          <select
            className="mt-1 block rounded border dark:bg-gray-800 px-2 py-1"
            value={mode === 'core' ? report : indiaKind}
            onChange={(e) => {
              if (mode === 'core') setReport(e.target.value as ReportKey);
              else setIndiaKind(e.target.value as IndiaKey);
            }}
          >
            {mode === 'core'
              ? REPORTS.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))
              : INDIA.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
          </select>
        </label>
        <label className="text-sm">
          Term
          <input
            className="mt-1 block rounded border dark:bg-gray-800 px-2 py-1"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Year
          <input
            type="number"
            className="mt-1 block w-28 rounded border dark:bg-gray-800 px-2 py-1"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </label>
        {mode === 'india' && indiaMeta?.needsStudent && (
          <label className="text-sm">
            Student ID
            <input
              className="mt-1 block rounded border dark:bg-gray-800 px-2 py-1"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            />
          </label>
        )}
        {mode === 'india' && indiaMeta?.needsCourse && (
          <label className="text-sm">
            Course ID
            <input
              className="mt-1 block rounded border dark:bg-gray-800 px-2 py-1"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            />
          </label>
        )}
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded bg-indigo-600 text-white px-3 py-1.5 text-sm"
        >
          {loading ? 'Loading…' : 'Run'}
        </button>
        <button type="button" onClick={() => void download()} className="rounded border px-3 py-1.5 text-sm">
          CSV
        </button>
        {mode === 'india' && (
          <button
            type="button"
            className="rounded border px-3 py-1.5 text-sm"
            onClick={() => void submitBoard()}
          >
            Submit to partner
          </button>
        )}
      </div>

      {label && <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>}
      {submitMsg && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {submitMsg}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      {rows.length > 0 && (
        <div className="overflow-auto border rounded-md border-gray-200 dark:border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {columns.map((c) => (
                  <th key={c} className="px-2 py-1 text-left font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 100).map((row, i) => (
                <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                  {columns.map((c) => (
                    <td key={c} className="px-2 py-1 whitespace-nowrap">
                      {String(row[c] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default RegistrarReports;
