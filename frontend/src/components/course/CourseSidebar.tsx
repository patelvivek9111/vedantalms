import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface CourseSidebarProps {
  isMobileDevice: boolean;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  filteredNavigationItems: NavigationItem[];
  activeSection: string;
  courseId: string;
  /** Merged onto the root `<aside>` (e.g. `print:hidden`). */
  className?: string;
}

const CourseSidebar: React.FC<CourseSidebarProps> = ({
  isMobileDevice,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  filteredNavigationItems,
  activeSection,
  courseId,
  className,
}) => {
  const navigate = useNavigate();

  return (
    <aside 
      className={`${isMobileDevice 
        ? 'w-full fixed left-0 top-20 bottom-16 z-[95]' 
        : 'w-64 relative mr-8 mt-0 self-start sticky top-4 z-auto'
      } transition-transform duration-300 ease-in-out ${
        isMobileMenuOpen && isMobileDevice ? 'translate-x-0' : isMobileDevice ? '-translate-x-full' : 'translate-x-0'
      } bg-transparent ${className ?? ''}`}
      style={{ 
        height: isMobileDevice ? 'calc(100vh - 80px - 64px)' : undefined // Only apply height on actual mobile devices
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <nav
        className={`flex flex-col gap-1 border border-gray-100 bg-white/80 p-4 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-900/80 ${isMobileDevice ? 'rounded-t-2xl' : 'm-0 rounded-2xl pb-4'}`}
        aria-label="Course navigation"
        style={
          isMobileDevice
            ? { height: '100%', maxHeight: '100%', overflow: 'hidden' }
            : { height: 'auto', overflow: 'visible' }
        }
        onClick={(e) => e.stopPropagation()}
      >
        {isMobileDevice && (
          <div className="flex justify-between items-center mb-2 flex-shrink-0">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Course Menu</h3>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
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
          {filteredNavigationItems.map((item: NavigationItem) => (
            (() => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  className={`flex items-center gap-3 rounded-lg px-4 py-2 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 dark:focus-visible:ring-slate-600 ${
                    isActive
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                  onClick={() => {
                    navigate(`/courses/${courseId}/${item.id}`);
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-base">{item.label}</span>
                </button>
              );
            })()
          ))}
        </div>
      </nav>
    </aside>
  );
};

export default CourseSidebar;

