import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
  previousLmsCourseId?: { _id: string; title?: string };
  crossListGroupId?: string | { _id: string; name?: string; sharedGradebook?: boolean };
  contentLinked?: boolean;
  contentPublished?: boolean;
  crossListMode?: 'shared' | 'split' | null;
  enrolledCount?: number;
  waitlistCount?: number;
  publishMismatch?: string | null;
  openCourseUrl?: string | null;
  openGradebookUrl?: string | null;
  archiveCourseUrl?: string | null;
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

type WaitlistEntry = {
  student?: { _id?: string; firstName?: string; lastName?: string; email?: string } | string;
  position?: number;
};

type RemountPreview = {
  requiresConfirm?: boolean;
  orphans?: Array<{ fromCourseId: string; title?: string; studentCount?: number; snapshotCount?: number }>;
  willRemount?: unknown[];
  note?: string;
};

const METHOD_HELP: Record<string, string> = {
  open: 'Students can self-enroll / waitlist from catalog.',
  approval: 'Catalog queues an instructor approval request.',
  registrar_only: 'No student self-enroll — registrar places seats.',
  sis_only: 'Hidden from self-enroll; SIS or registrar only.',
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
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState('');
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
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
  const [xlPreview, setXlPreview] = useState<RemountPreview | null>(null);
  const [xlConfirm, setXlConfirm] = useState(false);
  const [xlExportFirst, setXlExportFirst] = useState(false);

  const loadTerms = async () => {
    const res = await registrarGet<{ data: AcademicTerm[] }>('/api/academic-structure/terms');
    setTerms(res.data || []);
    if (!termId && res.data?.[0]?._id) setTermId(res.data[0]._id);
  };

  const loadSections = async () => {
    const res = await registrarGet<{ data: Section[] }>('/api/academic-structure/sections', {
      termId: termId || undefined,
      status: status === 'all' ? undefined : status,
      includeStats: '1',
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

  const mixedOfferingBanners = useMemo(() => {
    const byOffering = new Map<string, { code: string; title: string; linked: number; total: number }>();
    for (const s of sections) {
      const oid = s.offeringId?._id;
      if (!oid) continue;
      const cur = byOffering.get(oid) || {
        code: s.offeringId?.courseCode || '',
        title: s.offeringId?.title || '',
        linked: 0,
        total: 0,
      };
      cur.total += 1;
      if (s.contentLinked || s.lmsCourseId) cur.linked += 1;
      byOffering.set(oid, cur);
    }
    return [...byOffering.values()].filter((o) => o.linked > 0 && o.linked < o.total);
  }, [sections]);

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

  const linkContent = async (sectionId: string) => {
    setBusy(true);
    setError('');
    try {
      await registrarPost(`/api/registrar/sections/${sectionId}/link-course`, { create: true });
      setMessage('Content course created and linked');
      await loadSections();
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Link failed'
      );
    } finally {
      setBusy(false);
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

  const loadWaitlist = async (section: Section) => {
    const courseId = section.lmsCourseId?._id;
    if (!courseId) {
      setWaitlist([]);
      setError('Link a content course before managing waitlist');
      return;
    }
    setError('');
    try {
      const res = await registrarGet<{ data: { waitlist?: WaitlistEntry[] } }>(
        `/api/registrar/courses/${courseId}/waitlist`
      );
      setWaitlist(res.data?.waitlist || []);
    } catch {
      setWaitlist([]);
      setError('Could not load waitlist');
    }
  };

  const promoteWaitlist = async (sectionId: string, studentId?: string) => {
    setBusy(true);
    setError('');
    try {
      await registrarPost(`/api/registrar/sections/${sectionId}/waitlist/promote`, {
        studentId: studentId || undefined,
      });
      setMessage('Waitlist student promoted');
      const section = sections.find((s) => s._id === sectionId);
      if (section) await loadWaitlist(section);
      await loadSections();
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Promote failed'
      );
    } finally {
      setBusy(false);
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

  const previewCrossList = async () => {
    setError('');
    if (xlSelected.length < 2) {
      setError('Select at least two sections');
      return;
    }
    if (!xlShared) {
      setXlPreview({
        requiresConfirm: false,
        orphans: [],
        note: 'Split mode keeps each section gradebook — no remount.',
      });
      return;
    }
    try {
      const res = await registrarPost<{ data: RemountPreview }>('/api/academic-structure/cross-lists/preview', {
        name: xlName || 'Cross-list group',
        sectionIds: xlSelected,
        sharedGradebook: true,
        primarySectionId: xlSelected[0],
      });
      setXlPreview(res.data || null);
      setMessage(res.data?.requiresConfirm ? 'Preview: remount confirmation required' : 'Preview: safe to create');
    } catch (err: unknown) {
      setError(
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Preview failed'
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
      const res = await registrarPost<{
        data: { archiveJobs?: Array<{ jobId: string; courseId: string }> };
      }>('/api/academic-structure/cross-lists', {
        name: xlName || 'Cross-list group',
        sectionIds: xlSelected,
        sharedGradebook: xlShared,
        primarySectionId: xlSelected[0],
        confirmRemount: xlConfirm,
        exportArchivesFirst: xlExportFirst,
      });
      const jobs = res.data?.archiveJobs || [];
      setMessage(
        xlShared
          ? `Cross-list created (shared)${jobs.length ? ` · ${jobs.length} archive export job(s)` : ''}`
          : 'Cross-list created (split gradebooks)'
      );
      setXlSelected([]);
      setXlName('');
      setXlPreview(null);
      setXlConfirm(false);
      setXlExportFirst(false);
      await loadCrossLists();
      await loadSections();
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.code === 'REMOUNT_CONFIRM_REQUIRED') {
        setXlPreview((err.response.data.data as RemountPreview) || null);
        setError(String(err.response.data.message));
        return;
      }
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
    setXlPreview(null);
  };

  const methodLabel = (m?: string) => m || 'open';

  return (
    <div className="space-y-6 max-w-5xl">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Manage catalog offerings, term sections, and cross-lists. See{' '}
        <code className="text-xs">docs/registrar/CROSS_LIST_GRADEBOOKS.md</code> for shared vs split
        gradebook rules (remount never merges history).
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

          {mixedOfferingBanners.map((o) => (
            <div
              key={o.code}
              className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100"
            >
              Offering <strong>{o.code}</strong> {o.title}: mixed linked/unlinked ({o.linked}/{o.total}{' '}
              linked). Create content courses for unlinked sections before term finalize.
            </div>
          ))}

          <ul className="divide-y border rounded-md text-sm border-gray-200 dark:border-gray-700">
            {sections.map((s) => {
              const linked = s.contentLinked ?? Boolean(s.lmsCourseId);
              const mode = s.crossListMode;
              const expanded = expandedId === s._id;
              return (
                <li key={s._id} className="px-3 py-2 space-y-2">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div className="space-y-1">
                      <div>
                        <strong>{s.offeringId?.courseCode || '—'}</strong> §{s.sectionNumber} ·{' '}
                        {s.status}
                      </div>
                      <div className="flex flex-wrap gap-1 text-xs">
                        <span
                          className={`rounded px-1.5 py-0.5 ${
                            linked
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                              : 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100'
                          }`}
                        >
                          {linked ? 'Linked' : 'Unlinked'}
                        </span>
                        {mode && (
                          <span className="rounded bg-indigo-100 text-indigo-800 px-1.5 py-0.5 dark:bg-indigo-900/40 dark:text-indigo-200">
                            {mode} cross-list
                          </span>
                        )}
                        {s.publishMismatch === 'section_published_content_draft' && (
                          <span className="rounded bg-orange-100 text-orange-900 px-1.5 py-0.5">
                            Section published · content draft
                          </span>
                        )}
                        {s.publishMismatch === 'content_published_section_not' && (
                          <span className="rounded bg-orange-100 text-orange-900 px-1.5 py-0.5">
                            Content published · section not
                          </span>
                        )}
                        {typeof s.enrolledCount === 'number' && (
                          <span className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5">
                            roster {s.enrolledCount}
                            {s.maxEnrollment != null ? `/${s.maxEnrollment}` : ''}
                          </span>
                        )}
                        {typeof s.waitlistCount === 'number' && s.waitlistCount > 0 && (
                          <span className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5">
                            waitlist {s.waitlistCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="flex flex-wrap gap-2 items-start">
                      {s.openCourseUrl && (
                        <Link className="text-blue-600" to={s.openCourseUrl}>
                          Open course
                        </Link>
                      )}
                      {s.openGradebookUrl && (
                        <Link className="text-blue-600" to={s.openGradebookUrl}>
                          Gradebook
                        </Link>
                      )}
                      {s.archiveCourseUrl && (
                        <Link className="text-blue-600" to={s.archiveCourseUrl}>
                          Archive gradebook
                        </Link>
                      )}
                      {!linked && (
                        <button
                          type="button"
                          className="text-blue-600"
                          disabled={busy}
                          onClick={() => void linkContent(s._id)}
                        >
                          Create content
                        </button>
                      )}
                      {s.status !== 'published' && (
                        <button
                          type="button"
                          className="text-blue-600"
                          onClick={() => void patchSection(s._id, { publish: true })}
                        >
                          Publish
                        </button>
                      )}
                      {s.status === 'published' && (
                        <button
                          type="button"
                          className="text-blue-600"
                          onClick={() => void patchSection(s._id, { conclude: true })}
                        >
                          Conclude
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-blue-600"
                        onClick={() => void exportRoster(s._id, s.sectionNumber)}
                      >
                        Roster CSV
                      </button>
                      <button
                        type="button"
                        className="text-blue-600"
                        onClick={() => {
                          const next = expanded ? '' : s._id;
                          setExpandedId(next);
                          if (next) void loadWaitlist(s);
                          else setWaitlist([]);
                        }}
                      >
                        {expanded ? 'Hide' : 'Details'}
                      </button>
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {s.offeringId?.title || s.lmsCourseId?.title || '—'} · instructor{' '}
                    {s.instructorId
                      ? `${s.instructorId.firstName || ''} ${s.instructorId.lastName || ''}`.trim()
                      : '—'}
                  </div>
                  {expanded && (
                    <div className="rounded border border-gray-200 dark:border-gray-700 p-3 space-y-3 bg-gray-50 dark:bg-gray-900/40">
                      <label className="block text-sm max-w-xs">
                        Enrollment method
                        <select
                          className="mt-1 w-full rounded border dark:bg-gray-800 px-2 py-1"
                          value={methodLabel(s.enrollmentMethod)}
                          onChange={(e) =>
                            void patchSection(s._id, { enrollmentMethod: e.target.value })
                          }
                        >
                          <option value="open">open</option>
                          <option value="approval">approval</option>
                          <option value="registrar_only">registrar_only</option>
                          <option value="sis_only">sis_only</option>
                        </select>
                      </label>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {METHOD_HELP[methodLabel(s.enrollmentMethod)]}
                      </p>
                      {(methodLabel(s.enrollmentMethod) === 'sis_only' ||
                        methodLabel(s.enrollmentMethod) === 'registrar_only') && (
                        <p className="text-xs text-amber-800 dark:text-amber-200">
                          Catalog self-join will not fill this section. Use registrar promote / SIS for seats.
                        </p>
                      )}
                      <div>
                        <h4 className="font-medium mb-1">Waitlist</h4>
                        {!linked ? (
                          <p className="text-xs text-gray-500">Link content course to manage waitlist.</p>
                        ) : (
                          <ul className="divide-y border rounded text-xs">
                            {waitlist.map((w, i) => {
                              const st =
                                typeof w.student === 'object' && w.student ? w.student : null;
                              const sid = st?._id || (typeof w.student === 'string' ? w.student : '');
                              return (
                                <li key={i} className="px-2 py-1.5 flex justify-between gap-2">
                                  <span>
                                    {st
                                      ? `${st.firstName || ''} ${st.lastName || ''}`.trim() ||
                                        st.email
                                      : sid || 'Student'}{' '}
                                    {w.position != null ? `· #${w.position}` : ''}
                                  </span>
                                  {sid && (
                                    <button
                                      type="button"
                                      className="text-blue-600"
                                      disabled={busy}
                                      onClick={() => void promoteWaitlist(s._id, sid)}
                                    >
                                      Promote
                                    </button>
                                  )}
                                </li>
                              );
                            })}
                            {!waitlist.length && (
                              <li className="px-2 py-2 text-gray-500">Waitlist empty.</li>
                            )}
                          </ul>
                        )}
                        {linked && waitlist.length > 0 && (
                          <button
                            type="button"
                            className="mt-2 text-blue-600 text-xs"
                            disabled={busy}
                            onClick={() => void promoteWaitlist(s._id)}
                          >
                            Promote next
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
            {!sections.length && <li className="px-3 py-4 text-gray-500">No sections for this filter.</li>}
          </ul>
        </section>
      )}

      {tab === 'offerings' && (
        <section className="space-y-4">
          <form
            onSubmit={createOffering}
            className="grid gap-3 border rounded-md p-4 border-gray-200 dark:border-gray-700 max-w-lg"
          >
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
              Shared gradebook (default): member sections remount to the primary content course — history is
              archived, not merged. Split keeps distinct gradebooks with Open course / Gradebook links.
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
              <input
                type="checkbox"
                checked={xlShared}
                onChange={(e) => {
                  setXlShared(e.target.checked);
                  setXlPreview(null);
                }}
              />
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
                  {s.offeringId?.courseCode} §{s.sectionNumber} ({s.status}
                  {s.lmsCourseId ? ` · ${s.lmsCourseId.title || 'linked'}` : ' · unlinked'})
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded border px-3 py-1.5 text-sm"
                onClick={() => void previewCrossList()}
              >
                Preview remount
              </button>
              <button
                type="button"
                className="rounded bg-indigo-600 text-white px-3 py-1.5 text-sm"
                onClick={() => void createCrossList()}
              >
                Create cross-list
              </button>
            </div>
            {xlPreview && (
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100 space-y-2">
                <p>{xlPreview.note}</p>
                {xlPreview.requiresConfirm && (
                  <>
                    <p>
                      {(xlPreview.orphans || []).length} historical gradebook(s) will become archives (not
                      merged).
                    </p>
                    <ul className="list-disc pl-5 text-xs">
                      {(xlPreview.orphans || []).map((o) => (
                        <li key={o.fromCourseId}>
                          {o.title || o.fromCourseId} · {o.studentCount || 0} students ·{' '}
                          {o.snapshotCount || 0} snapshots
                        </li>
                      ))}
                    </ul>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={xlExportFirst}
                        onChange={(e) => setXlExportFirst(e.target.checked)}
                      />
                      Export archive gradebooks first (queue export.gradebook jobs)
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={xlConfirm}
                        onChange={(e) => setXlConfirm(e.target.checked)}
                      />
                      I confirm remount without merging history
                    </label>
                  </>
                )}
              </div>
            )}
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
          <button
            type="button"
            className="rounded bg-indigo-600 text-white px-3 py-1.5"
            onClick={() => void runBackfill()}
          >
            Backfill missing structure
          </button>
        </section>
      )}
    </div>
  );
}

export default RegistrarSections;
