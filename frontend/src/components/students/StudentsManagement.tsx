import React from 'react';
import { getImageUrl } from '../../services/api';
import StudentCard from './StudentCard';

interface StudentsManagementProps {
  course: any;
  isInstructor: boolean;
  isAdmin: boolean;
  searchQuery: string;
  handleSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isSearching: boolean;
  searchResults: any[];
  searchError: string | null;
  handleEnroll: (studentId: string) => void;
  handleApproveEnrollment: (studentId: string) => void;
  handleDenyEnrollment: (studentId: string) => void;
  handleUnenroll: (studentId: string) => void;
}

const StudentsManagement: React.FC<StudentsManagementProps> = ({
  course,
  isInstructor,
  isAdmin,
  searchQuery,
  handleSearchChange,
  isSearching,
  searchResults,
  searchError,
  handleEnroll,
  handleApproveEnrollment,
  handleDenyEnrollment,
  handleUnenroll,
}) => {
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
        
        {/* Waitlisted Students - NEW SECTION */}
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
              handleUnenroll={undefined}
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

export default StudentsManagement;

