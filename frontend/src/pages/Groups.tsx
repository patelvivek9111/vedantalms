import React, { useEffect, useState, useRef } from 'react';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCourse } from '../contexts/CourseContext';
import { getUserPreferences, getImageUrl } from '../services/api';
import { ChangeUserModal } from '../components/ChangeUserModal';
import logger from '../utils/logger';
import { requestCache, CACHE_KEYS } from '../utils/requestCache';
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  TrendingUp, 
  AlertCircle,
  UserPlus,
  UserMinus,
  Settings,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  Menu,
  Folder,
  HelpCircle,
  User as UserIcon,
  LogOut
} from 'lucide-react';

interface Group {
  _id: string;
  name: string;
  course: { _id: string; title: string };
  members?: Array<{ firstName: string; lastName: string; email: string }>;
  leader?: { firstName: string; lastName: string; email: string };
}

interface GroupSet {
  _id: string;
  name: string;
  course: { _id: string; title: string };
  allowSelfSignup: boolean;
  groupStructure?: string;
  totalGroups?: number;
  totalMembers?: number;
  createdAt?: string;
  lastUpdated?: string;
}

const Groups: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupSets, setGroupSets] = useState<GroupSet[]>([]);
  const [allGroupsData, setAllGroupsData] = useState<{[key: string]: any[]}>({}); // Store groups for each group set
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [userCourseColors, setUserCourseColors] = useState<{ [key: string]: string }>({});
  const navigate = useNavigate();
  const { user, loading: authLoading, logout } = useAuth();
  const { courses } = useCourse();
  const [showBurgerMenu, setShowBurgerMenu] = useState(false);
  const [showChangeUserModal, setShowChangeUserModal] = useState(false);
  const fetchingRef = useRef(false);
  const preferencesFetchingRef = useRef(false);

  useEffect(() => {
    // Don't fetch if still loading auth or if user is not authenticated
    if (authLoading || !user || fetchingRef.current) {
      return;
    }

    // AbortController for request cancellation
    const abortController = new AbortController();
    let isMounted = true;
    fetchingRef.current = true;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        if (user.role === 'teacher' || user.role === 'admin') {
          // For teachers, fetch groupsets and their group/member counts
          const res = await api.get('/groups/sets/my', {
            signal: abortController.signal
          });
          const groupSetsData = res.data.data || [];
          
          if (!isMounted) return;
          
          // Fetch group and member counts for each group set with delay to avoid rate limiting
          // Process in batches to avoid overwhelming the server
          const batchSize = 3;
          const groupSetsWithCounts: GroupSet[] = [];
          
          for (let i = 0; i < groupSetsData.length; i += batchSize) {
            const batch = groupSetsData.slice(i, i + batchSize);
            const batchResults = await Promise.all(
              batch.map(async (groupSet: GroupSet) => {
              
              if (abortController.signal.aborted || !isMounted) {
                return {
                  ...groupSet,
                  totalGroups: 0,
                  totalMembers: 0
                };
              }
              
              try {
                const groupsRes = await api.get(`/groups/sets/${groupSet._id}/groups`, {
                  signal: abortController.signal
                });
                const groups = groupsRes.data || [];
                
                if (!isMounted) return {
                  ...groupSet,
                  totalGroups: 0,
                  totalMembers: 0
                };
                
                // Store groups data for this group set
                setAllGroupsData(prev => ({
                  ...prev,
                  [groupSet._id]: groups
                }));
                
                // Count unique members across all groups in this set
                const uniqueMembers = new Set();
                
                groups.forEach((group: any) => {
                  if (group.members && Array.isArray(group.members)) {
                    group.members.forEach((member: any) => {
                      // Use member ID to ensure uniqueness - check for _id first, then email as fallback
                      const memberId = member._id || member.id || member.email;
                      
                      if (memberId) {
                        uniqueMembers.add(memberId);
                      }
                    });
                  }
                });
                
                return {
                  ...groupSet,
                  totalGroups: groups.length,
                  totalMembers: uniqueMembers.size
                };
              } catch (err: any) {
                // Don't handle canceled requests - they're intentional
                const isCanceled = err.code === 'ERR_CANCELED' || err.name === 'CanceledError' || err.message === 'canceled';
                if (isCanceled || abortController.signal.aborted) {
                  return {
                    ...groupSet,
                    totalGroups: 0,
                    totalMembers: 0
                  };
                }
                
                // Don't log rate limit errors as errors, just skip this group set
                if (err.response?.status === 429) {
                  logger.warn(`Rate limited while fetching groups for set ${groupSet._id}`);
                  return {
                    ...groupSet,
                    totalGroups: 0,
                    totalMembers: 0
                  };
                }
                logger.error(`Error fetching groups for set ${groupSet._id}`, err);
                return {
                  ...groupSet,
                  totalGroups: 0,
                  totalMembers: 0
                };
              }
              })
            );
            
            groupSetsWithCounts.push(...batchResults);
            
            // Add delay between batches to avoid rate limiting
            if (i + batchSize < groupSetsData.length && isMounted) {
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          }
          
          if (isMounted) {
            setGroupSets(groupSetsWithCounts);
          }
        } else {
          // For students, fetch groups
          const res = await api.get('/groups/my', {
            signal: abortController.signal
          });
          if (isMounted) {
            setGroups(res.data.data || []);
          }
        }
      } catch (err: any) {
        // Don't handle canceled requests - they're intentional
        const isCanceled = err.code === 'ERR_CANCELED' || err.name === 'CanceledError' || err.message === 'canceled';
        
        if (isCanceled || abortController.signal.aborted || !isMounted) {
          return;
        }
        
        logger.error('Error fetching data', err);
        if (err.response?.status === 401) {
          setError('Please log in to view groups');
        } else if (err.response?.status === 429) {
          setError('Too many requests. Please wait a moment and refresh the page.');
        } else if (err.response?.status === 500) {
          setError('Server error. Please try again later.');
        } else {
          setError('Failed to load groups');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          fetchingRef.current = false;
        }
      }
    };
    
    fetchData();

    // Cleanup function
    return () => {
      isMounted = false;
      fetchingRef.current = false;
      abortController.abort();
    };
  }, [user?.role, user?._id]); // Only depend on role and _id, not the entire user object

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  // Show login prompt if not authenticated
  if (!user) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="text-center py-12">
          <div className="text-gray-500 text-lg mb-4">Please log in to view groups</div>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  const isTeacher = user.role === 'teacher' || user.role === 'admin';
  const title = isTeacher ? 'All Group Sets' : 'All Groups';
  const subtitle = isTeacher 
    ? 'View all group sets from all your courses in one place' 
    : 'View all groups from all your courses in one place';

  // Load user preferences on mount (only once, with request cancellation)
  useEffect(() => {
    if (!user?._id || preferencesFetchingRef.current) return;
    
    const abortController = new AbortController();
    let isMounted = true;
    preferencesFetchingRef.current = true;

    const loadUserPreferences = async () => {
      try {
        // Use request cache to prevent duplicate requests
        const response = await requestCache.get(
          `${CACHE_KEYS.USER_PREFERENCES}:${user._id}`,
          () => api.get('/users/me/preferences', {
            signal: abortController.signal
          }),
          60000 // Cache for 60 seconds
        );
        if (isMounted && response.data.success && response.data.preferences?.courseColors) {
          setUserCourseColors(response.data.preferences.courseColors || {});
        }
      } catch (err: any) {
        // Don't log canceled requests or rate limit errors
        const isCanceled = err.code === 'ERR_CANCELED' || err.name === 'CanceledError' || err.message === 'canceled';
        if (!isCanceled && err.response?.status !== 429 && !abortController.signal.aborted) {
          logger.error('Error loading user preferences', err);
        }
      } finally {
        if (isMounted) {
          preferencesFetchingRef.current = false;
        }
      }
    };

    // Add a delay to avoid immediate rate limiting on page load
    const timeoutId = setTimeout(() => {
      loadUserPreferences();
    }, 1000);

    return () => {
      isMounted = false;
      preferencesFetchingRef.current = false;
      clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [user?._id]); // Only depend on user ID, not entire user object

  // Helper to get course color (same logic as Dashboard)
  // Priority: user's personal color preference > course defaultColor > fallback
  // Both teachers and students can have personal preferences
  const getCourseColor = (courseId: string) => {
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

  // Get unique courses for filter
  const getUniqueCourses = () => {
    if (isTeacher) {
      return [...new Set(groupSets.map(gs => gs.course?.title).filter(Boolean))];
    } else {
      return [...new Set(groups.map(g => g.course?.title).filter(Boolean))];
    }
  };

  // Filter data based on search, filters, and selected metric
  const getFilteredData = () => {
    let data = isTeacher ? groupSets : groups;
    
    if (searchTerm) {
      data = data.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.course?.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (courseFilter !== 'all') {
      data = data.filter(item => item.course?.title === courseFilter);
    }
    
    // Filter based on selected metric
    if (selectedMetric) {
      if (isTeacher) {
        switch (selectedMetric) {
          case 'groupSets':
            // Show all group sets (no additional filtering)
            break;
          case 'groups':
            // Show group sets that have groups
            data = data.filter(item => ((item as GroupSet).totalGroups || 0) > 0);
            break;
          case 'members':
            // Show group sets that have members
            data = data.filter(item => ((item as GroupSet).totalMembers || 0) > 0);
            break;
          case 'active':
            // Show active group sets (with self signup enabled)
            data = data.filter(item => (item as GroupSet).allowSelfSignup);
            break;
        }
      } else {
        switch (selectedMetric) {
          case 'groups':
            // Show all groups (no additional filtering)
            break;
          case 'members':
            // Show groups that have members
            data = data.filter(item => {
              const group = item as Group;
              return group.members && group.members.length > 0;
            });
            break;
          case 'leaders':
            // Show groups that have leaders
            data = data.filter(item => {
              const group = item as Group;
              return group.leader;
            });
            break;
          case 'active':
            // Show active groups (with members)
            data = data.filter(item => {
              const group = item as Group;
              return group.members && group.members.length > 0;
            });
            break;
        }
      }
    }
    
    return data;
  };

  const filteredData = getFilteredData();
  const uniqueCourses = getUniqueCourses();



  // Calculate statistics based on filtered data
  const getStats = () => {
    if (isTeacher) {
      // For teachers, calculate unique members across ALL group sets combined
      const uniqueMembers = new Set();
      
      // Use the stored groups data to calculate unique members across all sets
      (filteredData as GroupSet[]).forEach((groupSet: GroupSet, setIndex: number) => {
        const groupsForThisSet = allGroupsData[groupSet._id] || [];
        
        groupsForThisSet.forEach((group: any, groupIndex: number) => {
          if (group.members && Array.isArray(group.members)) {
            group.members.forEach((member: any, memberIndex: number) => {
              // Use member ID to ensure uniqueness - check for _id first, then email as fallback
              const memberId = member._id || member.id || member.email;
              
              if (memberId) {
                uniqueMembers.add(memberId);
              }
            });
          }
        });
      });
      
      // Calculate total groups across all sets
      const totalGroups = filteredData.reduce((sum, gs) => sum + ((gs as GroupSet).totalGroups || 0), 0);
      
      return {
        totalGroupSets: filteredData.length,
        totalGroups: totalGroups,
        totalMembers: uniqueMembers.size, // Use the actual unique count
        activeGroupSets: filteredData.filter(gs => (gs as GroupSet).allowSelfSignup).length
      };
    } else {
      // For students, count unique members across all their groups
      const uniqueMembers = new Set();
      
      filteredData.forEach((group: Group, groupIndex: number) => {
        if (group.members && Array.isArray(group.members)) {
          group.members.forEach((member: any, memberIndex: number) => {
            // Use member ID to ensure uniqueness - check for _id first, then email as fallback
            const memberId = member._id || member.id || member.email;
            
            if (memberId) {
              uniqueMembers.add(memberId);
            }
          });
        }
      });
      
      return {
        totalGroups: filteredData.length,
        totalMembers: uniqueMembers.size,
        groupsWithLeader: filteredData.filter(g => (g as Group).leader).length,
        activeGroups: filteredData.filter(g => (g as Group).members && (g as Group).members!.length > 0).length
      };
    }
  };

  const stats = getStats();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Navigation Bar (Mobile Only) */}
      <nav className="lg:hidden fixed top-0 left-0 right-0 z-[150] bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm backdrop-blur-sm">
        <div className="relative flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setShowBurgerMenu(!showBurgerMenu)}
            className="text-gray-700 dark:text-gray-300 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Groups</h1>
          <div className="w-10"></div> {/* Spacer for centering */}
          
          {/* Burger Menu Dropdown */}
          {showBurgerMenu && (
            <>
              {/* Overlay */}
              <div
                className="fixed inset-0 bg-black bg-opacity-50 z-[151]"
                onClick={() => setShowBurgerMenu(false)}
              />
              {/* Menu */}
              <div className="absolute top-full left-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-[280px] z-[152] overflow-hidden">
                {/* Profile Information */}
                <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      {user?.profilePicture ? (
                        <img
                          src={user.profilePicture.startsWith('http') 
                            ? user.profilePicture 
                            : getImageUrl(user.profilePicture)}
                          alt={`${user.firstName} ${user.lastName}`}
                          className="w-12 h-12 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                            if (fallback) {
                              fallback.style.display = 'flex';
                            }
                          }}
                        />
                      ) : null}
                      {/* Fallback avatar */}
                      <div
                        className={`w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-base font-bold ${
                          user?.profilePicture ? 'hidden' : 'flex'
                        }`}
                        style={{
                          display: user?.profilePicture ? 'none' : 'flex'
                        }}
                      >
                        {user?.firstName?.charAt(0) || ''}{user?.lastName?.charAt(0) || 'U'}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">
                        {user?.firstName} {user?.lastName}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {user?.email}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Options */}
                <div className="py-2">
                  <button
                    onClick={() => {
                      setShowBurgerMenu(false);
                      navigate('/account');
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
                  >
                    <Folder className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    <span>Files</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowBurgerMenu(false);
                      navigate('/account');
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
                  >
                    <Settings className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    <span>Settings</span>
                  </button>
                </div>

                {/* Separator */}
                <div className="border-t border-gray-200 dark:border-gray-700"></div>

                {/* Account Actions */}
                <div className="py-2">
                  <button
                    onClick={() => {
                      setShowBurgerMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
                  >
                    <HelpCircle className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    <span>Help</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowBurgerMenu(false);
                      setShowChangeUserModal(true);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
                  >
                    <UserIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    <span>Change User</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowBurgerMenu(false);
                      logout();
                      navigate('/login');
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
                  >
                    <LogOut className="h-5 w-5" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </nav>
      
      <ChangeUserModal
        isOpen={showChangeUserModal}
        onClose={() => setShowChangeUserModal(false)}
      />
      
      <div className="max-w-6xl mx-auto py-4 sm:py-6 lg:py-8 px-4 sm:px-6 pt-20 lg:pt-4">
        <div className="mb-6 sm:mb-8">
          <h1 className="hidden lg:block text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">{title}</h1>
          <p className="hidden lg:block text-sm sm:text-base text-gray-600 dark:text-gray-400">{subtitle}</p>
          <p className="lg:hidden text-sm text-gray-600 dark:text-gray-400 mt-2">{subtitle}</p>
        </div>

      {/* Statistics Cards - Only for Teachers */}
      {isTeacher && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div 
            className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border-l-4 border-blue-500 dark:border-blue-400 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 ${
              selectedMetric === 'groupSets' ? 'ring-2 ring-blue-300 dark:ring-blue-600 shadow-lg' : ''
            }`}
            onClick={() => setSelectedMetric(selectedMetric === 'groupSets' ? null : 'groupSets')}
          >
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Total Group Sets</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalGroupSets}</p>
              </div>
            </div>
          </div>

          <div 
            className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border-l-4 border-green-500 dark:border-green-400 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 ${
              selectedMetric === 'groups' ? 'ring-2 ring-green-300 dark:ring-green-600 shadow-lg' : ''
            }`}
            onClick={() => setSelectedMetric(selectedMetric === 'groups' ? null : 'groups')}
          >
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
                <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Total Groups</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalGroups}</p>
              </div>
            </div>
          </div>

          <div 
            className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border-l-4 border-purple-500 dark:border-purple-400 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 ${
              selectedMetric === 'members' ? 'ring-2 ring-purple-300 dark:ring-purple-600 shadow-lg' : ''
            }`}
            onClick={() => setSelectedMetric(selectedMetric === 'members' ? null : 'members')}
          >
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                <UserPlus className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Total Members</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalMembers}</p>
              </div>
            </div>
          </div>

          <div 
            className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border-l-4 border-orange-500 dark:border-orange-400 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 ${
              selectedMetric === 'active' ? 'ring-2 ring-orange-300 dark:ring-orange-600 shadow-lg' : ''
            }`}
            onClick={() => setSelectedMetric(selectedMetric === 'active' ? null : 'active')}
          >
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
                <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Active Sets</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.activeGroupSets}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6 mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/50 rounded-lg">
              <Filter className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">Filters & Search</h2>
          </div>
          {isTeacher && (
            <button 
              onClick={() => navigate('/groups/create')}
              className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-500 dark:to-blue-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 dark:hover:from-blue-600 dark:hover:to-blue-700 transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <Plus className="w-4 h-4" />
              <span className="font-medium text-sm sm:text-base">Create Group Set</span>
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="space-y-2">
            <label htmlFor="search-groups" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Search Groups</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" aria-hidden="true" />
              <input
                type="text"
                id="search-groups"
                name="searchGroups"
                placeholder="Search by name or course..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 transition-all duration-200 hover:bg-white dark:hover:bg-gray-800"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="filter-course" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Filter by Course</label>
            <select
              id="filter-course"
              name="courseFilter"
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 transition-all duration-200 hover:bg-white dark:hover:bg-gray-800 appearance-none cursor-pointer"
            >
              <option value="all">All Courses ({isTeacher ? groupSets.length : groups.length})</option>
              {uniqueCourses.map(course => {
                const count = isTeacher 
                  ? groupSets.filter(gs => gs.course?.title === course).length
                  : groups.filter(g => g.course?.title === course).length;
                return (
                  <option key={course} value={course}>
                    {course} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">View Mode</label>
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  viewMode === 'grid' 
                    ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-md transform scale-105' 
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                <div className="flex items-center justify-center space-x-2">
                  <div className="grid grid-cols-2 gap-0.5">
                    <div className="w-1 h-1 bg-current rounded-sm"></div>
                    <div className="w-1 h-1 bg-current rounded-sm"></div>
                    <div className="w-1 h-1 bg-current rounded-sm"></div>
                    <div className="w-1 h-1 bg-current rounded-sm"></div>
                  </div>
                  <span>Grid</span>
                </div>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  viewMode === 'list' 
                    ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-md transform scale-105' 
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                <div className="flex items-center justify-center space-x-2">
                  <div className="flex flex-col space-y-0.5">
                    <div className="w-3 h-0.5 bg-current rounded-sm"></div>
                    <div className="w-3 h-0.5 bg-current rounded-sm"></div>
                    <div className="w-3 h-0.5 bg-current rounded-sm"></div>
                  </div>
                  <span>List</span>
                </div>
              </button>
            </div>
          </div>
        </div>
        
        {(searchTerm || courseFilter !== 'all' || selectedMetric) && (
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Active filters:</span>
              {searchTerm && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200">
                  Search: "{searchTerm}"
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="ml-2 hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    <XCircle className="w-3 h-3" />
                  </button>
                </span>
              )}
              {courseFilter !== 'all' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200">
                  Course: {courseFilter}
                  <button 
                    onClick={() => setCourseFilter('all')}
                    className="ml-2 hover:text-green-600 dark:hover:text-green-400"
                  >
                    <XCircle className="w-3 h-3" />
                  </button>
                </span>
              )}
              {selectedMetric && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200">
                  Metric: {selectedMetric}
                  <button 
                    onClick={() => setSelectedMetric(null)}
                    className="ml-2 hover:text-purple-600 dark:hover:text-purple-400"
                  >
                    <XCircle className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setSearchTerm('');
                setCourseFilter('all');
                setSelectedMetric(null);
              }}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
        </div>
      )}

      {!loading && isTeacher && filteredData.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Showing {filteredData.length} of {isTeacher ? groupSets.length : groups.length} {isTeacher ? 'group sets' : 'groups'}
              {(searchTerm || courseFilter !== 'all') && (
                <span className="ml-2 text-gray-400 dark:text-gray-500">
                  (filtered)
                </span>
              )}
            </p>
          </div>
          <div className={viewMode === 'grid' 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            : "space-y-4"
          }>
          {filteredData.map((item) => {
            const groupSet = item as GroupSet;
            return (
            <div 
              key={groupSet._id} 
                className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700 ${
                  viewMode === 'list' ? 'flex items-center' : ''
                }`}
              onClick={() => navigate(`/groupsets/${groupSet._id}`)}
            >
                {viewMode === 'grid' ? (
                  <>
              {/* Top section - Course color */}
              <div 
                className="h-20 relative"
                style={{ backgroundColor: getCourseColor(groupSet.course?._id || 'default') }}
              >
                <div className="absolute top-2 right-2">
                  <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                    <Users className="h-3 w-3 text-white" />
                  </div>
                </div>
              </div>
              
              {/* Bottom section - White */}
              <div className="p-4">
                <div className="mb-3">
                  <h3 
                    className="font-bold text-base mb-1"
                    style={{ color: getCourseColor(groupSet.course?._id || 'default') }}
                  >
                    {groupSet.name}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-xs">
                    {groupSet.course?.title || 'Unknown Course'}
                  </p>
                </div>
                

                    </div>
                  </>
                ) : (
                  // List view
                  <div className="flex-1 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 
                          className="font-bold text-base"
                          style={{ color: getCourseColor(groupSet.course?._id || 'default') }}
                        >
                          {groupSet.name}
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                          {groupSet.course?.title || 'Unknown Course'}
                        </p>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{groupSet.totalGroups || 0}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Groups</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{groupSet.totalMembers || 0}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Members</p>
                        </div>

                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </>
      )}
      
      {!loading && !isTeacher && filteredData.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Showing {filteredData.length} of {isTeacher ? groupSets.length : groups.length} {isTeacher ? 'group sets' : 'groups'}
              {(searchTerm || courseFilter !== 'all') && (
                <span className="ml-2 text-gray-400 dark:text-gray-500">
                  (filtered)
                </span>
              )}
            </p>
          </div>
          <div className={viewMode === 'grid' 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            : "space-y-4"
          }>
          {filteredData.map((item) => {
            const group = item as Group;
            return (
            <div 
              key={group._id} 
                className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-100 dark:border-gray-700 ${
                  viewMode === 'list' ? 'flex items-center' : ''
                }`}
              onClick={() => navigate(`/groups/${group._id}`)}
            >
                {viewMode === 'grid' ? (
                  <>
              {/* Top section - Course color */}
              <div 
                className="h-20 relative"
                style={{ backgroundColor: getCourseColor(group.course?._id || 'default') }}
              >
                <div className="absolute top-2 right-2">
                  <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                    <Users className="h-3 w-3 text-white" />
                  </div>
                </div>
              </div>
              
              {/* Bottom section - White */}
              <div className="p-4">
                <div className="mb-3">
                  <h3 
                    className="font-bold text-base mb-1"
                    style={{ color: getCourseColor(group.course?._id || 'default') }}
                  >
                    {group.name}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-xs">
                    {group.course?.title || 'Unknown Course'}
                  </p>
                </div>
                
                {/* Members section */}
                {group.members && group.members.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                      Members ({group.members.length})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {group.members.slice(0, 2).map((member, index) => (
                        <span key={index} className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          {member.firstName} {member.lastName}
                        </span>
                      ))}
                      {group.members.length > 2 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          +{group.members.length - 2} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Leader section */}
                {group.leader && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Leader</p>
                    <p className="text-xs text-gray-700 dark:text-gray-300 font-medium">{group.leader.firstName} {group.leader.lastName}</p>
                  </div>
                )}
                    </div>
                  </>
                ) : (
                  // List view
                  <div className="flex-1 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 
                          className="font-bold text-base"
                          style={{ color: getCourseColor(group.course?._id || 'default') }}
                        >
                          {group.name}
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                          {group.course?.title || 'Unknown Course'}
                        </p>
                        {group.members && group.members.length > 0 && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-4">
                        {group.leader && (
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{group.leader.firstName} {group.leader.lastName}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Leader</p>
                          </div>
                        )}
                        {group.members && group.members.length > 0 && (
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{group.members.length}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Members</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </>
      )}

      {/* Empty State */}
      {!loading && filteredData.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
            <Users className="w-8 h-8 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            {searchTerm || courseFilter !== 'all' ? 'No groups found' : 'No groups yet'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {searchTerm || courseFilter !== 'all' 
              ? 'Try adjusting your search or filters to find what you\'re looking for.'
              : isTeacher 
                ? 'Create your first group set to get started with collaborative learning.'
                : 'You haven\'t been assigned to any groups yet.'
            }
          </p>
          {!searchTerm && courseFilter === 'all' && isTeacher && (
            <button 
              onClick={() => navigate('/groups/create')}
              className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
            >
              Create Group Set
            </button>
          )}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-400 dark:text-red-500" />
            </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Error loading groups</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
      </div>
    </div>
  );
};

export default Groups; 