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
    courseCode: '',
    // Catalog fields
    subject: '',
    catalogDescription: '',
    prerequisites: [] as string[],
    maxStudents: '',
    creditHours: '3',
    enrollmentDeadline: '',
    startDate: '',
    endDate: '',
    isPublic: false,
    allowTeacherEnrollment: false,
    // Semester fields
    semesterTerm: 'Fall',
    semesterYear: new Date().getFullYear().toString()
  });

  const [formErrors, setFormErrors] = useState({
    title: '',
    description: '',
    subject: '',
    catalogDescription: '',
    maxStudents: '',
    creditHours: '',
    enrollmentDeadline: '',
    startDate: '',
    endDate: '',
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
          courseCode: course.catalog?.courseCode || '',
          subject: course.catalog?.subject || '',
          catalogDescription: course.catalog?.description || '',
          prerequisites: course.catalog?.prerequisites || [],
          maxStudents: course.catalog?.maxStudents?.toString() || '',
          creditHours: course.catalog?.creditHours?.toString() || '3',
          enrollmentDeadline: course.catalog?.enrollmentDeadline ? new Date(course.catalog.enrollmentDeadline).toISOString().split('T')[0] : '',
          startDate: course.catalog?.startDate ? new Date(course.catalog.startDate).toISOString().split('T')[0] : '',
          endDate: course.catalog?.endDate ? new Date(course.catalog.endDate).toISOString().split('T')[0] : '',
          isPublic: course.catalog?.isPublic || false,
          allowTeacherEnrollment: course.catalog?.allowTeacherEnrollment || false,
          semesterTerm: course.semester?.term || 'Fall',
          semesterYear: course.semester?.year?.toString() || new Date().getFullYear().toString()
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
      creditHours: '',
      enrollmentDeadline: '',
      startDate: '',
      endDate: '',
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
        courseCode: formData.courseCode,
        prerequisites: formData.prerequisites,
        maxStudents: formData.maxStudents ? parseInt(formData.maxStudents) : null,
        creditHours: formData.creditHours ? parseInt(formData.creditHours) : 3,
        enrollmentDeadline: formData.enrollmentDeadline ? new Date(formData.enrollmentDeadline) : null,
        startDate: formData.startDate ? new Date(formData.startDate) : null,
        endDate: formData.endDate ? new Date(formData.endDate) : null,
        isPublic: formData.isPublic,
        allowTeacherEnrollment: formData.allowTeacherEnrollment
      };

      // Prepare semester data - always include it
      const semesterData = {
        term: formData.semesterTerm || 'Fall',
        year: parseInt(formData.semesterYear) || new Date().getFullYear()
      };

             if (mode === 'create') {
         await createCourse(formData.title, formData.description, catalogData, semesterData);
       } else if (mode === 'edit' && id) {
         await updateCourse(id, formData.title, formData.description, catalogData, semesterData);
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
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">
          {mode === 'create' ? 'Create Course' : 'Edit Course'}
        </h1>

        {error && (
          <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Title
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 ${
                formErrors.title ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-700'
              }`}
              placeholder="Enter course title"
            />
            {formErrors.title && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.title}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              className={`w-full px-3 py-2 border rounded-md shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 ${
                formErrors.description ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-700'
              }`}
              placeholder="Enter course description"
            />
            {formErrors.description && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.description}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="courseCode"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Course Code
            </label>
            <input
              type="text"
              id="courseCode"
              name="courseCode"
              value={formData.courseCode}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              placeholder="e.g., CS101, MATH201"
            />
          </div>

                     {/* Catalog Section */}
           <div className="border-t dark:border-gray-700 pt-6">
             <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Catalog Information</h3>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div>
                 <label
                   htmlFor="subject"
                   className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                 >
                   Subject
                 </label>
                 <input
                   type="text"
                   id="subject"
                   name="subject"
                   value={formData.subject}
                   onChange={handleChange}
                   className={`w-full px-3 py-2 border rounded-md shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 ${
                     formErrors.subject ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-700'
                   }`}
                   placeholder="e.g., Computer Science, Mathematics"
                 />
                 {formErrors.subject && (
                   <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.subject}</p>
                 )}
               </div>

               <div>
                 <label
                   htmlFor="catalogDescription"
                   className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                 >
                   Catalog Description
                 </label>
                 <textarea
                   id="catalogDescription"
                   name="catalogDescription"
                   value={formData.catalogDescription}
                   onChange={handleChange}
                   rows={3}
                   className={`w-full px-3 py-2 border rounded-md shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 ${
                     formErrors.catalogDescription ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-700'
                   }`}
                   placeholder="Brief description for the course catalog"
                 />
                 {formErrors.catalogDescription && (
                   <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.catalogDescription}</p>
                 )}
               </div>

              <div>
                <label
                  htmlFor="maxStudents"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Maximum Students
                </label>
                <input
                  type="number"
                  id="maxStudents"
                  name="maxStudents"
                  value={formData.maxStudents}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 ${
                    formErrors.maxStudents ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-700'
                  }`}
                  placeholder="Leave empty for unlimited"
                />
                {formErrors.maxStudents && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.maxStudents}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="creditHours"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Credit Hours
                </label>
                <input
                  type="number"
                  id="creditHours"
                  name="creditHours"
                  value={formData.creditHours}
                  onChange={handleChange}
                  min="1"
                  max="10"
                  className={`w-full px-3 py-2 border rounded-md shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 ${
                    formErrors.creditHours ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-700'
                  }`}
                  placeholder="3"
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Number of credit hours for this course</p>
                {formErrors.creditHours && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.creditHours}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="startDate"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Start Date
                </label>
                <input
                  type="date"
                  id="startDate"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 ${
                    formErrors.startDate ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-700'
                  }`}
                />
                {formErrors.startDate && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.startDate}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="endDate"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  End Date
                </label>
                <input
                  type="date"
                  id="endDate"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 ${
                    formErrors.endDate ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-700'
                  }`}
                />
                {formErrors.endDate && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.endDate}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="enrollmentDeadline"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Enrollment Deadline
                </label>
                <input
                  type="date"
                  id="enrollmentDeadline"
                  name="enrollmentDeadline"
                  value={formData.enrollmentDeadline}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 ${
                    formErrors.enrollmentDeadline ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-700'
                  }`}
                />
                {formErrors.enrollmentDeadline && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.enrollmentDeadline}</p>
                )}
              </div>
            </div>

            {/* Semester Section */}
            <div className="border-t dark:border-gray-700 pt-6 mt-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Semester Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label
                    htmlFor="semesterTerm"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Term
                  </label>
                  <select
                    id="semesterTerm"
                    name="semesterTerm"
                    value={formData.semesterTerm}
                    onChange={(e) => setFormData(prev => ({ ...prev, semesterTerm: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  >
                    <option value="Fall">Fall</option>
                    <option value="Spring">Spring</option>
                    <option value="Summer">Summer</option>
                    <option value="Winter">Winter</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="semesterYear"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Year
                  </label>
                  <input
                    type="number"
                    id="semesterYear"
                    name="semesterYear"
                    value={formData.semesterYear}
                    onChange={handleChange}
                    min="2020"
                    max="2100"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    placeholder="2025"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6">
              <label htmlFor="isPublic" className="flex items-center">
                <input
                  type="checkbox"
                  id="isPublic"
                  name="isPublic"
                  checked={formData.isPublic}
                  onChange={(e) => setFormData(prev => ({ ...prev, isPublic: e.target.checked }))}
                  className="rounded border-gray-300 dark:border-gray-700 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-900 shadow-sm focus:border-blue-300 dark:focus:border-blue-600 focus:ring focus:ring-blue-200 dark:focus:ring-blue-800 focus:ring-opacity-50"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
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
                  className="rounded border-gray-300 dark:border-gray-700 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-900 shadow-sm focus:border-blue-300 dark:focus:border-blue-600 focus:ring focus:ring-blue-200 dark:focus:ring-blue-800 focus:ring-opacity-50"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Allow teachers to enroll in this course
                </span>
              </label>
            </div>
          </div>

                     <div className="flex justify-end space-x-4">
             <button
               type="button"
               onClick={() => navigate('/dashboard')}
               className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400"
             >
               Cancel
             </button>
             <button
               type="submit"
               disabled={loading}
               className="px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-md hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
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