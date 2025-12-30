import React from 'react';
import { getImageUrl } from '../../services/api';

interface WaitlistedStudentsProps {
  course: any;
  handleApproveEnrollment: (studentId: string) => void;
  handleDenyEnrollment: (studentId: string) => void;
}

const WaitlistedStudents: React.FC<WaitlistedStudentsProps> = ({
  course,
  handleApproveEnrollment,
  handleDenyEnrollment,
}) => {
  const waitlistedCount = course.enrollmentRequests?.filter((req: any) => req.status === 'waitlisted').length || 0;
  const waitlistedRequests = course.enrollmentRequests?.filter((req: any) => req.status === 'waitlisted') || [];

  return (
    <div className="mb-8 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-700">
      <h3 className="text-lg font-semibold mb-4 text-orange-800 dark:text-orange-200">
        Waitlisted Students - Pending Approval ({waitlistedCount})
      </h3>
      {course.catalog?.maxStudents && course.students.length >= course.catalog.maxStudents && (
        <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-600 rounded text-sm text-blue-700 dark:text-blue-300">
          💡 <strong>Note:</strong> As a teacher, you can approve waitlisted students to enroll them in the course, even when it's full. You can also override capacity by enrolling students directly.
        </div>
      )}
      {waitlistedCount === 0 ? (
        <div className="text-center text-orange-700 dark:text-orange-300 py-4">
          No waitlisted students at this time.
        </div>
      ) : (
        <div className="space-y-3">
          {waitlistedRequests.map((request: any, idx: number) => {
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
  );
};

export default WaitlistedStudents;
























