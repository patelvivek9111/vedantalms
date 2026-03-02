import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCourse } from '../contexts/CourseContext';
import FloatingLabelInput from './common/FloatingLabelInput';
import FloatingLabelTextarea from './common/FloatingLabelTextarea';
import FloatingLabelSelect from './common/FloatingLabelSelect';
import DatePicker from './common/DatePicker';
import FormFieldGroup from './common/FormFieldGroup';
import { useDraftManager } from '../hooks/useDraftManager';
import { Save, RefreshCw } from 'lucide-react';

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

  // Draft manager
  const formId = mode === 'create' ? 'course-create' : `course-edit-${id}`;
  const { draft, isDraftSaved, saveDraft, autoSave, clearDraft } = useDraftManager<typeof formData>({
    formId,
    autoSaveDelay: 2000
  });

  // Load draft on mount (only for create mode)
  useEffect(() => {
    if (mode === 'create' && draft) {
      setFormData(draft);
    }
  }, [mode, draft]);

  // Auto-save draft on form changes
  useEffect(() => {
    if (mode === 'create' && formData.title) {
      autoSave(formData);
    }
  }, [formData, mode, autoSave]);

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
          // Error handling
          }
      };
      fetchCourse();
    }
  }, [mode, id]);

  // Validation functions
  const validateTitle = (value: string) => {
    if (!value.trim()) {
      setFormErrors(prev => ({ ...prev, title: 'Title is required' }));
      return false;
    }
    if (value.trim().length < 3) {
      setFormErrors(prev => ({ ...prev, title: 'Title must be at least 3 characters long' }));
      return false;
    }
    setFormErrors(prev => ({ ...prev, title: '' }));
    return true;
  };

  const validateDescription = (value: string) => {
    if (!value.trim()) {
      setFormErrors(prev => ({ ...prev, description: 'Description is required' }));
      return false;
    }
    if (value.trim().length < 10) {
      setFormErrors(prev => ({ ...prev, description: 'Description must be at least 10 characters long' }));
      return false;
    }
    setFormErrors(prev => ({ ...prev, description: '' }));
    return true;
  };

  const validateDates = () => {
    let isValid = true;
    if (formData.startDate && formData.endDate) {
      if (new Date(formData.startDate) > new Date(formData.endDate)) {
        setFormErrors(prev => ({ ...prev, endDate: 'End date must be after start date' }));
      isValid = false;
      } else {
        setFormErrors(prev => ({ ...prev, endDate: '' }));
      }
    }
    if (formData.enrollmentDeadline && formData.startDate) {
      if (new Date(formData.enrollmentDeadline) > new Date(formData.startDate)) {
        setFormErrors(prev => ({ ...prev, enrollmentDeadline: 'Enrollment deadline must be before start date' }));
      isValid = false;
      } else {
        setFormErrors(prev => ({ ...prev, enrollmentDeadline: '' }));
      }
    }
    return isValid;
  };

  const validateForm = () => {
    const isTitleValid = validateTitle(formData.title);
    const isDescriptionValid = validateDescription(formData.description);
    const areDatesValid = validateDates();
    return isTitleValid && isDescriptionValid && areDatesValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Clear draft on successful submit
    if (mode === 'create') {
      clearDraft();
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
      // Error handling
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

  const handleResetForm = () => {
    setFormData({
      title: '',
      description: '',
      courseCode: '',
      subject: '',
      catalogDescription: '',
      prerequisites: [],
      maxStudents: '',
      creditHours: '3',
      enrollmentDeadline: '',
      startDate: '',
      endDate: '',
      isPublic: false,
      allowTeacherEnrollment: false,
      semesterTerm: 'Fall',
      semesterYear: new Date().getFullYear().toString()
    });
    setFormErrors({
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
    if (mode === 'create') {
      clearDraft();
    }
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100">
          {mode === 'create' ? 'Create Course' : 'Edit Course'}
        </h1>
          <div className="flex items-center gap-3">
            {mode === 'create' && isDraftSaved && (
              <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                <Save className="w-4 h-4 mr-1" />
                Draft saved
              </div>
            )}
            {mode === 'create' && (
              <button
                type="button"
                onClick={handleResetForm}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                title="Clear form and start fresh"
              >
                <RefreshCw className="w-4 h-4" />
                Reset
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information Group */}
          <FormFieldGroup
            title="Basic Information"
            description="Enter the basic details for your course"
            >
            <FloatingLabelInput
              id="title"
              name="title"
              type="text"
              label="Course Title"
              required
              value={formData.title}
              onChange={handleChange}
              onBlur={(e) => validateTitle(e.target.value)}
              error={formErrors.title}
              showCharacterCount
              maxLength={100}
            />
            <FloatingLabelTextarea
              id="description"
              name="description"
              label="Description"
              required
              rows={4}
              value={formData.description}
              onChange={handleChange}
              onBlur={(e) => validateDescription(e.target.value)}
              error={formErrors.description}
              showCharacterCount
              maxLength={500}
            />
            <FloatingLabelInput
              id="courseCode"
              name="courseCode"
              type="text"
              label="Course Code"
              value={formData.courseCode}
              onChange={handleChange}
              placeholder="e.g., CS101, MATH201"
              helperText="Optional: Course code for catalog"
            />
          </FormFieldGroup>

          {/* Catalog Information Group */}
          <FormFieldGroup
            title="Catalog Information"
            description="Details that will appear in the course catalog"
          >
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FloatingLabelInput
                   id="subject"
                   name="subject"
                type="text"
                label="Subject"
                   value={formData.subject}
                   onChange={handleChange}
                error={formErrors.subject}
                   placeholder="e.g., Computer Science, Mathematics"
                 />
              <FloatingLabelTextarea
                   id="catalogDescription"
                   name="catalogDescription"
                label="Catalog Description"
                rows={3}
                   value={formData.catalogDescription}
                   onChange={handleChange}
                error={formErrors.catalogDescription}
                showCharacterCount
                maxLength={300}
                   placeholder="Brief description for the course catalog"
                 />
              <FloatingLabelInput
                  id="maxStudents"
                  name="maxStudents"
                type="number"
                label="Maximum Students"
                  value={formData.maxStudents}
                  onChange={handleChange}
                error={formErrors.maxStudents}
                  placeholder="Leave empty for unlimited"
                helperText="Optional: Maximum number of students"
              />
              <FloatingLabelInput
                  id="creditHours"
                  name="creditHours"
                type="number"
                label="Credit Hours"
                required
                min="1"
                max="10"
                  value={formData.creditHours}
                  onChange={handleChange}
                error={formErrors.creditHours}
                helperText="Number of credit hours for this course"
              />
              </div>
          </FormFieldGroup>

          {/* Schedule Group */}
          <FormFieldGroup
            title="Schedule"
            description="Course dates and enrollment deadline"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DatePicker
                  id="startDate"
                  name="startDate"
                label="Start Date"
                  value={formData.startDate}
                  onChange={handleChange}
                error={formErrors.startDate}
                onBlur={validateDates}
              />
              <DatePicker
                  id="endDate"
                  name="endDate"
                label="End Date"
                  value={formData.endDate}
                  onChange={handleChange}
                error={formErrors.endDate}
                onBlur={validateDates}
                helperText={formData.startDate ? `Must be after ${new Date(formData.startDate).toLocaleDateString()}` : ''}
              />
              <DatePicker
                  id="enrollmentDeadline"
                  name="enrollmentDeadline"
                label="Enrollment Deadline"
                  value={formData.enrollmentDeadline}
                  onChange={handleChange}
                error={formErrors.enrollmentDeadline}
                onBlur={validateDates}
                helperText={formData.startDate ? `Must be before ${new Date(formData.startDate).toLocaleDateString()}` : ''}
              />
            </div>
          </FormFieldGroup>
              
          {/* Semester Information Group */}
          <FormFieldGroup
            title="Semester Information"
            description="Term and year for this course"
          >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FloatingLabelSelect
                    id="semesterTerm"
                    name="semesterTerm"
                label="Term"
                    value={formData.semesterTerm}
                    onChange={(e) => setFormData(prev => ({ ...prev, semesterTerm: e.target.value }))}
                options={[
                  { value: 'Fall', label: 'Fall' },
                  { value: 'Spring', label: 'Spring' },
                  { value: 'Summer', label: 'Summer' },
                  { value: 'Winter', label: 'Winter' }
                ]}
              />
              <FloatingLabelInput
                    id="semesterYear"
                    name="semesterYear"
                type="number"
                label="Year"
                required
                min="2020"
                max="2100"
                    value={formData.semesterYear}
                    onChange={handleChange}
                    placeholder="2025"
                  />
            </div>
          </FormFieldGroup>

          {/* Options Group */}
          <FormFieldGroup
            title="Course Options"
            description="Additional settings for your course"
          >
            <div className="space-y-4">
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
          </FormFieldGroup>

                     <div className="flex justify-end space-x-4">
             <button
               type="button"
               onClick={() => navigate('/dashboard')}
               className="min-h-[44px] px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 touch-manipulation active:scale-95 transition-transform"
             >
               Cancel
             </button>
             <button
               type="submit"
               disabled={loading}
               className="min-h-[44px] px-4 py-2.5 bg-blue-500 dark:bg-blue-600 text-white rounded-md hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 touch-manipulation active:scale-95 transition-transform"
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
