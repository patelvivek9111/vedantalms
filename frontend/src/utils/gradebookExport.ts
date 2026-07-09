import type ExcelJS from 'exceljs';
import {
  getLetterGrade,
  getGradebookCellForExport,
  extractPolicyVersion,
  getGradingEngineVersion,
  type GradebookCellMarker,
} from './gradeUtils';
import {
  augmentAssignmentsForStudent,
  computeStudentWeightedPercent,
} from './gradebookCompute';

export { getGradebookCellForExport };
export type { GradebookCellMarker, GradebookCellExport } from './gradeUtils';

interface GradebookData {
  students: any[];
  assignments: any[];
  grades: { [studentId: string]: { [assignmentId: string]: number | string } };
}

interface Course {
  _id: string;
  title?: string;
  instructor?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  gradeScale?: any[];
}

/** Light fills aligned with gradebook pill colors (ARGB with alpha). */
const MARKER_FILL: Record<GradebookCellMarker, string> = {
  GREEN: 'FFD1FAE5',
  YELLOW: 'FFFEF3C7',
  ORANGE: 'FFFED7AA',
  RED: 'FFFECACA',
  BLUE: 'FFDBEAFE',
  GRAY: 'FFF3F4F6',
  PURPLE: 'FFE9D5FF',
  PENDING: 'FFE5E7EB',
};

function letterGradeFill(letter: string): string | undefined {
  switch (letter) {
    case 'A':
      return 'FFD1FAE5';
    case 'B':
      return 'FFDDEBF7';
    case 'C':
      return 'FFFEF9C3';
    case 'D':
      return 'FFFFEDD5';
    case 'F':
      return 'FFFECACA';
    default:
      return undefined;
  }
}

function colIndexToLetter(index: number): string {
  let n = index;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function applyFill(cell: ExcelJS.Cell, argb: string) {
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb },
  };
}

/** Narrower widths + wrapping so print/PDF does not rely on one huge email column. */
function assignmentColumnWidth(title: string | undefined): number {
  const len = (title || '').length;
  return Math.min(20, Math.max(9, Math.round(len / 5)));
}

/**
 * Download gradebook as Excel (.xlsx) with cell background colors matching the on-screen gradebook.
 * (CSV cannot store fills; Excel is required for highlighting.)
 */
export interface GradebookExportOptions {
  /** Server-computed current totals keyed by student id. Used to match the on-screen gradebook exactly. */
  studentTotals?: Record<string, number>;
  /** Human-readable label for the selected grading period (e.g. "Quarter 1" or "All grading periods"). */
  periodLabel?: string;
}

