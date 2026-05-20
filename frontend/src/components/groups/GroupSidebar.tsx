import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ChevronDown, X } from 'lucide-react';

export interface GroupTab {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface GroupSidebarProps {
  isMobileDevice: boolean;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  groupId: string;
  groupSetName: string;
  groupName: string;
  groupsInSet: { _id: string; name: string }[];
  tabs: GroupTab[];
  canSwitchGroup: boolean;
  className?: string;
}

const GroupSidebar: React.FC<GroupSidebarProps> = ({
  isMobileDevice,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  groupId,
  groupSetName,
  groupName,
  groupsInSet,
  tabs,
  canSwitchGroup,
  className,
}) => {
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <aside
      className={`${
        isMobileDevice
          ? 'w-full fixed left-0 top-20 bottom-16 z-[95]'
          : 'w-64 relative mr-8 mt-0 self-start sticky top-4 z-auto'
      } transition-transform duration-300 ease-in-out ${
        isMobileMenuOpen && isMobileDevice ? 'translate-x-0' : isMobileDevice ? '-translate-x-full' : 'translate-x-0'
      } bg-transparent ${className ?? ''}`}
      style={{
        height: isMobileDevice ? 'calc(100vh - 80px - 64px)' : undefined,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <nav
        className={`flex flex-col gap-1 border border-gray-100 bg-white/80 p-4 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-900/80 ${
          isMobileDevice ? 'rounded-t-2xl' : 'm-0 rounded-2xl pb-4'
        }`}
        style={
          isMobileDevice
            ? { height: '100%', maxHeight: '100%', overflow: 'hidden' }
            : { height: 'auto', overflow: 'visible' }
        }
        onClick={(e) => e.stopPropagation()}
      >
        {isMobileDevice && (
          <div className="mb-2 flex flex-shrink-0 items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Group Menu</h3>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {!isMobileDevice && (
          <div className="relative mb-4 border-b border-gray-200 pb-3 dark:border-gray-700">
            {canSwitchGroup ? (
              <button
                type="button"
                className="flex w-full items-center justify-between text-left text-lg font-semibold text-gray-900 focus:outline-none dark:text-gray-100"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <span className="truncate pr-2">
                  {groupSetName} / {groupName}
                </span>
                <ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>
            ) : (
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {groupSetName} / {groupName}
              </div>
            )}
            {dropdownOpen && canSwitchGroup && (
              <div className="absolute left-0 right-0 z-10 mt-2 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                {groupsInSet.map((g) => (
                  <button
                    key={g._id}
                    type="button"
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-gray-700 ${
                      g._id === groupId
                        ? 'bg-slate-100 font-semibold text-blue-700 dark:bg-gray-700 dark:text-blue-300'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate(`/groups/${g._id}/home`);
                    }}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div
          className={isMobileDevice ? 'min-h-0 flex-1 overflow-y-auto' : undefined}
          style={
            isMobileDevice
              ? {
                  WebkitOverflowScrolling: 'touch',
                  touchAction: 'pan-y',
                  overscrollBehavior: 'contain',
                }
              : undefined
          }
        >
          <div className="flex flex-col gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <NavLink
                  key={tab.path}
                  to={`/groups/${groupId}/${tab.path}`}
                  end
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-4 py-2 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 dark:focus-visible:ring-slate-600 ${
                      isActive
                        ? 'text-blue-700 dark:text-blue-300'
                        : 'text-gray-700 hover:bg-slate-100 hover:text-slate-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-slate-100'
                    }`
                  }
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-base">{tab.name}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      </nav>
    </aside>
  );
};

export default GroupSidebar;
