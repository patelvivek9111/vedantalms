import React from 'react';
import RichTextEditor from '../common/RichTextEditor';
import FileAttachmentPanel from '../files/FileAttachmentPanel';
import FileAttachmentChips from '../files/FileAttachmentChips';
import type { NormalizedFile } from '../../utils/fileTypes';

interface SyllabusFields {
  courseTitle: string;
  courseCode: string;
  instructorName: string;
  instructorEmail: string;
  officeHours: string;
}

interface SyllabusSectionProps {
  course: any;
  isInstructor: boolean;
  isAdmin: boolean;
  editingSyllabus: boolean;
  setEditingSyllabus: (editing: boolean) => void;
  syllabusFields: SyllabusFields;
  handleSyllabusFieldChange: (field: string, value: string) => void;
  handleSaveSyllabusFields: () => void;
  savingSyllabus: boolean;
  syllabusMode: 'none' | 'upload' | 'editor';
  setSyllabusMode: (mode: 'none' | 'upload' | 'editor') => void;
  syllabusContent: string;
  setSyllabusContent: (content: string) => void;
  syllabusAttachmentFiles: NormalizedFile[];
  setSyllabusAttachmentFiles: (files: NormalizedFile[]) => void;
  courseArchived?: boolean;
  handleSaveSyllabus: () => void;
  onCancelEdit: () => void;
  onRemoveSyllabusFile?: (file: NormalizedFile, index: number) => void;
}

const SyllabusSection: React.FC<SyllabusSectionProps> = ({
  course,
  isInstructor,
  isAdmin,
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
  syllabusAttachmentFiles,
  setSyllabusAttachmentFiles,
  courseArchived = false,
  handleSaveSyllabus,
  onCancelEdit,
  onRemoveSyllabusFile,
}) => {
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Course Title</label>
                  <input
                    type="text"
                    value={syllabusFields.courseTitle}
                    onChange={(e) => handleSyllabusFieldChange('courseTitle', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="-"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Course Code</label>
                  <input
                    type="text"
                    value={syllabusFields.courseCode}
                    onChange={(e) => handleSyllabusFieldChange('courseCode', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="-"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Instructor</label>
                <input
                  type="text"
                  value={syllabusFields.instructorName}
                  onChange={(e) => handleSyllabusFieldChange('instructorName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  value={syllabusFields.instructorEmail}
                  onChange={(e) => handleSyllabusFieldChange('instructorEmail', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Office Hours</label>
                <input
                  type="text"
                  value={syllabusFields.officeHours}
                  onChange={(e) => handleSyllabusFieldChange('officeHours', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="By Appointment"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveSyllabusFields}
                  disabled={savingSyllabus}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {savingSyllabus ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={onCancelEdit}
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
                <FileAttachmentPanel
                  files={syllabusAttachmentFiles}
                  onChange={setSyllabusAttachmentFiles}
                  courseId={course?._id}
                  category="syllabus"
                  finalized={courseArchived}
                  label="Drop syllabus files here or browse"
                  onRemoveFile={onRemoveSyllabusFile}
                />

                <div className="flex gap-2">
                  <button
                    onClick={handleSaveSyllabus}
                    disabled={savingSyllabus || courseArchived}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {savingSyllabus ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => {
                      setSyllabusMode('none');
                      setSyllabusAttachmentFiles([]);
                    }}
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Syllabus Content</label>
                  <div className="border border-gray-300 rounded-md">
                    <RichTextEditor
                      content={syllabusContent}
                      onChange={setSyllabusContent}
                      height={400}
                    />
                  </div>
                </div>

                <FileAttachmentPanel
                  files={syllabusAttachmentFiles}
                  onChange={setSyllabusAttachmentFiles}
                  courseId={course?._id}
                  category="syllabus"
                  finalized={courseArchived}
                  label="Add syllabus attachments"
                  onRemoveFile={onRemoveSyllabusFile}
                />

                <div className="flex gap-2">
                  <button
                    onClick={handleSaveSyllabus}
                    disabled={savingSyllabus || courseArchived}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {savingSyllabus ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => {
                      setSyllabusMode('none');
                      setSyllabusContent(course.catalog?.syllabusContent || '');
                      setSyllabusAttachmentFiles([]);
                    }}
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
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Syllabus Content</h3>
            <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: course.catalog.syllabusContent }} />
          </div>
        )}

        {/* Display Syllabus Files */}
        {course.catalog?.syllabusFiles && course.catalog.syllabusFiles.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Syllabus Files</h3>
            <FileAttachmentChips
              files={course.catalog.syllabusFiles.map((file: { name?: string; url?: string; fileAssetId?: string }) => ({
                name: file.name,
                url: file.url?.startsWith('http') ? file.url : `${API_URL}${file.url}`,
                fileAssetId: file.fileAssetId,
              }))}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default SyllabusSection;

