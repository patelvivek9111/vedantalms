import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Users, UserPlus, MessageSquare, Activity, Edit2, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import logger from '../../utils/logger';
import { useCourse } from '../../contexts/CourseContext';
import { useAuth } from '../../context/AuthContext';
import { getUserPreferences } from '../../services/api';

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
  const { courses } = useCourse();
  const { user } = useAuth();
  const [userCourseColors, setUserCourseColors] = useState<{ [key: string]: string }>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

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
        logger.error('Error fetching groupset data', err);
        setError('Failed to load groupset data');
      } finally {
        setLoading(false);
      }
    };

    fetchGroupSetData();
  }, [groupSetId]);

  // Load user preferences for course colors
  useEffect(() => {
    if (!user?._id) return;
    
    const loadUserPreferences = async () => {
      try {
        const response = await getUserPreferences();
        if (response.data.success && response.data.preferences?.courseColors) {
          setUserCourseColors(response.data.preferences.courseColors || {});
        }
      } catch (err) {
        // Silently fail - course colors are optional
      }
    };

    loadUserPreferences();
  }, [user?._id]);

  // Helper to get course color
  // Priority: user's personal color preference > course defaultColor > fallback
  // Both teachers and students can have personal preferences
  const getCourseColor = (courseId: string) => {
    if (!courseId) return '#556B2F';
    
    const course = courses.find(c => c._id === courseId);
    
    // Check if user has a personal color preference (for both teachers and students)
    if (userCourseColors[courseId]) {
      return userCourseColors[courseId];
    }
    
    // Use course's default color (set by teacher when creating/publishing)
    if (course?.defaultColor) {
      return course.defaultColor;
    }
    
    // Fallback
    return '#556B2F';
  };

  // Helper to get a lighter version of the color for badges
  const getLighterColor = (color: string) => {
    // Convert hex to RGB
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Lighten by 80% (for light mode) or darken by 30% (for dark mode)
    const lightR = Math.min(255, Math.round(r + (255 - r) * 0.8));
    const lightG = Math.min(255, Math.round(g + (255 - g) * 0.8));
    const lightB = Math.min(255, Math.round(b + (255 - b) * 0.8));
    
    return `rgb(${lightR}, ${lightG}, ${lightB})`;
  };

  // Helper to get text color (white or black) based on background brightness
  const getTextColor = (bgColor: string) => {
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#FFFFFF';
  };

  const courseColor = groupSet?.course?._id ? getCourseColor(groupSet.course._id) : '#556B2F';

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
    <div className="max-w-7xl mx-auto py-4 sm:py-6 lg:py-8 px-4 sm:px-6">
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2 break-words">
              {groupSet?.name || 'Group Set'}
            </h1>
            <p className="text-sm sm:text-base lg:text-lg text-gray-600 dark:text-gray-400">
              {groupSet?.course?.title || 'Unknown Course'}
            </p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 font-medium shadow-sm hover:shadow-md"
          >
            ← Back
          </button>
        </div>
        
        {groupSet && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-4 sm:p-5 mb-4 sm:mb-6">
            <div className="flex flex-wrap gap-3 sm:gap-4">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium ${
                  groupSet.allowSelfSignup 
                    ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
                }`}>
                  {groupSet.allowSelfSignup ? 'Self Signup Allowed' : 'Self Signup Disabled'}
                </span>
              </div>
              {groupSet.groupStructure && (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
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
            <div 
              key={group._id} 
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700 overflow-hidden transform hover:-translate-y-1"
            >
              {/* Header Section with Group Name - Using Course Color */}
              <div 
                className="px-4 sm:px-6 py-4 sm:py-5"
                style={{ 
                  backgroundColor: courseColor,
                  backgroundImage: `linear-gradient(135deg, ${courseColor} 0%, ${courseColor}dd 100%)`
                }}
              >
                <h3 
                  className="text-lg sm:text-xl font-bold break-words"
                  style={{ color: getTextColor(courseColor) }}
                >
                  {group.name}
                </h3>
              </div>

              {/* Content Section */}
              <div className="p-4 sm:p-6">
                {/* Members Section - Collapsible */}
                {group.members && group.members.length > 0 && (
                  <div className="mb-4 sm:mb-5">
                    <button
                      onClick={() => {
                        const newExpanded = new Set(expandedGroups);
                        if (newExpanded.has(group._id)) {
                          newExpanded.delete(group._id);
                        } else {
                          newExpanded.add(group._id);
                        }
                        setExpandedGroups(newExpanded);
                      }}
                      className="flex items-center gap-2 mb-3 w-full text-left hover:opacity-80 transition-opacity"
                    >
                      <Users className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex-1">
                        Members ({group.members.length})
                      </p>
                      {expandedGroups.has(group._id) ? (
                        <ChevronUp className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      )}
                    </button>
                    {expandedGroups.has(group._id) && (
                      <div className="flex flex-wrap gap-2">
                        {group.members.map((member, index) => (
                          <span 
                            key={index} 
                            className="inline-flex items-center px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium border"
                            style={{
                              backgroundColor: `${courseColor}20`,
                              color: courseColor,
                              borderColor: `${courseColor}40`
                            }}
                          >
                            {member.firstName} {member.lastName}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Leader Section */}
                {group.leader && (
                  <div className="mb-4 sm:mb-5 pb-4 sm:pb-5 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-400 dark:bg-yellow-500"></div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Leader
                      </p>
                    </div>
                    <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100 ml-4">
                      {group.leader.firstName} {group.leader.lastName}
                    </p>
                  </div>
                )}
                
                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
                  <button
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 sm:py-3 text-white rounded-lg transition-all duration-200 text-sm sm:text-base font-semibold shadow-md hover:shadow-lg transform hover:scale-[1.02]"
                    style={{
                      backgroundColor: courseColor,
                      color: getTextColor(courseColor)
                    }}
                    onMouseEnter={(e) => {
                      // Darken on hover
                      const hex = courseColor.replace('#', '');
                      const r = parseInt(hex.substr(0, 2), 16);
                      const g = parseInt(hex.substr(2, 2), 16);
                      const b = parseInt(hex.substr(4, 2), 16);
                      const darkerR = Math.max(0, Math.round(r * 0.85));
                      const darkerG = Math.max(0, Math.round(g * 0.85));
                      const darkerB = Math.max(0, Math.round(b * 0.85));
                      e.currentTarget.style.backgroundColor = `rgb(${darkerR}, ${darkerG}, ${darkerB})`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = courseColor;
                    }}
                    onClick={() => navigate(`/groups/${group._id}`)}
                  >
                    <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>View Group</span>
                  </button>
                  <button
                    className="flex items-center justify-center px-4 py-2.5 sm:py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-[1.02]"
                    onClick={() => navigate(`/groups/${group._id}/discussion`)}
                    aria-label="Open discussion"
                  >
                    <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
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