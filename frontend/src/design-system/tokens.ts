/**
 * Design tokens mirror existing Tailwind usage — no new visual language.
 */
export const ds = {
  surface: {
    card: 'rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900',
    muted: 'rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800',
  },
  text: {
    title: 'text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100',
    subtitle: 'text-xs text-gray-600 dark:text-gray-400 sm:text-sm',
    label: 'text-sm font-medium text-gray-900 dark:text-gray-100',
    muted: 'text-sm text-gray-500 dark:text-gray-400',
  },
  input:
    'rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100',
  btn: {
    primary: 'rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50',
    secondary:
      'rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200',
    filterActive:
      'rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    filterIdle:
      'rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300',
  },
  status: {
    success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    danger: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  },
} as const;
