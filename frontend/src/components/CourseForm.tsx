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
    // Catalog fields
    subject: '',
    catalogDescription: '',
    prerequisites: [] as string[],
    maxStudents: '',
    enrollmentDeadline: '',
    startDate: '',
    endDate: '',
    tags: '',
    syllabus: '',
    isPublic: false,
    allowTeacherEnrollment: false
  });

  const [formErrors, setFormErrors] = useState({
    title: '',
    description: '',
    subject: '',
    catalogDescription: '',
    maxStudents: '',
    enrollmentDeadline: '',
    startDate: '',
    endDate: '',
    tags: '',
    syllabus: '',
    allowTeacherEnrollment: ''
  });

  useEffect(() => {
    if (mode === 'edit' && id) {
      const fetchCourse = async () => {
        try {
                  const course = await getCourseRef.current(id);
        setFormData({
          title: course.title,
          description: course.description,
          subject: course.catalog?.subject || '',
          catalogDescription: course.catalog?.description || '',
          prerequisites: course.catalog?.prerequisites || [],
          maxStudents: course.catalog?.maxStudents?.toString() || '',
          enrollmentDeadline: course.catalog?.enrollmentDeadline ? new Date(course.catalog.enrollmentDeadline).toISOString().split('T')[0] : '',
          startDate: course.catalog?.startDate ? new Date(course.catalog.startDate).toISOString().split('T')[0] : '',
          endDate: course.catalog?.endDate ? new Date(course.catalog.endDate).toISOString().split('T')[0] : '',
          tags: course.catalog?.tags?.join(', ') || '',
          syllabus: course.catalog?.syllabus || '',
          isPublic: course.catalog?.isPublic || false,
          allowTeacherEnrollment: course.catalog?.allowTeacherEnrollment || false
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
      subject: '',
      catalogDescription: '',
      maxStudents: '',
      enrollmentDeadline: '',
      startDate: '',
      endDate: '',
      tags: '',
      syllabus: '',
      allowTeacherEnrollment: ''
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
      // Prepare catalog data
      const catalogData = {
        subject: formData.subject,
        description: formData.catalogDescription,
        prerequisites: formData.prerequisites,
        maxStudents: formData.maxStudents ? parseInt(formData.maxStudents) : null,
        enrollmentDeadline: formData.enrollmentDeadline ? new Date(formData.enrollmentDeadline) : null,
        startDate: formData.startDate ? new Date(formData.startDate) : null,
        endDate: formData.endDate ? new Date(formData.endDate) : null,
        tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
        syllabus: formData.syllabus,
        isPublic: formData.isPublic,
        allowTeacherEnrollment: formData.allowTeacherEnrollment
      };

             if (mode === 'create') {
         await createCourse(formData.title, formData.description, catalogData);
       } else if (mode === 'edit' && id) {
         await updateCourse(id, formData.title, formData.description, catalogData);
       }
       navigate('/dashboard');
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

                     {/* Catalog Section */}
           <div className="border-t pt-6">
             <h3 className="text-lg font-medium text-gray-900 mb-4">Catalog Information</h3>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div>
                 <label
                   htmlFor="subject"
                   className="block text-sm font-medium text-gray-700 mb-1"
                 >
                   Subject
                 </label>
                 <input
                   type="text"
                   id="subject"
                   name="subject"
                   value={formData.subject}
                   onChange={handleChange}
                   className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                     formErrors.subject ? 'border-red-500' : 'border-gray-300'
                   }`}
                   placeholder="e.g., Computer Science, Mathematics"
                 />
                 {formErrors.subject && (
                   <p className="mt-1 text-sm text-red-600">{formErrors.subject}</p>
                 )}
               </div>

               <div>
                 <label
                   htmlFor="catalogDescription"
                   className="block text-sm font-medium text-gray-700 mb-1"
                 >
                   Catalog Description
                 </label>
                 <textarea
                   id="catalogDescription"
                   name="catalogDescription"
                   value={formData.catalogDescription}
                   onChange={handleChange}
                   rows={3}
                   className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                     formErrors.catalogDescription ? 'border-red-500' : 'border-gray-300'
                   }`}
                   placeholder="Brief description for the course catalog"
                 />
                 {formErrors.catalogDescription && (
                   <p className="mt-1 text-sm text-red-600">{formErrors.catalogDescription}</p>
                 )}
               </div>

              <div>
                <label
                  htmlFor="maxStudents"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Maximum Students
                </label>
                <input
                  type="number"
                  id="maxStudents"
                  name="maxStudents"
                  value={formData.maxStudents}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.maxStudents ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Leave empty for unlimited"
                />
                {formErrors.maxStudents && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.maxStudents}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="tags"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Tags
                </label>
                <input
                  type="text"
                  id="tags"
                  name="tags"
                  value={formData.tags}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.tags ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="e.g., programming, web development, javascript"
                />
                <p className="mt-1 text-sm text-gray-500">Separate tags with commas</p>
                {formErrors.tags && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.tags}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="startDate"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Start Date
                </label>
                <input
                  type="date"
                  id="startDate"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.startDate ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {formErrors.startDate && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.startDate}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="endDate"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  End Date
                </label>
                <input
                  type="date"
                  id="endDate"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.endDate ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {formErrors.endDate && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.endDate}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="enrollmentDeadline"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Enrollment Deadline
                </label>
                <input
                  type="date"
                  id="enrollmentDeadline"
                  name="enrollmentDeadline"
                  value={formData.enrollmentDeadline}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.enrollmentDeadline ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {formErrors.enrollmentDeadline && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.enrollmentDeadline}</p>
                )}
              </div>
            </div>

            <div className="mt-6">
              <label
                htmlFor="syllabus"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Syllabus
              </label>
              <textarea
                id="syllabus"
                name="syllabus"
                value={formData.syllabus}
                onChange={handleChange}
                rows={4}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  formErrors.syllabus ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter course syllabus or detailed description"
              />
              {formErrors.syllabus && (
                <p className="mt-1 text-sm text-red-600">{formErrors.syllabus}</p>
              )}
            </div>

            <div className="mt-6">
              <label htmlFor="isPublic" className="flex items-center">
                <input
                  type="checkbox"
                  id="isPublic"
                  name="isPublic"
                  checked={formData.isPublic}
                  onChange={(e) => setFormData(prev => ({ ...prev, isPublic: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Make this course public in the catalog
                </span>
              </label>
            </div>
            
            <div className="mt-4">
              <label htmlFor="allowTeacherEnrollment" className="flex items-center">
                <input
                  type="checkbox"
                  id="allowTeacherEnrollment"
                  name="allowTeacherEnrollment"
                  checked={formData.allowTeacherEnrollment}
                  onChange={(e) => setFormData(prev => ({ ...prev, allowTeacherEnrollment: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Allow teachers to enroll in this course
                </span>
              </label>
            </div>
          </div>

                     <div className="flex justify-end space-x-4">
             <button
               type="button"
               onClick={() => navigate('/dashboard')}
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