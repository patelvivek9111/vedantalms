import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Home, Users, MessageSquare, FileText, ClipboardList, Megaphone, Calendar, TrendingUp, Star, Award, Target, Zap, BookOpen, Clock, CheckCircle, AlertCircle, Plus, Settings, UserPlus, BarChart3 } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../../config';
import { useAuth } from '../../context/AuthContext';
import ProfileImage from '../ProfileImage';

// Detect mobile device
const useMobileDevice = () => {
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileDevice(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return isMobileDevice;
};

interface GroupInfo {
  _id: string;
  name: string;
  groupSet: {
    _id: string;
    name: string;
    course: {
      _id: string;
      name: string;
    };
  };
  members: Array<{
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    profilePicture?: string;
  }>;
}

interface GroupStats {
  totalMembers: number;
  recentActivity: number;
  upcomingAssignments: number;
  announcements: number;
  completedTasks: number;
  groupScore: number;
}

interface UpcomingTask {
  id: string;
  title: string;
  dueDate: string;
  type: 'assignment' | 'discussion' | 'page';
  priority: 'high' | 'medium' | 'low';
}

const GroupHome: React.FC = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [stats, setStats] = useState<GroupStats>({
    totalMembers: 0,
    recentActivity: 0,
    upcomingAssignments: 0,
    announcements: 0,
    completedTasks: 0,
    groupScore: 0
  });
  const [upcomingTasks, setUpcomingTasks] = useState<UpcomingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobileDevice = useMobileDevice();
  
  // Check if user is teacher/instructor
  const isTeacher = user?.role === 'instructor' || user?.role === 'admin';

  // Interactive handlers
  const handleStartDiscussion = () => {
    navigate(`/groups/${groupId}/discussion`);
  };

  const handleViewPages = () => {
    navigate(`/groups/${groupId}/pages`);
  };

  const handleViewAssignments = () => {
    navigate(`/groups/${groupId}/assignments`);
  };

  const handleViewMembers = () => {
    navigate(`/groups/${groupId}/people`);
  };

  const handleCreateAssignment = () => {
    // Navigate to assignment creation
    navigate(`/groups/${groupId}/assignments/create`);
  };

  const handleManageGroup = () => {
    // Navigate to group management
    navigate(`/groups/${groupId}/manage`);
  };

  const handleViewAnalytics = () => {
    // Navigate to group analytics
    navigate(`/groups/${groupId}/analytics`);
  };

  const handleAddMember = () => {
    // Open add member modal or navigate
    navigate(`/groups/${groupId}/people/add`);
  };

  useEffect(() => {
    const fetchGroupInfo = async () => {
      if (!groupId) {
        return;
      }
      
      try {
        const token = localStorage.getItem('token');
        const groupResponse = await axios.get(`${API_URL}/api/groups/${groupId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const group = groupResponse.data;
        
        // Now get the group members using the group members endpoint
        let members = [];
        try {
          const membersResponse = await axios.get(`${API_URL}/api/groups/${groupId}/members`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          members = membersResponse.data || [];
        } catch (membersError) {
          members = [];
        }
        
        // Get course information
        let courseName = 'Course';
        try {
          const courseResponse = await axios.get(`${API_URL}/api/courses/${group.course}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          courseName = courseResponse.data?.data?.title || courseResponse.data?.title || 'Course';
        } catch (courseError) {
          // Continue with default course name
        }
        
        // Set the group info with real data
        setGroupInfo({
          _id: group._id,
          name: group.name,
          groupSet: {
            _id: group.groupSet,
            name: group.groupSetName,
            course: {
              _id: group.course,
              name: courseName
            }
          },
          members: members
        });
        
        // Calculate stats from real data
        setStats({
          totalMembers: members.length,
          recentActivity: 0,
          upcomingAssignments: 0,
          announcements: 0,
          completedTasks: 0,
          groupScore: 0
        });
        
        // Try to fetch assignments for this group set
        try {
          const assignmentsResponse = await axios.get(`${API_URL}/api/assignments/groupset/${group.groupSet}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const assignments = assignmentsResponse.data || [];
          
          // Filter upcoming assignments
          const now = new Date();
          const upcomingAssignments = assignments.filter((assignment: any) => {
            if (!assignment.dueDate) return false;
            const dueDate = new Date(assignment.dueDate);
            return dueDate > now;
          });

          const upcomingTasks = upcomingAssignments.map((assignment: any) => ({
            id: assignment._id,
            title: assignment.title,
            dueDate: assignment.dueDate,
            type: assignment.isDiscussion ? 'discussion' : 'assignment',
            priority: getPriority(assignment.dueDate)
          }));

          setUpcomingTasks(upcomingTasks);
          setStats(prevStats => ({
            ...prevStats,
            upcomingAssignments: upcomingTasks.length
          }));
        } catch (assignmentError) {
          setUpcomingTasks([]);
        }
        
      } catch (error) {
        // Error handling - create fallback group
        
        // Create a fallback group with the groupId from URL
        setGroupInfo({
          _id: groupId,
          name: `Group ${groupId.slice(-4)}`,
          groupSet: {
            _id: 'unknown',
            name: 'Unknown Group Set',
            course: {
              _id: 'unknown',
              name: 'Unknown Course'
            }
          },
          members: []
        });
        
        setUpcomingTasks([]);
        setStats({
          totalMembers: 0,
          recentActivity: 0,
          upcomingAssignments: 0,
          announcements: 0,
          completedTasks: 0,
          groupScore: 0
        });
      } finally {
        setLoading(false);
      }
    };

    fetchGroupInfo();
  }, [groupId]);

  // Helper function to determine priority based on due date
  const getPriority = (dueDate: string): 'high' | 'medium' | 'low' => {
    const now = new Date();
    const due = new Date(dueDate);
    const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDue <= 3) return 'high';
    if (daysUntilDue <= 7) return 'medium';
    return 'low';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-white dark:bg-gray-800 rounded-lg w-1/3 mb-4 shadow-sm"></div>
          <div className="h-4 bg-white dark:bg-gray-800 rounded-lg w-1/2 mb-6 shadow-sm"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-white dark:bg-gray-800 rounded-xl shadow-sm"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!groupInfo) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="text-center py-12">
          <div className="text-gray-500 dark:text-gray-400 text-lg">Group not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full overflow-y-auto ${isMobileDevice ? 'pb-20' : ''}`}>
      {/* 1. Welcome Section - For Both Teachers and Students */}
      <div className={`${isMobileDevice ? 'p-3 mb-3' : 'p-4 sm:p-6 mb-6 sm:mb-8'}`}>
        <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg ${isMobileDevice ? 'p-4' : 'p-4 sm:p-6 lg:p-8'} border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300`}>
          <div className="flex items-center justify-center">
            <div className="text-center">
              <h1 className={`${isMobileDevice ? 'text-xl' : 'text-2xl sm:text-3xl lg:text-4xl'} font-bold text-gray-900 dark:text-gray-100 mb-2`}>
                Welcome to {groupInfo.name}
              </h1>
              <p className={`text-gray-600 dark:text-gray-300 ${isMobileDevice ? 'text-xs' : 'text-sm sm:text-base lg:text-lg'} mb-1`}>
                {groupInfo.groupSet.course.name} • {groupInfo.groupSet.name}
              </p>
              <div className="flex items-center justify-center mt-3 space-x-2 sm:space-x-4">
                <div className={`flex items-center ${isMobileDevice ? 'text-xs px-2 py-1' : 'text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5'} text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 rounded-full border dark:border-gray-600`}>
                  <Users className={`${isMobileDevice ? 'h-3 w-3 mr-1' : 'h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5'} text-gray-500 dark:text-gray-400`} />
                  <span className="font-medium">{stats.totalMembers} {stats.totalMembers === 1 ? 'member' : 'members'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Quick Actions - Teacher Only */}
      {isTeacher && (
        <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 ${isMobileDevice ? 'p-3 mb-4' : 'p-4 sm:p-6 mb-6 sm:mb-8'}`}>
          <h2 className={`${isMobileDevice ? 'text-base' : 'text-lg sm:text-xl'} font-semibold text-gray-900 dark:text-gray-100 ${isMobileDevice ? 'mb-3' : 'mb-4 sm:mb-5'} flex items-center`}>
            <div className={`${isMobileDevice ? 'p-1' : 'p-1.5'} bg-yellow-50 dark:bg-yellow-900/50 rounded-lg mr-2.5`}>
              <Star className={`${isMobileDevice ? 'h-3 w-3' : 'h-3.5 w-3.5 sm:h-4 sm:w-4'} text-yellow-500 dark:text-yellow-400`} />
            </div>
            Quick Actions
          </h2>
          <div className={`grid ${isMobileDevice ? 'grid-cols-2 gap-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4'}`}>
            <button 
              onClick={handleCreateAssignment}
              className={`group flex flex-col items-center ${isMobileDevice ? 'p-3' : 'p-4 sm:p-6'} border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-md touch-manipulation active:scale-95`}
            >
              <div className={`${isMobileDevice ? 'p-2' : 'p-2 sm:p-3'} bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/50 dark:to-blue-800/50 rounded-full ${isMobileDevice ? 'mb-2' : 'mb-2 sm:mb-3'} group-hover:from-blue-200 group-hover:to-blue-100 dark:group-hover:from-blue-800 dark:group-hover:to-blue-700 transition-all duration-300 shadow-sm`}>
                <Plus className={`${isMobileDevice ? 'h-4 w-4' : 'h-5 w-5 sm:h-6 sm:w-6'} text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform`} />
              </div>
              <div className="text-center">
                <div className={`font-semibold ${isMobileDevice ? 'text-xs' : 'text-sm sm:text-base'} text-gray-900 dark:text-gray-100 mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors`}>
                  Create Assignment
                </div>
                {!isMobileDevice && (
                <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Add new group assignment</div>
                )}
              </div>
            </button>

            <button 
              onClick={handleManageGroup}
              className={`group flex flex-col items-center ${isMobileDevice ? 'p-3' : 'p-4 sm:p-6'} border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-green-400 dark:hover:border-green-500 hover:bg-green-50/50 dark:hover:bg-green-900/20 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-md touch-manipulation active:scale-95`}
            >
              <div className={`${isMobileDevice ? 'p-2' : 'p-3'} bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/50 dark:to-green-800/50 rounded-full ${isMobileDevice ? 'mb-2' : 'mb-3'} group-hover:from-green-200 group-hover:to-green-100 dark:group-hover:from-green-800 dark:group-hover:to-green-700 transition-all duration-300 shadow-sm`}>
                <Settings className={`${isMobileDevice ? 'h-4 w-4' : 'h-6 w-6'} text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform`} />
              </div>
              <div className="text-center">
                <div className={`font-semibold ${isMobileDevice ? 'text-xs' : 'text-sm sm:text-base'} text-gray-900 dark:text-gray-100 mb-1 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors`}>
                  Manage Group
                </div>
                {!isMobileDevice && (
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Group settings & configuration</div>
                )}
              </div>
            </button>

            <button 
              onClick={handleAddMember}
              className={`group flex flex-col items-center ${isMobileDevice ? 'p-3' : 'p-4 sm:p-6'} border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-orange-400 dark:hover:border-orange-500 hover:bg-orange-50/50 dark:hover:bg-orange-900/20 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-md touch-manipulation active:scale-95`}
            >
              <div className={`${isMobileDevice ? 'p-2' : 'p-3'} bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/50 dark:to-orange-800/50 rounded-full ${isMobileDevice ? 'mb-2' : 'mb-3'} group-hover:from-orange-200 group-hover:to-orange-100 dark:group-hover:from-orange-800 dark:group-hover:to-orange-700 transition-all duration-300 shadow-sm`}>
                <UserPlus className={`${isMobileDevice ? 'h-4 w-4' : 'h-6 w-6'} text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform`} />
              </div>
              <div className="text-center">
                <div className={`font-semibold ${isMobileDevice ? 'text-xs' : 'text-sm sm:text-base'} text-gray-900 dark:text-gray-100 mb-1 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors`}>
                  Add Member
                </div>
                {!isMobileDevice && (
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Invite students to group</div>
                )}
              </div>
            </button>

            <button 
              onClick={handleViewAnalytics}
              className={`group flex flex-col items-center ${isMobileDevice ? 'p-3' : 'p-4 sm:p-6'} border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-md touch-manipulation active:scale-95`}
            >
              <div className={`${isMobileDevice ? 'p-2' : 'p-3'} bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/50 dark:to-purple-800/50 rounded-full ${isMobileDevice ? 'mb-2' : 'mb-3'} group-hover:from-purple-200 group-hover:to-purple-100 dark:group-hover:from-purple-800 dark:group-hover:to-purple-700 transition-all duration-300 shadow-sm`}>
                <BarChart3 className={`${isMobileDevice ? 'h-4 w-4' : 'h-6 w-6'} text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform`} />
              </div>
              <div className="text-center">
                <div className={`font-semibold ${isMobileDevice ? 'text-xs' : 'text-sm sm:text-base'} text-gray-900 dark:text-gray-100 mb-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors`}>
                  View Analytics
                </div>
                {!isMobileDevice && (
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Group performance insights</div>
                )}
              </div>
            </button>
          </div>
        </div>
      )}

      {/* 3. Group Members & Upcoming Tasks - For Both Teachers and Students */}
      <div className={`${isMobileDevice ? 'px-3 space-y-4' : 'px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6'}`}>
        {/* Group Members - Interactive */}
        <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 ${isMobileDevice ? 'p-3' : 'p-4 sm:p-6'}`}>
          <div className={`flex items-center justify-between ${isMobileDevice ? 'mb-3 pb-2' : 'mb-4 sm:mb-5 pb-3 sm:pb-4'} border-b border-gray-100 dark:border-gray-700`}>
            <h2 className={`${isMobileDevice ? 'text-base' : 'text-lg sm:text-xl'} font-semibold text-gray-900 dark:text-gray-100 flex items-center`}>
              <div className={`${isMobileDevice ? 'p-1' : 'p-1.5'} bg-blue-50 dark:bg-blue-900/50 rounded-lg mr-2.5`}>
                <Users className={`${isMobileDevice ? 'h-3 w-3' : 'h-3.5 w-3.5 sm:h-4 sm:w-4'} text-blue-600 dark:text-blue-400`} />
              </div>
              Group Members
            </h2>
            <button 
              onClick={handleViewMembers}
              className={`text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 ${isMobileDevice ? 'text-xs' : 'text-xs sm:text-sm'} font-medium hover:underline transition-colors touch-manipulation`}
            >
              View all
            </button>
          </div>
          <div className={`${isMobileDevice ? 'space-y-2' : 'space-y-3 sm:space-y-4'}`}>
            {groupInfo.members && groupInfo.members.length > 0 ? (
              <>
                {groupInfo.members.slice(0, isMobileDevice ? 3 : 4).map((member, index) => (
                  <div 
                    key={member._id} 
                    className={`flex items-center ${isMobileDevice ? 'p-2.5' : 'p-3 sm:p-4'} bg-gradient-to-r from-gray-50/80 to-gray-100/80 dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl hover:from-blue-50 hover:to-purple-50 dark:hover:from-blue-900/20 dark:hover:to-purple-900/20 hover:shadow-sm transition-all duration-300 cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-600 touch-manipulation active:scale-95`}
                    onClick={() => navigate(`/groups/${groupId}/people`)}
                  >
                    <div className={`flex-shrink-0 ${isMobileDevice ? 'mr-2' : 'mr-3 sm:mr-4'}`}>
                      <ProfileImage
                        firstName={member.firstName}
                        lastName={member.lastName}
                        profilePicture={member.profilePicture}
                        size={isMobileDevice ? "md" : "lg"}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`${isMobileDevice ? 'text-xs' : 'text-xs sm:text-sm'} font-semibold text-gray-900 dark:text-gray-100 truncate mb-0.5`}>
                        {member.firstName} {member.lastName}
                      </p>
                      <p className={`${isMobileDevice ? 'text-[10px]' : 'text-xs'} text-gray-400 dark:text-gray-500 truncate`}>
                        {member.email}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <div className="text-right">
                        <span className={`inline-flex items-center ${isMobileDevice ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 sm:px-2.5 py-0.5 sm:py-1 text-xs'} rounded-full font-medium ${
                          index === 0 
                            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' 
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}>
                          {index === 0 ? 'Leader' : 'Member'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {groupInfo.members.length > (isMobileDevice ? 3 : 4) && (
                  <div className="text-center pt-2">
                    <span className={`${isMobileDevice ? 'text-xs' : 'text-sm'} text-gray-500 dark:text-gray-400`}>
                      +{groupInfo.members.length - (isMobileDevice ? 3 : 4)} more members
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className={`text-center ${isMobileDevice ? 'py-6' : 'py-8'}`}>
                <div className="flex flex-col items-center">
                  <Users className={`${isMobileDevice ? 'h-10 w-10' : 'h-12 w-12'} text-gray-400 dark:text-gray-500 mb-4`} />
                  <h3 className={`${isMobileDevice ? 'text-base' : 'text-lg'} font-medium text-gray-900 dark:text-gray-100 mb-2`}>
                    No members yet
                  </h3>
                  <p className={`${isMobileDevice ? 'text-xs' : 'text-sm'} text-gray-500 dark:text-gray-400`}>
                    This group doesn't have any members
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Tasks - Interactive */}
        <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 ${isMobileDevice ? 'p-3' : 'p-4 sm:p-6'}`}>
          <div className={`flex items-center justify-between ${isMobileDevice ? 'mb-3 pb-2' : 'mb-4 sm:mb-5 pb-3 sm:pb-4'} border-b border-gray-100 dark:border-gray-700`}>
            <h2 className={`${isMobileDevice ? 'text-base' : 'text-lg sm:text-xl'} font-semibold text-gray-900 dark:text-gray-100 flex items-center`}>
              <div className={`${isMobileDevice ? 'p-1' : 'p-1.5'} bg-orange-50 dark:bg-orange-900/50 rounded-lg mr-2.5`}>
                <Target className={`${isMobileDevice ? 'h-3 w-3' : 'h-3.5 w-3.5 sm:h-4 sm:w-4'} text-orange-600 dark:text-orange-400`} />
              </div>
              Upcoming Tasks
            </h2>
            <button 
              onClick={handleViewAssignments}
              className={`text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 ${isMobileDevice ? 'text-xs' : 'text-xs sm:text-sm'} font-medium hover:underline transition-colors touch-manipulation`}
            >
              View all
            </button>
          </div>
          <div className={`${isMobileDevice ? 'space-y-2' : 'space-y-3 sm:space-y-4'}`}>
            {upcomingTasks.length > 0 ? (
              upcomingTasks.slice(0, isMobileDevice ? 3 : undefined).map((task) => (
                <div 
                  key={task.id} 
                  className={`${isMobileDevice ? 'p-2.5' : 'p-4'} bg-gradient-to-r from-gray-50/80 to-gray-50/50 dark:from-gray-700/50 dark:to-gray-800/50 rounded-lg hover:from-orange-50 hover:to-orange-50/50 dark:hover:from-orange-900/20 dark:hover:to-orange-800/20 transition-all duration-300 cursor-pointer border-l-4 border-transparent hover:border-orange-400 dark:hover:border-orange-500 hover:shadow-sm touch-manipulation active:scale-95`}
                  onClick={() => navigate(`/groups/${groupId}/assignments`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={`${isMobileDevice ? 'text-xs' : 'text-sm'} font-medium text-gray-900 dark:text-gray-100 mb-1.5 truncate`}>
                        {task.title}
                      </p>
                      <div className={`flex items-center ${isMobileDevice ? 'text-[10px]' : 'text-xs'} text-gray-500 dark:text-gray-400`}>
                        <Clock className={`${isMobileDevice ? 'h-2.5 w-2.5' : 'h-3 w-3'} mr-1`} />
                        <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <span className={`${isMobileDevice ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'} rounded-full font-medium whitespace-nowrap shadow-sm ${
                      task.priority === 'high' ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300' :
                      task.priority === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300' :
                      'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                    }`}>
                      {task.priority}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className={`text-center ${isMobileDevice ? 'py-6' : 'py-8'}`}>
                <div className="flex flex-col items-center">
                  <CheckCircle className={`${isMobileDevice ? 'h-10 w-10' : 'h-12 w-12'} text-green-500 dark:text-green-400 mb-4`} />
                  <h3 className={`${isMobileDevice ? 'text-base' : 'text-lg'} font-medium text-gray-900 dark:text-gray-100 mb-2`}>
                    All caught up!
                  </h3>
                  <p className={`${isMobileDevice ? 'text-xs' : 'text-sm'} text-gray-500 dark:text-gray-400`}>
                    No upcoming assignments or discussions
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupHome;
