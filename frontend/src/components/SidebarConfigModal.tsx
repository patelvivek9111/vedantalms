import React, { useMemo, useState, useEffect } from 'react';
import { X, GripVertical, Eye, EyeOff, Save, RotateCcw } from 'lucide-react';
import api from '../services/api';
import { navigationItems } from '../constants/courseNavigation';
import {
  ALLOWED_STUDENT_VISIBILITY_KEYS,
  DEFAULT_SIDEBAR_STUDENT_VISIBILITY,
  buildStudentVisibilityForSave,
  getDefaultSidebarConfigItems,
  normalizeSidebarItemsForModal,
  shouldHideFromSidebarItemsColumn,
  shouldHideFromStudentVisibilityColumn,
  type DefaultSidebarConfigItem,
} from '../constants/sidebarConfigDefaults';
import { useAuth } from '../context/AuthContext';

export type SidebarConfigStudentVisibility = Record<string, boolean>;

interface SidebarItem extends DefaultSidebarConfigItem {}

interface SidebarConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  currentConfig: {
    items?: SidebarItem[];
    studentVisibility?: SidebarConfigStudentVisibility;
  };
  onConfigUpdated: (updatedCourse: any) => void;
}

function navIconForId(id: string) {
  return navigationItems.find((n) => n.id === id)?.icon;
}

function defaultStudentVisible(itemId: string): boolean {
  const v = DEFAULT_SIDEBAR_STUDENT_VISIBILITY[itemId];
  return v !== undefined ? v : true;
}

