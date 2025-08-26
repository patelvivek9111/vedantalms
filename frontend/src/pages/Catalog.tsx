import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { API_URL } from '../config';
import { Search, Filter, BookOpen, User, Calendar, Users } from 'lucide-react';

interface Course {
  _id: string;
  title: string;
  description: string;
  instructor: {
    firstName: string;
    lastName: string;
    email: string;
  };
  catalog?: {
    subject: string;
    description: string;
    prerequisites: string[];
    maxStudents: number;
    enrollmentDeadline: Date;
    startDate: Date;
    endDate: Date;
    tags: string[];
    thumbnail: string;
    syllabus: string;
    allowTeacherEnrollment: boolean;
  };
  published: boolean;
  students: any[];
  enrollmentRequests?: any[];
  waitlist?: any[];
}

const Catalog: React.FC = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to view the course catalog');
        setLoading(false);
        return;
      }

      // Try the new available courses endpoint first
      try {
        const response = await axios.get(`${API_URL}/api/courses/available/browse`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data.success) {
          setCourses(response.data.data);
          return; // Success, exit early
        }
      } catch (err: any) {
        console.log('New route failed, trying fallback catalog route:', err.message);
      }

      // Fallback to the original catalog route
      try {
        const response = await axios.get(`${API_URL}/api/catalog`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setCourses(response.data);
      } catch (err: any) {
        console.error('Fallback route also failed:', err);
        setError('Failed to fetch course catalog. Please try again later.');
      }
    } catch (err: any) {
      console.error('Error fetching catalog:', err);
      setError(err.response?.data?.message || 'Failed to fetch course catalog');
    } finally {
      setLoading(false);
    }
  };

  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.instructor.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.instructor.lastName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSubject = !selectedSubject || course.catalog?.subject === selectedSubject;
    
    return matchesSearch && matchesSubject;
  });

  const subjects = [...new Set(courses.map(course => course.catalog?.subject).filter(Boolean))];

  const handleEnrollment = async (courseId: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/api/courses/${courseId}/enroll`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Enrollment request submitted successfully! Waiting for teacher approval.');
      // Refresh the catalog to update enrollment counts and status
      await fetchCatalog();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to submit enrollment request');
    }
  };

  const handleUnenrollment = async (courseId: string) => {
    if (!confirm('Are you sure you want to unenroll from this course? This action cannot be undone.')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/api/courses/${courseId}/unenroll-self`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('Successfully unenrolled from the course!');
      // Refresh the catalog to update enrollment counts and status
      await fetchCatalog();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to unenroll from the course');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-4">{error}</div>
        <div className="space-y-2">
          <button 
            onClick={fetchCatalog}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 mr-2"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Course Catalog</h1>
          <p className="text-gray-600">Browse and discover courses available at your institution</p>
        </div>

        {/* Search and Filters */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search courses by title, description, or instructor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Filter className="w-5 h-5" />
              Filters
            </button>
          </div>

          {/* Filter Options */}
          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                             <div>
                 <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                 <select
                   value={selectedSubject}
                   onChange={(e) => setSelectedSubject(e.target.value)}
                   className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                 >
                   <option value="">All Subjects</option>
                   {subjects.map(subject => (
                     <option key={subject} value={subject}>{subject}</option>
                   ))}
                 </select>
               </div>
            </div>
          )}
        </div>

        {/* Results Count */}
        <div className="mb-6">
          <p className="text-gray-600">
            Showing {filteredCourses.length} of {courses.length} courses
          </p>
        </div>

                            {/* Course List */}
                    {filteredCourses.length === 0 ? (
                      <div className="text-center py-12">
                        <BookOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No courses found</h3>
                        <p className="text-gray-500">Try adjusting your search criteria or filters</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {filteredCourses.map(course => (
                          <CourseListItem
                            key={course._id}
                            course={course}
                            onEnroll={handleEnrollment}
                            onUnenroll={handleUnenrollment}
                          />
                        ))}
                      </div>
                    )}
      </div>
    </div>
  );
};

// Course List Item Component
interface CourseListItemProps {
  course: Course;
  onEnroll: (courseId: string) => void;
  onUnenroll: (courseId: string) => void;
}

