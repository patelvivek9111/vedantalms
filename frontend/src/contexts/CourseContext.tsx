import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

interface Course {
  _id: string;
  title: string;
  description: string;
  instructor: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  students: Array<{
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  }>;
  createdAt: string;
  updatedAt: string;
  published?: boolean;
  defaultColor?: string;
  catalog?: {
    subject: string;
    description: string;
    prerequisites: string[];
    maxStudents: number;
    creditHours?: number;
    courseCode?: string;
    enrollmentDeadline: Date;
    startDate: Date;
    endDate: Date;
    tags: string[];
    thumbnail: string;
    syllabus: string;
    allowTeacherEnrollment: boolean;
    isPublic: boolean;
  };
  semester?: {
    term: string;
    year: number;
  };
  enrollmentRequests?: any[];
  waitlist?: any[];
}

interface CourseContextType {
  courses: Course[];
  loading: boolean;
  error: string | null;
  createCourse: (title: string, description: string, catalogData?: any, semesterData?: any) => Promise<void>;
  updateCourse: (id: string, title?: string, description?: string, catalogData?: any, semesterData?: any, defaultColor?: string) => Promise<void>;
  deleteCourse: (id: string) => Promise<void>;
  enrollStudent: (courseId: string, studentId: string) => Promise<void>;
  unenrollStudent: (courseId: string, studentId: string) => Promise<void>;
  getCourses: () => Promise<void>;
  getCourse: (id: string) => Promise<Course>;
}

const CourseContext = createContext<CourseContextType | undefined>(undefined);

export const CourseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token, user } = useAuth();

  const getCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/courses');
      if (response.data.success) {
        setCourses(response.data.data);
      } else {
        setError(response.data.message || 'Failed to fetch courses');
      }
    } catch (err: any) {
      console.error('Error fetching courses:', err);
      setError(err.response?.data?.message || 'Error fetching courses');
    } finally {
      setLoading(false);
    }
  };

  const getCourse = async (id: string): Promise<Course> => {
    if (!id || id === 'undefined' || id === 'null') {
      throw new Error('Invalid course ID');
    }
    
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/courses/${id}`);
      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Failed to fetch course');
      }
    } catch (err: any) {
      console.error('Error fetching course:', err);
      setError(err.response?.data?.message || 'Error fetching course');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const createCourse = async (title: string, description: string, catalogData?: any, semesterData?: any) => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.post('/courses', { 
        title, 
        description,
        catalog: catalogData,
        semester: semesterData
      });
      if (response.data.success) {
        setCourses([...courses, response.data.data]);
      } else {
        setError(response.data.message || 'Failed to create course');
      }
    } catch (err: any) {
      console.error('Error creating course:', err);
      setError(err.response?.data?.message || 'Error creating course');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateCourse = async (id: string, title?: string, description?: string, catalogData?: any, semesterData?: any, defaultColor?: string) => {
    try {
      setLoading(true);
      setError(null);
      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (catalogData !== undefined) updateData.catalog = catalogData;
      if (semesterData !== undefined) updateData.semester = semesterData;
      if (defaultColor !== undefined) updateData.defaultColor = defaultColor;
      
      const response = await api.put(`/courses/${id}`, updateData);
      if (response.data.success) {
        setCourses(courses.map(course => 
          course._id === id ? response.data.data : course
        ));
      } else {
        setError(response.data.message || 'Failed to update course');
      }
    } catch (err: any) {
      console.error('Error updating course:', err);
      setError(err.response?.data?.message || 'Error updating course');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteCourse = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.delete(`/courses/${id}`);
      if (response.data.success) {
        setCourses(courses.filter(course => course._id !== id));
      } else {
        setError(response.data.message || 'Failed to delete course');
      }
    } catch (err: any) {
      console.error('Error deleting course:', err);
      setError(err.response?.data?.message || 'Error deleting course');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const enrollStudent = async (courseId: string, studentId: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.post(`/courses/${courseId}/enroll-teacher`, { studentId });
      if (response.data.success) {
        setCourses(courses.map(course => 
          course._id === courseId ? response.data.data : course
        ));
      } else {
        setError(response.data.message || 'Failed to enroll student');
      }
    } catch (err: any) {
      console.error('Error enrolling student:', err);
      setError(err.response?.data?.message || 'Error enrolling student');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const unenrollStudent = async (courseId: string, studentId: string) => {
    try {
      const response = await api.post(`/courses/${courseId}/unenroll`, { studentId });
      if (response.data.success) {
        // Refresh the course data
        await getCourse(courseId);
      }
    } catch (err) {
      console.error('Error unenrolling student:', err);
      throw err;
    }
  };

  useEffect(() => {
    if (token && user?._id) {
      // Fetch courses when token and user are available
      getCourses().catch(err => {
        console.error('Error in CourseProvider useEffect:', err);
      });
    } else {
      // Clear courses when token is removed or user changes (logout or new login)
      setCourses([]);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?._id]); // Also depend on user._id to reload when user changes

  // Ensure context value is always defined - use object literal to always return the same structure
  const contextValue: CourseContextType = {
        courses,
        loading,
        error,
        createCourse,
        updateCourse,
        deleteCourse,
        enrollStudent,
        unenrollStudent,
        getCourses,
        getCourse,
  };

  return (
    <CourseContext.Provider value={contextValue}>
      {children}
    </CourseContext.Provider>
  );
};

export const useCourse = () => {
  const context = useContext(CourseContext);
  if (!context) {
    // Return a default value instead of throwing to prevent crashes during transitions
    console.warn('useCourse called outside CourseProvider, returning default values');
    return {
      courses: [],
      loading: false,
      error: null,
      createCourse: async () => {},
      updateCourse: async () => {},
      deleteCourse: async () => {},
      enrollStudent: async () => {},
      unenrollStudent: async () => {},
      getCourses: async () => {},
      getCourse: async () => { throw new Error('CourseProvider not available'); },
    } as CourseContextType;
  }
  return context;
}; 