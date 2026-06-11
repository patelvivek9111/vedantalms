import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useUserPreferencesQuery } from '../../hooks/useUserPreferencesQuery';
import { useAuth } from '../../contexts/AuthContext';
import { useCourse } from '../../contexts/CourseContext';
import { startOfWeek, endOfWeek, isWithinInterval, parseISO, format, isToday, isTomorrow } from 'date-fns';
import { 
  FileText, 
  Rocket, 
  MessageSquare, 
  BookOpen, 
  Calendar, 
  ChevronRight,
  ClipboardList,
  CheckSquare,
  CircleCheckBig,
  Clock,
  X,
} from 'lucide-react';
import { useMobileDevice } from '../../hooks/useMobileDevice';
import {
  dismissPlannerItem,
  fetchPlannerFeed,
  isPlannerUxEnabled,
  snoozePlannerItem,
} from '../../services/plannerUxService';

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
  const [plannerFeedItems, setPlannerFeedItems] = useState<any[]>([]);
  const [plannerFeedLoading, setPlannerFeedLoading] = useState(false);

  const isTeacherOrAdmin = user?.role === 'teacher' || user?.role === 'admin';
  const plannerUxOn = isPlannerUxEnabled();

  const { data: preferences } = useUserPreferencesQuery(Boolean(user?._id));
  const userCourseColors = preferences?.courseColors || {};

  useEffect(() => {
    if (!plannerUxOn) return undefined;

    const loadPlannerFeed = async () => {
      setPlannerFeedLoading(true);
      try {
        const { items } = await fetchPlannerFeed();
        setPlannerFeedItems(Array.isArray(items) ? items : []);
      } catch {
        setPlannerFeedItems([]);
      } finally {
        setPlannerFeedLoading(false);
      }
    };

    loadPlannerFeed();
    return undefined;
  }, [plannerUxOn, refreshKey]);

  useEffect(() => {
    if (plannerUxOn) return undefined;

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
  }, [isTeacherOrAdmin, refreshKey, plannerUxOn]);

  useEffect(() => {
    if (plannerUxOn) return undefined;

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
    return undefined;
  }, [plannerUxOn]);

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
    setRefreshKey((prev) => prev + 1);
  };

  const handleDismissPlannerItem = async (itemKey: string) => {
    try {
      await dismissPlannerItem(itemKey);
      refreshToDo();
    } catch {
      /* ignore */
    }
  };

  const handleSnoozePlannerItem = async (itemKey: string) => {
    try {
      await snoozePlannerItem(itemKey, 24);
      refreshToDo();
    } catch {
      /* ignore */
    }
  };

  const renderPlannerUxActions = (task: any) => {
    if (!plannerUxOn || !task.plannerItemKey) return null;
    return (
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleSnoozePlannerItem(task.plannerItemKey);
          }}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400"
          title="Snooze 24 hours"
          aria-label="Snooze 24 hours"
        >
          <Clock className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleDismissPlannerItem(task.plannerItemKey);
          }}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
          title="Dismiss"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
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
  const waitlistPromotions = personalTodosThisWeek.filter(todo => todo.type === 'waitlist_promotion');
  const regularTodos = personalTodosThisWeek.filter(
    todo =>
      todo.type !== 'enrollment_request' && todo.type !== 'enrollment_summary' && todo.type !== 'waitlist_promotion'
  );

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
  const studentDueSource = plannerUxOn
    ? plannerFeedItems.filter((item) => item.type === 'assignment' || item.type === 'discussion')
    : studentDueItems;

  const allStudentTasks = studentDueSource.map(item => ({
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
  const teacherTodoSource = plannerUxOn
    ? plannerFeedItems.filter((item) => item.ungradedCount != null)
    : todoAssignments;

  const allTeacherTasks = teacherTodoSource.map(item => ({
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
  const personalSource = plannerUxOn
    ? plannerFeedItems.filter(
        (item) =>
          item.type === 'enrollment_request' ||
          item.type === 'waitlist_promotion' ||
          item.type === 'general' ||
          !item.type
      )
    : personalTodosThisWeek;

  const plannerWaitlist = personalSource.filter((todo) => todo.type === 'waitlist_promotion');
  const plannerEnrollment = personalSource.filter(
    (todo) => todo.type === 'enrollment_request' && todo.action === 'pending'
  );
  const plannerRegular = personalSource.filter(
    (todo) =>
      todo.type !== 'enrollment_request' &&
      todo.type !== 'enrollment_summary' &&
      todo.type !== 'waitlist_promotion'
  );

  const allPersonalTasks = [
    ...(plannerUxOn ? plannerWaitlist : waitlistPromotions).map(todo => ({
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
    ...(plannerUxOn ? plannerEnrollment : enrollmentRequests).map(todo => ({
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
    ...(plannerUxOn ? plannerRegular : regularTodos).map(todo => ({
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
      handleMarkDone(task._id);
    }
  };

  const mobilePanelClass =
    'overflow-hidden rounded-lg border border-gray-200/90 bg-white dark:border-gray-700 dark:bg-gray-800';
  const mobileRowClass =
    'flex cursor-pointer items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-gray-50 active:bg-gray-50 dark:hover:bg-gray-700/30 sm:gap-3 sm:px-4 sm:py-3';

  const renderMobileTaskList = () => {
    if (plannerUxOn && plannerFeedLoading) {
      return (
        <div className={`${mobilePanelClass} py-10 text-center`}>
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent dark:border-blue-400" />
          <p className="mt-2.5 text-[11px] text-gray-500 dark:text-gray-400 sm:text-xs">Loading planner…</p>
        </div>
      );
    }

    if (allTasks.length === 0) {
      return (
        <div className={`${mobilePanelClass} py-10 text-center`}>
          <ClipboardList className="mx-auto mb-2 h-7 w-7 text-gray-300 dark:text-gray-600" strokeWidth={1.5} />
          <p className="text-[11px] text-gray-500 dark:text-gray-400 sm:text-xs">No tasks to do</p>
        </div>
      );
    }

    return (
      <div className={`${mobilePanelClass} divide-y divide-gray-100 dark:divide-gray-700/60`}>
        {allTasks.map((task, index) => {
          const IconComponent = task.icon;
          const plannerActions = renderPlannerUxActions(task);
          return (
            <div
              key={task._id || task.id || index}
              onClick={() => handleTaskClick(task)}
              className={mobileRowClass}
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9"
                style={{ backgroundColor: `${task.color}20`, color: task.color }}
              >
                <IconComponent className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: task.color }}
                    aria-hidden="true"
                  />
                  <span className="truncate text-[10px] font-semibold sm:text-[11px]" style={{ color: task.color }}>
                    {task.courseName}
                  </span>
                </div>
                <div className="truncate text-[11px] font-semibold text-gray-900 dark:text-gray-100 sm:text-xs">
                  {task.title}
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 sm:text-[11px]">
                  {task.formattedDueDate}
                </div>
              </div>

              {plannerActions ||
                (task.isPersonal ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkDone(task._id);
                    }}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:text-green-600 dark:text-gray-500 dark:hover:text-green-400"
                    title="Mark as done"
                    aria-label="Mark as done"
                  >
                    <CircleCheckBig className="h-4 w-4 shrink-0" />
                  </button>
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
                ))}
            </div>
          );
        })}
      </div>
    );
  };

  if (isMobileDevice) {
    return <div className="space-y-2">{renderMobileTaskList()}</div>;
  }

  // Desktop view
  const panelClass = 'overflow-hidden rounded-xl bg-white ring-1 ring-gray-200/70 dark:bg-gray-800 dark:ring-gray-700/60';
  const rowClass = 'flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40 border-b border-gray-100 last:border-b-0 dark:border-gray-700/60';

  return (
    <div className="space-y-4">
      <div className={panelClass}>
        <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-700/60">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">To Do</h2>
        </div>
      
        {plannerUxOn && plannerFeedLoading ? (
          <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            Loading planner…
          </div>
        ) : allTasks.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No tasks to do
          </div>
        ) : (
          <div>
            {allTasks.map((task, index) => {
              const IconComponent = task.icon;
              const plannerActions = renderPlannerUxActions(task);
              return (
                <div
                  key={task._id || task.id || index}
                  onClick={() => handleTaskClick(task)}
                  className={rowClass}
                >
                  <div 
                    className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${task.color}20`, color: task.color }}
                  >
                    <IconComponent className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: task.color }}
                        aria-hidden="true"
                      />
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

                  {plannerActions ||
                    (task.isPersonal ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkDone(task._id);
                        }}
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-gray-400 transition-colors hover:text-green-600 dark:text-gray-500 dark:hover:text-green-400"
                        title="Mark as done"
                        aria-label="Mark as done"
                      >
                        <CircleCheckBig className="w-4 h-4 flex-shrink-0" />
                      </button>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                    ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
