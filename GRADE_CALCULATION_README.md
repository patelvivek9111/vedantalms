# Grade Calculation with Weighted Assignment Groups

This document explains the implementation of a new grade calculation function that calculates final grades based on weighted assignment groups, ignoring groups with no grades.

## Overview

The `calculateFinalGradeWithWeightedGroups` function provides an improved approach to grade calculation that:

1. **Ignores groups with no grades**: Assignment groups that have no graded assignments are excluded from the calculation
2. **Redistributes weights proportionally**: The weights from ignored groups are redistributed among the remaining groups proportionally
3. **Handles edge cases**: Properly handles scenarios where no groups have grades, unpublished assignments, and due dates

## Function Signature

```typescript
function calculateFinalGradeWithWeightedGroups(
  studentId: string,
  course: Course,
  assignments: Assignment[],
  grades: Grades
): number
```

### Parameters

- `studentId`: The ID of the student whose grade is being calculated
- `course`: Course object containing assignment groups and their weights
- `assignments`: Array of assignment objects with group assignments and metadata
- `grades`: Object mapping studentId -> assignmentId -> grade

### Returns

- `number`: The calculated final grade percentage (0-100)

## How It Works

### 1. Group Analysis

The function first analyzes each assignment group to determine if it has any graded assignments:

```javascript
courseGroups.forEach((group) => {
  const groupAssignments = assignments.filter((a) => a.group === group.name);
  let hasGradedAssignments = false;
  
  groupAssignments.forEach((assignment) => {
    const grade = grades[studentId]?.[assignment._id.toString()];
    if (typeof grade === 'number') {
      hasGradedAssignments = true;
    }
  });
  
  if (hasGradedAssignments) {
    groupsWithGrades.push(group);
  } else {
    groupsWithoutGrades.push(group);
  }
});
```

### 2. Weight Redistribution

If there are groups without grades, their weights are redistributed proportionally among groups with grades:

```javascript
const weightToRedistribute = groupsWithoutGrades.reduce((sum, g) => sum + Number(g.weight), 0);

if (groupsWithGrades.length > 0) {
  const totalWeightWithGrades = groupsWithGrades.reduce((sum, g) => sum + g.originalWeight, 0);
  
  groupsWithGrades.forEach((group) => {
    const redistributionRatio = group.originalWeight / totalWeightWithGrades;
    const redistributedWeight = weightToRedistribute * redistributionRatio;
    const adjustedWeight = group.originalWeight + redistributedWeight;
    
    weightedSum += group.percent * adjustedWeight;
    totalAdjustedWeight += adjustedWeight;
  });
}
```

### 3. Grade Calculation

For each group with grades, the function calculates the percentage and applies the adjusted weight:

```javascript
if (hasGradedAssignments && possible > 0) {
  const percent = (earned / possible) * 100;
  groupsWithGrades.push({
    ...group,
    originalWeight: group.weight,
    earned,
    possible,
    percent
  });
}
```

## Example Scenarios

### Scenario 1: All Groups Have Grades

**Course Setup:**
- Homework: 30% weight
- Quizzes: 20% weight  
- Exams: 50% weight

**Grades:**
- Homework 1: 85/100
- Homework 2: 90/100
- Quiz 1: 45/50
- Final Exam: 180/200

**Calculation:**
- Homework: (85+90)/(100+100) = 87.5% × 30% = 26.25
- Quizzes: 45/50 = 90% × 20% = 18.00
- Exams: 180/200 = 90% × 50% = 45.00
- **Final Grade: 89.25%**

### Scenario 2: Quiz Group Has No Grades

**Grades:**
- Homework 1: 85/100
- Homework 2: 90/100
- Final Exam: 180/200
- (No quiz grades)

**Weight Redistribution:**
- Original weights: Homework 30%, Quizzes 20%, Exams 50%
- Quiz weight (20%) redistributed proportionally:
  - Homework gets: 20% × (30/80) = 7.5% → New weight: 37.5%
  - Exams gets: 20% × (50/80) = 12.5% → New weight: 62.5%

**Calculation:**
- Homework: 87.5% × 37.5% = 32.81
- Exams: 90% × 62.5% = 56.25
- **Final Grade: 89.06%**

### Scenario 3: Only One Group Has Grades

**Grades:**
- Homework 1: 85/100
- Homework 2: 90/100
- (No quiz or exam grades)

**Weight Redistribution:**
- Homework gets 100% weight (all other weights redistributed)

**Calculation:**
- Homework: 87.5% × 100% = 87.5%
- **Final Grade: 87.5%**

## Implementation Files

### Backend
- **File**: `utils/gradeCalculation.js`
- **Function**: `calculateFinalGradeWithWeightedGroups`
- **Usage**: Used in `controllers/grades.controller.js`

### Frontend
- **File**: `frontend/src/utils/gradeUtils.ts`
- **Function**: `calculateFinalGradeWithWeightedGroups`
- **Usage**: Used in `CourseDetail.tsx`, `WhatIfScores.tsx`, and `StudentGradeSidebar.tsx`

## Key Features

### 1. Handles Unpublished Assignments
```javascript
if (!assignment.isDiscussion && !assignment.published) {
  return; // Skip unpublished assignments
}
```

### 2. Handles Due Dates
```javascript
if (dueDate && now > dueDate && (grade === undefined || grade === null)) {
  earned += 0; // Count as 0 if past due and no submission
  possible += max;
}
```

### 3. Supports Discussions
```javascript
// Discussions are always considered published
if (!assignment.isDiscussion && !assignment.published) {
  return;
}
```

### 4. Handles Ungrouped Assignments
The function treats assignments not in any group as a virtual "Other" group and assigns remaining weight to them.

## Benefits

1. **Fair Grading**: Students aren't penalized for groups that haven't been graded yet
2. **Flexible**: Works with any combination of graded/ungraded groups
3. **Proportional**: Weight redistribution maintains the relative importance of groups
4. **Backward Compatible**: Existing grade calculation logic is preserved in `getWeightedGradeForStudent`

## Migration

The new function is now the default for:
- Student grade displays
- Gradebook calculations
- What-if score scenarios

The legacy function (`getWeightedGradeForStudent`) is still available for backward compatibility and can be accessed via the `/api/grades/student/course/:courseId/legacy` endpoint.

## Testing

To test the function, you can use the provided test files:
- `test_grade_calculation.js` - Comprehensive test scenarios
- `simple_test.js` - Basic functionality tests
- `debug_test.js` - Debugging and troubleshooting

Run tests with:
```bash
node test_grade_calculation.js
``` 