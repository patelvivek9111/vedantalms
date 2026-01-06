import { useMemo } from 'react';
import { navigationItems } from '../constants/courseNavigation';
import { ClipboardList } from 'lucide-react';

interface UseSidebarConfigProps {
  course: any;
  user: any;
}

export const useSidebarConfig = ({
  course,
  user,
}: UseSidebarConfigProps) => {
  const sidebarConfig = useMemo(() => {
    const existingItems = course?.sidebarConfig?.items || [];
    const existingItemsMap = new Map(existingItems.map((item: any) => [item.id, item]));
    
    // Build merged items: start with all navigationItems, use existing config if available
    const mergedItems = navigationItems.map((navItem, index) => {
      const existing = existingItemsMap.get(navItem.id);
      if (existing) {
        // Use existing config, but ensure we have the icon and other properties from navigationItems
        return {
          ...existing,
          label: navItem.label, // Always use the current label from navigationItems
          fixed: navItem.id === 'overview'
        };
      }
      // Item doesn't exist in config, add it with defaults
      return {
        id: navItem.id,
        label: navItem.label,
        visible: true,
        order: index,
        fixed: navItem.id === 'overview'
      };
    });
    
    return {
      items: mergedItems,
      studentVisibility: {
        overview: true,
        syllabus: true,
        modules: true,
        pages: true,
        assignments: true,
        quizzes: true,
        quizwave: true,
        discussions: true,
        announcements: true,
        polls: true,
        groups: true,
        attendance: true,
        grades: true,
        gradebook: false,
        students: true,
        ...(course?.sidebarConfig?.studentVisibility || {})
      }
    };
  }, [course?.sidebarConfig]);

  const filteredNavigationItems = useMemo(() => {
    // Create navigation items from custom configuration
    const customNavigationItems = sidebarConfig.items
      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
      .filter((item: any) => item.visible !== false)
      .map((item: any) => {
        const originalItem = navigationItems.find(nav => nav.id === item.id);
        return originalItem ? {
          ...originalItem,
          ...item
        } : {
          id: item.id,
          label: item.label,
          icon: ClipboardList, // Default icon fallback
          visible: item.visible !== false,
          order: item.order || 0
        };
      });

    // Filter navigation items based on user role and student visibility
    return customNavigationItems.filter((item: any) => {
      // Check role-based filtering
      if (item.roles && !item.roles.includes(user?.role || '')) {
        return false;
      }
      
      // For students, check both general visibility and student visibility settings
      if (user?.role === 'student') {
        return item.visible && sidebarConfig.studentVisibility[item.id as keyof typeof sidebarConfig.studentVisibility];
      }
      
      // Teachers and admins can see all items (they can see everything)
      return true;
    });
  }, [sidebarConfig, user?.role]);

  return {
    sidebarConfig,
    filteredNavigationItems,
  };
};




