import React from 'react';
import AssignmentGrading from './AssignmentGrading';

/** Route shell; grading UI loads course/assignment via `AssignmentGrading`. */
const AssignmentGradingWrapper: React.FC = () => {
  return (
    <div className="w-full">
      <AssignmentGrading />
    </div>
  );
};

export default AssignmentGradingWrapper;
