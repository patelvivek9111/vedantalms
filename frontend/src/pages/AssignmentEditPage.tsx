import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import CreateAssignmentForm from '../components/assignments/CreateAssignmentForm';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const AssignmentEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<any>(null);
  const [moduleId, setModuleId] = useState<string | null>(null);

  useEffect(() => {
    const fetchAssignment = async () => {
      if (!id) return;
      
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/api/assignments/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data) {
          const assignment = response.data;
          setAssignment(assignment);
          
          // Get module ID from assignment
          if (assignment.module) {
            const moduleId = typeof assignment.module === 'string'
              ? assignment.module
              : assignment.module._id;
            setModuleId(moduleId);
          }
        } else {
          setError('Failed to load assignment data');
        }
      } catch (err: any) {
        console.error('Error fetching assignment:', err);
        setError(err.response?.data?.message || 'Error loading assignment');
      } finally {
        setLoading(false);
      }
    };

    fetchAssignment();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Access Denied: </strong>
          <span className="block sm:inline">You don't have permission to edit assignments.</span>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!moduleId) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">Could not determine module for this assignment.</span>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Edit Assignment</h1>
          <p className="mt-2 text-sm text-gray-600">
            Editing: {assignment?.title}
          </p>

        </div>
        
        <CreateAssignmentForm 
          moduleId={moduleId} 
          editMode={true}
          assignmentData={assignment}
        />
      </div>
    </div>
  );
};

export default AssignmentEditPage; 