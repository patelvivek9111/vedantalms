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
import { MobileAppShell } from '../common/MobileAppShell';
import GradingPeriodSetupModal from '../grades/GradingPeriodSetupModal';
import { fetchAcademicSettings, type AcademicSettingsResponse } from '../../services/academicApi';
import { fetchCourseGradingPeriods } from '../../services/gradingApi';

export type CourseScheduleType = 'single_term' | 'full_year' | 'custom';

interface CourseFormProps {
  mode: 'create' | 'edit';
}

const SCHEDULE_TYPE_OPTIONS: Array<{
  value: CourseScheduleType;
  title: string;
  description: string;
}> = [
  {
    value: 'single_term',
    title: 'Single term (~one semester)',
    description:
      'One reporting period — typical for college classes or school subjects that run one term only.',
  },
  {
    value: 'full_year',
    title: 'Full year (quarters or terms inside one course)',
    description:
      'Year-long subject with grading periods (Q1–Q4 or Term 1–2). One course, one final transcript grade.',
  },
  {
    value: 'custom',
    title: 'Custom',
    description: 'Set dates and grading yourself with no assumptions.',
  },
];

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
    scheduleType: 'single_term' as CourseScheduleType,
    academicYearLabel: '',
    semesterTerm: 'Fall',
    semesterYear: new Date().getFullYear().toString()
  });

  const [gradingSetup, setGradingSetup] = useState<{
    show: boolean;
    courseId: string;
    courseTitle: string;
  }>({ show: false, courseId: '', courseTitle: '' });
  const [termOptions, setTermOptions] = useState<Array<{ value: string; label: string }>>([
    { value: 'Fall', label: 'Fall' },
    { value: 'Spring', label: 'Spring' },
    { value: 'Summer', label: 'Summer' },
    { value: 'Winter', label: 'Winter' },
  ]);
  const [academicDefaults, setAcademicDefaults] = useState<AcademicSettingsResponse | null>(null);

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

  useEffect(() => {
    if (mode !== 'create') return;
    void fetchAcademicSettings()
      .then((res) => {
        if (!res?.success) return;
      setAcademicDefaults(res.data);
      if (res.data.termOptions?.length) setTermOptions(res.data.termOptions);
      setFormData((prev) => ({
        ...prev,
        scheduleType: res.data.defaultScheduleType || prev.scheduleType,
        semesterTerm:
          res.data.institutionMode === 'school'
            ? res.data.reportingTermSchool || 'Academic Year'
            : res.data.institutionMode === 'college'
              ? res.data.reportingTermCollege || 'Fall'
              : prev.semesterTerm,
        semesterYear: String(res.data.academicYearStart || new Date().getFullYear()),
        academicYearLabel:
          res.data.defaultScheduleType === 'full_year' && res.data.academicYearStart
            ? `${res.data.academicYearStart}–${String(res.data.academicYearStart + 1).slice(-2)}`
            : '',
        creditHours:
          res.data.institutionMode === 'school'
            ? String(res.data.defaultCreditHoursSchool ?? 0)
            : String(res.data.defaultCreditHoursCollege ?? 3),
      }));
      })
      .catch(() => {});
  }, [mode]);

  useEffect(() => {
    if (mode === 'create' && draft) {
      setFormData((prev) => ({ ...prev, ...draft }));
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
          scheduleType: (course.scheduleType as CourseScheduleType) || 'single_term',
          academicYearLabel: (course as { academicYearLabel?: string }).academicYearLabel || '',
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

  const isFullYear = formData.scheduleType === 'full_year';
  const creditHoursRequired = formData.scheduleType !== 'full_year';

  const handleScheduleTypeChange = (scheduleType: CourseScheduleType) => {
    setFormData((prev) => {
      const next = { ...prev, scheduleType };
      if (scheduleType === 'full_year' && !prev.startDate && !prev.endDate) {
        const year = parseInt(prev.semesterYear, 10) || new Date().getFullYear();
        next.startDate = academicDefaults?.calendarStyle === 'india' ? `${year}-04-01` : `${year}-08-01`;
        next.endDate =
          academicDefaults?.calendarStyle === 'india' ? `${year + 1}-03-31` : `${year + 1}-06-30`;
        next.academicYearLabel = `${year}–${String(year + 1).slice(-2)}`;
      }
      return next;
    });
  };

  const academicSectionTitle =
    formData.scheduleType === 'full_year'
      ? 'Academic year & reporting term'
      : 'Academic term & year';

  const academicSectionDescription =
    formData.scheduleType === 'full_year'
      ? 'The reporting term is where the final year-end grade appears on the transcript.'
      : formData.scheduleType === 'single_term'
        ? 'Used for transcript grouping and grade finalize at the end of this term.'
        : 'Term and year for transcript grouping.';

  const scheduleDatesDescription =
    formData.scheduleType === 'full_year'
      ? 'Full-year course dates (e.g. August through June).'
      : 'Course start, end, and enrollment deadline.';

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
        creditHours: formData.creditHours
          ? parseInt(formData.creditHours, 10)
          : isFullYear
            ? 0
            : 3,
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
        const academicYearLabel =
          formData.scheduleType === 'full_year'
            ? formData.academicYearLabel ||
              `${formData.semesterYear}–${String(Number(formData.semesterYear) + 1).slice(-2)}`
            : undefined;
        const created = await createCourse(
          formData.title,
          formData.description,
          catalogData,
          semesterData,
          formData.scheduleType,
          { academicYearLabel }
        );
        if (created?._id && formData.scheduleType === 'full_year') {
          const periodsRes = await fetchCourseGradingPeriods(created._id);
          if (periodsRes.success && (periodsRes.data?.length ?? 0) > 0) {
            navigate(`/courses/${created._id}`);
            return;
          }
          setGradingSetup({
            show: true,
            courseId: created._id,
            courseTitle: formData.title,
          });
          return;
        }
        navigate(created?._id ? `/courses/${created._id}` : '/dashboard');
      } else if (mode === 'edit' && id) {
        const academicYearLabel =
          formData.scheduleType === 'full_year'
            ? formData.academicYearLabel ||
              `${formData.semesterYear}–${String(Number(formData.semesterYear) + 1).slice(-2)}`
            : null;
        await updateCourse(
          id,
          formData.title,
          formData.description,
          catalogData,
          semesterData,
          undefined,
          formData.scheduleType,
          { academicYearLabel }
        );
        navigate(`/courses/${id}`);
      }
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
      scheduleType: 'single_term' as CourseScheduleType,
      academicYearLabel: '',
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

  const shellTitle = mode === 'create' ? 'Create Course' : 'Edit Course';
  const backPath = mode === 'edit' && id ? `/courses/${id}` : '/courses';

  return (
    <MobileAppShell title={shellTitle} backButtonPath={backPath}>
    <div className="min-h-screen bg-slate-50/80 px-3 py-4 dark:bg-slate-950 sm:px-4 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="hidden lg:block">
          <FormPageHeader
            title={mode === 'create' ? 'Create course' : 'Edit course'}
            subtitle={mode === 'create' ? 'Set up a new course for your students.' : 'Update course details and catalog settings.'}
            isDraftSaved={mode === 'create' && isDraftSaved}
            onReset={mode === 'create' ? handleResetForm : undefined}
          />
        </div>

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

          {/* Course schedule type */}
          <FormFieldGroup
            title="How is this course scheduled?"
            description="Choose how grades are reported over time. You can change this later."
          >
            <div className="space-y-2">
              {SCHEDULE_TYPE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition ${
                    formData.scheduleType === opt.value
                      ? 'border-blue-500 bg-blue-50/80 dark:border-blue-500 dark:bg-blue-950/20'
                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="scheduleType"
                    value={opt.value}
                    checked={formData.scheduleType === opt.value}
                    onChange={() => handleScheduleTypeChange(opt.value)}
                    className="mt-1 h-4 w-4 shrink-0 text-blue-600"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                      {opt.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                      {opt.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </FormFieldGroup>

          {/* Schedule dates */}
          <FormFieldGroup title="Dates" description={scheduleDatesDescription}>
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
              
          {/* Academic term & year */}
          <FormFieldGroup title={academicSectionTitle} description={academicSectionDescription}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FloatingLabelSelect
                    id="semesterTerm"
                    name="semesterTerm"
                label={isFullYear ? 'Reporting term' : 'Term'}
                    value={formData.semesterTerm}
                    onChange={(e) => setFormData(prev => ({ ...prev, semesterTerm: e.target.value }))}
                options={termOptions}
              />
              <FloatingLabelInput
                    id="semesterYear"
                    name="semesterYear"
                type="number"
                label={isFullYear ? 'Academic year' : 'Year'}
                required
                min="2020"
                max="2100"
                    value={formData.semesterYear}
                    onChange={handleChange}
                    placeholder="2025"
                  />
            </div>
            {isFullYear && (
              <FloatingLabelInput
                id="academicYearLabel"
                name="academicYearLabel"
                type="text"
                label="Academic year label"
                value={formData.academicYearLabel}
                onChange={handleChange}
                placeholder="2025–26"
                helperText="Shown on transcript and report cards (e.g. 2025–26)."
              />
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {isFullYear
                ? 'Pick the term and year where the final year-end grade should appear on the transcript (e.g. Spring 2026).'
                : 'Maps to Fall, Spring, Summer, or Winter on the transcript.'}
            </p>
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
                required={creditHoursRequired}
                min="0"
                max="10"
                  value={formData.creditHours}
                  onChange={handleChange}
                error={formErrors.creditHours}
                helperText={
                  isFullYear
                    ? 'Optional for year-long school courses (leave 0 if not used).'
                    : 'Number of credit hours for this course'
                }
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
    <GradingPeriodSetupModal
      show={gradingSetup.show}
      courseId={gradingSetup.courseId}
      courseTitle={gradingSetup.courseTitle}
      onComplete={() => navigate(`/courses/${gradingSetup.courseId}`)}
      onSkip={() => navigate(`/courses/${gradingSetup.courseId}`)}
    />
    </MobileAppShell>
  );
};

export default CourseForm; 
