import { useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

interface UseGradeManagementProps {
  courseId: string | undefined;
  submissionMap: { [key: string]: string };
  gradebookData: {
    students: any[];
    assignments: any[];
    grades: { [studentId: string]: { [assignmentId: string]: number | string } };
  };
  isInstructor: boolean;
  isAdmin: boolean;
  editingValue: string;
  setEditingGrade: React.Dispatch<React.SetStateAction<{ studentId: string; assignmentId: string } | null>>;
  setEditingValue: React.Dispatch<React.SetStateAction<string>>;
  setGradeError: React.Dispatch<React.SetStateAction<string>>;
  setSavingGrade: React.Dispatch<React.SetStateAction<{ studentId: string; assignmentId: string } | null>>;
  setGradebookData: React.Dispatch<React.SetStateAction<{
    students: any[];
    assignments: any[];
    grades: { [studentId: string]: { [assignmentId: string]: number | string } };
  }>>;
  setSubmissionMap: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>;
}

export const useGradeManagement = ({
  courseId,
  submissionMap,
  gradebookData,
  isInstructor,
  isAdmin,
  editingValue,
  setEditingGrade,
  setEditingValue,
  setGradeError,
  setSavingGrade,
  setGradebookData,
  setSubmissionMap,
}: UseGradeManagementProps) => {
  // Update handler for updating a grade
  const handleGradeUpdate = useCallback(async (studentId: string, assignmentId: string, newGrade: string) => {
    if (!courseId) return;
    
    const submissionKey = `${studentId}_${assignmentId}`;
    const submissionId = submissionMap[submissionKey];
    
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
          setGradebookData((prev: any) => {
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
        if (res.data && res.data._id) {
          setSubmissionMap((prev: any) => ({
            ...prev,
            [submissionKey]: res.data._id
          }));
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
        setGradebookData((prev: any) => {
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
        setEditingGrade(null);
      }
    } catch (err: any) {
      setGradeError(err.response?.data?.message || 'Failed to update grade');
    } finally {
      setSavingGrade(null);
    }
  }, [courseId, submissionMap, gradebookData.assignments, setEditingGrade, setGradeError, setSavingGrade, setGradebookData, setSubmissionMap]);

  // Add handlers for grade cell interaction
  const handleGradeCellClick = useCallback((studentId: string, assignmentId: string, currentGrade: number | string) => {
    if (!isInstructor && !isAdmin) return;
    setEditingGrade({ studentId, assignmentId });
    setEditingValue(currentGrade === '-' ? '' : currentGrade.toString());
    setGradeError('');
  }, [isInstructor, isAdmin, setEditingGrade, setEditingValue, setGradeError]);

  const handleGradeInputKeyDown = useCallback((e: React.KeyboardEvent, studentId: string, assignmentId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleGradeUpdate(studentId, assignmentId, editingValue);
    } else if (e.key === 'Escape') {
      setEditingGrade(null);
      setGradeError('');
    }
  }, [editingValue, handleGradeUpdate, setEditingGrade, setGradeError]);

  return {
    handleGradeUpdate,
    handleGradeCellClick,
    handleGradeInputKeyDown,
  };
};




