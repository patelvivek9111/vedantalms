import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useCourse } from '../contexts/CourseContext';
import { useAuth } from '../context/AuthContext';
import { useCourseData } from '../hooks/useCourseData';
import { useGradebookData } from '../hooks/useGradebookData';
import { useStudentSearch } from '../hooks/useStudentSearch';
import { useEnrollment } from '../hooks/useEnrollment';
import { useStudentData } from '../hooks/useStudentData';
import { useGradeManagement } from '../hooks/useGradeManagement';
import { useGradeScaleManagement } from '../hooks/useGradeScaleManagement';
import { useGroupManagement } from '../hooks/useGroupManagement';
import { ModuleProvider } from '../contexts/ModuleContext';
import ModuleList from './ModuleList';
import api from '../services/api';
import logger from '../utils/logger';
import { API_URL } from '../config';
import axios from 'axios';
import { 
  ClipboardList, 
  BookOpen, 
  FileText, 
  PenTool, 
  MessageSquare, 
  Megaphone, 
  Users, 
  BarChart3, 
  UserPlus,
  BookOpenCheck,
  CheckSquare,
  ClipboardCheck,
  GraduationCap,
} from 'lucide-react';
import CourseDiscussions from './CourseDiscussions';
import GroupManagement from './groups/GroupManagement';
import StudentGroupView from './groups/StudentGroupView';
import CoursePages from './CoursePages';
import Announcements from '../pages/Announcements';
import AnnouncementForm from './announcements/AnnouncementForm';
import Gradebook from './gradebook/Gradebook';
import StudentGrades from './gradebook/StudentGrades';
import CourseSyllabus from './course/CourseSyllabus';
import CourseStudents from './course/CourseStudents';
import CourseOverview from './course/CourseOverview';
import CourseAssignments from './course/CourseAssignments';
import CourseQuizzes from './course/CourseQuizzes';
import CourseSidebar from './course/CourseSidebar';
import MobileNavigation from './course/MobileNavigation';
import { createAnnouncement } from '../services/announcementService';
import OverviewConfigModal from './OverviewConfigModal';
import SidebarConfigModal from './SidebarConfigModal';
import Attendance from './Attendance';
import PollList from './polls/PollList';
import QuizWaveDashboard from './quizwave/QuizWaveDashboard';
import StudentQuizWaveView from './quizwave/StudentQuizWaveView';
import { ChangeUserModal } from './ChangeUserModal';
import { exportGradebookCSV } from '../utils/gradebookExport';

// Navigation items for the left pane
const navigationItems = [
  { id: 'overview', label: 'Overview', icon: ClipboardList },
  { id: 'syllabus', label: 'Syllabus', icon: GraduationCap },
  { id: 'modules', label: 'Modules', icon: BookOpen },
  { id: 'pages', label: 'Pages', icon: FileText },
  { id: 'assignments', label: 'Assignments', icon: PenTool },
  { id: 'quizzes', label: 'Quizzes', icon: ClipboardCheck },
  { id: 'discussions', label: 'Discussions', icon: MessageSquare },
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
  { id: 'polls', label: 'Polls', icon: BarChart3 },
  { id: 'groups', label: 'Groups', icon: Users },
  { id: 'attendance', label: 'Attendance', icon: CheckSquare },
  { id: 'grades', label: 'Grades', icon: BarChart3, roles: ['student'] },
  { id: 'gradebook', label: 'Gradebook', icon: BookOpenCheck, roles: ['teacher', 'admin'] },
  { id: 'students', label: 'People', icon: UserPlus },
];

// StudentCard component moved to CourseStudents.tsx

