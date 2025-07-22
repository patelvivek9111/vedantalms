import React, { useEffect, useState, useRef, useMemo } from 'react';
import { fetchConversations, fetchMessages, sendMessage, createConversation, searchUsers, toggleStar, moveConversation, bulkMoveConversations, bulkDeleteForever } from '../services/inboxService';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Edit, Reply, Archive, Trash2, Search, ChevronLeft, CheckSquare, Paperclip, CheckSquare2 } from 'lucide-react';
import RichTextEditor from '../components/RichTextEditor';

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

const Inbox: React.FC = () => {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

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
  const searchTimeout = useRef<number | null>(null);
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
  const { user } = useAuth();
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
        const res = await api.get(`/api/courses/${composeCourse}/students`);
        recipients = res.data.map((u: any) => u._id);
      }
      await api.post('/inbox/conversations', {
        course: composeCourse,
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
    if (!composeCourse || !composeToGroup) return;
    if (composeToGroup === 'teachers') {
      if (user?.role === 'teacher' || user?.role === 'admin') {
        // Teachers/Admins see all teachers and admins
        api.get('/users/search?role=teacher,admin').then(res => {
          setComposeGroupUsers(res.data.data || []);
        });
      } else {
        // Students see only their course's instructor/admins
        api.get(`/api/courses/${composeCourse}`).then(res => {
          const instructor = res.data.data.instructor ? [res.data.data.instructor] : [];
          // If course has admins assigned, add them here as well (extend as needed)
          setComposeGroupUsers(instructor);
        });
      }
    } else if (composeToGroup === 'students') {
      api.get(`/api/courses/${composeCourse}/students`).then(res => {
        setComposeGroupUsers(res.data || []);
      });
    } else if (composeToGroup === 'sections') {
      setComposeGroupUsers([]);
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
      let roleParam = '';
      if (composeToGroup === 'teachers') {
        roleParam = user?.role === 'teacher' || user?.role === 'admin' ? 'teacher,admin' : 'teacher';
      } else if (composeToGroup === 'students') {
        roleParam = 'student';
      }
      api.get(`/users/search?name=${encodeURIComponent(composeToInput)}&role=${roleParam}`)
        .then(res => setComposeUserResults(res.data.data || []))
        .catch(() => setComposeUserResults([]));
    }, 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [composeToInput, composeToGroup, user]);

  // Fetch user-specific courses for the main dropdown
  useEffect(() => {
    api.get('/courses').then(res => {
      const userCourses = (res.data.data || []).map((c: any) => ({ value: c._id, label: c.title }));
      setCourseOptions([{ value: 'all', label: 'All Courses' }, ...userCourses]);
    });
  }, []);

  // Memoize filteredConversations to prevent infinite loops
  const filteredConversations = useMemo(() => {
    return conversations.filter(conv => {
      // Course filter
      if (selectedCourse !== 'all' && conv.course !== selectedCourse) return false;
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
  }, [conversations, selectedCourse, selectedFolder, search, currentUserId]);

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
    <div className="flex flex-col h-full min-h-[80vh] bg-gray-100 dark:bg-gray-900">
      {/* Top Bar */}
      <div className="flex items-center gap-2 px-6 py-3 border-b bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm sticky top-0 z-20" style={{ minHeight: 64 }}>
        {/* Course Dropdown */}
        <div className="relative">
          <select
            id="topbar-course-dropdown"
            name="topbarCourseDropdown"
            className="appearance-none border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-gray-900 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-200"
            value={selectedCourse}
            onChange={e => setSelectedCourse(e.target.value)}
            style={{ minWidth: 140 }}
          >
            {courseOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
            ▼
          </span>
        </div>
        {/* Folder Dropdown */}
        <div className="relative">
          <select
            id="topbar-folder-dropdown"
            name="topbarFolderDropdown"
            className="appearance-none border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-gray-900 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-200"
            value={selectedFolder}
            onChange={e => setSelectedFolder(e.target.value)}
            style={{ minWidth: 110 }}
          >
            {folderOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
            ▼
          </span>
        </div>
        {/* Icon Row */}
        <div className="flex items-center gap-2 ml-4">
          {/* Compose (modern icon) */}
          <button
            className="p-2 rounded hover:bg-blue-100 text-blue-600"
            title="Compose"
            onClick={() => setShowCompose(true)}
          >
            <Edit size={22} />
          </button>
          {/* Reply */}
          <button 
            className={`p-2 rounded ${selectedConversations.length > 0 ? 'hover:bg-blue-200 text-blue-600' : 'hover:bg-gray-200 text-gray-400'}`} 
            title="Reply" 
            onClick={handleReply}
            disabled={selectedConversations.length === 0 || bulkActionLoading}
          >
            <Reply size={22} />
          </button>
          {/* Archive */}
          <button 
            className={`p-2 rounded ${selectedConversations.length > 0 ? 'hover:bg-yellow-200 text-yellow-600' : 'hover:bg-gray-200 text-gray-400'}`} 
            title="Archive" 
            onClick={handleArchive}
            disabled={selectedConversations.length === 0 || bulkActionLoading}
          >
            <Archive size={22} />
          </button>
          {/* Delete */}
          <button 
            className={`p-2 rounded ${selectedConversations.length > 0 ? 'hover:bg-red-200 text-red-600' : 'hover:bg-gray-200 text-gray-400'}`} 
            title="Delete" 
            onClick={handleDelete}
            disabled={selectedConversations.length === 0 || bulkActionLoading}
          >
            <Trash2 size={22} />
          </button>
        </div>
        {/* Spacer */}
        <div className="flex-1" />
        {/* Search Bar */}
        <div className="relative flex items-center" style={{ minWidth: 260 }}>
          <label htmlFor="inbox-search" className="sr-only">Search conversations</label>
          <input
            id="inbox-search"
            name="search"
            ref={searchInputRef}
            className="border border-gray-200 dark:border-gray-700 rounded-full pl-10 pr-4 py-2 text-sm bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200 w-full shadow-sm"
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <Search size={18} />
          </span>
        </div>
      </div>
      {/* Main Content */}
      <div className="flex flex-1 gap-6 px-6 py-6">
        {/* Compose Modal */}
        {showCompose && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-0 w-full max-w-xl relative border border-gray-200 dark:border-gray-700">
              <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-2xl" onClick={() => setShowCompose(false)}>&times;</button>
              <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4 text-xl font-semibold">Compose Message</div>
              <form onSubmit={handleCompose} className="px-6 py-4">
                {/* Course Dropdown */}
                <div className="mb-4 flex items-center">
                  <label htmlFor="compose-course" className="w-20 text-gray-700 font-medium">Course</label>
                  <select
                    id="compose-course"
                    name="course"
                    className="border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-gray-900 flex-1"
                    value={composeCourse}
                    onChange={e => { setComposeCourse(e.target.value); setComposeToGroup(''); setComposeGroupUsers([]); }}
                  >
                    {composeCourseOptions.map((c: any) => (
                      <option key={c._id} value={c._id}>{c.title}</option>
                    ))}
                  </select>
                </div>
                {/* To Field with group selection */}
                <div className="mb-4 flex items-center relative" ref={composeToDropdownRef}>
                  <span className="w-20 text-gray-700 font-medium">To</span>
                  <div className="flex-1 relative">
                    <div id="compose-to" className="flex items-center border border-gray-200 dark:border-gray-700 rounded px-3 py-2 bg-white dark:bg-gray-900 cursor-text">
                      <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                        {composeToGroup === 'sections' ? (
                          composeCourse ? (
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs flex items-center">
                              All Students in {composeCourseOptions.find(c => c._id === composeCourse)?.title || 'Course'}
                              <button type="button" className="ml-1 text-xs text-red-500" onClick={e => { e.stopPropagation(); setComposeToGroup(''); setComposeCourse(''); }}>&times;</button>
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">Select a course...</span>
                          )
                        ) : (
                          composeRecipients.map((u) => (
                            <span key={u._id} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs flex items-center">
                              {u.firstName} {u.lastName}
                              <button type="button" className="ml-1 text-xs text-red-500" onClick={e => { e.stopPropagation(); handleRemoveRecipient(u._id); }}>&times;</button>
                            </span>
                          ))
                        )}
                        {/* Searchable input for To field */}
                        {composeToGroup !== 'sections' && (
                          <input
                            type="text"
                            id="compose-to-input"
                            name="composeToInput"
                            className="flex-1 min-w-24 outline-none border-none bg-transparent text-sm"
                            placeholder={composeRecipients.length === 0 ? 'Type name or email...' : ''}
                            value={composeToInput}
                            onChange={e => { setComposeToInput(e.target.value); setShowGroupDropdown(false); }}
                            onFocus={() => { setShowGroupDropdown(false); }}
                          />
                        )}
                      </div>
                      {/* Icon to open group dropdown */}
                      <button
                        type="button"
                        className="ml-2 text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                        aria-label="Choose group"
                        onClick={e => { e.stopPropagation(); setShowGroupDropdown(v => !v); }}
                      >
                        <CheckSquare2 size={20} />
                      </button>
                    </div>
                    {/* Group dropdown only when icon is clicked */}
                    {showGroupDropdown && !composeToGroup && (
                      <div className="absolute left-0 top-12 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow z-20">
                        <div className="px-4 py-2 text-red-600 hover:bg-gray-100 cursor-pointer" onClick={() => { setComposeToGroup('teachers'); setShowGroupDropdown(false); }}>Teachers</div>
                        <div className="px-4 py-2 text-red-600 hover:bg-gray-100 cursor-pointer" onClick={() => { setComposeToGroup('students'); setShowGroupDropdown(false); }}>Students</div>
                        <div className="px-4 py-2 text-red-600 hover:bg-gray-100 cursor-pointer" onClick={() => { setComposeToGroup('sections'); setShowGroupDropdown(false); setComposeCourse(''); }}>Course Sections</div>
                      </div>
                    )}
                    {/* User search results dropdown */}
                    {composeToInput.length >= 2 && composeUserResults.length > 0 && (
                      <div className="absolute left-0 top-12 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow z-20 max-h-48 overflow-y-auto">
                        {composeUserResults.map((u: any) => (
                          <div key={u._id} className="px-4 py-2 hover:bg-blue-100 cursor-pointer" onClick={() => { handleAddRecipient(u); setComposeToInput(''); setComposeUserResults([]); }}>
                            {u.firstName} {u.lastName} ({u.email})
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Dropdown for users in group (for Teachers/Students) */}
                    {composeToGroup && composeToGroup !== 'sections' && composeGroupUsers.length > 0 && !composeToInput && (
                      <div className="absolute left-0 top-12 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow z-20 max-h-48 overflow-y-auto">
                        <div className="flex items-center px-2 py-2 border-b cursor-pointer hover:bg-gray-100" onClick={() => setComposeToGroup('')}>
                          <ChevronLeft size={18} />
                          <span className="ml-2 text-gray-600 text-sm">Back</span>
                        </div>
                        {composeGroupUsers.map((u: any) => (
                          <div key={u._id} className="px-4 py-2 hover:bg-blue-100 cursor-pointer" onClick={() => { handleAddRecipient(u); setComposeToGroup(''); }}>
                            {u.firstName} {u.lastName} ({u.email})
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Dropdown for course selection when Course Sections is selected */}
                    {composeToGroup === 'sections' && !composeCourse && (
                      <div className="absolute left-0 top-12 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow z-20 max-h-48 overflow-y-auto">
                        <div className="flex items-center px-2 py-2 border-b cursor-pointer hover:bg-gray-100" onClick={() => setComposeToGroup('')}>
                          <ChevronLeft size={18} />
                          <span className="ml-2 text-gray-600 text-sm">Back</span>
                        </div>
                        {composeCourseOptions.map((c: any) => (
                          <div key={c._id} className="px-4 py-2 hover:bg-blue-100 cursor-pointer" onClick={() => setComposeCourse(c._id)}>
                            {c.title}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {/* Subject */}
                <div className="mb-4 flex items-center">
                  <label htmlFor="compose-subject" className="w-20 text-gray-700 font-medium">Subject</label>
                  <input
                    id="compose-subject"
                    name="subject"
                    type="text"
                    className="border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-gray-900 flex-1"
                    value={composeSubject}
                    onChange={e => setComposeSubject(e.target.value)}
                    disabled={composeLoading}
                  />
                </div>
                {/* Send individually checkbox */}
                <div className="mb-4 flex items-center">
                  <input
                    id="send-individually"
                    name="sendIndividually"
                    type="checkbox"
                    className="mr-2"
                    checked={sendIndividually}
                    onChange={e => setSendIndividually(e.target.checked)}
                    disabled={composeLoading}
                  />
                  <label htmlFor="send-individually" className="text-gray-700 text-sm select-none">
                    Send an individual message to each recipient
                  </label>
                </div>
                {/* Message */}
                <div className="mb-4">
                  <label htmlFor="compose-message" className="block text-gray-700 font-medium mb-1">Message</label>
                  <textarea
                    id="compose-message"
                    name="message"
                    className="w-full border border-gray-200 dark:border-gray-700 rounded p-2 resize-none bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    rows={6}
                    value={composeBody}
                    onChange={e => setComposeBody(e.target.value)}
                    disabled={composeLoading}
                  />
                </div>
                {/* Attachment icon */}
                <div className="flex items-center justify-between">
                  <button type="button" className="p-2 text-gray-400 hover:text-gray-600" title="Attach file" disabled>
                    <Paperclip size={22} />
                  </button>
                  <div className="flex gap-2">
                    <button type="button" className="px-4 py-2 rounded bg-gray-200" onClick={() => setShowCompose(false)} disabled={composeLoading}>Cancel</button>
                    <button type="submit" className="px-4 py-2 rounded bg-red-600 text-white" disabled={composeLoading || (!composeRecipients.length && (composeToGroup !== 'sections' || !composeCourse)) || !composeSubject.trim() || !composeBody.trim()}>{composeLoading ? 'Sending...' : 'Send'}</button>
                  </div>
                </div>
                {composeError && <div className="text-red-500 mt-2">{composeError}</div>}
              </form>
            </div>
          </div>
        )}
        {/* Conversation List */}
        <div className="w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-0 overflow-y-auto flex flex-col">
          {/* Header with select all */}
          {!loading && !error && conversations.length > 0 && (
            <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center">
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
                className="mr-3 accent-blue-600 w-4 h-4"
              />
                        <span className="text-sm text-gray-600">
            {bulkActionLoading ? (
              <span className="text-blue-600">Processing...</span>
            ) : (
              selectedConversations.length > 0 
                ? `${selectedConversations.length} selected` 
                : `${filteredConversations.length} conversations`
            )}
          </span>
            </div>
          )}
          {loading && <div className="p-4">Loading...</div>}
          {error && <div className="p-4 text-red-500">{error}</div>}
          {!loading && !error && conversations.length === 0 && (
            <div className="p-4 text-gray-400">No conversations yet.</div>
          )}
          <div className="flex-1 overflow-y-auto">
            {dateKeys.map(dateKey => (
              <div key={dateKey}>
                <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-300 font-semibold bg-gray-50 dark:bg-gray-900 sticky top-0 z-10 rounded-t-2xl">{formatDateHeader(dateKey)}</div>
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
                      className={`flex flex-col px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 cursor-pointer transition-all duration-150 hover:bg-blue-50 dark:hover:bg-blue-900 ${selectedConversation && selectedConversation._id === conv._id ? 'bg-blue-100 dark:bg-blue-900 border-l-4 border-l-blue-500' : ''}`}
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
                          className="mr-2 accent-blue-600 w-4 h-4"
                          onClick={e => e.stopPropagation()}
                        />
                        {/* Avatar */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm mr-2 overflow-hidden ${getAvatarColor(conv._id)}`}>
                          {otherParticipants[0]?.profilePicture ? (
                            <img
                              src={otherParticipants[0].profilePicture.startsWith('http')
                                ? otherParticipants[0].profilePicture
                                : `http://localhost:5000${otherParticipants[0].profilePicture}`}
                              alt={participantNames}
                              className="w-8 h-8 object-cover rounded-full"
                            />
                          ) : (
                            getInitials(otherParticipants[0])
                          )}
                        </div>
                        <span className={`truncate font-medium ${unread ? 'font-bold text-blue-900' : 'text-gray-900'}`}>{participantNames || 'Unknown'}</span>
                        {unread && <span className="ml-2 w-2 h-2 bg-blue-500 rounded-full"></span>}
                        <div className="flex flex-col items-end ml-auto min-w-[48px]">
                          <span className="text-xs text-gray-400">{conv.lastMessage ? format(new Date(conv.lastMessage.createdAt), 'p') : ''}</span>
                        </div>
                      </div>
                      <div className="flex items-center min-h-[22px] mt-1">
                        <span
                          className="cursor-pointer flex items-center justify-center mr-2 transition-colors"
                          title={starred ? 'Unstar' : 'Star'}
                          onClick={e => { e.stopPropagation(); handleToggleStar(conv); }}
                          style={{ width: 18, height: 18 }}
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill={starred ? '#2563eb' : 'none'}
                            stroke="#2563eb"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ display: 'block' }}
                          >
                            <polygon
                              points="12 17.27 18.18 21 16.54 13.97 22 9.24 14.81 8.63 12 2 9.19 8.63 2 9.24 7.46 13.97 5.82 21 12 17.27"
                              fill={starred ? '#2563eb' : 'none'}
                              stroke="#2563eb" />
                          </svg>
                        </span>
                        <span className={`truncate flex-1 ${unread ? 'font-bold text-blue-900' : 'text-gray-700'}`}>{conv.subject}</span>
                        {unread && (
                          <span className="ml-2 bg-blue-500 text-white text-xs rounded-full px-2 py-0.5">{conv.unreadCount}</span>
                        )}
                      </div>
                      <div className="truncate text-xs text-gray-500 mt-1">{conv.lastMessage ? conv.lastMessage.body : <span className="italic text-gray-400">No messages</span>}</div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        {/* Message View */}
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 p-0 flex flex-col min-h-[600px]">
          {!selectedConversation && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <svg width="96" height="96" fill="none" viewBox="0 0 24 24"><path d="M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6Zm2 0 8 7 8-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <div className="mt-4 text-lg">No Conversations Selected</div>
            </div>
          )}
          {selectedConversation && (
            <div className="flex flex-col h-full">
              {/* Sticky Subject Header */}
              <div className="mb-4 border-b border-gray-200 dark:border-gray-700 pb-2 flex items-center justify-between sticky top-0 z-10 bg-white dark:bg-gray-800 rounded-t-2xl shadow-sm px-6 pt-6">
                <div className="font-bold text-2xl">{selectedConversation.subject}</div>
              </div>
              <div className="flex-1 overflow-y-auto px-6 pb-6">
                {messagesLoading && <div>Loading messages...</div>}
                {messagesError && <div className="text-red-500">{messagesError}</div>}
                {!messagesLoading && !messagesError && messages.length === 0 && (
                  <div className="text-gray-400">No messages yet.</div>
                )}
                <div className="space-y-6 mb-6">
                  {messages.map((msg, idx) => {
                    const hasName = (msg.senderId?.firstName && msg.senderId?.firstName.trim()) || (msg.senderId?.lastName && msg.senderId?.lastName.trim());
                    const senderName = hasName
                      ? `${msg.senderId?.firstName || ''} ${msg.senderId?.lastName || ''}`.trim()
                      : (msg.senderId?.email || 'Unknown User');
                    const isLast = idx === messages.length - 1;
                    const isMe = msg.senderId?._id === currentUserId;
                    return (
                      <div key={msg._id} className="border-b border-gray-200 dark:border-gray-700 pb-6 last:border-b-0">
                        {/* Email Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            {/* Avatar */}
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg overflow-hidden ${getAvatarColor(msg.senderId?._id)}`}>
                              {msg.senderId?.profilePicture ? (
                                <img
                                  src={msg.senderId.profilePicture.startsWith('http')
                                    ? msg.senderId.profilePicture
                                    : `http://localhost:5000${msg.senderId.profilePicture}`}
                                  alt={senderName}
                                  className="w-10 h-10 object-cover rounded-full"
                                />
                              ) : (
                                getInitials(msg.senderId)
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 dark:text-gray-100">
                                {senderName || 'Unknown User'}
                              </div>
                              <div className="text-sm text-gray-500">
                                {capitalizeFirst(format(new Date(msg.createdAt), "MMMM d, yyyy 'at' h:mmaaa"))}
                              </div>
                            </div>
                          </div>
                          {isMe && (
                            <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                              Sent
                            </span>
                          )}
                        </div>
                        
                        {/* Email Body */}
                        <div className="pl-13">
                          <div className="text-gray-900 dark:text-gray-100 whitespace-pre-line break-words leading-relaxed">
                            {msg.body}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Reply Box */}
              {showReplyBox && (
                <form className="flex flex-col gap-2 mt-2 px-6 pb-6" onSubmit={handleSendReply}>
                  <label htmlFor="reply-message" className="sr-only">Reply</label>
                  <RichTextEditor
                    content={reply}
                    onChange={setReply}
                    placeholder="Type your reply..."
                    className="flex-1 border border-gray-200 dark:border-gray-700 rounded p-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      type="submit"
                      className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50 shadow"
                      disabled={sending || !reply.trim()}
                    >
                      {sending ? 'Sending...' : 'Send'}
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 rounded bg-gray-200"
                      onClick={() => setShowReplyBox(false)}
                      disabled={sending}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
              {!showReplyBox && (
                <div className="px-6 pb-6 flex justify-end">
                  <button
                    onClick={() => setShowReplyBox(true)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <Reply className="w-4 h-4 mr-2" />
                    Reply
                  </button>
                </div>
              )}
              {sendError && <div className="text-red-500 mt-2 px-6">{sendError}</div>}
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