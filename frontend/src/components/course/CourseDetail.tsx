import React, { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import { getMemoryAuthToken, authFetchInit } from '../../utils/authToken';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useCourse } from '../../contexts/CourseContext';
import { useAuth } from '../../contexts/AuthContext';
import CreateModuleForm from '../modules/CreateModuleForm';
import api from '../../services/api';
import { API_URL } from '../../config';
import { getImageUrl } from '../../services/api';
import axios from 'axios';
import { normalizeMongoIdRef } from '../../utils/mongoId';
import { useCourseShellMobile } from '../../hooks/useCourseShellMobile';
import { toast } from 'react-toastify';
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
import WhatIfScores from '../common/WhatIfScores';
import StudentGradeSidebar from '../common/StudentGradeSidebar';
import CourseDiscussions from '../course/CourseDiscussions';
import GroupManagement from '../groups/GroupManagement';
import StudentGroupView from '../groups/StudentGroupView';
import { exportGradebookXlsx } from '../../utils/gradebookExport';
import { enqueueGradebookExport, openJobDownload } from '../../services/jobsApi';
import { useAsyncJob } from '../../hooks/useAsyncJob';
import AsyncJobBanner from '../common/AsyncJobBanner';
import { navigationItems } from '../../constants/courseNavigation';
import CoursePages from '../course/CoursePages';
import AssignmentList from '../assignments/AssignmentList';
import OverviewConfigModal from '../modals/OverviewConfigModal';
import SidebarConfigModal from '../modals/SidebarConfigModal';
import LatestAnnouncements from '../announcements/LatestAnnouncements';
import Attendance from '../common/Attendance';
import RichTextEditor from '../common/RichTextEditor';
import StudentQuizWaveView from '../quizwave/StudentQuizWaveView';
import { ChangeUserModal } from '../modals/ChangeUserModal';
import EnrollmentRequestsHandler from '../enrollment/EnrollmentRequestsHandler';
import StudentCard from '../students/StudentCard';
import OverviewSection from '../course/OverviewSection';
import SyllabusSection from '../course/SyllabusSection';
import CourseStoragePanel from '../course/CourseStoragePanel';
import StudentsManagement from '../students/StudentsManagement';
import MobileNavigation from '../course/MobileNavigation';
import CourseSidebar from '../course/CourseSidebar';
import StudentGradesView from '../grades/StudentGradesView';
import GradebookView from '../grades/GradebookView';
import AssignmentsSection from '../course/AssignmentsSection';
import QuizzesSection from '../course/QuizzesSection';
import ModulesSection from '../course/ModulesSection';
import PollsSection from '../course/PollsSection';
import CourseMeetingsSection from '../course/CourseMeetingsSection';
import { useStudentSubmissions } from '../../hooks/useStudentSubmissions';
import { useGradeManagement } from '../../hooks/useGradeManagement';
import { useSubmissionIds } from '../../hooks/useSubmissionIds';
import { usePaginatedGradebook } from '../../hooks/usePaginatedGradebook';
import { useDiscussions } from '../../hooks/useDiscussions';
import { useStudentGradeData } from '../../hooks/useStudentGradeData';
import { useGradeScaleManagement } from '../../hooks/useGradeScaleManagement';
import { useAssignmentGroupsManagement } from '../../hooks/useAssignmentGroupsManagement';
import { useGradingPolicy } from '../../hooks/useGradingPolicy';
import { useSyllabusManagement } from '../../hooks/useSyllabusManagement';
import { useSidebarConfig } from '../../hooks/useSidebarConfig';
import Breadcrumb from '../common/Breadcrumb';
import { useCourseSectionSwipe } from '../../hooks/useCourseSectionSwipe';

import QuizWaveDashboard from '../quizwave/QuizWaveDashboard';
import { lazyWithRetry } from '../../utils/lazyWithRetry';

