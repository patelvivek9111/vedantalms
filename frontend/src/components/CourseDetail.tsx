import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useCourse } from '../contexts/CourseContext';
import { useAuth } from '../context/AuthContext';
import CreateModuleForm from './CreateModuleForm';
import api from '../services/api';
import { API_URL } from '../config';
import { getImageUrl } from '../services/api';
import axios from 'axios';
import { 
  Lock, 
  Unlock, 
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
  Settings,
  CheckSquare,
  Vote,
  Layout,
  ClipboardCheck,
  GraduationCap,
  Gamepad2,
  Menu,
  X,
  ChevronDown,
  Folder,
  HelpCircle,
  User as UserIcon,
  LogOut
} from 'lucide-react';
import WhatIfScores from './WhatIfScores';
import StudentGradeSidebar from './StudentGradeSidebar';
import CourseDiscussions from './CourseDiscussions';
import GroupManagement from './groups/GroupManagement';
import StudentGroupView from './groups/StudentGroupView';
import { getWeightedGradeForStudent, getLetterGrade, calculateFinalGradeWithWeightedGroups } from '../utils/gradeUtils';
import { exportGradebookCSV } from '../utils/gradebookExport';
import { navigationItems } from '../constants/courseNavigation';
import CoursePages from './CoursePages';
import Announcements from '../pages/Announcements';
import AnnouncementForm from './announcements/AnnouncementForm';
import { createAnnouncement } from '../services/announcementService';
import AssignmentList from './assignments/AssignmentList';
import OverviewConfigModal from './OverviewConfigModal';
import SidebarConfigModal from './SidebarConfigModal';
import LatestAnnouncements from './LatestAnnouncements';
import Attendance from './Attendance';
import RichTextEditor from './RichTextEditor';
import QuizWaveDashboard from './quizwave/QuizWaveDashboard';
import StudentQuizWaveView from './quizwave/StudentQuizWaveView';
import { ChangeUserModal } from './ChangeUserModal';
import EnrollmentRequestsHandler from './enrollment/EnrollmentRequestsHandler';
import StudentCard from './students/StudentCard';
import OverviewSection from './course/OverviewSection';
import SyllabusSection from './course/SyllabusSection';
import StudentsManagement from './students/StudentsManagement';
import MobileNavigation from './course/MobileNavigation';
import CourseSidebar from './course/CourseSidebar';
import StudentGradesView from './grades/StudentGradesView';
import GradebookView from './grades/GradebookView';
import AssignmentsSection from './course/AssignmentsSection';
import QuizzesSection from './course/QuizzesSection';
import ModulesSection from './course/ModulesSection';
import PollsSection from './course/PollsSection';
import { useGradebookData } from '../hooks/useGradebookData';
import { useStudentSubmissions } from '../hooks/useStudentSubmissions';
import { useGradeManagement } from '../hooks/useGradeManagement';
import { useSubmissionIds } from '../hooks/useSubmissionIds';
import { useInstructorGradebookData } from '../hooks/useInstructorGradebookData';
import { useDiscussions } from '../hooks/useDiscussions';
import { useStudentGradeData } from '../hooks/useStudentGradeData';
import { useGradeScaleManagement } from '../hooks/useGradeScaleManagement';
import { useAssignmentGroupsManagement } from '../hooks/useAssignmentGroupsManagement';
import { useSyllabusManagement } from '../hooks/useSyllabusManagement';
import { useSidebarConfig } from '../hooks/useSidebarConfig';



