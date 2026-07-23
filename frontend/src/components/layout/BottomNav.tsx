import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Gauge, ClipboardList, Inbox, User, Calendar, Search, Users, BookOpen } from 'lucide-react';
import { useUnreadMessages } from '../../hooks/useUnreadMessages';
import { useAuth } from '../../contexts/AuthContext';
import { NavItem, ALL_NAV_OPTIONS, getDefaultNavItemIds } from '../layout/NavCustomizationModal';
import { hapticNavigation } from '../../utils/hapticFeedback';
import SwipeableContainer from '../common/SwipeableContainer';
import { NavCountBadge } from '../common/NavCountBadge';

function filterBottomNavForRole(items: NavItem[], role?: string): NavItem[] {
  return items.filter((item) => {
    if (item.id === 'report' && role !== 'student') return false;
    if (item.id.startsWith('admin-') && role !== 'admin') return false;
    if (
      item.id === 'registrar' &&
      !['admin', 'registrar', 'department_admin', 'platform_admin'].includes(role || '')
    ) {
      return false;
    }
    if (
      (role === 'registrar' || role === 'department_admin') &&
      !['registrar', 'inbox', 'account', 'dashboard'].includes(item.id)
    ) {
      return false;
    }
    if (item.id === 'my-course' && role !== 'teacher' && role !== 'admin') return false;
    return true;
  });
}

const BottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { unreadCount } = useUnreadMessages();
  const { user } = useAuth();
  const [navItems, setNavItems] = useState<NavItem[]>([]);

  // Load navigation items from localStorage
  useEffect(() => {
    const loadNavItems = () => {
      try {
        const saved = localStorage.getItem('bottomNavItems');
        if (saved) {
          const savedItems = JSON.parse(saved);
          // Map saved items to NavItem format with icons
          const mappedItems = savedItems.map((item: any) => {
            const option = ALL_NAV_OPTIONS.find(opt => opt.id === item.id);
            if (option) {
              return {
                ...option,
                ...item,
                // Keep icon from canonical nav option; localStorage stores plain JSON.
                icon: option.icon,
              };
            }
            return null;
          }).filter((item: NavItem | null): item is NavItem => item !== null);
          
          // Filter out 'my-course' if user is not a teacher or admin, and filter out 'account'
          const filteredItems = filterBottomNavForRole(mappedItems, user?.role);
          
          if (filteredItems.length > 0) {
            setNavItems(filteredItems);
            return;
          }
        }
      } catch (error) {
        }
      
      // Default items
      const defaultItems = getDefaultNavItemIds(user?.role)
        .map(id => ALL_NAV_OPTIONS.find(opt => opt.id === id))
        .filter((item): item is NavItem => item !== undefined);
      setNavItems(defaultItems);
    };

    loadNavItems();
  }, [user?.role]);

  // Listen for storage changes to update nav items
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('bottomNavItems');
      if (saved) {
        try {
          const savedItems = JSON.parse(saved);
          const mappedItems = savedItems.map((item: any) => {
            const option = ALL_NAV_OPTIONS.find(opt => opt.id === item.id);
            if (option) {
              return {
                ...option,
                ...item,
                // Keep icon from canonical nav option; localStorage stores plain JSON.
                icon: option.icon,
              };
            }
            return null;
          }).filter((item: NavItem | null): item is NavItem => item !== null);
          
          const filteredItems = filterBottomNavForRole(mappedItems, user?.role);
          
          if (filteredItems.length > 0) {
            setNavItems(filteredItems);
          }
        } catch (error) {
          }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    // Also listen for custom event for same-tab updates
    window.addEventListener('bottomNavUpdated', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('bottomNavUpdated', handleStorageChange);
    };
  }, [user?.role]);

  const isActive = (item: NavItem) => {
    return item.activePaths.some(path => {
      if (path === '/') {
        return location.pathname === '/' || location.pathname === '/dashboard';
      }
      return location.pathname.startsWith(path);
    });
  };

  // Find current active tab index
  const activeIndex = navItems.findIndex(item => isActive(item));
  
  // Swipe navigation handlers
  const handleSwipeLeft = () => {
    if (activeIndex < navItems.length - 1) {
      const nextItem = navItems[activeIndex + 1];
      hapticNavigation();
      navigate(nextItem.to);
    }
  };

  const handleSwipeRight = () => {
    if (activeIndex > 0) {
      const prevItem = navItems[activeIndex - 1];
      hapticNavigation();
      navigate(prevItem.to);
    }
  };

  if (navItems.length === 0) {
    return null;
  }

  const nav = (
    <nav
      className="mobile-fixed-chrome print:hidden lg:hidden fixed inset-x-0 bottom-0 z-[100] w-screen max-w-[100vw] box-border border-t border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-950"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      aria-label="Mobile primary navigation"
    >
      <div className="flex h-16 items-center justify-around px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          const showBadge = item.id === 'inbox' && unreadCount > 0;
          const badgeCount = item.id === 'inbox' ? unreadCount : undefined;

          return (
            <Link
              key={item.id}
              to={item.to}
              onClick={() => hapticNavigation()}
              className={`flex flex-col items-center justify-center flex-1 h-full relative transition-colors min-h-[44px] min-w-[44px] px-2 py-2 touch-manipulation ${
                active
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <div className="relative mb-1 inline-flex items-center justify-center">
                <Icon className="h-5 w-5" />
                {showBadge && badgeCount != null && (
                  <NavCountBadge count={badgeCount} variant="light" />
                )}
              </div>
              <span className="text-[10px] font-medium mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );

  return typeof document !== 'undefined' ? createPortal(nav, document.body) : nav;
};

export default BottomNav;

