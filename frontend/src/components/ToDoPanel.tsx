import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import api, { getUserPreferences } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCourse } from '../contexts/CourseContext';
import { startOfWeek, endOfWeek, isWithinInterval, parseISO, format, isToday, isTomorrow } from 'date-fns';
import { 
  FileText, 
  Rocket, 
  MessageSquare, 
  BookOpen, 
  Calendar, 
  ChevronRight,
  ClipboardList,
  CheckSquare
} from 'lucide-react';
import { useMobileDevice } from '../hooks/useMobileDevice';

export const ToDoPanel: React.FC = () => {
  const { user } = useAuth();
  const { courses } = useCourse();
  const navigate = useNavigate();
  const isMobileDevice = useMobileDevice();
  const [todoAssignments, setTodoAssignments] = useState<any[]>([]);
  const [todoLoading, setTodoLoading] = useState(false);
  const [todoError, setTodoError] = useState<string | null>(null);
  const [personalTodos, setPersonalTodos] = useState<any[]>([]);
  const [personalLoading, setPersonalLoading] = useState(false);
  const [personalError, setPersonalError] = useState<string | null>(null);
  const [studentDueItems, setStudentDueItems] = useState<any[]>([]);
  const [studentDueLoading, setStudentDueLoading] = useState(false);
  const [studentDueError, setStudentDueError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const isTeacherOrAdmin = user?.role === 'teacher' || user?.role === 'admin';

  // Get user course colors from preferences
  const [userCourseColors, setUserCourseColors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const fetchUserPreferences = async () => {
      try {
        const res = await getUserPreferences();
        if (res.data?.preferences?.courseColors) {
          setUserCourseColors(res.data.preferences.courseColors);
        }
      } catch (err) {
        // Ignore errors
      }
    };
    fetchUserPreferences();
  }, []);

  useEffect(() => {
    if (isTeacherOrAdmin) {
      const fetchTodo = async () => {
        setTodoLoading(true);
        setTodoError(null);
        try {
          const res = await api.get('/assignments/todo/ungraded');
          setTodoAssignments(Array.isArray(res.data) ? res.data : []);
        } catch (err: any) {
          setTodoError('Failed to load To-Do assignments');
          setTodoAssignments([]);
        } finally {
          setTodoLoading(false);
        }
      };
      fetchTodo();
    } else {
      // Student: fetch all items due this week (assignments + discussions)
      const fetchStudentDue = async () => {
        setStudentDueLoading(true);
        setStudentDueError(null);
        try {
          const res = await api.get('/assignments/todo/due-all');
          setStudentDueItems(Array.isArray(res.data) ? res.data : []);
        } catch (err: any) {
          setStudentDueError('Failed to load items due this week');
          setStudentDueItems([]);
        } finally {
          setStudentDueLoading(false);
        }
      };
      fetchStudentDue();
    }
  }, [isTeacherOrAdmin, refreshKey]);

  useEffect(() => {
    const fetchPersonalTodos = async () => {
      setPersonalLoading(true);
      setPersonalError(null);
      try {
        const res = await api.get('/todos');
        setPersonalTodos(Array.isArray(res.data) ? res.data : []);
      } catch (err: any) {
        setPersonalError('Failed to load personal to-dos');
        setPersonalTodos([]);
      } finally {
        setPersonalLoading(false);
      }
    };
    fetchPersonalTodos();
  }, []);

  // Listen for assignment submission events to refresh the ToDo panel
  useEffect(() => {
    const handleAssignmentSubmitted = () => {
      setTimeout(() => {
        refreshToDo();
      }, 500);
    };

    window.addEventListener('assignmentSubmitted', handleAssignmentSubmitted);
    return () => {
      window.removeEventListener('assignmentSubmitted', handleAssignmentSubmitted);
    };
  }, []);

  const handleMarkDone = async (id: string) => {
    await api.delete(`/todos/${id}`);
    setPersonalTodos(todos => todos.filter((t: any) => t._id !== id));
  };

  const handleEnrollmentNotificationClick = async (todo: any) => {
    try {
      await api.delete(`/todos/${todo._id}`);
      setPersonalTodos(todos => todos.filter((t: any) => t._id !== todo._id));
      window.location.href = `/courses/${todo.courseId}/students`;
    } catch (err) {
    }
  };

  const refreshToDo = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Filter personalTodos to only show those due this week (Monday to Sunday)
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const personalTodosThisWeek = personalTodos.filter(todo => {
    if (!todo.dueDate) return false;
    const due = typeof todo.dueDate === 'string' ? parseISO(todo.dueDate) : new Date(todo.dueDate);
    return isWithinInterval(due, { start: weekStart, end: weekEnd });
  });

  const enrollmentRequests = personalTodosThisWeek.filter(todo => todo.type === 'enrollment_request' && todo.action === 'pending');
  const enrollmentSummaries = personalTodosThisWeek.filter(todo => todo.type === 'enrollment_summary');
  const waitlistPromotions = personalTodosThisWeek.filter(todo => todo.type === 'waitlist_promotion');
  const regularTodos = personalTodosThisWeek.filter(todo => todo.type !== 'enrollment_request' && todo.type !== 'enrollment_summary' && todo.type !== 'waitlist_promotion');

  // Get course color
  const getCourseColor = (courseId: string) => {
    if (!courseId) return '#556B2F';
    const course = courses.find(c => c._id === courseId);
    if (isTeacherOrAdmin) {
      return course?.defaultColor || '#556B2F';
    } else {
      if (userCourseColors[courseId]) {
        return userCourseColors[courseId];
      }
      return course?.defaultColor || '#556B2F';
    }
  };

  // Get course name/code
  const getCourseName = (courseId: string) => {
    if (!courseId) return 'Unknown Course';
    const course = courses.find(c => c._id === courseId);
    return course?.catalog?.courseCode || course?.title || 'Unknown Course';
  };

  // Format due date
  const formatDueDate = (dueDate: string | Date) => {
    if (!dueDate) return '';
    const date = typeof dueDate === 'string' ? parseISO(dueDate) : new Date(dueDate);
    const timeStr = format(date, 'h:mm a');
    
    if (isToday(date)) {
      return `Due Today at ${timeStr}`;
    } else if (isTomorrow(date)) {
      return `Due Tomorrow at ${timeStr}`;
    } else {
      return `Due ${format(date, 'EEEE, MMMM d, yyyy')} at ${timeStr}`;
    }
  };

  // Get icon for task type
  const getTaskIcon = (type: string, itemType?: string) => {
    const typeLower = (itemType || type || '').toLowerCase();
    if (typeLower.includes('quiz')) return Rocket;
    if (typeLower.includes('discussion') || typeLower.includes('attendance')) return MessageSquare;
    if (typeLower.includes('lesson')) return BookOpen;
    if (typeLower.includes('meeting')) return Calendar;
    if (typeLower.includes('activity') || typeLower.includes('assignment')) return FileText;
    return ClipboardList;
  };

  // Combine all tasks for students
  const allStudentTasks = studentDueItems.map(item => ({
    ...item,
    courseId: item.course?._id || item.module?.course?._id,
    courseName: getCourseName(item.course?._id || item.module?.course?._id),
    taskType: item.itemType || item.type,
    icon: getTaskIcon(item.type, item.itemType),
    dueDate: item.dueDate,
    formattedDueDate: formatDueDate(item.dueDate),
    color: getCourseColor(item.course?._id || item.module?.course?._id),
    link: item.type === 'assignment' 
      ? `/assignments/${item._id}/view`
      : `/courses/${item.course?._id || item.module?.course?._id}/threads/${item._id}`
  })).sort((a, b) => {
    const dateA = new Date(a.dueDate).getTime();
    const dateB = new Date(b.dueDate).getTime();
    return dateA - dateB;
  });

  // Combine teacher tasks
  const allTeacherTasks = todoAssignments.map(item => ({
    ...item,
    courseId: item.course?._id,
    courseName: item.course?.catalog?.courseCode || item.course?.title || 'Unknown Course',
    taskType: 'Ungraded Assignment',
    icon: FileText,
    dueDate: null,
    formattedDueDate: `${item.ungradedCount} to grade`,
    color: getCourseColor(item.course?._id),
    link: `/assignments/${item.id}/grade`
  }));

  // Combine personal todos
  const allPersonalTasks = [
    ...enrollmentSummaries.map(todo => ({
      ...todo,
      courseId: todo.courseId,
      courseName: todo.courseName || 'Course',
      taskType: 'Enrollment Update',
      icon: CheckSquare,
      dueDate: todo.dueDate,
      formattedDueDate: formatDueDate(todo.dueDate),
      color: getCourseColor(todo.courseId),
      link: `/courses/${todo.courseId}/students`,
      onClick: () => handleEnrollmentNotificationClick(todo)
    })),
    ...waitlistPromotions.map(todo => ({
      ...todo,
      courseId: todo.courseId,
      courseName: todo.courseName || 'Course',
      taskType: 'Waitlist Promotion',
      icon: CheckSquare,
      dueDate: todo.dueDate,
      formattedDueDate: formatDueDate(todo.dueDate),
      color: getCourseColor(todo.courseId),
      link: `/courses/${todo.courseId}/students`,
      onClick: () => handleEnrollmentNotificationClick(todo)
    })),
    ...enrollmentRequests.map(todo => ({
      ...todo,
      courseId: todo.courseId,
      courseName: todo.courseName || 'Course',
      taskType: 'Enrollment Request',
      icon: CheckSquare,
      dueDate: todo.dueDate,
      formattedDueDate: formatDueDate(todo.dueDate),
      color: getCourseColor(todo.courseId),
      link: `/courses/${todo.courseId}/students`
    })),
    ...regularTodos.map(todo => ({
      ...todo,
      courseId: null,
      courseName: 'Personal',
      taskType: 'Personal Task',
      icon: ClipboardList,
      dueDate: todo.dueDate,
      formattedDueDate: formatDueDate(todo.dueDate),
      color: '#6B7280',
      link: null,
      isPersonal: true
    }))
  ].sort((a, b) => {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    const dateA = new Date(a.dueDate).getTime();
    const dateB = new Date(b.dueDate).getTime();
    return dateA - dateB;
  });

  // Combine all tasks
  const allTasks = isTeacherOrAdmin 
    ? [...allTeacherTasks, ...allPersonalTasks]
    : [...allStudentTasks, ...allPersonalTasks];

  const handleTaskClick = (task: any) => {
    if (task.onClick) {
      task.onClick();
    } else if (task.link) {
      navigate(task.link);
    } else if (task.isPersonal) {
      // Handle personal task click
    }
  };

  if (isMobileDevice) {
    return (
      <div className="w-full">
        {allTasks.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400 text-sm">
            No tasks to do
          </div>
        ) : (
          <div className="space-y-0">
            {allTasks.map((task, index) => {
              const IconComponent = task.icon;
              return (
                <div
                  key={task._id || task.id || index}
                  onClick={() => handleTaskClick(task)}
                  className="flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 active:bg-gray-50 dark:active:bg-gray-700/50 transition-colors cursor-pointer"
                >
                  {/* Icon */}
                  <div 
                    className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${task.color}20`, color: task.color }}
                  >
                    <IconComponent className="w-5 h-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span 
                        className="text-xs font-semibold"
                        style={{ color: task.color }}
                      >
                        {task.courseName}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-0.5 truncate">
                      {task.title}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {task.formattedDueDate}
                    </div>
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Desktop view (modern design matching mobile)
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 mb-4 sm:mb-6 border border-gray-200 dark:border-gray-700">
      <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-3">To Do</h2>
      
      {allTasks.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
          No tasks to do
        </div>
      ) : (
        <div className="space-y-0">
          {allTasks.map((task, index) => {
            const IconComponent = task.icon;
            return (
              <div
                key={task._id || task.id || index}
                onClick={() => handleTaskClick(task)}
                className="flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer rounded-lg mb-1 last:mb-0"
              >
                {/* Icon */}
                <div 
                  className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${task.color}20`, color: task.color }}
                >
                  <IconComponent className="w-5 h-5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span 
                      className="text-xs font-semibold"
                      style={{ color: task.color }}
                    >
                      {task.courseName}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-0.5">
                    {task.title}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {task.formattedDueDate}
                  </div>
                </div>

                {/* Arrow */}
                <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
