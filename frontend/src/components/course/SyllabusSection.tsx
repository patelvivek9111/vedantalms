import React from 'react';
import {
  BookOpen,
  Clock,
  FilePenLine,
  Hash,
  Mail,
  Pencil,
  Upload,
  User,
} from 'lucide-react';
import RichTextEditor from '../common/RichTextEditor';
import FileAttachmentPanel from '../files/FileAttachmentPanel';
import FileAttachmentChips from '../files/FileAttachmentChips';
import SanitizedHtml from '../common/SanitizedHtml';
import type { NormalizedFile } from '../../utils/fileTypes';
import { API_URL } from '../../config';

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
  onEnterUploadMode?: () => void;
  onEnterEditorMode?: () => void;
  onDeletePublishedSyllabusFile?: (file: NormalizedFile) => void;
}

const labelClass =
  'mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400';
const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-500';

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</p>
        <p className="mt-1 text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">{value}</p>
      </div>
    </div>
  );
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
  onEnterUploadMode,
  onEnterEditorMode,
  onDeletePublishedSyllabusFile,
}) => {
  const canEdit = isInstructor || isAdmin;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/90 shadow-sm shadow-slate-200/40 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950/90 dark:shadow-none">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-slate-200/80 bg-white/60 px-5 py-5 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/40 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/25 dark:shadow-blue-900/40">
              <BookOpen className="h-5 w-5" strokeWidth={2} aria-hidden />
            </span>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">Course Syllabus</h2>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Official course information and materials</p>
            </div>
          </div>
          {canEdit && !editingSyllabus && (
            <button
              type="button"
              onClick={() => setEditingSyllabus(true)}
              className="inline-flex items-center justify-center gap-2 self-start rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 sm:self-auto"
            >
              <Pencil className="h-4 w-4" aria-hidden />
              Edit
            </button>
          )}
        </div>

        <div className="space-y-8 px-5 py-6 sm:px-6 sm:py-8">
          {/* Course details */}
          <section aria-labelledby="syllabus-details-heading">
            <div className="mb-4 flex items-center gap-2">
              <h3 id="syllabus-details-heading" className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Course details
              </h3>
              <span className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent dark:from-slate-700" aria-hidden />
            </div>

            {editingSyllabus && canEdit ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="syllabus-course-title" className={labelClass}>
                      Course title
                    </label>
                    <input
                      id="syllabus-course-title"
                      type="text"
                      value={syllabusFields.courseTitle}
                      onChange={(e) => handleSyllabusFieldChange('courseTitle', e.target.value)}
                      className={inputClass}
                      placeholder="—"
                    />
                  </div>
                  <div>
                    <label htmlFor="syllabus-course-code" className={labelClass}>
                      Course code
                    </label>
                    <input
                      id="syllabus-course-code"
                      type="text"
                      value={syllabusFields.courseCode}
                      onChange={(e) => handleSyllabusFieldChange('courseCode', e.target.value)}
                      className={inputClass}
                      placeholder="—"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="syllabus-instructor" className={labelClass}>
                    Instructor
                  </label>
                  <input
                    id="syllabus-instructor"
                    type="text"
                    value={syllabusFields.instructorName}
                    onChange={(e) => handleSyllabusFieldChange('instructorName', e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="syllabus-email" className={labelClass}>
                    Email
                  </label>
                  <input
                    id="syllabus-email"
                    type="email"
                    value={syllabusFields.instructorEmail}
                    onChange={(e) => handleSyllabusFieldChange('instructorEmail', e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="syllabus-office" className={labelClass}>
                    Office hours
                  </label>
                  <input
                    id="syllabus-office"
                    type="text"
                    value={syllabusFields.officeHours}
                    onChange={(e) => handleSyllabusFieldChange('officeHours', e.target.value)}
                    className={inputClass}
                    placeholder="By appointment"
                  />
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSaveSyllabusFields}
                    disabled={savingSyllabus}
                    className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingSyllabus ? 'Saving…' : 'Save details'}
                  </button>
                  <button
                    type="button"
                    onClick={onCancelEdit}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/80"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InfoTile icon={BookOpen} label="Course title" value={syllabusFields.courseTitle || '—'} />
                <InfoTile icon={Hash} label="Course code" value={syllabusFields.courseCode || '—'} />
                <InfoTile icon={User} label="Instructor" value={syllabusFields.instructorName || '—'} />
                <InfoTile icon={Mail} label="Email" value={syllabusFields.instructorEmail || '—'} />
                <div className="sm:col-span-2">
                  <InfoTile icon={Clock} label="Office hours" value={syllabusFields.officeHours || 'By appointment'} />
                </div>
              </div>
            )}
          </section>

          {/* Instructor: add syllabus */}
          {canEdit && (
            <section aria-labelledby="add-syllabus-heading" className="border-t border-slate-200/80 pt-8 dark:border-slate-800">
              <div className="mb-4 flex items-center gap-2">
                <h3 id="add-syllabus-heading" className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Add syllabus
                </h3>
                <span className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent dark:from-slate-700" aria-hidden />
              </div>

              {syllabusMode === 'none' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => (onEnterUploadMode ? onEnterUploadMode() : setSyllabusMode('upload'))}
                    className="group flex flex-col items-start gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white/80 p-5 text-left shadow-sm transition hover:border-blue-400 hover:bg-blue-50/40 dark:border-slate-600 dark:bg-slate-900/40 dark:hover:border-blue-500 dark:hover:bg-blue-950/20"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-950/60 dark:text-blue-300 dark:group-hover:bg-blue-600">
                      <Upload className="h-5 w-5" strokeWidth={2} aria-hidden />
                    </span>
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">Upload file</span>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Attach PDF, Word, or other documents as the primary syllabus.</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => (onEnterEditorMode ? onEnterEditorMode() : setSyllabusMode('editor'))}
                    className="group flex flex-col items-start gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white/80 p-5 text-left shadow-sm transition hover:border-blue-400 hover:bg-blue-50/40 dark:border-slate-600 dark:bg-slate-900/40 dark:hover:border-blue-500 dark:hover:bg-blue-950/20"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition group-hover:bg-blue-600 group-hover:text-white dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-blue-600">
                      <FilePenLine className="h-5 w-5" strokeWidth={2} aria-hidden />
                    </span>
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">Rich text + files</span>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Write syllabus content in the editor and optionally add supporting files.</p>
                    </div>
                  </button>
                </div>
              )}

              {syllabusMode === 'upload' && (
                <div className="space-y-4 rounded-xl border border-slate-200/80 bg-white/70 p-4 shadow-inner dark:border-slate-700 dark:bg-slate-900/30 sm:p-5">
                  <FileAttachmentPanel
                    files={syllabusAttachmentFiles}
                    onChange={setSyllabusAttachmentFiles}
                    courseId={course?._id}
                    category="syllabus"
                    finalized={courseArchived}
                    label="Drop syllabus files here or browse"
                    onRemoveFile={onRemoveSyllabusFile}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleSaveSyllabus}
                      disabled={savingSyllabus || courseArchived}
                      className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savingSyllabus ? 'Saving…' : 'Save syllabus'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSyllabusMode('none');
                        setSyllabusAttachmentFiles([]);
                      }}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {syllabusMode === 'editor' && (
                <div className="space-y-4 rounded-xl border border-slate-200/80 bg-white/70 p-4 shadow-inner dark:border-slate-700 dark:bg-slate-900/30 sm:p-5">
                  <div>
                    <label htmlFor="syllabus-richtext" className={labelClass}>
                      Syllabus content
                    </label>
                    <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-slate-600">
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
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleSaveSyllabus}
                      disabled={savingSyllabus || courseArchived}
                      className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savingSyllabus ? 'Saving…' : 'Save syllabus'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSyllabusMode('none');
                        setSyllabusContent(course.catalog?.syllabusContent || '');
                        setSyllabusAttachmentFiles([]);
                      }}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Published syllabus body */}
          {course.catalog?.syllabusContent && (
            <section aria-labelledby="syllabus-body-heading" className="border-t border-slate-200/80 pt-8 dark:border-slate-800">
              <div className="mb-4 flex items-center gap-2">
                <h3 id="syllabus-body-heading" className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Syllabus content
                </h3>
                <span className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent dark:from-slate-700" aria-hidden />
              </div>
              <SanitizedHtml
                className="prose prose-slate max-w-none prose-headings:tracking-tight prose-a:text-blue-600 dark:prose-invert"
                html={course.catalog.syllabusContent}
              />
            </section>
          )}

          {course.catalog?.syllabusFiles && course.catalog.syllabusFiles.length > 0 && (
            <section aria-labelledby="syllabus-files-heading" className="border-t border-slate-200/80 pt-8 dark:border-slate-800">
              <div className="mb-4 flex items-center gap-2">
                <h3 id="syllabus-files-heading" className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Syllabus files
                </h3>
                <span className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent dark:from-slate-700" aria-hidden />
              </div>
              <FileAttachmentChips
                files={course.catalog.syllabusFiles.map((file: { name?: string; url?: string; fileAssetId?: string }) => ({
                  name: file.name,
                  url: file.url?.startsWith('http') ? file.url : `${API_URL}${file.url}`,
                  fileAssetId: file.fileAssetId,
                }))}
                removable={canEdit && !courseArchived}
                onRemove={
                  onDeletePublishedSyllabusFile
                    ? (file) => onDeletePublishedSyllabusFile(file)
                    : undefined
                }
              />
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default SyllabusSection;
