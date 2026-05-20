import React from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import GroupPeople from './GroupPeople';

type GroupOutletContext = {
  groupSetId?: string;
};

const GroupPeopleWrapper: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const context = useOutletContext<GroupOutletContext>();
  const groupSetId = context?.groupSetId ?? '';

  if (!groupId) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
        <p className="text-slate-600 dark:text-slate-400">Group not found</p>
      </div>
    );
  }

  return <GroupPeople groupId={groupId} groupSetId={groupSetId} />;
};

export default GroupPeopleWrapper;
