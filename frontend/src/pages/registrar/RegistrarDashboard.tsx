import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { registrarGet } from './registrarApi';
import { ru } from './registrarUi';

type DashboardData = {
  enrollments: { total: number; byStatus: { _id: string; count: number }[] };
  activeHolds: number;
  sisErrors: number;
  sisHealth?: {
    lastSyncAt?: string | null;
    lastSyncStatus?: string | null;
    errorRate?: number;
    consecutiveFailures?: number;
    openConflicts?: number;
    schedule?: string;
    provider?: string;
  } | null;
  activeTerms: number;
  gradeStatus: { coursesLinked: number; finalized: number; unfinalized: number };
};

type IntegrationsStatus = {
  ltiAgs?: { enabled?: boolean; ready?: boolean; note?: string; missing?: string[] };
  erpHolds?: { configured?: boolean; deadLetterCount?: number; auth?: string };
  boardSubmit?: { mode?: string; canSubmit?: boolean; note?: string };
  sis?: { provider?: string; schedule?: string; lastSyncStatus?: string | null };
};

function StatCard({
  label,
  value,
  to,
  hint,
}: {
  label: string;
  value: number;
  to: string;
  hint?: string;
}) {
  return (
    <Link to={to} className={ru.kpi}>
      <span className={ru.kpiAccent} aria-hidden />
      <div className={ru.kpiLabel}>{label}</div>
      <div className={ru.kpiValue}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</div> : null}
    </Link>
  );
}

function StatusPill({
  ok,
  warn,
  children,
}: {
  ok?: boolean;
  warn?: boolean;
  children: React.ReactNode;
}) {
  const cls = ok ? ru.pillOk : warn ? ru.pillWarn : ru.pillOff;
  return <span className={cls}>{children}</span>;
}

export function RegistrarDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationsStatus | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [dash, integ] = await Promise.all([
          registrarGet<{ data: DashboardData }>('/api/registrar/dashboard'),
          registrarGet<{ data: IntegrationsStatus }>('/api/registrar/integrations/status').catch(
            () => ({ data: null })
          ),
        ]);
        if (!cancelled) {
          setData(dash.data);
          setIntegrations(integ.data);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            axios.isAxiosError(err) && err.response?.data?.message
              ? String(err.response.data.message)
              : 'Failed to load dashboard'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className={`${ru.card} ${ru.muted}`}>
        <div className="h-4 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <div className={ru.alertError}>{error}</div>;
  }

  const cards = [
    {
      label: 'Enrollments',
      value: data?.enrollments.total ?? 0,
      to: '/registrar/operations',
      hint: 'Active roster seats',
    },
    {
      label: 'Active holds',
      value: data?.activeHolds ?? 0,
      to: '/registrar/operations',
      hint: 'Blocking registration / records',
    },
    {
      label: 'SIS issues',
      value: data?.sisErrors ?? 0,
      to: '/registrar/sis',
      hint: 'Conflicts & rejected rows',
    },
    {
      label: 'Active / grading terms',
      value: data?.activeTerms ?? 0,
      to: '/registrar/terms',
    },
    {
      label: 'Unfinalized courses',
      value: data?.gradeStatus.unfinalized ?? 0,
      to: '/registrar/grades',
      hint: 'Need registrar finalize',
    },
    {
      label: 'Finalized courses',
      value: data?.gradeStatus.finalized ?? 0,
      to: '/registrar/grades',
    },
  ];

  const sis = data?.sisHealth;
  const quickLinks = [
    { to: '/registrar/terms', label: 'Manage terms' },
    { to: '/registrar/students', label: 'Search students' },
    { to: '/registrar/transcripts', label: 'Issue transcript' },
    { to: '/registrar/reports', label: 'Reports' },
    { to: '/registrar/sis', label: 'SIS inbox' },
    { to: '/registrar/settings', label: 'Settings' },
  ];

  return (
    <div className={ru.page}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {sis && (
          <section className={ru.card}>
            <div className={ru.cardHead}>
              <h2 className={ru.cardTitle}>SIS sync health</h2>
              <Link to="/registrar/sis" className={ru.cardAction}>
                Open SIS / retry →
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs font-medium text-slate-500">Provider / schedule</div>
                <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                  {sis.provider || '—'} · {sis.schedule || 'manual'}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500">Last run</div>
                <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                  {sis.lastSyncAt ? new Date(sis.lastSyncAt).toLocaleString() : 'Never'}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500">Status</div>
                <div className="mt-1.5">
                  <StatusPill
                    ok={sis.lastSyncStatus === 'ok' || sis.lastSyncStatus === 'completed'}
                    warn={Boolean(sis.errorRate && sis.errorRate > 0)}
                  >
                    {sis.lastSyncStatus || '—'} · {sis.errorRate ?? 0}% errors
                  </StatusPill>
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500">Conflicts</div>
                <div className="mt-1.5">
                  <StatusPill warn={(sis.openConflicts ?? 0) > 0} ok={(sis.openConflicts ?? 0) === 0}>
                    {sis.openConflicts ?? 0} open · {sis.consecutiveFailures ?? 0} fail streak
                  </StatusPill>
                </div>
              </div>
            </div>
          </section>
        )}

        {integrations && (
          <section className={ru.card}>
            <div className={ru.cardHead}>
              <h2 className={ru.cardTitle}>Integration status</h2>
              <Link to="/registrar/settings" className={ru.cardAction}>
                Settings →
              </Link>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-600 dark:text-slate-300">LTI AGS</span>
                <StatusPill ok={integrations.ltiAgs?.ready} warn={integrations.ltiAgs?.enabled}>
                  {integrations.ltiAgs?.ready
                    ? 'Ready'
                    : integrations.ltiAgs?.enabled
                      ? 'Enabled (incomplete)'
                      : 'Off'}
                </StatusPill>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-600 dark:text-slate-300">ERP holds</span>
                <StatusPill
                  ok={integrations.erpHolds?.configured}
                  warn={(integrations.erpHolds?.deadLetterCount || 0) > 0}
                >
                  {integrations.erpHolds?.configured ? 'Secret set' : 'Not configured'}
                  {(integrations.erpHolds?.deadLetterCount || 0) > 0
                    ? ` · ${integrations.erpHolds?.deadLetterCount} DLQ`
                    : ''}
                </StatusPill>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-600 dark:text-slate-300">Board submit</span>
                <StatusPill ok={integrations.boardSubmit?.canSubmit}>
                  {integrations.boardSubmit?.canSubmit
                    ? 'Partner webhook'
                    : integrations.boardSubmit?.mode || 'export_only'}
                </StatusPill>
              </div>
            </div>
          </section>
        )}
      </div>

      {(data?.enrollments.byStatus || []).length > 0 && (
        <section className={ru.card}>
          <h2 className={ru.sectionTitle}>Enrollment by status</h2>
          <div className="flex flex-wrap gap-2">
            {data!.enrollments.byStatus.map((row) => (
              <span key={row._id} className={ru.pill}>
                {row._id}: <strong className="ml-1">{row.count}</strong>
              </span>
            ))}
          </div>
        </section>
      )}

      <section className={ru.cardMuted}>
        <h2 className={ru.sectionTitle}>Quick actions</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-700"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

export default RegistrarDashboard;
