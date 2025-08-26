import React, { useState, useEffect } from 'react';
import { 
  X, 
  GripVertical, 
  Eye, 
  EyeOff, 
  Save, 
  RotateCcw,
  ClipboardList,
  BookOpen,
  FileText,
  PenTool,
  MessageSquare,
  Megaphone,
  BarChart3,
  Users,
  CheckSquare,
  BookOpenCheck,
  UserPlus
} from 'lucide-react';
import api from '../services/api';

interface SidebarItem {
  id: string;
  label: string;
  visible: boolean;
  order: number;
  fixed?: boolean;
}

interface StudentVisibility {
  overview: boolean;
  modules: boolean;
  pages: boolean;
  assignments: boolean;
  discussions: boolean;
  announcements: boolean;
  polls: boolean;
  groups: boolean;
  attendance: boolean;
  grades: boolean;
  gradebook: boolean;
  students: boolean;
}

interface SidebarConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  currentConfig: {
    items: SidebarItem[];
    studentVisibility: StudentVisibility;
  };
  onConfigUpdated: (updatedCourse: any) => void;
}

const iconMap: { [key: string]: React.ComponentType<any> } = {
  overview: ClipboardList,
  modules: BookOpen,
  pages: FileText,
  assignments: PenTool,
  discussions: MessageSquare,
  announcements: Megaphone,
  polls: BarChart3,
  groups: Users,
  attendance: CheckSquare,
  grades: BarChart3,
  gradebook: BookOpenCheck,
  students: UserPlus
};

