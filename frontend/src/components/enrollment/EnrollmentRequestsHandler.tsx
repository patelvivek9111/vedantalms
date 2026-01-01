import React, { useEffect, useState } from 'react';
import api from '../../services/api';

interface EnrollmentRequestsHandlerProps {
  courseId: string;
}

const EnrollmentRequestsHandler: React.FC<EnrollmentRequestsHandlerProps> = ({ courseId }) => {
  const [enrollmentRequests, setEnrollmentRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEnrollmentRequests = async () => {
      try {
        const todosRes = await api.get('/todos');
        const enrollmentTodos = todosRes.data.filter((todo: any) => 
          todo.type === 'enrollment_request' && 
          todo.courseId === courseId && 
          todo.action === 'pending'
        );
        setEnrollmentRequests(enrollmentTodos);
      } catch (err) {
        console.error('Error fetching enrollment requests:', err);
      } finally {
        setLoading(false);
      }
    };

    if (courseId) {
      fetchEnrollmentRequests();
    }
  }, [courseId]);

  const handleApproveEnrollment = async (studentId: string) => {
    try {
      await api.post(`/courses/${courseId}/enrollment/${studentId}/approve`);
      setEnrollmentRequests(prev => prev.filter(req => req.studentId !== studentId));
    } catch (err) {
      console.error('Error approving enrollment:', err);
      alert('Failed to approve enrollment');
    }
  };

  const handleDenyEnrollment = async (studentId: string) => {
    try {
      await api.post(`/courses/${courseId}/enrollment/${studentId}/deny`);
      setEnrollmentRequests(prev => prev.filter(req => req.studentId !== studentId));
    } catch (err) {
      console.error('Error denying enrollment:', err);
      alert('Failed to deny enrollment');
    }
  };

  if (loading) {
    return <div className="text-gray-500">Loading enrollment requests...</div>;
  }

  if (enrollmentRequests.length === 0) {
    return <div className="text-gray-500 text-sm italic">No pending enrollment requests</div>;
  }

  return (
    <div className="space-y-3">
      {enrollmentRequests.map((request, idx: number) => (
        <div key={`enrollment-${request._id}-${idx}`} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-orange-200 dark:border-orange-700">
          <div className="flex-1">
            <p className="font-medium text-gray-800 dark:text-gray-200">{request.title}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Requested on {new Date(request.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => handleApproveEnrollment(request.studentId)}
              className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
            >
              Approve
            </button>
            <button
              onClick={() => handleDenyEnrollment(request.studentId)}
              className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
            >
              Deny
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default EnrollmentRequestsHandler;

