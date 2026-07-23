import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { registrarGet, registrarPost, registrarPatch, downloadCsv } from './registrarApi';
import { API_URL } from '../../config';
import { getMemoryAuthToken } from '../../utils/authToken';
import type { AcademicTerm } from './registrarApi';

type Tab = 'sections' | 'offerings' | 'crosslist' | 'structure';

type Section = {
  _id: string;
  sectionNumber: string;
  status: string;
  enrollmentMethod?: string;
  sisSectionId?: string;
  maxEnrollment?: number | null;
  offeringId?: { _id: string; courseCode?: string; title?: string };
  academicTermId?: { _id: string; name?: string; code?: string };
  instructorId?: { firstName?: string; lastName?: string; email?: string };
  lmsCourseId?: { _id: string; title?: string; published?: boolean };
  crossListGroupId?: string;
};

type Offering = {
  _id: string;
  courseCode: string;
  title: string;
  credits?: number;
  isActive?: boolean;
};

type CrossList = {
  _id: string;
  name: string;
  sharedGradebook?: boolean;
  sectionIds?: string[];
  sharedContentCourseId?: string;
};

export function RegistrarSections() {
  const [tab, setTab] = useState<Tab>('sections');
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [termId, setTermId] = useState('');
  const [status, setStatus] = useState('all');
  const [sections, setSections] = useState<Section[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [crossLists, setCrossLists] = useState<CrossList[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [gaps, setGaps] = useState<{
    totalPublished?: number;
    missingStructure?: number;
    sections?: number;
    offerings?: number;
    crossLists?: number;
    contentRootNote?: string;
  } | null>(null);

  const [offCode, setOffCode] = useState('');
  const [offTitle, setOffTitle] = useState('');
  const [xlName, setXlName] = useState('');
  const [xlShared, setXlShared] = useState(true);
  const [xlSelected, setXlSelected] = useState<string[]>([]);

  const loadTerms = async () => {
    const res = await registrarGet<{ data: AcademicTerm[] }>('/api/academic-structure/terms');
    setTerms(res.data || []);
    if (!termId && res.data?.[0]?._id) setTermId(res.data[0]._id);
  };

  const loadSections = async () => {
    const res = await registrarGet<{ data: Section[] }>('/api/academic-structure/sections', {
      termId: termId || undefined,
      status: status === 'all' ? undefined : status,
    });
    setSections(res.data || []);
  };

  const loadOfferings = async () => {
    const res = await registrarGet<{ data: Offering[] }>('/api/academic-structure/offerings', {
      active: 'true',
    });
    setOfferings(res.data || []);
  };

  const loadCrossLists = async () => {
    const res = await registrarGet<{ data: CrossList[] }>('/api/academic-structure/cross-lists');
    setCrossLists(res.data || []);
  };

  const loadGaps = async () => {
    const res = await registrarGet<{ data: typeof gaps }>('/api/registrar/structure/gaps');
    setGaps(res.data || null);
  };

  useEffect(() => {
    void loadTerms().catch(() => setTerms([]));
  }, []);

  useEffect(() => {
    if (tab === 'sections') void loadSections().catch(() => setSections([]));
    if (tab === 'offerings') void loadOfferings().catch(() => setOfferings([]));
    if (tab === 'crosslist') {
      void loadSections().catch(() => setSections([]));
      void loadCrossLists().catch(() => setCrossLists([]));
    }
    if (tab === 'structure') void loadGaps().catch(() => setGaps(null));
  }, [tab, termId, status]);

  const patchSection = async (id: string, body: Record<string, unknown>) => {
    setError('');
    try {
      await registrarPatch(`/api/academic-structure/sections/${id}`, body);
      setMessage('Section updated');
      await loadSections();
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Update failed'
      );
    }
  };

  const exportRoster = async (sectionId: string, sectionNumber: string) => {
    try {
      const token = getMemoryAuthToken();
      const res = await axios.get(`${API_URL}/api/registrar/sections/${sectionId}/roster.csv`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'text',
        transformResponse: [(d) => d],
      });
      downloadCsv(`roster-${sectionNumber}.csv`, String(res.data || ''));
    } catch {
      setError('Roster export failed');
    }
  };

  const createOffering = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await registrarPost('/api/academic-structure/offerings', {
        courseCode: offCode,
        title: offTitle,
      });
      setMessage('Offering created');
      setOffCode('');
      setOffTitle('');
      await loadOfferings();
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Create failed'
      );
    }
  };

  const createCrossList = async () => {
    setError('');
    if (xlSelected.length < 2) {
      setError('Select at least two sections');
      return;
    }
    try {
      await registrarPost('/api/academic-structure/cross-lists', {
        name: xlName || 'Cross-list group',
        sectionIds: xlSelected,
        sharedGradebook: xlShared,
        primarySectionId: xlSelected[0],
      });
      setMessage(
        xlShared
          ? 'Cross-list created (shared gradebook / shared content)'
          : 'Cross-list created (per-section gradebooks)'
      );
      setXlSelected([]);
      setXlName('');
      await loadCrossLists();
      await loadSections();
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Cross-list failed'
      );
    }
  };

  const runBackfill = async () => {
    setError('');
    try {
      const res = await registrarPost<{ data: { fixed: number; failed: number } }>(
        '/api/registrar/structure/backfill',
        { limit: 100 }
      );
      setMessage(`Backfill fixed ${res.data?.fixed ?? 0}, failed ${res.data?.failed ?? 0}`);
      await loadGaps();
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Backfill failed'
      );
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'sections', label: 'Sections' },
    { id: 'offerings', label: 'Offerings' },
    { id: 'crosslist', label: 'Cross-list' },
    { id: 'structure', label: 'Structure' },
  ];

  const toggleXl = (id: string) => {
    setXlSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Manage catalog offerings, term sections, and cross-lists. Default cross-list mode shares one
        content course / gradebook; enrollments stay per section.
      </p>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded px-3 py-1.5 text-sm ${
              tab === t.id ? 'bg-indigo-600 text-white' : 'border border-gray-300 dark:border-gray-600'
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

      {tab === 'sections' && (
        <section className="space-y-3">
          <div className="flex flex-wrap gap-3 items-end">
            <label className="text-sm">
              Term
              <select
                className="mt-1 block rounded border dark:bg-gray-800 px-2 py-1"
                value={termId}
                onChange={(e) => setTermId(e.target.value)}
              >
                <option value="">All</option>
                {terms.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Status
              <select
                className="mt-1 block rounded border dark:bg-gray-800 px-2 py-1"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="all">All</option>
                <option value="planned">planned</option>
                <option value="published">published</option>
                <option value="concluded">concluded</option>
                <option value="cancelled">cancelled</option>
              </select>
            </label>
            <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => void loadSections()}>
              Refresh
            </button>
          </div>
          <ul className="divide-y border rounded-md text-sm border-gray-200 dark:border-gray-700">
            {sections.map((s) => (
              <li key={s._id} className="px-3 py-2 space-y-1">
                <div className="flex flex-wrap justify-between gap-2">
                  <span>
                    <strong>{s.offeringId?.courseCode || '—'}</strong> §{s.sectionNumber} · {s.status} ·{' '}
                    {s.enrollmentMethod || 'open'}
                    {s.crossListGroupId ? ' · cross-listed' : ''}
                  </span>
                  <span className="flex flex-wrap gap-2">
                    {s.status !== 'published' && (
                      <button type="button" className="text-blue-600" onClick={() => void patchSection(s._id, { publish: true })}>
                        Publish
                      </button>
                    )}
                    {s.status === 'published' && (
                      <button type="button" className="text-blue-600" onClick={() => void patchSection(s._id, { conclude: true })}>
                        Conclude
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-blue-600"
                      onClick={() =>
                        void patchSection(s._id, {
                          enrollmentMethod:
                            s.enrollmentMethod === 'open'
                              ? 'approval'
                              : s.enrollmentMethod === 'approval'
                                ? 'registrar_only'
                                : s.enrollmentMethod === 'registrar_only'
                                  ? 'sis_only'
                                  : 'open',
                        })
                      }
                    >
                      Cycle method
                    </button>
                    <button type="button" className="text-blue-600" onClick={() => void exportRoster(s._id, s.sectionNumber)}>
                      Roster CSV
                    </button>
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {s.offeringId?.title || s.lmsCourseId?.title || '—'} · instructor{' '}
                  {s.instructorId
                    ? `${s.instructorId.firstName || ''} ${s.instructorId.lastName || ''}`.trim()
                    : '—'}
                </div>
              </li>
            ))}
            {!sections.length && <li className="px-3 py-4 text-gray-500">No sections for this filter.</li>}
          </ul>
        </section>
      )}

      {tab === 'offerings' && (
        <section className="space-y-4">
          <form onSubmit={createOffering} className="grid gap-3 border rounded-md p-4 border-gray-200 dark:border-gray-700 max-w-lg">
            <label className="text-sm">
              Course code
              <input
                className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
                value={offCode}
                onChange={(e) => setOffCode(e.target.value)}
                required
              />
            </label>
            <label className="text-sm">
              Title
              <input
                className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
                value={offTitle}
                onChange={(e) => setOffTitle(e.target.value)}
                required
              />
            </label>
            <button type="submit" className="rounded bg-indigo-600 text-white px-3 py-1.5 text-sm w-fit">
              Create offering
            </button>
          </form>
          <ul className="divide-y border rounded-md text-sm border-gray-200 dark:border-gray-700">
            {offerings.map((o) => (
              <li key={o._id} className="px-3 py-2">
                <strong>{o.courseCode}</strong> — {o.title}
                {o.credits != null ? ` · ${o.credits} cr` : ''}
              </li>
            ))}
            {!offerings.length && <li className="px-3 py-4 text-gray-500">No offerings yet.</li>}
          </ul>
        </section>
      )}

      {tab === 'crosslist' && (
        <section className="space-y-4">
          <div className="border rounded-md p-4 border-gray-200 dark:border-gray-700 space-y-3 max-w-xl">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Shared gradebook (default): member sections use the primary section&apos;s content course.
              Per-section gradebook keeps distinct <code>lmsCourseId</code> values.
            </p>
            <label className="text-sm block">
              Group name
              <input
                className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
                value={xlName}
                onChange={(e) => setXlName(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={xlShared} onChange={(e) => setXlShared(e.target.checked)} />
              Shared gradebook / shared content (recommended)
            </label>
            <div className="max-h-48 overflow-auto border rounded text-sm">
              {sections.map((s) => (
                <label key={s._id} className="flex gap-2 px-2 py-1 border-b last:border-0">
                  <input
                    type="checkbox"
                    checked={xlSelected.includes(s._id)}
                    onChange={() => toggleXl(s._id)}
                  />
                  {s.offeringId?.courseCode} §{s.sectionNumber} ({s.status})
                </label>
              ))}
            </div>
            <button type="button" className="rounded bg-indigo-600 text-white px-3 py-1.5 text-sm" onClick={() => void createCrossList()}>
              Create cross-list
            </button>
          </div>
          <ul className="divide-y border rounded-md text-sm border-gray-200 dark:border-gray-700">
            {crossLists.map((g) => (
              <li key={g._id} className="px-3 py-2">
                {g.name} · {g.sharedGradebook !== false ? 'shared gradebook' : 'split gradebooks'} ·{' '}
                {(g.sectionIds || []).length} sections
              </li>
            ))}
            {!crossLists.length && <li className="px-3 py-4 text-gray-500">No cross-lists yet.</li>}
          </ul>
        </section>
      )}

      {tab === 'structure' && (
        <section className="space-y-3 border rounded-md p-4 border-gray-200 dark:border-gray-700 text-sm">
          <p>
            Published courses: <strong>{gaps?.totalPublished ?? '—'}</strong> · Missing offering/section:{' '}
            <strong>{gaps?.missingStructure ?? '—'}</strong>
          </p>
          <p>
            Offerings {gaps?.offerings ?? '—'} · Sections {gaps?.sections ?? '—'} · Cross-lists{' '}
            {gaps?.crossLists ?? '—'}
          </p>
          {gaps?.contentRootNote && <p className="text-gray-500">{gaps.contentRootNote}</p>}
          <button type="button" className="rounded bg-indigo-600 text-white px-3 py-1.5" onClick={() => void runBackfill()}>
            Backfill missing structure
          </button>
        </section>
      )}
    </div>
  );
}

export default RegistrarSections;