const SidebarConfigModal: React.FC<SidebarConfigModalProps> = ({
  isOpen,
  onClose,
  courseId,
  currentConfig,
  onConfigUpdated
}) => {
  const [items, setItems] = useState<SidebarItem[]>(currentConfig.items || []);
  const [studentVisibility, setStudentVisibility] = useState<StudentVisibility>(currentConfig.studentVisibility || {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      // Clean the items array to remove any MongoDB _id fields
      const cleanItems = (currentConfig.items || []).map(item => ({
        id: item.id,
        label: item.label,
        visible: item.visible,
        order: item.order,
        fixed: item.fixed
      }));
      
      setItems(cleanItems);
      
      // Clean studentVisibility to ensure it only contains valid keys
      const cleanStudentVisibility = currentConfig.studentVisibility || {};
      const validKeys = [
        'overview', 'modules', 'pages', 'assignments', 'discussions',
        'announcements', 'polls', 'groups', 'attendance', 'grades',
        'gradebook', 'students'
      ];
      
      const filteredStudentVisibility = Object.keys(cleanStudentVisibility)
        .filter(key => validKeys.includes(key))
        .reduce((obj, key) => {
          obj[key as keyof StudentVisibility] = cleanStudentVisibility[key as keyof StudentVisibility];
          return obj;
        }, {} as StudentVisibility);
      
      setStudentVisibility(filteredStudentVisibility);
      setError('');
    }
  }, [isOpen, currentConfig]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    // Prevent dragging if the item is fixed (like Overview)
    if (items[index]?.fixed) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
    
    if (dragIndex === dropIndex) return;

    // Prevent dropping on fixed items (like Overview)
    if (items[dropIndex]?.fixed) return;

    const newItems = [...items];
    const draggedItem = newItems[dragIndex];
    
    // Remove the dragged item
    newItems.splice(dragIndex, 1);
    
    // Insert at new position
    newItems.splice(dropIndex, 0, draggedItem);
    
    // Update order numbers, but keep fixed items at their original position
    const updatedItems = newItems.map((item, index) => {
      if (item.fixed) {
        return item; // Keep fixed items unchanged
      }
      return {
        ...item,
        order: index
      };
    });
    
    setItems(updatedItems);
  };

  const toggleItemVisibility = (itemId: string) => {
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, visible: !item.visible } : item
    ));
  };

  const toggleStudentVisibility = (itemId: string) => {
    setStudentVisibility(prev => ({
      ...prev,
      [itemId]: !prev[itemId as keyof StudentVisibility]
    }));
  };

  const resetToDefault = () => {
    const defaultItems: SidebarItem[] = [
      { id: 'overview', label: 'Overview', visible: true, order: 0, fixed: true },
      { id: 'modules', label: 'Modules', visible: true, order: 1 },
      { id: 'pages', label: 'Pages', visible: true, order: 2 },
      { id: 'assignments', label: 'Assignments', visible: true, order: 3 },
      { id: 'discussions', label: 'Discussions', visible: true, order: 4 },
      { id: 'announcements', label: 'Announcements', visible: true, order: 5 },
      { id: 'polls', label: 'Polls', visible: true, order: 6 },
      { id: 'groups', label: 'Groups', visible: true, order: 7 },
      { id: 'attendance', label: 'Attendance', visible: true, order: 8 },
      { id: 'grades', label: 'Grades', visible: true, order: 9 },
      { id: 'gradebook', label: 'Gradebook', visible: true, order: 10 },
      { id: 'students', label: 'People', visible: true, order: 11 }
    ];

    const defaultStudentVisibility: StudentVisibility = {
      overview: true,
      modules: true,
      pages: true,
      assignments: true,
      discussions: true,
      announcements: true,
      polls: true,
      groups: true,
      attendance: true,
      grades: true,
      gradebook: false,
      students: true
    };

    setItems(defaultItems);
    setStudentVisibility(defaultStudentVisibility);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      // Clean the items array to remove any MongoDB _id fields
      const cleanItems = items.map(item => ({
        id: item.id,
        label: item.label,
        visible: item.visible,
        order: item.order,
        fixed: item.fixed
      }));

      // Debug: Log what we're sending
      console.log('Sending sidebar config:', { items: cleanItems, studentVisibility });
      
      const response = await api.put(`/courses/${courseId}/sidebar-config`, {
        items: cleanItems,
        studentVisibility
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Customize Course Sidebar</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Item Ordering and Visibility */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Sidebar Items</h3>
              <p className="text-sm text-gray-600 mb-4">
                Drag items to reorder them. Use the eye icons to control visibility for all users.
              </p>
              
              <div className="space-y-2">
                {items.map((item, index) => {
                  const Icon = iconMap[item.id];
                  return (
                                         <div
                       key={item.id}
                       draggable={!item.fixed}
                       onDragStart={(e) => handleDragStart(e, index)}
                       onDragOver={handleDragOver}
                       onDrop={(e) => handleDrop(e, index)}
                       className={`flex items-center gap-3 p-3 border rounded-lg transition-colors ${
                         item.fixed 
                           ? 'cursor-default bg-gray-50 border-gray-200' 
                           : 'cursor-move'
                       } ${
                         item.visible 
                           ? 'bg-white border-gray-200 hover:border-gray-300' 
                           : 'bg-gray-50 border-gray-200'
                       }`}
                     >
                       {item.fixed ? (
                         <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                           <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                         </div>
                       ) : (
                         <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
                       )}
                      {Icon && <Icon className="w-5 h-5 text-gray-600 flex-shrink-0" />}
                      <span className={`flex-1 ${item.visible ? 'text-gray-900' : 'text-gray-500'}`}>
                        {item.label}
                      </span>
                      <button
                        onClick={() => toggleItemVisibility(item.id)}
                        className={`p-1 rounded transition-colors ${
                          item.visible 
                            ? 'text-gray-600 hover:text-gray-800' 
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                        title={item.visible ? 'Hide item' : 'Show item'}
                      >
                        {item.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Student Visibility Controls */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Student Visibility</h3>
              <p className="text-sm text-gray-600 mb-4">
                Control which items are visible to students. Teachers and admins can always see all items.
              </p>
              
              <div className="space-y-2">
                {items.map((item) => {
                  const Icon = iconMap[item.id];
                  const isVisibleToStudents = studentVisibility[item.id as keyof StudentVisibility];
                  
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 p-3 border rounded-lg transition-colors ${
                        isVisibleToStudents 
                          ? 'bg-white border-gray-200' 
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      {Icon && <Icon className="w-5 h-5 text-gray-600 flex-shrink-0" />}
                      <span className={`flex-1 ${isVisibleToStudents ? 'text-gray-900' : 'text-gray-500'}`}>
                        {item.label}
                      </span>
                      <button
                        onClick={() => toggleStudentVisibility(item.id)}
                        className={`p-1 rounded transition-colors ${
                          isVisibleToStudents 
                            ? 'text-gray-600 hover:text-gray-800' 
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                        title={isVisibleToStudents ? 'Hide from students' : 'Show to students'}
                      >
                        {isVisibleToStudents ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={resetToDefault}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Default
          </button>
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SidebarConfigModal; 