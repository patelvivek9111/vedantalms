import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCourse } from '../contexts/CourseContext';
import { useAuth } from '../contexts/AuthContext';
import { ToDoPanel } from '../components/common/ToDoPanel';
import { MoreVertical, Megaphone, MessageSquare, Palette, BookOpen, File, Settings, Bell, Folder, GripVertical, Search, QrCode } from 'lucide-react';
import api, { updateUserPreferences } from '../services/api';
import NotificationCenter from '../components/common/NotificationCenter';
import MobileTopNav from '../components/common/MobileTopNav';
import { BurgerMenu } from '../components/layout/BurgerMenu';
import { NavCustomizationModal, NavItem, ALL_NAV_OPTIONS, getDefaultNavItemIds } from '../components/layout/NavCustomizationModal';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { CourseCardSkeleton } from '../components/common/SkeletonLoader';
import PullToRefresh from '../components/common/PullToRefresh';
import SwipeableContainer from '../components/common/SwipeableContainer';
import { useBottomNavSwipe } from '../hooks/useBottomNavSwipe';
import ScanCourseQrModal from '../components/course/ScanCourseQrModal';
import { extractJoinTokenFromQrText } from '../utils/joinCourseToken';
import { toast } from 'react-toastify';
import { useNotificationBadge } from '../hooks/notifications/useNotificationBadge';
import { useUserPreferencesQuery, userPreferencesQueryKey } from '../hooks/useUserPreferencesQuery';
import { useQueryClient } from '@tanstack/react-query';

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

const BTN_PRIMARY =
  'inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[11px] font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 sm:text-xs lg:px-4 lg:text-sm';
const BTN_SECONDARY =
  'inline-flex h-10 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-[11px] font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 sm:text-xs lg:px-4 lg:text-sm';
const SECTION_TITLE =
  'text-xs font-semibold text-gray-900 dark:text-gray-100 lg:text-xl lg:font-semibold lg:text-gray-700 dark:lg:text-gray-300';
const ITEM_CARD =
  'overflow-hidden rounded-lg border border-gray-200/90 bg-white dark:border-gray-700 dark:bg-gray-800';


