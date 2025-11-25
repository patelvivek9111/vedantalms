/**
 * Utility functions for grade calculation on the backend
 */

/**
 * Calculate the final grade based on weighted assignment groups, ignoring groups with no grades.
 * Groups that have no graded assignments are excluded from the calculation, and their weights
 * are redistributed among the remaining groups proportionally.
 * 
 * @param {Object} studentId - The student ID
 * @param {Object} course - The course object with groups
 * @param {Array} assignments - Array of assignment objects
 * @param {Object} grades - Object mapping studentId -> assignmentId -> grade
 * @param {Object} submissions - Object mapping assignmentId -> submission (optional)
 * @returns {number} The calculated final grade percentage
 */
function calculateFinalGradeWithWeightedGroups(studentId, course, assignments, grades, submissions = {}) {
  // Validate inputs
  if (!studentId || !course || !assignments || !Array.isArray(assignments)) {
    return 0;
  }
  
  const courseGroups = course.groups || [];
  const now = new Date();

  // Track assignments that are not in any group
  const groupedAssignmentIds = new Set();
  courseGroups.forEach((group) => {
    const groupAssignments = assignments.filter((a) => a.group === group.name);
    groupAssignments.forEach((a) => groupedAssignmentIds.add(a._id.toString()));
  });

  // Calculate total weight of all groups
  const totalOriginalWeight = courseGroups.reduce((sum, g) => sum + Number(g.weight), 0);

  // Analyze each group to determine if it has graded assignments
  const groupsWithGrades = [];
  const groupsWithoutGrades = [];

  courseGroups.forEach((group) => {
    const groupAssignments = assignments.filter((a) => a.group === group.name);
    let hasGradedAssignments = false;
    let earned = 0;
    let possible = 0;

    groupAssignments.forEach((assignment) => {
      const grade = grades[studentId]?.[assignment._id.toString()];
      const max = assignment.questions && assignment.questions.length > 0
        ? assignment.questions.reduce((sum, q) => sum + (q.points || 0), 0)
        : assignment.totalPoints || 0;
      const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
      
      // Skip unpublished items (for discussions too)
      if ((assignment.isDiscussion && assignment.published === false) || (!assignment.isDiscussion && !assignment.published)) {
        return;
      }
      
      // Check if student has submitted this assignment
      // For discussions, use the hasSubmitted flag from the controller
      const hasSubmission = assignment.isDiscussion
        ? (assignment.hasSubmitted === true)
        : (submissions[assignment._id.toString()] !== undefined);
      
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

    if (hasGradedAssignments && possible > 0) {
      const percent = (earned / possible) * 100;
      // Validate percent is a valid number
      if (isFinite(percent)) {
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
    } else {
      groupsWithoutGrades.push(group);
    }
  });

  // Handle assignments not in any group ("Other") as a virtual group
  const otherAssignments = assignments.filter((a) => !groupedAssignmentIds.has(a._id.toString()));
  let otherGroupHasGrades = false;
  let otherEarned = 0;
  let otherPossible = 0;

  if (otherAssignments.length > 0) {
    otherAssignments.forEach((assignment) => {
      const grade = grades[studentId]?.[assignment._id.toString()];
      const max = assignment.questions && assignment.questions.length > 0
        ? assignment.questions.reduce((sum, q) => sum + (q.points || 0), 0)
        : assignment.totalPoints || 0;
      const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
      
      // Skip unpublished items (for discussions too)
      if ((assignment.isDiscussion && assignment.published === false) || (!assignment.isDiscussion && !assignment.published)) {
        return;
      }
      
      // Check if student has submitted this assignment
      const hasSubmission = assignment.isDiscussion
        ? (assignment.hasSubmitted === true)
        : (submissions[assignment._id.toString()] !== undefined);
      
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
    
    // Prevent division by zero if all groups have weight 0
    if (totalWeightWithGrades > 0) {
      groupsWithGrades.forEach((group) => {
        // Calculate proportional redistribution
        const redistributionRatio = group.originalWeight / totalWeightWithGrades;
        const redistributedWeight = weightToRedistribute * redistributionRatio;
        const adjustedWeight = group.originalWeight + redistributedWeight;
        
        weightedSum += group.percent * adjustedWeight;
        totalAdjustedWeight += adjustedWeight;
      });
    } else {
      // If all groups have weight 0, use equal distribution
      const equalWeight = 100 / groupsWithGrades.length;
      groupsWithGrades.forEach((group) => {
        weightedSum += group.percent * equalWeight;
        totalAdjustedWeight += equalWeight;
      });
    }
  }

  // Handle the "Other" group if it has grades
  if (otherGroupHasGrades && otherPossible > 0) {
    const otherPercent = (otherEarned / otherPossible) * 100;
    // Validate percent is a valid number
    if (isFinite(otherPercent)) {
      const otherWeight = 100 - totalAdjustedWeight; // Remaining weight goes to ungrouped assignments
      
      if (otherWeight > 0) {
        weightedSum += otherPercent * otherWeight;
        totalAdjustedWeight += otherWeight;
      }
    }
  }

  // If no groups have grades, return 0
  if (totalAdjustedWeight === 0) {
    return 0;
  }

  // Return the final weighted percentage (with safety check)
  if (totalAdjustedWeight === 0 || !isFinite(totalAdjustedWeight)) {
    return 0;
  }
  const result = weightedSum / totalAdjustedWeight;
  // Ensure result is a valid number
  return isFinite(result) ? result : 0;
}

/**
 * Calculate the weighted grade for a student using the traditional method.
 * This function maintains backward compatibility with existing code.
 */
function getWeightedGradeForStudent(studentId, course, assignments, grades, submissions = {}) {
  // Validate inputs
  if (!studentId || !course || !assignments || !Array.isArray(assignments)) {
    return 0;
  }
  
  let weightedSum = 0;
  let totalWeight = 0;
  const courseGroups = course.groups || [];
  const now = new Date();

  // Track assignments that are not in any group
  const groupedAssignmentIds = new Set();
  courseGroups.forEach((group) => {
    const groupAssignments = assignments.filter((a) => a.group === group.name);
    groupAssignments.forEach((a) => groupedAssignmentIds.add(a._id.toString()));
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
      const grade = grades[studentId]?.[assignment._id.toString()];
      const max = assignment.questions && assignment.questions.length > 0
        ? assignment.questions.reduce((sum, q) => sum + (q.points || 0), 0)
        : assignment.totalPoints || 0;
      const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
      
      // Skip unpublished items (for discussions too)
      if ((assignment.isDiscussion && assignment.published === false) || (!assignment.isDiscussion && !assignment.published)) {
        return;
      }
      
      // Check if student has submitted this assignment
      const hasSubmission = assignment.isDiscussion
        ? (assignment.hasSubmitted === true)
        : (submissions[assignment._id.toString()] !== undefined);
      
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
    if (possible > 0) {
      const percent = (earned / possible) * 100;
      // Validate percent is a valid number before using it
      if (isFinite(percent)) {
        weightedSum += percent * group.weight;
        totalWeight += group.weight;
      }
    }
  });

  // Handle assignments not in any group ("Other") as a virtual group with remaining weight
  const otherAssignments = assignments.filter((a) => !groupedAssignmentIds.has(a._id.toString()));
  if (otherAssignments.length > 0) {
    let earned = 0;
    let possible = 0;
    otherAssignments.forEach((assignment) => {
      const grade = grades[studentId]?.[assignment._id.toString()];
      const max = assignment.questions && assignment.questions.length > 0
        ? assignment.questions.reduce((sum, q) => sum + (q.points || 0), 0)
        : assignment.totalPoints || 0;
      const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
      
      // Skip unpublished items (for discussions too)
      if ((assignment.isDiscussion && assignment.published === false) || (!assignment.isDiscussion && !assignment.published)) {
        return;
      }
      
      // Check if student has submitted this assignment
      const hasSubmission = assignment.isDiscussion
        ? (assignment.hasSubmitted === true)
        : (submissions[assignment._id.toString()] !== undefined);
      
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
    if (possible > 0) {
      // Assign remaining weight to ungrouped assignments
      const remainingWeight = 100 - totalWeight;
      const percent = (earned / possible) * 100;
      // Validate percent is a valid number before using it
      if (isFinite(percent)) {
        weightedSum += percent * remainingWeight;
        totalWeight += remainingWeight;
      }
    }
  }
  if (totalWeight === 0 || !isFinite(totalWeight)) return 0;
  // Normalize to 100% scale
  const result = weightedSum / totalWeight;
  // Ensure result is a valid number
  return isFinite(result) ? result : 0;
}

/**
 * Get letter grade from percentage
 */
function getLetterGrade(percent, gradeScale) {
  // Validate percent is a valid number
  if (!isFinite(percent) || isNaN(percent)) {
    return 'F';
  }
  
  // Clamp percent to 0-100 range
  percent = Math.max(0, Math.min(100, percent));
  
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

module.exports = {
  calculateFinalGradeWithWeightedGroups,
  getWeightedGradeForStudent,
  getLetterGrade
}; 