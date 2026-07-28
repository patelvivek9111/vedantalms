/**
 * Shared Registrar Office UI tokens — institutional slate/navy,
 * aligned with existing design-system tokens (no purple theme).
 */
export const ru = {
  page: 'space-y-6',
  shell:
    'registrar-office relative min-h-[calc(100dvh-4rem)] bg-gradient-to-b from-slate-100/90 via-slate-50 to-white dark:from-slate-950 dark:via-slate-950 dark:to-slate-900',
  container: 'relative mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 space-y-6',
  headerRow: 'flex flex-wrap items-start justify-between gap-4',
  title: 'text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-[1.65rem]',
  subtitle: 'mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400',
  backLink:
    'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
  nav:
    'flex gap-1 overflow-x-auto rounded-xl border border-slate-200/80 bg-white/80 p-1 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/80 scrollbar-thin',
  navLink:
    'shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50',
  navLinkActive:
    'shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm dark:bg-sky-600 dark:text-white',
  card:
    'rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/80 sm:p-5',
  cardMuted:
    'rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/50 sm:p-5',
  cardHead: 'mb-3 flex flex-wrap items-center justify-between gap-2',
  cardTitle: 'text-sm font-semibold text-slate-800 dark:text-slate-100',
  cardAction:
    'text-xs font-medium text-sky-700 hover:text-sky-800 hover:underline dark:text-sky-400 dark:hover:text-sky-300',
  kpi:
    'group relative overflow-hidden rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-700/80 dark:bg-slate-900/80 dark:hover:border-slate-600',
  kpiLabel: 'text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400',
  kpiValue: 'mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50',
  kpiAccent: 'absolute inset-y-0 left-0 w-1 bg-sky-600/80 opacity-80 transition group-hover:opacity-100',
  sectionTitle: 'mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100',
  label: 'block text-sm font-medium text-slate-700 dark:text-slate-300',
  input:
    'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400',
  select:
    'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100',
  textarea:
    'mt-1 w-full min-h-[120px] rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100',
  btnPrimary:
    'inline-flex items-center justify-center rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500',
  btnSecondary:
    'inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
  btnGhost:
    'inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
  btnDanger:
    'inline-flex items-center justify-center rounded-lg border border-red-200 bg-white px-3.5 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:bg-slate-900 dark:text-red-300',
  alertError:
    'rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200',
  alertOk:
    'rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200',
  alertInfo:
    'rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-sm text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-200',
  list:
    'divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200/90 bg-white text-sm shadow-sm dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900/80',
  listItem: 'px-4 py-3',
  pill: 'inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  pillOk: 'inline-flex items-center rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  pillWarn: 'inline-flex items-center rounded-md bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  pillOff: 'inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  muted: 'text-sm text-slate-500 dark:text-slate-400',
  link: 'font-medium text-sky-700 hover:text-sky-800 hover:underline dark:text-sky-400',
  tabRow: 'flex flex-wrap gap-1 border-b border-slate-200 pb-2 dark:border-slate-700',
  tab: 'rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
  tabActive: 'rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-sky-600',
  empty: 'px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400',
} as const;

export type RegistrarUi = typeof ru;
