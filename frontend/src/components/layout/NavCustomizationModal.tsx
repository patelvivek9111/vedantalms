import React, { useState, useEffect } from 'react';
import {
  X,
  GripVertical,
  Gauge,
  ClipboardList,
  Inbox,
  User,
  Calendar,
  Search,
  Users,
  BookOpen,
  FileText,
  Shield,
  Settings,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const CONTROL =
  'h-10 rounded-lg border border-gray-200 transition-colors dark:border-gray-700';
const CONTROL_TEXT =
  'text-[10px] font-medium text-gray-600 sm:text-[11px] dark:text-gray-300';
const CONTROL_FOCUS =
  'focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:border-blue-500 dark:focus:ring-blue-900/40';
const SECTION_LABEL =
  'mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400';
const ITEM_CARD =
  'flex items-center gap-2 rounded-lg border border-gray-200/90 bg-white px-2.5 py-2 transition-colors dark:border-gray-700 dark:bg-gray-800 sm:gap-2.5 sm:px-3';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
  activePaths: string[];
}

interface NavCustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (items: NavItem[]) => void;
  currentItems: NavItem[];
}

export const ALL_NAV_OPTIONS: NavItem[] = [
  { 
    id: 'dashboard', 
    label: 'Dashboard', 
    icon: Gauge, 
    to: '/dashboard',
    activePaths: ['/dashboard', '/']
  },
  { 
    id: 'todo', 
    label: 'To Do', 
    icon: ClipboardList, 
    to: '/todo',
    activePaths: ['/todo']
  },
  { 
    id: 'inbox', 
    label: 'Inbox', 
    icon: Inbox, 
    to: '/inbox',
    activePaths: ['/inbox']
  },
  { 
    id: 'calendar', 
    label: 'Calendar', 
    icon: Calendar, 
    to: '/calendar',
    activePaths: ['/calendar']
  },
  { 
    id: 'catalog', 
    label: 'Catalog', 
    icon: Search, 
    to: '/catalog',
    activePaths: ['/catalog']
  },
  { 
    id: 'groups', 
    label: 'Groups', 
    icon: Users, 
    to: '/groups',
    activePaths: ['/groups']
  },
  { 
    id: 'my-course', 
    label: 'My Course', 
    icon: BookOpen, 
    to: '/teacher/courses',
    activePaths: ['/teacher/courses']
  },
  {
    id: 'account',
    label: 'Account',
    icon: User,
    to: '/account',
    activePaths: ['/account'],
  },
  {
    id: 'report',
    label: 'Report',
    icon: FileText,
    to: '/reports/transcript',
    activePaths: ['/reports/transcript'],
  },
  {
    id: 'admin-users',
    label: 'Users',
    icon: Users,
    to: '/admin/users',
    activePaths: ['/admin/users'],
  },
  {
    id: 'admin-courses',
    label: 'Courses',
    icon: BookOpen,
    to: '/admin/courses',
    activePaths: ['/admin/courses'],
  },
  {
    id: 'admin-settings',
    label: 'Settings',
    icon: Settings,
    to: '/admin/settings',
    activePaths: ['/admin/settings'],
  },
  {
    id: 'admin-security',
    label: 'Security',
    icon: Shield,
    to: '/admin/security',
    activePaths: ['/admin/security'],
  },
  {
    id: 'registrar',
    label: 'Registrar',
    icon: FileText,
    to: '/registrar',
    activePaths: ['/registrar'],
  },
];

export const DEFAULT_NAV_ITEMS = ['dashboard', 'inbox', 'calendar', 'groups'];

export function getDefaultNavItemIds(role?: string): string[] {
  switch (role) {
    case 'admin':
      return ['dashboard', 'inbox', 'admin-users', 'registrar'];
    case 'registrar':
    case 'department_admin':
      return ['registrar', 'inbox', 'account'];
    case 'teacher':
      return ['dashboard', 'inbox', 'calendar', 'catalog'];
    default:
      return ['dashboard', 'inbox', 'calendar', 'groups'];
  }
}

