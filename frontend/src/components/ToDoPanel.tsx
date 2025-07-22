import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';

export const ToDoPanel: React.FC = () => {
  const { user } = useAuth();
  const [todoAssignments, setTodoAssignments] = useState<any[]>([]);
  const [todoLoading, setTodoLoading] = useState(false);
  const [todoError, setTodoError] = useState<string | null>(null);
  const [personalTodos, setPersonalTodos] = useState<any[]>([]);                                                                                              
  const [personalLoading, setPersonalLoading] = useState(false);
  const [personalError, setPersonalError] = useState<string | null>(null);
  const [studentDueAssignments, setStudentDueAssignments] = useState<any[]>([]);
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
      // Student: fetch assignments due this week
      const fetchStudentDue = async () => {
        setStudentDueLoading(true);
        setStudentDueError(null);
        try {
          const res = await api.get('/assignments/todo/due');
          setStudentDueAssignments(res.data);
        } catch (err: any) {
          setStudentDueError('Failed to load assignments due this week');
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

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-200">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">To Do</h2>
      {/* Personal To-Dos */}
      <div className="mb-6">
        <h3 className="text-md font-semibold text-gray-600 mb-3">My To Do</h3>
        {personalLoading ? (
          <div className="text-gray-500">Loading...</div>
        ) : personalError ? (
          <div className="text-red-500">{personalError}</div>
        ) : personalTodosThisWeek.length === 0 ? (
          <div className="text-gray-500 text-sm italic">No personal to-dos</div>
        ) : (
          <ul className="space-y-2">
            {personalTodosThisWeek.map((todo) => (
              <li key={todo._id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex-1">
                  <span className="font-medium text-gray-800">{todo.title}</span>
                  {todo.dueDate && (
                    <span className="ml-2 text-xs text-gray-500">{new Date(todo.dueDate).toLocaleDateString()}</span>
                  )}
                </div>
                <button
                  className="text-xs bg-green-100 text-green-700 rounded px-2 py-1 hover:bg-green-200 transition-colors"
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
          <h3 className="text-md font-semibold text-gray-600 mb-3">Ungraded Assignments</h3>
          {todoLoading ? (
            <div className="text-gray-500">Loading...</div>
          ) : todoError ? (
            <div className="text-red-500">{todoError}</div>
          ) : todoAssignments.length === 0 ? (
            <div className="text-gray-500 text-sm italic">No ungraded assignments</div>
          ) : (
            <ul className="space-y-3">
              {todoAssignments.map((item) => (
                <li key={item.id} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <Link
                    to={`/assignments/${item.id}/grade`}
                    className="block"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-gray-800" title={item.title}>
                        {item.title.length > 30 ? item.title.slice(0, 30) + '...' : item.title}
                      </span>
                      <span className="text-xs bg-blue-100 text-blue-700 rounded px-2 py-1">{item.ungradedCount} to grade</span>
                    </div>
                    <div className="text-sm text-gray-500">{item.course.title}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <h3 className="text-md font-semibold text-gray-600 mb-3">Assignments Due This Week</h3>
          {studentDueLoading ? (
            <div className="text-gray-500">Loading...</div>
          ) : studentDueError ? (
            <div className="text-red-500">{studentDueError}</div>
          ) : studentDueAssignments.length === 0 ? (
            <div className="text-gray-500 text-sm italic">No assignments due this week</div>
          ) : (
            <ul className="space-y-3">
              {studentDueAssignments.map((item) => (
                <li key={item._id} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <Link
                    to={`/assignments/${item._id}/view`}
                    className="block"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-gray-800" title={item.title}>
                        {item.title.length > 30 ? item.title.slice(0, 30) + '...' : item.title}
                      </span>
                      <span className="text-xs bg-yellow-100 text-yellow-700 rounded px-2 py-1">Due {new Date(item.dueDate).toLocaleDateString()}</span>
                    </div>
                    <div className="text-sm text-gray-500">{item.module?.course?.title || ''}</div>
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