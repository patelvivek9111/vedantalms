import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchConversations, fetchMessages, sendMessage, createConversation, searchUsers, toggleStar, moveConversation, bulkMoveConversations, bulkDeleteForever } from '../services/inboxService';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import api from '../services/api';
import { getImageUrl, getUserPreferences } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Plus, Reply, Archive, Trash2, Search, ChevronLeft, CheckSquare, Paperclip, CheckSquare2, Menu, Folder, Settings, HelpCircle, User as UserIcon, LogOut, Mail, Star, Inbox as InboxIcon, Send, FolderArchive, Heart, Filter } from 'lucide-react';
import RichTextEditor from '../components/RichTextEditor';
import { ChangeUserModal } from '../components/ChangeUserModal';

function capitalizeFirst(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const getInitials = (user: any) => {
  if (!user) return '?';
  if (user.firstName && user.lastName) return (user.firstName[0] + user.lastName[0]).toUpperCase();
  if (user.firstName) return user.firstName[0].toUpperCase();
  if (user.lastName) return user.lastName[0].toUpperCase();
  if (user.email) return user.email[0].toUpperCase();
  return '?';
};

const getAvatarColor = (id: string) => {
  // Simple hash to pick a color
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-pink-500', 'bg-yellow-500', 'bg-purple-500', 'bg-indigo-500', 'bg-red-500', 'bg-teal-500', 'bg-orange-500', 'bg-gray-500'
  ];
  let hash = 0;
  for (let i = 0; i < (id || '').length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return colors[Math.abs(hash) % colors.length];
};

/**
 * Determine if a user is online based on their lastLogin timestamp
 * Considered online if they logged in within the last 1 minute
 * Only shows online status if user has showOnlineStatus enabled
 * For current user, checks their own showOnlineStatus preference
 */
const isUserOnline = (user: any, currentUserId?: string, currentUserShowOnlineStatus?: boolean): boolean => {
  if (!user) return false;
  
  const isCurrentUser = currentUserId && user._id && user._id.toString() === currentUserId.toString();
  
  // For current user, check their own preference
  if (isCurrentUser) {
    // If current user has disabled showing online status, don't show it
    if (currentUserShowOnlineStatus === false) {
      return false;
    }
    // If enabled, current user is always considered online (they're actively using the app)
    return true;
  }
  
  // For other users, check if they have enabled showing their online status
  if (user.showOnlineStatus === false) {
    return false;
  }
  
  // If no lastLogin, assume offline
  if (!user.lastLogin) return false;
  
  try {
    const lastLogin = new Date(user.lastLogin);
    const now = new Date();
    const minutesSinceLogin = (now.getTime() - lastLogin.getTime()) / (1000 * 60);
    
    // Consider online if logged in within last 1 minute
    return minutesSinceLogin <= 1;
  } catch (error) {
    return false;
  }
};

const Inbox: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserShowOnlineStatus, setCurrentUserShowOnlineStatus] = useState<boolean>(true);
  const [selectedConversation, setSelectedConversation] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showBurgerMenu, setShowBurgerMenu] = useState(false);
  const [showChangeUserModal, setShowChangeUserModal] = useState(false);

  // Compose modal state
  const [showCompose, setShowCompose] = useState(false);
  const [composeRecipients, setComposeRecipients] = useState<any[]>([]);
  const [composeQuery, setComposeQuery] = useState('');
  const [composeUserResults, setComposeUserResults] = useState<any[]>([]);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeLoading, setComposeLoading] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [composeCourse, setComposeCourse] = useState<string>('');
  const [composeCourseOptions, setComposeCourseOptions] = useState<any[]>([]);
  const [composeToDropdown, setComposeToDropdown] = useState(false);
  const [composeToGroup, setComposeToGroup] = useState<string>('');
  const [composeGroupUsers, setComposeGroupUsers] = useState<any[]>([]);
  const composeToDropdownRef = useRef<HTMLDivElement>(null);
  const [composeToInput, setComposeToInput] = useState('');
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Add state for send individually checkbox
  const [sendIndividually, setSendIndividually] = useState(false);
  // Add state for selected conversations
  const [selectedConversations, setSelectedConversations] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  // 2. Add showReplyBox state
  const [showReplyBox, setShowReplyBox] = useState(false);

  // Dummy course options for now
  const [courseOptions, setCourseOptions] = useState([{ value: 'all', label: 'All Courses' }]);
  const [selectedCourse, setSelectedCourse] = useState('all');
  const folderOptions = [
    { value: 'inbox', label: 'Inbox' },
    { value: 'sent', label: 'Sent' },
    { value: 'archived', label: 'Archived' },
    { value: 'favorite', label: 'Favorite' },
    { value: 'deleted', label: 'Deleted' },
  ];
  const [selectedFolder, setSelectedFolder] = useState('inbox');
  const [search, setSearch] = useState('');

  // Use the logged-in user's ID from AuthContext
  const currentUserId = user?._id || '';

  const searchInputRef = useRef<HTMLInputElement>(null);
  // Add a ref for the reply textarea
  const replyInputRef = useRef<HTMLTextAreaElement>(null);

  // Icon click handlers
  const handleReply = () => {
    if (selectedConversations.length === 0) {
      alert('Please select conversations to reply to');
      return;
    }
    // For now, just show an alert - you can implement reply functionality later
    alert(`Reply to ${selectedConversations.length} conversation(s)`);
  };

  const handleArchive = async () => {
    if (selectedConversations.length === 0) {
      alert('Please select conversations to archive');
      return;
    }
    
    setBulkActionLoading(true);
    try {
      await bulkMoveConversations(selectedConversations, 'archived');
      // Refresh conversations
      const data = await fetchConversations();
      setConversations(data);
      setSelectedConversations([]);
    } catch (err) {
      alert('Failed to archive conversations');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (selectedConversations.length === 0) {
      alert('Please select conversations to delete');
      return;
    }
    if (selectedFolder === 'deleted') {
      if (!confirm(`Are you sure you want to permanently delete ${selectedConversations.length} conversation(s)? This cannot be undone.`)) {
        return;
      }
    } else {
      if (!confirm(`Are you sure you want to delete ${selectedConversations.length} conversation(s)?`)) {
        return;
      }
    }
    setBulkActionLoading(true);
    try {
      if (selectedFolder === 'deleted') {
        await bulkDeleteForever(selectedConversations);
      } else {
        await bulkMoveConversations(selectedConversations, 'deleted');
      }
      // Refresh conversations
      const data = await fetchConversations();
      setConversations(data);
      setSelectedConversations([]);
    } catch (err) {
      alert('Failed to delete conversations');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleDeleteForever = async () => {
    if (selectedConversations.length === 0) {
      alert('Please select conversations to permanently delete');
      return;
    }
    if (!confirm(`Are you sure you want to permanently delete ${selectedConversations.length} conversation(s)? This cannot be undone.`)) {
      return;
    }
    setBulkActionLoading(true);
    try {
      await bulkDeleteForever(selectedConversations);
      // Refresh conversations
      const data = await fetchConversations();
      setConversations(data);
      setSelectedConversations([]);
    } catch (err) {
      alert('Failed to permanently delete conversations');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Load current user's preferences
  useEffect(() => {
    const loadUserPreferences = async () => {
      try {
        const response = await getUserPreferences();
        if (response.data && response.data.preferences) {
          setCurrentUserShowOnlineStatus(
            response.data.preferences.showOnlineStatus !== undefined 
              ? response.data.preferences.showOnlineStatus 
              : true
          );
        }
      } catch (err) {
        // Default to true if fetch fails
        setCurrentUserShowOnlineStatus(true);
      }
    };
    if (user?._id) {
      loadUserPreferences();
    }
  }, [user?._id]);

  useEffect(() => {
    const loadConversations = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchConversations();
        setConversations(data);
      } catch (err: any) {
        setError('Failed to load conversations');
      } finally {
        setLoading(false);
      }
    };
    loadConversations();
  }, []);

  // 1. In handleSelectConversation, mark as read if unreadCount > 0
  const handleSelectConversation = async (conv: any) => {
    setSelectedConversation(conv);
    setMessages([]);
    setMessagesLoading(true);
    setMessagesError(null);
    try {
      // Mark as read if there are unread messages
      if (conv.unreadCount > 0) {
        await api.post(`/inbox/conversations/${conv._id}/read`);
        // Update local state to set unreadCount to 0 for this conversation
        setConversations(prev => prev.map(c =>
          c._id === conv._id ? { ...c, unreadCount: 0 } : c
        ));
        // Dispatch event to update sidebar unread count
        window.dispatchEvent(new CustomEvent('inboxMessageRead'));
      }
      const msgs = await fetchMessages(conv._id);
      setMessages(msgs);
    } catch (err) {
      setMessagesError('Failed to load messages');
    } finally {
      setMessagesLoading(false);
    }
  };

  // 3. Only render the reply box if showReplyBox is true
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim() || !selectedConversation) return;
    setSending(true);
    setSendError(null);
    try {
      await sendMessage(selectedConversation._id, reply);
      setReply('');
      setShowReplyBox(false);
      // Refresh messages
      const msgs = await fetchMessages(selectedConversation._id);
      setMessages(msgs);
    } catch (err) {
      setSendError('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Compose modal logic
  useEffect(() => {
    if (composeQuery.length < 2) {
      setComposeUserResults([]);
      return;
    }
    let active = true;
    setComposeError(null);
    searchUsers(composeQuery)
      .then(users => {
        if (active) setComposeUserResults(users);
      })
      .catch(() => {
        if (active) setComposeError('Failed to search users');
      });
    return () => { active = false; };
  }, [composeQuery]);

  const handleAddRecipient = (user: any) => {
    if (!composeRecipients.some((u) => u._id === user._id)) {
      setComposeRecipients([...composeRecipients, user]);
    }
    setComposeQuery('');
    setComposeUserResults([]);
  };

  const handleRemoveRecipient = (userId: string) => {
    setComposeRecipients(composeRecipients.filter((u) => u._id !== userId));
  };

  const handleCompose = async (e: React.FormEvent) => {
    e.preventDefault();
    setComposeLoading(true);
    setComposeError('');
    try {
      let recipients = composeRecipients.map(u => u._id);
      if (composeToGroup === 'sections') {
        // Fetch all students for the course
        const res = await api.get(`/courses/${composeCourse}/students`);
        recipients = res.data.map((u: any) => u._id);
      }
      // For admins, course can be empty/null
      await api.post('/inbox/conversations', {
        course: user?.role === 'admin' ? null : composeCourse,
        participantIds: recipients,
        subject: composeSubject,
        body: composeBody,
        sendIndividually, // <-- add this field
      });
      setShowCompose(false);
      setComposeRecipients([]);
      setComposeSubject('');
      setComposeBody('');
      setComposeToGroup('');
      setComposeGroupUsers([]);
      setComposeCourse('');
      setSendIndividually(false); // reset
    } catch (err: any) {
      setComposeError(err.response?.data?.message || 'Failed to send message');
    } finally {
      setComposeLoading(false);
    }
  };

  // Fetch courses for compose dropdown
  useEffect(() => {
    if (!showCompose) return;
    api.get('/courses').then(res => {
      setComposeCourseOptions(res.data.data || []);
      if (res.data.data && res.data.data.length > 0) {
        setComposeCourse(res.data.data[0]._id);
      }
    });
  }, [showCompose]);

  // Fetch group users when group or course changes
  useEffect(() => {
    if (!composeToGroup) return;
    
    if (user?.role === 'admin') {
      // Admin can fetch all users without course requirement
      if (composeToGroup === 'teachers') {
        api.get('/users/search?role=teacher,admin').then(res => {
          setComposeGroupUsers(res.data.data || []);
        });
      } else if (composeToGroup === 'students') {
        api.get('/users/search?role=student').then(res => {
          setComposeGroupUsers(res.data.data || []);
        });
      } else if (composeToGroup === 'admins') {
        api.get('/users/search?role=admin').then(res => {
          setComposeGroupUsers(res.data.data || []);
        });
      }
    } else {
      // Non-admin users require course
      if (!composeCourse) return;
      if (composeToGroup === 'teachers') {
        if (user?.role === 'teacher' || user?.role === 'admin') {
          // Teachers/Admins see all teachers and admins
          api.get('/users/search?role=teacher,admin').then(res => {
            setComposeGroupUsers(res.data.data || []);
          });
        } else {
          // Students see only their course's instructor/admins
          api.get(`/courses/${composeCourse}`).then(res => {
            const instructor = res.data.data.instructor ? [res.data.data.instructor] : [];
            // If course has admins assigned, add them here as well (extend as needed)
            setComposeGroupUsers(instructor);
          });
        }
      } else if (composeToGroup === 'students') {
        api.get(`/courses/${composeCourse}/students`).then(res => {
          setComposeGroupUsers(res.data || []);
        });
      } else if (composeToGroup === 'sections') {
        setComposeGroupUsers([]);
      }
    }
  }, [composeCourse, composeToGroup, user]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!composeToDropdown) return;
    function handleClick(e: MouseEvent) {
      if (composeToDropdownRef.current && !composeToDropdownRef.current.contains(e.target as Node)) {
        setComposeToDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [composeToDropdown]);

  // Search users as user types in To field
  useEffect(() => {
    if (composeToInput.length < 2) {
      setComposeUserResults([]);
      return;
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      // If admin, search all users without role filter (unless group is selected)
      // Otherwise, use role filter based on group selection
      let roleParam = '';
      if (user?.role === 'admin') {
        // Admin can search all users, but respect group selection if set
        if (composeToGroup === 'teachers') {
          roleParam = 'teacher,admin';
        } else if (composeToGroup === 'students') {
          roleParam = 'student';
        }
        // If no group selected, search all users (no role filter)
      } else {
        // Non-admin users use existing logic
        if (composeToGroup === 'teachers') {
          roleParam = user?.role === 'teacher' || user?.role === 'admin' ? 'teacher,admin' : 'teacher';
        } else if (composeToGroup === 'students') {
          roleParam = 'student';
        }
      }
      
      // Build search URL - if admin and no role filter, search without role param
      const searchUrl = roleParam 
        ? `/users/search?name=${encodeURIComponent(composeToInput)}&email=${encodeURIComponent(composeToInput)}&role=${roleParam}`
        : `/users/search?name=${encodeURIComponent(composeToInput)}&email=${encodeURIComponent(composeToInput)}`;
      
      api.get(searchUrl)
        .then(res => setComposeUserResults(res.data.data || []))
        .catch(() => setComposeUserResults([]));
    }, 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [composeToInput, composeToGroup, user]);

  // Fetch user-specific courses for the main dropdown - Skip for admins
  useEffect(() => {
    if (user?.role === 'admin') {
      // Admins don't need course options
      return;
    }
    api.get('/courses').then(res => {
      const userCourses = (res.data.data || []).map((c: any) => ({ 
        value: c._id, 
        label: c.catalog?.courseCode || c.title 
      }));
      setCourseOptions([{ value: 'all', label: 'All Courses' }, ...userCourses]);
    });
  }, [user]);

  // Memoize filteredConversations to prevent infinite loops
  const filteredConversations = useMemo(() => {
    return conversations.filter(conv => {
      // Course filter - Skip for admins
      if (user?.role !== 'admin' && selectedCourse !== 'all' && conv.course !== selectedCourse) return false;
      // Folder filter (find participant for current user)
      const participant = conv.participants.find((p: any) => p._id === currentUserId);
      const folder = participant?.folder || conv.folder || 'inbox';
      
      // Show conversations based on selected folder
      if (selectedFolder === 'inbox' && folder !== 'inbox') return false;
      if (selectedFolder === 'sent') {
        if (conv.createdBy !== currentUserId) return false;
      }
      if (selectedFolder === 'archived' && folder !== 'archived') return false;
      if (selectedFolder === 'favorite' && !participant?.starred) return false;
      if (selectedFolder === 'deleted' && folder !== 'deleted') return false;
      
      // Search filter
      const searchLower = search.toLowerCase();
      if (searchLower) {
        const subject = conv.subject?.toLowerCase() || '';
        const snippet = conv.lastMessage?.body?.toLowerCase() || '';
        const senders = conv.participants.map((p: any) => (p.name || `${p.firstName || ''} ${p.lastName || ''}`)).join(', ').toLowerCase();
        if (!subject.includes(searchLower) && !snippet.includes(searchLower) && !senders.includes(searchLower)) {
          return false;
        }
      }
      return true;
    });
  }, [conversations, selectedCourse, selectedFolder, search, currentUserId, user]);

  useEffect(() => {
    setSelectedConversations(prev =>
      prev.filter(id => filteredConversations.some(conv => conv._id === id))
    );
  }, [filteredConversations]);

  // Group filtered conversations by date
  const grouped = groupConversationsByDate(filteredConversations);
  const dateKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  // Star toggling
  const handleToggleStar = async (conv: any) => {
    try {
      await toggleStar(conv._id);
      // Refresh conversations
      const data = await fetchConversations();
      setConversations(data);
    } catch (err) {
      // Optionally show error
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[80vh] bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Top Navigation Bar (Mobile Only) */}
      <nav className="lg:hidden fixed top-0 left-0 right-0 z-[150] bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="relative flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setShowBurgerMenu(!showBurgerMenu)}
            className="text-gray-700 dark:text-gray-300 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Inbox</h1>
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
      
      {/* Top Bar */}
      <div className="flex flex-col gap-3 px-3 sm:px-4 lg:px-6 py-3 sm:py-4 border-b bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-gray-200/50 dark:border-gray-700/50 shadow-sm sticky top-0 lg:sticky z-20 pt-20 lg:pt-3">
        {/* First Row: Dropdowns */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Course Dropdown - Hide for admins */}
          {user?.role !== 'admin' && (
            <div className="relative flex-1 min-w-[120px]">
              <select
                id="topbar-course-dropdown"
                name="topbarCourseDropdown"
                className="appearance-none border border-gray-200 dark:border-gray-700 rounded px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm bg-white dark:bg-gray-900 pr-7 sm:pr-8 focus:outline-none focus:ring-2 focus:ring-blue-200 w-full"
                value={selectedCourse}
                onChange={e => setSelectedCourse(e.target.value)}
              >
                {courseOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                ▼
              </span>
            </div>
          )}
          {/* Folder Dropdown */}
          <div className="relative flex-1 min-w-[100px]">
            <select
              id="topbar-folder-dropdown"
              name="topbarFolderDropdown"
              className="appearance-none border border-gray-200 dark:border-gray-700 rounded px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm bg-white dark:bg-gray-900 pr-7 sm:pr-8 focus:outline-none focus:ring-2 focus:ring-blue-200 w-full"
              value={selectedFolder}
              onChange={e => setSelectedFolder(e.target.value)}
            >
              {folderOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
              ▼
            </span>
          </div>
        </div>
        {/* Second Row: Action Icons and Search */}
        <div className="flex items-center gap-2">
          {/* Icon Row */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Compose (modern icon) */}
            <button
              className="p-2 sm:p-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-md hover:shadow-lg transition-all duration-200 touch-manipulation flex items-center justify-center"
              title="Compose"
              onClick={() => setShowCompose(true)}
            >
              <Plus size={20} className="sm:w-[22px] sm:h-[22px]" strokeWidth={2.5} />
            </button>
            {/* Reply */}
            <button 
              className={`p-2 sm:p-2.5 rounded-lg transition-all duration-200 touch-manipulation ${selectedConversations.length > 0 ? 'hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-400 dark:text-gray-500 cursor-not-allowed'}`} 
              title="Reply" 
              onClick={handleReply}
              disabled={selectedConversations.length === 0 || bulkActionLoading}
            >
              <Reply size={18} className="sm:w-[20px] sm:h-[20px]" strokeWidth={2} />
            </button>
            {/* Archive */}
            <button 
              className={`p-2 sm:p-2.5 rounded-lg transition-all duration-200 touch-manipulation ${selectedConversations.length > 0 ? 'hover:bg-amber-50 dark:hover:bg-amber-900/30 text-amber-600 dark:text-amber-400 shadow-sm' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-400 dark:text-gray-500 cursor-not-allowed'}`} 
              title="Archive" 
              onClick={handleArchive}
              disabled={selectedConversations.length === 0 || bulkActionLoading}
            >
              <Archive size={18} className="sm:w-[20px] sm:h-[20px]" strokeWidth={2} />
            </button>
            {/* Delete */}
            <button 
              className={`p-2 sm:p-2.5 rounded-lg transition-all duration-200 touch-manipulation ${selectedConversations.length > 0 ? 'hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 shadow-sm' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-400 dark:text-gray-500 cursor-not-allowed'}`} 
              title="Delete" 
              onClick={handleDelete}
              disabled={selectedConversations.length === 0 || bulkActionLoading}
            >
              <Trash2 size={18} className="sm:w-[20px] sm:h-[20px]" strokeWidth={2} />
            </button>
          </div>
          {/* Search Bar */}
          <div className="relative flex items-center flex-1 min-w-0">
            <label htmlFor="inbox-search" className="sr-only">Search conversations</label>
            <input
              id="inbox-search"
              name="search"
              ref={searchInputRef}
              className="border border-gray-200 dark:border-gray-700 rounded-full pl-10 sm:pl-12 pr-4 sm:pr-5 py-2 sm:py-2.5 text-xs sm:text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 w-full shadow-sm transition-all duration-200"
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <span className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Search size={16} className="sm:w-[18px] sm:h-[18px]" />
            </span>
          </div>
        </div>
      </div>
      {/* Main Content */}
      <div className="flex flex-col lg:flex-row flex-1 gap-4 lg:gap-6 px-2 sm:px-4 lg:px-6 py-4 lg:py-6">
        {/* Compose Modal */}
        {showCompose && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-2 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-0 w-full max-w-2xl relative border border-gray-200/50 dark:border-gray-700/50 max-h-[95vh] overflow-y-auto animate-in zoom-in-95 duration-200">
              <button className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl sm:text-2xl p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors touch-manipulation z-10" onClick={() => setShowCompose(false)}>&times;</button>
              <div className="border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 flex items-center justify-center shadow-md">
                    <Plus className="w-5 h-5 text-white" strokeWidth={2.5} />
                  </div>
                  <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100">Compose Message</h2>
                </div>
              </div>
              <form onSubmit={handleCompose} className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
                {/* Course Dropdown - Hide for admins */}
                {user?.role !== 'admin' && (
                  <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row sm:items-center gap-2">
                    <label htmlFor="compose-course" className="w-full sm:w-20 text-gray-700 dark:text-gray-300 font-medium text-xs sm:text-sm">Course</label>
                    <select
                      id="compose-course"
                      name="course"
                      className="border border-gray-200 dark:border-gray-700 rounded px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex-1"
                      value={composeCourse}
                      onChange={e => { setComposeCourse(e.target.value); setComposeToGroup(''); setComposeGroupUsers([]); }}
                    >
                      {composeCourseOptions.map((c: any) => (
                        <option key={c._id} value={c._id}>
                          {c.catalog?.courseCode || c.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {/* To Field with group selection */}
                <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row sm:items-center gap-2 relative" ref={composeToDropdownRef}>
                  <span className="w-full sm:w-20 text-gray-700 dark:text-gray-300 font-medium text-xs sm:text-sm">To</span>
                  <div className="flex-1 relative">
                    <div id="compose-to" className="flex items-center border border-gray-200 dark:border-gray-700 rounded px-2 sm:px-3 py-1.5 sm:py-2 bg-white dark:bg-gray-900 cursor-text">
                      <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                        {composeToGroup === 'sections' && user?.role !== 'admin' ? (
                          composeCourse ? (
                            <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs flex items-center">
                              All Students in {composeCourseOptions.find(c => c._id === composeCourse)?.catalog?.courseCode || composeCourseOptions.find(c => c._id === composeCourse)?.title || 'Course'}
                              <button type="button" className="ml-1 text-[10px] sm:text-xs text-red-500 dark:text-red-400 touch-manipulation" onClick={e => { e.stopPropagation(); setComposeToGroup(''); setComposeCourse(''); }}>&times;</button>
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500 text-[10px] sm:text-xs">Select a course...</span>
                          )
                        ) : (
                          composeRecipients.map((u) => (
                            <span key={u._id} className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs flex items-center gap-1">
                              <div className="relative flex-shrink-0">
                                {u.profilePicture ? (
                                  <img
                                    src={u.profilePicture.startsWith('http') ? u.profilePicture : getImageUrl(u.profilePicture)}
                                    alt={`${u.firstName} ${u.lastName}`}
                                    className="w-4 h-4 sm:w-5 sm:h-5 rounded-full object-cover border border-blue-300"
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
                                  className={`w-4 h-4 sm:w-5 sm:h-5 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white text-[8px] sm:text-[10px] font-bold ${
                                    u.profilePicture ? 'hidden' : 'flex'
                                  }`}
                                  style={{
                                    display: u.profilePicture ? 'none' : 'flex'
                                  }}
                                >
                                  {u.firstName?.charAt(0) || ''}
                                  {u.lastName?.charAt(0) || ''}
                                </div>
                              </div>
                              <span className="truncate max-w-[80px] sm:max-w-none">{u.firstName} {u.lastName}</span>
                              {u.role && <span className="text-[8px] sm:text-[10px] opacity-75 hidden sm:inline">({u.role})</span>}
                              <button type="button" className="ml-0.5 text-[10px] sm:text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 touch-manipulation" onClick={e => { e.stopPropagation(); handleRemoveRecipient(u._id); }}>&times;</button>
                            </span>
                          ))
                        )}
                        {/* Searchable input for To field */}
                        {composeToGroup !== 'sections' && (
                          <input
                            type="text"
                            id="compose-to-input"
                            name="composeToInput"
                            className="flex-1 min-w-24 outline-none border-none bg-transparent text-xs sm:text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                            placeholder={composeRecipients.length === 0 ? (user?.role === 'admin' ? 'Type name or email to search users...' : 'Type name or email...') : ''}
                            value={composeToInput}
                            onChange={e => { setComposeToInput(e.target.value); setShowGroupDropdown(false); }}
                            onFocus={() => { setShowGroupDropdown(false); }}
                          />
                        )}
                      </div>
                      {/* Icon to open group dropdown */}
                      <button
                        type="button"
                        className="ml-1 sm:ml-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 touch-manipulation flex-shrink-0"
                        tabIndex={-1}
                        aria-label="Choose group"
                        onClick={e => { e.stopPropagation(); setShowGroupDropdown(v => !v); }}
                      >
                        <CheckSquare2 size={18} className="sm:w-5 sm:h-5" />
                      </button>
                    </div>
                    {/* Group dropdown only when icon is clicked - Hide for admins or show modified options */}
                    {showGroupDropdown && !composeToGroup && (
                      <div className="absolute left-0 top-12 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow z-20">
                        {user?.role === 'admin' ? (
                          // Admin sees simplified options
                          <>
                            <div className="px-4 py-2 text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer" onClick={() => { setComposeToGroup('teachers'); setShowGroupDropdown(false); }}>All Teachers</div>
                            <div className="px-4 py-2 text-green-600 dark:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer" onClick={() => { setComposeToGroup('students'); setShowGroupDropdown(false); }}>All Students</div>
                            <div className="px-4 py-2 text-purple-600 dark:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer" onClick={() => { setComposeToGroup('admins'); setShowGroupDropdown(false); }}>All Admins</div>
                          </>
                        ) : (
                          // Non-admin users see course-based options
                          <>
                            <div className="px-4 py-2 text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer" onClick={() => { setComposeToGroup('teachers'); setShowGroupDropdown(false); }}>Teachers</div>
                            <div className="px-4 py-2 text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer" onClick={() => { setComposeToGroup('students'); setShowGroupDropdown(false); }}>Students</div>
                            <div className="px-4 py-2 text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer" onClick={() => { setComposeToGroup('sections'); setShowGroupDropdown(false); setComposeCourse(''); }}>Course Sections</div>
                          </>
                        )}
                      </div>
                    )}
                    {/* User search results dropdown */}
                    {composeToInput.length >= 2 && composeUserResults.length > 0 && (
                      <div className="absolute left-0 top-12 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow z-20 max-h-48 overflow-y-auto">
                        {composeUserResults.map((u: any) => (
                          <div key={u._id} className="px-4 py-2 hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer flex items-center gap-3" onClick={() => { handleAddRecipient(u); setComposeToInput(''); setComposeUserResults([]); }}>
                            <div className="relative flex-shrink-0">
                              {u.profilePicture ? (
                                <img
                                  src={u.profilePicture.startsWith('http') ? u.profilePicture : getImageUrl(u.profilePicture)}
                                  alt={`${u.firstName} ${u.lastName}`}
                                  className="w-8 h-8 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
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
                                  u.profilePicture ? 'hidden' : 'flex'
                                }`}
                                style={{
                                  display: u.profilePicture ? 'none' : 'flex'
                                }}
                              >
                                {u.firstName?.charAt(0) || ''}
                                {u.lastName?.charAt(0) || ''}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {u.firstName} {u.lastName}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {u.email} {u.role && `• ${u.role}`}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Dropdown for users in group (for Teachers/Students/Admins) */}
                    {composeToGroup && composeToGroup !== 'sections' && composeGroupUsers.length > 0 && !composeToInput && (
                      <div className="absolute left-0 top-12 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow z-20 max-h-48 overflow-y-auto">
                        <div className="flex items-center px-2 py-2 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800" onClick={() => setComposeToGroup('')}>
                          <ChevronLeft size={18} />
                          <span className="ml-2 text-gray-600 dark:text-gray-400 text-sm">Back</span>
                        </div>
                        {composeGroupUsers.map((u: any) => (
                          <div key={u._id} className="px-4 py-2 hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer flex items-center gap-3" onClick={() => { handleAddRecipient(u); setComposeToGroup(''); }}>
                            <div className="relative flex-shrink-0">
                              {u.profilePicture ? (
                                <img
                                  src={u.profilePicture.startsWith('http') ? u.profilePicture : getImageUrl(u.profilePicture)}
                                  alt={`${u.firstName} ${u.lastName}`}
                                  className="w-8 h-8 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
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
                                  u.profilePicture ? 'hidden' : 'flex'
                                }`}
                                style={{
                                  display: u.profilePicture ? 'none' : 'flex'
                                }}
                              >
                                {u.firstName?.charAt(0) || ''}
                                {u.lastName?.charAt(0) || ''}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {u.firstName} {u.lastName}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {u.email} {u.role && `• ${u.role}`}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Dropdown for course selection when Course Sections is selected - Hide for admins */}
                    {user?.role !== 'admin' && composeToGroup === 'sections' && !composeCourse && (
                      <div className="absolute left-0 top-12 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow z-20 max-h-48 overflow-y-auto">
                        <div className="flex items-center px-2 py-2 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800" onClick={() => setComposeToGroup('')}>
                          <ChevronLeft size={18} />
                          <span className="ml-2 text-gray-600 dark:text-gray-400 text-sm">Back</span>
                        </div>
                        {composeCourseOptions.map((c: any) => (
                          <div key={c._id} className="px-4 py-2 hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer text-gray-900 dark:text-gray-100" onClick={() => setComposeCourse(c._id)}>
                            {c.catalog?.courseCode || c.title}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {/* Subject */}
                <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row sm:items-center gap-2">
                  <label htmlFor="compose-subject" className="w-full sm:w-20 text-gray-700 dark:text-gray-300 font-medium text-xs sm:text-sm">Subject</label>
                  <input
                    id="compose-subject"
                    name="subject"
                    type="text"
                    className="border border-gray-200 dark:border-gray-700 rounded px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 flex-1"
                    value={composeSubject}
                    onChange={e => setComposeSubject(e.target.value)}
                    disabled={composeLoading}
                  />
                </div>
                {/* Send individually checkbox */}
                <div className="mb-3 sm:mb-4 flex items-start sm:items-center gap-2">
                  <input
                    id="send-individually"
                    name="sendIndividually"
                    type="checkbox"
                    className="mt-0.5 sm:mt-0 mr-0 sm:mr-2 w-4 h-4 touch-manipulation"
                    checked={sendIndividually}
                    onChange={e => setSendIndividually(e.target.checked)}
                    disabled={composeLoading}
                  />
                  <label htmlFor="send-individually" className="text-gray-700 dark:text-gray-300 text-xs sm:text-sm select-none">
                    Send an individual message to each recipient
                  </label>
                </div>
                {/* Message */}
                <div className="mb-3 sm:mb-4">
                  <label htmlFor="compose-message" className="block text-gray-700 dark:text-gray-300 font-medium mb-1 text-xs sm:text-sm">Message</label>
                  <textarea
                    id="compose-message"
                    name="message"
                    className="w-full border border-gray-200 dark:border-gray-700 rounded p-2 resize-none bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs sm:text-sm"
                    rows={6}
                    value={composeBody}
                    onChange={e => setComposeBody(e.target.value)}
                    disabled={composeLoading}
                  />
                </div>
                {/* Attachment icon */}
                <div className="flex items-center justify-between gap-2">
                  <button type="button" className="p-1.5 sm:p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 touch-manipulation" title="Attach file" disabled>
                    <Paperclip size={18} className="sm:w-[22px] sm:h-[22px]" />
                  </button>
                  <div className="flex gap-2">
                    <button type="button" className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium transition-colors duration-200 touch-manipulation" onClick={() => setShowCompose(false)} disabled={composeLoading}>Cancel</button>
                    <button type="submit" className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-md hover:shadow-lg text-sm font-medium transition-all duration-200 touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none" disabled={composeLoading || (!composeRecipients.length && (composeToGroup !== 'sections' || !composeCourse)) || !composeSubject.trim() || !composeBody.trim()}>
                      {composeLoading ? (
                        <span className="flex items-center gap-2">
                          <span className="animate-spin">⏳</span> Sending...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Send className="w-4 h-4" strokeWidth={2} />
                          Send
                        </span>
                      )}
                    </button>
                  </div>
                </div>
                {composeError && <div className="text-red-500 dark:text-red-400 mt-2">{composeError}</div>}
              </form>
            </div>
          </div>
        )}
        {/* Conversation List */}
        <div className={`w-full lg:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-0 overflow-hidden flex flex-col backdrop-blur-sm ${selectedConversation ? 'hidden lg:flex' : 'flex'}`}>
          {/* Header with select all */}
          {!loading && !error && conversations.length > 0 && (
            <div className="px-4 sm:px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center shadow-sm">
              <input
                type="checkbox"
                id="select-all-conversations"
                name="selectAllConversations"
                checked={selectedConversations.length === filteredConversations.length && filteredConversations.length > 0}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedConversations(filteredConversations.map(conv => conv._id));
                  } else {
                    setSelectedConversations([]);
                  }
                }}
                className="mr-3 accent-blue-600 w-4 h-4 touch-manipulation cursor-pointer"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {bulkActionLoading ? (
                  <span className="text-blue-600 dark:text-blue-400 flex items-center gap-2">
                    <span className="animate-spin">⏳</span> Processing...
                  </span>
                ) : (
                  selectedConversations.length > 0 
                    ? <span className="text-blue-600 dark:text-blue-400">{selectedConversations.length} selected</span>
                    : <span>{filteredConversations.length} {filteredConversations.length === 1 ? 'conversation' : 'conversations'}</span>
                )}
              </span>
            </div>
          )}
          {loading && <div className="p-4 text-gray-600 dark:text-gray-400">Loading...</div>}
          {error && <div className="p-4 text-red-500 dark:text-red-400">{error}</div>}
          {!loading && !error && conversations.length === 0 && (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 flex items-center justify-center mb-4">
                <Mail className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 font-medium">No conversations yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Start a new conversation to get started</p>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {dateKeys.map(dateKey => (
              <div key={dateKey}>
                <div className="px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-semibold bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-900 dark:to-gray-800/50 sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700">{formatDateHeader(dateKey)}</div>
                {grouped[dateKey].map((conv: any) => {
                  const unread = conv.unreadCount > 0;
                  const participant = conv.participants.find((p: any) => p._id?.toString() === currentUserId?.toString()) || conv.participants[0];
                  const starred = participant?.starred;
                  const otherParticipants = conv.participants.filter((p: any) => p._id?.toString() !== currentUserId?.toString());
                  const participantNames = otherParticipants.map((p: any) =>
                    (p.firstName && p.lastName)
                      ? `${p.firstName} ${p.lastName}`.trim()
                      : (p.firstName || p.lastName || p.email || 'Unknown')
                  ).join(', ');
                  return (
                    <div
                      key={conv._id}
                      className={`flex flex-col px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 cursor-pointer transition-all duration-200 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-transparent dark:hover:from-blue-900/20 dark:hover:to-transparent ${selectedConversation && selectedConversation._id === conv._id ? 'bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-900/30 dark:to-blue-800/20 border-l-4 border-l-blue-500 shadow-sm' : ''}`}
                      onClick={e => {
                        if ((e.target as HTMLElement).tagName === 'INPUT') return;
                        handleSelectConversation(conv);
                      }}
                    >
                      <div className="flex items-center min-h-[24px] gap-2">
                        <input
                          type="checkbox"
                          id={`select-conv-${conv._id}`}
                          name="selectConversation"
                          checked={selectedConversations.includes(conv._id)}
                          onChange={e => setSelectedConversations(prev => {
                            if (e.target.checked) {
                              return Array.from(new Set([...prev, conv._id]));
                            } else {
                              return prev.filter(id => id !== conv._id);
                            }
                          })}
                          className="mr-1.5 sm:mr-2 accent-blue-600 w-4 h-4 touch-manipulation flex-shrink-0"
                          onClick={e => e.stopPropagation()}
                        />
                        {/* Avatar */}
                        <div className="relative flex-shrink-0 mr-2 sm:mr-3">
                          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-base shadow-md ${isUserOnline(otherParticipants[0], currentUserId, currentUserShowOnlineStatus) ? 'ring-2 ring-green-500 dark:ring-green-400 animate-pulse' : 'ring-2 ring-white dark:ring-gray-800'} ${getAvatarColor(conv._id)}`}>
                            <div className="w-full h-full rounded-full overflow-hidden">
                              {otherParticipants[0]?.profilePicture ? (
                                <img
                                  src={otherParticipants[0].profilePicture.startsWith('http')
                                    ? otherParticipants[0].profilePicture
                                    : getImageUrl(otherParticipants[0].profilePicture)}
                                  alt={participantNames}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  {getInitials(otherParticipants[0])}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <span className={`truncate text-xs sm:text-sm font-medium ${unread ? 'font-bold text-blue-900 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'}`}>{participantNames || 'Unknown'}</span>
                            {unread && <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-500 dark:bg-blue-400 rounded-full flex-shrink-0"></span>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end ml-auto min-w-[50px] sm:min-w-[60px] flex-shrink-0">
                          <span className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">{conv.lastMessage ? format(new Date(conv.lastMessage.createdAt), 'p') : ''}</span>
                        </div>
                      </div>
                      <div className="flex items-center min-h-[22px] mt-1 gap-1.5 sm:gap-2">
                        <button
                          className="cursor-pointer flex items-center justify-center transition-all duration-200 touch-manipulation flex-shrink-0 p-1 rounded hover:bg-amber-50 dark:hover:bg-amber-900/20"
                          title={starred ? 'Unstar' : 'Star'}
                          onClick={e => { e.stopPropagation(); handleToggleStar(conv); }}
                        >
                          <Star 
                            size={16} 
                            className={`transition-all duration-200 ${starred ? 'fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500 hover:text-amber-500 dark:hover:text-amber-400'}`}
                            strokeWidth={starred ? 0 : 2}
                          />
                        </button>
                        <span className={`truncate flex-1 text-xs sm:text-sm ${unread ? 'font-bold text-blue-900 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>{conv.subject}</span>
                        {unread && (
                          <span className="ml-1 sm:ml-2 bg-blue-500 dark:bg-blue-400 text-white text-[10px] sm:text-xs rounded-full px-1.5 sm:px-2 py-0.5 flex-shrink-0">{conv.unreadCount}</span>
                        )}
                      </div>
                      <div className="truncate text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-1">
                        {conv.lastMessage ? (
                          conv.lastMessage.body.replace(/<[^>]*>/g, '').substring(0, 60) + (conv.lastMessage.body.replace(/<[^>]*>/g, '').length > 60 ? '...' : '')
                        ) : (
                          <span className="italic text-gray-400 dark:text-gray-500">No messages</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        {/* Message View */}
        <div className={`flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-0 flex flex-col min-h-[400px] lg:min-h-[600px] backdrop-blur-sm ${!selectedConversation ? 'hidden lg:flex' : 'flex'}`}>
          {!selectedConversation && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 p-8">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 flex items-center justify-center mb-6 shadow-lg">
                <InboxIcon className="w-12 h-12 text-blue-600 dark:text-blue-400" strokeWidth={1.5} />
              </div>
              <div className="mt-4 text-xl font-semibold text-gray-600 dark:text-gray-400">No Conversations Selected</div>
              <div className="mt-2 text-sm text-gray-500 dark:text-gray-500">Select a conversation from the list to view messages</div>
            </div>
          )}
          {selectedConversation && (
            <div className="flex flex-col h-full">
              {/* Sticky Subject Header */}
              <div className="mb-0 border-b border-gray-200 dark:border-gray-700 pb-4 flex items-center justify-between sticky top-0 z-10 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-t-xl shadow-sm px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button
                    onClick={() => setSelectedConversation(null)}
                    className="lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mr-1 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
                  >
                    <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                  <div className="font-bold text-lg sm:text-xl lg:text-2xl text-gray-900 dark:text-gray-100 truncate">{selectedConversation.subject}</div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pb-6 sm:pb-8">
                {messagesLoading && <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 py-4">Loading messages...</div>}
                {messagesError && <div className="text-xs sm:text-sm text-red-500 dark:text-red-400 py-4">{messagesError}</div>}
                {!messagesLoading && !messagesError && messages.length === 0 && (
                  <div className="text-xs sm:text-sm text-gray-400 dark:text-gray-500 py-4">No messages yet.</div>
                )}
                <div className="space-y-4 sm:space-y-6 mb-4 sm:mb-6">
                  {messages.map((msg, idx) => {
                    const hasName = (msg.senderId?.firstName && msg.senderId?.firstName.trim()) || (msg.senderId?.lastName && msg.senderId?.lastName.trim());
                    const senderName = hasName
                      ? `${msg.senderId?.firstName || ''} ${msg.senderId?.lastName || ''}`.trim()
                      : (msg.senderId?.email || 'Unknown User');
                    const isLast = idx === messages.length - 1;
                    const isMe = msg.senderId?._id === currentUserId;
                    return (
                      <div key={msg._id} className="border-b border-gray-200 dark:border-gray-700 pb-6 sm:pb-8 last:border-b-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors duration-200 rounded-lg px-2 py-2 -mx-2">
                        {/* Email Header */}
                        <div className="flex items-start justify-between mb-3 sm:mb-4 gap-2">
                          <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                            {/* Avatar */}
                            <div className="relative flex-shrink-0">
                              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-md ${isUserOnline(msg.senderId, currentUserId, currentUserShowOnlineStatus) ? 'ring-2 ring-green-500 dark:ring-green-400 animate-pulse' : 'ring-2 ring-white dark:ring-gray-800'} ${getAvatarColor(msg.senderId?._id)}`}>
                                <div className="w-full h-full rounded-full overflow-hidden">
                                  {msg.senderId?.profilePicture ? (
                                    <img
                                      src={msg.senderId.profilePicture.startsWith('http')
                                        ? msg.senderId.profilePicture
                                        : getImageUrl(msg.senderId.profilePicture)}
                                      alt={senderName}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      {getInitials(msg.senderId)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-100 truncate">
                                {senderName || 'Unknown User'}
                              </div>
                              <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                                {capitalizeFirst(format(new Date(msg.createdAt), "MMM d, yyyy 'at' h:mmaaa"))}
                              </div>
                            </div>
                          </div>
                          {isMe && (
                            <span className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded flex-shrink-0">
                              Sent
                            </span>
                          )}
                        </div>
                        
                        {/* Email Body */}
                        <div className="pl-0 sm:pl-13">
                          <div 
                            className="text-xs sm:text-sm text-gray-900 dark:text-gray-100 break-words leading-relaxed prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: msg.body }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Reply Box */}
              {showReplyBox && (
                <form className="flex flex-col gap-2 mt-2 px-3 sm:px-4 lg:px-6 pb-3 sm:pb-4 lg:pb-6" onSubmit={handleSendReply}>
                  <label htmlFor="reply-message" className="sr-only">Reply</label>
                  <RichTextEditor
                    id="reply-message"
                    name="reply"
                    content={reply}
                    onChange={setReply}
                    placeholder="Type your reply..."
                    className="flex-1 border border-gray-200 dark:border-gray-700 rounded p-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm sm:text-base min-h-[100px] sm:min-h-[120px]"
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      type="button"
                      className="px-3 sm:px-4 py-1.5 sm:py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 text-xs sm:text-sm touch-manipulation"
                      onClick={() => setShowReplyBox(false)}
                      disabled={sending}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg disabled:opacity-50 shadow-md hover:shadow-lg text-sm font-medium transition-all duration-200 touch-manipulation disabled:cursor-not-allowed flex items-center gap-2"
                      disabled={sending || !reply.trim()}
                    >
                      {sending ? (
                        <span className="flex items-center gap-2">
                          <span className="animate-spin">⏳</span> Sending...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Send className="w-4 h-4" strokeWidth={2} />
                          Send
                        </span>
                      )}
                    </button>
                  </div>
                </form>
              )}
              {!showReplyBox && (
                <div className="px-3 sm:px-4 lg:px-6 pb-3 sm:pb-4 lg:pb-6 flex justify-end">
                  <button
                    onClick={() => setShowReplyBox(true)}
                    className="inline-flex items-center px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-md hover:shadow-lg text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 touch-manipulation"
                  >
                    <Reply className="w-4 h-4 mr-2" strokeWidth={2} />
                    Reply
                  </button>
                </div>
              )}
              {sendError && <div className="text-red-500 dark:text-red-400 mt-2 px-3 sm:px-4 lg:px-6 text-xs sm:text-sm">{sendError}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper to group conversations by date
function groupConversationsByDate(conversations: any[]) {
  const groups: { [date: string]: any[] } = {};
  conversations.forEach(conv => {
    const date = conv.lastMessage ? format(new Date(conv.lastMessage.createdAt), 'yyyy-MM-dd') : 'No Date';
    if (!groups[date]) groups[date] = [];
    groups[date].push(conv);
  });
  return groups;
}

// Helper to format date group header
function formatDateHeader(dateStr: string) {
  const date = parseISO(dateStr + 'T00:00:00');
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d, yyyy');
}

export default Inbox; 