const CourseDetail: React.FC = () => {
  const { id, section } = useParams<{ id: string; section?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { getCourse, getCourses, loading, error, enrollStudent, unenrollStudent, courses } = useCourse();
  const { user, logout } = useAuth();
  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState(section || 'overview');
  const getCourseRef = useRef(getCourse);
  const [assignmentPublishing, setAssignmentPublishing] = useState<string | null>(null);
  const [assignmentPublished, setAssignmentPublished] = useState<{ [id: string]: boolean }>({});
  const [gradebookData, setGradebookData] = useState<any>({ students: [], assignments: [], grades: {} });
  const isInstructor = user?.role === 'teacher' && course?.instructor?._id === user?._id;
  const isAdmin = user?.role === 'admin';
  const [editingGrade, setEditingGrade] = useState<{studentId: string, assignmentId: string} | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [savingGrade, setSavingGrade] = useState<{studentId: string, assignmentId: string} | null>(null);
  const [gradeError, setGradeError] = useState<string>('');
  const [submissionMap, setSubmissionMap] = useState<{[key: string]: string}>({});
  const [studentSubmissions, setStudentSubmissions] = useState<any[]>([]);
  const [gradebookRefresh, setGradebookRefresh] = useState(0);
  // Add state for backend-calculated student grade
  const [studentTotalGrade, setStudentTotalGrade] = useState<number | null>(null);
  const [studentLetterGrade, setStudentLetterGrade] = useState<string | null>(null);
  // Add state for graded discussions for student view
  const [studentDiscussions, setStudentDiscussions] = useState<any[]>([]);
  // Add state for group assignments for student view
  const [studentGroupAssignments, setStudentGroupAssignments] = useState<any[]>([]);
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
  const [showBurgerMenu, setShowBurgerMenu] = useState(false);
  const [showChangeUserModal, setShowChangeUserModal] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);

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
        const courseData = await getCourseRef.current(id);
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
          setModules(modulesWithAssignments);
        }
      } catch (err) {
        // Log more details for debugging
        if (err instanceof Error) {
          }
      }
    }
  }, [id, getCourseRef]);

  // 2. On mount, fetch course and modules
  useEffect(() => {
    fetchCourseAndModulesWithAssignments();
  }, [fetchCourseAndModulesWithAssignments]);

  // Grade scale management
  const gradeScaleManagement = useGradeScaleManagement({
    course,
    setCourse,
    setGroupError: () => {}, // Will be set by assignment groups hook
  });

  // Assignment groups management
  const assignmentGroupsManagement = useAssignmentGroupsManagement({
    course,
    setCourse,
    setGradeScaleError: gradeScaleManagement.setGradeScaleError,
  });

  // Update grade scale management to use assignment groups' setGroupError
  const gradeScaleManagementWithGroupError = {
    ...gradeScaleManagement,
    setGroupError: assignmentGroupsManagement.setGroupError,
  };

  // Syllabus management
  const syllabusManagement = useSyllabusManagement({
    course,
    setCourse,
  });

  // Load syllabus data when course is loaded
  useEffect(() => {
    if (course) {
      syllabusManagement.setSyllabusFields({
        courseTitle: course.title || '',
        courseCode: course.catalog?.courseCode || '',
        instructorName: `${course.instructor?.firstName || ''} ${course.instructor?.lastName || ''}`.trim(),
        instructorEmail: course.instructor?.email || '',
        officeHours: course.catalog?.officeHours || 'By Appointment'
      });
      syllabusManagement.setSyllabusContent(course.catalog?.syllabusContent || '');
      syllabusManagement.setUploadedSyllabusFiles(course.catalog?.syllabusFiles || []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course]);

  // 3. When switching to assignments tab, re-fetch modules and assignments
  useEffect(() => {
    if (activeSection === 'assignments') {
      fetchCourseAndModulesWithAssignments();
    }
  }, [activeSection, fetchCourseAndModulesWithAssignments]);

  // Fetch graded discussions
  useDiscussions({
    course,
    modules,
    setDiscussions,
    setDiscussionsLoading,
  });

  // Get sidebar configuration
  const { filteredNavigationItems, sidebarConfig } = useSidebarConfig({
    course,
    user,
  });

  // Update ref when getCourse changes
  useEffect(() => {
    getCourseRef.current = getCourse;
  }, [getCourse]);

  useEffect(() => {
    const fetchCourseAndModulesWithAssignments = async () => {
      if (id) {
        try {
          const courseData = await getCourseRef.current(id);
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
            setModules(modulesWithAssignments);
          }
        } catch (err) {
          }
      }
    };
    fetchCourseAndModulesWithAssignments();
  }, [id]);

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

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    try {
      const response = await api.get(`/users/search?name=${encodeURIComponent(query)}&email=${encodeURIComponent(query)}`);
      
      // Ensure data is an array and extract the users from the response
      const users = Array.isArray(response.data.data) ? response.data.data : [];
      
      // Filter out already enrolled students
      const enrolledStudentIds = course?.students?.map((student: any) => student._id) || [];
      const filteredResults = users.filter((user: any) => 
        user.role === 'student' && !enrolledStudentIds.includes(user._id)
      );
      
      setSearchResults(filteredResults);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Failed to search users');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Add debounce function to prevent too many API calls
  const debounce = (func: Function, wait: number) => {
    let timeout: any;
    return (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  // Create debounced search function
  const debouncedSearch = React.useCallback(
    debounce((query: string) => handleSearch(query), 500),
    [course?.students]
  );

  // Update search handler to use debounced search
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.trim()) {
      debouncedSearch(query);
    } else {
      setSearchResults([]);
    }
  };

  const handleEnroll = async (studentId: string) => {
    if (!id) return;
    try {
      await enrollStudent(id, studentId);
      // Clear search results after successful enrollment
      setSearchResults([]);
      setSearchQuery('');
      // Refresh course data to show updated student list
      if (id) {
        const updatedCourse = await getCourseRef.current(id);
        setCourse(updatedCourse);
      }
    } catch (err) {
      }
  };

  const handleUnenroll = async (studentId: string) => {
    if (!id) return;
    try {
      await unenrollStudent(id, studentId);
    } catch (err) {
      }
  };

  const handleApproveEnrollment = async (studentId: string) => {
    if (!id) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/courses/${id}/enrollment/${studentId}/approve`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Refresh course data to show updated student list and enrollment requests
      if (id) {
        const updatedCourse = await getCourseRef.current(id);
        setCourse(updatedCourse);
      }
      
      alert('Enrollment approved successfully!');
    } catch (err: any) {
      alert('Failed to approve enrollment: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDenyEnrollment = async (studentId: string) => {
    if (!id) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/courses/${id}/enrollment/${studentId}/deny`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Refresh course data to show updated enrollment requests
      if (id) {
        const updatedCourse = await getCourseRef.current(id);
        setCourse(updatedCourse);
      }
      
      alert('Enrollment denied successfully!');
    } catch (err: any) {
      alert('Failed to deny enrollment: ' + (err.response?.data?.message || err.message));
    }
  };



  const handleToggleAssignmentPublish = async (assignment: any) => {
    setAssignmentPublishing(assignment._id);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.patch(
        `${API_URL}/api/assignments/${assignment._id}/publish`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAssignmentPublished(prev => ({ ...prev, [assignment._id]: res.data.published }));
    } catch (err) {
    } finally {
      setAssignmentPublishing(null);
    }
  };

  // Fetch gradebook data when gradebook section is active
  useGradebookData({
    activeSection,
    isInstructor,
    isAdmin,
    course,
    modules,
    user,
    gradebookRefresh,
    setGradebookData,
  });

  // Fetch submission IDs when gradebook data changes
  useSubmissionIds({
    gradebookData,
    isInstructor,
    isAdmin,
    course,
    user,
    studentDiscussions,
    setSubmissionMap,
    setGradebookData,
  });

  // Fetch student submissions and grades for the student as soon as course/modules are loaded (not just in grades tab)
  useStudentSubmissions({
    course,
    user,
    modules,
    setStudentSubmissions,
    setSubmissionMap,
    setGradebookData,
  });

  // Update grades when student discussions are loaded
  useEffect(() => {
    if (activeSection !== 'grades' || isInstructor || isAdmin || !user || !studentDiscussions.length) return;
    
    setGradebookData((prev: any) => {
      const updatedGrades = { ...prev.grades };
      if (!updatedGrades[String(user._id)]) updatedGrades[String(user._id)] = {};
      
      // Add discussion grades
      for (const discussion of studentDiscussions) {
        if (typeof discussion.grade === 'number') {
          updatedGrades[String(user._id)][String(discussion._id)] = discussion.grade;
        }
      }
      
      return { ...prev, grades: updatedGrades };
    });
  }, [activeSection, isInstructor, isAdmin, user, studentDiscussions]);

  // Fetch student grade data (total grade, letter grade, discussions, group assignments)
  useStudentGradeData({
    activeSection,
    isInstructor,
    isAdmin,
    course,
    user,
    setStudentTotalGrade,
    setStudentLetterGrade,
    setStudentDiscussions,
    setStudentGroupAssignments,
  });

  // Fetch gradebook data for instructors/admins
  useInstructorGradebookData({
    activeSection,
    isInstructor,
    course,
    modules,
    setGradebookData,
  });


  // Grade management handlers
  const { handleGradeUpdate, handleGradeCellClick, handleGradeInputKeyDown } = useGradeManagement({
    courseId: id,
    submissionMap,
    gradebookData,
    isInstructor,
    isAdmin,
    editingValue,
    setEditingGrade,
    setEditingValue,
    setGradeError,
    setSavingGrade,
    setGradebookData,
    setSubmissionMap,
  });

  const handleExportGradebookCSV = () => {
    exportGradebookCSV(gradebookData, course, submissionMap);
  };


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
        {typeof error === 'string' ? error : 'An error occurred. Please try again.'}
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
          <OverviewSection
            course={course}
            modules={modules}
            isInstructor={isInstructor}
            isAdmin={isAdmin}
            publishError={publishError}
            publishingCourse={publishingCourse}
            handleToggleCoursePublish={handleToggleCoursePublish}
            courseId={id || ''}
            setShowOverviewConfigModal={setShowOverviewConfigModal}
            setShowSidebarConfigModal={setShowSidebarConfigModal}
            setActiveSection={setActiveSection}
          />
        );

      case 'syllabus':
        return (
          <SyllabusSection
            course={course}
            isInstructor={isInstructor}
            isAdmin={isAdmin}
            editingSyllabus={syllabusManagement.editingSyllabus}
            setEditingSyllabus={syllabusManagement.setEditingSyllabus}
            syllabusFields={syllabusManagement.syllabusFields}
            handleSyllabusFieldChange={syllabusManagement.handleSyllabusFieldChange}
            handleSaveSyllabusFields={syllabusManagement.handleSaveSyllabusFields}
            savingSyllabus={syllabusManagement.savingSyllabus}
            syllabusMode={syllabusManagement.syllabusMode}
            setSyllabusMode={syllabusManagement.setSyllabusMode}
            syllabusContent={syllabusManagement.syllabusContent}
            setSyllabusContent={syllabusManagement.setSyllabusContent}
            uploadedSyllabusFiles={syllabusManagement.uploadedSyllabusFiles}
            setUploadedSyllabusFiles={syllabusManagement.setUploadedSyllabusFiles}
            uploadingFiles={syllabusManagement.uploadingFiles}
            handleSyllabusFileUpload={syllabusManagement.handleSyllabusFileUpload}
            handleRemoveSyllabusFile={syllabusManagement.handleRemoveSyllabusFile}
            handleSaveSyllabus={syllabusManagement.handleSaveSyllabus}
            onCancelEdit={() => {
              syllabusManagement.setEditingSyllabus(false);
              // Reset to original values
              if (course) {
                syllabusManagement.setSyllabusFields({
                  courseTitle: course.title || '',
                  courseCode: course.catalog?.courseCode || '',
                  instructorName: `${course.instructor?.firstName || ''} ${course.instructor?.lastName || ''}`.trim(),
                  instructorEmail: course.instructor?.email || '',
                  officeHours: course.catalog?.officeHours || 'By Appointment'
                });
              }
            }}
          />
        );

      case 'modules':
        return (
          <ModulesSection courseId={course._id} />
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
          <AssignmentsSection
            modules={modules}
            groupAssignments={groupAssignments}
            discussions={discussions}
            isInstructor={isInstructor}
            isAdmin={isAdmin}
            discussionsLoading={discussionsLoading}
            user={user}
            studentSubmissions={studentSubmissions}
            submissionMap={submissionMap}
            course={course}
          />
        );

      case 'quizzes':
        return (
          <QuizzesSection
            modules={modules}
            groupAssignments={groupAssignments}
            isInstructor={isInstructor}
            isAdmin={isAdmin}
            discussionsLoading={discussionsLoading}
            user={user}
            studentSubmissions={studentSubmissions}
            submissionMap={submissionMap}
            course={course}
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
          <PollsSection courseId={course?._id || ''} />
        );

      case 'quizwave':
        // Wait for course to load
        if (loading || !course || !course._id) {
          return (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading course...</p>
            </div>
          );
        }
        // Show different views for teachers and students
        if (isInstructor || isAdmin) {
          return (
            <div className="space-y-6">
              <QuizWaveDashboard courseId={course._id.toString()} />
            </div>
          );
        } else {
          // Student view
          return (
            <div className="space-y-6">
              <StudentQuizWaveView courseId={course._id.toString()} />
            </div>
          );
        }

      case 'grades':
        if (isInstructor || isAdmin) {
          // ... existing instructor view code ...
        }

        // Student view:
        return (
          <StudentGradesView
            course={course}
            modules={modules}
            user={user}
            studentGroupAssignments={studentGroupAssignments}
            studentDiscussions={studentDiscussions}
            gradebookData={gradebookData}
            submissionMap={submissionMap}
            studentSubmissions={studentSubmissions}
            studentTotalGrade={studentTotalGrade}
            studentLetterGrade={studentLetterGrade}
          />
        );

      case 'gradebook':
        if (!isInstructor && !isAdmin) {
          return <div className="text-center py-8 text-gray-500">Access denied</div>;
        }
        return (
          <GradebookView
            course={course}
            courseId={id || ''}
            gradebookData={gradebookData}
            submissionMap={submissionMap}
            studentSubmissions={studentSubmissions}
            isInstructor={isInstructor}
            isAdmin={isAdmin}
            expandedStudents={expandedStudents}
            setExpandedStudents={setExpandedStudents}
            editingGrade={editingGrade}
            setEditingGrade={setEditingGrade}
            editingValue={editingValue}
            setEditingValue={setEditingValue}
            savingGrade={savingGrade}
            handleGradeCellClick={handleGradeCellClick}
            handleGradeUpdate={handleGradeUpdate}
            handleExportGradebookCSV={handleExportGradebookCSV}
            handleOpenGradeScaleModal={gradeScaleManagementWithGroupError.handleOpenGradeScaleModal}
            handleOpenGroupModal={assignmentGroupsManagement.handleOpenGroupModal}
            showGroupModal={assignmentGroupsManagement.showGroupModal}
            editGroups={assignmentGroupsManagement.editGroups}
            handleGroupChange={assignmentGroupsManagement.handleGroupChange}
            handleAddGroupRow={assignmentGroupsManagement.handleAddGroupRow}
            handleRemoveGroupRow={assignmentGroupsManagement.handleRemoveGroupRow}
            handleResetToDefaults={assignmentGroupsManagement.handleResetToDefaults}
            handleSaveGroups={assignmentGroupsManagement.handleSaveGroups}
            savingGroups={assignmentGroupsManagement.savingGroups}
            groupError={assignmentGroupsManagement.groupError}
            setShowGroupModal={assignmentGroupsManagement.setShowGroupModal}
            showGradeScaleModal={gradeScaleManagementWithGroupError.showGradeScaleModal}
            editGradeScale={gradeScaleManagementWithGroupError.editGradeScale}
            handleGradeScaleChange={gradeScaleManagementWithGroupError.handleGradeScaleChange}
            handleRemoveGradeScaleRow={gradeScaleManagementWithGroupError.handleRemoveGradeScaleRow}
            handleSaveGradeScale={gradeScaleManagementWithGroupError.handleSaveGradeScale}
            savingGradeScale={gradeScaleManagementWithGroupError.savingGradeScale}
            gradeScaleError={gradeScaleManagementWithGroupError.gradeScaleError}
            setShowGradeScaleModal={gradeScaleManagementWithGroupError.setShowGradeScaleModal}
            setGradeScaleError={gradeScaleManagementWithGroupError.setGradeScaleError}
            setEditGradeScale={gradeScaleManagementWithGroupError.setEditGradeScale}
          />
        );

      case 'students':
        return (
          <StudentsManagement
            course={course}
            isInstructor={isInstructor}
            isAdmin={isAdmin}
            searchQuery={searchQuery}
            handleSearchChange={handleSearchChange}
            isSearching={isSearching}
            searchResults={searchResults}
            searchError={searchError}
            handleEnroll={handleEnroll}
            handleApproveEnrollment={handleApproveEnrollment}
            handleDenyEnrollment={handleDenyEnrollment}
            handleUnenroll={handleUnenroll}
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
                    className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-50 bg-blue-600 text-white px-4 py-2.5 sm:px-6 sm:py-3 rounded-full shadow-lg hover:bg-blue-700 text-sm sm:text-lg font-bold flex items-center gap-1.5 sm:gap-2"
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
      {/* Mobile Top Navigation */}
      <MobileNavigation
        isMobileDevice={isMobileDevice}
        course={course}
        showCourseDropdown={showCourseDropdown}
        setShowCourseDropdown={setShowCourseDropdown}
        user={user}
        courses={courses}
        courseId={id || ''}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
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

      {/* Modern Sidebar */}
      <CourseSidebar
        isMobileDevice={isMobileDevice}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        filteredNavigationItems={filteredNavigationItems}
        activeSection={activeSection}
        courseId={id || ''}
      />

      {/* Main Content Area */}
      <div className={`flex-1 overflow-auto w-full ${isMobileMenuOpen ? 'lg:overflow-auto overflow-hidden' : ''}`}>
        <div className="container mx-auto px-4 py-6">
          {renderContent()}
        </div>
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

export { AssignmentCard } from './assignments/AssignmentCard';
export default CourseDetail; 