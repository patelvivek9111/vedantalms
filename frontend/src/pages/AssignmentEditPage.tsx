import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import CreateAssignmentForm from '../components/assignments/CreateAssignmentForm';
import { ArrowLeft } from 'lucide-react';

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
        const response = await api.get(`/assignments/${id}`);

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-3 sm:p-4 lg:p-6">
        <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 px-3 sm:px-4 py-2 sm:py-3 rounded relative text-sm sm:text-base" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-400 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Access Denied: </strong>
          <span className="block sm:inline">You don't have permission to edit assignments.</span>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!moduleId) {
    return (
      <div className="max-w-4xl mx-auto p-3 sm:p-4 lg:p-6">
        <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 px-3 sm:px-4 py-2 sm:py-3 rounded relative text-sm sm:text-base" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">Could not determine module for this assignment.</span>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Navigation Bar (Mobile Only) */}
      <nav className="lg:hidden fixed top-0 left-0 right-0 z-[150] bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="relative flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-700 dark:text-gray-300 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Edit Assignment</h1>
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-3 sm:p-4 lg:p-6 pt-16 lg:pt-6">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 sm:p-6">
          <div className="hidden lg:block mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Edit Assignment</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Editing: {assignment?.title}
          </p>
          </div>
          <div className="lg:hidden mb-4 sm:mb-6">
            <p className="text-sm text-gray-600 dark:text-gray-400">
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
    </div>
  );
};

export default AssignmentEditPage; 