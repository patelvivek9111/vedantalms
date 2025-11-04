import React from 'react';
import { useParams } from 'react-router-dom';
import GroupPeople from './GroupPeople';

const GroupPeopleWrapper: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  
  // For now, we'll need to get groupSetId from the group data
  // This is a temporary solution - in a real app, you'd get this from context or props
  const groupSetId = 'temp'; // This should be passed from parent or fetched
  
  if (!groupId) {
    return <div>Group ID not found</div>;
  }
  
  return <GroupPeople groupId={groupId} groupSetId={groupSetId} />;
};

export default GroupPeopleWrapper;
