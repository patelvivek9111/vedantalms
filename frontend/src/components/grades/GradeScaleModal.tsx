import React from 'react';

interface GradeScaleModalProps {
  showGradeScaleModal: boolean;
  editGradeScale: any[];
  handleGradeScaleChange: (idx: number, field: string, value: string | number) => void;
  handleRemoveGradeScaleRow: (idx: number) => void;
  handleSaveGradeScale: () => Promise<void>;
  savingGradeScale: boolean;
  gradeScaleError: string;
  setShowGradeScaleModal: React.Dispatch<React.SetStateAction<boolean>>;
  setEditGradeScale: React.Dispatch<React.SetStateAction<any[]>>;
  setGradeScaleError: React.Dispatch<React.SetStateAction<string>>;
}

const GradeScaleModal: React.FC<GradeScaleModalProps> = ({
  showGradeScaleModal,
  editGradeScale,
  handleGradeScaleChange,
  handleRemoveGradeScaleRow,
  handleSaveGradeScale,
  savingGradeScale,
  gradeScaleError,
  setShowGradeScaleModal,
  setEditGradeScale,
  setGradeScaleError,
}) => {
  if (!showGradeScaleModal) return null;

  const handleAutoFix = () => {
    if (editGradeScale.length === 0) {
      setEditGradeScale([
        { letter: 'A', min: 94, max: 100 },
        { letter: 'A-', min: 90, max: 93 },
        { letter: 'B+', min: 87, max: 89 },
        { letter: 'B', min: 84, max: 86 },
        { letter: 'B-', min: 80, max: 83 },
        { letter: 'C+', min: 77, max: 79 },
        { letter: 'C', min: 74, max: 76 },
        { letter: 'D', min: 64, max: 73 },
        { letter: 'F', min: 0, max: 63 }
      ]);
      setGradeScaleError('Auto-filled with default scale.');
      return;
    }
    // Sort by min descending
    const sorted = [...editGradeScale].sort((a, b) => b.min - a.min);
    if (sorted.length > 0) {
      sorted[0].max = 100;
      for (let i = 1; i < sorted.length; i++) {
        sorted[i].max = sorted[i - 1].min - 1;
      }
    }
    setEditGradeScale(sorted);
    setGradeScaleError('Auto-fixed scale for contiguous whole numbers.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="relative w-full max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-lg dark:bg-gray-900 sm:max-w-2xl sm:rounded-lg sm:p-6">
        <h2 className="mb-4 text-xl font-bold">Edit Grade Scale</h2>

        <div className="mb-4 space-y-3 md:hidden">
          {editGradeScale.map((row, idx) => (
            <div key={idx} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Letter</label>
                <button
                  type="button"
                  className="min-h-[44px] min-w-[44px] text-lg text-red-500 hover:text-red-700"
                  onClick={() => handleRemoveGradeScaleRow(idx)}
                  title="Remove row"
                >
                  &times;
                </button>
              </div>
              <input
                type="text"
                id={`grade-letter-mobile-${idx}`}
                value={row.letter}
                onChange={(e) => handleGradeScaleChange(idx, 'letter', e.target.value)}
                className="mb-3 w-full rounded border px-3 py-2"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Min %</label>
                  <input
                    type="number"
                    id={`grade-min-mobile-${idx}`}
                    value={row.min}
                    onChange={(e) => handleGradeScaleChange(idx, 'min', Number(e.target.value))}
                    className="w-full rounded border px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Max %</label>
                  <input
                    type="number"
                    id={`grade-max-mobile-${idx}`}
                    value={row.max}
                    onChange={(e) => handleGradeScaleChange(idx, 'max', Number(e.target.value))}
                    className="w-full rounded border px-3 py-2"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mb-4 hidden overflow-x-auto md:block">
        <table className="min-w-full">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left">Letter</th>
              <th className="px-2 py-1 text-left">Min %</th>
              <th className="px-2 py-1 text-left">Max %</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {editGradeScale.map((row, idx) => (
              <tr key={idx}>
                <td className="px-2 py-1">
                  <input
                    type="text"
                    id={`grade-letter-${idx}`}
                    name={`gradeLetter-${idx}`}
                    value={row.letter}
                    onChange={e => handleGradeScaleChange(idx, 'letter', e.target.value)}
                    className="border rounded px-2 py-1 w-16"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    type="number"
                    id={`grade-min-${idx}`}
                    name={`gradeMin-${idx}`}
                    value={row.min}
                    onChange={e => handleGradeScaleChange(idx, 'min', Number(e.target.value))}
                    className="border rounded px-2 py-1 w-20"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    type="number"
                    id={`grade-max-${idx}`}
                    name={`gradeMax-${idx}`}
                    value={row.max}
                    onChange={e => handleGradeScaleChange(idx, 'max', Number(e.target.value))}
                    className="border rounded px-2 py-1 w-20"
                  />
                </td>
                <td className="px-2 py-1">
                  <button
                    className="text-red-500 hover:text-red-700"
                    onClick={() => handleRemoveGradeScaleRow(idx)}
                    title="Remove row"
                  >
                    &times;
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <button
          type="button"
          className="mb-4 min-h-[44px] rounded bg-green-100 px-3 py-2 text-green-700 hover:bg-green-200"
          onClick={handleAutoFix}
        >
          Auto-Fix
        </button>
        {gradeScaleError && <div className="text-red-600 mb-2">{gradeScaleError}</div>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="min-h-[44px] rounded bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
            onClick={() => setShowGradeScaleModal(false)}
            disabled={savingGradeScale}
          >
            Cancel
          </button>
          <button
            type="button"
            className="min-h-[44px] rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            onClick={handleSaveGradeScale}
            disabled={savingGradeScale}
          >
            {savingGradeScale ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GradeScaleModal;










