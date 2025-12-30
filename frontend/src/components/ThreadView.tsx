import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import api, { getImageUrl } from '../services/api';
import { API_URL } from '../config';
import RichTextEditor from './RichTextEditor';
import logger from '../utils/logger';
import { 
  MessageSquare, 
  Pin, 
  Edit3, 
  Trash2, 
  MoreVertical, 
  Reply, 
  User, 
  Award,
  Calendar,
  Clock,
  BookOpen,
  CheckCircle,
  XCircle,
  AlertCircle,
  Send,
  X,
  Settings,
  Heart
} from 'lucide-react';

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  role: string;
  avatarUrl?: string;
}

interface Reply {
  _id: string;
  content: string;
  author: {
    _id: string;
    firstName: string;
    lastName: string;
    role: string;
    avatarUrl?: string;
    profilePicture?: string; // Added profilePicture
  };
  createdAt: string;
  updatedAt: string;
  parentReply?: string; // ID of the parent reply if this is a nested reply
  grade?: number;
  feedback?: string;
  likes?: Array<{
    user: {
      _id: string;
      firstName: string;
      lastName: string;
    };
    likedAt: string;
  }>;
}

interface StudentGrade {
  student: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  grade: number;
  feedback: string;
  gradedAt: string;
  gradedBy: {
    _id: string;
    firstName: string;
    lastName: string;
  };
}

interface Thread {
  _id: string;
  title: string;
  content: string;
  author: {
    _id: string;
    firstName: string;
    lastName: string;
    role: string;
    avatarUrl?: string;
    profilePicture?: string;
  };
  course: string;
  createdAt: string;
  updatedAt: string;
  replies: Reply[];
  isPinned: boolean;
  isGraded: boolean;
  totalPoints: number;
  group: string;
  dueDate: string | null;
  module?: string;
  studentGrades: StudentGrade[];
  settings?: {
    requirePostBeforeSee: boolean;
    allowLikes: boolean;
    allowComments: boolean;
  };
}

interface ReplyComponentProps {
  reply: Reply;
  onReply: (parentId: string) => void;
  level: number;
  onEdit: (replyId: string, content: string) => Promise<void>;
  onDelete: (replyId: string) => Promise<void>;
  canModify: boolean;
  threadId: string;
  isReplying: boolean;
  onSubmitReply: (e: React.FormEvent, parentReply: string) => void;
  replyContent: string;
  setReplyContent: (content: string) => void;
  setReplyingTo: (id: string | null) => void;
  onLike: (replyId: string) => Promise<void>;
  allowLikes: boolean;
}

