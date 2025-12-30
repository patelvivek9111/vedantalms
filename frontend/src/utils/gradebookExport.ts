import { getLetterGrade, calculateFinalGradeWithWeightedGroups } from './gradeUtils';

// Helper to detect discussion participation by a specific user
const hasReplyByUser = (replies: any[], userId: string): boolean => {
  if (!Array.isArray(replies)) return false;
  const stack = [...replies];
  while (stack.length) {
    const r = stack.pop();
    const authorId = r?.author?._id || r?.author;
    if (String(authorId) === String(userId)) return true;
    if (Array.isArray(r?.replies)) stack.push(...r.replies);
  }
  return false;
};

export const exportGradebookCSV = (course: any, gradebookData: any) => {
  try {
    const { students, assignments, grades } = gradebookData;
    
    // Create CSV header with course information
    const instructorInfo = course?.instructor 
      ? `${course.instructor.firstName} ${course.instructor.lastName} (${course.instructor.email})`
      : 'No Instructor Assigned';

    const csvContent = [
      `Course: ${course?.title || 'Unknown Course'}`,
      `Instructor: ${instructorInfo}`,
      `Export Date: ${new Date().toLocaleDateString()}`,
      '', // Empty line for spacing
      // Create header row with student name and all assignments
      ['Student Name', 'Email', ...assignments.map((a: any) => a.title), 'Overall Grade', 'Letter Grade'].join(','),
      // Create data rows for each student
      ...students.map((student: any) => {
        // Augment discussions with per-student hasSubmitted flag (affects zero handling)
        const augmentedAssignments = assignments.map((a: any) =>
          a.isDiscussion ? { ...a, hasSubmitted: hasReplyByUser(a.replies || [], student._id) } : a
        );
        // Compute using the same utility and the augmented assignments + submissions
        const weightedPercent = calculateFinalGradeWithWeightedGroups(
          student._id,
          course,
          augmentedAssignments,
          grades,
          gradebookData.submissionMap
        );
        const letter = getLetterGrade(weightedPercent, course?.gradeScale);
        
        const assignmentGrades = assignments.map((assignment: any) => {
          const grade = grades[student._id]?.[assignment._id];
          return grade && typeof grade === 'number' ? grade.toString() : '-';
        });
        
        return [
          `${student.firstName} ${student.lastName}`,
          student.email,
          ...assignmentGrades,
          weightedPercent.toFixed(2),
          letter
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gradebook_${(course?.title || 'Unknown_Course').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting gradebook:', error);
    alert('Failed to export gradebook CSV');
  }
};
























