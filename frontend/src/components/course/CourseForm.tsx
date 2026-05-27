import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCourse } from '../../contexts/CourseContext';
import FloatingLabelInput from '../common/FloatingLabelInput';
import FloatingLabelTextarea from '../common/FloatingLabelTextarea';
import FloatingLabelSelect from '../common/FloatingLabelSelect';
import DatePicker from '../common/DatePicker';
import FormFieldGroup from '../common/FormFieldGroup';
import { useDraftManager } from '../../hooks/useDraftManager';
import { FormCheckboxOption, FormPageHeader, FormActions } from '../common/FormControls';
import { FORM_ERROR } from '../common/formStyles';

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
    <div className="min-h-screen bg-slate-50/80 px-3 py-4 dark:bg-slate-950 sm:px-4 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <FormPageHeader
          title={mode === 'create' ? 'Create course' : 'Edit course'}
          subtitle={mode === 'create' ? 'Set up a new course for your students.' : 'Update course details and catalog settings.'}
          isDraftSaved={mode === 'create' && isDraftSaved}
          onReset={mode === 'create' ? handleResetForm : undefined}
        />

        {error && (
          <div className={`${FORM_ERROR} mb-6`} role="alert">
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
            title="Course options"
            description="Additional settings for your course"
          >
            <div className="grid grid-cols-1 gap-3">
              <FormCheckboxOption
                id="isPublic"
                checked={formData.isPublic}
                onChange={(e) => setFormData((prev) => ({ ...prev, isPublic: e.target.checked }))}
                title="Public in catalog"
                description="Make this course visible in the public course catalog."
              />
              <FormCheckboxOption
                id="allowTeacherEnrollment"
                checked={formData.allowTeacherEnrollment}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, allowTeacherEnrollment: e.target.checked }))
                }
                title="Allow teacher enrollment"
                description="Let other teachers enroll in this course."
              />
            </div>
          </FormFieldGroup>

          <FormActions
            onCancel={() => navigate('/dashboard')}
            submitLabel={mode === 'create' ? 'Create course' : 'Save changes'}
            loading={loading}
            loadingLabel={mode === 'create' ? 'Creating…' : 'Saving…'}
          />
        </form>
      </div>
    </div>
  );
};

export default CourseForm; 