const ReplyComponent: React.FC<ReplyComponentProps> = ({
  reply,
  onReply,
  level,
  onEdit,
  onDelete,
  canModify,
  threadId,
  isReplying,
  onSubmitReply,
  replyContent,
  setReplyContent,
  setReplyingTo,
  onLike,
  allowLikes
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(reply.content);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const isAuthorOrTeacher = String(user?._id) === String(reply.author._id) || user?.role === 'teacher';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editContent.trim()) return;
    setIsSubmitting(true);
    try {
      await onEdit(reply._id, editContent);
      setIsEditing(false);
    } catch (error) {
      logger.error('Error editing reply', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this reply?')) {
      try {
        await onDelete(reply._id);
      } catch (error) {
        logger.error('Error deleting reply', error);
      }
    }
  };

  // Modern card-style reply UI
  return (
    <div
      style={{
        marginLeft: `${Math.min(level * 32, 96)}px`,
      }}
      className="mb-6"
    >
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow duration-200 overflow-hidden">
          <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <img
                  src={reply.author.profilePicture
                    ? (reply.author.profilePicture.startsWith('http')
                        ? reply.author.profilePicture
                        : getImageUrl(reply.author.profilePicture))
                    : '/default-avatar.png'}
                  alt={reply.author.firstName}
                  className="w-10 h-10 rounded-full object-cover border-2 border-gray-100 dark:border-gray-700"
                  onError={e => (e.currentTarget.src = '/default-avatar.png')}
                />

              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {reply.author.firstName} {reply.author.lastName}
                  </span>

                </div>
                <div className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400">
                  <Clock className="w-3 h-3" />
                  <span>{formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}</span>
                </div>
              </div>
            </div>
            
            {isAuthorOrTeacher && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                  title="More options"
                  aria-label="More options"
                >
                  <MoreVertical className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
                
                {showMenu && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
                    <button
                      onClick={() => {
                        setIsEditing(true);
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center space-x-2"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => {
                        handleDelete();
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 flex items-center space-x-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Content */}
          {isEditing ? (
            <form onSubmit={handleEdit} className="space-y-4">
              <label htmlFor="edit-reply-content" className="sr-only">Edit reply content</label>
              <RichTextEditor
                id="edit-reply-content"
                name="editContent"
                content={editContent}
                onChange={setEditContent}
                placeholder="Edit your reply..."
                className="min-h-[120px]"
              />
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(reply.content);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !editContent.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <>
              <div 
                className="prose prose-gray max-w-none mb-4 text-gray-800 dark:text-gray-300 leading-relaxed prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-800 dark:prose-p:text-gray-300"
                dangerouslySetInnerHTML={{ __html: reply.content }}
              />
              
              {/* Reply button */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => onReply(reply._id)}
                    className="flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
                  >
                    <Reply className="w-4 h-4" />
                    <span>Reply</span>
                  </button>
                  
                  {allowLikes && (
                    <button
                      onClick={() => onLike(reply._id)}
                      className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 font-medium transition-colors"
                    >
                      <Heart 
                        className={`w-4 h-4 ${
                          reply.likes?.some(like => like.user._id === user?._id) 
                            ? 'fill-red-500 text-red-500' 
                            : ''
                        }`} 
                      />
                      <span>{reply.likes?.length || 0}</span>
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Nested reply form */}
      {isReplying && (
        <div className="mt-3 ml-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-4 flex items-center space-x-2">
              <Reply className="w-4 h-4" />
              <span>Reply to {reply.author.firstName}</span>
            </h4>
            <form onSubmit={e => onSubmitReply(e, reply._id)}>
              <label htmlFor="reply-content" className="sr-only">Reply content</label>
              <RichTextEditor
                id="reply-content"
                name="replyContent"
                content={replyContent}
                onChange={setReplyContent}
                placeholder="Write your reply..."
                className="mb-4"
              />
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setReplyingTo(null);
                    setReplyContent('');
                    
                    // Clear draft when canceling
                    if (threadId && user?._id) {
                      const draftKey = `thread_reply_draft_${threadId}_${user._id}`;
                      localStorage.removeItem(draftKey);
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !replyContent.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? 'Posting...' : 'Post Reply'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const ThreadView: React.FC = () => {
  const { courseId, threadId, groupId } = useParams<{ courseId?: string; threadId: string; groupId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [thread, setThread] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedCourseId, setResolvedCourseId] = useState<string | null>(courseId || null);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Load saved draft from localStorage on mount
  useEffect(() => {
    if (threadId && user?._id) {
      const draftKey = `thread_reply_draft_${threadId}_${user._id}`;
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        try {
          setReplyContent(savedDraft);
        } catch (e) {
          logger.error('Error loading draft', e);
        }
      }
    }
  }, [threadId, user?._id]);

  // Auto-save reply content to localStorage
  useEffect(() => {
    if (threadId && user?._id && replyContent) {
      const draftKey = `thread_reply_draft_${threadId}_${user._id}`;
      const timeoutId = setTimeout(() => {
        localStorage.setItem(draftKey, replyContent);
      }, 500); // Debounce by 500ms
      return () => clearTimeout(timeoutId);
    }
  }, [replyContent, threadId, user?._id]);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [showReplyEditor, setShowReplyEditor] = useState(false);
  
  // New state for grading
  const [showGradingModal, setShowGradingModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<{ _id: string; firstName: string; lastName: string } | null>(null);
  const [grade, setGrade] = useState('');
  const [feedback, setFeedback] = useState('');
  const [gradingError, setGradingError] = useState<string | null>(null);
  const [isGrading, setIsGrading] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editSettings, setEditSettings] = useState({
    isGraded: false,
    totalPoints: 100,
    group: 'Discussions',
    dueDate: '',
    requirePostBeforeSee: false,
    allowLikes: true,
    allowComments: true,
    module: ''
  });

  // Add state for students
  const [students, setStudents] = useState<{ _id: string; firstName: string; lastName: string; profilePicture?: string }[]>([]);
  
  // Add state for modules
  const [modules, setModules] = useState<{ _id: string; title: string }[]>([]);

  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';

  // Fetch courseId from group if in group context
  useEffect(() => {
    const fetchGroupCourseId = async () => {
      if (groupId && !courseId) {
        try {
          const token = localStorage.getItem('token');
          const response = await api.get(`/groups/${groupId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const course = response.data.course;
          const fetchedCourseId = typeof course === 'string' ? course : course?._id || '';
          if (fetchedCourseId) {
            setResolvedCourseId(fetchedCourseId);
          } else {
            setError('Course ID not found for this group');
            setLoading(false);
          }
        } catch (err) {
          logger.error('Error fetching group', err);
          setError('Failed to load group information');
          setLoading(false);
        }
      } else if (courseId) {
        setResolvedCourseId(courseId);
      }
    };
    fetchGroupCourseId();
  }, [groupId, courseId]);

  useEffect(() => {
    const fetchThreadAndStudents = async () => {
      if (!threadId) {
        setError('Invalid thread ID');
        setLoading(false);
        return;
      }
      
      // If in group context and still loading courseId, wait
      if (groupId && !resolvedCourseId) {
        return; // Still loading group info
      }
      
      if (!resolvedCourseId) {
        setError('Invalid course ID');
        setLoading(false);
        return;
      }
      try {
        const token = localStorage.getItem('token');
        
        // First, fetch the thread to check settings
        const threadRes = await api.get(`/threads/${threadId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (threadRes.data.success) {
          if (threadRes.data.data.course !== resolvedCourseId) {
            setError('Thread not found in this course');
            setLoading(false);
            return;
          }
          
          // If "post before see" is enabled and user is a student, use participant endpoint
          if (threadRes.data.data.settings?.requirePostBeforeSee && user?.role === 'student') {
            const participantRes = await api.get(`/threads/${threadId}/participant/${user._id}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (participantRes.data.success) {
              setThread(participantRes.data.data);
            } else {
              setThread(threadRes.data.data);
            }
          } else {
            setThread(threadRes.data.data);
          }
        } else {
          setError('Failed to load thread');
        }
          // Fetch course to get students
          const courseRes = await api.get(`/courses/${resolvedCourseId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (courseRes.data.success) {
            setStudents(courseRes.data.data.students || []);
          }
          
          // Fetch modules for the course
          const modulesRes = await api.get(`/modules/${resolvedCourseId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (modulesRes.data.success) {
            setModules(modulesRes.data.data || []);
          }
      } catch (err) {
        logger.error('Error fetching thread or students', err);
        setError('Failed to load thread or students');
      } finally {
        setLoading(false);
      }
    };
    fetchThreadAndStudents();
  }, [resolvedCourseId, threadId, groupId, user?._id]);

  useEffect(() => {
    const handleThreadUpdate = (event: CustomEvent) => {
      setThread(event.detail);
    };

    window.addEventListener('threadUpdated', handleThreadUpdate as EventListener);
    return () => {
      window.removeEventListener('threadUpdated', handleThreadUpdate as EventListener);
    };
  }, []);

  const handleSubmitReply = async (e: React.FormEvent, parentReply: string | null = null) => {
    e.preventDefault();
    if (!thread || !replyContent.trim()) return;

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await api.post(
        `${API_URL}/api/threads/${thread._id}/replies`,
        { 
          content: replyContent,
          parentReply: parentReply || null
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setThread(response.data.data);
        setReplyContent('');
        
        // Clear draft from localStorage after successful reply
        if (threadId && user?._id) {
          const draftKey = `thread_reply_draft_${threadId}_${user._id}`;
          localStorage.removeItem(draftKey);
        }
        
        setReplyingTo(null);
        setShowReplyEditor(false);
      }
    } catch (error) {
      logger.error('Error posting reply', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = async (replyId: string) => {
    if (!thread) return;

    try {
      const token = localStorage.getItem('token');
      const response = await api.post(
        `${API_URL}/api/threads/${thread._id}/replies/${replyId}/like`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setThread(response.data.data);
      }
    } catch (error) {
      logger.error('Error liking reply', error);
    }
  };

  const handleEditThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thread || !editTitle.trim() || !editContent.trim()) return;

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await api.put(
        `${API_URL}/api/threads/${thread._id}`,
        {
          title: editTitle,
          content: editContent
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setThread(response.data.data);
        setIsEditing(false);
      }
    } catch (error) {
      logger.error('Error updating thread', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteThread = async () => {
    if (!thread || !window.confirm('Are you sure you want to delete this thread?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await api.delete(
        `${API_URL}/api/threads/${thread._id}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        navigate(-1);
      }
    } catch (error) {
      logger.error('Error deleting thread', error);
    }
  };

  const handleTogglePin = async () => {
    if (!thread) return;

    try {
      const token = localStorage.getItem('token');
      const response = await api.patch(
        `${API_URL}/api/threads/${thread._id}/pin`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setThread(response.data.data);
      }
    } catch (error) {
      logger.error('Error toggling pin status', error);
    }
  };

  const handleEditReply = async (replyId: string, content: string) => {
    if (!thread) return;

    try {
      const token = localStorage.getItem('token');
      const response = await api.put(
        `${API_URL}/api/threads/${thread._id}/replies/${replyId}`,
        { content },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setThread(response.data.data);
      }
    } catch (error) {
      logger.error('Error updating reply', error);
      throw error;
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    if (!thread) return;

    try {
      const token = localStorage.getItem('token');
      const response = await api.delete(
        `${API_URL}/api/threads/${thread._id}/replies/${replyId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setThread(response.data.data);
        const hasUserReplies = response.data.data.replies.some(
          (reply: Reply) => reply.author._id === user?._id
        );
        if (!hasUserReplies) {
          setShowReplyEditor(false);
        }
      }
    } catch (error) {
      logger.error('Error deleting reply', error);
      throw error;
    }
  };

  const handleReplyClick = (replyId: string) => {
    setReplyingTo(replyId);
  };

  const handleGradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thread || !selectedStudent) return;

    setIsGrading(true);
    setGradingError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await api.post(
        `${API_URL}/api/threads/${thread._id}/grade`,
        {
          studentId: selectedStudent._id,
          grade: parseFloat(grade),
          feedback
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setThread(response.data.data);
        setShowGradingModal(false);
        setSelectedStudent(null);
        setGrade('');
        setFeedback('');
        // Dispatch event to notify gradebook to refresh
        window.dispatchEvent(new Event('discussionGradeUpdated'));
      } else {
        setGradingError('Failed to submit grade');
      }
    } catch (err) {
      logger.error('Error submitting grade', err);
      setGradingError('Failed to submit grade. Please try again.');
    } finally {
      setIsGrading(false);
    }
  };

  const openGradingModal = (student: { _id: string; firstName: string; lastName: string }) => {
    const existingGrade = thread?.studentGrades.find(g => g.student._id === student._id);
    setSelectedStudent(student);
    setGrade(existingGrade?.grade?.toString() || '');
    setFeedback(existingGrade?.feedback || '');
    setShowGradingModal(true);
  };

  const handleEditSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thread) return;

    try {
      const token = localStorage.getItem('token');
      const response = await api.put(
        `${API_URL}/api/threads/${thread._id}`,
        {
          ...editSettings,
          dueDate: editSettings.dueDate || null,
          module: editSettings.module || null,
          settings: {
            requirePostBeforeSee: editSettings.requirePostBeforeSee,
            allowLikes: editSettings.allowLikes,
            allowComments: editSettings.allowComments
          }
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setThread(response.data.data);
        setShowEditModal(false);
      }
    } catch (err) {
      logger.error('Error updating thread settings', err);
      setError('Failed to update thread settings');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 dark:border-blue-400"></div>
      </div>
    );
  }

  if (error || !thread) {
    return (
      <div className="text-red-500 dark:text-red-400 text-center p-4">
        {error || 'Thread not found'}
      </div>
    );
  }

  // Find feedback for the logged-in student
  let studentFeedback = '';
  if (user?.role === 'student' && Array.isArray(thread.studentGrades)) {
    const studentGradeObj = thread.studentGrades.find((g: any) => g.student && (g.student._id === user._id || g.student === user._id));
    if (studentGradeObj && typeof studentGradeObj.feedback === 'string' && studentGradeObj.feedback.trim() !== '') {
      studentFeedback = studentGradeObj.feedback;
    }
  }

  // Organize replies into a tree structure
  const replyMap = new Map<string, Reply[]>();
  const rootReplies: Reply[] = [];

  thread.replies.forEach(reply => {
    if (reply.parentReply) {
      if (!replyMap.has(reply.parentReply)) {
        replyMap.set(reply.parentReply, []);
      }
      replyMap.get(reply.parentReply)?.push(reply);
    } else {
      rootReplies.push(reply);
    }
  });

  // Check if the user has already replied to the main post
  const hasUserMainReply = thread.replies.some(
    (reply) => reply.parentReply === null && reply.author._id === user?._id
  );

  const renderReplies = (
    replies: Reply[],
    level: number = 0,
    onEdit: (replyId: string, content: string) => Promise<void>,
    onDelete: (replyId: string) => Promise<void>
  ) => {
    return replies.map(reply => (
      <React.Fragment key={reply._id}>
        <ReplyComponent
          reply={reply}
          onReply={handleReplyClick}
          level={level}
          onEdit={onEdit}
          onDelete={onDelete}
          canModify={user?._id === reply.author._id || user?.role === 'teacher'}
          threadId={thread._id}
          isReplying={replyingTo === reply._id}
          onSubmitReply={handleSubmitReply}
          replyContent={replyContent}
          setReplyContent={setReplyContent}
          setReplyingTo={setReplyingTo}
          onLike={handleLike}
          allowLikes={thread.settings?.allowLikes !== false}
        />
        {replyMap.get(reply._id) && renderReplies(replyMap.get(reply._id)!, level + 1, onEdit, onDelete)}
      </React.Fragment>
    ));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-8 px-2 sm:px-4">
      {/* Main Thread Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
            <div className="flex-1 w-full">
              <div className="flex flex-wrap items-center gap-2 mb-2 sm:mb-3">
                {thread.isPinned && (
                  <div className="flex items-center space-x-1 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/50 px-2 sm:px-3 py-1 rounded-full">
                    <Pin className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="text-xs sm:text-sm font-medium">Pinned</span>
                  </div>
                )}
                {thread.isGraded && (
                  <div className="flex items-center space-x-1 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/50 px-2 sm:px-3 py-1 rounded-full">
                    <Award className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="text-xs sm:text-sm font-medium">{thread.totalPoints} points</span>
                  </div>
                )}
              </div>
              
              {isEditing ? (
                <form onSubmit={handleEditThread} className="space-y-3 sm:space-y-4">
                  <label htmlFor="edit-thread-title" className="sr-only">Thread Title</label>
                  <input
                    type="text"
                    id="edit-thread-title"
                    name="editTitle"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100 p-2 sm:p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    placeholder="Thread title"
                  />
                  <label htmlFor="edit-thread-content" className="sr-only">Edit thread content</label>
                  <RichTextEditor
                    id="edit-thread-content"
                    name="editContent"
                    content={editContent}
                    onChange={setEditContent}
                    placeholder="Edit your thread content..."
                    className="min-h-[200px]"
                  />
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        setEditTitle(thread.title);
                        setEditContent(thread.content);
                      }}
                      className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || !editTitle.trim() || !editContent.trim()}
                      className="px-6 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4 break-words">{thread.title}</h1>
                  
                  {/* Author info */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 gap-2 sm:gap-0">
                    <div className="flex items-center space-x-2 sm:space-x-3">
                      <div className="relative">
                        <img
                          src={thread.author.profilePicture
                            ? (thread.author.profilePicture.startsWith('http')
                                ? thread.author.profilePicture
                                : getImageUrl(thread.author.profilePicture))
                            : thread.author.avatarUrl
                            ? (thread.author.avatarUrl.startsWith('http')
                                ? thread.author.avatarUrl
                                : getImageUrl(thread.author.avatarUrl))
                            : '/default-avatar.png'}
                          alt={thread.author.firstName}
                          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-white dark:border-gray-700 shadow-sm"
                          onError={e => (e.currentTarget.src = '/default-avatar.png')}
                        />

                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-100">
                            {thread.author.firstName} {thread.author.lastName}
                          </span>
                          
                        </div>
                        <div className="flex flex-wrap items-center gap-1 sm:gap-0 sm:space-x-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span>{formatDistanceToNow(new Date(thread.createdAt), { addSuffix: true })}</span>
                          </div>
                          {thread.dueDate && (
                            <>
                              <span className="hidden sm:inline">•</span>
                              <div className="flex items-center space-x-1">
                                <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                              <span className="text-orange-600 dark:text-orange-400">
                                Due {formatDistanceToNow(new Date(thread.dueDate), { addSuffix: true })}
                              </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {user?.role === 'teacher' && (
                      <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
                        <button
                          onClick={handleTogglePin}
                          className={`p-1.5 sm:p-2 rounded-lg transition-colors touch-manipulation ${
                            thread.isPinned
                              ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/50 hover:bg-amber-100 dark:hover:bg-amber-900/70'
                              : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                          title={thread.isPinned ? 'Unpin thread' : 'Pin thread'}
                        >
                          <Pin className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                        <button
                          onClick={() => {
                            setIsEditing(true);
                            setEditTitle(thread.title);
                            setEditContent(thread.content);
                          }}
                          className="p-1.5 sm:p-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/50 rounded-lg transition-colors touch-manipulation"
                          title="Edit thread"
                        >
                          <Edit3 className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                        <button
                          onClick={() => {
                            setEditSettings({
                              isGraded: thread.isGraded || false,
                              totalPoints: thread.totalPoints || 100,
                              group: thread.group || 'Discussions',
                              dueDate: thread.dueDate ? new Date(thread.dueDate).toISOString().split('T')[0] : '',
                              requirePostBeforeSee: thread.settings?.requirePostBeforeSee || false,
                              allowLikes: thread.settings?.allowLikes !== false,
                              allowComments: thread.settings?.allowComments !== false,
                              module: thread.module || ''
                            });
                            setShowEditModal(true);
                          }}
                          className="p-1.5 sm:p-2 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/50 rounded-lg transition-colors touch-manipulation"
                          title="Edit discussion settings"
                        >
                          <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                        <button
                          onClick={handleDeleteThread}
                          className="p-1.5 sm:p-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-lg transition-colors touch-manipulation"
                          title="Delete thread"
                        >
                          <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-6">
          {!isEditing && (
            <>
              <div 
                className="prose prose-lg prose-gray max-w-none mb-8 text-gray-800 dark:text-gray-300 leading-relaxed prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-800 dark:prose-p:text-gray-300"
                dangerouslySetInnerHTML={{ __html: thread.content }}
              />
              
              {/* Reply button */}
              {!hasUserMainReply && (!showReplyEditor ? (
                <button
                  onClick={() => setShowReplyEditor(true)}
                  className="w-full px-4 sm:px-6 py-3 sm:py-4 text-base sm:text-lg font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 border-dashed rounded-lg sm:rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:border-blue-300 dark:hover:border-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all duration-200 flex items-center justify-center space-x-2 touch-manipulation"
                >
                  <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Start the discussion</span>
                </button>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4 flex items-center space-x-2">
                    <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Post a Reply</span>
                  </h3>
                  <form onSubmit={e => handleSubmitReply(e, null)}>
                    <div onClick={(e) => e.stopPropagation()}>
                      <label htmlFor="thread-reply-content" className="sr-only">Thread reply content</label>
                      <RichTextEditor
                        id="thread-reply-content"
                        name="replyContent"
                        content={replyContent}
                        onChange={setReplyContent}
                        placeholder="Share your thoughts..."
                        className="mb-4"
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 sm:space-x-0">
                      <button
                        type="button"
                        onClick={() => {
                          setShowReplyEditor(false);
                          setReplyContent('');
                          
                          // Clear draft when canceling
                          if (threadId && user?._id) {
                            const draftKey = `thread_reply_draft_${threadId}_${user._id}`;
                            localStorage.removeItem(draftKey);
                          }
                        }}
                        className="w-full sm:w-auto px-4 sm:px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors touch-manipulation"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting || !replyContent.trim()}
                        className="w-full sm:w-auto px-4 sm:px-6 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2 touch-manipulation"
                      >
                        <Send className="w-4 h-4" />
                        <span>{isSubmitting ? 'Posting...' : 'Post Reply'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Grading Modal */}
      {showGradingModal && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <h2 className="text-base sm:text-xl font-semibold text-gray-800 dark:text-gray-100 flex items-center space-x-2">
                <Award className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="truncate">Grade Discussion - {selectedStudent.firstName} {selectedStudent.lastName}</span>
              </h2>
              <button
                onClick={() => setShowGradingModal(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
              {/* Left Panel - Student Posts */}
              <div className="flex-1 p-4 sm:p-6 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center space-x-2 mb-3">
                    <MessageSquare className="w-5 h-5" />
                    <span>Student's Posts in This Discussion</span>
                  </h3>
                  
                  {/* Filter student's replies */}
                  {(() => {
                    const studentReplies = thread?.replies?.filter(reply => 
                      reply.author._id === selectedStudent._id
                    ) || [];
                    
                    if (studentReplies.length === 0) {
                      return (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                          <p className="text-lg font-medium">No posts yet</p>
                          <p className="text-sm">This student hasn't posted in this discussion.</p>
                        </div>
                      );
                    }
                    
                    return (
                      <div className="space-y-4">
                        {studentReplies.map((reply, index) => (
                          <div key={reply._id} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400">{index + 1}</span>
                                </div>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Post #{index + 1}</span>
                              </div>
                              <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
                                <Clock className="w-3 h-3" />
                                <span>{formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}</span>
                              </div>
                            </div>
                            
                            <div 
                              className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300 leading-relaxed prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-700 dark:prose-p:text-gray-300"
                              dangerouslySetInnerHTML={{ __html: reply.content }}
                            />
                            
                            {reply.updatedAt !== reply.createdAt && (
                              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic">
                                Edited {formatDistanceToNow(new Date(reply.updatedAt), { addSuffix: true })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Right Panel - Grading Form */}
              <div className="w-full lg:w-96 p-4 sm:p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900">
                <form onSubmit={handleGradeSubmit}>
                  {gradingError && (
                    <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg flex items-center space-x-2">
                      <AlertCircle className="w-5 h-5" />
                      <span>{gradingError}</span>
                    </div>
                  )}

                  <div className="mb-4">
                    <label htmlFor="grade" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Grade (out of {thread?.totalPoints || 100})
                    </label>
                    <input
                      type="number"
                      id="grade"
                      value={grade ?? ''}
                      onChange={(e) => setGrade(e.target.value)}
                      min="0"
                      max={thread?.totalPoints || 100}
                      step="0.01"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div className="mb-6">
                    <label htmlFor="feedback" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Feedback
                    </label>
                    <textarea
                      id="feedback"
                      value={feedback ?? ''}
                      onChange={(e) => setFeedback(e.target.value)}
                      rows={6}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500"
                      placeholder="Enter feedback for the student..."
                    />
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowGradingModal(false)}
                      className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isGrading}
                      className="px-6 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 border border-transparent rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isGrading ? 'Submitting...' : 'Submit Grade'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Settings Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-gray-100 flex items-center space-x-2">
                <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Edit Thread Settings</span>
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSettings} className="p-6">
              <div className="mb-4">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={editSettings.isGraded}
                    onChange={(e) => setEditSettings(prev => ({
                      ...prev,
                      isGraded: e.target.checked
                    }))}
                    className="rounded border-gray-300 dark:border-gray-700 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-900"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Make this a graded discussion
                  </span>
                </label>
              </div>

              {/* Module Selection */}
              <div className="mb-4">
                <label htmlFor="module" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Module
                </label>
                <select
                  id="module"
                  value={editSettings.module}
                  onChange={(e) => setEditSettings(prev => ({
                    ...prev,
                    module: e.target.value
                  }))}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500"
                >
                  <option value="">No module</option>
                  {modules.map((module) => (
                    <option key={module._id} value={module._id}>{module.title}</option>
                  ))}
                </select>
              </div>

              {editSettings.isGraded && (
                <>
                  <div className="mb-4">
                    <label htmlFor="totalPoints" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Total Points
                    </label>
                    <input
                      type="number"
                      id="totalPoints"
                      value={editSettings.totalPoints}
                      onChange={(e) => setEditSettings(prev => ({
                        ...prev,
                        totalPoints: parseInt(e.target.value) || 0
                      }))}
                      min="0"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label htmlFor="group" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Assignment Group
                    </label>
                    <select
                      id="group"
                      value={editSettings.group}
                      onChange={(e) => setEditSettings(prev => ({
                        ...prev,
                        group: e.target.value
                      }))}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500"
                      required
                    >
                      <option value="Discussions">Discussions</option>
                      <option value="Assignments">Assignments</option>
                      <option value="Projects">Projects</option>
                      <option value="Exams">Exams</option>
                    </select>
                  </div>

                  <div className="mb-6">
                    <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Due Date
                    </label>
                    <input
                      type="date"
                      id="dueDate"
                      value={editSettings.dueDate}
                      onChange={(e) => setEditSettings(prev => ({
                        ...prev,
                        dueDate: e.target.value
                      }))}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500"
                    />
                  </div>
                </>
              )}

              {/* Discussion Settings */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Discussion Settings</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="requirePostBeforeSee"
                      checked={editSettings.requirePostBeforeSee}
                      onChange={(e) => setEditSettings(prev => ({
                        ...prev,
                        requirePostBeforeSee: e.target.checked
                      }))}
                      className="h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900"
                    />
                    <label htmlFor="requirePostBeforeSee" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                      Users must post before seeing replies
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="allowLikes"
                      checked={editSettings.allowLikes}
                      onChange={(e) => setEditSettings(prev => ({
                        ...prev,
                        allowLikes: e.target.checked
                      }))}
                      className="h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900"
                    />
                    <label htmlFor="allowLikes" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                      Allow liking
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="allowComments"
                      checked={editSettings.allowComments}
                      onChange={(e) => setEditSettings(prev => ({
                        ...prev,
                        allowComments: e.target.checked
                      }))}
                      className="h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900"
                    />
                    <label htmlFor="allowComments" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                      Allow comments
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 border border-transparent rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Grades Section (for teachers) */}
      {isTeacher && thread?.isGraded && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center space-x-2">
              <Award className="w-5 h-5" />
              <span>Student Grades</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Student</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Grade</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Feedback</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Graded By</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {students.map((student) => {
                  const gradeObj = thread.studentGrades.find(g => g.student._id === student._id);
                  return (
                    <tr key={student._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className="relative">
                            {student.profilePicture ? (
                              <img
                                src={student.profilePicture.startsWith('http')
                                  ? student.profilePicture
                                  : getImageUrl(student.profilePicture)}
                                alt={`${student.firstName} ${student.lastName}`}
                                className="w-8 h-8 rounded-full object-cover border-2 border-gray-100 dark:border-gray-700"
                                onError={(e) => {
                                  // Hide the failed image and show fallback
                                  e.currentTarget.style.display = 'none';
                                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                  if (fallback) {
                                    fallback.style.display = 'flex';
                                  }
                                }}
                              />
                            ) : null}
                            {/* Fallback avatar - always present but hidden when image loads */}
                            <div 
                              className={`w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center ${student.profilePicture ? 'hidden' : ''}`}
                              style={{ display: student.profilePicture ? 'none' : 'flex' }}
                            >
                              <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                          </div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{student.firstName} {student.lastName}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-gray-100">
                          {gradeObj ? `${Number.isInteger(gradeObj.grade) ? gradeObj.grade : Number(gradeObj.grade).toFixed(2)} / ${thread.totalPoints}` : '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate">{gradeObj?.feedback || '-'}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-gray-100">{gradeObj?.gradedBy ? `${gradeObj.gradedBy.firstName} ${gradeObj.gradedBy.lastName}` : '-'}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{gradeObj?.gradedAt ? new Date(gradeObj.gradedAt).toLocaleString() : ''}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => openGradingModal(student)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 transition-colors"
                        >
                          {gradeObj ? 'Edit Grade' : 'Add Grade'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Replies Section */}
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Replies</h2>
          <div className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400">
            <MessageSquare className="w-4 h-4" />
            <span>{rootReplies.length} {rootReplies.length === 1 ? 'reply' : 'replies'}</span>
          </div>
        </div>
        {renderReplies(rootReplies, 0, handleEditReply, handleDeleteReply)}
      </div>
    </div>
  );
};

export default ThreadView; 