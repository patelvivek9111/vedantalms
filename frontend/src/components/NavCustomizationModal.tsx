import React, { useState, useEffect } from 'react';
import { X, GripVertical, Gauge, ClipboardList, Inbox, User, Calendar, Search, Users, BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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
    id: 'account', 
    label: 'Account', 
    icon: User, 
    to: '/account',
    activePaths: ['/account']
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
];

export const DEFAULT_NAV_ITEMS = ['dashboard', 'todo', 'inbox', 'account'];

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
    if (option.id === 'my-course') {
      return user?.role === 'teacher' || user?.role === 'admin';
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
    const defaultItems = DEFAULT_NAV_ITEMS
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[200] flex items-center justify-center p-4">
      <div className="bg-gray-800 dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 dark:border-gray-700">
          <h2 className="text-xl font-bold text-white dark:text-white">
            Customize Navigation
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-white dark:text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Selected Items (Draggable) */}
          <div>
            <h3 className="text-sm font-semibold text-white dark:text-white mb-2">
              Bottom Navigation ({selectedItems.length}/4)
            </h3>
            <div className="space-y-2">
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
                    className={`flex items-center gap-3 p-3 bg-gray-700 dark:bg-gray-700 rounded-lg cursor-move transition-all ${
                      dragOverIndex === index ? 'ring-2 ring-blue-500 bg-blue-900/20 dark:bg-blue-900/20' : ''
                    } ${draggedItem?.id === item.id ? 'opacity-50' : 'hover:bg-gray-600 dark:hover:bg-gray-600'}`}
                  >
                    <GripVertical className="h-5 w-5 text-gray-400 dark:text-gray-400 flex-shrink-0" />
                    <Icon className="h-5 w-5 text-white dark:text-white flex-shrink-0" />
                    <span className="flex-1 text-sm font-medium text-white dark:text-white">
                      {item.label}
                    </span>
                    <button
                      onClick={() => handleToggleItem(item)}
                      className="px-3 py-1 text-xs font-medium text-red-400 dark:text-red-400 hover:bg-red-900/20 dark:hover:bg-red-900/20 rounded transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
              {selectedItems.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-gray-400 text-center py-4">
                  No items selected. Please add at least one item.
                </p>
              )}
            </div>
          </div>

          {/* Available Options */}
          <div>
            <h3 className="text-sm font-semibold text-white dark:text-white mb-2">
              Available Options
            </h3>
            <div className="space-y-2">
              {availableOptions
                .filter(option => !selectedItems.some(selected => selected.id === option.id))
                .map(option => {
                  const Icon = option.icon;
                  const isDisabled = selectedItems.length >= 4;
                  return (
                    <button
                      key={option.id}
                      onClick={() => handleToggleItem(option)}
                      disabled={isDisabled}
                      className={`w-full flex items-center gap-3 p-3 bg-gray-700 dark:bg-gray-700 border border-gray-600 dark:border-gray-600 rounded-lg transition-all ${
                        isDisabled
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:bg-gray-600 dark:hover:bg-gray-600 cursor-pointer'
                      }`}
                    >
                      <Icon className="h-5 w-5 text-white dark:text-white flex-shrink-0" />
                      <span className="flex-1 text-left text-sm font-medium text-white dark:text-white">
                        {option.label}
                      </span>
                      {isDisabled && (
                        <span className="text-xs text-gray-400 dark:text-gray-400">
                          Max 4 items
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-700 dark:border-gray-700 gap-3">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm font-medium text-white dark:text-white hover:bg-gray-700 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Reset to Default
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white dark:text-white hover:bg-gray-700 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={selectedItems.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