export const NavCustomizationModal: React.FC<NavCustomizationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentItems,
}) => {
  const { user } = useAuth();
  const [selectedItems, setSelectedItems] = useState<NavItem[]>(currentItems);
  const [draggedItem, setDraggedItem] = useState<NavItem | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedItems(currentItems);
    }
  }, [isOpen, currentItems]);

  // Filter available options based on user role
  const availableOptions = ALL_NAV_OPTIONS.filter(option => {
    if (option.id === 'report') {
      return user?.role === 'student';
    }
    if (option.id.startsWith('admin-')) {
      return user?.role === 'admin';
    }
    if (option.id === 'my-course') {
      return user?.role === 'teacher' || user?.role === 'admin';
    }
    if (option.id === 'registrar') {
      return ['admin', 'registrar', 'department_admin', 'platform_admin'].includes(user?.role || '');
    }
    if (user?.role === 'registrar' || user?.role === 'department_admin') {
      return ['registrar', 'inbox', 'account', 'dashboard'].includes(option.id);
    }
    return true;
  });

  const handleToggleItem = (item: NavItem) => {
    const isSelected = selectedItems.some(selected => selected.id === item.id);
    
    if (isSelected) {
      // Remove item
      if (selectedItems.length <= 1) {
        // Don't allow removing the last item
        return;
      }
      setSelectedItems(selectedItems.filter(selected => selected.id !== item.id));
    } else {
      // Add item (max 4)
      if (selectedItems.length >= 4) {
        return;
      }
      setSelectedItems([...selectedItems, item]);
    }
  };

  const handleDragStart = (e: React.DragEvent, item: NavItem) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
    // Set a custom drag image (optional, for better UX)
    if (e.dataTransfer.setDragImage) {
      const dragImage = document.createElement('div');
      dragImage.style.position = 'absolute';
      dragImage.style.top = '-1000px';
      dragImage.textContent = item.label;
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, 0, 0);
      setTimeout(() => document.body.removeChild(dragImage), 0);
    }
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedItem && selectedItems[index].id !== draggedItem.id) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (!draggedItem) return;

    const draggedIndex = selectedItems.findIndex(item => item.id === draggedItem.id);
    if (draggedIndex === -1 || draggedIndex === dropIndex) {
      setDraggedItem(null);
      setDragOverIndex(null);
      return;
    }

    const newItems = [...selectedItems];
    const [removed] = newItems.splice(draggedIndex, 1);
    newItems.splice(dropIndex, 0, removed);

    setSelectedItems(newItems);
    setDraggedItem(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverIndex(null);
  };

  const handleReset = () => {
    const defaultItems = getDefaultNavItemIds(user?.role)
      .map(id => availableOptions.find(opt => opt.id === id))
      .filter((item): item is NavItem => item !== undefined);
    setSelectedItems(defaultItems);
    
    // Save reset to localStorage
    const itemsToSave = defaultItems.map(item => ({
      id: item.id,
      label: item.label,
      to: item.to,
      activePaths: item.activePaths
    }));
    localStorage.setItem('bottomNavItems', JSON.stringify(itemsToSave));
    window.dispatchEvent(new Event('bottomNavUpdated'));
  };

  const handleSave = () => {
    // Save to localStorage
    const itemsToSave = selectedItems.map(item => ({
      id: item.id,
      label: item.label,
      to: item.to,
      activePaths: item.activePaths
    }));
    localStorage.setItem('bottomNavItems', JSON.stringify(itemsToSave));
    
    // Dispatch custom event for same-tab updates
    window.dispatchEvent(new Event('bottomNavUpdated'));
    
    onSave(selectedItems);
    onClose();
  };

  if (!isOpen) return null;

  const unselectedOptions = availableOptions.filter(
    (option) => !selectedItems.some((selected) => selected.id === option.id)
  );

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-xl border border-gray-200/90 bg-white dark:border-gray-700 dark:bg-gray-800 sm:max-w-md sm:rounded-xl sm:shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700/60">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Customize Navigation
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            aria-label="Close navigation customization"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
          <div>
            <h3 className={SECTION_LABEL}>
              Bottom Navigation ({selectedItems.length}/4)
            </h3>
            <div className="space-y-1.5">
              {selectedItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    onDragLeave={() => {
                      if (dragOverIndex === index) {
                        setDragOverIndex(null);
                      }
                    }}
                    className={`${ITEM_CARD} min-h-10 cursor-move ${
                      dragOverIndex === index
                        ? 'border-blue-400 bg-blue-50/80 ring-2 ring-blue-100 dark:border-blue-500 dark:bg-blue-950/30 dark:ring-blue-900/40'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                    } ${draggedItem?.id === item.id ? 'opacity-50' : ''}`}
                  >
                    <GripVertical className="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-50 dark:bg-gray-900/60">
                      <Icon className="h-3.5 w-3.5 text-gray-600 dark:text-gray-300" />
                    </div>
                    <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-gray-900 dark:text-gray-100 sm:text-xs">
                      {item.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleItem(item)}
                      className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40 sm:text-[11px]`}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
              {selectedItems.length === 0 && (
                <div className={`${ITEM_CARD} justify-center py-6`}>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 sm:text-xs">
                    Add at least one item below.
                  </p>
                </div>
              )}
            </div>
          </div>

          {unselectedOptions.length > 0 && (
            <div>
              <h3 className={SECTION_LABEL}>Available Options</h3>
              <div className="space-y-1.5">
                {unselectedOptions.map((option) => {
                  const Icon = option.icon;
                  const isDisabled = selectedItems.length >= 4;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleToggleItem(option)}
                      disabled={isDisabled}
                      className={`${ITEM_CARD} w-full ${
                        isDisabled
                          ? 'cursor-not-allowed opacity-50'
                          : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30'
                      }`}
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-50 dark:bg-gray-900/60">
                        <Icon className="h-3.5 w-3.5 text-gray-600 dark:text-gray-300" />
                      </div>
                      <span className="min-w-0 flex-1 truncate text-left text-[11px] font-semibold text-gray-900 dark:text-gray-100 sm:text-xs">
                        {option.label}
                      </span>
                      {isDisabled ? (
                        <span className="shrink-0 text-[10px] text-gray-400 dark:text-gray-500">
                          Max 4
                        </span>
                      ) : (
                        <span className="shrink-0 text-[10px] font-medium text-blue-600 dark:text-blue-400 sm:text-[11px]">
                          Add
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-gray-100 px-4 py-3 dark:border-gray-700/60 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={handleReset}
            className={`${CONTROL} ${CONTROL_TEXT} w-full bg-white px-3 hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 sm:w-auto`}
          >
            Reset to Default
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`${CONTROL} ${CONTROL_TEXT} ${CONTROL_FOCUS} flex-1 bg-white px-4 hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 sm:flex-none`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={selectedItems.length === 0}
              className={`${CONTROL} flex-1 px-4 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600 sm:flex-none sm:text-xs`}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

