import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Gauge, ClipboardList, Inbox, User, Calendar, Search, Users, BookOpen } from 'lucide-react';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import { useAuth } from '../context/AuthContext';
import { NavItem, ALL_NAV_OPTIONS, DEFAULT_NAV_ITEMS } from './NavCustomizationModal';

const BottomNav: React.FC = () => {
  const location = useLocation();
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
                ...item
              };
            }
            return null;
          }).filter((item: NavItem | null): item is NavItem => item !== null);
          
          // Filter out 'my-course' if user is not a teacher or admin, and filter out 'account'
          const filteredItems = mappedItems.filter((item: NavItem) => {
            if (item.id === 'account') {
              return false;
            }
            if (item.id === 'my-course' && user?.role !== 'teacher' && user?.role !== 'admin') {
              return false;
            }
            return true;
          });
          
          if (filteredItems.length > 0) {
            setNavItems(filteredItems);
            return;
          }
        }
      } catch (error) {
        console.error('Error loading navigation items:', error);
      }
      
      // Default items
      const defaultItems = DEFAULT_NAV_ITEMS
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
                ...item
              };
            }
            return null;
          }).filter((item: NavItem | null): item is NavItem => item !== null);
          
          const filteredItems = mappedItems.filter((item: NavItem) => {
            if (item.id === 'my-course' && user?.role !== 'teacher' && user?.role !== 'admin') {
              return false;
            }
            return true;
          });
          
          if (filteredItems.length > 0) {
            setNavItems(filteredItems);
          }
        } catch (error) {
          console.error('Error loading navigation items:', error);
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

  if (navItems.length === 0) {
    return null;
  }

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 z-[100] safe-area-inset-bottom shadow-lg">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          const showBadge = item.id === 'inbox' && unreadCount > 0;
          const badgeCount = item.id === 'inbox' ? unreadCount : undefined;

          return (
            <Link
              key={item.id}
              to={item.to}
              className={`flex flex-col items-center justify-center flex-1 h-full relative transition-colors ${
                active
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <div className="relative">
                <Icon className="h-5 w-5 mb-1" />
                {showBadge && (
                  <span className={`absolute -top-1 -right-1 ${
                    badgeCount ? 'bg-red-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center' : 
                    'bg-red-500 rounded-full h-2 w-2'
                  }`}>
                    {badgeCount && badgeCount > 9 ? '9+' : badgeCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;

