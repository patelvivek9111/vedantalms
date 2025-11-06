import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api, { getImageUrl } from '../../services/api';
import { API_URL } from '../../config';
import { formatDistanceToNow } from 'date-fns';
import CreateThreadModal from '../CreateThreadModal';
import axios from 'axios';
import CreatePageForm from '../CreatePageForm';
import { ModuleProvider } from '../../contexts/ModuleContext';

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

  const isTeacher = user?.role === 'teacher';

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
          // Handle both string and object for course
          const course = response.data.course;
          setCourseId(typeof course === 'string' ? course : course?._id || '');
        }
      } catch (err) {
        console.error('Error fetching group info:', err);
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
        console.error('Error fetching course groups:', err);
      }
    };

    fetchCourseGroups();
  }, [courseId]);

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
        console.error('Error fetching threads:', err);
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
      console.error('Group ID not found. Cannot navigate to thread.');
      alert('Group ID not found. Please contact your administrator.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-center p-4">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Group Discussions</h2>
            <p className="text-gray-600 mt-1">Group-specific discussion threads and conversations</p>
          </div>
          {isTeacher && (
            <button
              onClick={handleCreateThread}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create New Thread
            </button>
          )}
        </div>

        {threads.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No group discussion threads</h3>
            <p className="mt-1 text-sm text-gray-500">
              {isTeacher 
                ? "Get started by creating a new discussion thread for this group."
                : "There are no discussion threads yet for this group. Teachers will create threads here."}
            </p>
            {isTeacher && (
              <div className="mt-6">
                <button
                  onClick={handleCreateThread}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-500 mb-3">Pinned Threads</h3>
                <div className="space-y-4">
                  {threads
                    .filter(thread => thread.isPinned)
                    .map((thread) => (
                      <div
                        key={thread._id}
                        onClick={() => handleThreadClick(thread._id)}
                        className="p-4 bg-white border border-yellow-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer relative"
                      >
                        <div className="absolute top-2 right-2 text-yellow-500">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 4.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V4.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.616a1 1 0 01.894-1.79l1.599.8L9 4.323V3a1 1 0 011-1z" />
                          </svg>
                        </div>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-800 mb-1">
                              {thread.title}
                              {thread.isGraded && (
                                <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                                  Graded ({thread.totalPoints} points)
                                </span>
                              )}
                            </h3>
                            <div className="flex items-center text-sm text-gray-600 space-x-4">
                              <div className="flex items-center space-x-2">
                                <div className="relative">
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
                                      className="w-8 h-8 rounded-full object-cover border-2 border-gray-200"
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
                                    className={`w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold ${
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
                                <span>
                                  Posted by {thread.author.firstName} {thread.author.lastName}
                                  <span className="ml-1 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                                    {thread.author.role}
                                  </span>
                                </span>
                              </div>
                              <span>•</span>
                              <span title={new Date(thread.createdAt).toLocaleString()}>
                                {formatDistanceToNow(new Date(thread.createdAt), { addSuffix: true })}
                              </span>
                              {thread.dueDate && (
                                <>
                                  <span>•</span>
                                  <span className="text-orange-600">
                                    Due {formatDistanceToNow(new Date(thread.dueDate), { addSuffix: true })}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center">
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                              {thread.replyCount} {thread.replyCount === 1 ? 'reply' : 'replies'}
                            </div>
                            <div className="text-gray-500" title={new Date(thread.lastActivity).toLocaleString()}>
                              Last activity {formatDistanceToNow(new Date(thread.lastActivity), { addSuffix: true })}
                            </div>
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
                <h3 className="text-sm font-medium text-gray-500 mb-3">All Threads</h3>
                <div className="space-y-4">
                  {threads
                    .filter(thread => !thread.isPinned)
                    .map((thread) => (
                      <div
                        key={thread._id}
                        onClick={() => handleThreadClick(thread._id)}
                        className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-800 mb-1">
                              {thread.title}
                              {thread.isGraded && (
                                <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                                  Graded ({thread.totalPoints} points)
                                </span>
                              )}
                            </h3>
                            <div className="flex items-center text-sm text-gray-600 space-x-4">
                              <div className="flex items-center space-x-2">
                                <div className="relative">
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
                                      className="w-8 h-8 rounded-full object-cover border-2 border-gray-200"
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
                                    className={`w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold ${
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
                                <span>
                                  Posted by {thread.author.firstName} {thread.author.lastName}
                                  <span className="ml-1 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                                    {thread.author.role}
                                  </span>
                                </span>
                              </div>
                              <span>•</span>
                              <span title={new Date(thread.createdAt).toLocaleString()}>
                                {formatDistanceToNow(new Date(thread.createdAt), { addSuffix: true })}
                              </span>
                              {thread.dueDate && (
                                <>
                                  <span>•</span>
                                  <span className="text-orange-600">
                                    Due {formatDistanceToNow(new Date(thread.dueDate), { addSuffix: true })}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center">
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                              {thread.replyCount} {thread.replyCount === 1 ? 'reply' : 'replies'}
                            </div>
                            <div className="text-gray-500" title={new Date(thread.lastActivity).toLocaleString()}>
                              Last activity {formatDistanceToNow(new Date(thread.lastActivity), { addSuffix: true })}
                            </div>
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

      {isTeacher && (
        <CreateThreadModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          courseId={courseId}
          onThreadCreated={handleThreadCreated}
          courseGroups={courseGroups}
          modules={modules}
          defaultGroupSetId={groupSetId}
        />
      )}
    </div>
  );
};

export default GroupDiscussion; 