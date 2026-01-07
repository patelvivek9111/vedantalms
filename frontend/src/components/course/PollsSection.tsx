import React from 'react';
import PollList from '../polls/PollList';

interface PollsSectionProps {
  courseId: string;
}

const PollsSection: React.FC<PollsSectionProps> = ({ courseId }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
        <PollList courseId={courseId} />
      </div>
    </div>
  );
};

export default PollsSection;