export const exportGradebookXlsx = async (
  gradebookData: GradebookData,
  course: Course,
  submissionMap: { [key: string]: string },
  studentSubmissions: any[] = [],
  resolvedGradingPolicy: import('./gradeUtils').ResolvedGradingPolicy | null = null,
  exportOptions: GradebookExportOptions = {}
): Promise<void> => {
  const ExcelJSMod = await import('exceljs');
  const ExcelJS = ExcelJSMod.default;
  const { students, assignments, grades } = gradebookData;

  const instructorInfo = course?.instructor
    ? `${course.instructor.firstName} ${course.instructor.lastName} (${course.instructor.email})`
    : 'No Instructor Assigned';

  const numCols = 2 + assignments.length + 2;
  const lastCol = colIndexToLetter(numCols);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'LMS';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Gradebook', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 6 }],
  });

  ws.mergeCells(`A1:${lastCol}1`);
  ws.getCell('A1').value = `Course: ${course?.title || 'Unknown Course'}`;
  ws.getCell('A1').font = { bold: true, size: 12 };

  ws.mergeCells(`A2:${lastCol}2`);
  ws.getCell('A2').value = `Instructor: ${instructorInfo}`;

  ws.mergeCells(`A3:${lastCol}3`);
  const periodLabelText = exportOptions.periodLabel || 'All grading periods';
  ws.getCell('A3').value = `Export date: ${new Date().toLocaleString()}  |  Grading period: ${periodLabelText}`;

  const policyVersion = resolvedGradingPolicy
    ? extractPolicyVersion(resolvedGradingPolicy as Record<string, unknown>)
    : null;
  const policyHash =
    (resolvedGradingPolicy as { _meta?: { policyHash?: string } } | null)?._meta?.policyHash ??
    null;

  ws.mergeCells(`A4:${lastCol}4`);
  const engineVersion = getGradingEngineVersion();
  ws.getCell('A4').value =
    policyHash != null
      ? `Grading policy: v${policyVersion}, engine ${engineVersion}, hash ${policyHash.slice(0, 16)}…`
      : `Grading engine: ${engineVersion}; legacy course defaults (no resolved policy snapshot)`;

  ws.mergeCells(`A5:${lastCol}5`);
  ws.getCell('A5').value =
    'Print: landscape, all columns fit page width; student name & email repeat on each page. Colors match the gradebook (green = strong, yellow/orange = mid, red = missing/low, blue = submitted not graded).';
  ws.getCell('A5').font = { italic: true, size: 10, color: { argb: 'FF666666' } };

  const headerRowIndex = 6;
  const headerLabels = [
    'Student Name',
    'Email',
    ...assignments.map((a: any) => a.title || 'Untitled'),
    'Overall %',
    'Letter Grade',
  ];

  const headerRow = ws.getRow(headerRowIndex);
  headerRow.height = 48;
  headerLabels.forEach((label, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = label;
    cell.font = { bold: true, size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    applyFill(cell, 'FFE7E6E6');
  });

  ws.columns = [
    { width: 22 },
    { width: 20 },
    ...assignments.map((a: any) => ({ width: assignmentColumnWidth(a.title) })),
    { width: 11 },
    { width: 10 },
  ];

  let dataRow = headerRowIndex + 1;
  for (const student of students) {
    // Prefer the server-computed total (matches the on-screen gradebook, including
    // weighted grading-period rollup); fall back to local compute if unavailable.
    const serverTotal =
      exportOptions.studentTotals?.[String(student._id)] ??
      exportOptions.studentTotals?.[student._id as string];
    const weightedPercent =
      typeof serverTotal === 'number' && Number.isFinite(serverTotal)
        ? serverTotal
        : computeStudentWeightedPercent(
            student._id,
            course as any,
            assignments,
            grades,
            submissionMap,
            studentSubmissions,
            resolvedGradingPolicy
          );
    const scale =
      (resolvedGradingPolicy?.gradeScale as Course['gradeScale']) || course?.gradeScale;
    const letter = getLetterGrade(weightedPercent, scale);

    const row = ws.getRow(dataRow);
    const nameCell = row.getCell(1);
    nameCell.value = `${student.firstName} ${student.lastName}`;
    nameCell.font = { size: 10 };
    nameCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

    const emailCell = row.getCell(2);
    emailCell.value = student.email || '';
    emailCell.font = { size: 10 };
    emailCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

    row.height = 28;

    let col = 3;
    for (const assignment of assignments) {
      const { display, marker } = getGradebookCellForExport(
        student,
        assignment,
        grades,
        submissionMap,
        studentSubmissions
      );
      const c = row.getCell(col);
      c.value = display;
      c.font = { size: 10 };
      c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      applyFill(c, MARKER_FILL[marker]);
      col += 1;
    }

    const overallCell = row.getCell(col);
    overallCell.value = Number(weightedPercent.toFixed(2));
    overallCell.font = { size: 10 };
    overallCell.alignment = { horizontal: 'center', vertical: 'middle' };
    const letterFill = letterGradeFill(String(letter));
    if (letterFill) applyFill(overallCell, letterFill);

    const letterCell = row.getCell(col + 1);
    letterCell.value = letter;
    letterCell.alignment = { horizontal: 'center', vertical: 'middle' };
    letterCell.font = { bold: true, size: 10 };
    if (letterFill) applyFill(letterCell, letterFill);

    dataRow += 1;
  }

  const lastDataRow = Math.max(headerRowIndex, dataRow - 1);
  Object.assign(ws.pageSetup, {
    paperSize: 9,
    orientation: 'landscape',
    horizontalCentered: false,
    margins: { left: 0.45, right: 0.45, top: 0.55, bottom: 0.55, header: 0.35, footer: 0.35 },
    fitToPage: true,
    fitToWidth: 1,
    /** Large value = only shrink to page *width*; rows may span multiple pages without squashing. */
    fitToHeight: 999,
    printTitlesRow: `${headerRowIndex}:${headerRowIndex}`,
    printTitlesColumn: 'A:B',
    printArea: `A1:${lastCol}${lastDataRow}`,
  });
  delete (ws.pageSetup as { scale?: number }).scale;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const periodSlug = (exportOptions.periodLabel || 'all')
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  a.download = `gradebook_${(course?.title || 'Unknown_Course').replace(/\s+/g, '_')}_${periodSlug}_${new Date().toISOString().split('T')[0]}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
};
