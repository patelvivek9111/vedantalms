import React from 'react';

interface AssignmentGroupsModalProps {
  showGroupModal: boolean;
  editGroups: any[];
  handleGroupChange: (idx: number, field: string, value: string | number) => void;
  handleAddGroupRow: () => void;
  handleRemoveGroupRow: (idx: number) => void;
  handleResetToDefaults: () => void;
  handleSaveGroups: () => Promise<void>;
  savingGroups: boolean;
  groupError: string;
  setShowGroupModal: React.Dispatch<React.SetStateAction<boolean>>;
}

const AssignmentGroupsModal: React.FC<AssignmentGroupsModalProps> = ({
  showGroupModal,
  editGroups,
  handleGroupChange,
  handleAddGroupRow,
  handleRemoveGroupRow,
  handleResetToDefaults,
  handleSaveGroups,
  savingGroups,
  groupError,
  setShowGroupModal,
}) => {
  if (!showGroupModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="relative w-full max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-lg dark:bg-gray-900 sm:max-w-2xl sm:rounded-lg sm:p-6">
        <h2 className="mb-4 text-xl font-bold">Edit Assignment Groups</h2>

        <div className="mb-4 space-y-3 md:hidden">
          {editGroups.map((row, idx) => (
            <div key={idx} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Group {idx + 1}</span>
                <button
                  type="button"
                  className="min-h-[44px] min-w-[44px] text-lg text-red-500 hover:text-red-700"
                  onClick={() => handleRemoveGroupRow(idx)}
                  title="Remove row"
                >
                  &times;
                </button>
              </div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Name</label>
              <input
                type="text"
                id={`group-name-mobile-${idx}`}
                value={row.name}
                onChange={(e) => handleGroupChange(idx, 'name', e.target.value)}
                className="mb-3 w-full rounded border px-3 py-2"
              />
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Weight (%)</label>
              <input
                type="number"
                id={`group-weight-mobile-${idx}`}
                value={row.weight}
                onChange={(e) => handleGroupChange(idx, 'weight', Number(e.target.value))}
                className="w-full rounded border px-3 py-2"
              />
            </div>
          ))}
        </div>

        <div className="mb-4 hidden overflow-x-auto md:block">
        <table className="min-w-full">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left">Group Name</th>
              <th className="px-2 py-1 text-left">Weight (%)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {editGroups.map((row, idx) => (
              <tr key={idx}>
                <td className="px-2 py-1">
                  <input
                    type="text"
                    id={`group-name-${idx}`}
                    name={`groupName-${idx}`}
                    value={row.name}
                    onChange={e => handleGroupChange(idx, 'name', e.target.value)}
                    className="border rounded px-2 py-1 w-32"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    type="number"
                    id={`group-weight-${idx}`}
                    name={`groupWeight-${idx}`}
                    value={row.weight}
                    onChange={e => handleGroupChange(idx, 'weight', Number(e.target.value))}
                    className="border rounded px-2 py-1 w-20"
                  />
                </td>
                <td className="px-2 py-1">
                  <button
                    className="text-red-500 hover:text-red-700"
                    onClick={() => handleRemoveGroupRow(idx)}
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
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className="min-h-[44px] rounded bg-green-100 px-3 py-2 text-green-700 hover:bg-green-200"
            onClick={handleAddGroupRow}
          >
            + Add Group
          </button>
          <button
            type="button"
            className="min-h-[44px] rounded bg-blue-100 px-3 py-2 text-blue-700 hover:bg-blue-200"
            onClick={handleResetToDefaults}
          >
            Reset to Defaults
          </button>
        </div>
        {groupError && <div className="text-red-600 mb-2">{groupError}</div>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="min-h-[44px] rounded bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
            onClick={() => setShowGroupModal(false)}
            disabled={savingGroups}
          >
            Cancel
          </button>
          <button
            type="button"
            className="min-h-[44px] rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            onClick={handleSaveGroups}
            disabled={savingGroups}
          >
            {savingGroups ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignmentGroupsModal;










