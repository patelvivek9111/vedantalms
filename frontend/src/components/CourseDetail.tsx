import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useCourse } from '../contexts/CourseContext';
import { useAuth } from '../context/AuthContext';
import { ModuleProvider } from '../contexts/ModuleContext';
import ModuleList from './ModuleList';
import CreateModuleForm from './CreateModuleForm';
import api from '../services/api';
import { API_URL } from '../config';
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
  Settings
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
import LatestAnnouncements from './LatestAnnouncements';

// Navigation items for the left pane
const navigationItems = [
  { id: 'overview', label: 'Overview', icon: ClipboardList },
  { id: 'modules', label: 'Modules', icon: BookOpen },
  { id: 'pages', label: 'Pages', icon: FileText },
  { id: 'assignments', label: 'Assignments', icon: PenTool },
  { id: 'discussions', label: 'Discussions', icon: MessageSquare },
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
  { id: 'groups', label: 'Groups', icon: Users },
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
            : `http://localhost:5000${student.profilePicture}`}
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
        <div className="font-semibold text-lg text-gray-800">{student.firstName} {student.lastName}</div>
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
  const [showOverviewConfigModal, setShowOverviewConfigModal] = useState(false);

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
        const modulesResponse = await api.get(`${API_URL}/api/modules/${id}`, {
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
                return (res.data.data || []).filter((thread: any) => thread.isGraded);
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

  // Filter navigation items based on user role
  const filteredNavigationItems = navigationItems.filter(item => 
    !item.roles || item.roles.includes(user?.role || '')
  );

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
          const modulesResponse = await api.get(`${API_URL}/api/modules/${id}`, {
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

        setGradebookData({ 
          students, 
          assignments: [...allAssignments, ...groupAssignments, ...gradedDiscussions], 
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
          // Skip if assignment._id is missing or assignment.isDiscussion is true
          if (!assignment._id || assignment.isDiscussion) continue;
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
        
        // Add discussion grades to the grades object
        const discussionGrades = { ...newGrades };
        for (const discussion of studentDiscussions) {
          if (typeof discussion.grade === 'number') {
            if (!discussionGrades[String(user._id)]) discussionGrades[String(user._id)] = {};
            discussionGrades[String(user._id)][String(discussion._id)] = discussion.grade;
          }
        }
        
        setGradebookData((prev: any) => ({ ...prev, grades: discussionGrades }));
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

        setGradebookData({ 
          students, 
          assignments: [...allAssignments, ...groupAssignments, ...gradedDiscussions], 
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
      const baseUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';
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
    
    if (!submissionId) {
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
        const res = await axios.post(
          `${API_URL}/api/submissions/${submissionId}/grade`,
          { grade: null },  // Send null to remove the grade
          { headers: { Authorization: `Bearer ${token}` } }
        );

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

    // Find assignment to get max points
    const assignment = gradebookData.assignments.find((a: any) => a._id === assignmentId);
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
      const res = await axios.post(
        `${API_URL}/api/submissions/${submissionId}/grade`,
        { grade: gradeNum },
        { headers: { Authorization: `Bearer ${token}` } }
      );

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

  // Handler to open group modal
  const handleOpenGroupModal = () => {
    setEditGroups(course?.groups ? [...course.groups] : []);
    setShowGroupModal(true);
    setGroupError('');
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
      const baseUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';
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
              <div className="bg-red-100 text-red-700 px-4 py-2 rounded mb-2 font-medium border border-red-200">
                {publishError}
              </div>
            )}
            {/* Course Header */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-6 flex flex-col md:flex-row justify-between items-start md:items-center mb-4 border border-gray-200 dark:border-gray-700">
                <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-1">{course.title}</h1>
                <p className="text-gray-500 mb-2">{course.description}</p>
                <div className="text-sm text-gray-600">
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
                      className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-opacity-50 ${course.published ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'} ${publishingCourse ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                <div className="flex-1 bg-blue-50 rounded-xl p-6 text-center shadow">
                  <div className="text-lg font-semibold text-blue-800">Students</div>
                  <div className="text-3xl font-bold text-blue-900">{course.students?.length || 0}</div>
              </div>
                <div className="flex-1 bg-green-50 rounded-xl p-6 text-center shadow">
                  <div className="text-lg font-semibold text-green-800">Modules</div>
                  <div className="text-3xl font-bold text-green-900">{modules.length}</div>
            </div>
                <div className="flex-1 bg-purple-50 rounded-xl p-6 text-center shadow">
                  <div className="text-lg font-semibold text-purple-800">Assignments</div>
                  <div className="text-3xl font-bold text-purple-900">{modules.reduce((acc, m) => acc + (m.assignments?.length || 0), 0)}</div>
                </div>
              </div>
            )}

            {/* Quick Actions (teachers/admins only) */}
            {(isInstructor || isAdmin) && (
              <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-6 border border-gray-200 dark:border-gray-700">
                <div className="font-semibold mb-4">Quick Actions</div>
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

      case 'modules':
        return (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Course Modules</h2>
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
        // Combine assignments, group assignments, and discussions
        const combinedList = [
          ...allAssignments,
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
        return (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Assignments</h2>
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
                <AssignmentList assignments={combinedList} userRole={user?.role} studentSubmissions={user?.role === 'student' ? studentSubmissions : undefined} studentId={user?._id} submissionMap={user?.role === 'student' ? submissionMap : undefined} courseId={course?._id} />
              ) : (
                <div className="text-center text-gray-500 py-8">No modules available. Please create a module to add assignments.</div>
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
                      {studentAssignments.map((assignment: any) => {
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
                          <tr key={assignment._id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150">
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
          // Use the new function that ignores groups with no grades
          return calculateFinalGradeWithWeightedGroups(
            student._id,
            course,
            assignments,
            grades
          );
        }
        return (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Gradebook</h2>
              </div>
              <div className="relative w-full">
                <div className="overflow-x-auto w-full relative">
                  <table className="min-w-max border border-gray-300 dark:border-gray-700">
                    <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0 z-10">
                      <tr>
                        {/* Sticky first column header */}
                        <th className="px-4 py-2 border-b border-r border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-left text-gray-900 dark:text-gray-100 sticky left-0 z-50" style={{left: 0, zIndex: 50, boxShadow: '2px 0 4px -2px #d1d5db'}}>Student Name</th>
                        {assignments.map((assignment: any) => (
                          <th
                            key={assignment._id}
                            className="px-4 py-2 border-b border-r border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-center text-gray-900 dark:text-gray-100"
                          >
                            <div className="font-medium text-blue-700 cursor-pointer hover:underline text-center">{assignment.title}</div>
                            <div className="text-xs text-gray-500 text-center">{assignment.group ? assignment.group : 'Ungrouped'}</div>
                            <div className="text-xs text-gray-500 text-center">Out of {assignment.questions?.reduce((sum: number, q: any) => sum + (q.points || 0), 0) || assignment.totalPoints || 0}</div>
                          </th>
                        ))}
                        {/* Sticky last column header */}
                        <th className="px-4 py-2 border-b border-l border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-center text-gray-900 dark:text-gray-100 sticky right-0 z-50" style={{right: 0, zIndex: 50, boxShadow: '-2px 0 4px -2px #d1d5db'}}>Overall Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student: any, rowIdx: number) => {
                        // Calculate weighted grade
                        const weightedPercent = getWeightedGrade(student);
                        const letter = getLetterGrade(weightedPercent, course?.gradeScale);
                        const rowBg = rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                        const stickyBg = rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                        return (
                          <tr
                            key={student._id}
                            className={rowBg}
                          >
                            {/* Sticky first column body */}
                            <td className={`px-4 py-2 border-b border-r border-gray-300 dark:border-gray-700 text-blue-700 dark:text-blue-300 hover:underline cursor-pointer font-medium whitespace-nowrap sticky left-0 z-40 ${stickyBg}`} style={{left: 0, zIndex: 40, boxShadow: '2px 0 4px -2px #d1d5db'}}>{student.firstName} {student.lastName}</td>
                            {assignments.map((assignment: any) => {
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
                              if (!assignment.isDiscussion && !assignment.published) {
                                // Not published
                                cellContent = <span className="text-gray-500 italic">Not Published</span>;
                              } else if (typeof grade === 'number') {
                                // If graded, show the grade
                                cellContent = grade;
                              } else if (hasSubmission) {
                                if (dueDate && submittedAt && submittedAt.getTime() > dueDate.getTime()) {
                                  // Submitted late
                                  cellContent = <span className="text-orange-600 italic">Late</span>;
                                } else {
                                  // Submitted but not graded
                                  cellContent = <span className="text-blue-600 italic">Not Graded</span>;
                                }
                              } else if (dueDate && now.getTime() > dueDate.getTime()) {
                                // Missing after due date
                                cellContent = (
                                  <>
                                    <span className="font-normal">0</span>
                                    <span className="text-red-600 italic ml-1">(MA)</span>
                                  </>
                                );
                              } else {
                                // Not submitted yet, due date not passed
                                cellContent = <span className="text-gray-500 italic">No Submission</span>;
                              }

                              return (
                                <td
                                  key={assignment._id}
                                  className={`px-4 py-2 border-b border-r border-gray-300 dark:border-gray-700 text-center whitespace-nowrap relative text-gray-900 dark:text-gray-100 ${rowIdx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}`}
                                  onClick={() => {
                                    if ((isInstructor || isAdmin) && hasSubmission) {
                                      handleGradeCellClick(student._id, assignment._id, grade?.toString() || '');
                                    }
                                  }}
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
                                        className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                                        autoFocus
                                      />
                                    </div>
                                  ) : (
                                    <div
                                      className={`px-2 py-1 rounded ${(isInstructor || isAdmin) && hasSubmission ? 'cursor-pointer hover:bg-blue-50' : ''} ${savingGrade?.studentId === student._id && savingGrade?.assignmentId === assignment._id ? 'opacity-50' : ''}`}
                                    >
                                      {savingGrade?.studentId === student._id && savingGrade?.assignmentId === assignment._id ? (
                                        <span className="inline-block animate-spin mr-1">⟳</span>
                                      ) : null}
                                      {cellContent}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                            {/* Sticky last column body */}
                            <td className={`px-4 py-2 border-b border-l border-gray-300 dark:border-gray-700 text-center font-semibold whitespace-nowrap sticky right-0 z-40 ${rowIdx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}`} style={{right: 0, zIndex: 40, boxShadow: '-2px 0 4px -2px #d1d5db'}}>{(course.groups && course.groups.length > 0) ? <span className="font-bold">{Number(weightedPercent).toFixed(2)}% ({letter})</span> : '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Right edge gradient for scroll cue */}
                <div className="pointer-events-none absolute top-0 right-0 h-full w-8 bg-gradient-to-l from-gray-100 to-transparent" style={{zIndex: 10}} />
              </div>
              {(!students.length || !assignments.length) && (
                <div className="mt-4 text-gray-500 text-sm">No students or assignments found.</div>
              )}
              {(isInstructor || isAdmin) && (
                <div className="mb-4 flex justify-end">
                  <button
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    onClick={handleOpenGradeScaleModal}
                  >
                    Edit Grade Scale
                  </button>
                </div>
              )}
            </div>
            {/* Assignment Group Weights Display & Edit Button (moved to bottom) */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 mt-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Assignment Group Weights</h3>
                  <table className="min-w-max border border-gray-300 dark:border-gray-700 mb-2">
                    <thead className="bg-gray-100 dark:bg-gray-800">
                      <tr>
                        <th className="px-4 py-2 border-b border-r border-gray-300 dark:border-gray-700 text-left text-gray-900 dark:text-gray-100">Group</th>
                        <th className="px-4 py-2 border-b border-gray-300 dark:border-gray-700 text-left text-gray-900 dark:text-gray-100">Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(course.groups || []).map((group: any, idx: number) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 border-b border-r border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{group.name}</td>
                          <td className="px-4 py-2 border-b border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{group.weight}%</td>
                        </tr>
                      ))}
                      <tr>
                        <td className="px-4 py-2 font-bold border-r border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">Total</td>
                        <td className="px-4 py-2 font-bold border-r border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100">{(course.groups || []).reduce((sum: number, g: any) => sum + Number(g.weight), 0)}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {(isInstructor || isAdmin) && (
                  <button
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    onClick={handleOpenGroupModal}
                  >
                    Edit Assignment Groups
                  </button>
                )}
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
                        {searchResults.map((student: any) => (
                          <div key={student._id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
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
                <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-100">Enrolled Students ({course.students.length})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {course.students.map((student: any) => (
                    <StudentCard
                      key={student._id}
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

      default:
        return null;
    }
  };

  return (
    <div className="flex w-full max-w-7xl mx-auto">
      {/* Modern Sidebar */}
      <aside className="w-64 mr-8 mt-4">
        <nav className="bg-white/80 dark:bg-gray-900/80 backdrop-blur rounded-2xl shadow-lg p-4 flex flex-col gap-1 border border-gray-100 dark:border-gray-700">
          {filteredNavigationItems.map(item => (
            <button
              key={item.id}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200 ${activeSection === item.id ? 'bg-blue-100 text-blue-700 font-semibold shadow' : ''}`}
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
            <h3 className="text-lg font-semibold text-gray-800 mb-1 line-clamp-2">
              {assignment.title}
            </h3>
            <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
              {assignment.moduleTitle}
            </span>
          </div>
          {assignment.group && (
            <span className="ml-2 px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
              {assignment.group}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {assignment.description}
        </p>
        <div className="space-y-2 mb-4">
          <div className="flex items-center text-sm text-gray-600">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className={assignment.isOverdue ? "text-red-600 font-medium" : ""}>
              Due: {dueDate ? `${dueDate.toLocaleDateString()} at ${dueDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : 'No due date'}
            </span>
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>Points: {totalPoints}</span>
          </div>
          {assignment.hasSubmission && (
            <div className="flex items-center text-sm text-green-600">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>Submitted</span>
            </div>
          )}
        </div>
        <div className="flex gap-2 pt-3 border-t border-gray-100">
          <button
            onClick={() => navigate(`/assignments/${assignment._id}/view`)}
            className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors text-sm font-medium"
          >
            View
          </button>
          {(isInstructor || isAdmin) && (
            <button
              onClick={() => navigate(`/assignments/${assignment._id}/grade`)}
              className="flex-1 px-3 py-2 bg-yellow-50 text-yellow-600 rounded-md hover:bg-yellow-100 transition-colors text-sm font-medium"
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