import React, { useState, useEffect, useRef } from 'react';
import { X, Settings, Palette } from 'lucide-react';
import { updateUserPreferences, getUserPreferences } from '../services/api';
import logger from '../utils/logger';

interface CourseCardSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: {
    _id: string;
    title: string;
    catalog?: {
      courseCode?: string;
    };
    defaultColor?: string;
  };
  currentColor: string;
  onColorChange: (courseId: string, color: string) => void;
}

// Color palette - earthy tones matching the system
const colorPalette = [
  '#556B2F', // Olive Green
  '#9CAF88', // Sage Green
  '#E2725B', // Terra Cotta
  '#8B4513', // Warm Brown
  '#606C38', // Moss Green
  '#D2691E', // Clay Brown
  '#228B22', // Forest Green
  '#CD5C5C', // Earth Red
  '#F4A460', // Sand Beige
  '#654321', // Deep Brown
  '#4169E1', // Royal Blue
  '#9370DB', // Medium Purple
  '#FF6347', // Tomato
  '#20B2AA', // Light Sea Green
  '#FFA500', // Orange
  '#DC143C', // Crimson
];

const CourseCardSettingsModal: React.FC<CourseCardSettingsModalProps> = ({
  isOpen,
  onClose,
  course,
  currentColor,
  onColorChange,
}) => {
  const [selectedColor, setSelectedColor] = useState(currentColor);
  const [saving, setSaving] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedColor(currentColor);
  }, [currentColor, isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleSave = async () => {
    if (selectedColor === currentColor) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      // Get current preferences
      const prefsResponse = await getUserPreferences();
      const currentPrefs = prefsResponse.data?.preferences || {};
      const currentCourseColors = currentPrefs.courseColors || {};

      // Update course color
      const updatedCourseColors = {
        ...currentCourseColors,
        [course._id]: selectedColor,
      };

      // Save to preferences
      await updateUserPreferences({
        courseColors: updatedCourseColors,
      });

      // Update local state
      onColorChange(course._id, selectedColor);
      onClose();
    } catch (error) {
      logger.error('Error saving course color', error);
      alert('Failed to save course color. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const defaultColor = course.defaultColor || colorPalette[0];
    setSelectedColor(defaultColor);

    setSaving(true);
    try {
      // Get current preferences
      const prefsResponse = await getUserPreferences();
      const currentPrefs = prefsResponse.data?.preferences || {};
      const currentCourseColors = currentPrefs.courseColors || {};

      // Remove course color to use default
      const updatedCourseColors = { ...currentCourseColors };
      delete updatedCourseColors[course._id];

      // Save to preferences
      await updateUserPreferences({
        courseColors: Object.keys(updatedCourseColors).length > 0 ? updatedCourseColors : {},
      });

      // Update local state
      onColorChange(course._id, defaultColor);
      onClose();
    } catch (error) {
      logger.error('Error resetting course color', error);
      alert('Failed to reset course color. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const courseCode = course.catalog?.courseCode || course.title?.substring(0, 8).toUpperCase() || 'COURSE';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-auto border border-gray-200 dark:border-gray-700"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Course Card Settings
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {courseCode}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Color Picker Section */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                <Palette className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Card Color
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Choose a color for this course card
                </p>
              </div>
            </div>

            {/* Current Color Preview */}
            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-lg shadow-md border-2 border-gray-300 dark:border-gray-600"
                  style={{ backgroundColor: selectedColor }}
                ></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Selected Color
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    {selectedColor}
                  </p>
                </div>
              </div>
            </div>

            {/* Color Palette */}
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
              {colorPalette.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`w-10 h-10 rounded-lg transition-all duration-200 ${
                    selectedColor === color
                      ? 'ring-4 ring-blue-500 dark:ring-blue-400 ring-offset-2 dark:ring-offset-gray-800 scale-110'
                      : 'hover:scale-105 hover:ring-2 hover:ring-gray-300 dark:hover:ring-gray-600'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                >
                  {selectedColor === color && (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-3 h-3 bg-white rounded-full shadow-lg"></div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl">
          <button
            onClick={handleReset}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            Reset to Default
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium text-sm shadow-lg flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseCardSettingsModal;



