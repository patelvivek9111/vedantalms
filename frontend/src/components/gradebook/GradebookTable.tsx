import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../../services/api';
import { getLetterGrade, calculateFinalGradeWithWeightedGroups } from '../../utils/gradeUtils';
import GradebookCell from './GradebookCell';

interface GradebookTableProps {
  courseId: string;
  course: any;
  students: any[];
  assignments: any[];
  grades: { [studentId: string]: { [assignmentId: string]: number | string } };
  submissionMap: { [key: string]: string };
  studentSubmissions: any[];
  isInstructor: boolean;
  isAdmin: boolean;
  editingGrade: { studentId: string; assignmentId: string } | null;
  setEditingGrade: React.Dispatch<React.SetStateAction<{ studentId: string; assignmentId: string } | null>>;
  editingValue: string;
  setEditingValue: React.Dispatch<React.SetStateAction<string>>;
  savingGrade: { studentId: string; assignmentId: string } | null;
  gradeError: string;
  setGradeError: React.Dispatch<React.SetStateAction<string>>;
  handleGradeCellClick: (studentId: string, assignmentId: string, currentGrade: number | string) => void;
  handleGradeUpdate: (studentId: string, assignmentId: string, newGrade: string) => Promise<void>;
}

const GradebookTable: React.FC<GradebookTableProps> = ({
  courseId,
  course,
  students,
  assignments,
  grades,
  submissionMap,
  studentSubmissions,
  isInstructor,
  isAdmin,
  editingGrade,
  setEditingGrade,
  editingValue,
  setEditingValue,
  savingGrade,
  gradeError,
  setGradeError,
  handleGradeCellClick,
  handleGradeUpdate,
}) => {
  const navigate = useNavigate();

  // Memoize student grades - only recalculate when all data is ready
  // Check if we have both grades data AND submission map before calculating
  const hasGradesData = students.length > 0 && assignments.length > 0 && Object.keys(grades).length > 0;
  const hasSubmissionMap = submissionMap && Object.keys(submissionMap).length > 0;
  const isDataReady = hasGradesData && hasSubmissionMap;
  
  const studentGrades = useMemo(() => {
    const gradeMap: { [studentId: string]: number } = {};
    
    // Don't calculate if data is not ready - return empty map
    // This prevents incorrect calculations during initial load
    if (!isDataReady) {
      return gradeMap;
    }
    
    students.forEach((student: any) => {
      const studentSubmissionMap: { [assignmentId: string]: any } = {};
      
      // Build submission map for this student
      Object.keys(submissionMap).forEach(key => {
        if (key.startsWith(`${student._id}_`)) {
          const assignmentId = key.split('_')[1];
          studentSubmissionMap[assignmentId] = submissionMap[key];
        }
      });
      
      const augmentedAssignments = assignments.map((a: any) => {
        if (a.isDiscussion) {
          const hasSubmitted = Array.isArray(a.replies)
            ? a.replies.some((r: any) => {
                const authorId = r.author && r.author._id ? String(r.author._id) : String(r.author || '');
                if (authorId === String(student._id)) return true;
                if (Array.isArray(r.replies) && r.replies.length > 0) {
                  const stack = [...r.replies];
                  while (stack.length) {
                    const cur = stack.pop();
                    const curAuthorId = cur.author && cur.author._id ? String(cur.author._id) : String(cur.author || '');
                    if (curAuthorId === String(student._id)) return true;
                    if (Array.isArray(cur.replies)) stack.push(...cur.replies);
                  }
                }
                return false;
              })
            : false;
          return { ...a, hasSubmitted };
        }
        return a;
      });
      
      gradeMap[student._id] = calculateFinalGradeWithWeightedGroups(
        student._id,
        course,
        augmentedAssignments,
        grades,
        studentSubmissionMap
      );
    });
    
    return gradeMap;
  }, [students, assignments, grades, submissionMap, course, isDataReady]);

  // Helper to get weighted grade for a student (from memoized cache)
  const getWeightedGrade = (student: any) => {
    return studentGrades[student._id] || 0;
  };

  return (
    <div className="hidden lg:block bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="relative w-full">
        <div className="overflow-x-auto w-full relative">
          <table className="min-w-max w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 sticky top-0 z-10">
              <tr>
                {/* Sticky first column header */}
                <th className="px-6 py-4 border-b border-gray-200 dark:border-gray-600 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 text-left text-gray-700 dark:text-gray-300 sticky left-0 z-50 font-semibold text-sm uppercase tracking-wider" style={{left: 0, zIndex: 50, boxShadow: '2px 0 8px -4px rgba(0,0,0,0.1)'}}>
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
                      navigate(`/courses/${courseId}/threads/${assignment._id}`);
                    } else {
                      navigate(`/assignments/${assignment._id}/view`);
                    }
                  };

                  return (
                    <th
                      key={`assignment-${assignment._id}-${idx}`}
                      className="px-4 py-4 border-b border-gray-200 dark:border-gray-600 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 text-center text-gray-700 dark:text-gray-300 min-w-[140px]"
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
                <th className="px-6 py-4 border-b border-gray-200 dark:border-gray-600 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 text-center text-gray-700 dark:text-gray-300 sticky right-0 z-50 font-semibold text-sm uppercase tracking-wider" style={{right: 0, zIndex: 50, boxShadow: '-2px 0 8px -4px rgba(0,0,0,0.1)'}}>
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
              {students.map((student: any, rowIdx: number) => {
                const weightedPercent = isDataReady ? getWeightedGrade(student) : 0;
                const letter = isDataReady ? getLetterGrade(weightedPercent, course?.gradeScale) : '-';
                const rowBg = rowIdx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800';
                const stickyBg = rowIdx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800';
                
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
                    <td className={`px-6 py-4 border-r border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer font-medium whitespace-nowrap sticky left-0 z-40 ${stickyBg} transition-colors duration-150`} style={{left: 0, zIndex: 40, boxShadow: '2px 0 8px -4px rgba(0,0,0,0.1)'}}>
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          {student.profilePicture ? (
                            <img
                              src={student.profilePicture.startsWith('http')
                                ? student.profilePicture
                                : getImageUrl(student.profilePicture)}
                              alt={`${student.firstName} ${student.lastName}`}
                              className="w-8 h-8 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                if (fallback) {
                                  fallback.style.display = 'flex';
                                }
                              }}
                            />
                          ) : null}
                          <div 
                            className={`w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold ${student.profilePicture ? 'hidden' : ''}`}
                            style={{ display: student.profilePicture ? 'none' : 'flex' }}
                          >
                            {student.firstName.charAt(0)}{student.lastName.charAt(0)}
                          </div>
                        </div>
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

                      return (
                        <GradebookCell
                          key={`${student._id}-${assignment._id}-${assIdx}`}
                          courseId={courseId}
                          studentId={student._id}
                          assignment={assignment}
                          grade={grade}
                          hasSubmission={hasSubmission}
                          submittedAt={submittedAt}
                          dueDate={dueDate}
                          rowBg={rowBg}
                          isInstructor={isInstructor}
                          isAdmin={isAdmin}
                          editingGrade={editingGrade}
                          setEditingGrade={setEditingGrade}
                          editingValue={editingValue}
                          setEditingValue={setEditingValue}
                          savingGrade={savingGrade}
                          gradeError={gradeError}
                          setGradeError={setGradeError}
                          handleGradeCellClick={handleGradeCellClick}
                          handleGradeUpdate={handleGradeUpdate}
                        />
                      );
                    })}
                    {/* Sticky last column body */}
                    <td className={`px-6 py-4 border-l border-gray-200 dark:border-gray-600 text-center font-semibold whitespace-nowrap sticky right-0 z-40 ${rowBg} transition-colors duration-150`} style={{right: 0, zIndex: 40, boxShadow: '-2px 0 8px -4px rgba(0,0,0,0.1)'}}>
                      {!isDataReady ? (
                        <div className="inline-flex items-center px-4 py-2 rounded-full text-sm font-bold text-gray-400 bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-600">
                          Loading...
                        </div>
                      ) : (course.groups && course.groups.length > 0) ? (
                        <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold ${gradeColor} bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-600`}>
                          {Number(weightedPercent).toFixed(2)}% ({letter})
                        </div>
                      ) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Right edge gradient for scroll cue */}
        <div className="pointer-events-none absolute top-0 right-0 h-full w-12 bg-gradient-to-l from-gray-50 dark:from-gray-800 to-transparent" style={{zIndex: 10}} />
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
  );
};

export default GradebookTable;

