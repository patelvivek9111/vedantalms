import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCourse } from '../contexts/CourseContext';

interface CourseFormProps {
  mode: 'create' | 'edit';
}

const CourseForm: React.FC<CourseFormProps> = ({ mode }) => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { createCourse, updateCourse, getCourse, loading, error } = useCourse();
  const getCourseRef = useRef(getCourse);

  // Update ref when getCourse changes
  useEffect(() => {
    getCourseRef.current = getCourse;
  }, [getCourse]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
  });

  const [formErrors, setFormErrors] = useState({
    title: '',
    description: '',
  });

  useEffect(() => {
    if (mode === 'edit' && id) {
      const fetchCourse = async () => {
        try {
          const course = await getCourseRef.current(id);
          setFormData({
            title: course.title,
            description: course.description,
          });
        } catch (err) {
          console.error('Error fetching course:', err);
        }
      };
      fetchCourse();
    }
  }, [mode, id]);

  const validateForm = () => {
    const errors = {
      title: '',
      description: '',
    };
    let isValid = true;

    if (!formData.title.trim()) {
      errors.title = 'Title is required';
      isValid = false;
    } else if (formData.title.length < 3) {
      errors.title = 'Title must be at least 3 characters long';
      isValid = false;
    }

    if (!formData.description.trim()) {
      errors.description = 'Description is required';
      isValid = false;
    } else if (formData.description.length < 10) {
      errors.description = 'Description must be at least 10 characters long';
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      if (mode === 'create') {
        await createCourse(formData.title, formData.description);
      } else if (mode === 'edit' && id) {
        await updateCourse(id, formData.title, formData.description);
      }
      navigate('/courses');
    } catch (err) {
      console.error('Error submitting form:', err);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    setFormErrors((prev) => ({
      ...prev,
      [name]: '',
    }));
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">
          {mode === 'create' ? 'Create Course' : 'Edit Course'}
        </h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Title
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                formErrors.title ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter course title"
            />
            {formErrors.title && (
              <p className="mt-1 text-sm text-red-600">{formErrors.title}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                formErrors.description ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter course description"
            />
            {formErrors.description && (
              <p className="mt-1 text-sm text-red-600">{formErrors.description}</p>
            )}
          </div>

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate('/courses')}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  {mode === 'create' ? 'Creating...' : 'Saving...'}
                </span>
              ) : (
                mode === 'create' ? 'Create Course' : 'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CourseForm; 