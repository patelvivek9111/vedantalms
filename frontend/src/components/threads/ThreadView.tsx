import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import api, { getImageUrl } from '../../services/api';
import { API_URL } from '../../config';
import RichTextEditor from '../common/RichTextEditor';
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
  Heart,
  Lock,
  EyeOff,
  RotateCcw
} from 'lucide-react';
import ConfirmationModal from '../common/ConfirmationModal';
import PullToRefresh from '../common/PullToRefresh';
import DiscussionReplyComposer from '../discussions/DiscussionReplyComposer';
import BackButton from '../common/BackButton';
import { useMobileLayout } from '../../hooks/useMobileLayout';
import FileAttachmentChips from '../files/FileAttachmentChips';
import FileAttachmentPanel, { normalizeLegacyFiles } from '../files/FileAttachmentPanel';
import type { NormalizedFile } from '../../utils/fileTypes';
import { deriveDiscussionWorkflowState, sanitizeDiscussionHtml } from '../../utils/discussionWorkflowStatus';
import { resolveDiscussionStatus, type DiscussionStatus } from '../../utils/discussionStatus';
import { normalizeMongoIdRef } from '../../utils/mongoId';

function formatDiscussionDue(d: Date): string {
  return format(d, "MMM d 'at' h:mmaaa");
}

function formatGradePointsValue(grade: number): string {
  const value = Number(grade);
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1).replace(/\.0$/, '');
}

function renderGradeScoreBadge(grade: number | null | undefined, totalPoints: number): React.ReactNode {
  const total = Math.max(0, Math.round(Number(totalPoints) || 0));
  if (total <= 0) return <span className="text-slate-400">—</span>;

  const hasGrade = typeof grade === 'number' && !Number.isNaN(grade);
  const earnedDisplay = hasGrade ? formatGradePointsValue(grade) : '—';
  const isPerfect = hasGrade && Number(grade) >= total;

  return (
    <span className="inline-flex items-baseline gap-px rounded-md bg-slate-100/90 px-2 py-1 tabular-nums dark:bg-slate-800/80">
      <span
        className={
          hasGrade
            ? isPerfect
              ? 'text-sm font-semibold text-emerald-700 dark:text-emerald-400'
              : 'text-sm font-semibold text-slate-900 dark:text-slate-100'
            : 'text-sm font-medium text-slate-400 dark:text-slate-500'
        }
      >
        {earnedDisplay}
      </span>
      <span className="text-sm text-slate-400 dark:text-slate-500">/</span>
      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{total}</span>
    </span>
  );
}

const composerKeyForReply = (parentId: string | null) => (parentId ? `reply-${parentId}` : 'main');

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
  fileAssets?: Array<string | Record<string, unknown>>;
  childCount?: number;
  moderationState?: 'active' | 'hidden' | 'flagged' | 'archived';
  hiddenByModerator?: boolean;
  isHidden?: boolean;
  isDeleted?: boolean;
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
  availableFrom?: string | null;
  locked?: boolean;
  lockAfterDue?: boolean;
  archivedAt?: string | null;
  discussionReleaseMode?: 'immediate' | 'manual' | 'hidden';
  gradesReleasedAt?: string | null;
  gradeHidden?: boolean;
  module?: string;
  studentGrades: StudentGrade[];
  settings?: {
    requirePostBeforeSee: boolean;
    allowLikes: boolean;
    allowComments: boolean;
  };
  fileAssets?: Array<string | Record<string, unknown>>;
  workflowState?: ReturnType<typeof deriveDiscussionWorkflowState>;
  repliesHiddenUntilPost?: boolean;
  repliesPagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  discussionStatus?: DiscussionStatus;
  unreadCount?: number;
  hasPosted?: boolean;
  hasInstructorReply?: boolean;
  lastViewedAt?: string | null;
  currentUserParticipation?: {
    unreadCount?: number;
    hasPosted?: boolean;
    hasInstructorReply?: boolean;
    lastViewedAt?: string | null;
  };
}

