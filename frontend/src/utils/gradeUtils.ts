// Utility functions for grade calculation and letter grade assignment

export interface Assignment {
  _id: string;
  title: string;
  group?: string;
  totalPoints: number;
  questions?: { points?: number }[];
  isDiscussion?: boolean;
  dueDate?: string;
  published: boolean;
  hasSubmitted?: boolean;
}

export interface Group {
  name: string;
  weight: number;
}

export interface GroupWithGrades extends Group {
  originalWeight: number;
  earned: number;
  possible: number;
  percent: number;
}

export interface Course {
  groups: Group[];
  gradeScale?: { letter: string; min: number; max: number }[];
}

export interface Grades {
  [studentId: string]: {
    [assignmentId: string]: number | string;
  };
}

/**
 * Calculate the final grade based on weighted assignment groups, ignoring groups with no grades.
 * Groups that have no graded assignments are excluded from the calculation, and their weights
 * are redistributed among the remaining groups proportionally.
 */
export function calculateFinalGradeWithWeightedGroups(
  studentId: string,
  course: Course,
  assignments: Assignment[],
  grades: Grades,
  submissions: { [assignmentId: string]: any } = {}
): number {
  // Validate inputs
  if (!studentId || typeof studentId !== 'string' || studentId.trim() === '') {
    console.warn('Invalid studentId in calculateFinalGradeWithWeightedGroups');
    return 0;
  }

  if (!course || typeof course !== 'object') {
    console.warn('Invalid course in calculateFinalGradeWithWeightedGroups');
    return 0;
  }

  if (!Array.isArray(assignments)) {
    console.warn('Invalid assignments array in calculateFinalGradeWithWeightedGroups');
    return 0;
  }

  if (!grades || typeof grades !== 'object') {
    console.warn('Invalid grades object in calculateFinalGradeWithWeightedGroups');
    return 0;
  }

  const courseGroups = Array.isArray(course.groups) ? course.groups : [];
  const now = new Date();

  // Track assignments that are not in any group
  const groupedAssignmentIds = new Set();
  courseGroups.forEach((group) => {
    const groupAssignments = assignments.filter((a) => a.group === group.name);
    groupAssignments.forEach((a) => groupedAssignmentIds.add(a._id));
  });

  // Calculate total weight of all groups
  const totalOriginalWeight = courseGroups.reduce((sum, g) => sum + Number(g.weight), 0);

  // Analyze each group to determine if it has graded assignments
  const groupsWithGrades: GroupWithGrades[] = [];
  const groupsWithoutGrades: Group[] = [];

  courseGroups.forEach((group) => {
    const groupAssignments = assignments.filter((a) => a.group === group.name);
    let hasGradedAssignments = false;
    let earned = 0;
    let possible = 0;

    groupAssignments.forEach((assignment) => {
      const grade = grades[studentId]?.[assignment._id];
      const max = assignment.questions?.reduce((sum, q) => sum + (q.points || 0), 0) || assignment.totalPoints || 0;
      const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
      
      // Skip unpublished items (for discussions too)
      if ((assignment.isDiscussion && assignment.published === false) || (!assignment.isDiscussion && !assignment.published)) {
        return;
      }
      
      // Check if student has submitted this assignment
      // For discussions, rely on hasSubmitted flag provided by data
      const hasSubmission = assignment.isDiscussion
        ? (assignment.hasSubmitted === true)
        : (submissions[assignment._id] !== undefined);
      
      // Only count assignments that have been explicitly graded
      if (typeof grade === 'number') {
        earned += grade;
        possible += max;
        hasGradedAssignments = true; // This group has at least one graded assignment
      } else if (dueDate && now > dueDate && !hasSubmission) {
        // Count as 0 if past due date and no submission (student never submitted)
        earned += 0;
        possible += max;
        hasGradedAssignments = true; // This group has at least one graded assignment
      }
      // Note: We exclude "Not Graded" submissions (hasSubmission but no grade) from calculation entirely
    });

    if (hasGradedAssignments && possible > 0 && isFinite(possible)) {
      const percent = (earned / possible) * 100;
      if (isFinite(percent)) {
        groupsWithGrades.push({
          ...group,
          originalWeight: Number(group.weight) || 0,
          earned,
          possible,
          percent
        });
      }
    } else {
      groupsWithoutGrades.push(group);
    }
  });

  // Handle assignments not in any group ("Other") as a virtual group
  const otherAssignments = assignments.filter((a) => !groupedAssignmentIds.has(a._id));
  let otherGroupHasGrades = false;
  let otherEarned = 0;
  let otherPossible = 0;

  if (otherAssignments.length > 0) {
    otherAssignments.forEach((assignment) => {
      const grade = grades[studentId]?.[assignment._id];
      const max = assignment.questions?.reduce((sum, q) => sum + (q.points || 0), 0) || assignment.totalPoints || 0;
      const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
      
      // Skip unpublished items (for discussions too)
      if ((assignment.isDiscussion && assignment.published === false) || (!assignment.isDiscussion && !assignment.published)) {
        return;
      }
      
      // Check if student has submitted this assignment
      const hasSubmission = assignment.isDiscussion
        ? (assignment.hasSubmitted === true)
        : (submissions[assignment._id] !== undefined);
      
      // Only count assignments that have been explicitly graded
      if (typeof grade === 'number') {
        otherEarned += grade;
        otherPossible += max;
        otherGroupHasGrades = true;
      } else if (dueDate && now > dueDate && !hasSubmission) {
        // Count as 0 if past due date and no submission (student never submitted)
        otherEarned += 0;
        otherPossible += max;
        otherGroupHasGrades = true;
      }
      // Note: We exclude "Not Graded" submissions (hasSubmission but no grade) from calculation entirely
    });
  }

  // Calculate the weight that should be redistributed
  const weightToRedistribute = groupsWithoutGrades.reduce((sum, g) => sum + Number(g.weight), 0);
  
  // If there are no groups with grades, return 0
  if (groupsWithGrades.length === 0 && !otherGroupHasGrades) {
    return 0;
  }

  // Redistribute weights proportionally among groups with grades
  let totalAdjustedWeight = 0;
  let weightedSum = 0;

  // Redistribute weights among groups with grades
  if (groupsWithGrades.length > 0) {
    const totalWeightWithGrades = groupsWithGrades.reduce((sum, g) => sum + g.originalWeight, 0);
    
    groupsWithGrades.forEach((group) => {
      // Calculate proportional redistribution
      const redistributionRatio = group.originalWeight / totalWeightWithGrades;
      const redistributedWeight = weightToRedistribute * redistributionRatio;
      const adjustedWeight = group.originalWeight + redistributedWeight;
      
      weightedSum += group.percent * adjustedWeight;
      totalAdjustedWeight += adjustedWeight;
    });
  }

  // Handle the "Other" group if it has grades
  if (otherGroupHasGrades && otherPossible > 0 && isFinite(otherPossible)) {
    const otherPercent = (otherEarned / otherPossible) * 100;
    if (isFinite(otherPercent)) {
      const otherWeight = 100 - totalAdjustedWeight; // Remaining weight goes to ungrouped assignments
      
      if (otherWeight > 0 && isFinite(otherWeight)) {
        weightedSum += otherPercent * otherWeight;
        totalAdjustedWeight += otherWeight;
      }
    }
  }

  // If no groups have grades, return 0
  if (totalAdjustedWeight === 0 || !isFinite(totalAdjustedWeight)) {
    return 0;
  }

  // Return the final weighted percentage
  const finalGrade = weightedSum / totalAdjustedWeight;
  return isFinite(finalGrade) ? finalGrade : 0;
}

