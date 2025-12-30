import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../../services/api';
import api from '../../services/api';
import axios from 'axios';
import { API_URL } from '../../config';
import { useCourse } from '../../contexts/CourseContext';
import logger from '../../utils/logger';

// StudentCard component
const StudentCard = ({ student, isInstructor, isAdmin, handleUnenroll, isInstructorCard }: any) => {
  const [imgError, setImgError] = React.useState(false);
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 flex items-center gap-3 sm:gap-4">
      {student.profilePicture && !imgError ? (
        <img
          src={student.profilePicture.startsWith('http')
            ? student.profilePicture
            : getImageUrl(student.profilePicture)}
          alt={student.firstName}
          className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded-full border flex-shrink-0"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-base sm:text-xl font-bold text-gray-600 dark:text-gray-300 border flex-shrink-0">
          {student.firstName && student.lastName
            ? `${student.firstName[0]}${student.lastName[0]}`.toUpperCase()
            : ''}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-base sm:text-lg text-gray-800 dark:text-gray-200 truncate">{student.firstName} {student.lastName}</div>
        <div className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm truncate">{student.email}</div>
      </div>
      {/* Only show Remove button for students, not instructor */}
      {!isInstructorCard && (isInstructor || isAdmin) && handleUnenroll && (
        <button
          className="ml-auto flex-shrink-0 p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          onClick={() => handleUnenroll(student._id)}
          title="Remove student"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  );
};

interface CourseStudentsProps {
  course: any;
  setCourse: (course: any) => void;
  courseId: string;
  isInstructor: boolean;
  isAdmin: boolean;
  getCourseRef: React.MutableRefObject<(id: string) => Promise<any>>;
}

const CourseStudents: React.FC<CourseStudentsProps> = ({
  course,
  setCourse,
  courseId,
  isInstructor,
  isAdmin,
  getCourseRef,
}) => {
  const navigate = useNavigate();
  const { enrollStudent, unenrollStudent } = useCourse();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

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
    if (!courseId) return;
    try {
      await enrollStudent(courseId, studentId);
      // Clear search results after successful enrollment
      setSearchResults([]);
      setSearchQuery('');
      // Refresh course data to show updated student list
      if (courseId) {
        const updatedCourse = await getCourseRef.current(courseId);
        setCourse(updatedCourse);
      }
    } catch (err) {
      logger.error('Error enrolling student', err);
    }
  };

  const handleUnenroll = async (studentId: string) => {
    if (!courseId) return;
    try {
      await unenrollStudent(courseId, studentId);
      // Refresh course data
      if (courseId) {
        const updatedCourse = await getCourseRef.current(courseId);
        setCourse(updatedCourse);
      }
    } catch (err) {
      logger.error('Error unenrolling student', err);
    }
  };

  const handleApproveEnrollment = async (studentId: string) => {
    if (!courseId) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/courses/${courseId}/enrollment/${studentId}/approve`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Refresh course data to show updated student list and enrollment requests
      if (courseId) {
        const updatedCourse = await getCourseRef.current(courseId);
        setCourse(updatedCourse);
      }
      
      alert('Enrollment approved successfully!');
    } catch (err: any) {
      logger.error('Error approving enrollment', err);
      alert('Failed to approve enrollment: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDenyEnrollment = async (studentId: string) => {
    if (!courseId) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/courses/${courseId}/enrollment/${studentId}/deny`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Refresh course data to show updated enrollment requests
      if (courseId) {
        const updatedCourse = await getCourseRef.current(courseId);
        setCourse(updatedCourse);
      }
      
      alert('Enrollment denied successfully!');
    } catch (err: any) {
      logger.error('Error denying enrollment', err);
      alert('Failed to deny enrollment: ' + (err.response?.data?.message || err.message));
    }
  };

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
        
        {/* Waitlisted Students */}
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
};

export default CourseStudents;

