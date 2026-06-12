import React from 'react';
import { Search } from 'lucide-react';
import { getImageUrl } from '../../services/api';
import StudentCard from './StudentCard';
import { SectionDividerHeading } from '../common/SectionDividerHeading';

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

const CONTROL =
  'compact-control h-10 w-full rounded-lg border border-gray-200 bg-white px-3 pl-9 text-[11px] text-gray-900 transition-colors dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 sm:text-xs';
const CONTROL_FOCUS =
  'focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:border-blue-500 dark:focus:ring-blue-900/40';
const ITEM_LIST =
  'divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200/90 bg-white dark:divide-gray-800 dark:border-gray-700 dark:bg-gray-800';
const BTN_PRIMARY =
  'inline-flex h-8 items-center justify-center rounded-lg bg-blue-600 px-3 text-[10px] font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 sm:text-[11px]';
const BTN_APPROVE =
  'inline-flex h-8 flex-1 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-[10px] font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50 sm:flex-none sm:text-[11px]';
const BTN_DENY =
  'inline-flex h-8 flex-1 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 text-[10px] font-medium text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50 sm:flex-none sm:text-[11px]';

function PersonAvatar({ person, className = 'h-9 w-9' }: { person: any; className?: string }) {
  if (person?.profilePicture) {
    return (
      <img
        src={
          person.profilePicture.startsWith('http')
            ? person.profilePicture
            : getImageUrl(person.profilePicture)
        }
        alt={`${person.firstName ?? ''} ${person.lastName ?? ''}`}
        className={`${className} shrink-0 rounded-full border border-gray-200 object-cover dark:border-gray-600`}
      />
    );
  }
  return (
    <div
      className={`${className} flex shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gray-100 text-[11px] font-semibold text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300`}
    >
      {person?.firstName?.charAt(0) ?? '?'}
      {person?.lastName?.charAt(0) ?? ''}
    </div>
  );
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
  const pendingRequests =
    course.enrollmentRequests?.filter((req: any) => req.status === 'pending') ?? [];
  const waitlistedRequests =
    course.enrollmentRequests?.filter((req: any) => req.status === 'waitlisted') ?? [];
  const canManage = isInstructor || isAdmin;
  const overCapacity =
    course.catalog?.maxStudents && course.students.length > course.catalog.maxStudents;

  return (
    <div className="space-y-4">
      <p className="text-[10px] leading-relaxed text-gray-500 dark:text-gray-400 sm:text-[11px]">
        Manage enrollment, waitlist approvals, and class roster.
      </p>

      {canManage && (
        <section aria-labelledby="add-students-heading">
          <SectionDividerHeading id="add-students-heading">Add students</SectionDividerHeading>
          <div className="space-y-2 rounded-lg border border-gray-200/90 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                aria-hidden
              />
              <input
                type="search"
                placeholder="Search by name or email…"
                value={searchQuery}
                onChange={handleSearchChange}
                className={`${CONTROL} ${CONTROL_FOCUS}`}
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent dark:border-blue-400" />
                </div>
              )}
            </div>

            {searchResults.length > 0 && (
              <div className={ITEM_LIST}>
                {searchResults.map((student: any, idx: number) => (
                  <div
                    key={`search-${student._id}-${idx}`}
                    className="flex items-center gap-2.5 px-3 py-2.5 sm:gap-3"
                  >
                    <PersonAvatar person={student} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-semibold text-gray-900 dark:text-gray-100 sm:text-xs">
                        {student.firstName} {student.lastName}
                      </div>
                      <div className="truncate text-[10px] text-gray-500 dark:text-gray-400 sm:text-[11px]">
                        {student.email}
                      </div>
                    </div>
                    <button type="button" onClick={() => handleEnroll(student._id)} className={BTN_PRIMARY}>
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}

            {searchError && (
              <p className="text-[11px] text-red-600 dark:text-red-400">{searchError}</p>
            )}
          </div>
        </section>
      )}

      {canManage && pendingRequests.length > 0 && (
        <section aria-labelledby="pending-approval-heading">
          <SectionDividerHeading id="pending-approval-heading">
            Pending approval ({pendingRequests.length})
          </SectionDividerHeading>
          <p className="mb-2 text-[10px] leading-relaxed text-gray-500 dark:text-gray-400 sm:text-[11px]">
            Students who joined via QR or a join link are waiting for you to approve or deny.
          </p>
          <div className={`${ITEM_LIST} space-y-0`}>
            {pendingRequests.map((request: any, idx: number) => (
              <div
                key={`pending-${request._id ?? request.student?._id ?? idx}-${idx}`}
                className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <PersonAvatar person={request.student} />
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-gray-900 dark:text-gray-100 sm:text-xs">
                      {request.student?.firstName} {request.student?.lastName}
                    </p>
                    <p className="truncate text-[10px] text-gray-500 dark:text-gray-400 sm:text-[11px]">
                      {request.requestDate
                        ? `Requested ${new Date(request.requestDate).toLocaleDateString()}`
                        : 'Requested —'}
                      {request.student?.email ? ` · ${request.student.email}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex w-full gap-2 sm:w-auto sm:shrink-0">
                  <button
                    type="button"
                    onClick={() => handleApproveEnrollment(request.student._id)}
                    className={BTN_APPROVE}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDenyEnrollment(request.student._id)}
                    className={BTN_DENY}
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {canManage && waitlistedRequests.length > 0 && (
        <section aria-labelledby="waitlist-heading">
          <SectionDividerHeading id="waitlist-heading">
            Waitlist ({waitlistedRequests.length})
          </SectionDividerHeading>
          {course.catalog?.maxStudents && course.students.length >= course.catalog.maxStudents && (
            <p className="mb-2 rounded-lg border border-blue-200/90 bg-blue-50/80 px-3 py-2 text-[10px] leading-relaxed text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200 sm:text-[11px]">
              You can approve waitlisted students even when the course is full.
            </p>
          )}
          <div className={ITEM_LIST}>
            {waitlistedRequests.map((request: any, idx: number) => {
              const waitlistPosition = course.waitlist?.find(
                (entry: any) => entry.student._id === request.student._id
              )?.position;

              return (
                <div
                  key={`waitlist-${request._id}-${idx}`}
                  className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-3"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <PersonAvatar person={request.student} />
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-semibold text-gray-900 dark:text-gray-100 sm:text-xs">
                        {request.student.firstName} {request.student.lastName}
                        {waitlistPosition != null && (
                          <span className="ml-1 font-normal text-amber-700 dark:text-amber-400">
                            · #{waitlistPosition}
                          </span>
                        )}
                      </p>
                      <p className="truncate text-[10px] text-gray-500 dark:text-gray-400 sm:text-[11px]">
                        Waitlisted {new Date(request.requestDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex w-full gap-2 sm:w-auto sm:shrink-0">
                    <button
                      type="button"
                      onClick={() => handleApproveEnrollment(request.student._id)}
                      className={BTN_APPROVE}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDenyEnrollment(request.student._id)}
                      className={BTN_DENY}
                    >
                      Deny
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section aria-labelledby="instructor-heading">
        <SectionDividerHeading id="instructor-heading">Instructor</SectionDividerHeading>
        <div className={ITEM_LIST}>
          <StudentCard
            key={course.instructor._id || 'instructor'}
            student={course.instructor}
            isInstructorCard
            listItem
          />
        </div>
      </section>

      <section aria-labelledby="enrolled-students-heading">
        <SectionDividerHeading id="enrolled-students-heading">
          Enrolled students ({course.students.length})
          {overCapacity && (
            <span className="ml-1 font-normal normal-case tracking-normal text-amber-700 dark:text-amber-400">
              · over capacity
            </span>
          )}
        </SectionDividerHeading>
        {course.students.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 py-8 text-center dark:border-gray-700 dark:bg-gray-800/50">
            <p className="text-[11px] text-gray-500 dark:text-gray-400">No students enrolled yet.</p>
          </div>
        ) : (
          <div className={ITEM_LIST}>
            {course.students.map((student: any, idx: number) => (
              <StudentCard
                key={`student-card-${student._id}-${idx}`}
                student={student}
                isInstructor={isInstructor}
                isAdmin={isAdmin}
                handleUnenroll={handleUnenroll}
                listItem
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default StudentsManagement;
