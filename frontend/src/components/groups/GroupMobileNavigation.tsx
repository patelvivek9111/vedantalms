import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, BookOpen } from 'lucide-react';

interface GroupMobileNavigationProps {
  isMobileDevice: boolean;
  groupSetName: string;
  groupName: string;
  groupsInSet: { _id: string; name: string }[];
  groupId: string;
  showGroupDropdown: boolean;
  setShowGroupDropdown: (open: boolean) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
}

const GroupMobileNavigation: React.FC<GroupMobileNavigationProps> = ({
  isMobileDevice,
  groupSetName,
  groupName,
  groupsInSet,
  groupId,
  showGroupDropdown,
  setShowGroupDropdown,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
}) => {
  const navigate = useNavigate();

  if (!isMobileDevice) return null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-[150] border-b border-gray-200 bg-white shadow-sm safe-area-inset-top dark:border-gray-700 dark:bg-gray-800">
      <div className="relative flex items-center justify-between gap-2 px-4 py-3">
        <div className="relative min-w-0 max-w-[60%] flex-1">
          <button
            type="button"
            onClick={() => setShowGroupDropdown(!showGroupDropdown)}
            className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left transition-colors hover:bg-gray-100 touch-manipulation dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
            aria-label="Select group"
          >
            <span className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">
              {groupSetName} / {groupName}
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-gray-500 transition-transform dark:text-gray-400 ${showGroupDropdown ? 'rotate-180' : ''}`}
            />
          </button>
          {showGroupDropdown && (
            <>
              <div
                className="fixed inset-0 z-[151] bg-black/50"
                onClick={() => setShowGroupDropdown(false)}
                aria-hidden
              />
              <div className="absolute left-0 top-full z-[152] mt-2 max-h-[60vh] w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
                {groupsInSet.length > 0 ? (
                  groupsInSet.map((g) => (
                    <button
                      key={g._id}
                      type="button"
                      onClick={() => {
                        setShowGroupDropdown(false);
                        navigate(`/groups/${g._id}/home`);
                      }}
                      className={`w-full border-b border-gray-100 px-4 py-3 text-left text-sm transition-colors last:border-0 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700 ${
                        g._id === groupId
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <div className="font-medium">
                        {groupSetName} / {g.name}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">No groups available</div>
                )}
              </div>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="rounded-lg p-2 text-blue-600 transition-colors hover:bg-gray-100 touch-manipulation dark:text-blue-400 dark:hover:bg-gray-700"
          aria-label="Toggle group menu"
        >
          <BookOpen className="h-6 w-6" />
        </button>
      </div>
    </nav>
  );
};

export default GroupMobileNavigation;
