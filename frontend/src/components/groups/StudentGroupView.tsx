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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">My Groups</h2>
        <p className="mt-2 text-sm text-gray-600">
          Groups you are enrolled in for this course
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {enrolledGroups.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <Users className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No groups enrolled</h3>
          <p className="mt-1 text-sm text-gray-500">
            You are not enrolled in any groups for this course.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {enrolledGroups.map(({ groupSet, group }) => (
            <div key={group._id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{group.name}</h3>
                  <p className="text-sm text-gray-500">{groupSet.name}</p>
                </div>
                <button
                  onClick={() => handleNavigateToGroup(group._id)}
                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-50 hover:bg-blue-100"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  View
                </button>
              </div>
              
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Members ({group.members.length}):</p>
                  <ul className="space-y-1">
                    {group.members.map(member => (
                      <li key={member._id} className="flex items-center text-sm text-gray-600">
                        <Users className="h-4 w-4 mr-2 text-gray-400" />
                        <span className="flex-1">
                          {member.firstName} {member.lastName}
                        </span>
                        {group.leader._id === member._id && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            Leader
                          </span>
                        )}
                        {member._id === userId && (
                          <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
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