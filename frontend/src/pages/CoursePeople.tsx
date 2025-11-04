import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

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
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className="text-red-500 text-center">{error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Course People</h1>

      {/* Enrollment Requests */}
      {isTeacherOrAdmin && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4 text-orange-600">
            Pending Enrollment Requests ({enrollmentRequests.length})
          </h3>
          {enrollmentRequests.length === 0 ? (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center text-orange-700">
              No pending enrollment requests at this time.
            </div>
          ) : (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              {enrollmentRequests.map((request) => (
                <div key={request._id} className="flex items-center justify-between p-3 bg-white rounded-lg mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                      {request.student.profilePicture ? (
                        <img 
                          src={request.student.profilePicture} 
                          alt={`${request.student.firstName} ${request.student.lastName}`}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-gray-600 font-medium">
                          {request.student.firstName.charAt(0)}{request.student.lastName.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{request.student.firstName} {request.student.lastName} wants to join</p>
                      <p className="text-sm text-gray-500">
                        Requested on {new Date(request.requestDate).toLocaleDateString()}
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
              ))}
            </div>
          )}
        </div>
      )}

      {/* Enrolled Students */}
      <div>
        <h3 className="text-lg font-semibold mb-4">
          Enrolled Students ({students.length})
        </h3>
        {students.length === 0 ? (
          <div className="text-gray-500 text-center py-8">No students enrolled yet.</div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg">
            {students.map((student) => (
              <div key={student._id} className="flex items-center justify-between p-4 border-b border-gray-100 last:border-b-0">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                    {student.profilePicture ? (
                      <img 
                        src={student.profilePicture} 
                        alt={`${student.firstName} ${student.lastName}`}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-gray-600 font-medium">
                        {student.firstName.charAt(0)}{student.lastName.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">
                      {student.firstName} {student.lastName}
                    </p>
                    <p className="text-sm text-gray-500">{student.email}</p>
                  </div>
                </div>
                {isTeacherOrAdmin && (
                  <button
                    onClick={() => handleRemoveStudent(student._id)}
                    className="px-3 py-1 text-red-500 hover:text-red-700 text-sm font-medium hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Remove
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