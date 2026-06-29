import React, { useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import ProfileImage from '../common/ProfileImage';
import { TableRowSkeleton } from '../common/SkeletonLoader';
import { useVirtualWindow } from '../../hooks/useVirtualWindow';
import GradebookTableToolbar from '../../features/gradebook/GradebookTableToolbar';
import { useGradebookFilters } from '../../features/gradebook/useGradebookFilters';
import { useGradebookKeyboard } from '../../features/gradebook/useGradebookKeyboard';
import {
  getLetterGrade,
  isExcusedGrade,
  EXCUSED_GRADE,
} from '../../utils/gradeUtils';
import { computeStudentWeightedPercent } from '../../utils/gradebookCompute';
import AssignmentGroupsModal from './AssignmentGroupsModal';
import GradeScaleModal from './GradeScaleModal';
import GradingPolicyModal from './GradingPolicyModal';
import CourseGradeLifecyclePanel from './CourseGradeLifecyclePanel';

interface GradebookViewProps {
  course: any;
  courseId: string;
  /** Instructor gradebook is assembled asynchronously; when true, summary stats avoid stale numbers. */
  isGradebookLoading?: boolean;
  gradebookData: {
    students: any[];
    assignments: any[];
    grades: { [studentId: string]: { [assignmentId: string]: number | string } };
  };
  submissionMap: { [key: string]: string };
  studentSubmissions: any[];
  isInstructor: boolean;
  isAdmin: boolean;
  userRole?: string;
  expandedStudents: Set<string>;
  setExpandedStudents: React.Dispatch<React.SetStateAction<Set<string>>>;
  editingGrade: { studentId: string; assignmentId: string } | null;
  setEditingGrade: React.Dispatch<React.SetStateAction<{ studentId: string; assignmentId: string } | null>>;
  editingValue: string;
  setEditingValue: React.Dispatch<React.SetStateAction<string>>;
  savingGrade: { studentId: string; assignmentId: string } | null;
  handleGradeCellClick: (studentId: string, assignmentId: string, currentGrade: string) => void;
  handleGradeUpdate: (studentId: string, assignmentId: string, newGrade: string) => Promise<void>;
  handleGradeInputKeyDown?: (e: React.KeyboardEvent, studentId: string, assignmentId: string) => void;
  handleExportGradebookCSV: () => void;
  handleOpenGradeScaleModal: () => void;
  handleOpenGroupModal: () => void;
  showGroupModal: boolean;
  editGroups: any[];
  handleGroupChange: (idx: number, field: string, value: string | number) => void;
  handleAddGroupRow: () => void;
  handleRemoveGroupRow: (idx: number) => void;
  handleResetToDefaults: () => void;
  handleSaveGroups: () => Promise<void>;
  savingGroups: boolean;
  groupError: string;
  setShowGroupModal: React.Dispatch<React.SetStateAction<boolean>>;
  showGradeScaleModal: boolean;
  editGradeScale: any[];
  handleGradeScaleChange: (idx: number, field: string, value: string | number) => void;
  handleRemoveGradeScaleRow: (idx: number) => void;
  handleSaveGradeScale: () => Promise<void>;
  savingGradeScale: boolean;
  gradeScaleError: string;
  setShowGradeScaleModal: React.Dispatch<React.SetStateAction<boolean>>;
  setGradeScaleError: React.Dispatch<React.SetStateAction<string>>;
  setEditGradeScale: React.Dispatch<React.SetStateAction<any[]>>;
  resolvedGradingPolicy?: import('../../utils/gradeUtils').ResolvedGradingPolicy | null;
  gradingPolicyModal?: {
    show: boolean;
    setShow: (v: boolean) => void;
    editPolicy: import('../../utils/gradeUtils').GradingPolicyConfig;
    setEditPolicy: React.Dispatch<React.SetStateAction<import('../../utils/gradeUtils').GradingPolicyConfig>>;
    onSave: () => void;
    onPreview: () => void;
    saving: boolean;
    loading: boolean;
    error: string;
    preview: { totalPercent: number; letterGrade: string } | null;
    dirty?: boolean;
  };
}

const GradebookView: React.FC<GradebookViewProps> = ({
  course,
  courseId,
  isGradebookLoading = false,
  gradebookData,
  submissionMap,
  studentSubmissions,
  isInstructor,
  isAdmin,
  userRole,
  expandedStudents,
  setExpandedStudents,
  editingGrade,
  setEditingGrade,
  editingValue,
  setEditingValue,
  savingGrade,
  handleGradeCellClick,
  handleGradeUpdate,
  handleGradeInputKeyDown,
  handleExportGradebookCSV,
  handleOpenGradeScaleModal,
  handleOpenGroupModal,
  showGroupModal,
  editGroups,
  handleGroupChange,
  handleAddGroupRow,
  handleRemoveGroupRow,
  handleResetToDefaults,
  handleSaveGroups,
  savingGroups,
  groupError,
  setShowGroupModal,
  showGradeScaleModal,
  editGradeScale,
  handleGradeScaleChange,
  handleRemoveGradeScaleRow,
  handleSaveGradeScale,
  savingGradeScale,
  gradeScaleError,
  setShowGradeScaleModal,
  setGradeScaleError,
  setEditGradeScale,
  resolvedGradingPolicy = null,
  gradingPolicyModal,
}) => {
  const navigate = useNavigate();

  const { students, assignments, grades } = gradebookData;

  const gradebookGroupMap = useMemo(() => {
    const map = (course.groups || []).reduce((acc: any, group: any) => {
      acc[group.name] = { ...group, assignments: [] };
      return acc;
    }, {} as Record<string, any>);
    assignments.forEach((assignment: any) => {
      if (assignment.group && map[assignment.group]) {
        map[assignment.group].assignments.push(assignment);
      }
    });
    return map;
  }, [course.groups, assignments]);

  const weightedByStudent = useMemo(() => {
    const map: Record<string, number> = {};
    for (const student of students) {
      map[student._id] = computeStudentWeightedPercent(
        student._id,
        course,
        assignments,
        grades,
        submissionMap,
        studentSubmissions,
        resolvedGradingPolicy
      );
    }
    return map;
  }, [students, course, assignments, grades, submissionMap, studentSubmissions, resolvedGradingPolicy]);

  const getWeightedGrade = (student: any) => weightedByStudent[student._id] ?? 0;

  const {
    search,
    setSearch,
    filterMode,
    setFilterMode,
    filteredStudents,
    needsGradingCount,
  } = useGradebookFilters(courseId, students, assignments, grades, submissionMap, weightedByStudent);

  const GRADE_ROW_HEIGHT = 56;
  const scrollHeight = Math.min(900, Math.max(400, window.innerHeight * 0.75));
  const { enabled: virtualEnabled, range: virtualRange, onScroll: onVirtualScroll } = useVirtualWindow({
    itemCount: filteredStudents.length,
    estimatedItemHeight: GRADE_ROW_HEIGHT,
    containerHeight: scrollHeight,
    threshold: 50,
  });

  const displayStudents = virtualEnabled
    ? filteredStudents.slice(virtualRange.start, virtualRange.end)
    : filteredStudents;

  const keyboardMatrix = useMemo(
    () =>
      displayStudents.map((student) =>
        assignments.map((assignment) => ({
          studentId: student._id,
          assignmentId: assignment._id,
        }))
      ),
    [displayStudents, assignments]
  );

  const activateCell = useCallback(
    (cell: { studentId: string; assignmentId: string }) => {
      const grade = grades[cell.studentId]?.[cell.assignmentId];
      handleGradeCellClick(cell.studentId, cell.assignmentId, grade?.toString() || '');
    },
    [grades, handleGradeCellClick]
  );

  const { onKeyDown: onGradeCellKeyDown } = useGradebookKeyboard(keyboardMatrix, activateCell);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:p-5">
        <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Gradebook</h2>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 sm:text-sm">Track student performance and manage grades</p>
            {resolvedGradingPolicy?.version != null && (isInstructor || isAdmin) && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-500" title="Policy snapshot used for weighted totals">
                Policy v{resolvedGradingPolicy.version}
                {resolvedGradingPolicy.source ? ` · ${resolvedGradingPolicy.source}` : ''}
              </p>
            )}
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-center dark:border-gray-700 dark:bg-gray-800 flex-1 sm:flex-none">
              <div className="text-xs text-gray-600 dark:text-gray-400 sm:text-sm">Students</div>
              <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                {isGradebookLoading ? (
                  <span
                    className="inline-block text-gray-400 animate-pulse dark:text-gray-500"
                    aria-busy="true"
                    aria-label="Loading student count"
                  >
                    …
                  </span>
                ) : (
                  students.length
                )}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-center dark:border-gray-700 dark:bg-gray-800 flex-1 sm:flex-none">
              <div className="text-xs text-gray-600 dark:text-gray-400 sm:text-sm">Assignments</div>
              <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                {isGradebookLoading ? (
                  <span
                    className="inline-block text-gray-400 animate-pulse dark:text-gray-500"
                    aria-busy="true"
                    aria-label="Loading assignment count"
                  >
                    …
                  </span>
                ) : (
                  assignments.length
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {(isInstructor || isAdmin) && courseId && (
        <CourseGradeLifecyclePanel courseId={courseId} userRole={userRole} />
      )}

      {(isInstructor || isAdmin) && students.length > 0 && (
        <GradebookTableToolbar
          search={search}
          onSearchChange={setSearch}
          filterMode={filterMode}
          onFilterModeChange={setFilterMode}
          needsGradingCount={needsGradingCount}
          showingCount={filteredStudents.length}
          totalCount={students.length}
        />
      )}

      {/* Mobile Card View for Gradebook */}
      <div className="lg:hidden space-y-4">
        {filteredStudents.map((student: any) => {
          const weightedPercent = getWeightedGrade(student);
          const letter = getLetterGrade(weightedPercent, course?.gradeScale);
          let gradeColor = 'text-gray-700 dark:text-gray-300';
          if (letter === 'A') gradeColor = 'text-green-600 dark:text-green-400';
          else if (letter === 'B') gradeColor = 'text-blue-600 dark:text-blue-400';
          else if (letter === 'C') gradeColor = 'text-yellow-600 dark:text-yellow-400';
          else if (letter === 'D') gradeColor = 'text-orange-600 dark:text-orange-400';
          else if (letter === 'F') gradeColor = 'text-red-600 dark:text-red-400';
          
          const isExpanded = expandedStudents.has(student._id);
          const toggleStudent = () => {
            setExpandedStudents(prev => {
              const newSet = new Set(prev);
              if (newSet.has(student._id)) {
                newSet.delete(student._id);
              } else {
                newSet.add(student._id);
              }
              return newSet;
            });
          };
          
          return (
            <div key={`student-mobile-${student._id}`} className="bg-white dark:bg-gray-900 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div 
                className="flex items-center space-x-3 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                onClick={toggleStudent}
              >
                <ProfileImage
                  firstName={student.firstName}
                  lastName={student.lastName}
                  profilePicture={student.profilePicture}
                  size="md"
                />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{student.firstName} {student.lastName}</h3>
                  <div className="text-sm">
                    <span className={`font-bold ${gradeColor}`}>
                      {weightedPercent.toFixed(2)}% [{letter}]
                    </span>
                  </div>
                </div>
                <ChevronDown 
                  className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${isExpanded ? 'transform rotate-180' : ''}`}
                />
              </div>
              {isExpanded && (
                <div className="px-4 pt-4 pb-4 space-y-2 max-h-96 overflow-y-auto border-t border-gray-200 dark:border-gray-700">
                {assignments.map((assignment: any, assIdx: number) => {
                  const submissionKey = `${student._id}_${assignment._id}`;
                  const hasSubmission = assignment.isDiscussion 
                    ? Array.isArray(assignment.replies) && assignment.replies.some((r: any) => r.author && (r.author._id === student._id || r.author === student._id))
                    : !!submissionMap[submissionKey];
                  const grade = grades[student._id]?.[assignment._id];
                  const maxPoints = assignment.questions?.reduce((sum: number, q: any) => sum + (q.points || 0), 0) || assignment.totalPoints || 0;
                  
                  let cellContent: React.ReactNode;
                  if (!assignment.isDiscussion && !assignment.published) {
                    cellContent = <span className="text-xs text-gray-500 dark:text-gray-400 italic">Not Published</span>;
                  } else if (isExcusedGrade(grade) || grade === EXCUSED_GRADE) {
                    cellContent = (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                        Excused
                      </span>
                    );
                  } else if (typeof grade === 'number') {
                    const percentage = (grade / maxPoints) * 100;
                    let gradeBg = 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300';
                    if (percentage < 60) gradeBg = 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300';
                    else if (percentage < 70) gradeBg = 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300';
                    else if (percentage < 80) gradeBg = 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300';
                    cellContent = (
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${gradeBg}`}>
                        {Number.isInteger(grade) ? grade : Number(grade).toFixed(2)} / {maxPoints}
                      </span>
                    );
                  } else if (hasSubmission) {
                    cellContent = (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                        Not Graded
                      </span>
                    );
                  } else if (assignment.isOfflineAssignment) {
                    cellContent = (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300">
                        Offline
                      </span>
                    );
                  } else {
                    cellContent = (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                        No Submission
                      </span>
                    );
                  }
                  
                  return (
                    <div 
                      key={`${student._id}-${assignment._id}-${assIdx}`}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => {
                        if (assignment.isDiscussion) {
                          navigate(`/courses/${courseId}/threads/${assignment._id}`);
                        } else {
                          navigate(`/assignments/${assignment._id}/view`);
                        }
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{assignment.title}</div>
                        {assignment.group && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">{assignment.group}</div>
                        )}
                      </div>
                      <div className="ml-2 flex-shrink-0">
                        {cellContent}
                      </div>
                    </div>
                  );
                })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop Gradebook Table — scroll inside card so header row stays visible */}
      <div className="hidden lg:block rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="relative w-full">
          <div className="max-h-[min(75vh,900px)] w-full overflow-auto" onScroll={onVirtualScroll}>
            <table
              className="min-w-max w-full border-collapse"
              role="table"
              aria-label="Course gradebook"
            >
              <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm dark:bg-gray-800 dark:shadow-none">
                <tr>
                  {/* Sticky first column header */}
                  <th className="px-6 py-4 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-left text-gray-700 dark:text-gray-300 sticky left-0 top-0 z-20 font-semibold text-sm uppercase tracking-wider" style={{ boxShadow: '2px 0 8px -4px rgba(0,0,0,0.1)' }}>
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span>Student Name</span>
                    </div>
                  </th>
                  {assignments.map((assignment: any, idx: number) => {
                    const handleAssignmentClick = () => {
                      if (assignment.isDiscussion) {
                        // Navigate to discussion thread
                        navigate(`/courses/${courseId}/threads/${assignment._id}`);
                      } else {
                        // Navigate to assignment view page
                        navigate(`/assignments/${assignment._id}/view`);
                      }
                    };

                    return (
                      <th
                        key={`assignment-${assignment._id}-${idx}`}
                        className="px-4 py-4 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-center text-gray-700 dark:text-gray-300 min-w-[140px]"
                      >
                        <div 
                          className="font-semibold text-blue-700 dark:text-blue-300 cursor-pointer hover:underline text-center text-sm"
                          onClick={handleAssignmentClick}
                        >
                          {assignment.title}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1 bg-blue-50 dark:bg-blue-900/20 rounded-full px-2 py-1 mx-1">
                          {assignment.group ? assignment.group : 'Ungrouped'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">
                          Out of {assignment.questions?.reduce((sum: number, q: any) => sum + (q.points || 0), 0) || assignment.totalPoints || 0}
                        </div>
                      </th>
                    );
                  })}
                  {/* Sticky last column header */}
                  <th className="px-6 py-4 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-center text-gray-700 dark:text-gray-300 sticky right-0 top-0 z-20 font-semibold text-sm uppercase tracking-wider" style={{ boxShadow: '-2px 0 8px -4px rgba(0,0,0,0.1)' }}>
                    <div className="flex items-center justify-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span>Overall Grade</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {isGradebookLoading && (
                  <TableRowSkeleton columns={assignments.length + 2} rows={8} />
                )}
                {!isGradebookLoading && virtualEnabled && virtualRange.paddingTop > 0 && (
                  <tr aria-hidden style={{ height: virtualRange.paddingTop }}>
                    <td colSpan={assignments.length + 2} />
                  </tr>
                )}
                {!isGradebookLoading &&
                displayStudents.map((student: any, localIdx: number) => {
                  const rowIdx = virtualEnabled ? virtualRange.start + localIdx : localIdx;
                  // Calculate weighted grade
                  const weightedPercent = getWeightedGrade(student);
                  const letter = getLetterGrade(weightedPercent, course?.gradeScale);
                  const rowBg = rowIdx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800';
                  const stickyBg = rowIdx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800';
                  
                  // Determine grade color
                  let gradeColor = 'text-gray-700 dark:text-gray-300';
                  if (letter === 'A') gradeColor = 'text-green-600 dark:text-green-400';
                  else if (letter === 'B') gradeColor = 'text-blue-600 dark:text-blue-400';
                  else if (letter === 'C') gradeColor = 'text-yellow-600 dark:text-yellow-400';
                  else if (letter === 'D') gradeColor = 'text-orange-600 dark:text-orange-400';
                  else if (letter === 'F') gradeColor = 'text-red-600 dark:text-red-400';
                  
                  return (
                    <tr
                      key={student._id}
                      className={`${rowBg} hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150`}
                    >
                      {/* Sticky first column body */}
                      <td className={`px-6 py-4 border-r border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer font-medium whitespace-nowrap sticky left-0 z-[5] ${stickyBg} transition-colors duration-150`} style={{ boxShadow: '2px 0 8px -4px rgba(0,0,0,0.1)' }}>
                        <div className="flex items-center space-x-3">
                          <ProfileImage
                            firstName={student.firstName}
                            lastName={student.lastName}
                            profilePicture={student.profilePicture}
                            size="sm"
                          />
                          <span>{student.firstName} {student.lastName}</span>
                        </div>
                      </td>
                      {assignments.map((assignment: any, assIdx: number) => {
                        const submissionKey = `${student._id}_${assignment._id}`;
                        const hasSubmission = assignment.isDiscussion 
                          ? Array.isArray(assignment.replies) && assignment.replies.some((r: any) => r.author && (r.author._id === student._id || r.author === student._id))
                          : !!submissionMap[submissionKey];
                        const isDiscussion = assignment.isDiscussion;
                        const grade = grades[student._id]?.[assignment._id];
                        const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
                        const now = new Date();
                        
                        // Get submission date if exists
                        let submittedAt: Date | null = null;
                        if (isDiscussion) {
                          if (Array.isArray(assignment.replies)) {
                            const reply = assignment.replies.find((r: any) => r.author && (r.author._id === student._id || r.author === student._id));
                            if (reply && reply.createdAt) {
                              submittedAt = new Date(reply.createdAt);
                            }
                          }
                        } else {
                          const submission = submissionMap[submissionKey];
                          if (submission) {
                            const sub = studentSubmissions.find(s => s._id === submission);
                            if (sub?.submittedAt) {
                              submittedAt = new Date(sub.submittedAt);
                            }
                          }
                        }

                        let cellContent: React.ReactNode;
                        let cellBg = '';
                        let cellTextColor = 'text-gray-900 dark:text-gray-100';
                        
                        if (!assignment.isDiscussion && !assignment.published) {
                          // Not published
                          cellContent = <span className="text-gray-500 dark:text-gray-400 italic">Not Published</span>;
                          cellBg = 'bg-gray-100 dark:bg-gray-800';
                        } else if (isExcusedGrade(grade) || grade === EXCUSED_GRADE) {
                          cellContent = (
                            <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                              Excused
                            </div>
                          );
                          cellBg = 'bg-gray-100 dark:bg-gray-800';
                        } else if (typeof grade === 'number') {
                          // If graded, show the grade
                          const maxPoints = assignment.questions?.reduce((sum: number, q: any) => sum + (q.points || 0), 0) || assignment.totalPoints || 0;
                          const percentage = (grade / maxPoints) * 100;
                          let gradeBg = 'bg-green-100 dark:bg-green-900/20';
                          if (percentage < 60) gradeBg = 'bg-red-100 dark:bg-red-900/20';
                          else if (percentage < 70) gradeBg = 'bg-orange-100 dark:bg-orange-900/20';
                          else if (percentage < 80) gradeBg = 'bg-yellow-100 dark:bg-yellow-900/20';
                          
                          cellContent = (
                            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${gradeBg} ${percentage < 60 ? 'text-red-700 dark:text-red-300' : percentage < 70 ? 'text-orange-700 dark:text-orange-300' : percentage < 80 ? 'text-yellow-700 dark:text-yellow-300' : 'text-green-700 dark:text-green-300'}`}>
                              {Number.isInteger(grade) ? grade : Number(grade).toFixed(2)}
                            </div>
                          );
                        } else if (hasSubmission) {
                          if (dueDate && submittedAt && submittedAt.getTime() > dueDate.getTime()) {
                            // Submitted late
                            cellContent = (
                              <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300">
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Late
                              </div>
                            );
                          } else {
                            // Submitted but not graded
                            cellContent = (
                              <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Not Graded
                              </div>
                            );
                          }
                        } else if (assignment.isOfflineAssignment) {
                          // Offline assignment - allow manual grade entry even without submission
                          // Bypass "0 (MA)" logic for offline assignments
                          cellContent = (
                            <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300">
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Add Grade
                            </div>
                          );
                        } else if (dueDate && now.getTime() > dueDate.getTime()) {
                          // Missing after due date (only for non-offline assignments)
                          cellContent = (
                            <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300">
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              0 (MA)
                            </div>
                          );
                        } else {
                          // Not submitted yet, due date not passed
                          cellContent = (
                            <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              No Submission
                            </div>
                          );
                        }

                        const handleCellClick = (e: React.MouseEvent) => {
                          // If clicking on input or editing controls, don't navigate
                          const target = e.target as HTMLElement;
                          if (target.tagName === 'INPUT' || target.closest('input')) {
                            return;
                          }

                          // If instructor/admin clicking on cell with submission OR offline assignment, allow editing
                          if ((isInstructor || isAdmin) && (hasSubmission || assignment.isOfflineAssignment)) {
                            handleGradeCellClick(student._id, assignment._id, grade?.toString() || '');
                          } else {
                            // Otherwise, navigate to assignment/discussion view
                            if (assignment.isDiscussion) {
                              navigate(`/courses/${courseId}/threads/${assignment._id}`);
                            } else {
                              navigate(`/assignments/${assignment._id}/view`);
                            }
                          }
                        };

                        return (
                          <td
                            key={`${student._id}-${assignment._id}-${assIdx}`}
                            data-grade-cell={`${student._id}-${assignment._id}`}
                            tabIndex={hasSubmission || assignment.published || assignment.isOfflineAssignment ? 0 : -1}
                            className={`px-4 py-4 text-center whitespace-nowrap relative ${rowBg} ${cellBg} transition-all duration-150 ${hasSubmission || assignment.published || assignment.isOfflineAssignment ? 'cursor-pointer' : ''}`}
                            onClick={handleCellClick}
                            onKeyDown={(e) => {
                              onGradeCellKeyDown(e, localIdx, assIdx);
                              if (handleGradeInputKeyDown && editingGrade?.studentId === student._id && editingGrade?.assignmentId === assignment._id) {
                                handleGradeInputKeyDown(e, student._id, assignment._id);
                              }
                            }}
                          >
                            {editingGrade?.studentId === student._id && editingGrade?.assignmentId === assignment._id ? (
                              <div className="relative">
                                <input
                                  type="number"
                                  id={`grade-input-${student._id}-${assignment._id}`}
                                  name={`grade-${student._id}-${assignment._id}`}
                                  step="0.01"
                                  min="0"
                                  max={assignment.questions?.reduce((sum: number, q: any) => sum + (q.points || 0), 0) || assignment.totalPoints || 0}
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleGradeUpdate(student._id, assignment._id, editingValue);
                                    } else if (e.key === 'Escape') {
                                      setEditingGrade(null);
                                    }
                                  }}
                                  className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  autoFocus
                                />
                              </div>
                            ) : (
                              <div
                                className={`${(isInstructor || isAdmin) && hasSubmission ? 'cursor-pointer hover:scale-105 transform transition-transform duration-150' : ''} ${savingGrade?.studentId === student._id && savingGrade?.assignmentId === assignment._id ? 'opacity-50' : ''}`}
                              >
                                {savingGrade?.studentId === student._id && savingGrade?.assignmentId === assignment._id ? (
                                  <div className="inline-flex items-center">
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Saving...
                                  </div>
                                ) : null}
                                {cellContent}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      {/* Sticky last column body */}
                      <td className={`px-6 py-4 border-l border-gray-200 dark:border-gray-600 text-center font-semibold whitespace-nowrap sticky right-0 z-[5] ${rowBg} transition-colors duration-150`} style={{ boxShadow: '-2px 0 8px -4px rgba(0,0,0,0.1)' }}>
                        {(course.groups && course.groups.length > 0) ? (
                          <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold ${gradeColor} bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-600`}>
                            {Number(weightedPercent).toFixed(2)}% ({letter})
                          </div>
                        ) : '-'}
                      </td>
                    </tr>
                  );
                })}
                {!isGradebookLoading && virtualEnabled && virtualRange.paddingBottom > 0 && (
                  <tr aria-hidden style={{ height: virtualRange.paddingBottom }}>
                    <td colSpan={assignments.length + 2} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Right edge gradient for horizontal scroll cue */}
          <div className="pointer-events-none absolute inset-y-0 right-0 z-[12] w-12 bg-gradient-to-l from-white to-transparent dark:from-gray-900" />
        </div>
        {(!students.length || !assignments.length) && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No data available</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">No students or assignments found.</p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {(isInstructor || isAdmin) && (
        <div className="flex justify-end space-x-4">
          <div className="flex space-x-3">
            <button
              className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
              onClick={handleExportGradebookCSV}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export Excel
            </button>
            {gradingPolicyModal && (
              <button
                type="button"
                className="inline-flex items-center rounded-lg border border-violet-200 bg-violet-50 px-5 py-2.5 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-900/30 dark:text-violet-300 dark:hover:bg-violet-900/50"
                onClick={() => gradingPolicyModal.setShow(true)}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Grading Policies
              </button>
            )}
            <button
              className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-5 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
              onClick={handleOpenGradeScaleModal}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Grade Scale
            </button>
          </div>
        </div>
      )}
      {/* Assignment Group Weights Display & Edit Button */}
      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-600 dark:bg-gray-800 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 dark:bg-blue-900 rounded-lg p-2 flex-shrink-0">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">Assignment Weights</h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">Configure how different assignment types contribute to final grades</p>
              </div>
            </div>
            {(isInstructor || isAdmin) && (
              <button
                onClick={handleOpenGroupModal}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center space-x-2 shadow-sm w-full sm:w-auto"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>Edit Groups</span>
              </button>
            )}
          </div>
        </div>
        
        {/* Mobile Card View */}
        <div className="md:hidden p-4 space-y-3">
          {(course.groups || []).map((group: any, idx: number) => (
            <div key={idx} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{group.name}</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{group.weight}%</div>
              </div>
            </div>
          ))}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border-2 border-blue-200 dark:border-blue-700">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-blue-900 dark:text-blue-100">Total</div>
              <div className="text-sm font-bold text-blue-900 dark:text-blue-100">{(course.groups || []).reduce((sum: number, g: any) => sum + Number(g.weight), 0)}%</div>
            </div>
          </div>
        </div>
        
        {/* Desktop Table View */}
        <div className="hidden md:block p-6">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
            <table className="w-full" role="table" aria-label="Assignment group weights">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Assignment Group</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Weight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {(course.groups || []).map((group: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">{group.name}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-gray-100 text-right">{group.weight}%</td>
                  </tr>
                ))}
                <tr className="bg-blue-50 dark:bg-blue-900/20 border-t-2 border-blue-200 dark:border-blue-700">
                  <td className="px-6 py-4 text-sm font-bold text-blue-900 dark:text-blue-100">Total</td>
                  <td className="px-6 py-4 text-sm font-bold text-blue-900 dark:text-blue-100 text-right">{(course.groups || []).reduce((sum: number, g: any) => sum + Number(g.weight), 0)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <AssignmentGroupsModal
        showGroupModal={showGroupModal}
        editGroups={editGroups}
        handleGroupChange={handleGroupChange}
        handleAddGroupRow={handleAddGroupRow}
        handleRemoveGroupRow={handleRemoveGroupRow}
        handleResetToDefaults={handleResetToDefaults}
        handleSaveGroups={handleSaveGroups}
        savingGroups={savingGroups}
        groupError={groupError}
        setShowGroupModal={setShowGroupModal}
      />
      {gradingPolicyModal && (
        <GradingPolicyModal
          courseId={courseId}
          userRole={userRole}
          show={gradingPolicyModal.show}
          onClose={() => gradingPolicyModal.setShow(false)}
          editPolicy={gradingPolicyModal.editPolicy}
          setEditPolicy={gradingPolicyModal.setEditPolicy}
          onSave={gradingPolicyModal.onSave}
          onPreview={gradingPolicyModal.onPreview}
          saving={gradingPolicyModal.saving}
          loading={gradingPolicyModal.loading}
          error={gradingPolicyModal.error}
          preview={gradingPolicyModal.preview}
        />
      )}
      <GradeScaleModal
        showGradeScaleModal={showGradeScaleModal}
        editGradeScale={editGradeScale}
        handleGradeScaleChange={handleGradeScaleChange}
        handleRemoveGradeScaleRow={handleRemoveGradeScaleRow}
        handleSaveGradeScale={handleSaveGradeScale}
        savingGradeScale={savingGradeScale}
        gradeScaleError={gradeScaleError}
        setShowGradeScaleModal={setShowGradeScaleModal}
        setEditGradeScale={setEditGradeScale}
        setGradeScaleError={setGradeScaleError}
      />
    </div>
  );
};

export default GradebookView;