const CourseDetail: React.FC = () => {
  const { id, section } = useParams<{ id: string; section?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { getCourse, getCourses } = useCourse();
  const { user, logout } = useAuth();
  const [activeSection, setActiveSection] = useState(section || 'overview');
  const getCourseRef = useRef(getCourse);
  
  // Use custom hooks for data fetching
  const { course, modules, loading: courseLoading, error: courseError, refetch: refetchCourse, setCourse } = useCourseData({
    courseId: id,
    getCourseRef,
    refetchTrigger: activeSection === 'assignments' ? activeSection : undefined,
  });
  
  const isInstructor = user?.role === 'teacher' && course?.instructor?._id === user?._id;
  const isAdmin = user?.role === 'admin';
  
  // Use gradebook data hook (for instructor/admin view)
  const instructorGradebookData = useGradebookData({
    course,
    modules,
    activeSection,
    isInstructor,
    isAdmin,
    gradebookRefresh: 0,
  });
  
  // Use student data hook (for student view)
  const {
    studentSubmissions,
    studentGradebookData,
    setStudentGradebookData,
    studentTotalGrade,
    studentLetterGrade,
    studentDiscussions,
    studentGroupAssignments,
  } = useStudentData({
    course,
    modules,
    user,
    activeSection,
    isInstructor,
    isAdmin,
  });
  
  // Use instructor gradebook data when in instructor/admin view, otherwise use student data
  const gradebookData = (isInstructor || isAdmin) ? instructorGradebookData : studentGradebookData;
  
  const [gradebookRefresh, setGradebookRefresh] = useState(0);
  
  // Use grade management hook
  const gradeManagement = useGradeManagement({
    courseId: id,
    gradebookData,
    isInstructor,
    isAdmin,
    setGradebookRefresh,
    setStudentGradebookData,
  });

  // Use grade scale management hook
  const gradeScaleManagement = useGradeScaleManagement({
    course,
    setCourse,
  });

  // Use group management hook
  const groupManagement = useGroupManagement({
    course,
    setCourse,
  });
  
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  // Add state for publishing course
  const [publishingCourse, setPublishingCourse] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [discussions, setDiscussions] = useState<any[]>([]);
  const [discussionsLoading, setDiscussionsLoading] = useState(true);
  const [groupAssignments, setGroupAssignments] = useState<any[]>([]);
  // State for expanded students in mobile gradebook view
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [showOverviewConfigModal, setShowOverviewConfigModal] = useState(false);
  const [showSidebarConfigModal, setShowSidebarConfigModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showChangeUserModal, setShowChangeUserModal] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  // Check if it's actually a mobile phone (not tablet/iPad)
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const screenWidth = window.screen.width;
      const viewportWidth = window.innerWidth;
      
      // Detect tablets/iPads more accurately
      // Modern iPads report as Macintosh, so check for touch support and screen size
      const isTablet = /ipad|tablet|playbook|silk|(android(?!.*mobile))|kindle/i.test(userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) || // iPad on iOS 13+
        (screenWidth >= 768 && screenWidth <= 1024 && 'ontouchstart' in window);
      
      // Detect phones - must be mobile user agent AND not a tablet AND small screen
      const isPhone = (
        /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent) ||
        (/mobile/i.test(userAgent) && !isTablet)
      ) && !isTablet;
      
      // Only show mobile view on actual phones with small screens (< 768px)
      // Tablets/iPads should show desktop view even if screen is smaller
      // Also check viewport to handle desktop with dev tools
      const shouldShowMobile = isPhone && screenWidth < 768 && viewportWidth < 768;
      
      setIsMobileDevice(shouldShowMobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const initialSection = section || 'overview';

  // Sync section with URL on mount and when location changes
  useEffect(() => {
    const urlSection = (location.pathname.split('/')[3] || 'overview');
    setActiveSection(urlSection);
    setIsMobileMenuOpen(false); // Close mobile menu on route change
  }, [location.pathname]);

  // Prevent body scroll when mobile sidebar is open, but allow sidebar to scroll
  useEffect(() => {
    if (isMobileMenuOpen) {
      const originalOverflow = window.getComputedStyle(document.body).overflow;
      const originalPosition = window.getComputedStyle(document.body).position;
      const scrollY = window.scrollY;
      
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      
      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isMobileMenuOpen]);

  // 1. Move fetchCourseAndModulesWithAssignments outside of useEffect so it can be called from multiple places
  const fetchCourseAndModulesWithAssignments = useCallback(async () => {
    if (id && id !== 'undefined' && id !== 'null' && id.trim() !== '') {
      try {
        logger.debug('Fetching course with ID', { id });
        const courseData = await getCourseRef.current(id);
        logger.debug('Course data received', { courseId: id });
        setCourse(courseData);

        // Fetch modules for the course
        const token = localStorage.getItem('token');
        const modulesResponse = await api.get(`/modules/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (modulesResponse.data.success) {
          const modulesRaw = modulesResponse.data.data;
          // For each module, fetch its assignments
          const modulesWithAssignments = await Promise.all(
            modulesRaw.map(async (module: any) => {
              try {
                const assignmentsRes = await axios.get(`${API_URL}/api/assignments/module/${module._id}`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                return { ...module, assignments: assignmentsRes.data };
              } catch (err) {
                return { ...module, assignments: [] };
              }
            })
          );
          // Modules are now managed by useCourseData hook
        }
      } catch (err) {
        logger.error('Error fetching course or modules', err instanceof Error ? err : new Error(String(err)));
        // Log more details for debugging
        if (err instanceof Error) {
          logger.error('Error details', { message: err.message, stack: err.stack });
        }
      }
    }
  }, [id, getCourseRef]);

  // 2. On mount, fetch course and modules
  useEffect(() => {
    fetchCourseAndModulesWithAssignments();
  }, [fetchCourseAndModulesWithAssignments]);


  // 3. When switching to assignments tab, re-fetch modules and assignments
  useEffect(() => {
    if (activeSection === 'assignments') {
      fetchCourseAndModulesWithAssignments();
    }
  }, [activeSection, fetchCourseAndModulesWithAssignments]);

  useEffect(() => {
    if (!course?._id) return;
    const fetchDiscussions = async () => {
      setDiscussionsLoading(true);
      try {
        const token = localStorage.getItem('token');
        let threadsRes;
        try {
          threadsRes = await axios.get(`${API_URL}/api/threads/course/${course._id}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
        } catch (e) {
          threadsRes = await axios.get(`${API_URL}/api/threads?course=${course._id}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
        }
        let gradedDiscussions = (threadsRes.data.data || []).filter((thread: any) => thread.isGraded);

        // Fetch module-level graded discussions and merge
        if (modules.length > 0) {
          const moduleDiscussionsArrays = await Promise.all(
            modules.map(async (module: any) => {
              try {
                const res = await axios.get(`${API_URL}/api/threads/module/${module._id}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
                return (res.data.data || res.data || []).filter((thread: any) => thread.isGraded);
              } catch (err) {
                return [];
              }
            })
          );
          const moduleDiscussions = moduleDiscussionsArrays.flat();
          // Merge and deduplicate by _id
          const allDiscussionsMap = new Map();
          [...gradedDiscussions, ...moduleDiscussions].forEach(d => allDiscussionsMap.set(d._id, d));
          gradedDiscussions = Array.from(allDiscussionsMap.values());
        }
        setDiscussions(gradedDiscussions);
      } catch (err) {
        setDiscussions([]);
      } finally {
        setDiscussionsLoading(false);
      }
    };
    fetchDiscussions();
  }, [course?._id, modules]);

  // Get custom sidebar configuration or use default
  // Merge existing config with default navigationItems to ensure all items are included
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
  
  const sidebarConfig = {
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
  const filteredNavigationItems = customNavigationItems.filter((item: any) => {
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

  // Update ref when getCourse changes
  useEffect(() => {
    getCourseRef.current = getCourse;
  }, [getCourse]);

  // Course and modules fetching is now handled by useCourseData hook

  // Fetch group assignments when course changes
  useEffect(() => {
    if (!course?._id) return;
    const fetchGroupAssignments = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/api/assignments/course/${course._id}/group-assignments`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
        setGroupAssignments(res.data);
      } catch (err) {
        setGroupAssignments([]);
      }
    };
    fetchGroupAssignments();
  }, [course?._id]);

  // Student search is now handled by useStudentSearch hook

  // Enrollment handlers are now provided by useEnrollment hook (see lines 233-252)



  // Gradebook data fetching is now handled by useGradebookData hook

  // DISABLED: Add effect to fetch submission IDs when gradebook data changes
  // NOTE: This effect is now DISABLED because we build submissionMap in fetchGradebookData
  // to avoid duplicate updates that cause grade recalculation. The submission map is now
  // built together with grades in a single update cycle.
  /*
  useEffect(() => {
    const fetchSubmissionIds = async () => {
      if (activeSection !== 'gradebook') return;
      if (!gradebookData.assignments?.length || !gradebookData.students?.length) return;
      if (!isInstructor && !isAdmin) return;
      if (Object.keys(submissionMap).length > 0) return;
      
      const newSubmissionMap: { [key: string]: string } = {};
      const token = localStorage.getItem('token');
      
      try {
        for (const assignment of gradebookData.assignments) {
          if (!assignment._id) continue;
          
          if (assignment.isDiscussion) {
            if (assignment.replies && Array.isArray(assignment.replies)) {
              assignment.replies.forEach((reply: any) => {
                const studentId = reply.author?._id || reply.author;
                if (studentId) {
                  const key = `${String(studentId)}_${String(assignment._id)}`;
                  newSubmissionMap[key] = reply._id;
                }
              });
            }
            continue;
          }
          
          try {
            const res = await axios.get(`${API_URL}/api/submissions/assignment/${assignment._id}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            res.data.forEach((submission: any) => {
              if (assignment.isGroupAssignment && submission.group && submission.group.members) {
                submission.group.members.forEach((member: any) => {
                  const memberId = member._id || member;
                  const key = `${String(memberId)}_${String(assignment._id)}`;
                  newSubmissionMap[key] = submission._id;
                });
              } else {
                const studentId = submission.student?._id || submission.student;
                if (studentId) {
                  const key = `${String(studentId)}_${String(assignment._id)}`;
                  newSubmissionMap[key] = submission._id;
                }
              }
            });
          } catch (err: any) {
            if (err.response && err.response.status === 404) {
              continue;
            }
          }
        }
        
        setSubmissionMap(newSubmissionMap);
      } catch (err) {
      }
    };
    
    fetchSubmissionIds();
  }, [activeSection, gradebookData.assignments, gradebookData.students, submissionMap, isInstructor, isAdmin, course?._id]);
  */

  // Student data fetching is now handled by useStudentData hook
  // Grade management, grade scale, and group management are now handled by hooks

  useEffect(() => {
    const handleDiscussionGradeUpdated = () => {
      setGradebookRefresh(prev => prev + 1);
    };
    window.addEventListener('discussionGradeUpdated', handleDiscussionGradeUpdated);
    return () => {
      window.removeEventListener('discussionGradeUpdated', handleDiscussionGradeUpdated);
    };
  }, [activeSection]);

  // Handler to toggle course publish status
  const handleToggleCoursePublish = async () => {
    if (!course?._id) return;
    setPublishingCourse(true);
    setPublishError(null);
    try {
      const res = await api.patch(`/courses/${course._id}/publish`);
      setCourse((prev: any) => ({ ...prev, published: res.data.published }));
      await getCourses(); // Refresh global course list
    } catch (err: any) {
      // Optionally show error
      let message = 'Error toggling course publish.';
      if (err.response && err.response.data && err.response.data.message) {
        message = err.response.data.message;
      } else if (err.message) {
        message = err.message;
      }
      setPublishError(message);
    } finally {
      setPublishingCourse(false);
    }
  };

  const handleOverviewConfigUpdated = (updatedCourse: any) => {
    setCourse(updatedCourse);
  };

  const handleSidebarConfigUpdated = (updatedCourse: any) => {
    setCourse(updatedCourse);
  };


  if (courseLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (courseError) {
    return (
      <div className="text-red-500 text-center p-4">
        {typeof courseError === 'string' ? courseError : 'An error occurred. Please try again.'}
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center text-gray-500 py-8">
        Course not found
      </div>
    );
  }

  // Render the appropriate content based on active section
  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <CourseOverview
            course={course}
            modules={modules}
            courseId={id || ''}
            isInstructor={isInstructor}
            isAdmin={isAdmin}
            publishingCourse={publishingCourse}
            publishError={publishError}
            handleToggleCoursePublish={handleToggleCoursePublish}
            setShowOverviewConfigModal={setShowOverviewConfigModal}
            setShowSidebarConfigModal={setShowSidebarConfigModal}
            setActiveSection={setActiveSection}
          />
        );

      case 'syllabus':
        return (
          <CourseSyllabus
            course={course}
            setCourse={setCourse}
            isInstructor={isInstructor}
            isAdmin={isAdmin}
          />
        );

      case 'modules':
        return (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Course Modules</h2>
              <ModuleProvider>
                <ModuleList courseId={course._id} />
              </ModuleProvider>
            </div>
          </div>
        );

      case 'pages':
        return (
          <CoursePages
            courseId={course?._id || ''}
            modules={modules}
            isInstructor={isInstructor}
            isAdmin={isAdmin}
          />
        );

      case 'assignments':
        return (
          <CourseAssignments
            course={course}
            modules={modules}
            groupAssignments={groupAssignments}
            discussions={discussions}
            discussionsLoading={discussionsLoading}
            user={user}
            studentSubmissions={studentSubmissions}
            submissionMap={gradebookData.submissionMap}
            isInstructor={isInstructor}
            isAdmin={isAdmin}
          />
        );

      case 'quizzes':
        return (
          <CourseQuizzes
            course={course}
            modules={modules}
            groupAssignments={groupAssignments}
            discussionsLoading={discussionsLoading}
            user={user}
            studentSubmissions={studentSubmissions}
            submissionMap={gradebookData.submissionMap}
            isInstructor={isInstructor}
            isAdmin={isAdmin}
          />
        );

      case 'discussions':
        return (
          <CourseDiscussions
            courseId={course?._id || ''}
            courseGroups={course?.groups || []}
          />
        );

      case 'polls':
        return (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
              <PollList courseId={course?._id || ''} />
            </div>
          </div>
        );

      case 'quizwave':
        // Wait for course to load
        if (courseLoading || !course || !course._id) {
          return (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading course...</p>
            </div>
          );
        }
        // Show different views for teachers and students
        if (isInstructor || isAdmin) {
          return <QuizWaveDashboard courseId={course._id.toString()} />;
        } else {
          // Student view
          return <StudentQuizWaveView courseId={course._id.toString()} />;
        }

      case 'grades':
        if (isInstructor || isAdmin) {
          // Instructors/Admins see the full gradebook, not individual student grades here
          return <div className="text-center py-8 text-gray-500">Instructors/Admins use the 'Gradebook' tab.</div>;
        }

        // Student view:
        if (!user) {
          return <div className="text-center py-8 text-gray-500">User not found.</div>;
        }

        const studentId = user?._id;
        if (!studentId) {
          return <div className="text-center py-8 text-gray-500">User ID not found.</div>;
        }

        return (
          <StudentGrades
            course={course}
            studentId={studentId}
            modules={modules}
            studentGroupAssignments={studentGroupAssignments}
            studentDiscussions={studentDiscussions}
            gradebookData={gradebookData}
            submissionMap={gradebookData.submissionMap}
            studentSubmissions={studentSubmissions}
            backendTotalGrade={studentTotalGrade}
            backendLetterGrade={studentLetterGrade}
          />
        );

      case 'gradebook':
        if (!isInstructor && !isAdmin) {
          return <div className="text-center py-8 text-gray-500">Access denied</div>;
        }
        return (
          <Gradebook
            courseId={id || ''}
            course={course}
            gradebookData={gradebookData}
            submissionMap={gradebookData.submissionMap}
            studentSubmissions={studentSubmissions}
            isInstructor={isInstructor}
            isAdmin={isAdmin}
            expandedStudents={expandedStudents}
            setExpandedStudents={setExpandedStudents}
            editingGrade={gradeManagement.editingGrade}
            setEditingGrade={gradeManagement.setEditingGrade}
            editingValue={gradeManagement.editingValue}
            setEditingValue={gradeManagement.setEditingValue}
            savingGrade={gradeManagement.savingGrade}
            gradeError={gradeManagement.gradeError}
            setGradeError={gradeManagement.setGradeError}
            handleGradeCellClick={gradeManagement.handleGradeCellClick}
            handleGradeUpdate={gradeManagement.handleGradeUpdate}
            exportGradebookCSV={() => exportGradebookCSV(course, gradebookData)}
            handleOpenGradeScaleModal={gradeScaleManagement.handleOpenGradeScaleModal}
            handleOpenGroupModal={groupManagement.handleOpenGroupModal}
            setShowGroupModal={groupManagement.setShowGroupModal}
            showGroupModal={groupManagement.showGroupModal}
            editGroups={groupManagement.editGroups}
            handleGroupChange={groupManagement.handleGroupChange}
            handleRemoveGroupRow={groupManagement.handleRemoveGroupRow}
            handleAddGroupRow={groupManagement.handleAddGroupRow}
            handleResetToDefaults={groupManagement.handleResetToDefaults}
            handleSaveGroups={groupManagement.handleSaveGroups}
            savingGroups={groupManagement.savingGroups}
            groupError={groupManagement.groupError}
            setShowGradeScaleModal={gradeScaleManagement.setShowGradeScaleModal}
            showGradeScaleModal={gradeScaleManagement.showGradeScaleModal}
            editGradeScale={gradeScaleManagement.editGradeScale}
            handleGradeScaleChange={gradeScaleManagement.handleGradeScaleChange}
            handleRemoveGradeScaleRow={gradeScaleManagement.handleRemoveGradeScaleRow}
            handleSaveGradeScale={gradeScaleManagement.handleSaveGradeScale}
            savingGradeScale={gradeScaleManagement.savingGradeScale}
            gradeScaleError={gradeScaleManagement.gradeScaleError}
            setEditGradeScale={gradeScaleManagement.setEditGradeScale}
            setGradeScaleError={gradeScaleManagement.setGradeScaleError}
          />
        );

      case 'students':
        return (
          <CourseStudents
            course={course}
            setCourse={setCourse}
            courseId={id || ''}
            isInstructor={isInstructor}
            isAdmin={isAdmin}
            getCourseRef={getCourseRef}
          />
        );

      case 'groups':
        if (isInstructor || isAdmin) {
          return <GroupManagement courseId={course?._id || ''} />;
        } else {
          return <StudentGroupView courseId={course?._id || ''} userId={user?._id || ''} />;
        }

      case 'attendance':
        return <Attendance />;

      case 'announcements':
        return (
          <div className="relative">
            {showAnnouncementModal ? (
              <div className="max-w-4xl mx-auto py-8">
                <h2 className="text-2xl font-bold mb-4">New Announcement</h2>
                <AnnouncementForm
                  onSubmit={async (formData) => {
                    await createAnnouncement(course._id, formData);
                    setShowAnnouncementModal(false);
                    setActiveSection('announcements'); // Refresh
                  }}
                  loading={false}
                  onCancel={() => setShowAnnouncementModal(false)}
                />
              </div>
            ) : (
              <>
                <Announcements courseId={course._id} />
                {(isInstructor || isAdmin) && (
                  <button
                    className="fixed bottom-20 right-4 sm:bottom-8 sm:right-8 z-[110] bg-blue-600 text-white px-4 py-2.5 sm:px-6 sm:py-3 rounded-full shadow-lg hover:bg-blue-700 text-sm sm:text-lg font-bold flex items-center gap-1.5 sm:gap-2"
                    onClick={() => setShowAnnouncementModal(true)}
                  >
                    <span className="text-lg sm:text-xl">+</span>
                    <span className="hidden sm:inline">Announcement</span>
                  </button>
                )}
              </>
            )}
          </div>
        );

      case 'sidebar':
        return (
          <SidebarConfigModal
            isOpen={showSidebarConfigModal}
            onClose={() => setShowSidebarConfigModal(false)}
            courseId={course?._id || ''}
            currentConfig={course?.sidebarConfig || {}}
            onConfigUpdated={handleSidebarConfigUpdated}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <MobileNavigation
        courseTitle={course?.title}
        user={user}
        isMobileDevice={isMobileDevice}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        setShowChangeUserModal={setShowChangeUserModal}
        logout={logout}
      />

      <div className={`flex ${isMobileDevice ? 'flex-col pt-16' : 'flex-row pt-0'} w-full max-w-7xl mx-auto`}>
        {/* Mobile Overlay */}
        {isMobileMenuOpen && isMobileDevice && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-[90]"
            onClick={() => setIsMobileMenuOpen(false)}
            style={{ touchAction: 'none', pointerEvents: 'auto' }}
          />
        )}

        <CourseSidebar
          navigationItems={filteredNavigationItems}
          activeSection={activeSection}
          courseId={id}
          isMobileDevice={isMobileDevice}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
        />

      {/* Main Content Area */}
      <div className={`flex-1 overflow-auto w-full ${isMobileMenuOpen ? 'lg:overflow-auto overflow-hidden' : ''}`}>
        {activeSection === 'quizwave' ? (
          renderContent()
        ) : (
          <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20 lg:pb-6">
            {renderContent()}
          </div>
        )}
      </div>

      {/* Overview Configuration Modal */}
      <OverviewConfigModal
        isOpen={showOverviewConfigModal}
        onClose={() => setShowOverviewConfigModal(false)}
        courseId={course?._id || ''}
        currentConfig={course?.overviewConfig || { showLatestAnnouncements: false, numberOfAnnouncements: 3 }}
        onConfigUpdated={handleOverviewConfigUpdated}
      />
      {/* Sidebar Configuration Modal */}
      <SidebarConfigModal
        isOpen={showSidebarConfigModal}
        onClose={() => setShowSidebarConfigModal(false)}
        courseId={course?._id || ''}
        currentConfig={course?.sidebarConfig || {}}
        onConfigUpdated={handleSidebarConfigUpdated}
      />

      {/* Change User Modal */}
      <ChangeUserModal
        isOpen={showChangeUserModal}
        onClose={() => setShowChangeUserModal(false)}
      />
      </div>
    </div>
  );
};

export default CourseDetail; 