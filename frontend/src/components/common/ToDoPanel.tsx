import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useUserPreferencesQuery } from '../../hooks/useUserPreferencesQuery';
import { useAuth } from '../../contexts/AuthContext';
import { useCourse } from '../../contexts/CourseContext';
import { startOfWeek, endOfWeek, isWithinInterval, parseISO, format, isToday, isTomorrow, addDays, isAfter, isBefore } from 'date-fns';
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
  Megaphone,
  Award,
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

interface ToDoPanelProps {
  showSupplementarySections?: boolean;
}

export const ToDoPanel: React.FC<ToDoPanelProps> = ({ showSupplementarySections = true }) => {
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
  const [upcomingItems, setUpcomingItems] = useState<any[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(false);
  const [upcomingError, setUpcomingError] = useState<string | null>(null);
  const [assessmentUpdates, setAssessmentUpdates] = useState<any[]>([]);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
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
    const fetchStudentDashboardSections = async () => {
      if (!showSupplementarySections || isTeacherOrAdmin || !user?._id || plannerUxOn) return;

      setUpcomingLoading(true);
      setUpcomingError(null);
      setAssessmentLoading(true);
      setAssessmentError(null);

      const now = new Date();
      const next7Days = addDays(now, 7);

      const isWithinNextSevenDays = (dateInput: string | Date) => {
        const dt = typeof dateInput === 'string' ? parseISO(dateInput) : new Date(dateInput);
        if (isNaN(dt.getTime())) return false;
        return (isAfter(dt, now) || dt.getTime() === now.getTime()) && (isBefore(dt, next7Days) || dt.getTime() === next7Days.getTime());
      };

      const mapUpcomingTask = (item: any) => {
        const courseId = item.course?._id || item.module?.course?._id;
        const taskType = (item.itemType || item.type || '').toLowerCase();
        const icon = getTaskIcon(item.type, item.itemType);
        const link = item.type === 'assignment'
          ? `/assignments/${item._id}/view`
          : `/courses/${courseId}/threads/${item._id}`;
        return {
          _id: `task-${item._id}`,
          title: item.title,
          subtitle: getCourseName(courseId),
          dateText: formatDueDate(item.dueDate),
          dateValue: new Date(item.dueDate).getTime(),
          color: getCourseColor(courseId),
          icon,
          link,
          kind: taskType.includes('discussion') ? 'Discussion' : 'Task'
        };
      };

      const mapUpcomingEvent = (event: any) => {
        const calendarId = event.calendar?.toString?.() || event.calendar;
        const courseLabel = courses.find(c => c._id === calendarId)?.catalog?.courseCode || courses.find(c => c._id === calendarId)?.title || 'Calendar Event';
        const startDate = new Date(event.start);
        return {
          _id: `event-${event._id}`,
          title: event.title,
          subtitle: courseLabel,
          dateText: `Event ${format(startDate, 'EEE, MMM d')} at ${format(startDate, 'h:mm a')}`,
          dateValue: startDate.getTime(),
          color: '#2563EB',
          icon: Calendar,
          link: '/calendar',
          kind: 'Event'
        };
      };

      const mapUpcomingAnnouncement = (announcement: any, courseId: string) => {
        const postedDate = announcement.delayedUntil || announcement.createdAt;
        const dt = new Date(postedDate);
        return {
          _id: `announcement-${announcement._id}`,
          title: announcement.title,
          subtitle: getCourseName(courseId),
          dateText: `Posted ${format(dt, 'EEE, MMM d')}`,
          dateValue: dt.getTime(),
          color: getCourseColor(courseId),
          icon: Megaphone,
          link: `/courses/${courseId}/announcements`,
          kind: 'Announcement'
        };
      };

      try {
        const [eventsRes, notificationsRes, announcementResponses] = await Promise.all([
          api.get('/events'),
          api.get('/notifications?limit=30'),
          Promise.all(
            (courses || [])
              .filter(c => c.published)
              .map(async (course) => {
                try {
                  const res = await api.get(`/courses/${course._id}/announcements`);
                  return { courseId: course._id, data: res.data?.data || [] };
                } catch (error) {
                  return { courseId: course._id, data: [] };
                }
              })
          )
        ]);

        const rawTasks = Array.isArray(studentDueItems) ? studentDueItems : [];
        const upcomingTaskItems = rawTasks
          .filter(item => item?.dueDate && isWithinNextSevenDays(item.dueDate))
          .map(mapUpcomingTask);

        const upcomingEventItems = (Array.isArray(eventsRes?.data) ? eventsRes.data : [])
          .filter((event: any) => event?.start && isWithinNextSevenDays(event.start))
          .map(mapUpcomingEvent);

        // Announcements are shown if posted within the next 7 days window using delayedUntil,
        // or if newly posted this week (createdAt) to keep relevant course updates visible.
        const upcomingAnnouncementItems = announcementResponses
          .flatMap((entry: any) => {
            return (entry.data || [])
              .filter((a: any) => {
                const sourceDate = a.delayedUntil || a.createdAt;
                if (!sourceDate) return false;
                const dt = typeof sourceDate === 'string' ? parseISO(sourceDate) : new Date(sourceDate);
                if (isNaN(dt.getTime())) return false;
                const withinFutureWindow = isWithinNextSevenDays(dt);
                const oneWeekAgo = addDays(now, -7);
                const postedRecently = (isAfter(dt, oneWeekAgo) || dt.getTime() === oneWeekAgo.getTime()) && (isBefore(dt, now) || dt.getTime() === now.getTime());
                return withinFutureWindow || postedRecently;
              })
              .map((a: any) => mapUpcomingAnnouncement(a, entry.courseId));
          });

        const mergedUpcoming = [...upcomingTaskItems, ...upcomingEventItems, ...upcomingAnnouncementItems]
          .sort((a, b) => a.dateValue - b.dateValue);
        setUpcomingItems(mergedUpcoming);

        const notifications = notificationsRes?.data?.data || [];
        const filteredAssessmentNotifications = notifications
          .filter((n: any) => {
            const type = (n.type || '').toLowerCase();
            const text = `${n.title || ''} ${n.message || ''}`.toLowerCase();
            const gradedType = type === 'assignment_graded' || type === 'grade';
            const feedbackText = text.includes('feedback') || text.includes('comment');
            return gradedType || feedbackText;
          })
          .sort((a: any, b: any) => b.dateValue - a.dateValue);

        const assignmentIds: string[] = Array.from(
          new Set(
            filteredAssessmentNotifications
              .map((n: any) => (n.relatedType === 'assignment' ? (n.relatedId?.toString?.() || n.relatedId) : null))
              .filter(Boolean)
          )
        );

        const assignmentTotalById: Record<string, number | null> = {};
        await Promise.all(
          assignmentIds.map(async (assignmentId) => {
            try {
              const res = await api.get(`/assignments/${assignmentId}`);
              const assignment = res?.data?.assignment || res?.data?.data || res?.data;
              const total = assignment?.totalPoints;
              assignmentTotalById[assignmentId] = typeof total === 'number' ? total : null;
            } catch {
              assignmentTotalById[assignmentId] = null;
            }
          })
        );

        const countsByRelatedKey = filteredAssessmentNotifications.reduce((acc: Record<string, number>, n: any) => {
          const key = n.relatedType === 'assignment'
            ? `assignment:${n.relatedId?.toString?.() || n.relatedId}`
            : `title:${extractAssignmentTitle(n)}:${extractCourseCode(n)}`;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {});

        const seenKeys = new Set<string>();
        const filteredAssessmentUpdates = filteredAssessmentNotifications
          .map((n: any) => {
            const relatedId = n.relatedId?.toString?.() || n.relatedId;
            const relatedKey = n.relatedType === 'assignment'
              ? `assignment:${relatedId}`
              : `title:${extractAssignmentTitle(n)}:${extractCourseCode(n)}`;
            return { ...n, relatedId, relatedKey };
          })
          .filter((n: any) => {
            if (seenKeys.has(n.relatedKey)) return false;
            seenKeys.add(n.relatedKey);
            return true;
          })
          .map((n: any) => {
            const assignmentTitle = extractAssignmentTitle(n);
            const courseCode = extractCourseCode(n);
            const received = extractReceivedPoints(n);
            const total = n.relatedId ? assignmentTotalById[n.relatedId] : null;
            const scoreText = received ? `${received} out of ${total !== null ? total : '?'}` : getShortAssessmentMeta(n);

            return {
              _id: n._id,
              title: assignmentTitle,
              subtitle: `${courseCode} • ${scoreText}`,
              isUpdated: countsByRelatedKey[n.relatedKey] > 1,
              dateText: formatDistanceToNowSafe(n.createdAt),
              dateValue: new Date(n.createdAt).getTime(),
              color: '#16A34A',
              icon: Award,
              link: n.link || '/inbox'
            };
          })
          .sort((a: any, b: any) => b.dateValue - a.dateValue);

        setAssessmentUpdates(filteredAssessmentUpdates);
      } catch (error: any) {
        setUpcomingError('Failed to load upcoming items');
        setAssessmentError('Failed to load assessment updates');
      } finally {
        setUpcomingLoading(false);
        setAssessmentLoading(false);
      }
    };

    fetchStudentDashboardSections();
  }, [showSupplementarySections, isTeacherOrAdmin, user?._id, courses, studentDueItems]);

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

  const formatDistanceToNowSafe = (dateValue: string | Date) => {
    if (!dateValue) return '';
    const date = typeof dateValue === 'string' ? parseISO(dateValue) : new Date(dateValue);
    if (isNaN(date.getTime())) return '';
    return `${formatDistanceToNowLabel(date)} ago`;
  };

  const formatDistanceToNowLabel = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 60) return `${Math.max(1, minutes)}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  const getShortAssessmentMeta = (notification: any) => {
    const title = notification?.title || '';
    const message = notification?.message || '';
    const source = `${title} ${message}`;

    const courseMatch = source.match(/\[([^\]]+)\]/);
    const pointsMatch = source.match(/received\s+([0-9]+(?:\.[0-9]+)?)\s+points?/i);
    const feedbackMatch = /feedback|comment/i.test(source);

    const parts: string[] = [];
    if (courseMatch?.[1]) parts.push(courseMatch[1]);
    if (pointsMatch?.[1]) parts.push(`${pointsMatch[1]} pts`);
    if (feedbackMatch && !pointsMatch) parts.push('Feedback posted');

    return parts.join(' • ') || 'Assessment update';
  };

  const extractAssignmentTitle = (notification: any) => {
    const title = notification?.title || '';
    const message = notification?.message || '';
    const combined = `${title} ${message}`;
    const quotedTitle = combined.match(/submission for\s+"([^"]+)"/i);
    return quotedTitle?.[1] || title || 'Assessment';
  };

  const extractCourseCode = (notification: any) => {
    const source = `${notification?.title || ''} ${notification?.message || ''}`;
    const match = source.match(/\[([^\]]+)\]/);
    return match?.[1] || 'Course';
  };

  const extractReceivedPoints = (notification: any) => {
    const source = `${notification?.title || ''} ${notification?.message || ''}`;
    const match = source.match(/received\s+([0-9]+(?:\.[0-9]+)?)\s+points?/i);
    return match?.[1] || null;
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

  if (isMobileDevice) {
    return (
      <div className="w-full">
        {plannerUxOn && plannerFeedLoading ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400 text-sm">
            Loading planner…
          </div>
        ) : allTasks.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400 text-sm">
            No tasks to do
          </div>
        ) : (
          <div className="space-y-0">
            {allTasks.map((task, index) => {
              const IconComponent = task.icon;
              const plannerActions = renderPlannerUxActions(task);
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
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-0.5 truncate">
                      {task.title}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {task.formattedDueDate}
                    </div>
                  </div>

                  {/* Right action */}
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
                        <CircleCheckBig className="w-5 h-5 flex-shrink-0" />
                      </button>
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                    ))}
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
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 border border-gray-200 dark:border-gray-700">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-3">To Do</h2>
      
        {plannerUxOn && plannerFeedLoading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
            Loading planner…
          </div>
        ) : allTasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
            No tasks to do
          </div>
        ) : (
          <div className="space-y-0">
            {allTasks.map((task, index) => {
              const IconComponent = task.icon;
              const plannerActions = renderPlannerUxActions(task);
              return (
                <div
                  key={task._id || task.id || index}
                  onClick={() => handleTaskClick(task)}
                  className="flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer rounded-lg mb-1 last:mb-0"
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

      {showSupplementarySections && !isTeacherOrAdmin && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 border border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-3">Upcoming</h2>
          {upcomingLoading ? (
            <div className="text-sm text-gray-500 dark:text-gray-400 py-4">Loading upcoming items...</div>
          ) : upcomingError ? (
            <div className="text-sm text-red-500 py-4">{upcomingError}</div>
          ) : upcomingItems.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400 py-4">No upcoming items in the next 7 days</div>
          ) : (
            <>
              <div className="space-y-1">
                {upcomingItems.slice(0, 3).map((item) => {
                  const IconComponent = item.icon;
                  return (
                    <div
                      key={item._id}
                      onClick={() => item.link && navigate(item.link)}
                      className="flex items-center gap-3 px-3 py-3 border border-gray-200 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-all rounded-xl cursor-pointer shadow-sm"
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${item.color}20`, color: item.color }}>
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{item.title}</div>
                        <div className="flex items-center gap-1.5 mt-1 min-w-0">
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 truncate">
                            {item.subtitle}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 truncate">
                            {item.dateText}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
              {upcomingItems.length > 3 && (
                <button
                  type="button"
                  onClick={() => navigate('/calendar')}
                  className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {upcomingItems.length - 3} more in this week
                </button>
              )}
            </>
          )}
        </div>
      )}

      {showSupplementarySections && !isTeacherOrAdmin && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 border border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-3">Assessment Updates</h2>
          {assessmentLoading ? (
            <div className="text-sm text-gray-500 dark:text-gray-400 py-4">Loading assessment updates...</div>
          ) : assessmentError ? (
            <div className="text-sm text-red-500 py-4">{assessmentError}</div>
          ) : assessmentUpdates.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400 py-4">No recent assessment updates</div>
          ) : (
            <>
              <div className="space-y-1">
                {assessmentUpdates.slice(0, 3).map((item) => {
                  const IconComponent = item.icon;
                  return (
                    <div
                      key={item._id}
                      onClick={() => item.link && navigate(item.link)}
                      className="flex items-center gap-3 px-3 py-3 border border-gray-200 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-all rounded-xl cursor-pointer shadow-sm"
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${item.color}20`, color: item.color }}>
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{item.title}</div>
                          {item.isUpdated && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 flex-shrink-0">
                              Updated
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 min-w-0">
                          {item.subtitle.split(' • ').map((part: string, idx: number) => (
                            <span
                              key={`${item._id}-meta-${idx}`}
                              className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 truncate"
                            >
                              {part}
                            </span>
                          ))}
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            {item.dateText}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
              {assessmentUpdates.length > 3 && (
                <button
                  type="button"
                  onClick={() => navigate('/inbox')}
                  className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  More
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
