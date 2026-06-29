import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import api from '../services/api';
import { Search, Filter, BookOpen, User, Users, ChevronDown } from 'lucide-react';
import ConfirmationModal from '../components/common/ConfirmationModal';
import SwipeableContainer from '../components/common/SwipeableContainer';
import { MobileAppShell } from '../components/common/MobileAppShell';
import { useBottomNavSwipe } from '../hooks/useBottomNavSwipe';

/** Match InboxToolbar control sizing */
const CONTROL =
  'h-10 rounded-lg border border-gray-200 transition-colors dark:border-gray-700';
const CONTROL_TEXT =
  'text-[10px] font-medium text-gray-600 sm:text-[11px] dark:text-gray-300';
const DESKTOP_CONTROL_TEXT = 'lg:text-xs lg:font-medium lg:text-gray-600 dark:lg:text-gray-300';
const CONTROL_FOCUS =
  'focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:border-blue-500 dark:focus:ring-blue-900/40';

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
    creditHours?: number;
    courseCode?: string;
    enrollmentDeadline: Date;
    startDate: Date;
    endDate: Date;
    tags: string[];
    thumbnail: string;
    syllabus: string;
    allowTeacherEnrollment: boolean;
  };
  published: boolean;
  /** Legacy shape (pre-browse); browse API omits these and sends flags below */
  students?: any[];
  enrollmentRequests?: any[];
  waitlist?: any[];
  studentCount?: number;
  waitlistCount?: number;
  isEnrolled?: boolean;
  isOnWaitlist?: boolean;
  hasEnrollmentRequest?: boolean;
  waitlistPosition?: number | null;
}

