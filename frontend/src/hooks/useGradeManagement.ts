import { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

interface UseGradeManagementProps {
  courseId: string | undefined;
  gradebookData: any;
  isInstructor: boolean;
  isAdmin: boolean;
  setGradebookRefresh: (updater: (prev: number) => number) => void;
  setStudentGradebookData?: (updater: (prev: any) => any) => void;
}

export const useGradeManagement = ({
  courseId,
  gradebookData,
  isInstructor,
  isAdmin,
  setGradebookRefresh,
  setStudentGradebookData,
}: UseGradeManagementProps) => {
  const [editingGrade, setEditingGrade] = useState<{studentId: string, assignmentId: string} | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [savingGrade, setSavingGrade] = useState<{studentId: string, assignmentId: string} | null>(null);
  const [gradeError, setGradeError] = useState<string>('');

  const handleGradeUpdate = async (studentId: string, assignmentId: string, newGrade: string) => {
    if (!courseId) return;
    
    const submissionKey = `${studentId}_${assignmentId}`;
    const submissionId = gradebookData.submissionMap?.[submissionKey];
    
    // Find assignment to check if it's offline
    const assignment = gradebookData.assignments.find((a: any) => a._id === assignmentId);
    const isOfflineAssignment = assignment?.isOfflineAssignment === true;
    
    // For offline assignments, we can create a grade even without a submission
    if (!submissionId && !isOfflineAssignment) {
      setGradeError('No submission found for this student');
      setSavingGrade(null);
      setEditingGrade(null);
      return;
    }

    // Handle grade removal (empty input)
    if (newGrade.trim() === '') {
      setSavingGrade({ studentId, assignmentId });
      setGradeError('');

      try {
        const token = localStorage.getItem('token');
        let res: any;
        
        // Use manual-grade endpoint for offline assignments
        if (isOfflineAssignment) {
          res = await axios.post(
            `${API_URL}/api/submissions/manual-grade`,
            { 
              assignmentId,
              studentId,
              grade: null  // Send null to remove the grade
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } else {
          res = await axios.post(
          `${API_URL}/api/submissions/${submissionId}/grade`,
          { grade: null },  // Send null to remove the grade
          { headers: { Authorization: `Bearer ${token}` } }
        );
        }

        if (res.data) {
          // Update local state to remove the grade
          // For instructor view, we need to trigger a refresh
          if (isInstructor || isAdmin) {
            setGradebookRefresh((prev: number) => prev + 1);
          } else if (setStudentGradebookData) {
            setStudentGradebookData((prev: any) => {
              const newGrades = { ...prev.grades };
              if (newGrades[String(studentId)]) {
                delete newGrades[String(studentId)][String(assignmentId)];
                // If no more grades for this student, remove the student entry
                if (Object.keys(newGrades[String(studentId)]).length === 0) {
                  delete newGrades[String(studentId)];
                }
              }
              return {
                ...prev,
                grades: newGrades
              };
            });
            setEditingGrade(null);
          }
        }
      } catch (err: any) {
        setGradeError(err.response?.data?.message || 'Failed to remove grade');
      } finally {
        setSavingGrade(null);
      }
      return;
    }

    // Validate grade is a number and not negative
    const gradeNum = parseFloat(newGrade);
    if (isNaN(gradeNum) || gradeNum < 0) {
      setGradeError('Grade must be a valid number');
      setSavingGrade(null);
      setEditingGrade(null);
      return;
    }

    // Get max points from assignment (already found above)
    const maxPoints = assignment?.questions?.reduce((sum: number, q: any) => sum + (q.points || 0), 0) || assignment?.totalPoints || 0;
    
    if (gradeNum > maxPoints) {
      setGradeError(`Grade cannot exceed ${maxPoints} points`);
      setSavingGrade(null);
      setEditingGrade(null);
      return;
    }

    setSavingGrade({ studentId, assignmentId });
    setGradeError('');

    try {
      const token = localStorage.getItem('token');
      let res: any;
      
      // Use manual-grade endpoint for offline assignments without submissions
      if (isOfflineAssignment && !submissionId) {
        res = await axios.post(
          `${API_URL}/api/submissions/manual-grade`,
          { 
            assignmentId,
            studentId,
            grade: gradeNum
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        // Update submission map with the newly created submission
        // For instructor view, trigger refresh; for student view, update local state
        if (res.data && res.data._id) {
          if (isInstructor || isAdmin) {
            setGradebookRefresh((prev: number) => prev + 1);
          } else if (setStudentGradebookData) {
            setStudentGradebookData((prev: any) => ({
              ...prev,
              submissionMap: {
                ...prev.submissionMap,
                [submissionKey]: res.data._id
              }
            }));
          }
        }
      } else {
        // Use regular grade endpoint
        res = await axios.post(
        `${API_URL}/api/submissions/${submissionId}/grade`,
        { grade: gradeNum },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      }

      if (res.data) {
        // Update local state
        // For instructor view, trigger refresh; for student view, update local state
        if (isInstructor || isAdmin) {
          setGradebookRefresh((prev: number) => prev + 1);
        } else if (setStudentGradebookData) {
          setStudentGradebookData((prev: any) => {
            const newGrades = {
              ...prev.grades,
              [String(studentId)]: {
                ...prev.grades[String(studentId)],
                [String(assignmentId)]: gradeNum
              }
            };
            return {
              ...prev,
              grades: newGrades
            };
          });
        }
        setEditingGrade(null);
      }
    } catch (err: any) {
      setGradeError(err.response?.data?.message || 'Failed to update grade');
    } finally {
      setSavingGrade(null);
    }
  };

  const handleGradeCellClick = (studentId: string, assignmentId: string, currentGrade: number | string) => {
    if (!isInstructor && !isAdmin) return;
    setEditingGrade({ studentId, assignmentId });
    setEditingValue(currentGrade === '-' ? '' : currentGrade.toString());
    setGradeError('');
  };

  const handleGradeInputKeyDown = (e: React.KeyboardEvent, studentId: string, assignmentId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleGradeUpdate(studentId, assignmentId, editingValue);
    } else if (e.key === 'Escape') {
      setEditingGrade(null);
      setGradeError('');
    }
  };

  return {
    editingGrade,
    setEditingGrade,
    editingValue,
    setEditingValue,
    savingGrade,
    gradeError,
    setGradeError,
    handleGradeUpdate,
    handleGradeCellClick,
    handleGradeInputKeyDown,
  };
};
























