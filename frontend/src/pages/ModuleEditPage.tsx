import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useModule } from '../contexts/ModuleContext';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const ModuleEditPage: React.FC = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { updateModule } = useModule();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchModule = async () => {
      if (!moduleId) return;
      
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/api/modules/view/${moduleId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data.success) {
          const moduleData = response.data.data;
          setFormData({
            title: moduleData.title,
            description: moduleData.description || ''
          });
        } else {
          setError('Failed to load module data');
        }
      } catch (err: any) {
        console.error('Error fetching module:', err);
        setError(err.response?.data?.message || 'Error loading module');
      } finally {
        setLoading(false);
      }
    };

    fetchModule();
  }, [moduleId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Get the course ID from the module data
      const token = localStorage.getItem('token');
      const moduleResponse = await axios.get(`${API_URL}/api/modules/view/${moduleId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!moduleResponse.data.success) {
        throw new Error('Failed to get module data');
      }

      const courseId = moduleResponse.data.data.course._id || moduleResponse.data.data.course;
      
      // Update the module
      await updateModule(moduleId, formData, courseId);
      navigate(-1); // Go back to previous page after successful update
    } catch (err: any) {
      console.error('Error updating module:', err);
      setError(err.response?.data?.message || 'Error updating module');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
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
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Access Denied: </strong>
          <span className="block sm:inline">You don't have permission to edit modules.</span>
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
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Module</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Title
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModuleEditPage; 