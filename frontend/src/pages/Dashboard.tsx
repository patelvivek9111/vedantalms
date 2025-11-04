import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCourse } from '../contexts/CourseContext';
import { useAuth } from '../context/AuthContext';
import { ToDoPanel } from '../components/ToDoPanel';
import { MoreVertical, Megaphone, FileText, MessageSquare, Palette, BookOpen, File, Settings } from 'lucide-react';
import api, { getUserPreferences, updateUserPreferences } from '../services/api';

// Earthy tone color palette
const earthyColors = [
  { name: 'Olive Green', value: '#556B2F' },
  { name: 'Sage Green', value: '#9CAF88' },
  { name: 'Terra Cotta', value: '#E2725B' },
  { name: 'Warm Brown', value: '#8B4513' },
  { name: 'Moss Green', value: '#606C38' },
  { name: 'Clay Brown', value: '#D2691E' },
  { name: 'Forest Green', value: '#228B22' },
  { name: 'Earth Red', value: '#CD5C5C' },
  { name: 'Sand Beige', value: '#F4A460' },
  { name: 'Deep Brown', value: '#654321' }
];

// Available action icons
const availableIcons = [
  { id: 'announcements', name: 'Announcements', icon: Megaphone, color: 'text-gray-600' },
  { id: 'modules', name: 'Modules', icon: BookOpen, color: 'text-gray-600' },
  { id: 'pages', name: 'Pages', icon: File, color: 'text-gray-600' },
  { id: 'discussions', name: 'Discussions', icon: MessageSquare, color: 'text-gray-600' }
];