/**
 * Calculate the weighted grade for a student, normalizing group weights if needed.
 * If ungrouped assignments exist, they are treated as a virtual group with the remaining weight.
 */
export function getWeightedGradeForStudent(
  studentId: string,
  course: Course,
  assignments: Assignment[],
  grades: Grades,
  submissions: { [assignmentId: string]: any } = {}
): number {
  // Validate inputs
  if (!studentId || typeof studentId !== 'string' || studentId.trim() === '') {
    console.warn('Invalid studentId in getWeightedGradeForStudent');
    return 0;
  }

  if (!course || typeof course !== 'object') {
    console.warn('Invalid course in getWeightedGradeForStudent');
    return 0;
  }

  if (!Array.isArray(assignments)) {
    console.warn('Invalid assignments array in getWeightedGradeForStudent');
    return 0;
  }

  if (!grades || typeof grades !== 'object') {
    console.warn('Invalid grades object in getWeightedGradeForStudent');
    return 0;
  }

  let weightedSum = 0;
  let totalWeight = 0;
  const courseGroups = Array.isArray(course.groups) ? course.groups : [];
  const now = new Date();

  // Track assignments that are not in any group
  const groupedAssignmentIds = new Set();
  courseGroups.forEach((group) => {
    const groupAssignments = assignments.filter((a) => a.group === group.name);
    groupAssignments.forEach((a) => groupedAssignmentIds.add(a._id));
  });

  // Calculate total weight
  let sumWeights = courseGroups.reduce((sum, g) => sum + Number(g.weight), 0);
  // If weights do not sum to 100, normalize
  let normalizedGroups = courseGroups;
  if (sumWeights !== 100 && sumWeights > 0) {
    normalizedGroups = courseGroups.map(g => ({
      ...g,
      weight: (Number(g.weight) / sumWeights) * 100
    }));
    sumWeights = 100;
  }

  // Calculate group grades
  normalizedGroups.forEach((group) => {
    const groupAssignments = assignments.filter((a) => a.group === group.name);
    if (groupAssignments.length === 0) return;
    let earned = 0;
    let possible = 0;
    groupAssignments.forEach((assignment) => {
      const grade = grades[studentId]?.[assignment._id];
      const max = assignment.questions?.reduce((sum, q) => sum + (q.points || 0), 0) || assignment.totalPoints || 0;
      const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
      
      // Skip unpublished assignments (but discussions are always considered published)
      if (!assignment.isDiscussion && !assignment.published) {
        return;
      }
      
      // Check if student has submitted this assignment
      const hasSubmission = submissions[assignment._id] !== undefined;
      
      // Only count assignments that have been explicitly graded
      if (typeof grade === 'number') {
        earned += grade;
        possible += max;
      } else if (dueDate && now > dueDate && !hasSubmission) {
        // Count as 0 if past due date and no submission (student never submitted)
        earned += 0;
        possible += max;
      }
      // Note: We exclude "Not Graded" submissions (hasSubmission but no grade) from calculation entirely
    });
    if (possible > 0 && isFinite(possible)) {
      const percent = (earned / possible) * 100;
      if (isFinite(percent)) {
        const weight = Number(group.weight) || 0;
        weightedSum += percent * weight;
        totalWeight += weight;
      }
    }
  });

  // Handle assignments not in any group ("Other") as a virtual group with remaining weight
  const otherAssignments = assignments.filter((a) => !groupedAssignmentIds.has(a._id));
  if (otherAssignments.length > 0) {
    let earned = 0;
    let possible = 0;
    otherAssignments.forEach((assignment) => {
      const grade = grades[studentId]?.[assignment._id];
      const max = assignment.questions?.reduce((sum, q) => sum + (q.points || 0), 0) || assignment.totalPoints || 0;
      const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
      
      // Skip unpublished assignments (but discussions are always considered published)
      if (!assignment.isDiscussion && !assignment.published) {
        return;
      }
      
      // Check if student has submitted this assignment
      const hasSubmission = submissions[assignment._id] !== undefined;
      
      // Only count assignments that have been explicitly graded
      if (typeof grade === 'number') {
        earned += grade;
        possible += max;
      } else if (dueDate && now > dueDate && !hasSubmission) {
        // Count as 0 if past due date and no submission (student never submitted)
        earned += 0;
        possible += max;
      }
      // Note: We exclude "Not Graded" submissions (hasSubmission but no grade) from calculation entirely
    });
    if (possible > 0 && isFinite(possible)) {
      // Assign remaining weight to ungrouped assignments
      const remainingWeight = 100 - totalWeight;
      const percent = (earned / possible) * 100;
      if (isFinite(percent) && remainingWeight > 0 && isFinite(remainingWeight)) {
        weightedSum += percent * remainingWeight;
        totalWeight += remainingWeight;
      }
    }
  }
  if (totalWeight === 0 || !isFinite(totalWeight)) return 0;
  // Normalize to 100% scale
  const finalGrade = weightedSum / totalWeight;
  return isFinite(finalGrade) ? finalGrade : 0;
}