const Catalog: React.FC = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Swipe navigation for bottom nav
  const { handleSwipeLeft, handleSwipeRight, enabled: swipeEnabled } = useBottomNavSwipe();

  useEffect(() => {
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to view the course catalog');
        return;
      }

      try {
        const response = await api.get('/courses/available/browse');
        if (response.data?.success) {
          setCourses(Array.isArray(response.data.data) ? response.data.data : []);
          return;
        }
      } catch {
        // fall through to legacy catalog route
      }

      const response = await api.get('/catalog');
      const payload = response.data;
      const list = Array.isArray(payload) ? payload : payload?.data;
      setCourses(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch course catalog');
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredCourses = courses.filter(course => {
    // Only show courses if there's a search term or subject filter applied
    if (!searchTerm && !selectedSubject) {
      return false;
    }
    
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
                         course.title.toLowerCase().includes(searchLower) ||
                         course.catalog?.courseCode?.toLowerCase().includes(searchLower) ||
                         course.description.toLowerCase().includes(searchLower) ||
                         course.instructor.firstName.toLowerCase().includes(searchLower) ||
                         course.instructor.lastName.toLowerCase().includes(searchLower);
    
    const matchesSubject = !selectedSubject || course.catalog?.subject === selectedSubject;
    
    return matchesSearch && matchesSubject;
  });

  const subjects = [...new Set(courses.map(course => course.catalog?.subject).filter(Boolean))];

  const handleEnrollment = async (courseId: string) => {
    try {
      const res = await api.post(`/courses/${courseId}/enroll`, {});
      const d = res.data || {};
      if (d.waitlisted) {
        toast.success(d.message || 'You have been added to the waitlist. Your instructor will review your request.');
      } else if (d.capacityOverridden) {
        toast.success(d.message || 'You are enrolled in this course.');
      } else {
        toast.success(d.message || 'You are now enrolled in this course.');
      }
      await fetchCatalog();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not complete enrollment. Please try again.');
    }
  };

  const handleUnenrollment = async (courseId: string) => {
    try {
      await api.post(`/courses/${courseId}/unenroll-self`, {});
      toast.success('You have been removed from this course.');
      await fetchCatalog();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not unenroll. Please try again.');
    }
  };

  const catalogContent = loading ? (
    <div className="flex items-center justify-center py-16">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent dark:border-blue-400" />
    </div>
  ) : error ? (
    <div className="py-8 text-center">
      <p className="mb-3 text-[11px] text-red-600 dark:text-red-400 sm:text-xs">{error}</p>
      <button
        type="button"
        onClick={fetchCatalog}
        className={`${CONTROL} ${CONTROL_TEXT} ${DESKTOP_CONTROL_TEXT} ${CONTROL_FOCUS} inline-flex items-center bg-blue-600 px-4 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600`}
      >
        Try Again
      </button>
    </div>
  ) : (
    <>
      <div className="space-y-1 lg:mb-4">
        <h1 className="hidden text-2xl font-bold text-gray-900 dark:text-gray-100 lg:block">
          Course Catalog
        </h1>
        <p className="text-[10px] leading-relaxed text-gray-500 dark:text-gray-400 sm:text-[11px] lg:text-sm lg:text-gray-600">
          Browse and discover courses available at your institution
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <label htmlFor="catalog-search" className="sr-only">
              Search courses
            </label>
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
              aria-hidden
            />
            <input
              id="catalog-search"
              type="search"
              placeholder="Search courses by title, code, or instructor"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`compact-control ${CONTROL} ${CONTROL_TEXT} ${DESKTOP_CONTROL_TEXT} ${CONTROL_FOCUS} w-full bg-gray-50 pl-9 pr-3 text-gray-900 placeholder:font-normal placeholder:text-[10px] placeholder:text-gray-400 focus:bg-white sm:placeholder:text-[11px] dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:bg-gray-800`}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`compact-control ${CONTROL} ${CONTROL_TEXT} ${DESKTOP_CONTROL_TEXT} inline-flex w-full items-center justify-center gap-1.5 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700/80 md:w-auto md:shrink-0 md:px-4 ${showFilters ? 'border-blue-400 ring-2 ring-blue-100 dark:border-blue-500 dark:ring-blue-900/40' : ''}`}
            aria-expanded={showFilters}
          >
            <Filter size={14} strokeWidth={2} aria-hidden />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="rounded-lg border border-gray-200/90 bg-white p-2.5 dark:border-gray-700 dark:bg-gray-800 sm:p-3">
            <label htmlFor="catalog-subject-select" className="sr-only">
              Subject
            </label>
            <div className="relative">
              <select
                id="catalog-subject-select"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className={`compact-control ${CONTROL} ${CONTROL_TEXT} ${DESKTOP_CONTROL_TEXT} ${CONTROL_FOCUS} w-full appearance-none bg-white px-3 pr-9 dark:bg-gray-800`}
              >
                <option value="">All Subjects</option>
                {subjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                aria-hidden
              />
            </div>
          </div>
        )}
      </div>

      {(searchTerm || selectedSubject) && (
        <p className="text-[10px] text-gray-500 dark:text-gray-400 sm:text-[11px]">
          Showing {filteredCourses.length} of {courses.length} courses
        </p>
      )}

      {!searchTerm && !selectedSubject ? (
        <div className="rounded-lg border border-gray-200/90 bg-white py-10 text-center dark:border-gray-700 dark:bg-gray-800">
          <BookOpen className="mx-auto mb-2.5 h-8 w-8 text-gray-300 dark:text-gray-600" strokeWidth={1.5} />
          <h3 className="text-[11px] font-semibold text-gray-900 dark:text-gray-100 sm:text-xs">
            Search for courses
          </h3>
          <p className="mx-auto mt-1 max-w-xs px-4 text-[10px] leading-relaxed text-gray-500 dark:text-gray-400 sm:text-[11px]">
            Enter a search term or select a filter to browse available courses
          </p>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="rounded-lg border border-gray-200/90 bg-white py-10 text-center dark:border-gray-700 dark:bg-gray-800">
          <BookOpen className="mx-auto mb-2.5 h-8 w-8 text-gray-300 dark:text-gray-600" strokeWidth={1.5} />
          <h3 className="text-[11px] font-semibold text-gray-900 dark:text-gray-100 sm:text-xs">
            No courses found
          </h3>
          <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400 sm:text-[11px]">
            Try adjusting your search criteria or filters
          </p>
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {filteredCourses.map((course) => (
            <CourseListItem
              key={course._id}
              course={course}
              onEnroll={handleEnrollment}
              onUnenroll={handleUnenrollment}
            />
          ))}
        </div>
      )}
    </>
  );

  return (
    <SwipeableContainer
      onSwipeLeft={swipeEnabled ? handleSwipeLeft : undefined}
      onSwipeRight={swipeEnabled ? handleSwipeRight : undefined}
      enabled={swipeEnabled}
      preventScrollInterference={true}
      className="min-h-screen bg-gray-50 dark:bg-gray-900"
    >
      <MobileAppShell title="Catalog">
        <div className="mx-auto w-full max-w-7xl space-y-2 px-4 py-3 sm:space-y-3 lg:space-y-4 lg:p-6">
          {catalogContent}
        </div>
      </MobileAppShell>
    </SwipeableContainer>
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
  const [showUnenrollConfirm, setShowUnenrollConfirm] = useState(false);

  const handleEnroll = async () => {
    setIsEnrolling(true);
    try {
      await onEnroll(course._id);
    } finally {
      setIsEnrolling(false);
    }
  };

  const currentEnrollment =
    course.studentCount ?? course.students?.length ?? 0;
  const maxStudents = course.catalog?.maxStudents || 0;
  const enrollmentText = maxStudents > 0 ? `${currentEnrollment}/${maxStudents}` : `${currentEnrollment} enrolled`;
  
  // Check if capacity is overridden (more students than max capacity)
  const isCapacityOverridden = maxStudents > 0 && currentEnrollment > maxStudents;
  
  const userMatchesId = (id: unknown) =>
    user && String((id as { _id?: string })?._id ?? id) === String(user._id);

  // Check if user is already enrolled (browse API sets isEnrolled; legacy routes may still send students[])
  const isEnrolled = () => {
    if (course.isEnrolled != null) return course.isEnrolled;
    if (!user) return false;
    return course.students?.some((student: any) => userMatchesId(student)) || false;
  };

  // Check if user is on waitlist
  const isOnWaitlist = () => {
    if (course.isOnWaitlist != null) return course.isOnWaitlist;
    if (!user) return false;
    return course.waitlist?.some((entry: any) => userMatchesId(entry.student)) || false;
  };

  // Get user's waitlist position
  const getWaitlistPosition = () => {
    if (course.waitlistPosition != null) return course.waitlistPosition;
    if (!user) return null;
    const waitlistEntry = course.waitlist?.find((entry: any) => userMatchesId(entry.student));
    return waitlistEntry ? waitlistEntry.position : null;
  };

  // Check if course is full
  const isCourseFull = () => {
    const max = course.catalog?.maxStudents || 0;
    return max > 0 && currentEnrollment >= max;
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
    <div className="overflow-hidden rounded-lg border border-gray-200/90 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div
        className="cursor-pointer p-3 transition-colors hover:bg-gray-50 active:bg-gray-50 dark:hover:bg-gray-700/40 sm:p-4"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/50 sm:h-9 sm:w-9">
              <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" strokeWidth={2} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="text-[11px] font-semibold text-gray-900 dark:text-gray-100 sm:text-sm">
                  {course.catalog?.courseCode || course.title}
                </h3>
                {course.catalog?.subject && (
                  <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                    {course.catalog.subject}
                  </span>
                )}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-gray-500 dark:text-gray-400 sm:text-[11px]">
                <span className="inline-flex items-center gap-0.5">
                  <User className="h-3 w-3 shrink-0" />
                  {course.instructor.firstName} {course.instructor.lastName}
                </span>
                {course.catalog?.creditHours && (
                  <span className="inline-flex items-center gap-0.5">
                    <BookOpen className="h-3 w-3 shrink-0" />
                    {course.catalog.creditHours} {course.catalog.creditHours === 1 ? 'cr' : 'crs'}
                  </span>
                )}
                <span className={`inline-flex items-center gap-0.5 ${isCapacityOverridden ? 'font-medium text-orange-600 dark:text-orange-400' : ''}`}>
                  <Users className="h-3 w-3 shrink-0" />
                  {enrollmentText}
                  {isCapacityOverridden && ' (over)'}
                </span>
              </div>

              <div className="mt-1.5 flex flex-wrap gap-1">
                {isEnrolled() && (
                  <span className="rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-950/40 dark:text-green-300">
                    Enrolled
                  </span>
                )}
                {isOnWaitlist() && (
                  <span className="rounded-full bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
                    Waitlist #{getWaitlistPosition()}
                  </span>
                )}
                {isCourseFull() && !isOnWaitlist() && !isEnrolled() && (
                  <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
                    Full
                  </span>
                )}
              </div>
            </div>
          </div>

          <ChevronDown
            size={14}
            className={`mt-0.5 shrink-0 text-gray-400 transition-transform dark:text-gray-500 ${isExpanded ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-100 bg-gray-50/80 p-3 dark:border-gray-700/60 dark:bg-gray-900/50 sm:p-4 lg:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
            <div>
              <h4 className="mb-1.5 text-[11px] font-semibold text-gray-900 dark:text-gray-100 sm:text-xs">
                Course Description
              </h4>
              <p className="text-[10px] leading-relaxed text-gray-600 dark:text-gray-400 sm:text-[11px]">
                {course.catalog?.description || course.description}
              </p>
            </div>

            <div>
              <h4 className="mb-1.5 text-[11px] font-semibold text-gray-900 dark:text-gray-100 sm:text-xs">
                Course Details
              </h4>
              <div className="space-y-1.5 text-[10px] sm:text-[11px]">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Instructor:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{course.instructor.firstName} {course.instructor.lastName}</span>
                </div>
                {course.catalog?.creditHours && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Credit Hours:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{course.catalog.creditHours} {course.catalog.creditHours === 1 ? 'Credit' : 'Credits'}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Enrollment:</span>
                  <span className={`font-medium ${isCapacityOverridden ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-gray-100'}`}>
                    {enrollmentText}
                    {isCapacityOverridden && ' (Over Capacity)'}
                  </span>
                </div>
                {isCourseFull() && (course.waitlistCount ?? course.waitlist?.length ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Waitlist:</span>
                    <span className="font-medium text-orange-600 dark:text-orange-400">
                      {course.waitlistCount ?? course.waitlist?.length ?? 0} students waiting
                    </span>
                  </div>
                )}
                {course.catalog?.prerequisites && course.catalog.prerequisites.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Prerequisites:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{course.catalog.prerequisites.join(', ')}</span>
                  </div>
                )}
                {course.catalog?.startDate && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Start Date:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{new Date(course.catalog.startDate).toLocaleDateString()}</span>
                  </div>
                )}
                {course.catalog?.endDate && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">End Date:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{new Date(course.catalog.endDate).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {course.catalog?.tags && course.catalog.tags.length > 0 && (
            <div className="mt-3">
              <h4 className="mb-1.5 text-[11px] font-semibold text-gray-900 dark:text-gray-100 sm:text-xs">Tags</h4>
              <div className="flex flex-wrap gap-1">
                {course.catalog.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            {isEnrolled() ? (
              <>
                <span className="text-[10px] font-medium text-green-600 dark:text-green-400 sm:text-[11px]">
                  Enrolled
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowUnenrollConfirm(true);
                  }}
                  className={`${CONTROL} ${CONTROL_TEXT} ${DESKTOP_CONTROL_TEXT} bg-red-600 px-4 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600`}
                >
                  Unenroll
                </button>
              </>
            ) : isOnWaitlist() ? (
              <>
                <span className="text-[10px] font-medium text-orange-600 dark:text-orange-400 sm:text-[11px]">
                  Waitlist #{getWaitlistPosition()}
                </span>
                <button
                  type="button"
                  disabled
                  className={`${CONTROL} ${CONTROL_TEXT} cursor-not-allowed bg-gray-300 text-gray-500 dark:bg-gray-600 dark:text-gray-400`}
                >
                  On Waitlist
                </button>
              </>
            ) : canEnroll() ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEnroll();
                }}
                disabled={isEnrolling}
                className={`${CONTROL} ${CONTROL_TEXT} ${DESKTOP_CONTROL_TEXT} px-4 text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                  isCourseFull()
                    ? 'bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600'
                    : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
                }`}
              >
                {isEnrolling
                  ? 'Processing…'
                  : isCourseFull() && user?.role === 'teacher'
                    ? 'Enroll (override)'
                    : isCourseFull()
                      ? 'Join waitlist'
                      : 'Enroll'}
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* Unenroll Confirmation Modal */}
      <ConfirmationModal
        isOpen={showUnenrollConfirm}
        onClose={() => setShowUnenrollConfirm(false)}
        onConfirm={() => {
          setShowUnenrollConfirm(false);
          onUnenroll(course._id);
        }}
        title="Unenroll from Course"
        message="Are you sure you want to unenroll from this course? This action cannot be undone."
        confirmText="Unenroll"
        cancelText="Cancel"
        variant="warning"
      />
    </div>
  );
};

export default Catalog; 