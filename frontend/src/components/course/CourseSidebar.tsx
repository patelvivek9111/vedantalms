import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface CourseSidebarProps {
  navigationItems: NavigationItem[];
  activeSection: string;
  courseId: string | undefined;
  isMobileDevice: boolean;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
}

const CourseSidebar: React.FC<CourseSidebarProps> = ({
  navigationItems,
  activeSection,
  courseId,
  isMobileDevice,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
}) => {
  const navigate = useNavigate();

  return (
    <aside 
      className={`${isMobileDevice 
        ? 'w-full fixed left-0 top-20 bottom-16 z-[95]' 
        : 'w-64 relative mr-8 mt-4 self-start sticky top-4 z-auto'
      } transition-transform duration-300 ease-in-out ${
        isMobileMenuOpen && isMobileDevice ? 'translate-x-0' : isMobileDevice ? '-translate-x-full' : 'translate-x-0'
      } bg-transparent`}
      style={{ 
        height: isMobileDevice ? 'calc(100vh - 80px - 64px)' : undefined
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <nav 
        className={`bg-white/80 dark:bg-gray-900/80 backdrop-blur ${isMobileDevice ? 'rounded-t-2xl' : 'rounded-2xl'} shadow-lg p-4 flex flex-col gap-1 border border-gray-100 dark:border-gray-700 ${isMobileDevice ? '' : 'm-0 h-auto pb-4'}`} 
        style={{ 
          height: '100%',
          maxHeight: '100%',
          overflow: 'hidden'
        }}
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
          className={`flex-1 min-h-0 ${isMobileDevice ? 'overflow-y-auto' : 'overflow-visible'}`}
          style={{
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            overscrollBehavior: 'contain'
          }}
        >
          {navigationItems.map((item) => (
            <button
              key={item.id}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors font-medium text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-700 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 ${activeSection === item.id ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold shadow' : ''}`}
              onClick={() => {
                navigate(`/courses/${courseId}/${item.id}`);
                setIsMobileMenuOpen(false);
              }}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-base">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </aside>
  );
};

export default CourseSidebar;
