const Announcements = lazyWithRetry(() => import('../../pages/Announcements'));



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
  const [instructorGradebookLoading, setInstructorGradebookLoading] = useState(false);
  const isAdmin = user?.role === 'admin';
  const isInstitutionalDiscussionStaff = ['registrar', 'department_admin'].includes(user?.role || '');
  const isInstructor =
    user?.role === 'teacher' &&
    normalizeMongoIdRef(course?.instructor) !== '' &&
    normalizeMongoIdRef(course?.instructor) === normalizeMongoIdRef(user?._id);
  const isCourseTeachingAssistant =
    user?.role === 'teaching_assistant' &&
    Array.isArray(course?.teachingAssistants) &&
    course.teachingAssistants.some((ta: unknown) => normalizeMongoIdRef(ta) === normalizeMongoIdRef(user?._id));
  const discussionStaffAccess = Boolean(
    isAdmin || isInstitutionalDiscussionStaff || isInstructor || isCourseTeachingAssistant
  );
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
  const [studentGradeSummaryReady, setStudentGradeSummaryReady] = useState(false);
  // Add state for graded discussions for student view
  const [studentDiscussions, setStudentDiscussions] = useState<any[]>([]);
  // Add state for group assignments for student view
  const [studentGroupAssignments, setStudentGroupAssignments] = useState<any[]>([]);
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
  const isMobileDevice = useCourseShellMobile();
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);

  const initialSection = section || 'overview';

  // Sync section with URL on mount and when location changes
  useEffect(() => {
    const urlSection = (location.pathname.split('/')[3] || 'overview');
    setActiveSection(urlSection);
    setIsMobileMenuOpen(false); // Close mobile menu on route change
  }, [location.pathname]);

  // Role-specific nav: students must not open Gradebook; teachers/admins must not open Grades (direct URL).
  useEffect(() => {
    if (!id || !user?.role) return;
    const urlSection = location.pathname.split('/')[3] || 'overview';
    const r = user.role;
    if (urlSection === 'grades' && r !== 'student') {
      navigate(`/courses/${id}/gradebook`, { replace: true });
      return;
    }
    if (urlSection === 'gradebook' && r === 'student') {
      navigate(`/courses/${id}/grades`, { replace: true });
    }
  }, [id, user?.role, location.pathname, navigate]);

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
        const token = getMemoryAuthToken();
        const modulesResponse = await api.get(`/modules/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (modulesResponse.data.success) {
          const modulesRaw = modulesResponse.data.data;
          let byModuleId: Record<string, any[]> = {};
          try {
            const bulk = await api.get(`/assignments/course/${id}/module-assignments`);
            byModuleId = bulk.data?.byModuleId || {};
          } catch {
            byModuleId = {};
          }
          const modulesWithAssignments = modulesRaw.map((module: any) => ({
            ...module,
            assignments: byModuleId[module._id] || byModuleId[String(module._id)] || []
          }));
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

  // Avoid showing another course's gradebook counts/columns while the new course loads
  useEffect(() => {
    setGradebookData({ students: [], assignments: [], grades: {} });
  }, [id]);

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

  const gradingPolicyManagement = useGradingPolicy(id);

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
      syllabusManagement.loadSyllabusFilesFromCourse(course.catalog?.syllabusFiles || []);
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
    setDiscussions,
    setDiscussionsLoading,
  });

  // Get sidebar configuration
  const { filteredNavigationItems, sidebarConfig } = useSidebarConfig({
    course,
    user,
  });

  // Swipe navigation between course sections (mobile only)
  const sectionSwipeHandlers = useCourseSectionSwipe({
    sections: filteredNavigationItems,
    activeSection,
    courseId: id || '',
    enabled: isMobileDevice && !isMobileMenuOpen // Only enable when mobile menu is closed
  });

  // Update ref when getCourse changes
  useEffect(() => {
    getCourseRef.current = getCourse;
  }, [getCourse]);

  // Fetch group assignments when course changes
  useEffect(() => {
    if (!course?._id) return;
    const fetchGroupAssignments = async () => {
      try {
        const token = getMemoryAuthToken();
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
      const updatedCourse = await getCourseRef.current(id);
      setCourse(updatedCourse);
    } catch (err) {
      }
  };

  const handleApproveEnrollment = async (studentId: string) => {
    if (!id) return;
    try {
      const token = getMemoryAuthToken();
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
      
      toast.success('The student has been added to the course.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Could not approve enrollment.');
    }
  };

  const handleDenyEnrollment = async (studentId: string) => {
    if (!id) return;
    try {
      const token = getMemoryAuthToken();
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
      
      toast.success('The enrollment request was declined.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Could not decline the request.');
    }
  };



  const handleToggleAssignmentPublish = async (assignment: any) => {
    setAssignmentPublishing(assignment._id);
    try {
      const token = getMemoryAuthToken();
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

  useSubmissionIds({
    gradebookData,
    isInstructor,
    isAdmin,
    course,
    user,
    studentDiscussions,
    setSubmissionMap,
    setGradebookData,
    setStudentSubmissions,
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
    setStudentGradeSummaryReady,
  });

  // Fetch paginated gradebook data for instructors/admins.
  usePaginatedGradebook({
    activeSection,
    isInstructor,
    isAdmin,
    courseId: id,
    refresh: gradebookRefresh,
    setGradebookData,
    setSubmissionMap,
    setGradebookLoading: setInstructorGradebookLoading,
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

  const exportJob = useAsyncJob();
  const [exportDownloadUrl, setExportDownloadUrl] = useState<string | null>(null);

  const handleExportGradebookCSV = async () => {
    if (!id) return;
    try {
      const res = await enqueueGradebookExport(id);
      if (res.success && res.data.jobId) {
        if (res.data.downloadUrl) {
          setExportDownloadUrl(res.data.downloadUrl);
          openJobDownload(res.data.downloadUrl);
          toast.success('Gradebook export ready.');
        } else {
          await exportJob.startFromEnqueue(res.data.jobId, {
            onComplete: (job) => {
              if (job.status === 'completed') {
                toast.success('Gradebook export completed.');
              }
            },
          });
        }
        return;
      }
    } catch {
      /* fall through to client export */
    }
    try {
      await exportGradebookXlsx(
        gradebookData,
        course,
        submissionMap,
        studentSubmissions,
        gradingPolicyManagement.resolved
      );
      toast.success('Gradebook exported (this device).');
    } catch {
      toast.error('Failed to export gradebook.');
    }
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
          <>
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
            syllabusAttachmentFiles={syllabusManagement.syllabusAttachmentFiles}
            setSyllabusAttachmentFiles={syllabusManagement.setSyllabusAttachmentFiles}
            courseArchived={course?.operationalStatus === 'archived'}
            handleSaveSyllabus={syllabusManagement.handleSaveSyllabus}
            onRemoveSyllabusFile={syllabusManagement.onRemoveSyllabusFile}
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
          {(isInstructor || isAdmin) && course?._id ? (
            <div className="mt-6">
              <CourseStoragePanel courseId={course._id} />
            </div>
          ) : null}
          </>
        );

      case 'modules':
        return (
          <ModulesSection courseId={course._id} prefetchedModules={modules} />
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
            canManageCourseDiscussions={discussionStaffAccess}
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
              <div className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-900 dark:border-purple-800 dark:bg-purple-900/20 dark:text-purple-100">
                QuizWave is live practice and does not sync to the gradebook.
              </div>
              <QuizWaveDashboard courseId={course._id.toString()} />
            </div>
          );
        } else {
          // Student view
          return (
            <div className="space-y-6">
              <div className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-900 dark:border-purple-800 dark:bg-purple-900/20 dark:text-purple-100">
                Live practice only — QuizWave scores do not affect your course grade.
              </div>
              <StudentQuizWaveView courseId={course._id.toString()} />
            </div>
          );
        }

      case 'grades':
        if (user?.role !== 'student') {
          return null;
        }
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
            studentGradeSummaryReady={studentGradeSummaryReady}
          />
        );

      case 'gradebook':
        if (user?.role === 'student') {
          return null;
        }
        return (
          <>
            <AsyncJobBanner
              job={exportJob.job}
              polling={exportJob.polling}
              error={exportJob.error}
              label="Gradebook export"
              onDismiss={exportJob.reset}
              onDownload={
                exportDownloadUrl
                  ? () => openJobDownload(exportDownloadUrl)
                  : undefined
              }
            />
          <GradebookView
            course={course}
            courseId={id || ''}
            isGradebookLoading={instructorGradebookLoading}
            gradebookData={gradebookData}
            submissionMap={submissionMap}
            studentSubmissions={studentSubmissions}
            isInstructor={isInstructor}
            isAdmin={isAdmin}
            userRole={user?.role}
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
            resolvedGradingPolicy={gradingPolicyManagement.resolved}
            gradingPolicyModal={{
              show: gradingPolicyManagement.showModal,
              setShow: gradingPolicyManagement.setShowModal,
              editPolicy: gradingPolicyManagement.editPolicy,
              setEditPolicy: gradingPolicyManagement.setEditPolicy,
              onSave: gradingPolicyManagement.handleSave,
              onPreview: gradingPolicyManagement.runPreview,
              saving: gradingPolicyManagement.saving,
              loading: gradingPolicyManagement.loading,
              error: gradingPolicyManagement.error,
              preview: gradingPolicyManagement.preview,
              dirty: gradingPolicyManagement.dirty,
            }}
            handleGradeInputKeyDown={handleGradeInputKeyDown}
          />
          </>
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

      case 'meetings':
        return <CourseMeetingsSection courseId={course?._id || ''} canManage={Boolean(isInstructor || isAdmin)} />;

      case 'attendance':
        return <Attendance />;

      case 'announcements':
        return (
          <Suspense fallback={<div className="text-sm text-gray-500 dark:text-gray-400">Loading announcements...</div>}>
            <Announcements courseId={course._id || id || ''} />
          </Suspense>
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

      {/* Breadcrumb + divider: sticky on desktop so it stays visible while the page scrolls */}
      <div className="sticky top-0 z-[35] mx-auto hidden w-full max-w-7xl bg-gray-50 px-4 pt-2 dark:bg-gray-900 lg:block">
        <div className="flex flex-col">
          <div className="pb-3">
            <Breadcrumb
              className="mb-0"
              items={[
                { label: 'Dashboard', path: '/dashboard' },
                { label: 'Courses', path: '/courses' },
                {
                  label: course?.catalog?.courseCode || course?.title || 'Course',
                  path: `/courses/${id}`
                },
                ...(section && section !== 'overview' ? [{
                  label: section.charAt(0).toUpperCase() + section.slice(1),
                  path: `/courses/${id}/${section}`
                }] : [])
              ]}
            />
          </div>
          <div className="h-px w-full shrink-0 bg-gray-200 dark:bg-gray-700" aria-hidden />
          <div className="h-3 shrink-0" aria-hidden />
        </div>
      </div>

      <div className={`flex ${isMobileDevice ? 'flex-col pt-20' : 'flex-row pt-0'} w-full max-w-7xl mx-auto`}>

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
      <div 
        className={`flex-1 w-full overflow-visible lg:overflow-auto ${isMobileMenuOpen ? 'lg:overflow-auto overflow-hidden' : ''}`}
        {...(sectionSwipeHandlers.enabled ? {
          onTouchStart: sectionSwipeHandlers.onTouchStart,
          onTouchMove: sectionSwipeHandlers.onTouchMove,
          onTouchEnd: sectionSwipeHandlers.onTouchEnd
        } : {})}
      >
        <div className="container mx-auto px-4 pb-6 pt-2 lg:pt-3 mobile-bottom-nav-clearance lg:!pb-6">
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

export { AssignmentCard } from '../assignments/AssignmentCard';
export default CourseDetail; 