export function Dashboard() {
  const courseContext = useCourse();
  const { user } = useAuth();
  
  // Safety check - ensure context is available
  if (!courseContext) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  const { courses, loading, error, updateCourse, getCourses } = courseContext;
  const navigate = useNavigate();
  
  // State to track user's personal course colors (for students) or course default colors (for teachers)
  const [userCourseColors, setUserCourseColors] = useState<{ [key: string]: string }>({});
  const [loadingPreferences, setLoadingPreferences] = useState(true);
  const [openColorPicker, setOpenColorPicker] = useState<string | null>(null);
  
  // State to track selected icons for each course (default to first 3)
  const [courseIcons, setCourseIcons] = useState<{ [key: string]: string[] }>(() => {
    // Load icons from localStorage on component mount
    const savedIcons = localStorage.getItem('courseIcons');
    return savedIcons ? JSON.parse(savedIcons) : {};
  });
  const [openIconPicker, setOpenIconPicker] = useState<string | null>(null);
  
  // Refs for dropdown containers
  const colorPickerRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const iconPickerRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const isTeacherOrAdmin = user?.role === 'teacher' || user?.role === 'admin';

  // Load user preferences on mount and when user changes
  useEffect(() => {
    const loadUserPreferences = async () => {
      if (!user) {
        // Clear preferences when no user
        setUserCourseColors({});
        setLoadingPreferences(false);
        return;
      }
      
      try {
        setLoadingPreferences(true);
        const response = await getUserPreferences();
        if (response.data.success && response.data.preferences?.courseColors) {
          setUserCourseColors(response.data.preferences.courseColors || {});
        } else {
          setUserCourseColors({});
        }
      } catch (err) {
        console.error('Error loading user preferences:', err);
        setUserCourseColors({});
      } finally {
        setLoadingPreferences(false);
      }
    };

    loadUserPreferences();
  }, [user?._id]); // Use user._id to ensure it reloads when user changes

  // Click outside handler to close dropdowns - FIXED VERSION
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Check if click is outside any color picker
      const isOutsideColorPicker = Object.values(colorPickerRefs.current).every(ref => 
        !ref || !ref.contains(target)
      );
      
      // Check if click is outside any icon picker
      const isOutsideIconPicker = Object.values(iconPickerRefs.current).every(ref => 
        !ref || !ref.contains(target)
      );
      
      // Only close dropdowns if clicking outside AND not on a course card
      const isOnCourseCard = (target as Element).closest('[data-course-card]');
      
      if (isOutsideColorPicker && !isOnCourseCard) {
        setOpenColorPicker(null);
      }
      
      if (isOutsideIconPicker && !isOnCourseCard) {
        setOpenIconPicker(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-center p-4">
        {error}
      </div>
    );
  }

  // Split courses into published and unpublished
  const publishedCourses = courses.filter(course => course.published);
  const unpublishedCourses = courses.filter(course => !course.published);

  const handleCardClick = (courseId: string) => {
    navigate(`/courses/${courseId}`);
  };

  const handleColorChange = async (courseId: string, color: string) => {
    try {
      if (isTeacherOrAdmin) {
        // Teacher/Admin: Update course's defaultColor
        await updateCourse(courseId, undefined, undefined, undefined, color);
        // Refresh courses to get updated defaultColor
        await getCourses();
      } else {
        // Student: Update user's personal course color preference
    const newColors = {
          ...userCourseColors,
      [courseId]: color
    };
        setUserCourseColors(newColors);
        await updateUserPreferences({ courseColors: newColors });
      }
    setOpenColorPicker(null);
    } catch (err) {
      console.error('Error updating course color:', err);
      // Optionally show an error message to the user
    }
  };

  const getCourseColor = (courseId: string) => {
    const course = courses.find(c => c._id === courseId);
    
    if (isTeacherOrAdmin) {
      // Teachers see the course's defaultColor
      return course?.defaultColor || '#556B2F';
    } else {
      // Students: priority is user's personal color > course defaultColor > fallback
      if (userCourseColors[courseId]) {
        return userCourseColors[courseId];
      }
      return course?.defaultColor || '#556B2F';
    }
  };

  const getCourseIcons = (courseId: string) => {
    return courseIcons[courseId] || ['announcements', 'pages', 'discussions']; // Default icons
  };

  const handleIconToggle = (courseId: string, iconId: string) => {
    const currentIcons = getCourseIcons(courseId);
    const isSelected = currentIcons.includes(iconId);
    
    let newIcons;
    if (isSelected) {
      // Remove icon
      newIcons = currentIcons.filter(id => id !== iconId);
    } else {
      // Add icon (max 3)
      if (currentIcons.length < 3) {
        newIcons = [...currentIcons, iconId];
      } else {
        return; // Don't update if already at max
      }
    }
    
    const newCourseIcons = {
      ...courseIcons,
      [courseId]: newIcons
    };
    setCourseIcons(newCourseIcons);
    // Save to localStorage
    localStorage.setItem('courseIcons', JSON.stringify(newCourseIcons));
  };

  const renderActionIcon = (iconId: string, courseId: string) => {
    const iconConfig = availableIcons.find(icon => icon.id === iconId);
    if (!iconConfig) return null;
    
    const IconComponent = iconConfig.icon;
    return (
      <button 
        key={iconId}
        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          // Navigate to specific course section based on icon type
          switch(iconId) {
            case 'announcements':
              navigate(`/courses/${courseId}/announcements`);
              break;
            case 'modules':
              navigate(`/courses/${courseId}/modules`);
              break;
            case 'pages':
              navigate(`/courses/${courseId}/pages`);
              break;
            case 'discussions':
              navigate(`/courses/${courseId}/discussions`);
              break;
            default:
              navigate(`/courses/${courseId}`);
          }
        }}
      >
        <IconComponent className="h-5 w-5 text-gray-600" />
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-6 py-8 flex flex-col lg:flex-row gap-8">
        {/* Main dashboard content */}
        <div className="flex-1">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Dashboard</h1>
            <p className="text-gray-600">Welcome back, {user?.firstName}!</p>
          </div>
        {/* Published Courses Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            {isTeacherOrAdmin ? (
              <h2 className="text-xl font-semibold text-gray-700">Published Courses ({publishedCourses.length})</h2>
            ) : (
              <h2 className="text-xl font-semibold text-gray-700">My Courses</h2>
            )}
            {isTeacherOrAdmin && (
              <Link
                to="/courses/create"
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors"
              >
                Create Course
              </Link>
            )}
          </div>
          {publishedCourses.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No published courses</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {publishedCourses.map((course) => (
                <div 
                  key={course._id} 
                  className="bg-white rounded-xl shadow-lg overflow-visible cursor-pointer hover:shadow-xl transition-all duration-300 ml-4 border border-gray-100 group"
                  onClick={() => handleCardClick(course._id)}
                  data-course-card
                >
                  {/* Top section - Dynamic color */}
                  <div 
                    className="h-48 relative"
                    style={{ backgroundColor: getCourseColor(course._id) }}
                  >
                    <div className="absolute top-3 right-3">
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenColorPicker(openColorPicker === course._id ? null : course._id);
                            setOpenIconPicker(null);
                          }}
                          className="p-1 hover:bg-white/20 rounded transition-colors"
                        >
                          <MoreVertical className="h-5 w-5 text-white" />
                        </button>
                        
                        {/* Color picker dropdown */}
                        {openColorPicker === course._id && (
                          <div 
                            className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-50 min-w-48" 
                            ref={(el) => colorPickerRefs.current[course._id] = el}
                          >
                            <div className="flex items-center gap-2 mb-3">
                              <Palette className="h-4 w-4 text-gray-600" />
                              <span className="text-sm font-medium text-gray-700">Choose Color</span>
                            </div>
                            <div className="grid grid-cols-5 gap-2 mb-3">
                              {earthyColors.map((color) => (
                                <button
                                  key={color.value}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleColorChange(course._id, color.value);
                                  }}
                                  className="w-8 h-8 rounded-full border-2 border-gray-300 hover:border-gray-400 transition-colors"
                                  style={{ backgroundColor: color.value }}
                                  title={color.name}
                                />
                              ))}
                            </div>
                            <hr className="my-2" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenColorPicker(null);
                                setOpenIconPicker(openIconPicker === course._id ? null : course._id);
                              }}
                              className="flex items-center gap-2 w-full text-left text-sm text-gray-700 hover:bg-gray-50 p-2 rounded"
                            >
                              <Settings className="h-4 w-4" />
                              <span>Display Icons</span>
                            </button>
                          </div>
                        )}

                        {/* Icon picker dropdown */}
                        {openIconPicker === course._id && (
                          <div 
                            className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-50 min-w-48" 
                            ref={(el) => iconPickerRefs.current[course._id] = el}
                          >
                            <div className="flex items-center gap-2 mb-3">
                              <Settings className="h-4 w-4 text-gray-600" />
                              <span className="text-sm font-medium text-gray-700">Display Icons (Max 3)</span>
                            </div>
                            <div className="space-y-2">
                              {availableIcons.map((iconConfig) => {
                                const IconComponent = iconConfig.icon;
                                const isSelected = getCourseIcons(course._id).includes(iconConfig.id);
                                const isDisabled = !isSelected && getCourseIcons(course._id).length >= 3;
                                
                                return (
                                  <button
                                    key={iconConfig.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!isDisabled) {
                                        handleIconToggle(course._id, iconConfig.id);
                                      }
                                    }}
                                    className={`flex items-center gap-2 w-full text-left p-2 rounded transition-colors ${
                                      isSelected 
                                        ? 'bg-blue-50 text-blue-700' 
                                        : isDisabled 
                                          ? 'text-gray-400 cursor-not-allowed' 
                                          : 'text-gray-700 hover:bg-gray-50'
                                    }`}
                                    disabled={isDisabled}
                                  >
                                    <IconComponent className="h-4 w-4" />
                                    <span className="text-sm">{iconConfig.name}</span>
                                    {isSelected && (
                                      <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                        Selected
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                            <hr className="my-2" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenIconPicker(null);
                                setOpenColorPicker(openColorPicker === course._id ? null : course._id);
                              }}
                              className="flex items-center gap-2 w-full text-left text-sm text-gray-700 hover:bg-gray-50 p-2 rounded"
                            >
                              <Palette className="h-4 w-4" />
                              <span>Choose Color</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Bottom section - White */}
                  <div className="p-6">
                    <div className="mb-2">
                      <h2 
                        className="font-bold text-lg mb-1"
                        style={{ color: getCourseColor(course._id) }}
                      >
                        {course.catalog?.courseCode || course.title}
                      </h2>
                      <p className="text-gray-500 text-sm">
                        Instructor: {course.instructor.firstName} {course.instructor.lastName}
                      </p>
                    </div>
                    
                    {/* Action icons */}
                    <div className="flex justify-between items-center mt-4">
                      {getCourseIcons(course._id).map((iconId) => renderActionIcon(iconId, course._id))}
                      {/* Add empty divs to maintain spacing if less than 3 icons */}
                      {Array.from({ length: 3 - getCourseIcons(course._id).length }).map((_, index) => (
                        <div key={index} className="w-9 h-9"></div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Unpublished Courses Section (hide for students) */}
        {isTeacherOrAdmin && (
          <div>
            <h2 className="text-xl font-semibold text-gray-700 mb-6">Unpublished Courses ({unpublishedCourses.length})</h2>
            {unpublishedCourses.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No unpublished courses</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {unpublishedCourses.map((course) => (
                  <div 
                    key={course._id} 
                    className="bg-white rounded-xl shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-100"
                    onClick={() => handleCardClick(course._id)}
                  >
                    {/* Top section - Dynamic color */}
                    <div 
                      className="h-48 relative bg-gradient-to-br"
                      style={{ 
                        background: `linear-gradient(135deg, ${getCourseColor(course._id)} 0%, ${getCourseColor(course._id)}dd 100%)`
                      }}
                    >
                      <div className="absolute top-3 right-3">
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenColorPicker(openColorPicker === course._id ? null : course._id);
                              setOpenIconPicker(null);
                            }}
                            className="p-1 hover:bg-white/20 rounded transition-colors"
                          >
                            <MoreVertical className="h-5 w-5 text-white" />
                          </button>
                          
                          {/* Color picker dropdown */}
                          {openColorPicker === course._id && (
                            <div 
                              className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-50 min-w-48" 
                              ref={(el) => colorPickerRefs.current[course._id] = el}
                            >
                              <div className="flex items-center gap-2 mb-3">
                                <Palette className="h-4 w-4 text-gray-600" />
                                <span className="text-sm font-medium text-gray-700">Choose Color</span>
                              </div>
                              <div className="grid grid-cols-5 gap-2 mb-3">
                                {earthyColors.map((color) => (
                                  <button
                                    key={color.value}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleColorChange(course._id, color.value);
                                    }}
                                    className="w-8 h-8 rounded-full border-2 border-gray-300 hover:border-gray-400 transition-colors"
                                    style={{ backgroundColor: color.value }}
                                    title={color.name}
                                  />
                                ))}
                              </div>
                              <hr className="my-2" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenColorPicker(null);
                                  setOpenIconPicker(openIconPicker === course._id ? null : course._id);
                                }}
                                className="flex items-center gap-2 w-full text-left text-sm text-gray-700 hover:bg-gray-50 p-2 rounded"
                              >
                                <Settings className="h-4 w-4" />
                                <span>Display Icons</span>
                              </button>
                            </div>
                          )}

                          {/* Icon picker dropdown */}
                          {openIconPicker === course._id && (
                            <div 
                              className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-50 min-w-48" 
                              ref={(el) => iconPickerRefs.current[course._id] = el}
                            >
                              <div className="flex items-center gap-2 mb-3">
                                <Settings className="h-4 w-4 text-gray-600" />
                                <span className="text-sm font-medium text-gray-700">Display Icons (Max 3)</span>
                              </div>
                              <div className="space-y-2">
                                {availableIcons.map((iconConfig) => {
                                  const IconComponent = iconConfig.icon;
                                  const isSelected = getCourseIcons(course._id).includes(iconConfig.id);
                                  const isDisabled = !isSelected && getCourseIcons(course._id).length >= 3;
                                  
                                  return (
                                    <button
                                      key={iconConfig.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!isDisabled) {
                                          handleIconToggle(course._id, iconConfig.id);
                                        }
                                      }}
                                      className={`flex items-center gap-2 w-full text-left p-2 rounded transition-colors ${
                                        isSelected 
                                          ? 'bg-blue-50 text-blue-700' 
                                          : isDisabled 
                                            ? 'text-gray-400 cursor-not-allowed' 
                                            : 'text-gray-700 hover:bg-gray-50'
                                      }`}
                                      disabled={isDisabled}
                                    >
                                      <IconComponent className="h-4 w-4" />
                                      <span className="text-sm">{iconConfig.name}</span>
                                      {isSelected && (
                                        <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                          Selected
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                              <hr className="my-2" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenIconPicker(null);
                                  setOpenColorPicker(openColorPicker === course._id ? null : course._id);
                                }}
                                className="flex items-center gap-2 w-full text-left text-sm text-gray-700 hover:bg-gray-50 p-2 rounded"
                              >
                                <Palette className="h-4 w-4" />
                                <span>Choose Color</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Bottom section - White */}
                    <div className="p-6">
                      <div className="mb-3">
                        <h2 
                          className="font-bold text-xl mb-2"
                          style={{ color: getCourseColor(course._id) }}
                        >
                          {course.catalog?.courseCode || course.title}
                        </h2>
                        <p className="text-gray-600 text-sm flex items-center">
                          <span className="w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
                          Instructor: {course.instructor.firstName} {course.instructor.lastName}
                        </p>
                      </div>
                      
                      {/* Action icons */}
                      <div className="flex justify-between items-center mt-4">
                        {getCourseIcons(course._id).map((iconId) => renderActionIcon(iconId, course._id))}
                        {/* Add empty divs to maintain spacing if less than 3 icons */}
                        {Array.from({ length: 3 - getCourseIcons(course._id).length }).map((_, index) => (
                          <div key={index} className="w-9 h-9"></div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {/* To-Do Panel: always show */}
      <aside className="w-full lg:w-96 flex-shrink-0">
        <ToDoPanel />
      </aside>
    </div>
  </div>
  );
} 