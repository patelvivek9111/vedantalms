import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCourse } from '../contexts/CourseContext';
import { getUserPreferences, getImageUrl } from '../services/api';
import { 
  Users, 
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
  User,
  LayoutGrid,
  List,
  ChevronDown
} from 'lucide-react';
import { BurgerMenu } from '../components/layout/BurgerMenu';
import SwipeableContainer from '../components/common/SwipeableContainer';
import { useBottomNavSwipe } from '../hooks/useBottomNavSwipe';

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

  useEffect(() => {
    // Don't fetch if still loading auth or if user is not authenticated
    if (authLoading || !user) {
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        if (user.role === 'teacher' || user.role === 'admin') {
          // For teachers, fetch groupsets and their group/member counts
          const res = await api.get('/groups/sets/my');
          const groupSetsDataRaw = res.data?.data || res.data;
          const groupSetsData = Array.isArray(groupSetsDataRaw) ? groupSetsDataRaw : [];
          
            // Fetch group and member counts for each group set
        const groupSetsWithCounts = await Promise.all(
          groupSetsData.map(async (groupSet: GroupSet) => {
            try {
              const groupsRes = await api.get(`/groups/sets/${groupSet._id}/groups`);
              const groupsDataRaw = groupsRes.data?.data || groupsRes.data;
              const groups = Array.isArray(groupsDataRaw) ? groupsDataRaw : [];
              
              // Store groups data for this group set
              setAllGroupsData(prev => ({
                ...prev,
                [groupSet._id]: groups
              }));
              
                      // Count unique members across all groups in this set
        const uniqueMembers = new Set();
        
        groups.forEach((group: any, groupIndex: number) => {
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
                ...groupSet,
                totalGroups: groups.length,
                totalMembers: uniqueMembers.size
              };
            } catch (err) {
              return {
                ...groupSet,
                totalGroups: 0,
                totalMembers: 0
              };
            }
          })
        );
        
        setGroupSets(groupSetsWithCounts);
        } else {
          // For students, fetch groups
          const res = await api.get('/groups/my');
          setGroups(res.data.data || []);
        }
      } catch (err: any) {
        if (err.response?.status === 401) {
          setError('Please log in to view groups');
        } else if (err.response?.status === 500) {
          setError('Server error. Please try again later.');
        } else {
          setError('Failed to load groups');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, authLoading]);

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

  // Load user preferences on mount
  useEffect(() => {
    const loadUserPreferences = async () => {
      if (!user) return;
      
      try {
        const response = await getUserPreferences();
        if (response.data.success && response.data.preferences?.courseColors) {
          setUserCourseColors(response.data.preferences.courseColors || {});
        }
      } catch (err) {
        }
    };

    loadUserPreferences();
  }, [user]);

  // Helper to get course color (same logic as Dashboard)
  const getCourseColor = (courseId: string) => {
    const course = courses.find(c => c._id === courseId);
    
    if (isTeacher) {
      // Teachers see the course's defaultColor
      return course?.defaultColor || '#556B2F';
    } else {
      // Students: priority is user's personal color > course defaultColor > fallback
      if (userCourseColors[courseId]) {
        return userCourseColors[courseId];
      }
      return course?.defaultColor || '#556B2F';
    }
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

  // Swipe navigation for bottom nav
  const { handleSwipeLeft, handleSwipeRight, enabled: swipeEnabled } = useBottomNavSwipe();

  return (
    <SwipeableContainer
      onSwipeLeft={swipeEnabled ? handleSwipeLeft : undefined}
      onSwipeRight={swipeEnabled ? handleSwipeRight : undefined}
      enabled={swipeEnabled}
      preventScrollInterference={true}
      className="min-h-screen bg-gray-50 dark:bg-gray-900"
    >
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Top Navigation Bar (Mobile Only) */}
        <nav className="lg:hidden fixed top-0 left-0 right-0 z-[150] bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="relative flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setShowBurgerMenu(!showBurgerMenu)}
            className="text-gray-700 dark:text-gray-300 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
            aria-label="Open account menu"
          >
            <User className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Groups</h1>
          <div className="w-10"></div> {/* Spacer for centering */}
          
          {/* Burger Menu */}
          <BurgerMenu
            showBurgerMenu={showBurgerMenu}
            setShowBurgerMenu={setShowBurgerMenu}
          />
        </div>
      </nav>
      
      
      <div className="max-w-6xl mx-auto py-4 sm:py-6 lg:py-8 px-4 sm:px-6 pt-20 lg:pt-4">
        <div className="mb-5 sm:mb-6">
          <h1 className="hidden lg:block text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            {title}
          </h1>
          <p className="hidden lg:block mt-1.5 text-sm text-gray-500 dark:text-gray-400 max-w-2xl leading-relaxed">
            {subtitle}
          </p>
          <p className="lg:hidden text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">{subtitle}</p>
        </div>

      {/* Statistics Cards - Only for Teachers */}
      {isTeacher && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 mb-5 sm:mb-6">
          <div 
            className={`group relative cursor-pointer rounded-2xl border border-gray-200/90 bg-white p-4 shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md dark:border-gray-700/80 dark:bg-gray-900/40 dark:hover:border-gray-600 ${
              selectedMetric === 'groupSets'
                ? 'border-blue-300 ring-2 ring-blue-500/15 dark:border-blue-500/40 dark:ring-blue-400/20'
                : 'border-l-[3px] border-l-blue-500 dark:border-l-blue-400'
            }`}
            onClick={() => setSelectedMetric(selectedMetric === 'groupSets' ? null : 'groupSets')}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Total group sets
                </p>
                <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight text-gray-900 dark:text-gray-50">
                  {stats.totalGroupSets}
                </p>
              </div>
            </div>
          </div>

          <div 
            className={`group relative cursor-pointer rounded-2xl border border-gray-200/90 bg-white p-4 shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md dark:border-gray-700/80 dark:bg-gray-900/40 dark:hover:border-gray-600 ${
              selectedMetric === 'groups'
                ? 'border-emerald-300 ring-2 ring-emerald-500/15 dark:border-emerald-500/40 dark:ring-emerald-400/20'
                : 'border-l-[3px] border-l-emerald-500 dark:border-l-emerald-400'
            }`}
            onClick={() => setSelectedMetric(selectedMetric === 'groups' ? null : 'groups')}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/50">
                <BarChart3 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Total groups
                </p>
                <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight text-gray-900 dark:text-gray-50">
                  {stats.totalGroups}
                </p>
              </div>
            </div>
          </div>

          <div 
            className={`group relative cursor-pointer rounded-2xl border border-gray-200/90 bg-white p-4 shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md dark:border-gray-700/80 dark:bg-gray-900/40 dark:hover:border-gray-600 ${
              selectedMetric === 'members'
                ? 'border-violet-300 ring-2 ring-violet-500/15 dark:border-violet-500/40 dark:ring-violet-400/20'
                : 'border-l-[3px] border-l-violet-500 dark:border-l-violet-400'
            }`}
            onClick={() => setSelectedMetric(selectedMetric === 'members' ? null : 'members')}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-950/50">
                <UserPlus className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Total members
                </p>
                <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight text-gray-900 dark:text-gray-50">
                  {stats.totalMembers}
                </p>
              </div>
            </div>
          </div>

          <div 
            className={`group relative cursor-pointer rounded-2xl border border-gray-200/90 bg-white p-4 shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md dark:border-gray-700/80 dark:bg-gray-900/40 dark:hover:border-gray-600 ${
              selectedMetric === 'active'
                ? 'border-amber-300 ring-2 ring-amber-500/15 dark:border-amber-500/40 dark:ring-amber-400/20'
                : 'border-l-[3px] border-l-amber-500 dark:border-l-amber-400'
            }`}
            onClick={() => setSelectedMetric(selectedMetric === 'active' ? null : 'active')}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/50">
                <CheckCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Active sets
                </p>
                <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight text-gray-900 dark:text-gray-50">
                  {stats.activeGroupSets}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="mb-6 sm:mb-8 rounded-2xl border border-gray-200/90 bg-white shadow-sm dark:border-gray-700/80 dark:bg-gray-900/50 dark:shadow-none">
        <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
              <Filter className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Search & filters</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Refine {isTeacher ? 'group sets' : 'groups'} by name or course</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 sm:gap-5 sm:p-5 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-5">
            <label htmlFor="groups-search" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input
                id="groups-search"
                type="text"
                placeholder="Name or course…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-3 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
              />
            </div>
          </div>

          <div className="lg:col-span-4">
            <label htmlFor="groups-course-filter" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Course
            </label>
            <div className="relative">
              <select
                id="groups-course-filter"
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                className="h-10 w-full cursor-pointer appearance-none rounded-lg border border-gray-200 bg-white px-3 pr-10 text-sm text-gray-900 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
              >
                <option value="all">All courses ({isTeacher ? groupSets.length : groups.length})</option>
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
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" aria-hidden />
            </div>
          </div>

          <div className="lg:col-span-3">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Layout
            </span>
            <div className="flex h-10 rounded-lg border border-gray-200 bg-gray-50/90 p-0.5 dark:border-gray-700 dark:bg-gray-900/80">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-50'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <LayoutGrid className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-50'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <List className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                List
              </button>
            </div>
          </div>
        </div>
        
        {(searchTerm || courseFilter !== 'all' || selectedMetric) && (
          <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Active
              </span>
              {searchTerm && (
                <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-blue-200/80 bg-blue-50/90 px-2 py-1 text-xs font-medium text-blue-900 dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-100">
                  <span className="truncate">“{searchTerm}”</span>
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="shrink-0 rounded p-0.5 hover:bg-blue-100/80 dark:hover:bg-blue-900/40"
                    aria-label="Remove search filter"
                  >
                    <XCircle className="h-3.5 w-3.5 text-blue-700/70 dark:text-blue-300/80" />
                  </button>
                </span>
              )}
              {courseFilter !== 'all' && (
                <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-emerald-200/80 bg-emerald-50/90 px-2 py-1 text-xs font-medium text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-100">
                  <span className="truncate">{courseFilter}</span>
                  <button
                    type="button"
                    onClick={() => setCourseFilter('all')}
                    className="shrink-0 rounded p-0.5 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40"
                    aria-label="Remove course filter"
                  >
                    <XCircle className="h-3.5 w-3.5 text-emerald-700/70 dark:text-emerald-300/80" />
                  </button>
                </span>
              )}
              {selectedMetric && (
                <span className="inline-flex items-center gap-1 rounded-md border border-violet-200/80 bg-violet-50/90 px-2 py-1 text-xs font-medium text-violet-900 dark:border-violet-800/60 dark:bg-violet-950/40 dark:text-violet-100">
                  {selectedMetric}
                  <button
                    type="button"
                    onClick={() => setSelectedMetric(null)}
                    className="shrink-0 rounded p-0.5 hover:bg-violet-100/80 dark:hover:bg-violet-900/40"
                    aria-label="Remove metric filter"
                  >
                    <XCircle className="h-3.5 w-3.5 text-violet-700/70 dark:text-violet-300/80" />
                  </button>
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setCourseFilter('all');
                setSelectedMetric(null);
              }}
              className="shrink-0 text-sm font-medium text-gray-600 underline-offset-2 transition-colors hover:text-gray-900 hover:underline dark:text-gray-400 dark:hover:text-gray-200"
            >
              Clear all
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
          <div className={viewMode === 'grid' 
            ? "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            : "space-y-3"
          }>
          {filteredData.map((item) => {
            const groupSet = item as GroupSet;
            return (
            <div 
              key={groupSet._id} 
                className={`cursor-pointer overflow-hidden rounded-xl border border-gray-200/90 bg-white shadow-sm transition-shadow duration-200 hover:border-gray-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-900/40 dark:hover:border-gray-600 ${
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
          <div className={viewMode === 'grid' 
            ? "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            : "space-y-3"
          }>
          {filteredData.map((item) => {
            const group = item as Group;
            return (
            <div 
              key={group._id} 
                className={`cursor-pointer overflow-hidden rounded-xl border border-gray-200/90 bg-white shadow-sm transition-shadow duration-200 hover:border-gray-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-900/40 dark:hover:border-gray-600 ${
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
    </SwipeableContainer>
  );
};

export default Groups; 