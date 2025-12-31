import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import { Users, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface GroupSet {
  _id: string;
  name: string;
  course: string;
  allowSelfSignup: boolean;
}

interface Group {
  _id: string;
  name: string;
  groupSet: string;
  members: User[];
  leader: User;
  groupId: string;
}

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface StudentGroupViewProps {
  courseId: string;
  userId: string;
}

const StudentGroupView: React.FC<StudentGroupViewProps> = ({ courseId, userId }) => {
  const [enrolledGroups, setEnrolledGroups] = useState<{ groupSet: GroupSet; group: Group }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Fetch all group sets and find groups where the student is enrolled
  useEffect(() => {
    const fetchEnrolledGroups = async () => {
      try {
        const token = localStorage.getItem('token');
        
        // Fetch all group sets for the course
        const groupSetsResponse = await axios.get(`${API_URL}/api/groups/sets/${courseId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const groupSets = groupSetsResponse.data;
        const enrolledGroupsData: { groupSet: GroupSet; group: Group }[] = [];
        
        // For each group set, fetch its groups and check if student is enrolled
        for (const groupSet of groupSets) {
          try {
            const groupsResponse = await axios.get(`${API_URL}/api/groups/sets/${groupSet._id}/groups`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            
            const groups = groupsResponse.data;
            
            // Find groups where the student is a member
            const studentGroups = groups.filter((group: Group) => 
              group.members.some(member => member._id === userId)
            );
            
            // Add enrolled groups to the list
            studentGroups.forEach((group: Group) => {
              enrolledGroupsData.push({ groupSet, group });
            });
          } catch (err) {
            console.error(`Error fetching groups for set ${groupSet._id}:`, err);
          }
        }
        
        setEnrolledGroups(enrolledGroupsData);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Error loading enrolled groups');
      } finally {
        setLoading(false);
      }
    };
    
    fetchEnrolledGroups();
  }, [courseId, userId]);

  const handleNavigateToGroup = (groupId: string) => {
    navigate(`/groups/${groupId}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
      <div className="mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">My Groups</h2>
        <p className="mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
          Groups you are enrolled in for this course
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 px-3 sm:px-4 py-2 sm:py-3 rounded text-sm sm:text-base">
          {error}
        </div>
      )}

      {enrolledGroups.length === 0 ? (
        <div className="text-center py-8 sm:py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700">
          <Users className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400 dark:text-gray-500" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No groups enrolled</h3>
          <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            You are not enrolled in any groups for this course.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {enrolledGroups.map(({ groupSet, group }) => (
            <div key={group._id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 sm:p-6 hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-start gap-3 mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 break-words">{group.name}</h3>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{groupSet.name}</p>
                </div>
                <button
                  onClick={() => handleNavigateToGroup(group._id)}
                  className="w-full sm:w-auto inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-xs sm:text-sm font-medium rounded-md text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/50 hover:bg-blue-100 dark:hover:bg-blue-900/70"
                >
                  <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  View
                </button>
              </div>
              
              <div className="space-y-2 sm:space-y-3">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Members ({group.members.length}):</p>
                  <ul className="space-y-1.5">
                    {group.members.map(member => (
                      <li key={member._id} className="flex items-center text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-2 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        <span className="flex-1 truncate">
                          {member.firstName} {member.lastName}
                        </span>
                        {group.leader._id === member._id && (
                          <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded flex-shrink-0">
                            Leader
                          </span>
                        )}
                        {member._id === userId && (
                          <span className="ml-2 text-xs bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 px-2 py-0.5 rounded flex-shrink-0">
                            You
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
                
                {/* Removed Group ID section */}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentGroupView; 