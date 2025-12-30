import React from 'react';
import { API_URL } from '../../config';
import RichTextEditor from '../RichTextEditor';
import { useSyllabusManagement } from '../../hooks/useSyllabusManagement';

// Helper function to sanitize HTML content
function sanitizeHtml(html: string): string {
  if (!html) return '';
  // Basic sanitization: remove script/style tags and event handlers
  let sanitized = html.replace(/<\/(script|style)>/gi, '</removed>');
  sanitized = sanitized.replace(/<(script|style)[^>]*>[\s\S]*?<\/(script|style)>/gi, '');
  sanitized = sanitized.replace(/ on\w+="[^"]*"/gi, '');
  sanitized = sanitized.replace(/ on\w+='[^']*'/gi, '');
  return sanitized;
}

interface CourseSyllabusProps {
  course: any;
  setCourse: (course: any) => void;
  isInstructor: boolean;
  isAdmin: boolean;
}

const CourseSyllabus: React.FC<CourseSyllabusProps> = ({
  course,
  setCourse,
  isInstructor,
  isAdmin
}) => {
  // Use syllabus management hook
  const {
    editingSyllabus,
    setEditingSyllabus,
    syllabusFields,
    handleSyllabusFieldChange,
    handleSaveSyllabusFields,
    savingSyllabus,
    syllabusMode,
    setSyllabusMode,
    syllabusContent,
    setSyllabusContent,
    uploadedSyllabusFiles,
    uploadingFiles,
    handleSyllabusFileUpload,
    handleRemoveSyllabusFile,
    handleSaveSyllabus,
    cancelSyllabusEdit,
    cancelSyllabusMode,
  } = useSyllabusManagement({
    course,
    setCourse,
    isInstructor,
    isAdmin,
  });

  // Wrapper to handle errors
  const handleSaveFields = async () => {
    try {
      await handleSaveSyllabusFields();
    } catch (err: any) {
      alert('Failed to save syllabus fields');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      await handleSyllabusFileUpload(event);
    } catch (error: any) {
      alert('Error uploading files. Please try again.');
    }
  };

  const handleSave = async () => {
    try {
      await handleSaveSyllabus();
    } catch (err: any) {
      alert('Failed to save syllabus');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Course Syllabus</h2>
          {(isInstructor || isAdmin) && !editingSyllabus && (
            <button
              onClick={() => setEditingSyllabus(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        {/* Editable Syllabus Fields */}
        <div className="space-y-4 mb-6">
          {(editingSyllabus && (isInstructor || isAdmin)) ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="syllabus-course-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Course Title</label>
                  <input
                    type="text"
                    id="syllabus-course-title"
                    name="courseTitle"
                    value={syllabusFields.courseTitle}
                    onChange={(e) => handleSyllabusFieldChange('courseTitle', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="-"
                  />
                </div>
                <div>
                  <label htmlFor="syllabus-course-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Course Code</label>
                  <input
                    type="text"
                    id="syllabus-course-code"
                    name="courseCode"
                    value={syllabusFields.courseCode}
                    onChange={(e) => handleSyllabusFieldChange('courseCode', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="-"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="syllabus-instructor" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Instructor</label>
                <input
                  type="text"
                  id="syllabus-instructor"
                  name="instructorName"
                  value={syllabusFields.instructorName}
                  onChange={(e) => handleSyllabusFieldChange('instructorName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="syllabus-instructor-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  id="syllabus-instructor-email"
                  name="instructorEmail"
                  value={syllabusFields.instructorEmail}
                  onChange={(e) => handleSyllabusFieldChange('instructorEmail', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="syllabus-office-hours" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Office Hours</label>
                <input
                  type="text"
                  id="syllabus-office-hours"
                  name="officeHours"
                  value={syllabusFields.officeHours}
                  onChange={(e) => handleSyllabusFieldChange('officeHours', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="By Appointment"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveFields}
                  disabled={savingSyllabus}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {savingSyllabus ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={cancelSyllabusEdit}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div><strong>Course Title:</strong> {syllabusFields.courseTitle || '-'}</div>
              <div><strong>Course Code:</strong> {syllabusFields.courseCode || '-'}</div>
              <div><strong>Instructor:</strong> {syllabusFields.instructorName || '-'}</div>
              <div><strong>Email:</strong> {syllabusFields.instructorEmail || '-'}</div>
              <div><strong>Office Hours:</strong> {syllabusFields.officeHours || 'By Appointment'}</div>
            </div>
          )}
        </div>

        {/* Add Syllabus Section */}
        {(isInstructor || isAdmin) && (
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Add Syllabus</h3>
            
            {syllabusMode === 'none' && (
              <div className="flex gap-4">
                <button
                  onClick={() => setSyllabusMode('upload')}
                  className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Upload File
                </button>
                <button
                  onClick={() => setSyllabusMode('editor')}
                  className="px-6 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                >
                  Editor + Upload File
                </button>
              </div>
            )}

            {syllabusMode === 'upload' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Upload File</label>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    disabled={uploadingFiles}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {uploadingFiles && <p className="text-sm text-gray-500 mt-2">Uploading...</p>}
                </div>

                {uploadedSyllabusFiles.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Uploaded Files:</h4>
                    {uploadedSyllabusFiles.map((file: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <a href={file.url?.startsWith('http') ? file.url : `${API_URL}${file.url}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {file.name}
                        </a>
                        <button
                          onClick={() => handleRemoveSyllabusFile(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={savingSyllabus || uploadingFiles}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {savingSyllabus ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={cancelSyllabusMode}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {syllabusMode === 'editor' && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="syllabus-content" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Syllabus Content</label>
                  <div className="border border-gray-300 rounded-md">
                    <RichTextEditor
                      id="syllabus-content"
                      name="syllabusContent"
                      content={syllabusContent}
                      onChange={setSyllabusContent}
                      height={400}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Upload File</label>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    disabled={uploadingFiles}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {uploadingFiles && <p className="text-sm text-gray-500 mt-2">Uploading...</p>}
                </div>

                {uploadedSyllabusFiles.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Uploaded Files:</h4>
                    {uploadedSyllabusFiles.map((file: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <a href={file.url?.startsWith('http') ? file.url : `${API_URL}${file.url}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {file.name}
                        </a>
                        <button
                          onClick={() => handleRemoveSyllabusFile(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleSaveSyllabus}
                    disabled={savingSyllabus || uploadingFiles}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {savingSyllabus ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={cancelSyllabusMode}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Display Syllabus Content */}
        {course.catalog?.syllabusContent && (
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="prose prose-lg dark:prose-invert max-w-none 
              prose-headings:text-gray-900 dark:prose-headings:text-gray-100
              prose-p:text-gray-700 dark:prose-p:text-gray-300
              prose-strong:text-gray-900 dark:prose-strong:text-gray-100
              prose-ul:text-gray-700 dark:prose-ul:text-gray-300
              prose-ol:text-gray-700 dark:prose-ol:text-gray-300
              prose-li:text-gray-700 dark:prose-li:text-gray-300
              prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
              prose-h1:font-bold prose-h2:font-semibold prose-h3:font-semibold
              prose-h1:mt-8 prose-h2:mt-6 prose-h3:mt-4
              prose-p:mb-4 prose-ul:mb-4 prose-ol:mb-4
              prose-li:mb-2"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(course.catalog.syllabusContent) }}
            />
          </div>
        )}

        {/* Display Syllabus Files */}
        {course.catalog?.syllabusFiles && course.catalog.syllabusFiles.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Syllabus Files</h3>
            <div className="space-y-2">
              {course.catalog.syllabusFiles.map((file: any, index: number) => (
                <div key={index} className="flex items-center p-2 bg-gray-50 rounded">
                  <a href={file.url?.startsWith('http') ? file.url : `${API_URL}${file.url}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {file.name}
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CourseSyllabus;