interface ReplyComponentProps {
  reply: Reply;
  onReply: (parentId: string) => void;
  level: number;
  onEdit: (replyId: string, payload: { content: string; fileAssetIds: string[]; removeFileAssetIds: string[] }) => Promise<void>;
  onDelete: (replyId: string) => Promise<void>;
  canModify: boolean;
  threadId: string;
  isReplying: boolean;
  onSubmitReply: (e: React.FormEvent, parentReply: string) => void;
  replyContent: string;
  setReplyContent: (content: string) => void;
  setReplyingTo: (id: string | null) => void;
  onLike: (replyId: string) => Promise<void>;
  onHide: (replyId: string) => Promise<void>;
  onRestore: (replyId: string) => Promise<void>;
  onLoadChildren: (replyId: string) => Promise<void>;
  loadedChildCount: number;
  allowLikes: boolean;
  replyAttachmentFiles: NormalizedFile[];
  onAttachmentsChange: (files: NormalizedFile[]) => void;
  courseId?: string;
  courseArchived?: boolean;
  canPostDiscussion?: boolean;
  isSubmittingReply?: boolean;
  replyError?: string | null;
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
  onHide,
  onRestore,
  onLoadChildren,
  loadedChildCount,
  allowLikes,
  replyAttachmentFiles,
  onAttachmentsChange,
  courseId,
  courseArchived,
  canPostDiscussion = true,
  isSubmittingReply,
  replyError,
}) => {
  const isMobileLayout = useMobileLayout();
  const composerRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(reply.content);
  const [editAttachments, setEditAttachments] = useState<NormalizedFile[]>([]);
  const [editRemoveIds, setEditRemoveIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const [showDeleteReplyConfirm, setShowDeleteReplyConfirm] = useState(false);

  const isModerator = ['teacher', 'teaching_assistant', 'admin'].includes(user?.role || '');
  const isAuthorOrTeacher = String(user?._id) === String(reply.author._id) || isModerator;
  const replyHidden = reply.isHidden || reply.moderationState === 'hidden';

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

  useEffect(() => {
    if (isReplying && composerRef.current) {
      composerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isReplying]);

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editContent.trim()) return;
    setIsSubmitting(true);
    try {
      const fileAssetIds = editAttachments.map((f) => f.fileAssetId).filter(Boolean) as string[];
      await onEdit(reply._id, { content: editContent, fileAssetIds, removeFileAssetIds: editRemoveIds });
      setIsEditing(false);
      setEditRemoveIds([]);
    } catch (error) {
      } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    setShowDeleteReplyConfirm(true);
  };

  const confirmDelete = async () => {
    setShowDeleteReplyConfirm(false);
      try {
        await onDelete(reply._id);
      } catch (error) {
    }
  };

  // Modern card-style reply UI
  return (
    <div
      style={{
        marginLeft: isMobileLayout
          ? `${Math.min(level * 12, 36)}px`
          : `${Math.min(level * 32, 96)}px`,
      }}
      className="mb-4 lg:mb-6"
      role="article"
      aria-label={`Reply by ${reply.author.firstName} ${reply.author.lastName}, level ${level + 1}`}
    >
              <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border overflow-hidden transition-shadow duration-200 hover:shadow-md ${
                isReplying
                  ? 'border-indigo-300 ring-2 ring-indigo-500/30 dark:border-indigo-600'
                  : 'border-gray-100 dark:border-gray-700'
              }`}>
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
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  <span>{formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}</span>
                </div>
              </div>
            </div>
            
            {isAuthorOrTeacher && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full p-2 transition-colors duration-200 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 dark:hover:bg-gray-700"
                  title="More options"
                  aria-label={`More options for reply by ${reply.author.firstName} ${reply.author.lastName}`}
                  aria-expanded={showMenu}
                  aria-haspopup="menu"
                >
                  <MoreVertical className="w-4 h-4 text-gray-600 dark:text-gray-400" aria-hidden="true" />
                </button>
                
                {showMenu && (
                  <div role="menu" className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
                    <button
                      role="menuitem"
                      onClick={() => {
                        setIsEditing(true);
                        setEditAttachments(normalizeLegacyFiles(reply.fileAssets || []));
                        setEditRemoveIds([]);
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center space-x-2"
                    >
                      <Edit3 className="w-4 h-4" aria-hidden="true" />
                      <span>Edit</span>
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => {
                        handleDelete();
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 flex items-center space-x-2"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                      <span>Delete</span>
                    </button>
                    {isModerator && !replyHidden && (
                      <button
                        role="menuitem"
                        onClick={() => {
                          onHide(reply._id);
                          setShowMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/50 flex items-center space-x-2"
                        aria-label="Hide reply"
                      >
                        <EyeOff className="w-4 h-4" aria-hidden="true" />
                        <span>Hide</span>
                      </button>
                    )}
                    {isModerator && replyHidden && (
                      <button
                        role="menuitem"
                        onClick={() => {
                          onRestore(reply._id);
                          setShowMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/50 flex items-center space-x-2"
                        aria-label="Restore reply"
                      >
                        <RotateCcw className="w-4 h-4" aria-hidden="true" />
                        <span>Restore</span>
                      </button>
                    )}
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
              <FileAttachmentPanel
                files={editAttachments}
                onChange={setEditAttachments}
                courseId={courseId}
                category="discussion"
                label="Attachments"
                onRemoveFile={(file) => {
                  if (file.fileAssetId) setEditRemoveIds((prev) => [...prev, file.fileAssetId!]);
                }}
              />
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(reply.content);
                    setEditAttachments(normalizeLegacyFiles(reply.fileAssets || []));
                    setEditRemoveIds([]);
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
              {replyHidden || reply.isDeleted ? (
                <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300" role="status">
                  {replyHidden ? 'This reply is hidden by a moderator.' : 'This reply was deleted.'}
                </div>
              ) : (
                <>
                  <div 
                    className="prose prose-gray max-w-none mb-4 text-gray-800 dark:text-gray-300 leading-relaxed prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-800 dark:prose-p:text-gray-300"
                    dangerouslySetInnerHTML={{ __html: sanitizeDiscussionHtml(reply.content) }}
                  />
                  <FileAttachmentChips files={reply.fileAssets} className="mb-2" />
                </>
              )}
              
              {/* Reply button */}
              <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between sm:pt-4">
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                  <button
                    onClick={() => onReply(reply._id)}
                    disabled={!canPostDiscussion}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700 disabled:opacity-50 dark:text-indigo-400 dark:hover:text-indigo-300"
                    aria-label={`Reply to ${reply.author.firstName} ${reply.author.lastName}`}
                  >
                    <Reply className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Reply</span>
                  </button>
                  
                  {allowLikes && (
                    <button
                      onClick={() => onLike(reply._id)}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm font-medium text-slate-600 transition-colors hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
                      aria-label={`Like reply by ${reply.author.firstName} ${reply.author.lastName}; ${reply.likes?.length || 0} likes`}
                    >
                      <Heart 
                        className={`w-4 h-4 ${
                          reply.likes?.some(like => like.user._id === user?._id) 
                            ? 'fill-red-500 text-red-500' 
                            : ''
                        }`} 
                        aria-hidden="true"
                      />
                      <span>{reply.likes?.length || 0}</span>
                    </button>
                  )}
                  {(reply.childCount || 0) > loadedChildCount && (
                    <button
                      type="button"
                      onClick={() => onLoadChildren(reply._id)}
                      className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
                      aria-label={`Load ${reply.childCount} child replies`}
                    >
                      <MessageSquare className="w-4 h-4" aria-hidden="true" />
                      <span>Show replies ({reply.childCount})</span>
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Inline reply form — appears directly under the reply being answered */}
      {isReplying && (
        <div ref={composerRef} className="mt-3 mb-4 min-w-0 lg:mb-0">
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/90 p-3 dark:border-slate-700 dark:bg-slate-800/50 sm:p-4">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Reply className="h-4 w-4 shrink-0" />
              <span>Reply to {reply.author.firstName}</span>
            </h4>
            <DiscussionReplyComposer
              content={replyContent}
              onContentChange={setReplyContent}
              attachmentFiles={replyAttachmentFiles}
              onAttachmentsChange={onAttachmentsChange}
              courseId={courseId}
              courseArchived={courseArchived || !canPostDiscussion}
              onSubmit={(e) => onSubmitReply(e, reply._id)}
              onCancel={() => {
                setReplyingTo(null);
                setReplyContent('');
                onAttachmentsChange([]);
              }}
              isSubmitting={isSubmittingReply || isSubmitting}
              submitLabel="Post reply"
              layout={isMobileLayout ? 'inline' : 'default'}
              compact={!isMobileLayout}
            />
            {replyError && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200" role="alert">
                {replyError}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Delete Reply Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteReplyConfirm}
        onClose={() => setShowDeleteReplyConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete Reply"
        message="Are you sure you want to delete this reply? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
};

const ThreadView: React.FC = () => {
  const { courseId, threadId, groupId } = useParams<{ courseId?: string; threadId: string; groupId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobileLayout = useMobileLayout();
  const [thread, setThread] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedCourseId, setResolvedCourseId] = useState<string | null>(courseId || null);
  const [replyContent, setReplyContent] = useState('');
  const [attachmentByComposer, setAttachmentByComposer] = useState<Record<string, NormalizedFile[]>>({});
  const [editThreadAttachments, setEditThreadAttachments] = useState<NormalizedFile[]>([]);
  const [editThreadRemoveIds, setEditThreadRemoveIds] = useState<string[]>([]);
  const [replyError, setReplyError] = useState<string | null>(null);
  const replyAttemptKeyRef = useRef<string | null>(null);

  const getComposerAttachments = (key: string) => attachmentByComposer[key] || [];
  const setComposerAttachments = (key: string, files: NormalizedFile[]) => {
    setAttachmentByComposer((prev) => ({ ...prev, [key]: files }));
  };
  const [courseArchived, setCourseArchived] = useState(false);
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
  const [showDeleteThreadConfirm, setShowDeleteThreadConfirm] = useState(false);
  const [lazyChildren, setLazyChildren] = useState<Record<string, Reply[]>>({});
  const [loadingChildren, setLoadingChildren] = useState<Record<string, boolean>>({});

  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';
  const isModerator = ['teacher', 'teaching_assistant', 'admin'].includes(user?.role || '');

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
          setError('Failed to load group information');
          setLoading(false);
        }
      } else if (courseId) {
        setResolvedCourseId(courseId);
      }
    };
    fetchGroupCourseId();
  }, [groupId, courseId]);

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
      const threadRes = await api.get(`/threads/${threadId}${isModerator ? '?includeGrades=true' : ''}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (threadRes.data.success) {
        const threadCourseNorm = normalizeMongoIdRef(threadRes.data.data.course);
        const routeCourseNorm = normalizeMongoIdRef(resolvedCourseId);
        if (threadCourseNorm !== routeCourseNorm) {
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
            const threadData = participantRes.data.data;
            setThread({
              ...threadData,
              replies: Array.isArray(threadData.replies) ? threadData.replies : []
            });
          } else {
            const threadData = threadRes.data.data;
            setThread({
              ...threadData,
              replies: Array.isArray(threadData.replies) ? threadData.replies : []
            });
          }
        } else {
          const threadData = threadRes.data.data;
          setThread({
            ...threadData,
            replies: Array.isArray(threadData.replies) ? threadData.replies : []
          });
        }
      } else {
        setError('Failed to load thread');
      }
        // Fetch course to get students
        const courseRes = await api.get(`/courses/${resolvedCourseId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (courseRes.data.success) {
          const courseData = courseRes.data.data;
          const studentsData = courseData.students;
          setStudents(Array.isArray(studentsData) ? studentsData : []);
          setCourseArchived(courseData.operationalStatus === 'archived');
        }
        
        // Fetch modules for the course
        const modulesRes = await api.get(`/modules/${resolvedCourseId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (modulesRes.data.success) {
          setModules(modulesRes.data.data || []);
        }
    } catch (err) {
      setError('Failed to load thread or students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThreadAndStudents();
  }, [resolvedCourseId, threadId, groupId, user?._id]);

  useEffect(() => {
    if (!thread?._id) return;
    const markRead = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await api.post(`/threads/${thread._id}/mark-read`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data.success) {
          setThread((prev) => prev ? {
            ...prev,
            unreadCount: 0,
            lastViewedAt: res.data.data.lastViewedAt,
            currentUserParticipation: res.data.data,
          } : prev);
        }
      } catch {
        // Read-state failure should not block discussion viewing.
      }
    };
    markRead();
  }, [thread?._id]);

  // Refresh function for pull-to-refresh
  const handleRefresh = async () => {
    await fetchThreadAndStudents();
  };

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
    if (!canPostDiscussion) return;
    const textPlain = replyContent.replace(/<[^>]+>/g, '').trim();
    const composerKey = composerKeyForReply(parentReply);
    const composerFiles = getComposerAttachments(composerKey);
    if (!thread || (!textPlain && !composerFiles.length)) return;

    setIsSubmitting(true);
    setReplyError(null);
    if (!replyAttemptKeyRef.current) {
      replyAttemptKeyRef.current = `${thread._id}-${user?._id || 'anonymous'}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    try {
      const token = localStorage.getItem('token');
      const fileAssetIds = composerFiles.map((f) => f.fileAssetId).filter(Boolean);
      const response = await api.post(
        `${API_URL}/api/threads/${thread._id}/replies`,
        { 
          content: replyContent,
          parentReply: parentReply || null,
          fileAssetIds,
          idempotencyKey: replyAttemptKeyRef.current,
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setThread(response.data.data);
        setReplyContent('');
        setComposerAttachments(composerKey, []);
        setReplyingTo(null);
        setShowReplyEditor(false);
        
        // Clear draft from localStorage after successful reply
        if (threadId && user?._id) {
          const draftKey = `thread_reply_draft_${threadId}_${user._id}`;
          localStorage.removeItem(draftKey);
        }
        replyAttemptKeyRef.current = null;
        
        setReplyingTo(null);
        setShowReplyEditor(false);
      }
    } catch (error) {
      setReplyError('We could not post your reply. Your draft is still here; retry when the connection recovers.');
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
      }
  };

  const handleEditThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thread || !editTitle.trim() || !editContent.trim()) return;

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const fileAssetIds = editThreadAttachments.map((f) => f.fileAssetId).filter(Boolean);
      const response = await api.put(
        `${API_URL}/api/threads/${thread._id}`,
        {
          title: editTitle,
          content: editContent,
          fileAssetIds,
          removeFileAssetIds: editThreadRemoveIds,
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
      } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteThread = () => {
    if (!thread) return;
    setShowDeleteThreadConfirm(true);
  };

  const confirmDeleteThread = async () => {
    if (!thread) return;
    setShowDeleteThreadConfirm(false);
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
      }
  };

  const handleToggleLock = async () => {
    if (!thread || !isModerator) return;
    try {
      const token = localStorage.getItem('token');
      const endpoint = thread.locked ? 'unlock' : 'lock';
      const response = await api.post(
        `${API_URL}/api/threads/${thread._id}/${endpoint}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        setThread(response.data.data);
      }
    } catch {
      // Moderator action errors are surfaced by the existing refresh/error flow.
    }
  };

  const handleEditReply = async (
    replyId: string,
    payload: { content: string; fileAssetIds: string[]; removeFileAssetIds: string[] }
  ) => {
    if (!thread) return;

    try {
      const token = localStorage.getItem('token');
      const response = await api.put(
        `${API_URL}/api/threads/${thread._id}/replies/${replyId}`,
        payload,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setThread(response.data.data);
      }
    } catch (error) {
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
        const threadData = response.data.data;
        setThread({
          ...threadData,
          replies: Array.isArray(threadData.replies) ? threadData.replies : []
        });
        const replies = Array.isArray(threadData.replies) ? threadData.replies : [];
        const hasUserReplies = replies.some(
          (reply: Reply) => reply.author._id === user?._id
        );
        if (!hasUserReplies) {
          setShowReplyEditor(false);
        }
      }
    } catch (error) {
      throw error;
    }
  };

  const handleHideReply = async (replyId: string) => {
    if (!isModerator) return;
    const token = localStorage.getItem('token');
    const response = await api.post(
      `${API_URL}/api/replies/${replyId}/hide`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (response.data.success) {
      await fetchThreadAndStudents();
    }
  };

  const handleRestoreReply = async (replyId: string) => {
    if (!isModerator) return;
    const token = localStorage.getItem('token');
    const response = await api.post(
      `${API_URL}/api/replies/${replyId}/restore`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (response.data.success) {
      await fetchThreadAndStudents();
    }
  };

  const handleLoadChildren = async (replyId: string) => {
    if (loadingChildren[replyId]) return;
    setLoadingChildren((prev) => ({ ...prev, [replyId]: true }));
    try {
      const token = localStorage.getItem('token');
      const response = await api.get(`/replies/${replyId}/children`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setLazyChildren((prev) => ({
          ...prev,
          [replyId]: response.data.data || [],
        }));
      }
    } finally {
      setLoadingChildren((prev) => ({ ...prev, [replyId]: false }));
    }
  };

  const handleReplyClick = (replyId: string) => {
    setReplyError(null);
    setReplyingTo((prev) => (prev === replyId ? null : replyId));
    setShowReplyEditor(false);
  };

  const discussionsFallbackPath = groupId
    ? `/groups/${groupId}/discussion`
    : resolvedCourseId || courseId
      ? `/courses/${resolvedCourseId || courseId}/discussions`
      : '/dashboard';

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

  const workflowState = deriveDiscussionWorkflowState(thread);
  const commentsAllowed = thread.settings?.allowComments !== false;
  const canPostDiscussion = commentsAllowed && !workflowState.locked && !workflowState.archived && !courseArchived;

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

  const replies = Array.isArray(thread.replies) ? thread.replies : [];
  replies.forEach(reply => {
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
  const hasUserMainReply = replies.some(
    (reply) => reply.parentReply === null && reply.author._id === user?._id
  );
  const discussionStatus = resolveDiscussionStatus(thread);
  const unreadCount = thread.unreadCount ?? thread.currentUserParticipation?.unreadCount ?? 0;
  const hasPosted = thread.hasPosted ?? thread.currentUserParticipation?.hasPosted ?? hasUserMainReply;
  const hasInstructorReply = thread.hasInstructorReply ?? thread.currentUserParticipation?.hasInstructorReply ?? false;

  const renderReplies = (
    replies: Reply[],
    level: number = 0,
    onEdit: (replyId: string, payload: { content: string; fileAssetIds: string[]; removeFileAssetIds: string[] }) => Promise<void>,
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
          canModify={user?._id === reply.author._id || isModerator}
          threadId={thread._id}
          isReplying={replyingTo === reply._id}
          onSubmitReply={handleSubmitReply}
          replyContent={replyContent}
          setReplyContent={setReplyContent}
          setReplyingTo={setReplyingTo}
          onLike={handleLike}
          onHide={handleHideReply}
          onRestore={handleRestoreReply}
          onLoadChildren={handleLoadChildren}
          loadedChildCount={(replyMap.get(reply._id)?.length || 0) + (lazyChildren[reply._id]?.length || 0)}
          allowLikes={thread.settings?.allowLikes !== false}
          replyAttachmentFiles={getComposerAttachments(`reply-${reply._id}`)}
          onAttachmentsChange={(files) => setComposerAttachments(`reply-${reply._id}`, files)}
          courseId={resolvedCourseId || undefined}
          courseArchived={courseArchived}
          canPostDiscussion={canPostDiscussion}
          isSubmittingReply={isSubmitting}
          replyError={replyingTo === reply._id ? replyError : null}
        />
        {replyMap.get(reply._id) && renderReplies(replyMap.get(reply._id)!, level + 1, onEdit, onDelete)}
        {lazyChildren[reply._id] && renderReplies(lazyChildren[reply._id], level + 1, onEdit, onDelete)}
      </React.Fragment>
    ));
  };

  const mobileThreadNavTop = groupId ? 'top-16' : 'top-0';

  return (
    <PullToRefresh onRefresh={handleRefresh} className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <nav className={`lg:hidden fixed left-0 right-0 z-[150] border-b border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 ${mobileThreadNavTop}`}>
        <div className="relative flex items-center justify-between gap-2 px-4 py-3">
          <BackButton
            fallbackPath={discussionsFallbackPath}
            alwaysShow
            className="flex-shrink-0"
            ariaLabel="Go back to discussions"
          />
          <h1 className="flex-1 truncate px-2 text-center text-base font-semibold text-slate-900 dark:text-slate-100">
            {thread.title}
          </h1>
          <div className="w-10 flex-shrink-0" aria-hidden />
        </div>
      </nav>

      <div className="mx-auto max-w-4xl space-y-4 px-3 py-3 pt-14 sm:space-y-6 sm:px-4 sm:py-6 lg:space-y-6 lg:px-4 lg:pt-0">
      {/* Main Thread Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {/* Status strip */}
        <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-6">
          <div className="flex flex-wrap items-center gap-2" aria-live="polite" aria-label="Discussion status">
                {thread.isPinned && (
                  <div className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-amber-700 ring-1 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/50">
                    <Pin className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="text-xs font-medium">Pinned</span>
                  </div>
                )}
                {thread.isGraded && (
                  <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 ring-1 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/50">
                    <Award className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="text-xs font-medium">{thread.totalPoints} pts</span>
                  </div>
                )}
                {workflowState.locked && (
                  <div className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-amber-800 ring-1 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/50">
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="text-xs font-medium">Locked</span>
                  </div>
                )}
                {unreadCount > 0 && (
                  <div className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700 ring-1 ring-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-900/50" aria-label={`${unreadCount} unread replies`}>
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="text-xs font-medium">{unreadCount} unread</span>
                  </div>
                )}
                {user?.role === 'student' && !hasPosted && (
                  <div className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-orange-700 ring-1 ring-orange-200/80 dark:bg-orange-950/40 dark:text-orange-300 dark:ring-orange-900/50">
                    <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="text-xs font-medium">Not posted yet</span>
                  </div>
                )}
                {hasInstructorReply && (
                  <div className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-sky-700 ring-1 ring-sky-200/80 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900/50">
                    <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="text-xs font-medium">Instructor replied</span>
                  </div>
                )}
                {discussionStatus === 'unpublished' && (
                  <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                    <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="text-xs font-medium">Unpublished</span>
                  </div>
                )}
                {thread.isGraded && !workflowState.released && user?.role === 'student' && (
                  <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                    <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="text-xs font-medium">Grade hidden</span>
                  </div>
                )}
          </div>
        </div>

        <div className="px-4 py-5 sm:px-6 sm:py-6">
              {isEditing ? (
                <form onSubmit={handleEditThread} className="space-y-3 sm:space-y-4">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100 p-2 sm:p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    placeholder="Thread title"
                  />
                  <RichTextEditor
                    content={editContent}
                    onChange={setEditContent}
                    placeholder="Edit your thread content..."
                    className="min-h-[200px]"
                  />
                  <FileAttachmentPanel
                    files={editThreadAttachments}
                    onChange={setEditThreadAttachments}
                    courseId={resolvedCourseId || undefined}
                    category="discussion"
                    label="Thread attachments"
                    onRemoveFile={(file) => {
                      if (file.fileAssetId) setEditThreadRemoveIds((prev) => [...prev, file.fileAssetId!]);
                    }}
                  />
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        setEditTitle(thread.title);
                        setEditContent(thread.content);
                        setEditThreadAttachments(normalizeLegacyFiles(thread.fileAssets || []));
                        setEditThreadRemoveIds([]);
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
                  <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <h1 className="break-words text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
                        {thread.title}
                      </h1>
                      <div className="mt-4 flex items-center gap-3">
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
                          className="h-11 w-11 rounded-full border-2 border-white object-cover shadow-sm ring-1 ring-slate-200 dark:border-slate-800 dark:ring-slate-700"
                          onError={e => (e.currentTarget.src = '/default-avatar.png')}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {thread.author.firstName} {thread.author.lastName}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                              {formatDistanceToNow(new Date(thread.createdAt), { addSuffix: true })}
                            </span>
                            {thread.dueDate && (
                              <>
                                <span className="text-slate-300 dark:text-slate-600" aria-hidden>
                                  ·
                                </span>
                                <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                                  <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                                  Due {formatDiscussionDue(new Date(thread.dueDate))}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {isModerator && (
                      <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-1 rounded-xl border border-slate-200 bg-slate-50/80 p-1 dark:border-slate-700 dark:bg-slate-800/60 sm:w-auto">
                        <button
                          type="button"
                          onClick={handleTogglePin}
                          className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 transition-colors touch-manipulation ${
                            thread.isPinned
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                              : 'text-slate-500 hover:bg-white hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200'
                          }`}
                          title={thread.isPinned ? 'Unpin thread' : 'Pin thread'}
                          aria-label={thread.isPinned ? 'Unpin discussion' : 'Pin discussion'}
                        >
                          <Pin className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={handleToggleLock}
                          className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 transition-colors touch-manipulation ${
                            thread.locked
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200'
                              : 'text-slate-500 hover:bg-white hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200'
                          }`}
                          title={thread.locked ? 'Unlock discussion' : 'Lock discussion'}
                          aria-label={thread.locked ? 'Unlock discussion' : 'Lock discussion'}
                        >
                          <Lock className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditing(true);
                            setEditTitle(thread.title);
                            setEditContent(thread.content);
                            setEditThreadAttachments(normalizeLegacyFiles(thread.fileAssets || []));
                            setEditThreadRemoveIds([]);
                          }}
                          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-slate-500 transition-colors hover:bg-white hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-indigo-400"
                          title="Edit thread"
                          aria-label="Edit discussion"
                        >
                          <Edit3 className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
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
                          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-slate-500 transition-colors hover:bg-white hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-indigo-400"
                          title="Edit discussion settings"
                          aria-label="Edit discussion settings"
                        >
                          <Settings className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteThread}
                          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-slate-500 transition-colors hover:bg-white hover:text-red-600 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-red-400"
                          title="Delete thread"
                          aria-label="Delete discussion"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div
                    className="prose prose-slate mb-6 max-w-none leading-relaxed dark:prose-invert prose-headings:text-slate-900 prose-p:text-slate-700 dark:prose-headings:text-slate-100 dark:prose-p:text-slate-300"
                    dangerouslySetInnerHTML={{ __html: sanitizeDiscussionHtml(thread.content) }}
                  />
                  <FileAttachmentChips files={thread.fileAssets} className="mb-5" />
                  {thread.repliesHiddenUntilPost && (
                    <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-200" role="status">
                      Replies are hidden until you post your first reply.
                    </div>
                  )}
                  {!canPostDiscussion && (
                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200" role="status">
                      This discussion is read-only{workflowState.locked ? ' because it is locked' : courseArchived || workflowState.archived ? ' because the course is archived' : ''}.
                    </div>
                  )}

                  {canPostDiscussion && !hasPosted && !showReplyEditor && (
                    <button
                      onClick={() => {
                        setShowReplyEditor(true);
                        setReplyingTo(null);
                      }}
                      className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:bg-indigo-500 dark:hover:bg-indigo-600 touch-manipulation"
                    >
                      <MessageSquare className="h-5 w-5" aria-hidden="true" />
                      <span>Start the discussion</span>
                    </button>
                  )}
                  {canPostDiscussion && showReplyEditor ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/50 sm:p-5">
                      <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
                        <MessageSquare className="h-5 w-5" aria-hidden="true" />
                        <span>Post a reply</span>
                      </h3>
                      <DiscussionReplyComposer
                        content={replyContent}
                        onContentChange={setReplyContent}
                        attachmentFiles={getComposerAttachments('main')}
                        onAttachmentsChange={(files) => setComposerAttachments('main', files)}
                        courseId={resolvedCourseId || undefined}
                        courseArchived={courseArchived || !canPostDiscussion}
                        onSubmit={(e) => handleSubmitReply(e, null)}
                        onCancel={() => {
                          setShowReplyEditor(false);
                          setReplyContent('');
                          setComposerAttachments('main', []);
                          if (threadId && user?._id) {
                            localStorage.removeItem(`thread_reply_draft_${threadId}_${user._id}`);
                          }
                        }}
                        isSubmitting={isSubmitting}
                        layout={isMobileLayout ? 'inline' : 'default'}
                      />
                      {replyError && (
                        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200" role="alert">
                          {replyError}
                        </p>
                      )}
                    </div>
                  ) : null}
                </>
              )}
        </div>
      </div>

      {/* Grading Form */}
      {showGradingModal && selectedStudent && (
        <div className="w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6 border dark:border-gray-700 mb-4">
          <div className="flex justify-between items-center mb-4 sm:mb-6">
            <h2 className="text-base sm:text-xl font-semibold text-gray-800 dark:text-gray-100 flex items-center space-x-2">
              <Award className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="truncate">Grade Discussion - {selectedStudent.firstName} {selectedStudent.lastName}</span>
            </h2>
            <button
              onClick={() => setShowGradingModal(false)}
              className="inline-flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
            {/* Left Panel - Student Posts */}
            <div className="flex-1 p-4 sm:p-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 overflow-y-auto max-h-[400px]">
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
                              dangerouslySetInnerHTML={{ __html: sanitizeDiscussionHtml(reply.content) }}
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
            <div className="w-full lg:w-96 p-4 sm:p-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900">
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
                className="inline-flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300"
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
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:px-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
              <Award className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <span>Student Grades</span>
            </h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {students.length} {students.length === 1 ? 'student' : 'students'}
            </span>
          </div>
          <div className="space-y-3 p-4 lg:hidden">
            {students.map((student) => {
              const gradeObj = thread.studentGrades.find(g => g.student._id === student._id);
              return (
                <div
                  key={student._id}
                  className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {student.firstName} {student.lastName}
                    </div>
                  </div>
                  <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">Grade</span>
                      {renderGradeScoreBadge(gradeObj?.grade, thread.totalPoints)}
                    </div>
                    <div>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">Graded by</span>
                      <span className="text-slate-900 dark:text-slate-100">
                        {gradeObj?.gradedBy ? `${gradeObj.gradedBy.firstName} ${gradeObj.gradedBy.lastName}` : '—'}
                      </span>
                    </div>
                  </div>
                  {gradeObj?.feedback && (
                    <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">{gradeObj.feedback}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => openGradingModal(student)}
                    className="min-h-[44px] w-full rounded-lg bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
                  >
                    {gradeObj ? 'Edit grade' : 'Add grade'}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="hidden overflow-x-auto lg:block">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/50">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:px-6">Student</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:px-6">Grade</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:px-6">Feedback</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:px-6">Graded by</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:px-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {students.map((student) => {
                  const gradeObj = thread.studentGrades.find(g => g.student._id === student._id);
                  return (
                    <tr key={student._id} className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="whitespace-nowrap px-5 py-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            {student.profilePicture ? (
                              <img
                                src={student.profilePicture.startsWith('http')
                                  ? student.profilePicture
                                  : getImageUrl(student.profilePicture)}
                                alt={`${student.firstName} ${student.lastName}`}
                                className="h-9 w-9 rounded-full border border-slate-200 object-cover dark:border-slate-700"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                  if (fallback) {
                                    fallback.style.display = 'flex';
                                  }
                                }}
                              />
                            ) : null}
                            <div
                              className={`flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950/50 ${student.profilePicture ? 'hidden' : ''}`}
                              style={{ display: student.profilePicture ? 'none' : 'flex' }}
                            >
                              <User className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                            </div>
                          </div>
                          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {student.firstName} {student.lastName}
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 sm:px-6">
                        {renderGradeScoreBadge(gradeObj?.grade, thread.totalPoints)}
                      </td>
                      <td className="max-w-xs px-5 py-4 sm:px-6">
                        <div className="truncate text-sm text-slate-600 dark:text-slate-300">
                          {gradeObj?.feedback || <span className="text-slate-400">—</span>}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 sm:px-6">
                        <div className="text-sm text-slate-900 dark:text-slate-100">
                          {gradeObj?.gradedBy ? `${gradeObj.gradedBy.firstName} ${gradeObj.gradedBy.lastName}` : <span className="text-slate-400">—</span>}
                        </div>
                        {gradeObj?.gradedAt ? (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {format(new Date(gradeObj.gradedAt), 'MMM d, yyyy · h:mm a')}
                          </div>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right sm:px-6">
                        <button
                          type="button"
                          onClick={() => openGradingModal(student)}
                          className="min-h-[44px] rounded-lg px-3 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                        >
                          {gradeObj ? 'Edit grade' : 'Add grade'}
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

      {/* Replies list — no outer card; each reply is its own card */}
      {renderReplies(rootReplies, 0, handleEditReply, handleDeleteReply)}

      {/* Delete Thread Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteThreadConfirm}
        onClose={() => setShowDeleteThreadConfirm(false)}
        onConfirm={confirmDeleteThread}
        title="Delete Thread"
        message="Are you sure you want to delete this thread? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
      </div>
    </PullToRefresh>
  );
};

export default ThreadView; 