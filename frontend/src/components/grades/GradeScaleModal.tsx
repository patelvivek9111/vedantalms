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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 w-full max-w-2xl relative">
        <h2 className="text-xl font-bold mb-4">Edit Grade Scale</h2>
        <table className="min-w-full mb-4">
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
        <button
          className="mb-4 px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
          onClick={handleAutoFix}
        >
          Auto-Fix
        </button>
        {gradeScaleError && <div className="text-red-600 mb-2">{gradeScaleError}</div>}
        <div className="flex justify-end gap-2">
          <button
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            onClick={() => setShowGradeScaleModal(false)}
            disabled={savingGradeScale}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
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





