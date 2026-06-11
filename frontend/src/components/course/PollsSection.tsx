import React from 'react';
import PollList from '../polls/PollList';

interface PollsSectionProps {
  courseId: string;
}

const PollsSection: React.FC<PollsSectionProps> = ({ courseId }) => {
  return <PollList courseId={courseId} />;
};

export default PollsSection;
