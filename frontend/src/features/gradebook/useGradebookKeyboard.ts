import { useCallback, useRef } from 'react';

export interface GradebookKeyboardCell {
  studentId: string;
  assignmentId: string;
}

/**
 * Arrow-key navigation between grade cells (desktop gradebook).
 */
export function useGradebookKeyboard(
  matrix: GradebookKeyboardCell[][],
  onActivate: (cell: GradebookKeyboardCell) => void
) {
  const posRef = useRef({ row: 0, col: 0 });

  const focusCell = useCallback(
    (row: number, col: number) => {
      const r = Math.max(0, Math.min(matrix.length - 1, row));
      const rowCells = matrix[r];
      if (!rowCells?.length) return;
      const c = Math.max(0, Math.min(rowCells.length - 1, col));
      posRef.current = { row: r, col: c };
      const cell = rowCells[c];
      const el = document.querySelector(
        `[data-grade-cell="${cell.studentId}-${cell.assignmentId}"]`
      ) as HTMLElement | null;
      el?.focus();
    },
    [matrix]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent, row: number, col: number) => {
      if (!matrix.length) return;
      posRef.current = { row, col };
      let nr = row;
      let nc = col;
      switch (e.key) {
        case 'ArrowDown':
          nr += 1;
          e.preventDefault();
          break;
        case 'ArrowUp':
          nr -= 1;
          e.preventDefault();
          break;
        case 'ArrowRight':
          nc += 1;
          e.preventDefault();
          break;
        case 'ArrowLeft':
          nc -= 1;
          e.preventDefault();
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          onActivate(matrix[row][col]);
          return;
        default:
          return;
      }
      focusCell(nr, nc);
    },
    [matrix, focusCell, onActivate]
  );

  return { onKeyDown };
}
