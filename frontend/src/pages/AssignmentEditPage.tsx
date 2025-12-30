import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config';
import CreateAssignmentForm from '../components/assignments/CreateAssignmentForm';
import logger from '../utils/logger';

const AssignmentEditPage: React.FC = () => {
  const { id, courseId } = useParams<{ id: string; courseId?: string }>();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchAssignment = async () => {
      if (!id) {
        setError('Assignment ID is required');
        setLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('No authentication token found');
        }

        const response = await axios.get(`${API_URL}/api/assignments/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data) {
          setAssignment(response.data);
        } else {
          throw new Error('Assignment not found');
        }
      } catch (err: any) {
        logger.error('Error fetching assignment', err);
        setError(err.response?.data?.message || 'Failed to load assignment');
      } finally {
        setLoading(false);
      }
    };

    fetchAssignment();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="p-6">
        <p className="text-gray-600 dark:text-gray-400">{error || 'Assignment not found'}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  // Get module ID from assignment
  const moduleId = typeof assignment.module === 'string' 
    ? assignment.module 
    : assignment.module?._id || '';

  if (!moduleId) {
    return (
      <div className="p-6">
        <p className="text-gray-600 dark:text-gray-400">Assignment module not found</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <CreateAssignmentForm 
      moduleId={moduleId} 
      editMode={true} 
      assignmentData={assignment} 
    />
  );
};

export default AssignmentEditPage;

