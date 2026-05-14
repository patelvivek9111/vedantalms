import { useMemo } from 'react';
import { navigationItems } from '../constants/courseNavigation';
import { DEFAULT_SIDEBAR_STUDENT_VISIBILITY } from '../constants/sidebarConfigDefaults';
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
        ...DEFAULT_SIDEBAR_STUDENT_VISIBILITY,
        ...(course?.sidebarConfig?.studentVisibility || {}),
      },
    };
  }, [course?.sidebarConfig]);

  const filteredNavigationItems = useMemo(() => {
    // Create navigation items from custom configuration
    const customNavigationItems = sidebarConfig.items
      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
      .filter((item: any) => item.visible !== false)
      .map((item: any) => {
        const originalItem = navigationItems.find((nav) => nav.id === item.id);
        if (!originalItem) {
          return {
            id: item.id,
            label: item.label,
            icon: ClipboardList,
            visible: item.visible !== false,
            order: item.order || 0,
          };
        }
        // Second spread can overwrite `roles`/`icon` with `undefined` from stored config — keep canonical gates.
        return {
          ...originalItem,
          ...item,
          roles: originalItem.roles,
          icon: originalItem.icon,
          label: originalItem.label,
        };
      });

    const role = String(user?.role || '').toLowerCase();
    return customNavigationItems.filter((item: any) => {
      if (item.roles?.length) {
        const allowed = item.roles.map((r: string) => String(r).toLowerCase());
        if (!allowed.includes(role)) {
          return false;
        }
      }

      if (role === 'student') {
        return (
          item.visible &&
          sidebarConfig.studentVisibility[item.id as keyof typeof sidebarConfig.studentVisibility]
        );
      }

      return true;
    });
  }, [sidebarConfig, user?.role]);

  return {
    sidebarConfig,
    filteredNavigationItems,
  };
};










