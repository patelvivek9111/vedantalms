import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api, { getImageUrl } from '../../services/api';
import { API_URL } from '../../config';
import { formatDistanceToNow } from 'date-fns';
import CreateThreadModal from '../CreateThreadModal';
import axios from 'axios';
import CreatePageForm from '../CreatePageForm';
import { ModuleProvider } from '../../contexts/ModuleContext';
import { BookOpen, ChevronDown } from 'lucide-react';

interface Thread {
  _id: string;
  title: string;
  content: string;
  author: {
    _id: string;
    firstName: string;
    lastName: string;
    role: string;
    profilePicture?: string;
    avatarUrl?: string;
  };
  createdAt: string;
  updatedAt: string;
  replyCount: number;
  lastActivity: string;
  isPinned: boolean;
  isGraded: boolean;
  totalPoints: number;
  group: string;
  dueDate: string | null;
  groupSet?: {
    _id: string;
    name: string;
  };
}

interface Module {
  _id: string;
  name: string;
  title: string;
  description?: string;
  courseId: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

const GroupDiscussion: React.FC = () => {
  const navigate = useNavigate();
  const { groupId } = useParams();
  const { user } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [modules, setModules] = useState<Module[]>([]);
  const [groupSetId, setGroupSetId] = useState<string>('');
  const [courseId, setCourseId] = useState<string>('');
  const [courseGroups, setCourseGroups] = useState<{ name: string; weight: number }[]>([]);
  const [groupName, setGroupName] = useState('Group');
  const [groupSetName, setGroupSetName] = useState('Group Set');
  const [groupsInSet, setGroupsInSet] = useState<{ _id: string; name: string }[]>([]);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  
  // Get sidebar toggle from parent GroupDashboard
  const outletContext = useOutletContext<{ setIsMobileMenuOpen?: (open: boolean) => void; isMobileMenuOpen?: boolean }>();
  const setIsMobileMenuOpen = outletContext?.setIsMobileMenuOpen || (() => {});
  const isMobileMenuOpen = outletContext?.isMobileMenuOpen || false;

  const isTeacher = user?.role === 'teacher';
  
  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileDevice(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch group info to get groupSetId and courseId
  useEffect(() => {
    const fetchGroupInfo = async () => {
      if (!groupId) return;
      
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/api/groups/${groupId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data) {
          setGroupSetId(response.data.groupSet);
          setGroupName(response.data.name || 'Group');
          setGroupSetName(response.data.groupSetName || 'Group Set');
          // Handle both string and object for course
          const course = response.data.course;
          setCourseId(typeof course === 'string' ? course : course?._id || '');
        }
      } catch (err) {
        setError('Failed to load group information');
      }
    };

    fetchGroupInfo();
  }, [groupId]);

  // Fetch course groups
  useEffect(() => {
    const fetchCourseGroups = async () => {
      if (!courseId) return;
      
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/api/courses/${courseId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data.success) {
          setCourseGroups(response.data.data.groups || []);
        }
      } catch (err) {
      }
    };

    fetchCourseGroups();
  }, [courseId]);

