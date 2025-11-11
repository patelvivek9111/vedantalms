import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useCourse } from '../contexts/CourseContext';
import { useAuth } from '../context/AuthContext';
import { ModuleProvider } from '../contexts/ModuleContext';
import ModuleList from './ModuleList';
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
  GraduationCap
} from 'lucide-react';
import WhatIfScores from './WhatIfScores';
import StudentGradeSidebar from './StudentGradeSidebar';
import CourseDiscussions from './CourseDiscussions';
import GroupManagement from './groups/GroupManagement';
import StudentGroupView from './groups/StudentGroupView';
import { getWeightedGradeForStudent, getLetterGrade, calculateFinalGradeWithWeightedGroups } from '../utils/gradeUtils';
import CoursePages from './CoursePages';
import Announcements from '../pages/Announcements';
import AnnouncementForm from './announcements/AnnouncementForm';
import { createAnnouncement } from '../services/announcementService';
import AssignmentList from './assignments/AssignmentList';
import OverviewConfigModal from './OverviewConfigModal';
import SidebarConfigModal from './SidebarConfigModal';
import LatestAnnouncements from './LatestAnnouncements';
import Attendance from './Attendance';
import PollList from './polls/PollList';
import RichTextEditor from './RichTextEditor';

// EnrollmentRequestsHandler component
const EnrollmentRequestsHandler: React.FC<{ courseId: string }> = ({ courseId }) => {
  const [enrollmentRequests, setEnrollmentRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEnrollmentRequests = async () => {
      try {
        const todosRes = await api.get('/todos');
        const enrollmentTodos = todosRes.data.filter((todo: any) => 
          todo.type === 'enrollment_request' && 
          todo.courseId === courseId && 
          todo.action === 'pending'
        );
        setEnrollmentRequests(enrollmentTodos);
      } catch (err) {
        console.error('Error fetching enrollment requests:', err);
      } finally {
        setLoading(false);
      }
    };

    if (courseId) {
      fetchEnrollmentRequests();
    }
  }, [courseId]);

  const handleApproveEnrollment = async (studentId: string) => {
    try {
      await api.post(`/courses/${courseId}/enrollment/${studentId}/approve`);
      setEnrollmentRequests(prev => prev.filter(req => req.studentId !== studentId));
    } catch (err) {
      console.error('Error approving enrollment:', err);
      alert('Failed to approve enrollment');
    }
  };

  const handleDenyEnrollment = async (studentId: string) => {
    try {
      await api.post(`/courses/${courseId}/enrollment/${studentId}/deny`);
      setEnrollmentRequests(prev => prev.filter(req => req.studentId !== studentId));
    } catch (err) {
      console.error('Error denying enrollment:', err);
      alert('Failed to deny enrollment');
    }
  };

  if (loading) {
    return <div className="text-gray-500">Loading enrollment requests...</div>;
  }

  if (enrollmentRequests.length === 0) {
    return <div className="text-gray-500 text-sm italic">No pending enrollment requests</div>;
  }

  return (
    <div className="space-y-3">
      {enrollmentRequests.map((request, idx: number) => (
        <div key={`enrollment-${request._id}-${idx}`} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-orange-200 dark:border-orange-700">
          <div className="flex-1">
            <p className="font-medium text-gray-800 dark:text-gray-200">{request.title}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Requested on {new Date(request.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => handleApproveEnrollment(request.studentId)}
              className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
            >
              Approve
            </button>
            <button
              onClick={() => handleDenyEnrollment(request.studentId)}
              className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
            >
              Deny
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

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

// Add StudentCard component above the main CourseDetail component
const StudentCard = ({ student, isInstructor, isAdmin, handleUnenroll, isInstructorCard }: any) => {
  const [imgError, setImgError] = React.useState(false);
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 flex items-center gap-4">
      {student.profilePicture && !imgError ? (
        <img
          src={student.profilePicture.startsWith('http')
            ? student.profilePicture
            : getImageUrl(student.profilePicture)}
          alt={student.firstName}
          className="w-12 h-12 object-cover rounded-full border"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-xl font-bold text-gray-600 border">
          {student.firstName && student.lastName
            ? `${student.firstName[0]}${student.lastName[0]}`.toUpperCase()
            : ''}
        </div>
      )}
      <div>
        <div className="font-semibold text-lg text-gray-800 dark:text-gray-200">{student.firstName} {student.lastName}</div>
        <div className="text-gray-500 text-sm">{student.email}</div>
      </div>
      {/* Only show Remove button for students, not instructor */}
      {!isInstructorCard && (isInstructor || isAdmin) && handleUnenroll && (
        <button
          className="ml-auto p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          onClick={() => handleUnenroll(student._id)}
          title="Remove student"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  );
};

const CourseDetail: React.FC = () => {
  const { id, section } = useParams<{ id: string; section?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { getCourse, getCourses, loading, error, enrollStudent, unenrollStudent } = useCourse();
  const { user } = useAuth();
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
  const [showGradeScaleModal, setShowGradeScaleModal] = useState(false);
  const [editGradeScale, setEditGradeScale] = useState<any[]>([]);
  const [savingGradeScale, setSavingGradeScale] = useState(false);
  const [gradeScaleError, setGradeScaleError] = useState('');
  const [editingGrade, setEditingGrade] = useState<{studentId: string, assignmentId: string} | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [savingGrade, setSavingGrade] = useState<{studentId: string, assignmentId: string} | null>(null);
  const [gradeError, setGradeError] = useState<string>('');
  const [submissionMap, setSubmissionMap] = useState<{[key: string]: string}>({});
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editGroups, setEditGroups] = useState<any[]>([]);
  const [groupError, setGroupError] = useState('');
  const [savingGroups, setSavingGroups] = useState(false);
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
  // Syllabus state
  const [editingSyllabus, setEditingSyllabus] = useState(false);
  const [syllabusFields, setSyllabusFields] = useState({
    courseTitle: '',
    courseCode: '',
    instructorName: '',
    instructorEmail: '',
    officeHours: 'By Appointment'
  });
  const [savingSyllabus, setSavingSyllabus] = useState(false);
  const [syllabusMode, setSyllabusMode] = useState<'none' | 'upload' | 'editor'>('none');
  const [syllabusContent, setSyllabusContent] = useState('');
  const [syllabusFiles, setSyllabusFiles] = useState<File[]>([]);
  const [uploadedSyllabusFiles, setUploadedSyllabusFiles] = useState<any[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [showOverviewConfigModal, setShowOverviewConfigModal] = useState(false);
  const [showSidebarConfigModal, setShowSidebarConfigModal] = useState(false);

  const initialSection = section || 'overview';

  // Sync section with URL on mount and when location changes
  useEffect(() => {
    const urlSection = (location.pathname.split('/')[3] || 'overview');
    setActiveSection(urlSection);
  }, [location.pathname]);

  // 1. Move fetchCourseAndModulesWithAssignments outside of useEffect so it can be called from multiple places
  const fetchCourseAndModulesWithAssignments = useCallback(async () => {
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
        console.error('Error fetching course or modules:', err);
      }
    }
  }, [id, getCourseRef]);

  // 2. On mount, fetch course and modules
  useEffect(() => {
    fetchCourseAndModulesWithAssignments();
  }, [fetchCourseAndModulesWithAssignments]);

  // Load syllabus data when course is loaded
  useEffect(() => {
    if (course) {
      setSyllabusFields({
        courseTitle: course.title || '',
        courseCode: course.catalog?.courseCode || '',
        instructorName: `${course.instructor?.firstName || ''} ${course.instructor?.lastName || ''}`.trim(),
        instructorEmail: course.instructor?.email || '',
        officeHours: course.catalog?.officeHours || 'By Appointment'
      });
      setSyllabusContent(course.catalog?.syllabusContent || '');
      setUploadedSyllabusFiles(course.catalog?.syllabusFiles || []);
    }
  }, [course]);

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
          console.error('Error fetching course or modules:', err);
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
      console.error('Error enrolling student:', err);
    }
  };

  const handleUnenroll = async (studentId: string) => {
    if (!id) return;
    try {
      await unenrollStudent(id, studentId);
    } catch (err) {
      console.error('Error unenrolling student:', err);
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
      console.error('Error approving enrollment:', err);
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
      console.error('Error denying enrollment:', err);
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
  useEffect(() => {
    const fetchGradebookData = async () => {
      if ((activeSection !== 'gradebook') || (!isInstructor && !isAdmin)) return;
      try {
        const token = localStorage.getItem('token');
        // 1. Get students
        const students = course?.students || [];
        
        // 2. Get all assignments (across all modules)
        const allAssignments = modules.flatMap((module: any) =>
          (module.assignments || []).map((assignment: any) => ({
            ...assignment,
            moduleTitle: module.title
          }))
        );

        // 3. Get all group assignments for the course
        const groupAssignmentsResponse = await axios.get(`${API_URL}/api/assignments/course/${course?._id}/group-assignments`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        let groupAssignments = groupAssignmentsResponse.data.map((assignment: any) => ({
          ...assignment,
          moduleTitle: 'Group Assignments'
        }));

        // Remove group assignments that are also present in regular assignments (same title)
        const normalizeTitle = (t: any) => String(t || '').trim().toLowerCase();
        const regularTitles = new Set((allAssignments || []).map((a: any) => normalizeTitle(a.title)));
        groupAssignments = groupAssignments.filter((ga: any) => !regularTitles.has(normalizeTitle(ga.title)));

        // 4. Get all graded discussions
        const threadsResponse = await axios.get(`${API_URL}/api/threads/course/${course?._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const gradedDiscussions = threadsResponse.data.data
          .filter((thread: any) => thread.isGraded)
          .map((thread: any) => ({
            _id: thread._id,
            title: thread.title,
            totalPoints: thread.totalPoints,
            group: thread.group,
            moduleTitle: 'Discussions',
            isDiscussion: true,
            studentGrades: thread.studentGrades || [],
            dueDate: thread.dueDate,
            replies: thread.replies || [] // <-- add replies
          }));

        // 5. Get all submissions for assignments (both regular and group assignments)
        let grades: { [studentId: string]: { [assignmentId: string]: number | string } } = {};
        const allAssignmentsWithGroups = [...allAssignments, ...groupAssignments];
        
        // Get student's submissions for the course
        const studentSubmissionsResponse = await axios.get(`${API_URL}/api/submissions/student/course/${course?._id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
        
        // Process student's submissions to build grades object
        for (const submission of studentSubmissionsResponse.data) {
          const assignment = allAssignmentsWithGroups.find(a => a._id === submission.assignment);
          if (assignment) {
            if (assignment.isGroupAssignment && submission.group && submission.group.members) {
              // For group assignments, check if student is a member
              const isMember = submission.group.members.some((member: any) => 
                (member._id || member) === user._id
              );
              if (isMember) {
                if (!grades[user._id]) grades[user._id] = {};
                
                // Check for individual member grades first
                if (submission.useIndividualGrades && submission.memberGrades) {
                  const memberGrade = submission.memberGrades.find(
                    (mg: any) => mg.student && (mg.student.toString() === user._id.toString() || mg.student._id?.toString() === user._id.toString())
                  );
                  if (memberGrade && typeof memberGrade.grade === 'number') {
                    grades[user._id][assignment._id] = memberGrade.grade;
                  } else if (typeof submission.grade === 'number') {
                    grades[user._id][assignment._id] = submission.grade;
                  } else {
                    grades[user._id][assignment._id] = '-';
                  }
                } else if (typeof submission.grade === 'number') {
                  // Use group grade for all members
                  grades[user._id][assignment._id] = submission.grade;
                } else {
                  grades[user._id][assignment._id] = '-';
                }
              }
            } else {
              // For regular assignments
              if (!grades[user._id]) grades[user._id] = {};
              grades[user._id][assignment._id] = submission.grade ?? '-';
            }
          }
        }

        // 6. Add discussion grades
        for (const discussion of gradedDiscussions) {
          for (const student of students) {
            if (!grades[student._id]) grades[student._id] = {};
            const studentGradeObj = discussion.studentGrades.find(
              (g: any) => g.student && (g.student._id === student._id || g.student === student._id)
            );
            grades[student._id][discussion._id] =
              typeof studentGradeObj?.grade === 'number' ? studentGradeObj.grade : '-';
          }
        }

        // Deduplicate assignments to avoid duplicate columns in the gradebook
        // 1) First pass: by _id
        const allAssignmentsCombined = [...allAssignments, ...groupAssignments, ...gradedDiscussions];
        const byId = allAssignmentsCombined.filter((assignment, index, self) =>
          index === self.findIndex((a) => a._id === assignment._id)
        );
        // 2) Second pass: collapse items that share the same normalized title and type (covers duplicates from different sources)
        const seenKeys = new Set<string>();
        const uniqueAssignments = byId.filter(a => {
          const type = a.isDiscussion ? 'discussion' : 'assignment';
          const normalizedTitle = String(a.title || '').trim().toLowerCase();
          const key = `${normalizedTitle}|${type}`;
          if (seenKeys.has(key)) return false;
          seenKeys.add(key);
          return true;
        });

        // Sort assignments by creation date (oldest first, newest last)
        // Use createdAt if available, otherwise use dueDate, otherwise use current date as fallback
        uniqueAssignments.sort((a: any, b: any) => {
          const getDate = (item: any) => {
            if (item.createdAt) return new Date(item.createdAt).getTime();
            if (item.dueDate) return new Date(item.dueDate).getTime();
            return 0; // Put items without dates at the end
          };
          
          const dateA = getDate(a);
          const dateB = getDate(b);
          
          // If both have dates, sort oldest first
          if (dateA > 0 && dateB > 0) {
            return dateA - dateB;
          }
          // If only one has a date, prioritize it
          if (dateA > 0 && dateB === 0) return -1;
          if (dateA === 0 && dateB > 0) return 1;
          // If neither has a date, maintain original order
          return 0;
        });

        setGradebookData({ 
          students, 
          assignments: uniqueAssignments, 
          grades 
        });
      } catch (err) {
        setGradebookData({ students: [], assignments: [], grades: {} });
      }
    };
    fetchGradebookData();
  }, [activeSection, isInstructor, isAdmin, course, modules, gradebookRefresh]);

  // Add effect to fetch submission IDs when gradebook data changes
  useEffect(() => {
    const fetchSubmissionIds = async () => {
      if (!gradebookData.assignments?.length || !gradebookData.students?.length) return;
      if (!isInstructor && !isAdmin) return; // Only fetch if user is instructor or admin
      
      const newSubmissionMap: { [key: string]: string } = {};
      const newGrades: { [studentId: string]: { [assignmentId: string]: number | string } } = { [String(user._id)]: {} };
      const token = localStorage.getItem('token');
      
      try {
        // For each assignment, fetch submissions
        for (const assignment of gradebookData.assignments) {
          // Skip if assignment._id is missing
          if (!assignment._id) continue;
          
          if (assignment.isDiscussion) {
            // For discussions, check if students have replies (participation)
            if (assignment.replies && Array.isArray(assignment.replies)) {
              assignment.replies.forEach((reply: any) => {
                const studentId = reply.author?._id || reply.author;
                if (studentId) {
                  const key = `${String(studentId)}_${String(assignment._id)}`;
                  newSubmissionMap[key] = reply._id; // Use reply ID as submission ID
                }
              });
            }
            continue;
          }
          
          try {
            const res = await axios.get(`${API_URL}/api/submissions/assignment/${assignment._id}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            // Map student submissions and grades
            res.data.forEach((submission: any) => {
              if (assignment.isGroupAssignment && submission.group && submission.group.members) {
                // For group assignments, create entries for all group members
                submission.group.members.forEach((member: any) => {
                  const memberId = member._id || member;
                  const key = `${String(user._id)}_${String(assignment._id)}`;
                  newSubmissionMap[key] = submission._id;
                  
                  // Check for individual member grades first
                  if (submission.useIndividualGrades && submission.memberGrades) {
                    const memberGrade = submission.memberGrades.find(
                      (mg: any) => mg.student && (mg.student.toString() === String(memberId) || mg.student._id?.toString() === String(memberId))
                    );
                    if (memberGrade && typeof memberGrade.grade === 'number') {
                      if (!newGrades[String(memberId)]) newGrades[String(memberId)] = {};
                      newGrades[String(memberId)][String(assignment._id)] = memberGrade.grade;
                    } else if (typeof submission.grade === 'number') {
                      if (!newGrades[String(memberId)]) newGrades[String(memberId)] = {};
                      newGrades[String(memberId)][String(assignment._id)] = submission.grade;
                    }
                  } else if (typeof submission.grade === 'number') {
                    // Use group grade for all members
                    if (!newGrades[String(memberId)]) newGrades[String(memberId)] = {};
                    newGrades[String(memberId)][String(assignment._id)] = submission.grade;
                  }
                });
              } else {
                // For regular assignments
                const key = `${String(submission.student._id)}_${String(assignment._id)}`;
                newSubmissionMap[key] = submission._id;
                if (typeof submission.grade === 'number') {
                  if (!newGrades[String(submission.student._id)]) newGrades[String(submission.student._id)] = {};
                  newGrades[String(submission.student._id)][String(assignment._id)] = submission.grade;
                }
              }
            });
          } catch (err: any) {
            if (err.response && err.response.status === 404) {
              // Assignment not found, skip
              continue;
            }
          }
        }
        // Fetch graded discussions and merge their grades
        if (course?._id) {
          const discussionRes = await axios.get(`${API_URL}/api/threads/course/${course._id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const gradedDiscussions = (discussionRes.data.data || []).filter((thread: any) => thread.isGraded);
          for (const discussion of gradedDiscussions) {
            for (const student of gradebookData.students) {
              if (!newGrades[String(student._id)]) newGrades[String(student._id)] = {};
              const studentGradeObj = discussion.studentGrades.find(
                (g: any) => g.student && (g.student._id === student._id || g.student === student._id)
              );
              newGrades[String(student._id)][String(discussion._id)] =
                typeof studentGradeObj?.grade === 'number' ? studentGradeObj.grade : '-';
            }
          }
        }
        setSubmissionMap(newSubmissionMap);
        
        // Merge all grades (both regular assignments and discussions)
        const allGrades = { ...newGrades };
        for (const discussion of studentDiscussions) {
          if (typeof discussion.grade === 'number') {
            if (!allGrades[String(user._id)]) allGrades[String(user._id)] = {};
            allGrades[String(user._id)][String(discussion._id)] = discussion.grade;
          }
        }
        
        setGradebookData((prev: any) => ({ 
          ...prev, 
          grades: { ...prev.grades, ...allGrades }
        }));
      } catch (err) {
      }
    };
    
    fetchSubmissionIds();
  }, [gradebookData.assignments, gradebookData.students, isInstructor, isAdmin, course?._id]);

  // Fetch student submissions and grades for the student as soon as course/modules are loaded (not just in grades tab)
  useEffect(() => {
    const studentId = user?._id;
    if (!course?._id || !studentId || user?.role !== 'student') return;
    const fetchStudentSubmissions = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/api/submissions/student/course/${course._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // Build submissionMap and grades
        const newSubmissionMap: { [key: string]: string } = {};
        const newGrades: { [studentId: string]: { [assignmentId: string]: number | string } } = { [String(studentId)]: {} };
        setStudentSubmissions(res.data); // Save full submissions for use in table
        res.data.forEach((submission: any) => {
          if (submission.assignment && submission._id) {
            // For group assignments, treat as submitted for all group members
            if (submission.assignment.isGroupAssignment && submission.group && submission.group.members) {
              if (submission.group.members.some((m: any) => m.toString() === String(studentId) || m._id?.toString() === String(studentId))) {
                newSubmissionMap[`${String(studentId)}_${String(submission.assignment._id)}`] = submission._id;
                // Check for individual member grades first
                if (submission.useIndividualGrades && submission.memberGrades) {
                  const memberGrade = submission.memberGrades.find(
                    (mg: any) => mg.student && (mg.student.toString() === String(studentId) || mg.student._id?.toString() === String(studentId))
                  );
                  if (memberGrade && typeof memberGrade.grade === 'number') {
                    newGrades[String(studentId)][String(submission.assignment._id)] = memberGrade.grade;
                  } else if (typeof submission.grade === 'number') {
                    newGrades[String(studentId)][String(submission.assignment._id)] = submission.grade;
                  }
                } else if (typeof submission.grade === 'number') {
                  // Use group grade for all members
                  newGrades[String(studentId)][String(submission.assignment._id)] = submission.grade;
                }
              }
            } else if (submission.student && (submission.student.toString() === String(studentId) || submission.student._id?.toString() === String(studentId))) {
              newSubmissionMap[`${String(studentId)}_${String(submission.assignment._id)}`] = submission._id;
              if (typeof submission.grade === 'number') {
                newGrades[String(studentId)][String(submission.assignment._id)] = submission.grade;
              }
            }
          }
        });
        setSubmissionMap(newSubmissionMap);
        setGradebookData((prev: any) => ({ ...prev, grades: newGrades }));
      } catch (err) {
        setSubmissionMap({});
        setGradebookData((prev: any) => ({ ...prev, grades: {} }));
        setStudentSubmissions([]);
      }
    };
    fetchStudentSubmissions();
  }, [course?._id, user, modules]);

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

  // Fetch backend-calculated student grade when grades section is active
  useEffect(() => {
    if (activeSection !== 'grades' || isInstructor || isAdmin || !course?._id) return;
    const fetchStudentGrade = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/api/grades/student/course/${course._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStudentTotalGrade(res.data.totalPercent);
        setStudentLetterGrade(res.data.letterGrade);
      } catch (err) {
        setStudentTotalGrade(null);
        setStudentLetterGrade(null);
      }
    };
    fetchStudentGrade();
  }, [activeSection, isInstructor, isAdmin, course?._id]);

  // Fetch graded discussions for the course for student view
  useEffect(() => {
    if (activeSection !== 'grades' || isInstructor || isAdmin || !course?._id || !user) return;
    const fetchStudentDiscussions = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/api/threads/course/${course._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const gradedDiscussions = (res.data.data || [])
          .filter((thread: any) => thread.isGraded)
          .map((thread: any) => {
            const userId = user?._id;
            let studentGradeObj: { grade?: number; feedback?: string } | null = null;
            let hasSubmitted = false;

            // Check if student has replied to the thread
            if (Array.isArray(thread.replies)) {
              hasSubmitted = thread.replies.some((reply: any) => 
                reply.author && (reply.author._id === userId || reply.author === userId)
              );
            }

            if (Array.isArray(thread.studentGrades)) {
              studentGradeObj = thread.studentGrades.find(
                (g: any) => g.student && (g.student._id === userId || g.student === userId)
              );
            }

            return {
              ...thread,
              isDiscussion: true,
              grade: typeof studentGradeObj?.grade === 'number' ? studentGradeObj.grade : null,
              feedback: typeof studentGradeObj?.feedback === 'string' ? studentGradeObj.feedback : '',
              hasSubmitted: hasSubmitted,
              replies: thread.replies || []
            };
          });
        setStudentDiscussions(gradedDiscussions);
      } catch (err) {
        setStudentDiscussions([]);
      }
    };
    fetchStudentDiscussions();
  }, [activeSection, isInstructor, isAdmin, course?._id, user]);

  // Fetch group assignments for the course for student view
  useEffect(() => {
    if (activeSection !== 'grades' || isInstructor || isAdmin || !course?._id || !user) return;
    const fetchStudentGroupAssignments = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/api/assignments/course/${course._id}/group-assignments`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStudentGroupAssignments(res.data);
      } catch (err) {
        setStudentGroupAssignments([]);
      }
    };
    fetchStudentGroupAssignments();
  }, [activeSection, isInstructor, isAdmin, course?._id, user]);

  // Fetch gradebook data for instructors/admins
  useEffect(() => {
    const fetchInstructorGradebookData = async () => {
      if (activeSection !== 'gradebook' || !isInstructor) return;
      try {
        const token = localStorage.getItem('token');
        // 1. Get all students
        const students = course?.students || [];
        
        // 2. Get all assignments (across all modules)
        const allAssignments = modules.flatMap((module: any) =>
          (module.assignments || []).map((assignment: any) => ({
            ...assignment,
            moduleTitle: module.title
          }))
        );

        // 3. Get all group assignments for the course
        const groupAssignmentsResponse = await axios.get(`${API_URL}/api/assignments/course/${course?._id}/group-assignments`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const groupAssignments = groupAssignmentsResponse.data.map((assignment: any) => ({
          ...assignment,
          moduleTitle: 'Group Assignments'
        }));

        // 4. Get all graded discussions
        const threadsResponse = await axios.get(`${API_URL}/api/threads/course/${course?._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const gradedDiscussions = threadsResponse.data.data
          .filter((thread: any) => thread.isGraded)
          .map((thread: any) => ({
            _id: thread._id,
            title: thread.title,
            totalPoints: thread.totalPoints,
            group: thread.group,
            moduleTitle: 'Discussions',
            isDiscussion: true,
            studentGrades: thread.studentGrades || [],
            dueDate: thread.dueDate,
            replies: thread.replies || [] // <-- add replies
          }));

        // 5. Get all submissions for assignments (both regular and group assignments)
        let grades: { [studentId: string]: { [assignmentId: string]: number | string } } = {};
        const allAssignmentsWithGroups = [...allAssignments, ...groupAssignments];
        for (const assignment of allAssignmentsWithGroups) {
          const res = await axios.get(`${API_URL}/api/submissions/assignment/${assignment._id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          // Map: { studentId: grade }
          for (const submission of res.data) {
            if (assignment.isGroupAssignment && submission.group && submission.group.members) {
              // For group assignments, create grades for all group members
              submission.group.members.forEach((member: any) => {
                const memberId = member._id || member;
                if (!grades[String(memberId)]) grades[String(memberId)] = {};
                
                // Check for individual member grades first
                if (submission.useIndividualGrades && submission.memberGrades) {
                  const memberGrade = submission.memberGrades.find(
                    (mg: any) => mg.student && (mg.student.toString() === String(memberId) || mg.student._id?.toString() === String(memberId))
                  );
                  if (memberGrade && typeof memberGrade.grade === 'number') {
                    grades[String(memberId)][String(assignment._id)] = memberGrade.grade;
                  } else if (typeof submission.grade === 'number') {
                    grades[String(memberId)][String(assignment._id)] = submission.grade;
                  } else {
                    grades[String(memberId)][String(assignment._id)] = '-';
                  }
                } else if (typeof submission.grade === 'number') {
                  // Use group grade for all members
                  grades[String(memberId)][String(assignment._id)] = submission.grade;
                } else {
                  grades[String(memberId)][String(assignment._id)] = '-';
                }
              });
            } else if (submission.student) {
              // For regular assignments
              const studentId = submission.student._id || submission.student;
              if (!grades[String(studentId)]) grades[String(studentId)] = {};
              grades[String(studentId)][String(assignment._id)] = submission.grade ?? '-';
            }
          }
        }

        // 6. Add discussion grades
        for (const discussion of gradedDiscussions) {
          for (const student of students) {
            if (!grades[String(student._id)]) grades[String(student._id)] = {};
            const studentGradeObj = discussion.studentGrades.find(
              (g: any) => g.student && (g.student._id === student._id || g.student === student._id)
            );
            grades[String(student._id)][String(discussion._id)] =
              typeof studentGradeObj?.grade === 'number' ? studentGradeObj.grade : '-';
          }
        }

        // Deduplicate for instructor view as well
        const combined = [...allAssignments, ...groupAssignments, ...gradedDiscussions];
        const byIdInstructor = combined.filter((a, i, arr) => i === arr.findIndex(b => b._id === a._id));
        const seenInstructor = new Set<string>();
        const uniqueInstructor = byIdInstructor.filter(a => {
          const type = a.isDiscussion ? 'discussion' : 'assignment';
          const key = `${String(a.title || '').trim().toLowerCase()}|${type}`;
          if (seenInstructor.has(key)) return false;
          seenInstructor.add(key);
          return true;
        });

        // Sort assignments by creation date (oldest first, newest last)
        // Use createdAt if available, otherwise use dueDate, otherwise use current date as fallback
        uniqueInstructor.sort((a: any, b: any) => {
          const getDate = (item: any) => {
            if (item.createdAt) return new Date(item.createdAt).getTime();
            if (item.dueDate) return new Date(item.dueDate).getTime();
            return 0; // Put items without dates at the end
          };
          
          const dateA = getDate(a);
          const dateB = getDate(b);
          
          // If both have dates, sort oldest first
          if (dateA > 0 && dateB > 0) {
            return dateA - dateB;
          }
          // If only one has a date, prioritize it
          if (dateA > 0 && dateB === 0) return -1;
          if (dateA === 0 && dateB > 0) return 1;
          // If neither has a date, maintain original order
          return 0;
        });

        setGradebookData({ 
          students, 
          assignments: uniqueInstructor, 
          grades 
        });
      } catch (err) {
        setGradebookData({ students: [], assignments: [], grades: {} });
      }
    };
    fetchInstructorGradebookData();
  }, [activeSection, isInstructor, course, modules]);

  // Handler to open grade scale modal
  const handleOpenGradeScaleModal = () => {
    setEditGradeScale(course?.gradeScale ? [...course.gradeScale] : []);
    setShowGradeScaleModal(true);
    setGradeScaleError('');
    setGroupError(''); // Clear any group errors
  };

  // Handler to update a row
  const handleGradeScaleChange = (idx: number, field: string, value: string | number) => {
    setEditGradeScale(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  };

  // Handler to add a new row
  const handleAddGradeScaleRow = () => {
    setEditGradeScale(prev => [...prev, { letter: '', min: 0, max: 0 }]);
  };

  // Handler to remove a row
  const handleRemoveGradeScaleRow = (idx: number) => {
    setEditGradeScale(prev => prev.filter((_, i) => i !== idx));
  };

  // Handler to save grade scale
  const handleSaveGradeScale = async () => {
    setSavingGradeScale(true);
    setGradeScaleError('');
    try {
      // Validate scale
      for (const row of editGradeScale) {
        if (!row.letter || row.min === '' || row.max === '' || isNaN(row.min) || isNaN(row.max)) {
          setGradeScaleError('All fields are required and must be valid numbers.');
          setSavingGradeScale(false);
          return;
        }
      }
      // Save to backend
      const token = localStorage.getItem('token');
      const baseUrl = API_URL || '';
      const res = await axios.put(
        `${baseUrl}/api/courses/${course._id}`,
        {
          title: course.title,
          description: course.description,
          gradeScale: editGradeScale
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setCourse(res.data.data);
        setShowGradeScaleModal(false);
      } else {
        setGradeScaleError('Failed to save grade scale.');
      }
    } catch (err: any) {
      setGradeScaleError(err.response?.data?.message || 'Error saving grade scale');
    } finally {
      setSavingGradeScale(false);
    }
  };

  // Update handler for updating a grade
  const handleGradeUpdate = async (studentId: string, assignmentId: string, newGrade: string) => {
    if (!id) return;
    
    const submissionKey = `${studentId}_${assignmentId}`;
    const submissionId = submissionMap[submissionKey];
    
    // Find assignment to check if it's offline
    const assignment = gradebookData.assignments.find((a: any) => a._id === assignmentId);
    const isOfflineAssignment = assignment?.isOfflineAssignment === true;
    
    // For offline assignments, we can create a grade even without a submission
    if (!submissionId && !isOfflineAssignment) {
      setGradeError('No submission found for this student');
      setSavingGrade(null);
      setEditingGrade(null);
      return;
    }

    // Handle grade removal (empty input)
    if (newGrade.trim() === '') {
      setSavingGrade({ studentId, assignmentId });
      setGradeError('');

      try {
        const token = localStorage.getItem('token');
        let res: any;
        
        // Use manual-grade endpoint for offline assignments
        if (isOfflineAssignment) {
          res = await axios.post(
            `${API_URL}/api/submissions/manual-grade`,
            { 
              assignmentId,
              studentId,
              grade: null  // Send null to remove the grade
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } else {
          res = await axios.post(
            `${API_URL}/api/submissions/${submissionId}/grade`,
            { grade: null },  // Send null to remove the grade
            { headers: { Authorization: `Bearer ${token}` } }
          );
        }

        if (res.data) {
          // Update local state to remove the grade
          setGradebookData((prev: any) => {
            const newGrades = { ...prev.grades };
            if (newGrades[String(studentId)]) {
              delete newGrades[String(studentId)][String(assignmentId)];
              // If no more grades for this student, remove the student entry
              if (Object.keys(newGrades[String(studentId)]).length === 0) {
                delete newGrades[String(studentId)];
              }
            }
            return {
              ...prev,
              grades: newGrades
            };
          });
          setEditingGrade(null);
        }
      } catch (err: any) {
        setGradeError(err.response?.data?.message || 'Failed to remove grade');
      } finally {
        setSavingGrade(null);
      }
      return;
    }

    // Validate grade is a number and not negative
    const gradeNum = parseFloat(newGrade);
    if (isNaN(gradeNum) || gradeNum < 0) {
      setGradeError('Grade must be a valid number');
      setSavingGrade(null);
      setEditingGrade(null);
      return;
    }

    // Get max points from assignment (already found above)
    const maxPoints = assignment?.questions?.reduce((sum: number, q: any) => sum + (q.points || 0), 0) || assignment?.totalPoints || 0;
    
    if (gradeNum > maxPoints) {
      setGradeError(`Grade cannot exceed ${maxPoints} points`);
      setSavingGrade(null);
      setEditingGrade(null);
      return;
    }

    setSavingGrade({ studentId, assignmentId });
    setGradeError('');

    try {
      const token = localStorage.getItem('token');
      let res: any;
      
      // Use manual-grade endpoint for offline assignments without submissions
      if (isOfflineAssignment && !submissionId) {
        res = await axios.post(
          `${API_URL}/api/submissions/manual-grade`,
          { 
            assignmentId,
            studentId,
            grade: gradeNum
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        // Update submission map with the newly created submission
        if (res.data && res.data._id) {
          setSubmissionMap((prev: any) => ({
            ...prev,
            [submissionKey]: res.data._id
          }));
        }
      } else {
        // Use regular grade endpoint
        res = await axios.post(
          `${API_URL}/api/submissions/${submissionId}/grade`,
          { grade: gradeNum },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      if (res.data) {
        // Update local state
        setGradebookData((prev: any) => {
          const newGrades = {
            ...prev.grades,
            [String(studentId)]: {
              ...prev.grades[String(studentId)],
              [String(assignmentId)]: gradeNum
            }
          };
          return {
            ...prev,
            grades: newGrades
          };
        });
        setEditingGrade(null);
      }
    } catch (err: any) {
      setGradeError(err.response?.data?.message || 'Failed to update grade');
    } finally {
      setSavingGrade(null);
    }
  };

  // Add handlers for grade cell interaction
  const handleGradeCellClick = (studentId: string, assignmentId: string, currentGrade: number | string) => {
    if (!isInstructor && !isAdmin) return;
    setEditingGrade({ studentId, assignmentId });
    setEditingValue(currentGrade === '-' ? '' : currentGrade.toString());
    setGradeError('');
  };

  const handleGradeInputKeyDown = (e: React.KeyboardEvent, studentId: string, assignmentId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleGradeUpdate(studentId, assignmentId, editingValue);
    } else if (e.key === 'Escape') {
      setEditingGrade(null);
      setGradeError('');
    }
  };

  const exportGradebookCSV = () => {
    try {
      const { students, assignments, grades } = gradebookData;
      
      // Create CSV header with course information
      const instructorInfo = course?.instructor 
        ? `${course.instructor.firstName} ${course.instructor.lastName} (${course.instructor.email})`
        : 'No Instructor Assigned';
        
      // Helper to detect discussion participation by a specific user
      const hasReplyByUser = (replies: any[], userId: string): boolean => {
        if (!Array.isArray(replies)) return false;
        const stack = [...replies];
        while (stack.length) {
          const r = stack.pop();
          const authorId = r?.author?._id || r?.author;
          if (String(authorId) === String(userId)) return true;
          if (Array.isArray(r?.replies)) stack.push(...r.replies);
        }
        return false;
      };

      const csvContent = [
        `Course: ${course?.title || 'Unknown Course'}`,
        `Instructor: ${instructorInfo}`,
        `Export Date: ${new Date().toLocaleDateString()}`,
        '', // Empty line for spacing
        // Create header row with student name and all assignments
        ['Student Name', 'Email', ...assignments.map((a: any) => a.title), 'Overall Grade', 'Letter Grade'].join(','),
        // Create data rows for each student
        ...students.map((student: any) => {
          // Augment discussions with per-student hasSubmitted flag (affects zero handling)
          const augmentedAssignments = assignments.map((a: any) =>
            a.isDiscussion ? { ...a, hasSubmitted: hasReplyByUser(a.replies || [], student._id) } : a
          );
          // Compute using the same utility and the augmented assignments + submissions
          const weightedPercent = calculateFinalGradeWithWeightedGroups(
            student._id,
            course,
            augmentedAssignments,
            grades,
            submissionMap
          );
          const letter = getLetterGrade(weightedPercent, course?.gradeScale);
          
          const assignmentGrades = assignments.map((assignment: any) => {
            const grade = grades[student._id]?.[assignment._id];
            return grade && typeof grade === 'number' ? grade.toString() : '-';
          });
          
          return [
            `${student.firstName} ${student.lastName}`,
            student.email,
            ...assignmentGrades,
            weightedPercent.toFixed(2),
            letter
          ].join(',');
        })
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gradebook_${(course?.title || 'Unknown_Course').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting gradebook:', error);
      alert('Failed to export gradebook CSV');
    }
  };

  // Handler to open group modal
  const handleOpenGroupModal = () => {
    setEditGroups(course?.groups ? [...course.groups] : []);
    setShowGroupModal(true);
    setGroupError('');
    setGradeScaleError(''); // Clear any grade scale errors
  };

  // Handler to update a group row
  const handleGroupChange = (idx: number, field: string, value: string | number) => {
    setEditGroups(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  };

  // Handler to add a new group row
  const handleAddGroupRow = () => {
    setEditGroups(prev => [...prev, { name: '', weight: 0 }]);
  };

  // Handler to remove a group row
  const handleRemoveGroupRow = (idx: number) => {
    setEditGroups(prev => prev.filter((_, i) => i !== idx));
  };

  // Handler to reset to default groups
  const handleResetToDefaults = () => {
    const defaultGroups = [
      { name: 'Projects', weight: 15 },
      { name: 'Homework', weight: 15 },
      { name: 'Exams', weight: 20 },
      { name: 'Quizzes', weight: 30 },
      { name: 'Participation', weight: 20 }
    ];
    setEditGroups(defaultGroups);
    setGroupError('');
  };

  // Handler to save group weights
  const handleSaveGroups = async () => {
    setSavingGroups(true);
    setGroupError('');
    try {
      // Validate
      let total = 0;
      for (const row of editGroups) {
        if (!row.name || row.weight === '' || isNaN(row.weight)) {
          setGroupError('All fields are required and must be valid numbers.');
          setSavingGroups(false);
          return;
        }
        total += Number(row.weight);
      }
      if (total !== 100) {
        setGroupError('Total weight must be 100%.');
        setSavingGroups(false);
        return;
      }
      // Save to backend
      const token = localStorage.getItem('token');
      const baseUrl = API_URL || '';
      const res = await axios.put(
        `${baseUrl}/api/courses/${course._id}`,
        {
          ...course,
          groups: editGroups
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setCourse(res.data.data);
        setShowGroupModal(false);
      } else {
        setGroupError('Failed to save assignment groups.');
      }
    } catch (err: any) {
      setGroupError(err.response?.data?.message || 'Error saving assignment groups');
    } finally {
      setSavingGroups(false);
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

  // Syllabus handlers
  const handleSyllabusFieldChange = (field: string, value: string) => {
    setSyllabusFields(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveSyllabusFields = async () => {
    if (!course?._id) return;
    setSavingSyllabus(true);
    try {
      const token = localStorage.getItem('token');
      const response = await api.put(`/courses/${course._id}`, {
        title: syllabusFields.courseTitle,
        catalog: {
          ...course.catalog,
          courseCode: syllabusFields.courseCode,
          officeHours: syllabusFields.officeHours
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setCourse(response.data.data);
        setEditingSyllabus(false);
      }
    } catch (err: any) {
      console.error('Error saving syllabus fields:', err);
      alert('Failed to save syllabus fields');
    } finally {
      setSavingSyllabus(false);
    }
  };

  const handleSyllabusFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setUploadingFiles(true);
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/api/upload`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      const newFiles = response.data.files.map((file: any) => ({
        name: file.originalname,
        url: file.path,
        size: file.size,
        uploadedAt: new Date()
      }));

      setUploadedSyllabusFiles(prev => [...prev, ...newFiles]);
      setSyllabusFiles(prev => [...prev, ...files]);
    } catch (error: any) {
      console.error('Error uploading files:', error);
      alert('Error uploading files. Please try again.');
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleRemoveSyllabusFile = (index: number) => {
    setUploadedSyllabusFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveSyllabus = async () => {
    if (!course?._id) return;
    setSavingSyllabus(true);
    try {
      const token = localStorage.getItem('token');
      const response = await api.put(`/courses/${course._id}`, {
        catalog: {
          ...course.catalog,
          syllabusContent: syllabusContent,
          syllabusFiles: uploadedSyllabusFiles
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setCourse(response.data.data);
        setSyllabusMode('none');
        setSyllabusContent('');
        setSyllabusFiles([]);
      }
    } catch (err: any) {
      console.error('Error saving syllabus:', err);
      alert('Failed to save syllabus');
    } finally {
      setSavingSyllabus(false);
    }
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
          <div className="space-y-6">
            {(isInstructor || isAdmin) && publishError && (
              <div className="bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-4 py-2 rounded mb-2 font-medium border border-red-200 dark:border-red-800">
                {publishError}
              </div>
            )}
            {/* Course Header */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-6 flex flex-col md:flex-row justify-between items-start md:items-center mb-4 border border-gray-200 dark:border-gray-700">
                <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">{course.catalog?.courseCode || course.title}</h1>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Instructor: {course.instructor.firstName} {course.instructor.lastName}
                </div>
                </div>
                {(isInstructor || isAdmin) && (
                <div className="flex flex-col items-end mt-4 md:mt-0 gap-2">
                  {/* Publish/Unpublish toggle for teachers/admins only */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleToggleCoursePublish}
                      disabled={publishingCourse}
                      className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-opacity-50 ${course.published ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/70' : 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/70'} ${publishingCourse ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {course.published ? (
                        <Unlock className="w-4 h-4 mr-2" />
                      ) : (
                        <Lock className="w-4 h-4 mr-2" />
                      )}
                      {publishingCourse
                        ? 'Updating...'
                        : course.published
                        ? 'Unpublish'
                        : 'Publish'}
                    </button>
                  </div>
                  <div className="space-x-2">
                    <button
                      onClick={() => navigate(`/courses/${course._id}/edit`)}
                      className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors"
                    >
                      Edit Course
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this course?')) {
                            // Handle delete
                          }
                        }}
                        className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                      >
                        Delete Course
                      </button>
                    )}
                  </div>
                  </div>
                )}
              </div>

            {/* Course Overview Cards */}
            {(isInstructor || isAdmin) && (
              <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="flex-1 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 text-center shadow">
                  <div className="text-lg font-semibold text-blue-800 dark:text-blue-300">Students</div>
                  <div className="text-3xl font-bold text-blue-900 dark:text-blue-200">{course.students?.length || 0}</div>
              </div>
                <div className="flex-1 bg-green-50 dark:bg-green-900/20 rounded-xl p-6 text-center shadow">
                  <div className="text-lg font-semibold text-green-800 dark:text-green-300">Modules</div>
                  <div className="text-3xl font-bold text-green-900 dark:text-green-200">{modules.length}</div>
            </div>
                <div className="flex-1 bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6 text-center shadow">
                  <div className="text-lg font-semibold text-purple-800 dark:text-purple-300">Assignments</div>
                  <div className="text-3xl font-bold text-purple-900 dark:text-purple-200">{modules.reduce((acc, m) => acc + (m.assignments?.length || 0), 0)}</div>
                </div>
              </div>
            )}

            {/* Quick Actions (teachers/admins only) */}
            {(isInstructor || isAdmin) && (
              <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-6 border border-gray-200 dark:border-gray-700">
                <div className="font-semibold mb-4 text-gray-900 dark:text-gray-100">Quick Actions</div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors" onClick={() => navigate(`/courses/${id}/modules`)}>Create Module</button>
                  <button className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors" onClick={() => navigate(`/courses/${id}/students`)}>Manage Students</button>
                  <button className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition-colors" onClick={() => navigate(`/courses/${id}/gradebook`)}>View Gradebook</button>
                  <button 
                    className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition-colors flex items-center gap-2" 
                    onClick={() => setShowOverviewConfigModal(true)}
                  >
                    <Settings className="w-4 h-4" />
                    Configure Overview
                  </button>
                  <button 
                    className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 transition-colors flex items-center gap-2" 
                    onClick={() => setShowSidebarConfigModal(true)}
                  >
                    <Layout className="w-4 h-4" />
                    Customize Sidebar
                  </button>
                </div>
              </div>
            )}

            {/* Student View - Latest Announcements */}
            {!isInstructor && !isAdmin && course.overviewConfig?.showLatestAnnouncements && (
              <LatestAnnouncements 
                courseId={course._id} 
                numberOfAnnouncements={course.overviewConfig.numberOfAnnouncements || 3} 
              />
            )}
          </div>
        );

      case 'syllabus':
        return (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Course Syllabus</h2>
                {(isInstructor || isAdmin) && !editingSyllabus && (
                  <button
                    onClick={() => setEditingSyllabus(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Edit
                  </button>
                )}
              </div>

              {/* Editable Syllabus Fields */}
              <div className="space-y-4 mb-6">
                {(editingSyllabus && (isInstructor || isAdmin)) ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Course Title</label>
                        <input
                          type="text"
                          value={syllabusFields.courseTitle}
                          onChange={(e) => handleSyllabusFieldChange('courseTitle', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="-"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Course Code</label>
                        <input
                          type="text"
                          value={syllabusFields.courseCode}
                          onChange={(e) => handleSyllabusFieldChange('courseCode', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="-"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Instructor</label>
                      <input
                        type="text"
                        value={syllabusFields.instructorName}
                        onChange={(e) => handleSyllabusFieldChange('instructorName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                      <input
                        type="email"
                        value={syllabusFields.instructorEmail}
                        onChange={(e) => handleSyllabusFieldChange('instructorEmail', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Office Hours</label>
                      <input
                        type="text"
                        value={syllabusFields.officeHours}
                        onChange={(e) => handleSyllabusFieldChange('officeHours', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="By Appointment"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveSyllabusFields}
                        disabled={savingSyllabus}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        {savingSyllabus ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingSyllabus(false);
                          // Reset to original values
                          if (course) {
                            setSyllabusFields({
                              courseTitle: course.title || '',
                              courseCode: course.catalog?.courseCode || '',
                              instructorName: `${course.instructor?.firstName || ''} ${course.instructor?.lastName || ''}`.trim(),
                              instructorEmail: course.instructor?.email || '',
                              officeHours: course.catalog?.officeHours || 'By Appointment'
                            });
                          }
                        }}
                        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div><strong>Course Title:</strong> {syllabusFields.courseTitle || '-'}</div>
                    <div><strong>Course Code:</strong> {syllabusFields.courseCode || '-'}</div>
                    <div><strong>Instructor:</strong> {syllabusFields.instructorName || '-'}</div>
                    <div><strong>Email:</strong> {syllabusFields.instructorEmail || '-'}</div>
                    <div><strong>Office Hours:</strong> {syllabusFields.officeHours || 'By Appointment'}</div>
                  </div>
                )}
              </div>

              {/* Add Syllabus Section */}
              {(isInstructor || isAdmin) && (
                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Add Syllabus</h3>
                  
                  {syllabusMode === 'none' && (
                    <div className="flex gap-4">
                      <button
                        onClick={() => setSyllabusMode('upload')}
                        className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                      >
                        Upload File
                      </button>
                      <button
                        onClick={() => setSyllabusMode('editor')}
                        className="px-6 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                      >
                        Editor + Upload File
                      </button>
                    </div>
                  )}

                  {syllabusMode === 'upload' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Upload File</label>
                        <input
                          type="file"
                          multiple
                          onChange={handleSyllabusFileUpload}
                          disabled={uploadingFiles}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                        {uploadingFiles && <p className="text-sm text-gray-500 mt-2">Uploading...</p>}
                      </div>

                      {uploadedSyllabusFiles.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-medium">Uploaded Files:</h4>
                          {uploadedSyllabusFiles.map((file: any, index: number) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <a href={file.url?.startsWith('http') ? file.url : `${API_URL}${file.url}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                {file.name}
                              </a>
                              <button
                                onClick={() => handleRemoveSyllabusFile(index)}
                                className="text-red-600 hover:text-red-800"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveSyllabus}
                          disabled={savingSyllabus || uploadingFiles}
                          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          {savingSyllabus ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => {
                            setSyllabusMode('none');
                            setUploadedSyllabusFiles(course.catalog?.syllabusFiles || []);
                          }}
                          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {syllabusMode === 'editor' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Syllabus Content</label>
                        <div className="border border-gray-300 rounded-md">
                          <RichTextEditor
                            content={syllabusContent}
                            onChange={setSyllabusContent}
                            height={400}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Upload File</label>
                        <input
                          type="file"
                          multiple
                          onChange={handleSyllabusFileUpload}
                          disabled={uploadingFiles}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                        {uploadingFiles && <p className="text-sm text-gray-500 mt-2">Uploading...</p>}
                      </div>

                      {uploadedSyllabusFiles.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-medium">Uploaded Files:</h4>
                          {uploadedSyllabusFiles.map((file: any, index: number) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <a href={file.url?.startsWith('http') ? file.url : `${API_URL}${file.url}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                {file.name}
                              </a>
                              <button
                                onClick={() => handleRemoveSyllabusFile(index)}
                                className="text-red-600 hover:text-red-800"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveSyllabus}
                          disabled={savingSyllabus || uploadingFiles}
                          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          {savingSyllabus ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => {
                            setSyllabusMode('none');
                            setSyllabusContent(course.catalog?.syllabusContent || '');
                            setUploadedSyllabusFiles(course.catalog?.syllabusFiles || []);
                          }}
                          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Display Syllabus Content */}
              {course.catalog?.syllabusContent && (
                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Syllabus Content</h3>
                  <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: course.catalog.syllabusContent }} />
                </div>
              )}

              {/* Display Syllabus Files */}
              {course.catalog?.syllabusFiles && course.catalog.syllabusFiles.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Syllabus Files</h3>
                  <div className="space-y-2">
                    {course.catalog.syllabusFiles.map((file: any, index: number) => (
                      <div key={index} className="flex items-center p-2 bg-gray-50 rounded">
                        <a href={file.url?.startsWith('http') ? file.url : `${API_URL}${file.url}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {file.name}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
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
        // Gather all assignments from all modules
        const allAssignments = modules.flatMap((module: any) => module.assignments || []);
        // Add group assignments with isGroupAssignment: true and correct totalPoints
        const allGroupAssignments = groupAssignments.map((a: any) => ({
          ...a,
          isGroupAssignment: true,
          totalPoints: a.totalPoints || (Array.isArray(a.questions) ? a.questions.reduce((sum: number, q: any) => sum + (q.points || 0), 0) : 0)
        }));
        
        // Deduplicate: Remove group assignments from module assignments to avoid showing them twice
        const moduleAssignmentsOnly = allAssignments.filter(assignment => !assignment.isGroupAssignment);
        
        // Combine assignments, group assignments, and discussions
        const combinedList = [
          ...moduleAssignmentsOnly,
          ...allGroupAssignments,
          ...discussions.map(d => ({
            _id: d._id,
            title: d.title,
            dueDate: d.dueDate || d.due_date || d.discussionDueDate || null,
            attachments: [],
            createdBy: d.author || { firstName: '', lastName: '' },
            type: 'discussion',
            group: d.group || 'Discussions',
            totalPoints: d.totalPoints || 0,
            published: true, // Always treat discussions as published
            studentGrades: d.studentGrades || [],
            replies: d.replies || [],
          }))
        ];
        
        // Final deduplication by ID to ensure no duplicates exist
        const seenIds = new Set<string>();
        const deduplicatedList = combinedList.filter(item => {
          const id = item._id;
          if (seenIds.has(id)) {
            return false;
          }
          seenIds.add(id);
          return true;
        });
        return (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Assignments</h2>
                  <p className="text-gray-600 mt-1">View and manage course assignments</p>
                </div>
                {(isInstructor || isAdmin) && (
                  <>
                    {modules.length > 0 ? (
                      <button
                        onClick={() => navigate(`/modules/${modules[0]._id}/assignments/create`)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
                      >
                        <span>+</span> Create Assignment
                      </button>
                    ) : (
                      <div className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-4 py-2 rounded-md">
                        Create a module first to add assignments
                      </div>
                    )}
                  </>
                )}
              </div>
              {/* Render the new AssignmentList table UI for all assignments and discussions */}
              {discussionsLoading ? (
                <div className="text-center text-gray-500 py-8">Loading discussions...</div>
              ) : modules.length > 0 ? (
                <AssignmentList assignments={deduplicatedList} userRole={user?.role} studentSubmissions={user?.role === 'student' ? studentSubmissions : undefined} studentId={user?._id} submissionMap={user?.role === 'student' ? submissionMap : undefined} courseId={course?._id} />
              ) : (
                <div className="text-center text-gray-500 py-8">No modules available. Please create a module to add assignments.</div>
              )}
            </div>
          </div>
        );

      case 'quizzes':
        // Gather all assignments and filter for graded quizzes (isGradedQuiz === true)
        const allAssignmentsForQuizzes = modules.flatMap((module: any) => module.assignments || []);
        const allGroupAssignmentsForQuizzes = groupAssignments.map((a: any) => ({
          ...a,
          isGroupAssignment: true,
          totalPoints: a.totalPoints || (Array.isArray(a.questions) ? a.questions.reduce((sum: number, q: any) => sum + (q.points || 0), 0) : 0)
        }));
        
        // Combine all assignments and filter for graded quizzes
        const allItemsForQuizzes = [
          ...allAssignmentsForQuizzes,
          ...allGroupAssignmentsForQuizzes
        ];
        
        const quizzesList = allItemsForQuizzes.filter((item: any) => item.isGradedQuiz === true);
        
        // Deduplicate quizzes by ID
        const seenQuizIds = new Set<string>();
        const deduplicatedQuizzes = quizzesList.filter((item: any) => {
          const id = item._id;
          if (seenQuizIds.has(id)) {
            return false;
          }
          seenQuizIds.add(id);
          return true;
        });
        
        return (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Quizzes</h2>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">View and manage course quizzes</p>
                </div>
                {(isInstructor || isAdmin) && (
                  <>
                    {modules.length > 0 ? (
                      <button
                        onClick={() => navigate(`/modules/${modules[0]._id}/assignments/create?isGradedQuiz=true`)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
                      >
                        <span>+</span> Create Quiz
                      </button>
                    ) : (
                      <div className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-4 py-2 rounded-md">
                        Create a module first to add quizzes
                      </div>
                    )}
                  </>
                )}
              </div>
              {/* Render quizzes using AssignmentList */}
              {discussionsLoading ? (
                <div className="text-center text-gray-500 py-8">Loading quizzes...</div>
              ) : modules.length > 0 ? (
                <AssignmentList 
                  assignments={deduplicatedQuizzes} 
                  userRole={user?.role} 
                  studentSubmissions={user?.role === 'student' ? studentSubmissions : undefined} 
                  studentId={user?._id} 
                  submissionMap={user?.role === 'student' ? submissionMap : undefined} 
                  courseId={course?._id}
                  isQuizzesView={true}
                />
              ) : (
                <div className="text-center text-gray-500 py-8">No modules available. Please create a module to add quizzes.</div>
              )}
            </div>
          </div>
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

      case 'grades':
        if (isInstructor || isAdmin) {
          // ... existing instructor view code ...
        }

        // Student view:
        if (!user) {
          return <div className="text-center py-8 text-gray-500">User not found.</div>;
        }

        // Construct the same assignment list structure as teacher gradebook for consistency
        const studentModuleAssignments = modules.flatMap((module: any) =>
              (module.assignments || []).map((assignment: any) => {
                // Normalize dueDate for all assignment types (future-proof)
                let dueDateRaw = assignment.dueDate || assignment.due_date || assignment.discussionDueDate || null;
                let dueDate = dueDateRaw ? new Date(dueDateRaw) : null;
                return {
                  ...assignment,
                  moduleTitle: module.title,
                  isDiscussion: false,
                  dueDate,
                };
              })
        );

        const studentGroupAssignmentsList = studentGroupAssignments.map((assignment: any) => ({
              ...assignment,
              moduleTitle: 'Group Assignments',
              isDiscussion: false
        }));

        const studentGradedDiscussions = studentDiscussions.map((discussion: any) => ({
          _id: discussion._id,
          title: discussion.title,
          totalPoints: discussion.totalPoints,
          group: discussion.group,
          moduleTitle: 'Discussions',
          isDiscussion: true,
          studentGrades: discussion.studentGrades || [],
          dueDate: discussion.dueDate || null,
          hasSubmitted: discussion.hasSubmitted || false,
          replies: discussion.replies || []
        }));

        // Use the same structure as teacher gradebook
        const studentAssignments = [...studentModuleAssignments, ...studentGroupAssignmentsList, ...studentGradedDiscussions];
        
        const studentId = user?._id;
        if (!studentId) {
          return <div className="text-center py-8 text-gray-500">User ID not found.</div>;
        }

        return (
          <div className="flex flex-col md:flex-row gap-4">
            {/* Main Content */}
            <div className="flex-1">
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-1">My Grades</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Track your academic progress</p>
                  </div>
                </div>
                {/* Show calculated grade using backend API result */}
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Name</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Due</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Score</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Out of</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {studentAssignments.map((assignment: any, idx: number) => {
                        const submissionKey = `${String(studentId)}_${String(assignment._id)}`;
                        let hasSubmission = assignment.isDiscussion 
                          ? assignment.hasSubmitted || (Array.isArray(assignment.replies) && assignment.replies.some((r: any) => r.author && (r.author._id === String(studentId) || r.author === String(studentId))))
                          : !!submissionMap[submissionKey];
                        
                        let grade = assignment.isDiscussion
                          ? assignment.grade
                          : gradebookData.grades[String(studentId)]?.[String(assignment._id)];
                        const maxPoints = assignment.questions?.reduce((sum: number, q: any) => sum + (q.points || 0), 0) || assignment.totalPoints || 0;
                        const submission = studentSubmissions.find(s => s.assignment && s.assignment._id === assignment._id);
                        const feedback = typeof submission?.feedback === 'string' ? submission.feedback : '';
                        const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
                        const now = new Date();
                        let statusCell: React.ReactNode = null;
                        let scoreCell: string | number = typeof grade === 'number' ? 
                          (Number.isInteger(grade) ? grade.toString() : Number(grade).toFixed(2)) : '-';
                        let submittedAt: Date | null = null;
                        
                        if (assignment.isDiscussion) {
                          // For discussions, extract grade from studentGrades if not present
                          if (grade === null || grade === undefined) {
                            if (Array.isArray(assignment.studentGrades)) {
                              const studentGradeObj = assignment.studentGrades.find((g: any) => g.student && (g.student._id === String(studentId) || g.student === String(studentId)));
                              if (studentGradeObj && typeof studentGradeObj.grade === 'number') {
                                grade = studentGradeObj.grade;
                                scoreCell = Number.isInteger(grade) ? grade.toString() : Number(grade).toFixed(2);
                                submittedAt = studentGradeObj.gradedAt ? new Date(studentGradeObj.gradedAt) : null;
                                hasSubmission = true;
                              }
                            }
                          }
                          // If still no grade, check for reply
                          if (!hasSubmission && Array.isArray(assignment.replies)) {
                            const reply = assignment.replies.find((r: any) => r.author && (r.author._id === studentId || r.author === studentId));
                            if (reply && reply.createdAt) {
                              submittedAt = new Date(reply.createdAt);
                              hasSubmission = true;
                            }
                          }
                          // Status logic
                          if (hasSubmission) {
                            if (dueDate && submittedAt && submittedAt > dueDate) {
                              statusCell = <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">Late</span>;
                            } else {
                              statusCell = <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Submitted</span>;
                            }
                          } else if (dueDate && now > dueDate) {
                            statusCell = <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Missing</span>;
                            scoreCell = '0';
                          }
                        } else {
                          if (!assignment.published) {
                            statusCell = <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">Not Published</span>;
                            scoreCell = '-';
                          } else if (hasSubmission) {
                            if (submission && submission.submittedAt && dueDate && new Date(submission.submittedAt) > dueDate) {
                              statusCell = <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">Late</span>;
                            } else {
                              statusCell = <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Submitted</span>;
                            }
                          } else if (assignment.isOfflineAssignment) {
                            // Offline assignment - don't show "Missing" status
                            statusCell = <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">Offline</span>;
                            scoreCell = '-';
                          } else if (dueDate && now > dueDate) {
                            statusCell = <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Missing</span>;
                            scoreCell = '0';
                          }
                        }
                        let feedbackForDiscussion = '';
                        if (assignment.isDiscussion && Array.isArray(assignment.studentGrades)) {
                          const studentGradeObj = assignment.studentGrades.find((g: any) => g.student && (g.student._id === studentId || g.student === studentId));
                          if (studentGradeObj && typeof studentGradeObj.feedback === 'string' && studentGradeObj.feedback.trim() !== '') {
                            feedbackForDiscussion = studentGradeObj.feedback;
                          }
                        }
                        return (
                          <tr key={`student-assignment-${assignment._id}-${idx}`} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900 dark:text-gray-100">{assignment.title}</div>
                              {assignment.group && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{assignment.group}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                              {assignment.dueDate ? new Date(assignment.dueDate).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                            </td>
                            <td className="px-4 py-3 text-center">{statusCell}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="font-semibold text-gray-900 dark:text-gray-100">{scoreCell}</span>
                            </td>
                            <td className="px-4 py-3 text-center text-xs text-gray-600 dark:text-gray-400">{maxPoints}</td>
                            <td className="px-4 py-3 text-center">
                              {assignment.isDiscussion ? (
                                feedbackForDiscussion && (
                                  <button
                                    className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 transition-colors duration-150"
                                    title="View feedback"
                                    onClick={() => navigate(`/courses/${course._id}/threads/${assignment._id}`)}
                                  >
                                    <span role="img" aria-label="Comment" className="text-sm">💬</span>
                                  </button>
                                )
                              ) : (
                                hasSubmission && typeof feedback === 'string' && feedback.trim() !== '' && (
                                  <button
                                    className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 transition-colors duration-150"
                                    title="View feedback"
                                    onClick={() => navigate(`/assignments/${assignment._id}/view`)}
                                  >
                                    <span role="img" aria-label="Comment" className="text-sm">💬</span>
                                  </button>
                                )
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Assignment Group Performance Summary - Separate Card */}
              {course.groups && course.groups.length > 0 && (
                <div className="mt-6">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="bg-blue-100 dark:bg-blue-900 rounded-lg p-2">
                        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Performance by Assignment Group</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Your scores broken down by weighted categories</p>
                      </div>
                    </div>
                    
                    <div className="bg-white dark:bg-gray-900 rounded-lg overflow-hidden shadow-sm">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Assignment Group</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Assignments</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Points Earned</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Total Points</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Percentage</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Weight</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {(course.groups || []).map((group: any, idx: number) => {
                            // Calculate group performance
                            const groupAssignments = studentAssignments.filter((assignment: any) => assignment.group === group.name);
                            let totalEarned = 0;
                            let totalPossible = 0;
                            let gradedAssignments = 0;
                            
                            groupAssignments.forEach((assignment: any) => {
                              const maxPoints = assignment.questions?.reduce((sum: number, q: any) => sum + (q.points || 0), 0) || assignment.totalPoints || 0;
                              let grade = assignment.isDiscussion
                                ? assignment.grade
                                : gradebookData.grades[String(studentId)]?.[String(assignment._id)];
                              
                              // For discussions, check studentGrades
                              if (assignment.isDiscussion && (grade === null || grade === undefined)) {
                                if (Array.isArray(assignment.studentGrades)) {
                                  const studentGradeObj = assignment.studentGrades.find((g: any) => g.student && (g.student._id === String(studentId) || g.student === String(studentId)));
                                  if (studentGradeObj && typeof studentGradeObj.grade === 'number') {
                                    grade = studentGradeObj.grade;
                                  }
                                }
                              }
                              
                              if (typeof grade === 'number') {
                                totalEarned += grade;
                                totalPossible += maxPoints;
                                gradedAssignments++;
                              } else {
                                // Check if assignment is past due and no submission
                                const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
                                const now = new Date();
                                const submissionKey = `${String(studentId)}_${String(assignment._id)}`;
                                const hasSubmission = assignment.isDiscussion 
                                  ? assignment.hasSubmitted || (Array.isArray(assignment.replies) && assignment.replies.some((r: any) => r.author && (r.author._id === String(studentId) || r.author === String(studentId))))
                                  : !!submissionMap[submissionKey];
                                
                                if (dueDate && now > dueDate && !hasSubmission) {
                                  // Count as 0 for missing submissions
                                  totalEarned += 0;
                                  totalPossible += maxPoints;
                                  gradedAssignments++;
                                }
                              }
                            });
                            
                            const percentage = totalPossible > 0 ? (totalEarned / totalPossible) * 100 : 0;
                            const percentageColor = percentage >= 90 ? 'text-green-600 dark:text-green-400' : 
                                                 percentage >= 80 ? 'text-blue-600 dark:text-blue-400' : 
                                                 percentage >= 70 ? 'text-yellow-600 dark:text-yellow-400' : 
                                                 'text-red-600 dark:text-red-400';
                            
                            return (
                              <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150">
                                <td className="px-4 py-3">
                                  <div className="font-medium text-gray-900 dark:text-gray-100">{group.name}</div>
                                </td>
                                <td className="px-4 py-3 text-center text-sm text-gray-600 dark:text-gray-400">
                                  {gradedAssignments}/{groupAssignments.length}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="font-semibold text-gray-900 dark:text-gray-100">{totalEarned.toFixed(1)}</span>
                                </td>
                                <td className="px-4 py-3 text-center text-sm text-gray-600 dark:text-gray-400">
                                  {totalPossible.toFixed(1)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`font-semibold ${percentageColor}`}>
                                    {totalPossible > 0 ? percentage.toFixed(1) : '-'}%
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center text-sm text-gray-600 dark:text-gray-400">
                                  {group.weight}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Sidebar (only) */}
            <StudentGradeSidebar
              course={course}
              studentId={studentId}
              grades={gradebookData.grades}
              assignments={studentAssignments}
              submissionMap={submissionMap}
              studentSubmissions={studentSubmissions}
              backendTotalGrade={studentTotalGrade}
              backendLetterGrade={studentLetterGrade}
            />
          </div>
        );

      case 'gradebook':
        if (!isInstructor && !isAdmin) {
          return <div className="text-center py-8 text-gray-500">Access denied</div>;
        }
        const { students, assignments, grades } = gradebookData;
        // Group assignments by group name
        const gradebookGroupMap = (course.groups || []).reduce((acc: any, group: any) => {
          acc[group.name] = { ...group, assignments: [] };
          return acc;
        }, {});
        assignments.forEach((assignment: any) => {
          if (assignment.group && gradebookGroupMap[assignment.group]) {
            gradebookGroupMap[assignment.group].assignments.push(assignment);
          }
        });
        // Helper to calculate weighted grade for a student
        function getWeightedGrade(student: any) {
          // Create a submission map for this specific student
          const studentSubmissionMap: { [assignmentId: string]: any } = {};
          
          // Build submission map for this student
          Object.keys(submissionMap).forEach(key => {
            if (key.startsWith(`${student._id}_`)) {
              const assignmentId = key.split('_')[1];
              studentSubmissionMap[assignmentId] = submissionMap[key];
            }
          });
          
          // Augment assignments with per-student discussion submission flag
          const augmentedAssignments = assignments.map((a: any) => {
            if (a.isDiscussion) {
              const hasSubmitted = Array.isArray(a.replies)
                ? a.replies.some((r: any) => {
                    const authorId = r.author && r.author._id ? String(r.author._id) : String(r.author || '');
                    if (authorId === String(student._id)) return true;
                    if (Array.isArray(r.replies) && r.replies.length > 0) {
                      // Nested replies
                      const stack = [...r.replies];
                      while (stack.length) {
                        const cur = stack.pop();
                        const curAuthorId = cur.author && cur.author._id ? String(cur.author._id) : String(cur.author || '');
                        if (curAuthorId === String(student._id)) return true;
                        if (Array.isArray(cur.replies)) stack.push(...cur.replies);
                      }
                    }
                    return false;
                  })
                : false;
              return { ...a, hasSubmitted };
            }
            return a;
          });
          
          // Use the function that ignores groups with no grades and now respects per-student discussion submission
          return calculateFinalGradeWithWeightedGroups(
            student._id,
            course,
            augmentedAssignments,
            grades,
            studentSubmissionMap
          );
        }
        return (
          <div className="space-y-6">
            {/* Header Section */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-full p-3">
                    <svg className="w-8 h-8 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Gradebook</h2>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Track student performance and manage grades</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-2 border border-gray-200 dark:border-gray-700 text-center">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Students</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{students.length}</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-2 border border-gray-200 dark:border-gray-700 text-center">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Assignments</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{assignments.length}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Gradebook Table */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="relative w-full">
                <div className="overflow-x-auto w-full relative">
                  <table className="min-w-max w-full">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 sticky top-0 z-10">
                      <tr>
                        {/* Sticky first column header */}
                        <th className="px-6 py-4 border-b border-gray-200 dark:border-gray-600 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 text-left text-gray-700 dark:text-gray-300 sticky left-0 z-50 font-semibold text-sm uppercase tracking-wider" style={{left: 0, zIndex: 50, boxShadow: '2px 0 8px -4px rgba(0,0,0,0.1)'}}>
                          <div className="flex items-center space-x-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span>Student Name</span>
                          </div>
                        </th>
                        {assignments.map((assignment: any, idx: number) => {
                          const handleAssignmentClick = () => {
                            if (assignment.isDiscussion) {
                              // Navigate to discussion thread
                              navigate(`/courses/${id}/threads/${assignment._id}`);
                            } else {
                              // Navigate to assignment view page
                              navigate(`/assignments/${assignment._id}/view`);
                            }
                          };

                          return (
                            <th
                              key={`assignment-${assignment._id}-${idx}`}
                              className="px-4 py-4 border-b border-gray-200 dark:border-gray-600 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 text-center text-gray-700 dark:text-gray-300 min-w-[140px]"
                            >
                              <div 
                                className="font-semibold text-blue-700 dark:text-blue-300 cursor-pointer hover:underline text-center text-sm"
                                onClick={handleAssignmentClick}
                              >
                                {assignment.title}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1 bg-blue-50 dark:bg-blue-900/20 rounded-full px-2 py-1 mx-1">
                                {assignment.group ? assignment.group : 'Ungrouped'}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">
                                Out of {assignment.questions?.reduce((sum: number, q: any) => sum + (q.points || 0), 0) || assignment.totalPoints || 0}
                              </div>
                            </th>
                          );
                        })}
                        {/* Sticky last column header */}
                        <th className="px-6 py-4 border-b border-gray-200 dark:border-gray-600 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 text-center text-gray-700 dark:text-gray-300 sticky right-0 z-50 font-semibold text-sm uppercase tracking-wider" style={{right: 0, zIndex: 50, boxShadow: '-2px 0 8px -4px rgba(0,0,0,0.1)'}}>
                          <div className="flex items-center justify-center space-x-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <span>Overall Grade</span>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {students.map((student: any, rowIdx: number) => {
                        // Calculate weighted grade
                        const weightedPercent = getWeightedGrade(student);
                        const letter = getLetterGrade(weightedPercent, course?.gradeScale);
                        const rowBg = rowIdx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800';
                        const stickyBg = rowIdx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800';
                        
                        // Determine grade color
                        let gradeColor = 'text-gray-700 dark:text-gray-300';
                        if (letter === 'A') gradeColor = 'text-green-600 dark:text-green-400';
                        else if (letter === 'B') gradeColor = 'text-blue-600 dark:text-blue-400';
                        else if (letter === 'C') gradeColor = 'text-yellow-600 dark:text-yellow-400';
                        else if (letter === 'D') gradeColor = 'text-orange-600 dark:text-orange-400';
                        else if (letter === 'F') gradeColor = 'text-red-600 dark:text-red-400';
                        
                        return (
                          <tr
                            key={student._id}
                            className={`${rowBg} hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150`}
                          >
                            {/* Sticky first column body */}
                            <td className={`px-6 py-4 border-r border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer font-medium whitespace-nowrap sticky left-0 z-40 ${stickyBg} transition-colors duration-150`} style={{left: 0, zIndex: 40, boxShadow: '2px 0 8px -4px rgba(0,0,0,0.1)'}}>
                              <div className="flex items-center space-x-3">
                                <div className="relative">
                                  {student.profilePicture ? (
                                    <img
                                      src={student.profilePicture.startsWith('http')
                                        ? student.profilePicture
                                        : getImageUrl(student.profilePicture)}
                                      alt={`${student.firstName} ${student.lastName}`}
                                      className="w-8 h-8 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
                                      onError={(e) => {
                                        // Hide the failed image and show fallback
                                        e.currentTarget.style.display = 'none';
                                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                        if (fallback) {
                                          fallback.style.display = 'flex';
                                        }
                                      }}
                                    />
                                  ) : null}
                                  {/* Fallback avatar - always present but hidden when image loads */}
                                  <div 
                                    className={`w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold ${student.profilePicture ? 'hidden' : ''}`}
                                    style={{ display: student.profilePicture ? 'none' : 'flex' }}
                                  >
                                    {student.firstName.charAt(0)}{student.lastName.charAt(0)}
                                  </div>
                                </div>
                                <span>{student.firstName} {student.lastName}</span>
                              </div>
                            </td>
                            {assignments.map((assignment: any, assIdx: number) => {
                              const submissionKey = `${student._id}_${assignment._id}`;
                              const hasSubmission = assignment.isDiscussion 
                                ? Array.isArray(assignment.replies) && assignment.replies.some((r: any) => r.author && (r.author._id === student._id || r.author === student._id))
                                : !!submissionMap[submissionKey];
                              const isDiscussion = assignment.isDiscussion;
                              const grade = grades[student._id]?.[assignment._id];
                              const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
                              const now = new Date();
                              
                              // Get submission date if exists
                              let submittedAt: Date | null = null;
                              if (isDiscussion) {
                                if (Array.isArray(assignment.replies)) {
                                  const reply = assignment.replies.find((r: any) => r.author && (r.author._id === student._id || r.author === student._id));
                                  if (reply && reply.createdAt) {
                                    submittedAt = new Date(reply.createdAt);
                                  }
                                }
                              } else {
                                const submission = submissionMap[submissionKey];
                                if (submission) {
                                  const sub = studentSubmissions.find(s => s._id === submission);
                                  if (sub?.submittedAt) {
                                    submittedAt = new Date(sub.submittedAt);
                                  }
                                }
                              }

                              let cellContent: React.ReactNode;
                              let cellBg = '';
                              let cellTextColor = 'text-gray-900 dark:text-gray-100';
                              
                              if (!assignment.isDiscussion && !assignment.published) {
                                // Not published
                                cellContent = <span className="text-gray-500 dark:text-gray-400 italic">Not Published</span>;
                                cellBg = 'bg-gray-100 dark:bg-gray-800';
                              } else if (typeof grade === 'number') {
                                // If graded, show the grade
                                const maxPoints = assignment.questions?.reduce((sum: number, q: any) => sum + (q.points || 0), 0) || assignment.totalPoints || 0;
                                const percentage = (grade / maxPoints) * 100;
                                let gradeBg = 'bg-green-100 dark:bg-green-900/20';
                                if (percentage < 60) gradeBg = 'bg-red-100 dark:bg-red-900/20';
                                else if (percentage < 70) gradeBg = 'bg-orange-100 dark:bg-orange-900/20';
                                else if (percentage < 80) gradeBg = 'bg-yellow-100 dark:bg-yellow-900/20';
                                
                                cellContent = (
                                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${gradeBg} ${percentage < 60 ? 'text-red-700 dark:text-red-300' : percentage < 70 ? 'text-orange-700 dark:text-orange-300' : percentage < 80 ? 'text-yellow-700 dark:text-yellow-300' : 'text-green-700 dark:text-green-300'}`}>
                                    {Number.isInteger(grade) ? grade : Number(grade).toFixed(2)}
                                  </div>
                                );
                              } else if (hasSubmission) {
                                if (dueDate && submittedAt && submittedAt.getTime() > dueDate.getTime()) {
                                  // Submitted late
                                  cellContent = (
                                    <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300">
                                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      Late
                                    </div>
                                  );
                                } else {
                                  // Submitted but not graded
                                  cellContent = (
                                    <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      Not Graded
                                    </div>
                                  );
                                }
                              } else if (assignment.isOfflineAssignment) {
                                // Offline assignment - allow manual grade entry even without submission
                                // Bypass "0 (MA)" logic for offline assignments
                                cellContent = (
                                  <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300">
                                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    Add Grade
                                  </div>
                                );
                              } else if (dueDate && now.getTime() > dueDate.getTime()) {
                                // Missing after due date (only for non-offline assignments)
                                cellContent = (
                                  <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300">
                                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    0 (MA)
                                  </div>
                                );
                              } else {
                                // Not submitted yet, due date not passed
                                cellContent = (
                                  <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    No Submission
                                  </div>
                                );
                              }

                              const handleCellClick = (e: React.MouseEvent) => {
                                // If clicking on input or editing controls, don't navigate
                                const target = e.target as HTMLElement;
                                if (target.tagName === 'INPUT' || target.closest('input')) {
                                  return;
                                }

                                // If instructor/admin clicking on cell with submission OR offline assignment, allow editing
                                if ((isInstructor || isAdmin) && (hasSubmission || assignment.isOfflineAssignment)) {
                                  handleGradeCellClick(student._id, assignment._id, grade?.toString() || '');
                                } else {
                                  // Otherwise, navigate to assignment/discussion view
                                  if (assignment.isDiscussion) {
                                    navigate(`/courses/${id}/threads/${assignment._id}`);
                                  } else {
                                    navigate(`/assignments/${assignment._id}/view`);
                                  }
                                }
                              };

                              return (
                                <td
                                  key={`${student._id}-${assignment._id}-${assIdx}`}
                                  className={`px-4 py-4 text-center whitespace-nowrap relative ${rowBg} ${cellBg} transition-all duration-150 ${hasSubmission || assignment.published || assignment.isOfflineAssignment ? 'cursor-pointer' : ''}`}
                                  onClick={handleCellClick}
                                >
                                  {editingGrade?.studentId === student._id && editingGrade?.assignmentId === assignment._id ? (
                                    <div className="relative">
                                      <input
                                        type="number"
                                        id={`grade-input-${student._id}-${assignment._id}`}
                                        name={`grade-${student._id}-${assignment._id}`}
                                        step="0.01"
                                        min="0"
                                        max={assignment.questions?.reduce((sum: number, q: any) => sum + (q.points || 0), 0) || assignment.totalPoints || 0}
                                        value={editingValue}
                                        onChange={(e) => setEditingValue(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleGradeUpdate(student._id, assignment._id, editingValue);
                                          } else if (e.key === 'Escape') {
                                            setEditingGrade(null);
                                            setGradeError('');
                                          }
                                        }}
                                        className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        autoFocus
                                      />
                                    </div>
                                  ) : (
                                    <div
                                      className={`${(isInstructor || isAdmin) && hasSubmission ? 'cursor-pointer hover:scale-105 transform transition-transform duration-150' : ''} ${savingGrade?.studentId === student._id && savingGrade?.assignmentId === assignment._id ? 'opacity-50' : ''}`}
                                    >
                                      {savingGrade?.studentId === student._id && savingGrade?.assignmentId === assignment._id ? (
                                        <div className="inline-flex items-center">
                                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                          </svg>
                                          Saving...
                                        </div>
                                      ) : null}
                                      {cellContent}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                            {/* Sticky last column body */}
                            <td className={`px-6 py-4 border-l border-gray-200 dark:border-gray-600 text-center font-semibold whitespace-nowrap sticky right-0 z-40 ${rowBg} transition-colors duration-150`} style={{right: 0, zIndex: 40, boxShadow: '-2px 0 8px -4px rgba(0,0,0,0.1)'}}>
                              {(course.groups && course.groups.length > 0) ? (
                                <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold ${gradeColor} bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-600`}>
                                  {Number(weightedPercent).toFixed(2)}% ({letter})
                                </div>
                              ) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Right edge gradient for scroll cue */}
                <div className="pointer-events-none absolute top-0 right-0 h-full w-12 bg-gradient-to-l from-gray-50 dark:from-gray-800 to-transparent" style={{zIndex: 10}} />
              </div>
              {(!students.length || !assignments.length) && (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No data available</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">No students or assignments found.</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {(isInstructor || isAdmin) && (
              <div className="flex justify-end space-x-4">
                <div className="flex space-x-3">
                  <button
                    className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    onClick={exportGradebookCSV}
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export CSV
                  </button>
                  <button
                    className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    onClick={handleOpenGradeScaleModal}
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Grade Scale
                  </button>
                </div>
              </div>
            )}
            {/* Assignment Group Weights Display & Edit Button */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden mt-6">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="bg-blue-100 dark:bg-blue-900 rounded-lg p-2">
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Assignment Weights</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Configure how different assignment types contribute to final grades</p>
                    </div>
                  </div>
                  {(isInstructor || isAdmin) && (
                    <button
                      onClick={handleOpenGroupModal}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2 shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>Edit Groups</span>
                    </button>
                  )}
                </div>
              </div>
              
              <div className="p-6">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-100 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Assignment Group</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Weight</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                      {(course.groups || []).map((group: any, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">{group.name}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-gray-100 text-right">{group.weight}%</td>
                        </tr>
                      ))}
                      <tr className="bg-blue-50 dark:bg-blue-900/20 border-t-2 border-blue-200 dark:border-blue-700">
                        <td className="px-6 py-4 text-sm font-bold text-blue-900 dark:text-blue-100">Total</td>
                        <td className="px-6 py-4 text-sm font-bold text-blue-900 dark:text-blue-100 text-right">{(course.groups || []).reduce((sum: number, g: any) => sum + Number(g.weight), 0)}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            {showGroupModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 w-full max-w-2xl relative">
                  <h2 className="text-xl font-bold mb-4">Edit Assignment Groups</h2>
                  <table className="min-w-full mb-4">
                    <thead>
                      <tr>
                        <th className="px-2 py-1 text-left">Group Name</th>
                        <th className="px-2 py-1 text-left">Weight (%)</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {editGroups.map((row, idx) => (
                        <tr key={idx}>
                          <td className="px-2 py-1">
                            <input
                              type="text"
                              id={`group-name-${idx}`}
                              name={`groupName-${idx}`}
                              value={row.name}
                              onChange={e => handleGroupChange(idx, 'name', e.target.value)}
                              className="border rounded px-2 py-1 w-32"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="number"
                              id={`group-weight-${idx}`}
                              name={`groupWeight-${idx}`}
                              value={row.weight}
                              onChange={e => handleGroupChange(idx, 'weight', Number(e.target.value))}
                              className="border rounded px-2 py-1 w-20"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <button
                              className="text-red-500 hover:text-red-700"
                              onClick={() => handleRemoveGroupRow(idx)}
                              title="Remove row"
                            >
                              &times;
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button
                    className="mb-4 px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                    onClick={handleAddGroupRow}
                  >
                    + Add Group
                  </button>
                  <button
                    className="mb-4 ml-2 px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    onClick={handleResetToDefaults}
                  >
                    Reset to Defaults
                  </button>
                  {groupError && <div className="text-red-600 mb-2">{groupError}</div>}
                  <div className="flex justify-end gap-2">
                    <button
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      onClick={() => setShowGroupModal(false)}
                      disabled={savingGroups}
                    >
                      Cancel
                    </button>
                    <button
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      onClick={handleSaveGroups}
                      disabled={savingGroups}
                    >
                      {savingGroups ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* Grade Scale Modal */}
            {showGradeScaleModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 w-full max-w-2xl relative">
                  <h2 className="text-xl font-bold mb-4">Edit Grade Scale</h2>
                  <table className="min-w-full mb-4">
                    <thead>
                      <tr>
                        <th className="px-2 py-1 text-left">Letter</th>
                        <th className="px-2 py-1 text-left">Min %</th>
                        <th className="px-2 py-1 text-left">Max %</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {editGradeScale.map((row, idx) => (
                        <tr key={idx}>
                          <td className="px-2 py-1">
                            <input
                              type="text"
                              id={`grade-letter-${idx}`}
                              name={`gradeLetter-${idx}`}
                              value={row.letter}
                              onChange={e => handleGradeScaleChange(idx, 'letter', e.target.value)}
                              className="border rounded px-2 py-1 w-16"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="number"
                              id={`grade-min-${idx}`}
                              name={`gradeMin-${idx}`}
                              value={row.min}
                              onChange={e => handleGradeScaleChange(idx, 'min', Number(e.target.value))}
                              className="border rounded px-2 py-1 w-20"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="number"
                              id={`grade-max-${idx}`}
                              name={`gradeMax-${idx}`}
                              value={row.max}
                              onChange={e => handleGradeScaleChange(idx, 'max', Number(e.target.value))}
                              className="border rounded px-2 py-1 w-20"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <button
                              className="text-red-500 hover:text-red-700"
                              onClick={() => handleRemoveGradeScaleRow(idx)}
                              title="Remove row"
                            >
                              &times;
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button
                    className="mb-4 px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                    onClick={() => {
                      if (editGradeScale.length === 0) {
                        setEditGradeScale([
                          { letter: 'A', min: 94, max: 100 },
                          { letter: 'A-', min: 90, max: 93 },
                          { letter: 'B+', min: 87, max: 89 },
                          { letter: 'B', min: 84, max: 86 },
                          { letter: 'B-', min: 80, max: 83 },
                          { letter: 'C+', min: 77, max: 79 },
                          { letter: 'C', min: 74, max: 76 },
                          { letter: 'D', min: 64, max: 73 },
                          { letter: 'F', min: 0, max: 63 }
                        ]);
                        setGradeScaleError('Auto-filled with default scale.');
                        return;
                      }
                      // Sort by min descending
                      const sorted = [...editGradeScale].sort((a, b) => b.min - a.min);
                      if (sorted.length > 0) {
                        sorted[0].max = 100;
                        for (let i = 1; i < sorted.length; i++) {
                          sorted[i].max = sorted[i - 1].min - 1;
                        }
                      }
                      setEditGradeScale(sorted);
                      setGradeScaleError('Auto-fixed scale for contiguous whole numbers.');
                    }}
                  >
                    Auto-Fix
                  </button>
                  {gradeScaleError && <div className="text-red-600 mb-2">{gradeScaleError}</div>}
                  <div className="flex justify-end gap-2">
                    <button
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      onClick={() => setShowGradeScaleModal(false)}
                      disabled={savingGradeScale}
                    >
                      Cancel
                    </button>
                    <button
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      onClick={handleSaveGradeScale}
                      disabled={savingGradeScale}
                    >
                      {savingGradeScale ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'students':
        return (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Student Management</h2>
              

              
              {/* Student Search Section */}
              {(isInstructor || isAdmin) && (
                <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">Add Students</h3>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search for students by name or email..."
                      value={searchQuery}
                      onChange={handleSearchChange}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                    />
                    {isSearching && (
                      <div className="absolute right-3 top-2">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      </div>
                    )}
                  </div>
                  
                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Search Results</h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {searchResults.map((student: any, idx: number) => (
                          <div key={`search-${student._id}-${idx}`} className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-sm font-semibold text-blue-600 dark:text-blue-300">
                                {student.firstName && student.lastName
                                  ? `${student.firstName[0]}${student.lastName[0]}`.toUpperCase()
                                  : 'U'}
                              </div>
                              <div>
                                <div className="font-medium text-gray-900 dark:text-gray-100">
                                  {student.firstName} {student.lastName}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  {student.email}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => handleEnroll(student._id)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                            >
                              Add
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                                {/* Search Error */}
              {searchError && (
                <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                  {searchError}
                </div>
              )}
            </div>
          )}
          
          {/* Waitlisted Students - NEW SECTION */}
          {(isInstructor || isAdmin) && (
            <div className="mb-8 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-700">
              <h3 className="text-lg font-semibold mb-4 text-orange-800 dark:text-orange-200">
                Waitlisted Students - Pending Approval ({course.enrollmentRequests?.filter((req: any) => req.status === 'waitlisted').length || 0})
              </h3>
              {course.catalog?.maxStudents && course.students.length >= course.catalog.maxStudents && (
                <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-600 rounded text-sm text-blue-700 dark:text-blue-300">
                  💡 <strong>Note:</strong> As a teacher, you can approve waitlisted students to enroll them in the course, even when it's full. You can also override capacity by enrolling students directly.
                </div>
              )}
              {(!course.enrollmentRequests || course.enrollmentRequests.filter((req: any) => req.status === 'waitlisted').length === 0) ? (
                <div className="text-center text-orange-700 dark:text-orange-300 py-4">
                  No waitlisted students at this time.
                </div>
              ) : (
                <div className="space-y-3">
                  {course.enrollmentRequests
                    .filter((req: any) => req.status === 'waitlisted')
                    .map((request: any, idx: number) => {
                      const waitlistPosition = course.waitlist?.find((entry: any) => entry.student._id === request.student._id)?.position;
                      
                      return (
                        <div key={`waitlist-${request._id}-${idx}`} className="flex items-center justify-between p-3 rounded-lg border bg-orange-100 dark:bg-orange-800/30 border-orange-300 dark:border-orange-600">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-orange-200 dark:bg-orange-700">
                              {request.student.profilePicture ? (
                                <img 
                                  src={request.student.profilePicture.startsWith('http')
                                    ? request.student.profilePicture
                                    : getImageUrl(request.student.profilePicture)}
                                  alt={`${request.student.firstName} ${request.student.lastName}`}
                                  className="w-10 h-10 rounded-full object-cover"
                                />
                              ) : (
                                <span className="font-medium text-orange-700 dark:text-orange-200">
                                  {request.student.firstName.charAt(0)}{request.student.lastName.charAt(0)}
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-800 dark:text-gray-200">
                                {request.student.firstName} {request.student.lastName} wants to join
                                {waitlistPosition && (
                                  <span className="ml-2 text-sm text-orange-600 dark:text-orange-400 font-normal">
                                    (Waitlist Position {waitlistPosition})
                                  </span>
                                )}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                Waitlisted on {new Date(request.requestDate).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleApproveEnrollment(request.student._id)}
                              className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors font-medium"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleDenyEnrollment(request.student._id)}
                              className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors font-medium"
                            >
                              Deny
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}
          
          {/* Instructor FIRST */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-100">Instructor</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <StudentCard
                    key={course.instructor._id || 'instructor'}
                    student={course.instructor}
                    isInstructor={true}
                    isAdmin={isAdmin}
                    handleUnenroll={null}
                    isInstructorCard={true}
                  />
                </div>
              </div>
              
              {/* Enrolled Students SECOND */}
              <div>
                <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-100">
                  Enrolled Students ({course.students.length})
                  {course.catalog?.maxStudents && course.students.length > course.catalog.maxStudents && (
                    <span className="ml-2 text-sm text-orange-600 dark:text-orange-400 font-normal">
                      (Over Capacity: {course.students.length}/{course.catalog.maxStudents})
                    </span>
                  )}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {course.students.map((student: any, idx: number) => (
                    <StudentCard
                      key={`student-card-${student._id}-${idx}`}
                      student={student}
                      isInstructor={isInstructor}
                      isAdmin={isAdmin}
                      handleUnenroll={handleUnenroll}
                    />
                  ))}
                </div>
                {course.students.length === 0 && (
                  <p className="text-gray-500 dark:text-gray-400">No students enrolled yet</p>
                )}
              </div>
            </div>
          </div>
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
                    className="fixed bottom-8 right-8 z-50 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg hover:bg-blue-700 text-lg font-bold flex items-center gap-2"
                    onClick={() => setShowAnnouncementModal(true)}
                  >
                    + Announcement
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
    <div className="flex w-full max-w-7xl mx-auto">
      {/* Modern Sidebar */}
      <aside className="w-64 mr-8 mt-4 self-start sticky top-4 h-fit">
        <nav className="bg-white/80 dark:bg-gray-900/80 backdrop-blur rounded-2xl shadow-lg p-4 flex flex-col gap-1 border border-gray-100 dark:border-gray-700">
          {filteredNavigationItems.map((item: any) => (
            <button
              key={item.id}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors font-medium text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-700 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 ${activeSection === item.id ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold shadow' : ''}`}
              onClick={() => navigate(`/courses/${id}/${item.id}`)}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-base">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">
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
    </div>
  );
};

const AssignmentCard: React.FC<{
  assignment: any;
  isInstructor: boolean;
  isAdmin: boolean;
  navigate: (path: string) => void;
}> = ({ assignment, isInstructor, isAdmin, navigate }) => {
  const totalPoints = assignment.questions?.reduce((sum: number, q: any) => sum + (q.points || 0), 0) || assignment.totalPoints || 0;
  // Ensure dueDate is a Date object
  const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1 line-clamp-2">
              {assignment.title}
            </h3>
            <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 rounded-full">
              {assignment.moduleTitle}
            </span>
          </div>
          {assignment.group && (
            <span className="ml-2 px-2 py-1 text-xs font-medium bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 rounded-full">
              {assignment.group}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
          {assignment.description}
        </p>
        <div className="space-y-2 mb-4">
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className={assignment.isOverdue ? "text-red-600 dark:text-red-400 font-medium" : ""}>
              Due: {dueDate ? `${dueDate.toLocaleDateString()} at ${dueDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : 'No due date'}
            </span>
          </div>
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>Points: {totalPoints}</span>
          </div>
          {assignment.hasSubmission && (
            <div className="flex items-center text-sm text-green-600 dark:text-green-400">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>Submitted</span>
            </div>
          )}
        </div>
        <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={() => navigate(`/assignments/${assignment._id}/view`)}
            className="flex-1 px-3 py-2 bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/70 transition-colors text-sm font-medium"
          >
            View
          </button>
          {(isInstructor || isAdmin) && (
            <button
              onClick={() => navigate(`/assignments/${assignment._id}/grade`)}
              className="flex-1 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/50 text-yellow-600 dark:text-yellow-400 rounded-md hover:bg-yellow-100 dark:hover:bg-yellow-900/70 transition-colors text-sm font-medium"
            >
              Grade
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export { AssignmentCard };
export default CourseDetail; 