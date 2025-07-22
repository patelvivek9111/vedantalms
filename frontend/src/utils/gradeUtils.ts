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
  grades: Grades
): number {
  const courseGroups = course.groups || [];
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
      
      // Skip unpublished assignments (but discussions are always considered published)
      if (!assignment.isDiscussion && !assignment.published) {
        return;
      }
      
      // Count as 0 if past due date and no submission
      if (dueDate && now > dueDate && (grade === undefined || grade === null || grade === '-')) {
        earned += 0;
        possible += max;
      } else if (typeof grade === 'number') {
        earned += grade;
        possible += max;
        hasGradedAssignments = true; // This group has at least one graded assignment
      } else if (dueDate && now > dueDate) {
        // Also count as 0 if past due and no valid grade
        earned += 0;
        possible += max;
      }
    });

    if (hasGradedAssignments && possible > 0) {
      const percent = (earned / possible) * 100;
      groupsWithGrades.push({
        ...group,
        originalWeight: group.weight,
        earned,
        possible,
        percent
      });
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
      
      // Skip unpublished assignments (but discussions are always considered published)
      if (!assignment.isDiscussion && !assignment.published) {
        return;
      }
      
      // Count as 0 if past due date and no submission
      if (dueDate && now > dueDate && (grade === undefined || grade === null || grade === '-')) {
        otherEarned += 0;
        otherPossible += max;
      } else if (typeof grade === 'number') {
        otherEarned += grade;
        otherPossible += max;
        otherGroupHasGrades = true;
      } else if (dueDate && now > dueDate) {
        // Also count as 0 if past due and no valid grade
        otherEarned += 0;
        otherPossible += max;
      }
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
  if (otherGroupHasGrades && otherPossible > 0) {
    const otherPercent = (otherEarned / otherPossible) * 100;
    const otherWeight = 100 - totalAdjustedWeight; // Remaining weight goes to ungrouped assignments
    
    if (otherWeight > 0) {
      weightedSum += otherPercent * otherWeight;
      totalAdjustedWeight += otherWeight;
    }
  }

  // If no groups have grades, return 0
  if (totalAdjustedWeight === 0) {
    return 0;
  }

  // Return the final weighted percentage
  return weightedSum / totalAdjustedWeight;
}

/**
 * Calculate the weighted grade for a student, normalizing group weights if needed.
 * If ungrouped assignments exist, they are treated as a virtual group with the remaining weight.
 */
export function getWeightedGradeForStudent(
  studentId: string,
  course: Course,
  assignments: Assignment[],
  grades: Grades
): number {
  let weightedSum = 0;
  let totalWeight = 0;
  const courseGroups = course.groups || [];
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
      
      // Count as 0 if past due date and no submission
      if (dueDate && now > dueDate && (grade === undefined || grade === null || grade === '-')) {
        earned += 0;
        possible += max;
      } else if (typeof grade === 'number') {
        earned += grade;
        possible += max;
      } else if (dueDate && now > dueDate) {
        // Also count as 0 if past due and no valid grade
        earned += 0;
        possible += max;
      }
    });
    if (possible > 0) {
      const percent = (earned / possible) * 100;
      weightedSum += percent * group.weight;
      totalWeight += group.weight;
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
      
      // Count as 0 if past due date and no submission
      if (dueDate && now > dueDate && (grade === undefined || grade === null || grade === '-')) {
        earned += 0;
        possible += max;
      } else if (typeof grade === 'number') {
        earned += grade;
        possible += max;
      } else if (dueDate && now > dueDate) {
        // Also count as 0 if past due and no valid grade
        earned += 0;
        possible += max;
      }
    });
    if (possible > 0) {
      // Assign remaining weight to ungrouped assignments
      const remainingWeight = 100 - totalWeight;
      const percent = (earned / possible) * 100;
      weightedSum += percent * remainingWeight;
      totalWeight += remainingWeight;
    }
  }
  if (totalWeight === 0) return 0;
  // Normalize to 100% scale
  return weightedSum / totalWeight;
}

export function getLetterGrade(
  percent: number,
  gradeScale?: { letter: string; min: number; max: number }[]
): string {
  // Standard US scale as fallback
  const scale = gradeScale && gradeScale.length > 0 ? gradeScale : [
    { letter: 'A', min: 90, max: 100 },
    { letter: 'B', min: 80, max: 89 },
    { letter: 'C', min: 70, max: 79 },
    { letter: 'D', min: 60, max: 69 },
    { letter: 'F', min: 0, max: 59 }
  ];
  // Sort by min descending
  const sorted = [...scale].sort((a, b) => b.min - a.min);
  // Use inclusive lower bound: percent >= min
  for (const s of sorted) {
    if (percent >= s.min) return s.letter;
  }
  return 'F';
} 