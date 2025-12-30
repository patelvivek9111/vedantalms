import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { getImageUrl } from '../../services/api';
import { getLetterGrade, calculateFinalGradeWithWeightedGroups } from '../../utils/gradeUtils';

interface GradebookMobileViewProps {
  courseId: string;
  course: any;
  students: any[];
  assignments: any[];
  grades: { [studentId: string]: { [assignmentId: string]: number | string } };
  submissionMap: { [key: string]: string };
  expandedStudents: Set<string>;
  setExpandedStudents: React.Dispatch<React.SetStateAction<Set<string>>>;
}

const GradebookMobileView: React.FC<GradebookMobileViewProps> = ({
  courseId,
  course,
  students,
  assignments,
  grades,
  submissionMap,
  expandedStudents,
  setExpandedStudents,
}) => {
  const navigate = useNavigate();

  // Check if data is ready before calculating
  const hasGradesData = students.length > 0 && assignments.length > 0 && Object.keys(grades).length > 0;
  const hasSubmissionMap = submissionMap && Object.keys(submissionMap).length > 0;
  const isDataReady = hasGradesData && hasSubmissionMap;

  // Memoize student grades to prevent recalculation
  const studentGrades = useMemo(() => {
    const gradeMap: { [studentId: string]: number } = {};
    
    if (!isDataReady) {
      return gradeMap;
    }
    
    students.forEach((student: any) => {
      const studentSubmissionMap: { [assignmentId: string]: any } = {};
      
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

  // Helper to get weighted grade for a student
  const getWeightedGrade = (student: any) => {
    return studentGrades[student._id] || 0;
  };

  return (
    <div className="lg:hidden space-y-4">
      {students.map((student: any, rowIdx: number) => {
        const weightedPercent = isDataReady ? getWeightedGrade(student) : 0;
        const letter = isDataReady ? getLetterGrade(weightedPercent, course?.gradeScale) : '-';
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
              <div className="relative">
                {student.profilePicture ? (
                  <img
                    src={student.profilePicture.startsWith('http') ? student.profilePicture : getImageUrl(student.profilePicture)}
                    alt={`${student.firstName} ${student.lastName}`}
                    className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  className={`w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold ${student.profilePicture ? 'hidden' : ''}`}
                  style={{ display: student.profilePicture ? 'none' : 'flex' }}
                >
                  {student.firstName.charAt(0)}{student.lastName.charAt(0)}
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{student.firstName} {student.lastName}</h3>
                <div className="text-sm">
                  {!isDataReady ? (
                    <span className="font-bold text-gray-400">Loading...</span>
                  ) : (
                    <span className={`font-bold ${gradeColor}`}>
                      {weightedPercent.toFixed(2)}% [{letter}]
                    </span>
                  )}
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
  );
};

export default GradebookMobileView;

