import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Users, UserPlus, MessageSquare, Activity, Edit2, Trash2 } from 'lucide-react';

interface Group {
  _id: string;
  name: string;
  members: Array<{ firstName: string; lastName: string; email: string }>;
  leader: { firstName: string; lastName: string; email: string };
  groupId: string;
}

interface GroupSet {
  _id: string;
  name: string;
  course: { _id: string; title: string };
  allowSelfSignup: boolean;
  groupStructure?: string;
}

const GroupSetView: React.FC = () => {
  const { groupSetId } = useParams<{ groupSetId: string }>();
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupSet, setGroupSet] = useState<GroupSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchGroupSetData = async () => {
      if (!groupSetId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Fetch groups in the groupset
        const groupsRes = await api.get(`/groups/sets/${groupSetId}/groups`);
        setGroups(groupsRes.data || []);
        
        // Fetch groupset details
        const groupSetRes = await api.get(`/groups/sets/id/${groupSetId}`);
        setGroupSet(groupSetRes.data);
      } catch (err: any) {
        console.error('Error fetching groupset data:', err);
        setError('Failed to load groupset data');
      } finally {
        setLoading(false);
      }
    };

    fetchGroupSetData();
  }, [groupSetId]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <div className="text-red-800 dark:text-red-400">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-4 sm:py-6 lg:py-8 px-2 sm:px-4">
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2 break-words">
              {groupSet?.name || 'Group Set'}
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              {groupSet?.course?.title || 'Unknown Course'}
            </p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto px-4 py-2 text-sm sm:text-base text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-200"
          >
            ← Back
          </button>
        </div>
        
        {groupSet && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 mb-4 sm:mb-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                  groupSet.allowSelfSignup 
                    ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}>
                  {groupSet.allowSelfSignup ? 'Self Signup Allowed' : 'Self Signup Disabled'}
                </span>
              </div>
              {groupSet.groupStructure && (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                    {groupSet.groupStructure === 'manual' ? 'Manual' : 
                     groupSet.groupStructure === 'byGroupCount' ? 'By Group Count' : 
                     'By Students Per Group'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {groups.length === 0 ? (
        <div className="text-center py-8 sm:py-12">
          <div className="text-gray-500 dark:text-gray-400 text-base sm:text-lg mb-2">No groups found</div>
          <div className="text-sm sm:text-base text-gray-400 dark:text-gray-500">This group set doesn't have any groups yet.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {groups.map(group => (
            <div key={group._id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 border border-gray-100 dark:border-gray-700">
              <div className="p-4 sm:p-6">
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 break-words">{group.name}</h3>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">Group ID: {group.groupId}</p>
                  </div>
                </div>
                
                {group.members && group.members.length > 0 && (
                  <div className="mb-3 sm:mb-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      Members ({group.members.length})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {group.members.slice(0, 3).map((member, index) => (
                        <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          {member.firstName} {member.lastName}
                        </span>
                      ))}
                      {group.members.length > 3 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          +{group.members.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                {group.leader && (
                  <div className="mb-3 sm:mb-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Leader</p>
                    <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">{group.leader.firstName} {group.leader.lastName}</p>
                  </div>
                )}
                
                <div className="flex gap-2 mt-4">
                  <button
                    className="flex-1 px-3 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200 text-xs sm:text-sm font-medium"
                    onClick={() => navigate(`/groups/${group._id}`)}
                  >
                    View Group
                  </button>
                  <button
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 text-xs sm:text-sm"
                    onClick={() => navigate(`/groups/${group._id}/discussion`)}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GroupSetView; 