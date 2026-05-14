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
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-md dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-5 rounded-xl border border-gray-200 bg-gray-50/80 p-3 dark:border-gray-700 dark:bg-gray-800/70">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Manage enrollment, waitlist approvals, and class roster</p>
        </div>
        
        {/* Student Search Section */}
        {(isInstructor || isAdmin) && (
          <div className="mb-8 rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-800/70">
            <h3 className="mb-3 text-base font-semibold text-gray-800 dark:text-gray-100">Add Students</h3>
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
                <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Search Results</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {searchResults.map((student: any, idx: number) => (
                    <div key={`search-${student._id}-${idx}`} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-600 dark:bg-gray-700">
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
                        className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
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
        
        {/* Pending join requests (QR / join link — not on roster until you approve) */}
        {(isInstructor || isAdmin) &&
          course.enrollmentRequests?.filter((req: any) => req.status === 'pending').length > 0 && (
            <div className="mb-8 rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-800 dark:bg-blue-900/15">
              <h3 className="mb-2 text-base font-semibold text-blue-950 dark:text-blue-100">
                Pending approval (
                {course.enrollmentRequests?.filter((req: any) => req.status === 'pending').length || 0})
              </h3>
              <p className="mb-3 text-sm text-blue-900/85 dark:text-blue-200/90">
                Students who joined via QR or a join link are waiting for you to approve or deny their request.
              </p>
              <div className="space-y-3">
                {course.enrollmentRequests
                  .filter((req: any) => req.status === 'pending')
                  .map((request: any, idx: number) => (
                    <div
                      key={`pending-${request._id ?? request.student?._id ?? idx}-${idx}`}
                      className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between dark:border-blue-800 dark:bg-slate-900/40"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
                          {request.student?.profilePicture ? (
                            <img
                              src={
                                request.student.profilePicture.startsWith('http')
                                  ? request.student.profilePicture
                                  : getImageUrl(request.student.profilePicture)
                              }
                              alt={`${request.student.firstName ?? ''} ${request.student.lastName ?? ''}`}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                              {request.student?.firstName?.charAt(0) ?? '?'}
                              {request.student?.lastName?.charAt(0) ?? ''}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {request.student?.firstName} {request.student?.lastName}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Requested {request.requestDate ? new Date(request.requestDate).toLocaleDateString() : '—'}
                            {request.student?.email ? ` · ${request.student.email}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex w-full gap-2 sm:w-auto sm:shrink-0">
                        <button
                          type="button"
                          onClick={() => handleApproveEnrollment(request.student._id)}
                          className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200 dark:hover:bg-emerald-900/50 sm:flex-none"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDenyEnrollment(request.student._id)}
                          className="flex-1 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800 transition-colors hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200 dark:hover:bg-rose-900/50 sm:flex-none"
                        >
                          Deny
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

        {/* Waitlisted Students - NEW SECTION */}
        {(isInstructor || isAdmin) &&
          course.enrollmentRequests?.filter((req: any) => req.status === 'waitlisted').length > 0 && (
          <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-900/10">
            <h3 className="mb-3 text-base font-semibold text-amber-900 dark:text-amber-200">
              Waitlisted Students ({course.enrollmentRequests?.filter((req: any) => req.status === 'waitlisted').length || 0})
            </h3>
            {course.catalog?.maxStudents && course.students.length >= course.catalog.maxStudents && (
              <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-2 text-sm text-blue-700 dark:border-blue-600 dark:bg-blue-900/20 dark:text-blue-300">
                💡 <strong>Note:</strong> As a teacher, you can approve waitlisted students to enroll them in the course, even when it's full. You can also override capacity by enrolling students directly.
              </div>
            )}
            <div className="space-y-3">
              {course.enrollmentRequests
                .filter((req: any) => req.status === 'waitlisted')
                .map((request: any, idx: number) => {
                  const waitlistPosition = course.waitlist?.find((entry: any) => entry.student._id === request.student._id)?.position;
                  
                  return (
                    <div key={`waitlist-${request._id}-${idx}`} className="flex items-center justify-between rounded-lg border border-amber-300 bg-white p-3 dark:border-amber-700 dark:bg-amber-900/20">
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
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleDenyEnrollment(request.student._id)}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300 dark:hover:bg-rose-900/50"
                        >
                          Deny
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
        
        {/* Instructor FIRST */}
        <div className="mb-8">
          <h3 className="mb-3 text-lg font-semibold text-gray-800 dark:text-gray-100">Instructor</h3>
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
          <h3 className="mb-3 text-lg font-semibold text-gray-800 dark:text-gray-100">
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
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
              No students enrolled yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentsManagement;