  // Fetch groups in set for dropdown
  useEffect(() => {
    const fetchGroupsInSet = async () => {
      if (!groupSetId) return;
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/api/groups/sets/${groupSetId}/groups`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setGroupsInSet(res.data || []);
      } catch {
        setGroupsInSet([]);
      }
    };
    fetchGroupsInSet();
  }, [groupSetId]);

  // Fetch modules
  useEffect(() => {
    const fetchModules = async () => {
      if (!courseId) return;
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/api/modules/${courseId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        let modulesArr: Module[] = [];
        if (res.data && Array.isArray(res.data.data)) {
          modulesArr = res.data.data.map((module: any) => ({
            ...module,
            title: module.title // API returns 'title', not 'name'
          }));
        } else if (Array.isArray(res.data)) {
          modulesArr = res.data.map((module: any) => ({
            ...module,
            title: module.title // API returns 'title', not 'name'
          }));
        }
        setModules(modulesArr);
      } catch (err) {
        setModules([]);
      }
    };
    fetchModules();
  }, [courseId]);

  // Fetch threads for this groupset
  useEffect(() => {
    const fetchThreads = async () => {
      if (!groupSetId) return;
      
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const response = await api.get(`/threads/groupset/${groupSetId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data.success) {
          setThreads(response.data.data);
        } else {
          setError('Failed to fetch discussion threads');
        }
      } catch (err) {
        setError('Failed to load discussion threads');
      } finally {
        setLoading(false);
      }
    };

    fetchThreads();
  }, [groupSetId]);

  const handleCreateThread = () => {
    setIsCreateModalOpen(true);
  };

  const handleThreadCreated = (newThread: Thread) => {
    setThreads(prevThreads => [newThread, ...prevThreads]);
  };

  const handleThreadClick = (threadId: string) => {
    if (groupId) {
      navigate(`/groups/${groupId}/discussion/${threadId}`);
    } else {
      alert('Group ID not found. Please contact your administrator.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 dark:border-blue-400"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 dark:text-red-400 text-center p-4">
        {error}
      </div>
    );
  }

  return (
    <div className={`w-full h-full overflow-y-auto ${isMobileDevice ? 'pb-20' : ''}`}>
      {/* Header - Mobile Optimized */}
      <div className={`bg-white dark:bg-gray-800 ${isMobileDevice ? 'p-3 mb-3' : 'p-4 sm:p-6 mb-4 sm:mb-6'} border-b border-gray-200 dark:border-gray-700`}>
        <div className="flex flex-col gap-3">
          <div>
            <h2 className={`${isMobileDevice ? 'text-lg' : 'text-xl sm:text-2xl'} font-bold text-gray-900 dark:text-gray-100`}>
              Group Discussions
            </h2>
            {!isMobileDevice && (
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
                Group-specific discussion threads and conversations
              </p>
            )}
          </div>
          {isTeacher && !isCreateModalOpen && (
            <button
              onClick={handleCreateThread}
              className={`${isMobileDevice ? 'w-full px-4 py-2.5 text-sm' : 'w-full sm:w-auto px-5 py-2.5 text-sm sm:text-base'} bg-gradient-to-r from-blue-600 to-blue-500 dark:from-blue-500 dark:to-blue-600 text-white rounded-lg hover:from-blue-700 hover:to-blue-600 dark:hover:from-blue-600 dark:hover:to-blue-700 transition-all flex items-center justify-center gap-2 font-semibold shadow-md hover:shadow-lg active:scale-95 touch-manipulation`}
            >
              <svg className={`${isMobileDevice ? 'w-4 h-4' : 'w-4 h-4 sm:w-5 sm:h-5'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create New Thread
            </button>
          )}
        </div>
      </div>

      {isTeacher && isCreateModalOpen ? (
        <CreateThreadModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          courseId={courseId}
          onThreadCreated={handleThreadCreated}
          courseGroups={courseGroups}
          modules={modules}
          defaultGroupSetId={groupSetId}
        />
      ) : (
        <div className={`${isMobileDevice ? 'px-0' : 'px-4 sm:px-6'} pb-4 sm:pb-6`}>

          {threads.length === 0 ? (
          <div className={`text-center ${isMobileDevice ? 'py-12 px-4' : 'py-16'} bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600`}>
            <div className={`mx-auto ${isMobileDevice ? 'w-12 h-12' : 'w-16 h-16'} bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4`}>
              <svg className={`${isMobileDevice ? 'h-6 w-6' : 'h-8 w-8'} text-blue-600 dark:text-blue-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className={`${isMobileDevice ? 'text-base' : 'text-lg'} font-bold text-gray-900 dark:text-gray-100 mb-2`}>No group discussion threads</h3>
            <p className={`${isMobileDevice ? 'text-xs' : 'text-sm'} text-gray-600 dark:text-gray-400 ${isMobileDevice ? 'px-2' : 'max-w-md'} mx-auto`}>
              {isTeacher 
                ? "Get started by creating a new discussion thread for this group."
                : "There are no discussion threads yet for this group. Teachers will create threads here."}
            </p>
            {isTeacher && (
              <div className={`${isMobileDevice ? 'mt-4' : 'mt-6'}`}>
                <button
                  onClick={handleCreateThread}
                  className={`inline-flex items-center ${isMobileDevice ? 'px-4 py-2 text-sm' : 'px-5 py-2.5'} bg-gradient-to-r from-blue-600 to-blue-500 dark:from-blue-500 dark:to-blue-600 text-white rounded-lg font-semibold shadow-md hover:shadow-lg hover:from-blue-700 hover:to-blue-600 dark:hover:from-blue-600 dark:hover:to-blue-700 transition-all active:scale-95 touch-manipulation`}
                >
                  <svg className={`${isMobileDevice ? '-ml-1 mr-2 h-4 w-4' : '-ml-1 mr-2 h-5 w-5'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create Thread
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Pinned threads */}
            {threads.filter(thread => thread.isPinned).length > 0 && (
              <div className={`${isMobileDevice ? 'mb-4' : 'mb-6'}`}>
                <div className={`flex items-center gap-2 ${isMobileDevice ? 'mb-3 px-4' : 'mb-4'}`}>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent"></div>
                  <h3 className={`${isMobileDevice ? 'text-xs' : 'text-sm'} font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide px-3`}>Pinned Threads</h3>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent"></div>
                </div>
                <div className={`${isMobileDevice ? 'space-y-3 px-4' : 'space-y-4'}`}>
                  {threads
                    .filter(thread => thread.isPinned)
                    .map((thread) => (
                      <div
                        key={thread._id}
                        onClick={() => handleThreadClick(thread._id)}
                        className={`${isMobileDevice ? 'p-3' : 'p-5'} bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/50 border-2 border-yellow-300 dark:border-yellow-700 rounded-xl hover:shadow-xl transition-all cursor-pointer relative hover:border-yellow-400 dark:hover:border-yellow-600 active:scale-[0.98] group touch-manipulation`}
                      >
                        <div className={`absolute ${isMobileDevice ? 'top-2 right-2' : 'top-3 right-3'} text-yellow-500 dark:text-yellow-400 group-hover:scale-110 transition-transform`}>
                          <svg className={`${isMobileDevice ? 'w-4 h-4' : 'w-5 h-5'}`} fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 4.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V4.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.616a1 1 0 01.894-1.79l1.599.8L9 4.323V3a1 1 0 011-1z" />
                          </svg>
                        </div>
                        <div className={`${isMobileDevice ? 'flex flex-col gap-2 pr-8' : 'flex justify-between items-start'}`}>
                          <div className="flex-1 min-w-0">
                            <h3 className={`${isMobileDevice ? 'text-base pr-6' : 'text-lg'} font-bold text-gray-900 dark:text-gray-100 ${isMobileDevice ? 'mb-1' : 'mb-2'} group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors break-words`}>
                              {thread.title}
                              {thread.isGraded && (
                                <span className={`ml-2 ${isMobileDevice ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'} font-semibold bg-gradient-to-r from-green-100 to-green-50 dark:from-green-900/50 dark:to-green-800/50 text-green-800 dark:text-green-300 rounded-full shadow-sm inline-block`}>
                                  Graded ({thread.totalPoints} pts)
                                </span>
                              )}
                            </h3>
                            <div className={`${isMobileDevice ? 'flex flex-col gap-1.5' : 'flex items-center'} ${isMobileDevice ? 'text-xs' : 'text-sm'} text-gray-600 dark:text-gray-400 ${isMobileDevice ? '' : 'space-x-4'}`}>
                              <div className="flex items-center space-x-2">
                                <div className="relative flex-shrink-0">
                                  {thread.author.profilePicture || thread.author.avatarUrl ? (
                                    <img
                                      src={
                                        thread.author.profilePicture
                                          ? (thread.author.profilePicture.startsWith('http')
                                              ? thread.author.profilePicture
                                              : getImageUrl(thread.author.profilePicture))
                                          : thread.author.avatarUrl
                                          ? (thread.author.avatarUrl.startsWith('http')
                                              ? thread.author.avatarUrl
                                              : getImageUrl(thread.author.avatarUrl))
                                          : '/default-avatar.png'
                                      }
                                      alt={`${thread.author.firstName} ${thread.author.lastName}`}
                                      className={`${isMobileDevice ? 'w-6 h-6' : 'w-8 h-8'} rounded-full object-cover border-2 border-gray-200 dark:border-gray-700`}
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                        if (fallback) {
                                          fallback.style.display = 'flex';
                                        }
                                      }}
                                    />
                                  ) : null}
                                  {/* Fallback avatar with initials */}
                                  <div
                                    className={`${isMobileDevice ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs'} bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold ${
                                      thread.author.profilePicture || thread.author.avatarUrl ? 'hidden' : 'flex'
                                    }`}
                                    style={{
                                      display: thread.author.profilePicture || thread.author.avatarUrl ? 'none' : 'flex'
                                    }}
                                  >
                                    {thread.author.firstName?.charAt(0) || ''}
                                    {thread.author.lastName?.charAt(0) || ''}
                                  </div>
                                </div>
                                <span className="truncate">
                                  {thread.author.firstName} {thread.author.lastName}
                                  <span className={`ml-1 ${isMobileDevice ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'} font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 rounded-full`}>
                                    {thread.author.role}
                                  </span>
                                </span>
                              </div>
                              {!isMobileDevice && (
                                <>
                              <span className="text-gray-400 dark:text-gray-500">•</span>
                              <span title={new Date(thread.createdAt).toLocaleString()}>
                                {formatDistanceToNow(new Date(thread.createdAt), { addSuffix: true })}
                              </span>
                              {thread.dueDate && (
                                <>
                                  <span className="text-gray-400 dark:text-gray-500">•</span>
                                  <span className="text-orange-600 dark:text-orange-400">
                                    Due {formatDistanceToNow(new Date(thread.dueDate), { addSuffix: true })}
                                  </span>
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                            {isMobileDevice && (
                              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                                <span title={new Date(thread.createdAt).toLocaleString()}>
                                  {formatDistanceToNow(new Date(thread.createdAt), { addSuffix: true })}
                                </span>
                                {thread.dueDate && (
                                  <>
                                    <span>•</span>
                                    <span className="text-orange-600 dark:text-orange-400">
                                      Due {formatDistanceToNow(new Date(thread.dueDate), { addSuffix: true })}
                                    </span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                          <div className={`${isMobileDevice ? 'flex items-center justify-between w-full pt-1 border-t border-gray-200 dark:border-gray-700' : 'flex items-center space-x-4'}`}>
                            <div className="flex items-center text-gray-600 dark:text-gray-400">
                              <svg className={`${isMobileDevice ? 'w-3.5 h-3.5 mr-1' : 'w-4 h-4 mr-1'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                              <span className={isMobileDevice ? 'text-xs' : ''}>{thread.replyCount} {thread.replyCount === 1 ? 'reply' : 'replies'}</span>
                            </div>
                            {!isMobileDevice && (
                              <div className="text-gray-500 dark:text-gray-400 text-sm" title={new Date(thread.lastActivity).toLocaleString()}>
                              Last activity {formatDistanceToNow(new Date(thread.lastActivity), { addSuffix: true })}
                            </div>
                            )}
                            {isMobileDevice && (
                              <div className="text-gray-500 dark:text-gray-400 text-xs" title={new Date(thread.lastActivity).toLocaleString()}>
                                {formatDistanceToNow(new Date(thread.lastActivity), { addSuffix: true })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Regular threads */}
            {threads.filter(thread => !thread.isPinned).length > 0 && (
              <div>
                <div className={`flex items-center gap-2 ${isMobileDevice ? 'mb-3 px-4' : 'mb-4'}`}>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent"></div>
                  <h3 className={`${isMobileDevice ? 'text-xs' : 'text-sm'} font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide px-3`}>All Threads</h3>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent"></div>
                </div>
                <div className={`${isMobileDevice ? 'space-y-3 px-4' : 'space-y-4'}`}>
                  {threads
                    .filter(thread => !thread.isPinned)
                    .map((thread) => (
                      <div
                        key={thread._id}
                        onClick={() => handleThreadClick(thread._id)}
                        className={`${isMobileDevice ? 'p-3' : 'p-5'} bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-xl transition-all cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 active:scale-[0.98] group touch-manipulation`}
                      >
                        <div className={`${isMobileDevice ? 'flex flex-col gap-2' : 'flex justify-between items-start'}`}>
                          <div className="flex-1 min-w-0">
                            <h3 className={`${isMobileDevice ? 'text-base' : 'text-lg'} font-bold text-gray-900 dark:text-gray-100 ${isMobileDevice ? 'mb-1' : 'mb-2'} break-words`}>
                              {thread.title}
                              {thread.isGraded && (
                                <span className={`ml-2 ${isMobileDevice ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'} font-semibold bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 rounded-full shadow-sm inline-block`}>
                                  Graded ({thread.totalPoints} pts)
                                </span>
                              )}
                            </h3>
                            <div className={`${isMobileDevice ? 'flex flex-col gap-1.5' : 'flex items-center'} ${isMobileDevice ? 'text-xs' : 'text-sm'} text-gray-600 dark:text-gray-400 ${isMobileDevice ? '' : 'space-x-4'}`}>
                              <div className="flex items-center space-x-2">
                                <div className="relative flex-shrink-0">
                                  {thread.author.profilePicture || thread.author.avatarUrl ? (
                                    <img
                                      src={
                                        thread.author.profilePicture
                                          ? (thread.author.profilePicture.startsWith('http')
                                              ? thread.author.profilePicture
                                              : getImageUrl(thread.author.profilePicture))
                                          : thread.author.avatarUrl
                                          ? (thread.author.avatarUrl.startsWith('http')
                                              ? thread.author.avatarUrl
                                              : getImageUrl(thread.author.avatarUrl))
                                          : '/default-avatar.png'
                                      }
                                      alt={`${thread.author.firstName} ${thread.author.lastName}`}
                                      className={`${isMobileDevice ? 'w-6 h-6' : 'w-8 h-8'} rounded-full object-cover border-2 border-gray-200 dark:border-gray-700`}
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                        if (fallback) {
                                          fallback.style.display = 'flex';
                                        }
                                      }}
                                    />
                                  ) : null}
                                  {/* Fallback avatar with initials */}
                                  <div
                                    className={`${isMobileDevice ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs'} bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold ${
                                      thread.author.profilePicture || thread.author.avatarUrl ? 'hidden' : 'flex'
                                    }`}
                                    style={{
                                      display: thread.author.profilePicture || thread.author.avatarUrl ? 'none' : 'flex'
                                    }}
                                  >
                                    {thread.author.firstName?.charAt(0) || ''}
                                    {thread.author.lastName?.charAt(0) || ''}
                                  </div>
                                </div>
                                <span className="truncate">
                                  {thread.author.firstName} {thread.author.lastName}
                                  <span className={`ml-1 ${isMobileDevice ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'} font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 rounded-full`}>
                                    {thread.author.role}
                                  </span>
                                </span>
                              </div>
                              {!isMobileDevice && (
                                <>
                              <span className="text-gray-400 dark:text-gray-500">•</span>
                              <span title={new Date(thread.createdAt).toLocaleString()}>
                                {formatDistanceToNow(new Date(thread.createdAt), { addSuffix: true })}
                              </span>
                              {thread.dueDate && (
                                <>
                                  <span className="text-gray-400 dark:text-gray-500">•</span>
                                  <span className="text-orange-600 dark:text-orange-400">
                                    Due {formatDistanceToNow(new Date(thread.dueDate), { addSuffix: true })}
                                  </span>
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                            {isMobileDevice && (
                              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                                <span title={new Date(thread.createdAt).toLocaleString()}>
                                  {formatDistanceToNow(new Date(thread.createdAt), { addSuffix: true })}
                                </span>
                                {thread.dueDate && (
                                  <>
                                    <span>•</span>
                                    <span className="text-orange-600 dark:text-orange-400">
                                      Due {formatDistanceToNow(new Date(thread.dueDate), { addSuffix: true })}
                                    </span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                          <div className={`${isMobileDevice ? 'flex items-center justify-between w-full pt-1 border-t border-gray-200 dark:border-gray-700' : 'flex items-center space-x-4'}`}>
                            <div className="flex items-center text-gray-600 dark:text-gray-400">
                              <svg className={`${isMobileDevice ? 'w-3.5 h-3.5 mr-1' : 'w-4 h-4 mr-1'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                              <span className={isMobileDevice ? 'text-xs' : ''}>{thread.replyCount} {thread.replyCount === 1 ? 'reply' : 'replies'}</span>
                            </div>
                            {!isMobileDevice && (
                              <div className="text-gray-500 dark:text-gray-400 text-sm" title={new Date(thread.lastActivity).toLocaleString()}>
                              Last activity {formatDistanceToNow(new Date(thread.lastActivity), { addSuffix: true })}
                            </div>
                            )}
                            {isMobileDevice && (
                              <div className="text-gray-500 dark:text-gray-400 text-xs" title={new Date(thread.lastActivity).toLocaleString()}>
                                {formatDistanceToNow(new Date(thread.lastActivity), { addSuffix: true })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GroupDiscussion; 