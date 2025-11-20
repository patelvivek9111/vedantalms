import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { getImageUrl } from '../services/api';

interface Student {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture?: string;
}

interface EnrollmentRequest {
  _id: string;
  student: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    profilePicture?: string;
  };
  status: 'pending' | 'approved' | 'denied';
  requestDate: string;
  responseDate?: string;
  teacherNotes?: string;
  studentNotes?: string;
}

const CoursePeople: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollmentRequests, setEnrollmentRequests] = useState<EnrollmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isTeacherOrAdmin = user?.role === 'teacher' || user?.role === 'admin';

  useEffect(() => {
    
    if (!courseId) return;

    const fetchCoursePeople = async () => {
      
      try {
        setLoading(true);
        setError(null);

        // Fetch enrolled students
        const studentsRes = await api.get(`/courses/${courseId}/students`);
        setStudents(studentsRes.data);

        // Fetch enrollment requests directly from the course
        if (isTeacherOrAdmin) {
          try {
            const requestsRes = await api.get(`/courses/${courseId}/enrollment-requests`);
            setEnrollmentRequests(requestsRes.data);
          } catch (err: any) {
            // Don't set error for enrollment requests
          }
        }
      } catch (err: any) {
        setError('Failed to load course people');
        console.error('Error fetching course people:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCoursePeople();
  }, [courseId, isTeacherOrAdmin]);

  const handleApproveEnrollment = async (studentId: string) => {
    try {
      await api.post(`/courses/${courseId}/enrollment/${studentId}/approve`);
      
      // Remove from enrollment requests
      setEnrollmentRequests(prev => prev.filter(req => req.student._id !== studentId));
      
      // Refresh the students list to show the newly enrolled student
      const studentsRes = await api.get(`/courses/${courseId}/students`);
      setStudents(studentsRes.data);
      
      alert('Enrollment approved successfully!');
    } catch (err: any) {
      console.error('Error approving enrollment:', err);
      alert('Failed to approve enrollment');
    }
  };

  const handleDenyEnrollment = async (studentId: string) => {
    try {
      await api.post(`/courses/${courseId}/enrollment/${studentId}/deny`);
      
      // Remove from enrollment requests
      setEnrollmentRequests(prev => prev.filter(req => req.student._id !== studentId));
      
      alert('Enrollment denied successfully!');
    } catch (err: any) {
      console.error('Error denying enrollment:', err);
      alert('Failed to deny enrollment');
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    if (!confirm('Are you sure you want to remove this student from the course?')) {
      return;
    }

    try {
      await api.post(`/courses/${courseId}/unenroll`, { studentId });
      setStudents(prev => prev.filter(student => student._id !== studentId));
    } catch (err: any) {
      console.error('Error removing student:', err);
      alert('Failed to remove student');
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className="text-center text-gray-900 dark:text-gray-100">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className="text-red-500 dark:text-red-400 text-center">{error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-6 lg:py-8 px-2 sm:px-4">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6 sm:mb-8">Course People</h1>

      {/* Enrollment Requests */}
      {isTeacherOrAdmin && (
        <div className="mb-6 sm:mb-8">
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-orange-600 dark:text-orange-400">
            Pending Enrollment Requests ({enrollmentRequests.length})
          </h3>
          {enrollmentRequests.length === 0 ? (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3 sm:p-4 text-center text-sm sm:text-base text-orange-700 dark:text-orange-300">
              No pending enrollment requests at this time.
            </div>
          ) : (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3 sm:p-4">
              {enrollmentRequests.map((request) => (
                <div key={request._id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg mb-3">
                  <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-300 dark:bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                      {request.student.profilePicture ? (
                        <img 
                          src={request.student.profilePicture.startsWith('http') 
                            ? request.student.profilePicture 
                            : getImageUrl(request.student.profilePicture)} 
                          alt={`${request.student.firstName} ${request.student.lastName}`}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-gray-600 dark:text-gray-300 font-medium">
                          {request.student.firstName.charAt(0)}{request.student.lastName.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm sm:text-base text-gray-800 dark:text-gray-100 break-words">{request.student.firstName} {request.student.lastName} wants to join</p>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        Requested on {new Date(request.requestDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex w-full sm:w-auto space-x-2">
                    <button
                      onClick={() => handleApproveEnrollment(request.student._id)}
                      className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-green-500 dark:bg-green-600 text-white rounded-lg text-xs sm:text-sm hover:bg-green-600 dark:hover:bg-green-700 transition-colors font-medium"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleDenyEnrollment(request.student._id)}
                      className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-red-500 dark:bg-red-600 text-white rounded-lg text-xs sm:text-sm hover:bg-red-600 dark:hover:bg-red-700 transition-colors font-medium"
                    >
                      Deny
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Enrolled Students */}
      <div>
        <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-900 dark:text-gray-100">
          Enrolled Students ({students.length})
        </h3>
        {students.length === 0 ? (
          <div className="text-sm sm:text-base text-gray-500 dark:text-gray-400 text-center py-6 sm:py-8">No students enrolled yet.</div>
        ) : (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            {students.map((student) => (
              <div key={student._id} className="flex items-center justify-between gap-3 p-3 sm:p-4 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-300 dark:bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                    {student.profilePicture ? (
                      <img 
                        src={student.profilePicture.startsWith('http') 
                          ? student.profilePicture 
                          : getImageUrl(student.profilePicture)} 
                        alt={`${student.firstName} ${student.lastName}`}
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-gray-600 dark:text-gray-300 font-medium text-sm sm:text-base">
                        {student.firstName.charAt(0)}{student.lastName.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm sm:text-base text-gray-800 dark:text-gray-100 truncate">
                      {student.firstName} {student.lastName}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{student.email}</p>
                  </div>
                </div>
                {isTeacherOrAdmin && (
                  <button
                    onClick={() => handleRemoveStudent(student._id)}
                    className="flex-shrink-0 p-2 bg-red-600 dark:bg-red-600 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-700 transition-colors"
                    title="Remove student"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CoursePeople; 