const CourseListItem: React.FC<CourseListItemProps> = ({ course, onEnroll, onUnenroll }) => {
  const { user } = useAuth();
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleEnroll = async () => {
    setIsEnrolling(true);
    try {
      await onEnroll(course._id);
    } finally {
      setIsEnrolling(false);
    }
  };

  const currentEnrollment = course.students?.length || 0;
  const maxStudents = course.catalog?.maxStudents || 0;
  const enrollmentText = maxStudents > 0 ? `${currentEnrollment}/${maxStudents}` : `${currentEnrollment} enrolled`;
  
  // Check if capacity is overridden (more students than max capacity)
  const isCapacityOverridden = maxStudents > 0 && currentEnrollment > maxStudents;
  
  // Check if user is already enrolled
  const isEnrolled = () => {
    if (!user) return false;
    return course.students?.some((student: any) => student._id === user._id) || false;
  };



  // Check if user is on waitlist
  const isOnWaitlist = () => {
    if (!user) return false;
    return course.waitlist?.some((entry: any) => entry.student._id === user._id) || false;
  };

  // Get user's waitlist position
  const getWaitlistPosition = () => {
    if (!user) return null;
    const waitlistEntry = course.waitlist?.find((entry: any) => entry.student._id === user._id);
    return waitlistEntry ? waitlistEntry.position : null;
  };

  // Check if course is full
  const isCourseFull = () => {
    const maxStudents = course.catalog?.maxStudents || 0;
    return maxStudents > 0 && (course.students?.length || 0) >= maxStudents;
  };

  // Check if user can enroll
  const canEnroll = () => {
    if (user?.role === 'teacher') {
      // Teachers can always enroll (can override capacity)
      return course.catalog?.allowTeacherEnrollment || true;
    }
    // Students can enroll if they're not already enrolled and not on waitlist
    return !isEnrolled() && !isOnWaitlist();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200">
      {/* Compact View */}
      <div 
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Course Icon */}
            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>

            {/* Course Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-semibold text-gray-900">{course.title}</h3>
                {course.catalog?.subject && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    {course.catalog.subject}
                  </span>
                )}
              </div>
              
              <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                <div className="flex items-center">
                  <User className="w-4 h-4 mr-1" />
                  <span>{course.instructor.firstName} {course.instructor.lastName}</span>
                </div>
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-1" />
                  <span className={isCapacityOverridden ? 'text-orange-600 font-medium' : ''}>
                    {enrollmentText}
                    {isCapacityOverridden && ' (Over Capacity)'}
                  </span>
                </div>
                {isEnrolled() && (
                  <div className="flex items-center">
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                      ✓ Enrolled
                    </span>
                  </div>
                )}

                {isOnWaitlist() && (
                  <div className="flex items-center">
                    <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full font-medium">
                      📋 Waitlist Position {getWaitlistPosition()}
                    </span>
                  </div>
                )}
                {isCourseFull() && !isOnWaitlist() && (
                  <div className="flex items-center">
                    <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full font-medium">
                      🚫 Course Full
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Expand/Collapse Icon */}
          <div className="flex-shrink-0">
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Course Description */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Course Description</h4>
              <p className="text-gray-600 text-sm leading-relaxed">
                {course.catalog?.description || course.description}
              </p>
            </div>

            {/* Course Details */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Course Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Instructor:</span>
                  <span className="font-medium">{course.instructor.firstName} {course.instructor.lastName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Enrollment:</span>
                  <span className={`font-medium ${isCapacityOverridden ? 'text-orange-600' : ''}`}>
                    {enrollmentText}
                    {isCapacityOverridden && ' (Over Capacity)'}
                  </span>
                </div>
                {isCourseFull() && course.waitlist && course.waitlist.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Waitlist:</span>
                    <span className="font-medium text-orange-600">{course.waitlist.length} students waiting</span>
                  </div>
                )}
                {course.catalog?.prerequisites && course.catalog.prerequisites.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Prerequisites:</span>
                    <span className="font-medium">{course.catalog.prerequisites.join(', ')}</span>
                  </div>
                )}
                {course.catalog?.startDate && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Start Date:</span>
                    <span className="font-medium">{new Date(course.catalog.startDate).toLocaleDateString()}</span>
                  </div>
                )}
                {course.catalog?.endDate && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">End Date:</span>
                    <span className="font-medium">{new Date(course.catalog.endDate).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tags */}
          {course.catalog?.tags && course.catalog.tags.length > 0 && (
            <div className="mt-4">
              <h4 className="font-semibold text-gray-900 mb-2">Tags</h4>
              <div className="flex flex-wrap gap-1">
                {course.catalog.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Enrollment Action */}
          <div className="mt-6 flex justify-end">
            {isEnrolled() ? (
              <div className="flex items-center space-x-3">
                <span className="text-green-600 font-medium">✓ Enrolled</span>
                <button
                  onClick={() => onUnenroll(course._id)}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Unenroll
                </button>
              </div>
            ) : isOnWaitlist() ? (
              <div className="flex items-center space-x-3">
                <span className="text-orange-600 font-medium">📋 Waitlist Position {getWaitlistPosition()}</span>
                <button
                  disabled
                  className="px-6 py-2 bg-gray-400 text-white rounded-lg cursor-not-allowed transition-colors font-medium"
                >
                  On Waitlist
                </button>
              </div>
            ) : canEnroll() ? (
              <button
                onClick={handleEnroll}
                disabled={isEnrolling}
                className={`px-6 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium ${
                  isCourseFull() 
                    ? 'bg-orange-600 hover:bg-orange-700' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isEnrolling ? 'Processing...' : 
                  isCourseFull() && user?.role === 'teacher' ? 'Enroll (Override Capacity)' :
                  isCourseFull() ? 'Join Waitlist' : 'Enroll'}
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default Catalog; 