const SidebarConfigModal: React.FC<SidebarConfigModalProps> = ({
  isOpen,
  onClose,
  courseId,
  currentConfig,
  onConfigUpdated,
}) => {
  const { user } = useAuth();
  const [items, setItems] = useState<SidebarItem[]>(currentConfig.items || []);
  const [studentVisibility, setStudentVisibility] = useState<SidebarConfigStudentVisibility>(
    currentConfig.studentVisibility || {}
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');

  const sidebarItemsColumnItems = useMemo(
    () => items.filter((i) => !shouldHideFromSidebarItemsColumn(user?.role, i.id)),
    [items, user?.role]
  );

  const studentVisibilityColumnItems = useMemo(
    () => items.filter((i) => !shouldHideFromStudentVisibilityColumn(user?.role, i.id)),
    [items, user?.role]
  );

  useEffect(() => {
    if (isOpen) {
      setItems(normalizeSidebarItemsForModal(currentConfig.items));

      const fromServer = Object.fromEntries(
        Object.entries(currentConfig.studentVisibility || {}).filter(([key]) =>
          ALLOWED_STUDENT_VISIBILITY_KEYS.has(key)
        )
      ) as SidebarConfigStudentVisibility;

      setStudentVisibility({ ...DEFAULT_SIDEBAR_STUDENT_VISIBILITY, ...fromServer });
      setError('');
    }
  }, [isOpen, currentConfig]);

  const handleDragStart = (e: React.DragEvent, dragId: string) => {
    const dragIndex = items.findIndex((i) => i.id === dragId);
    if (dragIndex < 0 || items[dragIndex]?.fixed) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', dragId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetItemId: string) => {
    e.preventDefault();
    const dragId = e.dataTransfer.getData('text/plain');
    if (!dragId || dragId === targetItemId) return;

    const dragIndex = items.findIndex((i) => i.id === dragId);
    const dropIndex = items.findIndex((i) => i.id === targetItemId);
    if (dragIndex === -1 || dropIndex === -1) return;
    if (items[dropIndex]?.fixed) return;

    const newItems = [...items];
    const draggedItem = newItems[dragIndex];

    newItems.splice(dragIndex, 1);
    newItems.splice(dropIndex, 0, draggedItem);

    const updatedItems = newItems.map((item, index) => {
      if (item.fixed) {
        return item;
      }
      return {
        ...item,
        order: index,
      };
    });

    setItems(updatedItems);
  };

  const toggleItemVisibility = (itemId: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, visible: !item.visible } : item))
    );
  };

  const toggleStudentVisibility = (itemId: string) => {
    const current = studentVisibility[itemId] ?? defaultStudentVisible(itemId);
    setStudentVisibility((prev) => ({
      ...prev,
      [itemId]: !current,
    }));
  };

  const resetToDefault = () => {
    setItems(getDefaultSidebarConfigItems());
    setStudentVisibility({ ...DEFAULT_SIDEBAR_STUDENT_VISIBILITY });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      const cleanItems = items.map((item) => ({
        id: item.id,
        label: item.label,
        visible: Boolean(item.visible),
        order: Number(item.order),
      }));

      const visibilityPayload = buildStudentVisibilityForSave(studentVisibility);

      const response = await api.put(`/courses/${courseId}/sidebar-config`, {
        items: cleanItems,
        studentVisibility: visibilityPayload,
      });

      if (response.data.success) {
        onConfigUpdated(response.data.data);
        onClose();
      } else {
        setError(response.data.message || 'Failed to save configuration');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-2 sm:p-4">
      <div className="flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800 sm:max-h-[90vh]">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 sm:text-xl">
            Customize Course Sidebar
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 sm:text-base">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-4 text-lg font-medium text-gray-900 dark:text-gray-100">Sidebar Items</h3>
              <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                Drag items to reorder them. Use the eye icons to control visibility for all users.
              </p>

              <div className="space-y-2">
                {sidebarItemsColumnItems.map((item) => {
                  const Icon = navIconForId(item.id);
                  return (
                    <div
                      key={item.id}
                      draggable={!item.fixed}
                      onDragStart={(e) => handleDragStart(e, item.id)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, item.id)}
                      className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                        item.fixed
                          ? 'cursor-default border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900'
                          : 'cursor-move'
                      } ${
                        item.visible
                          ? 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600'
                          : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900'
                      }`}
                    >
                      {item.fixed ? (
                        <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center">
                          <div className="h-2 w-2 rounded-full bg-gray-400 dark:bg-gray-500" />
                        </div>
                      ) : (
                        <GripVertical className="h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                      )}
                      {Icon && <Icon className="h-5 w-5 flex-shrink-0 text-gray-600 dark:text-gray-400" />}
                      <span
                        className={`flex-1 ${
                          item.visible
                            ? 'text-gray-900 dark:text-gray-100'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {item.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleItemVisibility(item.id)}
                        className={`rounded p-1 transition-colors ${
                          item.visible
                            ? 'text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                            : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
                        }`}
                        title={item.visible ? 'Hide item' : 'Show item'}
                      >
                        {item.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="mb-4 text-lg font-medium text-gray-900 dark:text-gray-100">Student Visibility</h3>
              <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                Control which items are visible to students. Teachers and admins can always see all items.
              </p>

              <div className="space-y-2">
                {studentVisibilityColumnItems.map((item) => {
                  const Icon = navIconForId(item.id);
                  const isVisibleToStudents = studentVisibility[item.id] ?? defaultStudentVisible(item.id);

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                        isVisibleToStudents
                          ? 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
                          : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900'
                      }`}
                    >
                      {Icon && <Icon className="h-5 w-5 flex-shrink-0 text-gray-600 dark:text-gray-400" />}
                      <span
                        className={`flex-1 ${
                          isVisibleToStudents
                            ? 'text-gray-900 dark:text-gray-100'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {item.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleStudentVisibility(item.id)}
                        className={`rounded p-1 transition-colors ${
                          isVisibleToStudents
                            ? 'text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                            : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
                        }`}
                        title={isVisibleToStudents ? 'Hide from students' : 'Show to students'}
                      >
                        {isVisibleToStudents ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-shrink-0 flex-col items-stretch justify-between gap-3 border-t border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900 sm:flex-row sm:items-center sm:p-6">
          <button
            type="button"
            onClick={resetToDefault}
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-600 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 sm:text-base"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Reset to Default</span>
            <span className="sm:hidden">Reset</span>
          </button>

          <div className="flex gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm text-gray-600 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 sm:flex-none sm:text-base"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600 sm:flex-none sm:text-base"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SidebarConfigModal;
