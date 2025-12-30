import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';
import logger from '../utils/logger';

export const ToDoPanel: React.FC = () => {
  const { user } = useAuth();
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

  useEffect(() => {
    if (isTeacherOrAdmin) {
      const fetchTodo = async () => {
        setTodoLoading(true);
        setTodoError(null);
        try {
          const res = await api.get('/assignments/todo/ungraded');
          setTodoAssignments(res.data);
        } catch (err: any) {
          setTodoError('Failed to load To-Do assignments');
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
          setStudentDueItems(res.data);
        } catch (err: any) {
          setStudentDueError('Failed to load items due this week');
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
        setPersonalTodos(res.data);
      } catch (err: any) {
        setPersonalError('Failed to load personal to-dos');
      } finally {
        setPersonalLoading(false);
      }
    };
    fetchPersonalTodos();
  }, []);

  // Listen for assignment submission events to refresh the ToDo panel
  useEffect(() => {
    const handleAssignmentSubmitted = () => {
      // Add a small delay to ensure the backend has processed the submission
      setTimeout(() => {
        refreshToDo();
      }, 500);
    };

    // Add event listener for assignment submission
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
      // Delete the notification from the database
      await api.delete(`/todos/${todo._id}`);
      
      // Remove from local state
      setPersonalTodos(todos => todos.filter((t: any) => t._id !== todo._id));
      
      // Navigate to the course students page
      window.location.href = `/courses/${todo.courseId}/students`;
    } catch (err) {
      logger.error('Error removing enrollment notification', err);
    }
  };

  const refreshToDo = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Filter personalTodos to only show those due this week (Monday to Sunday)
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 }); // Sunday
  const personalTodosThisWeek = personalTodos.filter(todo => {
    const due = typeof todo.dueDate === 'string' ? parseISO(todo.dueDate) : new Date(todo.dueDate);
    return isWithinInterval(due, { start: weekStart, end: weekEnd });
  });

  // Separate enrollment requests, enrollment summaries, and waitlist promotions from regular todos
  const enrollmentRequests = personalTodosThisWeek.filter(todo => todo.type === 'enrollment_request' && todo.action === 'pending');
  const enrollmentSummaries = personalTodosThisWeek.filter(todo => todo.type === 'enrollment_summary');
  const waitlistPromotions = personalTodosThisWeek.filter(todo => todo.type === 'waitlist_promotion');
  const regularTodos = personalTodosThisWeek.filter(todo => todo.type !== 'enrollment_request' && todo.type !== 'enrollment_summary' && todo.type !== 'waitlist_promotion');

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6 border border-gray-200 dark:border-gray-700">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4 sm:mb-6">To Do</h2>
      {/* Enrollment Summaries */}
      {enrollmentSummaries.length > 0 && (
        <div className="mb-4 sm:mb-6">
          <h3 className="text-sm sm:text-base font-semibold text-gray-600 dark:text-gray-400 mb-2 sm:mb-3">Enrollment Updates</h3>
          <ul className="space-y-2">
            {enrollmentSummaries.map((todo) => (
              <li key={todo._id} className="p-2 sm:p-3 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors cursor-pointer" onClick={() => handleEnrollmentNotificationClick(todo)}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <span className="font-medium text-sm sm:text-base text-gray-800 dark:text-gray-200">
                    {todo.enrollmentCount} student{todo.enrollmentCount !== 1 ? 's' : ''} enrolled in {todo.courseName}
                  </span>
                  {todo.dueDate && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(todo.dueDate).toLocaleDateString()}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Waitlist Promotions */}
      {waitlistPromotions.length > 0 && (
        <div className="mb-4 sm:mb-6">
          <h3 className="text-sm sm:text-base font-semibold text-gray-600 dark:text-gray-400 mb-2 sm:mb-3">Waitlist Promotions</h3>
          <ul className="space-y-2">
            {waitlistPromotions.map((todo) => (
              <li key={todo._id} className="p-2 sm:p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors cursor-pointer" onClick={() => handleEnrollmentNotificationClick(todo)}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <span className="font-medium text-sm sm:text-base text-gray-800 dark:text-gray-200">{todo.title}</span>
                  {todo.dueDate && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(todo.dueDate).toLocaleDateString()}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Enrollment Requests */}
      {enrollmentRequests.length > 0 && (
        <div className="mb-4 sm:mb-6">
          <h3 className="text-sm sm:text-base font-semibold text-gray-600 dark:text-gray-400 mb-2 sm:mb-3">Enrollment Requests</h3>
          <ul className="space-y-2">
            {enrollmentRequests.map((todo) => (
              <li key={todo._id} className="p-2 sm:p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors cursor-pointer" onClick={() => window.location.href = `/courses/${todo.courseId}/students`}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <span className="font-medium text-sm sm:text-base text-gray-800 dark:text-gray-200">{todo.title}</span>
                  {todo.dueDate && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(todo.dueDate).toLocaleDateString()}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Personal To-Dos */}
      <div className="mb-4 sm:mb-6">
        <h3 className="text-sm sm:text-base font-semibold text-gray-600 dark:text-gray-400 mb-2 sm:mb-3">My To Do</h3>
        {personalLoading ? (
          <div className="text-gray-500 dark:text-gray-400">Loading...</div>
        ) : personalError ? (
          <div className="text-red-500 dark:text-red-400">{personalError}</div>
        ) : regularTodos.length === 0 ? (
          <div className="text-gray-500 dark:text-gray-400 text-sm italic">No personal to-dos</div>
        ) : (
          <ul className="space-y-2">
            {regularTodos.map((todo) => (
              <li key={todo._id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 p-2 sm:p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm sm:text-base text-gray-800 dark:text-gray-200 break-words">{todo.title}</span>
                  {todo.dueDate && (
                    <span className="block sm:inline sm:ml-2 mt-1 sm:mt-0 text-xs text-gray-500 dark:text-gray-400">{new Date(todo.dueDate).toLocaleDateString()}</span>
                  )}
                </div>
                <button
                  className="text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded px-2 sm:px-3 py-1 hover:bg-green-200 dark:hover:bg-green-900/70 transition-colors whitespace-nowrap"
                  onClick={() => handleMarkDone(todo._id)}
                >
                  Done
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* Assignment To-Dos (role-based) */}
      {isTeacherOrAdmin ? (
        <>
          <h3 className="text-sm sm:text-base font-semibold text-gray-600 dark:text-gray-400 mb-2 sm:mb-3">Ungraded Assignments</h3>
          {todoLoading ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">Loading...</div>
          ) : todoError ? (
            <div className="text-sm text-red-500 dark:text-red-400">{todoError}</div>
          ) : todoAssignments.length === 0 ? (
            <div className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm italic">No ungraded assignments</div>
          ) : (
            <ul className="space-y-2 sm:space-y-3">
              {todoAssignments.map((item) => (
                <li key={item.id} className="p-2 sm:p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <Link
                    to={`/assignments/${item.id}/grade`}
                    className="block"
                  >
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-1">
                      <span className="font-medium text-sm sm:text-base text-gray-800 dark:text-gray-200 break-words" title={item.title}>
                        {item.title.length > 30 ? item.title.slice(0, 30) + '...' : item.title}
                      </span>
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded px-2 py-1 whitespace-nowrap self-start sm:self-auto">{item.ungradedCount} to grade</span>
                    </div>
                    <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{item.course.title}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <h3 className="text-sm sm:text-base font-semibold text-gray-600 dark:text-gray-400 mb-2 sm:mb-3">Due This Week</h3>
          {studentDueLoading ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">Loading...</div>
          ) : studentDueError ? (
            <div className="text-sm text-red-500 dark:text-red-400">{studentDueError}</div>
          ) : studentDueItems.length === 0 ? (
            <div className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm italic">No items due this week</div>
          ) : (
            <ul className="space-y-2 sm:space-y-3">
              {studentDueItems.map((item) => (
                <li key={item._id} className="p-2 sm:p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <Link
                    to={item.type === 'assignment' 
                      ? `/assignments/${item._id}/view`
                      : `/courses/${item.course._id}/threads/${item._id}`
                    }
                    className="block"
                  >
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-1">
                      <span className="font-medium text-sm sm:text-base text-gray-800 dark:text-gray-200 break-words" title={item.title}>
                        {item.title.length > 30 ? item.title.slice(0, 30) + '...' : item.title}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-xs rounded px-2 py-1 whitespace-nowrap ${
                          item.type === 'assignment' 
                            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' 
                            : 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
                        }`}>
                          {item.itemType}
                        </span>
                        <span className="text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded px-2 py-1 whitespace-nowrap">
                          Due {new Date(item.dueDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                      {item.module?.course?.title || item.course?.title || ''}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}; 