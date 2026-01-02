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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 w-full max-w-2xl relative">
        <h2 className="text-xl font-bold mb-4">Edit Assignment Groups</h2>
        <table className="min-w-full mb-4">
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
        <button
          className="mb-4 px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
          onClick={handleAddGroupRow}
        >
          + Add Group
        </button>
        <button
          className="mb-4 ml-2 px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          onClick={handleResetToDefaults}
        >
          Reset to Defaults
        </button>
        {groupError && <div className="text-red-600 mb-2">{groupError}</div>}
        <div className="flex justify-end gap-2">
          <button
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            onClick={() => setShowGroupModal(false)}
            disabled={savingGroups}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
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


