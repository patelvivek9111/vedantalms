export function getGpaPoints(letterGrade, gpaScale) {
  if (!letterGrade || !gpaScale) return null;
  if (gpaScale.type === 'percentage') {
    const n = parseFloat(String(letterGrade).replace('%', ''));
    return Number.isFinite(n) ? n : null;
  }
  const mappings = gpaScale.mappings || [];
  const normalized = String(letterGrade).trim().toUpperCase();
  const row = mappings.find((m) => m && String(m.letter).trim().toUpperCase() === normalized);
  if (row && typeof row.points === 'number') return row.points;
  return null;
}

export function percentToGpaScaleType(percent, gpaScale) {
  if (!gpaScale || gpaScale.type !== 'percentage') return null;
  return percent;
}
