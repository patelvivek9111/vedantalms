import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { API_URL } from '../config';
import { getImageUrl } from '../utils/apiUtils';
import RichTextEditor from './RichTextEditor';
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
  Settings
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
  studentGrades: StudentGrade[];
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
  setReplyingTo
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
      console.error('Error editing reply:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this reply?')) {
      try {
        await onDelete(reply._id);
      } catch (error) {
        console.error('Error deleting reply:', error);
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
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200 overflow-hidden">
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
                  className="w-10 h-10 rounded-full object-cover border-2 border-gray-100"
                  onError={e => (e.currentTarget.src = '/default-avatar.png')}
                />

              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-gray-900">
                    {reply.author.firstName} {reply.author.lastName}
                  </span>

                </div>
                <div className="flex items-center space-x-1 text-sm text-gray-500">
                  <Clock className="w-3 h-3" />
                  <span>{formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}</span>
                </div>
              </div>
            </div>
            
            {isAuthorOrTeacher && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                  title="More options"
                  aria-label="More options"
                >
                  <MoreVertical className="w-4 h-4 text-gray-600" />
                </button>
                
                {showMenu && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                    <button
                      onClick={() => {
                        setIsEditing(true);
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => {
                        handleDelete();
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
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
              <RichTextEditor
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
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !editContent.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <>
              <div 
                className="prose prose-gray max-w-none mb-4 text-gray-800 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: reply.content }}
              />
              
              {/* Reply button */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <button
                  onClick={() => onReply(reply._id)}
                  className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  <Reply className="w-4 h-4" />
                  <span>Reply</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Nested reply form */}
      {isReplying && (
        <div className="mt-3 ml-6">
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-4 flex items-center space-x-2">
              <Reply className="w-4 h-4" />
              <span>Reply to {reply.author.firstName}</span>
            </h4>
            <form onSubmit={e => onSubmitReply(e, reply._id)}>
              <RichTextEditor
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
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !replyContent.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
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
  const { courseId, threadId } = useParams<{ courseId: string; threadId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [thread, setThread] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    dueDate: ''
  });

  // Add state for students
  const [students, setStudents] = useState<{ _id: string; firstName: string; lastName: string; profilePicture?: string }[]>([]);

  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';

  useEffect(() => {
    const fetchThreadAndStudents = async () => {
      if (!courseId || !threadId) {
        setError('Invalid course or thread ID');
        setLoading(false);
        return;
      }
      try {
        const token = localStorage.getItem('token');
        // Fetch thread
        const threadRes = await api.get(`${API_URL}/api/threads/${threadId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (threadRes.data.success) {
          if (threadRes.data.data.course !== courseId) {
            setError('Thread not found in this course');
            setLoading(false);
            return;
          }
          setThread(threadRes.data.data);
        } else {
          setError('Failed to load thread');
        }
        // Fetch course to get students
        const courseRes = await api.get(`${API_URL}/api/courses/${courseId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (courseRes.data.success) {
          setStudents(courseRes.data.data.students || []);
        }
      } catch (err) {
        console.error('Error fetching thread or students:', err);
        setError('Failed to load thread or students');
      } finally {
        setLoading(false);
      }
    };
    fetchThreadAndStudents();
  }, [courseId, threadId]);

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
        setReplyingTo(null);
        setShowReplyEditor(false);
      }
    } catch (error) {
      console.error('Error posting reply:', error);
    } finally {
      setIsSubmitting(false);
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
      console.error('Error updating thread:', error);
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
      console.error('Error deleting thread:', error);
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
      console.error('Error toggling pin status:', error);
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
      console.error('Error updating reply:', error);
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
      console.error('Error deleting reply:', error);
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
      console.error('Error submitting grade:', err);
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
          dueDate: editSettings.dueDate || null
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
      console.error('Error updating thread settings:', err);
      setError('Failed to update thread settings');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !thread) {
    return (
      <div className="text-red-500 text-center p-4">
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
        />
        {replyMap.get(reply._id) && renderReplies(replyMap.get(reply._id)!, level + 1, onEdit, onDelete)}
      </React.Fragment>
    ));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Main Thread Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-3">
                {thread.isPinned && (
                  <div className="flex items-center space-x-1 text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                    <Pin className="w-4 h-4" />
                    <span className="text-sm font-medium">Pinned</span>
                  </div>
                )}
                {thread.isGraded && (
                  <div className="flex items-center space-x-1 text-green-600 bg-green-50 px-3 py-1 rounded-full">
                    <Award className="w-4 h-4" />
                    <span className="text-sm font-medium">{thread.totalPoints} points</span>
                  </div>
                )}
              </div>
              
              {isEditing ? (
                <form onSubmit={handleEditThread} className="space-y-4">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full text-2xl font-bold text-gray-900 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Thread title"
                  />
                  <RichTextEditor
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
                      className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || !editTitle.trim() || !editContent.trim()}
                      className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <h1 className="text-3xl font-bold text-gray-900 mb-4">{thread.title}</h1>
                  
                  {/* Author info */}
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-3">
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
                          className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                          onError={e => (e.currentTarget.src = '/default-avatar.png')}
                        />

                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-gray-900">
                            {thread.author.firstName} {thread.author.lastName}
                          </span>
                          
                        </div>
                        <div className="flex items-center space-x-1 text-sm text-gray-500">
                          <Clock className="w-4 h-4" />
                          <span>{formatDistanceToNow(new Date(thread.createdAt), { addSuffix: true })}</span>
                          {thread.dueDate && (
                            <>
                              <span>•</span>
                              <Calendar className="w-4 h-4" />
                              <span className="text-orange-600">
                                Due {formatDistanceToNow(new Date(thread.dueDate), { addSuffix: true })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {user?.role === 'teacher' && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={handleTogglePin}
                          className={`p-2 rounded-lg transition-colors ${
                            thread.isPinned
                              ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                          }`}
                          title={thread.isPinned ? 'Unpin thread' : 'Pin thread'}
                        >
                          <Pin className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => {
                            setIsEditing(true);
                            setEditTitle(thread.title);
                            setEditContent(thread.content);
                          }}
                          className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit thread"
                        >
                          <Edit3 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={handleDeleteThread}
                          className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete thread"
                        >
                          <Trash2 className="w-5 h-5" />
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
        <div className="p-6">
          {!isEditing && (
            <>
              <div 
                className="prose prose-lg prose-gray max-w-none mb-8 text-gray-800 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: thread.content }}
              />
              
              {/* Reply button */}
              {!hasUserMainReply && (!showReplyEditor ? (
                <button
                  onClick={() => setShowReplyEditor(true)}
                  className="w-full px-6 py-4 text-lg font-medium text-blue-600 bg-blue-50 border-2 border-blue-200 border-dashed rounded-xl hover:bg-blue-100 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 flex items-center justify-center space-x-2"
                >
                  <MessageSquare className="w-5 h-5" />
                  <span>Start the discussion</span>
                </button>
              ) : (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                    <MessageSquare className="w-5 h-5" />
                    <span>Post a Reply</span>
                  </h3>
                  <form onSubmit={e => handleSubmitReply(e, null)}>
                    <div onClick={(e) => e.stopPropagation()}>
                      <RichTextEditor
                        content={replyContent}
                        onChange={setReplyContent}
                        placeholder="Share your thoughts..."
                        className="mb-4"
                      />
                    </div>
                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowReplyEditor(false);
                          setReplyContent('');
                        }}
                        className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting || !replyContent.trim()}
                        className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center space-x-2">
                <Award className="w-5 h-5" />
                <span>Grade Discussion - {selectedStudent.firstName} {selectedStudent.lastName}</span>
              </h2>
              <button
                onClick={() => setShowGradingModal(false)}
                className="text-gray-500 hover:text-gray-700 focus:outline-none p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGradeSubmit} className="p-6">
              {gradingError && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5" />
                  <span>{gradingError}</span>
                </div>
              )}

              <div className="mb-4">
                <label htmlFor="grade" className="block text-sm font-medium text-gray-700 mb-2">
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div className="mb-6">
                <label htmlFor="feedback" className="block text-sm font-medium text-gray-700 mb-2">
                  Feedback
                </label>
                <textarea
                  id="feedback"
                  value={feedback ?? ''}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter feedback for the student..."
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowGradingModal(false)}
                  className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGrading}
                  className="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isGrading ? 'Submitting...' : 'Submit Grade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Settings Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center space-x-2">
                <Settings className="w-5 h-5" />
                <span>Edit Thread Settings</span>
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-500 hover:text-gray-700 focus:outline-none p-2 rounded-lg hover:bg-gray-100 transition-colors"
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
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Make this a graded discussion
                  </span>
                </label>
              </div>

              {editSettings.isGraded && (
                <>
                  <div className="mb-4">
                    <label htmlFor="totalPoints" className="block text-sm font-medium text-gray-700 mb-2">
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label htmlFor="group" className="block text-sm font-medium text-gray-700 mb-2">
                      Assignment Group
                    </label>
                    <select
                      id="group"
                      value={editSettings.group}
                      onChange={(e) => setEditSettings(prev => ({
                        ...prev,
                        group: e.target.value
                      }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="Discussions">Discussions</option>
                      <option value="Assignments">Assignments</option>
                      <option value="Projects">Projects</option>
                      <option value="Exams">Exams</option>
                    </select>
                  </div>

                  <div className="mb-6">
                    <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-2">
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 transition-colors"
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-3 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
              <Award className="w-5 h-5" />
              <span>Student Grades</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grade</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Feedback</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Graded By</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {students.map((student) => {
                  const gradeObj = thread.studentGrades.find(g => g.student._id === student._id);
                  return (
                    <tr key={student._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className="relative">
                            {student.profilePicture ? (
                              <img
                                src={student.profilePicture.startsWith('http')
                                  ? student.profilePicture
                                  : getImageUrl(student.profilePicture)}
                                alt={`${student.firstName} ${student.lastName}`}
                                className="w-8 h-8 rounded-full object-cover border-2 border-gray-100"
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
                              className={`w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center ${student.profilePicture ? 'hidden' : ''}`}
                              style={{ display: student.profilePicture ? 'none' : 'flex' }}
                            >
                              <User className="w-4 h-4 text-blue-600" />
                            </div>
                          </div>
                          <div className="text-sm font-medium text-gray-900">{student.firstName} {student.lastName}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {gradeObj ? `${Number.isInteger(gradeObj.grade) ? gradeObj.grade : Number(gradeObj.grade).toFixed(2)} / ${thread.totalPoints}` : '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900 max-w-xs truncate">{gradeObj?.feedback || '-'}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{gradeObj?.gradedBy ? `${gradeObj.gradedBy.firstName} ${gradeObj.gradedBy.lastName}` : '-'}</div>
                        <div className="text-xs text-gray-500">{gradeObj?.gradedAt ? new Date(gradeObj.gradedAt).toLocaleString() : ''}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => openGradingModal(student)}
                          className="text-blue-600 hover:text-blue-900 transition-colors"
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
          <h2 className="text-2xl font-bold text-gray-900">Replies</h2>
          <div className="flex items-center space-x-1 text-sm text-gray-500">
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