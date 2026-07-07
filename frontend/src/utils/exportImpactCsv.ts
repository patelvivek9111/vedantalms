import type { PolicyImpactPreview } from '../services/gradingApi';

function escapeCsvCell(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Download impact preview rows as CSV for registrar review. */
export function downloadPolicyImpactCsv(impact: PolicyImpactPreview, filename?: string): void {
  const headers = [
    'Student',
    'Email',
    'Current %',
    'Proposed %',
    'Delta %',
    'Current Letter',
    'Proposed Letter',
    'Changed',
  ];
  const rows = impact.students.map((row) =>
    [
      row.displayName,
      row.email || '',
      row.currentPercent.toFixed(2),
      row.proposedPercent.toFixed(2),
      row.deltaPercent.toFixed(2),
      row.currentLetter,
      row.proposedLetter,
      row.changed ? 'yes' : 'no',
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download =
    filename ||
    `policy-impact-${impact.applyMode}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
