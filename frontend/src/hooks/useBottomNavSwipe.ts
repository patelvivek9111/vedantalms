import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NavItem, ALL_NAV_OPTIONS, DEFAULT_NAV_ITEMS } from '../components/NavCustomizationModal';
import { hapticNavigation } from '../utils/hapticFeedback';
import { useState, useEffect } from 'react';

export const useBottomNavSwipe = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [navItems, setNavItems] = useState<NavItem[]>([]);

  // Load navigation items from localStorage (same logic as BottomNav)
  useEffect(() => {
    const loadNavItems = () => {
      try {
        const saved = localStorage.getItem('bottomNavItems');
        if (saved) {
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
        // Silent fail
      }
      
      // Default items
      const defaultItems = DEFAULT_NAV_ITEMS
        .map(id => ALL_NAV_OPTIONS.find(opt => opt.id === id))
        .filter((item): item is NavItem => item !== undefined);
      setNavItems(defaultItems);
    };

    loadNavItems();
  }, [user?.role]);

  // Listen for storage changes
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
          // Silent fail
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
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
  
  // Check if current page is a bottom nav page
  const isBottomNavPage = activeIndex !== -1;
  
  // Swipe navigation handlers
  const handleSwipeLeft = () => {
    if (isBottomNavPage && activeIndex < navItems.length - 1) {
      const nextItem = navItems[activeIndex + 1];
      hapticNavigation();
      navigate(nextItem.to);
    }
  };

  const handleSwipeRight = () => {
    if (isBottomNavPage && activeIndex > 0) {
      const prevItem = navItems[activeIndex - 1];
      hapticNavigation();
      navigate(prevItem.to);
    }
  };

  return {
    handleSwipeLeft,
    handleSwipeRight,
    enabled: isBottomNavPage && navItems.length > 1 // Only enable if on a bottom nav page and there are multiple tabs
  };
};