export function Dashboard() {
  const courseContext = useCourse();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Safety check - ensure context is available
  if (!courseContext) {
    return (
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-48 mb-4"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <CourseCardSkeleton count={6} />
          </div>
        </div>
      </div>
    );
  }
  
  const { courses, loading, error, updateCourseDefaultColor, getCourses } = courseContext;
  const queryClient = useQueryClient();

  // Refresh function for pull-to-refresh
  const handleRefresh = async () => {
    await getCourses();
  };

  // Swipe navigation for bottom nav
  const { handleSwipeLeft, handleSwipeRight, enabled: swipeEnabled } = useBottomNavSwipe();
  
  // User course color preferences (students only — sourced from React Query, not duplicated local state)
  const { data: userPreferences } = useUserPreferencesQuery(Boolean(user?._id));
  const userCourseColors = userPreferences?.courseColors ?? {};
  const [openColorPicker, setOpenColorPicker] = useState<string | null>(null);
  
  // State to track selected icons for each course (default to first 3)
  const [courseIcons, setCourseIcons] = useState<{ [key: string]: string[] }>(() => {
    // Load icons from localStorage on component mount
    const savedIcons = localStorage.getItem('courseIcons');
    return savedIcons ? JSON.parse(savedIcons) : {};
  });
  const [openIconPicker, setOpenIconPicker] = useState<string | null>(null);
  
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const { unreadCount: notificationCount } = useNotificationBadge();
  
  // Navigation customization state
  const [showNavCustomization, setShowNavCustomization] = useState(false);
  const [showBurgerMenu, setShowBurgerMenu] = useState(false);
  const [currentNavItems, setCurrentNavItems] = useState<NavItem[]>([]);
  const [showGrades, setShowGrades] = useState(() => {
    const saved = localStorage.getItem('showGrades');
    return saved ? JSON.parse(saved) : true;
  });
  const [courseGrades, setCourseGrades] = useState<{ [courseId: string]: { grade: number | null; letter?: string } }>({});
  const [loadingGrades, setLoadingGrades] = useState<{ [courseId: string]: boolean }>({});
  
  // Refs for dropdown containers
  const colorPickerRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const iconPickerRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Course order state for drag and drop (must be before early returns)
  const [courseOrder, setCourseOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('courseOrder');
    return saved ? JSON.parse(saved) : [];
  });
  const [showCourseQrScanner, setShowCourseQrScanner] = useState(false);

  const isTeacherOrAdmin = user?.role === 'teacher' || user?.role === 'admin';

  const renderCourseGradeBadge = (courseId: string) => {
    if (!showGrades) return null;

    const gradeEntry = courseGrades[courseId];
    const gradeLoaded = Object.prototype.hasOwnProperty.call(courseGrades, courseId);
    const grade = gradeEntry?.grade;
    const hasGrade =
      grade !== null && grade !== undefined && typeof grade === 'number' && !isNaN(grade);

    return (
      <div className="absolute left-2 top-2 z-10 lg:left-3 lg:top-3">
        {loadingGrades[courseId] || !gradeLoaded ? (
          <div className="rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 backdrop-blur-sm dark:bg-gray-900/90 dark:text-gray-400 lg:text-[11px]">
            …
          </div>
        ) : hasGrade ? (
          <div
            className="rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-gray-900 shadow-sm backdrop-blur-sm dark:bg-gray-900/90 dark:text-gray-100 lg:text-[11px]"
            title={!isTeacherOrAdmin && gradeEntry?.letter ? gradeEntry.letter : undefined}
          >
            {grade!.toFixed(2)}%
          </div>
        ) : (
          <div
            className="rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 shadow-sm backdrop-blur-sm dark:bg-gray-900/90 dark:text-gray-400 lg:text-[11px]"
            title={
              isTeacherOrAdmin
                ? 'No student grades recorded yet for this course'
                : 'Your grade has not been posted yet'
            }
          >
            —
          </div>
        )}
      </div>
    );
  };

  const handleCourseQrScanSuccess = useCallback(
    (text: string) => {
      const token = extractJoinTokenFromQrText(text);
      setShowCourseQrScanner(false);
      if (token) {
        navigate(`/join-course?t=${encodeURIComponent(token)}`);
      } else {
        toast.error('Could not read a course join code from that QR.');
      }
    },
    [navigate]
  );

  // Load user preferences on mount and when user changes
  useEffect(() => {
    if (!user) {
      setOpenColorPicker(null);
    }
  }, [user?._id]);

  // Fetch course grades when showGrades is enabled
  useEffect(() => {
    if (!showGrades) {
      setCourseGrades({});
      setLoadingGrades({});
      return;
    }

    if (!courses || courses.length === 0) return;

    let cancelled = false;
    const publishedCoursesList = courses.filter((course) => course.published);
    if (publishedCoursesList.length === 0) return;

    const courseIds = publishedCoursesList.map((c) => String(c._id));

    setLoadingGrades((prev) => {
      const next = { ...prev };
      courseIds.forEach((id) => {
        next[id] = true;
      });
      return next;
    });

    const fetchTeacherAveragesBatch = async () => {
      try {
        const response = await api.get(`/grades/courses/averages?courseIds=${courseIds.join(',')}`, {
          timeout: 120000,
        });
        const averages = response.data?.averages || {};
        if (cancelled) return;
        setCourseGrades((prev) => {
          const next = { ...prev };
          courseIds.forEach((courseId) => {
            const average = averages[courseId]?.average;
            const hasAverage =
              average !== null && average !== undefined && typeof average === 'number' && !isNaN(average);
            next[courseId] = { grade: hasAverage ? average : null };
          });
          return next;
        });
      } catch {
        if (!cancelled) {
          setCourseGrades((prev) => {
            const next = { ...prev };
            courseIds.forEach((courseId) => {
              next[courseId] = { grade: null };
            });
            return next;
          });
        }
      } finally {
        if (!cancelled) {
          setLoadingGrades((prev) => {
            const next = { ...prev };
            courseIds.forEach((courseId) => {
              next[courseId] = false;
            });
            return next;
          });
        }
      }
    };

    if (isTeacherOrAdmin) {
      void fetchTeacherAveragesBatch();
      return () => {
        cancelled = true;
      };
    }

    const fetchOne = async (courseId: string) => {
      try {
        const response = await api.get(`/grades/student/course/${courseId}`, {
          timeout: 60000,
        });
        const totalPercent = response.data?.totalPercent;
        const hasGrade =
          totalPercent !== null &&
          totalPercent !== undefined &&
          typeof totalPercent === 'number' &&
          !isNaN(totalPercent);
        if (!cancelled) {
          setCourseGrades((prev) => ({
            ...prev,
            [courseId]: {
              grade: hasGrade ? totalPercent : null,
              letter: response.data?.letterGrade || '',
            },
          }));
        }
      } catch {
        if (!cancelled) {
          setCourseGrades((prev) => ({
            ...prev,
            [courseId]: { grade: null },
          }));
        }
      } finally {
        if (!cancelled) {
          setLoadingGrades((prev) => ({ ...prev, [courseId]: false }));
        }
      }
    };

    Promise.all(courseIds.map((id) => fetchOne(id)));

    return () => {
      cancelled = true;
    };
  }, [showGrades, courses, isTeacherOrAdmin, user?._id]);

  // Load current navigation items
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
          
          // Filter out 'my-course' if user is not a teacher or admin
          const filteredItems = mappedItems.filter((item: NavItem) => {
            if (item.id === 'my-course' && user?.role !== 'teacher' && user?.role !== 'admin') {
              return false;
            }
            return true;
          });
          
          if (filteredItems.length > 0) {
            setCurrentNavItems(filteredItems);
            return;
          }
        }
      } catch (error) {
        }
      
      // Default items
      const availableOptions = ALL_NAV_OPTIONS.filter(option => {
        if (option.id === 'my-course') {
          return user?.role === 'teacher' || user?.role === 'admin';
        }
        return true;
      });
      
      const defaultItems = getDefaultNavItemIds(user?.role)
        .map(id => availableOptions.find(opt => opt.id === id))
        .filter((item): item is NavItem => item !== undefined);
      setCurrentNavItems(defaultItems);
    };

    loadNavItems();
  }, [user?.role]);

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
      
      // Note: NotificationCenter handles its own click outside detection
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Split courses into published and unpublished, then apply custom order
  // Must be computed before early returns to avoid hooks violation
  // Apply custom order to published courses
  const { publishedCourses, unpublishedCourses } = React.useMemo(() => {
    const publishedCoursesRaw = (courses || []).filter(course => course.published);
    const unpublishedCoursesList = (courses || []).filter(course => !course.published);
    
    // Apply custom order to published courses
    if (courseOrder.length === 0 || publishedCoursesRaw.length === 0) {
      return { publishedCourses: publishedCoursesRaw, unpublishedCourses: unpublishedCoursesList };
    }
    
    // Create a map for quick lookup
    const courseMap = new Map(publishedCoursesRaw.map(c => [c._id, c]));
    // Order by saved order, then append any new courses
    const ordered: typeof publishedCoursesRaw = [];
    const used = new Set<string>();
    
    for (const id of courseOrder) {
      if (courseMap.has(id)) {
        ordered.push(courseMap.get(id)!);
        used.add(id);
      }
    }
    
    // Add any courses not in the saved order
    for (const course of publishedCoursesRaw) {
      if (!used.has(course._id)) {
        ordered.push(course);
      }
    }
    
    return { publishedCourses: ordered, unpublishedCourses: unpublishedCoursesList };
  }, [courses, courseOrder]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-48 mb-4"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <CourseCardSkeleton count={6} />
          </div>
        </div>
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

  const handleCardClick = (courseId: string) => {
    navigate(`/courses/${courseId}`);
  };

  // Handle drag end for course reordering
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    const items = Array.from(publishedCourses);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Save new order to localStorage
    const newOrder = items.map(c => c._id);
    setCourseOrder(newOrder);
    localStorage.setItem('courseOrder', JSON.stringify(newOrder));
  };

  const handleColorChange = async (courseId: string, color: string) => {
    try {
      if (isTeacherOrAdmin) {
        await updateCourseDefaultColor(courseId, color);
      } else {
        const newColors = {
          ...userCourseColors,
          [courseId]: color,
        };

        queryClient.setQueryData(userPreferencesQueryKey, (old: Record<string, unknown> | undefined) => ({
          ...(old ?? {}),
          courseColors: newColors,
        }));

        const response = await updateUserPreferences({ courseColors: newColors });
        const savedColors = response.data?.preferences?.courseColors;
        if (savedColors) {
          queryClient.setQueryData(userPreferencesQueryKey, (old: Record<string, unknown> | undefined) => ({
            ...(old ?? {}),
            ...response.data.preferences,
            courseColors: savedColors,
          }));
        }
      }
      setOpenColorPicker(null);
    } catch (err) {
      if (!isTeacherOrAdmin) {
        await queryClient.invalidateQueries({ queryKey: userPreferencesQueryKey });
      }
      toast.error('Failed to update course color');
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
        className="rounded-lg p-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 lg:rounded-full lg:p-2"
        aria-label={`Go to ${iconConfig.name} for this course`}
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
        <IconComponent className="h-4 w-4 text-gray-500 dark:text-gray-400 lg:h-5 lg:w-5" aria-hidden="true" />
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <MobileTopNav
        title="Dashboard"
        leftAction="user"
        onLeftActionClick={() => setShowBurgerMenu(true)}
      />
      <BurgerMenu
        showBurgerMenu={showBurgerMenu}
        setShowBurgerMenu={setShowBurgerMenu}
        showNavCustomization={showNavCustomization}
        setShowNavCustomization={setShowNavCustomization}
        showGrades={showGrades}
        setShowGrades={setShowGrades}
        currentNavItems={currentNavItems}
        setCurrentNavItems={setCurrentNavItems}
      />

      <SwipeableContainer
        onSwipeLeft={swipeEnabled ? handleSwipeLeft : undefined}
        onSwipeRight={swipeEnabled ? handleSwipeRight : undefined}
        enabled={swipeEnabled}
        preventScrollInterference={true}
        className="min-h-screen"
      >
        <PullToRefresh onRefresh={handleRefresh} className="min-h-screen">
          <div className="container mx-auto flex flex-col gap-4 px-4 py-3 pt-20 lg:flex-row lg:gap-8 lg:px-6 lg:py-8 lg:pt-8">
          {/* Main dashboard content */}
          <div className="flex-1">
          <div className="mb-4 flex flex-col justify-between gap-3 sm:mb-8 sm:flex-row sm:items-start lg:gap-4">
            <div className="lg:ml-0">
              <h1 className="mb-2 hidden text-2xl font-bold text-gray-800 dark:text-gray-100 sm:text-3xl lg:block lg:text-4xl">Dashboard</h1>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 sm:text-xs lg:text-base lg:text-gray-600">
                Welcome back, {user?.firstName}!
              </p>
            </div>
            {/* Notification Bell - Hidden on mobile */}
            <div className="relative hidden lg:block">
              <button
                onClick={() => setShowNotificationCenter(!showNotificationCenter)}
                className="relative p-3 bg-white dark:bg-gray-800 rounded-full shadow-md hover:shadow-lg transition-all duration-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                aria-label={
                  notificationCount > 0
                    ? `Notifications, ${notificationCount} unread`
                    : 'Notifications'
                }
              >
                <Bell className="h-5 w-5 sm:h-6 sm:w-6 text-gray-700 dark:text-gray-300" />
                {notificationCount > 0 && (
                  <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold shadow-lg">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </div>
                )}
              </button>
            </div>
          </div>
          {/* Notification Center - Rendered outside header for proper fixed positioning */}
          <NotificationCenter 
            isOpen={showNotificationCenter} 
            onClose={() => setShowNotificationCenter(false)}
          />
        {/* Published Courses Section */}
        <div className="mb-4 sm:mb-8">
          <div className="mb-3 flex flex-col justify-between gap-2 sm:mb-6 sm:flex-row sm:items-center sm:gap-3">
            {isTeacherOrAdmin ? (
              <h2 className={SECTION_TITLE}>Published Courses ({publishedCourses.length})</h2>
            ) : (
              <h2 className={SECTION_TITLE}>My Courses</h2>
            )}
            {isTeacherOrAdmin ? (
              <Link to="/courses/create" className={`${BTN_PRIMARY} w-full sm:w-auto`}>
                Create Course
              </Link>
            ) : user?.role === 'student' ? (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setShowCourseQrScanner(true)} className={BTN_PRIMARY}>
                  <QrCode className="h-3.5 w-3.5 shrink-0" />
                  Join with QR
                </button>
                <Link to="/join-course" className={`${BTN_SECONDARY} w-full sm:w-auto`}>
                  Enter join code
                </Link>
              </div>
            ) : null}
          </div>
          {publishedCourses.length === 0 ? (
            <div className={`${ITEM_CARD} py-8 text-center lg:p-12`}>
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 lg:mb-4 lg:h-16 lg:w-16">
                <BookOpen className="h-6 w-6 text-gray-400 dark:text-gray-500 lg:h-8 lg:w-8" />
              </div>
              <h3 className="mb-1 text-xs font-semibold text-gray-900 dark:text-gray-100 lg:mb-2 lg:text-xl">
                {isTeacherOrAdmin ? 'No Published Courses Yet' : 'No Courses Enrolled'}
              </h3>
              <p className="mb-4 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400 lg:mb-6 lg:text-base">
                {isTeacherOrAdmin
                  ? 'Get started by creating your first course or publishing an existing one.'
                  : 'Browse the catalog to find and enroll in courses that interest you.'}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center lg:gap-3">
                {isTeacherOrAdmin ? (
                  <Link to="/courses/create" className={BTN_PRIMARY}>
                    Create Your First Course
                  </Link>
                ) : (
                  <>
                    <button type="button" onClick={() => setShowCourseQrScanner(true)} className={BTN_PRIMARY}>
                      <QrCode className="h-3.5 w-3.5 shrink-0" />
                      Join with QR
                    </button>
                    <Link to="/catalog" className={BTN_PRIMARY}>
                      <Search className="h-3.5 w-3.5 shrink-0" />
                      Browse Catalog
                    </Link>
                    <Link to="/join-course" className={BTN_SECONDARY}>
                      Enter join code
                    </Link>
                  </>
                )}
              </div>
            </div>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="published-courses" direction="vertical">
                {(provided) => (
                  <div 
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-6"
                  >
                    {publishedCourses.map((course, index) => (
                      <Draggable key={course._id} draggableId={course._id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`${ITEM_CARD} group cursor-pointer overflow-visible shadow-sm transition-all sm:ml-4 lg:rounded-xl lg:shadow-lg lg:hover:-translate-y-0.5 lg:hover:shadow-xl ${
                              snapshot.isDragging ? 'opacity-75 shadow-2xl' : ''
                            }`}
                  onClick={() => handleCardClick(course._id)}
                  data-course-card
                >
                  {/* Top section - Dynamic color */}
                  <div 
                    className="relative h-24 sm:h-32 lg:h-48"
                    style={{ backgroundColor: getCourseColor(course._id) }}
                  >
                    {/* Drag Handle - Bottom Left (visible on hover) */}
                    <div 
                      {...provided.dragHandleProps}
                      className="absolute bottom-3 left-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm p-1.5 rounded-md shadow-md">
                        <GripVertical className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                      </div>
                    </div>
                    {/* Grade Display - Top Left */}
                    {renderCourseGradeBadge(course._id)}
                    {/* Drag Handle - Top Left (only when not showing grades) */}
                    {!showGrades && (
                      <div 
                        {...provided.dragHandleProps}
                        className="absolute top-3 left-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm p-1.5 rounded-md shadow-md">
                          <GripVertical className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        </div>
                      </div>
                    )}
                    <div className="absolute right-2 top-2 lg:right-3 lg:top-3">
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenColorPicker(openColorPicker === course._id ? null : course._id);
                            setOpenIconPicker(null);
                          }}
                          className="rounded-md p-1 transition-colors hover:bg-white/20"
                        >
                          <MoreVertical className="h-4 w-4 text-white lg:h-5 lg:w-5" />
                        </button>
                        
                        {/* Color picker dropdown */}
                        {openColorPicker === course._id && (
                          <div 
                            className="absolute right-0 top-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 z-50 min-w-48" 
                            ref={(el) => { colorPickerRefs.current[course._id] = el; }}
                          >
                            <div className="flex items-center gap-2 mb-3">
                              <Palette className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Choose Color</span>
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
                              className="flex items-center gap-2 w-full text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded"
                            >
                              <Settings className="h-4 w-4" />
                              <span>Display Icons</span>
                            </button>
                          </div>
                        )}

                        {/* Icon picker dropdown */}
                        {openIconPicker === course._id && (
                          <div 
                            className="absolute right-0 top-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 z-50 min-w-48" 
                            ref={(el) => { iconPickerRefs.current[course._id] = el; }}
                          >
                            <div className="flex items-center gap-2 mb-3">
                              <Settings className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Display Icons (Max 3)</span>
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
                                        ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' 
                                        : isDisabled 
                                          ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed' 
                                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                    }`}
                                    disabled={isDisabled}
                                  >
                                    <IconComponent className="h-4 w-4" />
                                    <span className="text-sm">{iconConfig.name}</span>
                                    {isSelected && (
                                      <span className="ml-auto text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
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
                              className="flex items-center gap-2 w-full text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded"
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
                  <div className="p-3 lg:p-6">
                    <div className="mb-1.5 lg:mb-2">
                      <h2
                        className="mb-0.5 line-clamp-2 text-[13px] font-semibold lg:mb-1 lg:text-lg"
                        style={{ color: getCourseColor(course._id) }}
                      >
                        {course.catalog?.courseCode || course.title}
                      </h2>
                      <p className="line-clamp-1 text-[10px] text-gray-500 dark:text-gray-400 sm:text-[11px] lg:text-sm">
                        Instructor: {course.instructor.firstName} {course.instructor.lastName}
                      </p>
                    </div>

                    <div className="mt-2 flex items-center justify-between lg:mt-4">
                      {getCourseIcons(course._id).map((iconId) => renderActionIcon(iconId, course._id))}
                      {Array.from({ length: 3 - getCourseIcons(course._id).length }).map((_, index) => (
                        <div key={index} className="h-7 w-7 lg:h-9 lg:w-9" />
                      ))}
                    </div>
                  </div>
                </div>
                      )}
                    </Draggable>
              ))}
                    {provided.placeholder}
            </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </div>
        {/* Unpublished Courses Section (hide for students) */}
        {isTeacherOrAdmin && (
          <div>
            <h2 className={`${SECTION_TITLE} mb-3 sm:mb-6`}>Unpublished Courses ({unpublishedCourses.length})</h2>
            {unpublishedCourses.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 sm:p-12">
                <div className="text-center">
                  <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                    <Folder className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    No Unpublished Courses
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm sm:text-base">
                    All your courses are published and visible to students.
                  </p>
                  <Link
                    to="/courses/create"
                    className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm sm:text-base"
                  >
                    Create New Course
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {unpublishedCourses.map((course) => (
                  <div 
                    key={course._id} 
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 dark:border-gray-700"
                    onClick={() => handleCardClick(course._id)}
                  >
                    {/* Top section - Dynamic color */}
                    <div 
                      className="h-32 sm:h-48 relative bg-gradient-to-br"
                      style={{ 
                        background: `linear-gradient(135deg, ${getCourseColor(course._id)} 0%, ${getCourseColor(course._id)}dd 100%)`
                      }}
                    >
                      {renderCourseGradeBadge(course._id)}
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
                              className="absolute right-0 top-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 z-50 min-w-48" 
                              ref={(el) => { colorPickerRefs.current[course._id] = el; }}
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
                                    className="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
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
                                className="flex items-center gap-2 w-full text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded"
                              >
                                <Settings className="h-4 w-4" />
                                <span>Display Icons</span>
                              </button>
                            </div>
                          )}

                          {/* Icon picker dropdown */}
                          {openIconPicker === course._id && (
                            <div 
                              className="absolute right-0 top-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 z-50 min-w-48" 
                              ref={(el) => { iconPickerRefs.current[course._id] = el; }}
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
                                className="flex items-center gap-2 w-full text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded"
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
                    <div className="p-4 sm:p-6">
                      <div className="mb-2 sm:mb-3">
                        <h2 
                          className="font-bold text-base sm:text-lg mb-1 sm:mb-2 line-clamp-2"
                          style={{ color: getCourseColor(course._id) }}
                        >
                          {course.catalog?.courseCode || course.title}
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm flex items-center line-clamp-1">
                          <span className="w-2 h-2 bg-gray-400 rounded-full mr-2 flex-shrink-0"></span>
                          Instructor: {course.instructor.firstName} {course.instructor.lastName}
                        </p>
                      </div>
                      
                      {/* Action icons */}
                      <div className="flex justify-between items-center mt-3 sm:mt-4">
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
          {/* To-Do Panel: Hidden on mobile, visible on desktop, hidden when notification center is open */}
          <aside className={`hidden lg:block w-full lg:w-96 flex-shrink-0 order-first lg:order-last ${showNotificationCenter ? 'invisible' : 'visible'}`}>
            <ToDoPanel />
          </aside>
        </div>
        </PullToRefresh>
      </SwipeableContainer>

      <ScanCourseQrModal
        isOpen={showCourseQrScanner}
        onClose={() => setShowCourseQrScanner(false)}
        onScanSuccess={handleCourseQrScanSuccess}
      />

    {/* Navigation Customization Modal */}
    <NavCustomizationModal
      isOpen={showNavCustomization}
      onClose={() => {
        setShowNavCustomization(false);
        setShowBurgerMenu(false);
      }}
      onSave={(items) => {
        setCurrentNavItems(items);
      }}
      currentItems={currentNavItems}
    />

  </div>
  );
} 
