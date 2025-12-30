import React, { createContext, useContext, useState, ReactNode } from 'react';
import api from '../services/api';

interface Course {
  _id: string;
  title: string;
  description?: string;
  instructor?: string;
  students?: string[];
  published: boolean;
  [key: string]: any;
}

interface CourseContextType {
  courses: Course[];
  setCourses: (courses: Course[]) => void;
  currentCourse: Course | null;
  setCurrentCourse: (course: Course | null) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  error: string | null;
  getCourse: (id: string) => Promise<Course>;
  getCourses: () => Promise<void>;
  createCourse: (title: string, description: string, catalog?: any, semester?: any) => Promise<Course>;
  updateCourse: (id: string, title: string, description: string, catalog?: any, semester?: any) => Promise<Course>;
  deleteCourse: (id: string) => Promise<void>;
  enrollStudent: (courseId: string, studentId: string) => Promise<void>;
  unenrollStudent: (courseId: string, studentId: string) => Promise<void>;
}

const CourseContext = createContext<CourseContextType | undefined>(undefined);

export const CourseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [currentCourse, setCurrentCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const getCourse = async (id: string): Promise<Course> => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/courses/${id}`);
      const course = response.data.data || response.data;
      setCurrentCourse(course);
      return course;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch course';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getCourses = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/courses');
      const coursesData = response.data.data || response.data || [];
      setCourses(Array.isArray(coursesData) ? coursesData : []);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch courses';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const createCourse = async (title: string, description: string, catalog?: any, semester?: any): Promise<Course> => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/courses', { title, description, catalog, semester });
      const course = response.data.data || response.data;
      setCourses(prev => [...prev, course]);
      return course;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to create course';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateCourse = async (id: string, title: string, description: string, catalog?: any, semester?: any): Promise<Course> => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.put(`/courses/${id}`, { title, description, catalog, semester });
      const course = response.data.data || response.data;
      setCourses(prev => prev.map(c => c._id === id ? course : c));
      if (currentCourse?._id === id) {
        setCurrentCourse(course);
      }
      return course;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to update course';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteCourse = async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/courses/${id}`);
      setCourses(prev => prev.filter(c => c._id !== id));
      if (currentCourse?._id === id) {
        setCurrentCourse(null);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to delete course';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const enrollStudent = async (courseId: string, studentId: string): Promise<void> => {
    setError(null);
    try {
      await api.post(`/courses/${courseId}/enroll-teacher`, { studentId });
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to enroll student';
      setError(errorMessage);
      throw err;
    }
  };

  const unenrollStudent = async (courseId: string, studentId: string): Promise<void> => {
    setError(null);
    try {
      await api.post(`/courses/${courseId}/unenroll`, { studentId });
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to unenroll student';
      setError(errorMessage);
      throw err;
    }
  };

  return (
    <CourseContext.Provider
      value={{
        courses,
        setCourses,
        currentCourse,
        setCurrentCourse,
        loading,
        setLoading,
        error,
        getCourse,
        getCourses,
        createCourse,
        updateCourse,
        deleteCourse,
        enrollStudent,
        unenrollStudent,
      }}
    >
      {children}
    </CourseContext.Provider>
  );
};

export const useCourse = (): CourseContextType => {
  const context = useContext(CourseContext);
  if (context === undefined) {
    throw new Error('useCourse must be used within a CourseProvider');
  }
  return context;
};