export function getLetterGrade(
  percent: number,
  gradeScale?: { letter: string; min: number; max: number }[]
): string {
  // Validate percent
  if (typeof percent !== 'number' || !isFinite(percent) || percent < 0 || percent > 100) {
    console.warn('Invalid percent in getLetterGrade:', percent);
    return 'F';
  }

  // Standard US scale as fallback
  const defaultScale = [
    { letter: 'A', min: 90, max: 100 },
    { letter: 'B', min: 80, max: 89 },
    { letter: 'C', min: 70, max: 79 },
    { letter: 'D', min: 60, max: 69 },
    { letter: 'F', min: 0, max: 59 }
  ];

  // Validate gradeScale if provided
  let scale = defaultScale;
  if (gradeScale && Array.isArray(gradeScale) && gradeScale.length > 0) {
    // Validate each entry in gradeScale
    const validScale = gradeScale.filter(s => 
      s && 
      typeof s.letter === 'string' && 
      typeof s.min === 'number' && isFinite(s.min) &&
      typeof s.max === 'number' && isFinite(s.max) &&
      s.min >= 0 && s.min <= 100 &&
      s.max >= 0 && s.max <= 100 &&
      s.min <= s.max
    );
    if (validScale.length > 0) {
      scale = validScale;
    }
  }

  // Sort by min descending
  const sorted = [...scale].sort((a, b) => b.min - a.min);
  // Use inclusive lower bound: percent >= min
  for (const s of sorted) {
    if (percent >= s.min) return s.letter;
  }
  return 'F';
} 