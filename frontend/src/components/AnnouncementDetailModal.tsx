import React, { useState, useEffect } from 'react';
import { getAnnouncementComments, postAnnouncementComment, postAnnouncementReply, likeAnnouncementComment, unlikeAnnouncementComment } from '../services/announcementService';
import { useAuth } from '../context/AuthContext';
import { X, User, Clock, MessageSquare, ThumbsUp, Reply, Send, Lightbulb } from 'lucide-react';

interface AnnouncementDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  announcement: {
    _id: string;
    title: string;
    body: string;
    createdAt: string;
    author: {
      firstName: string;
      lastName: string;
    };
    options?: {
      allowComments?: boolean;
      requirePostBeforeSeeingReplies?: boolean;
      allowLiking?: boolean;
    };
  } | null;
}

interface Comment {
  _id: string;
  text: string;
  author: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
  likes?: string[];
  replies?: Comment[];
}

const AnnouncementDetailModal: React.FC<AnnouncementDetailModalProps> = ({
  isOpen,
  onClose,
  announcement
}) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({});
  const [posting, setPosting] = useState(false);
  const [liking, setLiking] = useState<{ [key: string]: boolean }>({});
  const [userHasPosted, setUserHasPosted] = useState(false);

  useEffect(() => {
    if (announcement && isOpen) {
      fetchComments(announcement._id);
    }
  }, [announcement, isOpen]);

  const fetchComments = async (announcementId: string) => {
    setCommentsLoading(true);
    try {
      const data = await getAnnouncementComments(announcementId);
      setComments(data);
      if (user && announcement?.options?.requirePostBeforeSeeingReplies) {
        const hasPosted = data.some((comment: Comment) => comment.author._id === user._id);
        setUserHasPosted(hasPosted);
      } else {
        setUserHasPosted(true);
      }
    } catch {
      setComments([]);
      setUserHasPosted(false);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handlePostComment = async () => {
    if (!announcement || !commentText.trim()) return;
    setPosting(true);
    try {
      await postAnnouncementComment(announcement._id, commentText);
      setCommentText('');
      setUserHasPosted(true);
      await fetchComments(announcement._id);
    } catch (err) {
      console.error('Failed to post comment:', err);
    }
    setPosting(false);
  };

  const handlePostReply = async (commentId: string) => {
    if (!announcement || !commentId || !replyText[commentId]?.trim()) return;
    setPosting(true);
    try {
      await postAnnouncementReply(announcement._id, commentId, replyText[commentId]);
      setReplyText((prev) => ({ ...prev, [commentId]: '' }));
      setReplyingTo(null);
      await fetchComments(announcement._id);
    } catch (err) {
      console.error('Failed to post reply:', err);
    }
    setPosting(false);
  };

  const handleLike = async (commentId: string) => {
    if (!announcement || !commentId) return;
    setLiking(prev => ({ ...prev, [commentId]: true }));
    try {
      await likeAnnouncementComment(announcement._id, commentId);
      await fetchComments(announcement._id);
    } catch (err) {
      console.error('Failed to like comment:', err);
    }
    setLiking(prev => ({ ...prev, [commentId]: false }));
  };

  const handleUnlike = async (commentId: string) => {
    if (!announcement || !commentId) return;
    setLiking(prev => ({ ...prev, [commentId]: true }));
    try {
      await unlikeAnnouncementComment(announcement._id, commentId);
      await fetchComments(announcement._id);
    } catch (err) {
      console.error('Failed to unlike comment:', err);
    }
    setLiking(prev => ({ ...prev, [commentId]: false }));
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const renderComments = (comments: Comment[], level = 0) => {
    let visibleComments = comments;
    const shouldHideOthers =
      level === 0 &&
      user &&
      user.role === 'student' &&
      announcement?.options?.requirePostBeforeSeeingReplies &&
      !userHasPosted;
    
    if (shouldHideOthers) {
      visibleComments = comments.filter((comment) => comment.author._id === user._id);
    }

    return (
      <ul className={level === 0 ? 'space-y-4' : 'ml-8 space-y-3 mt-3'}>
        {visibleComments
          .filter(comment => comment._id)
          .map((comment) => {
            const isLiked = user && comment.likes && comment.likes.includes(user._id);
            const shouldShowReplies = userHasPosted || 
              !announcement?.options?.requirePostBeforeSeeingReplies ||
              user?.role !== 'student';
            const visibleReplies = shouldShowReplies ? comment.replies : [];

            return (
              <li key={comment._id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="font-medium text-sm text-gray-900 dark:text-white">
                        {comment.author.firstName} {comment.author.lastName}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {formatTimeAgo(comment.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                  {comment.text}
                </div>
                
                <div className="flex items-center gap-4 text-xs">
                  {announcement?.options?.allowLiking && (
                    <button
                      onClick={() => isLiked ? handleUnlike(comment._id) : handleLike(comment._id)}
                      disabled={liking[comment._id]}
                      className={`flex items-center gap-1 transition-colors ${
                        isLiked 
                          ? 'text-blue-600 dark:text-blue-400' 
                          : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
                      }`}
                    >
                      <ThumbsUp className={`w-3 h-3 ${isLiked ? 'fill-current' : ''}`} />
                      {comment.likes?.length || 0}
                    </button>
                  )}
                  
                  {user && (
                    <button
                      onClick={() => setReplyingTo(replyingTo === comment._id ? null : comment._id)}
                      className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      <Reply className="w-3 h-3" />
                      Reply
                    </button>
                  )}
                </div>
                
                {replyingTo === comment._id && (
                  <div className="mt-3">
                    <textarea
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      rows={2}
                      placeholder="Write a reply..."
                      value={replyText[comment._id] || ''}
                      onChange={e => setReplyText(prev => ({ ...prev, [comment._id]: e.target.value }))}
                      disabled={posting}
                    />
                    <div className="flex gap-2 mt-2 justify-end">
                      <button
                        onClick={() => setReplyingTo(null)}
                        className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handlePostReply(comment._id)}
                        disabled={posting || !replyText[comment._id]?.trim()}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" />
                        Reply
                      </button>
                    </div>
                  </div>
                )}
                
                {visibleReplies && visibleReplies.length > 0 && renderComments(visibleReplies, level + 1)}
              </li>
            );
          })}
      </ul>
    );
  };

  if (!isOpen || !announcement) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full mx-2 sm:mx-4 max-h-[95vh] sm:max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Announcement Details
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                View full announcement and comments
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(95vh-200px)] sm:max-h-[calc(90vh-200px)]">
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Announcement Content */}
            <div className="bg-white dark:bg-gray-900 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-start justify-between mb-3 sm:mb-4">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white break-words">
                  {announcement.title}
                </h3>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
                  <Clock className="w-4 h-4" />
                  {formatTimeAgo(announcement.createdAt)}
                </div>
              </div>
              
              <div className="prose max-w-none text-gray-700 dark:text-gray-300 leading-relaxed mb-4" 
                   dangerouslySetInnerHTML={{ __html: announcement.body }} />
              
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                  <User className="w-3 h-3 text-white" />
                </div>
                <span className="font-medium">
                  {announcement.author.firstName} {announcement.author.lastName}
                </span>
              </div>
            </div>

            {/* Comments Section */}
            {announcement.options?.allowComments && (
              <div className="bg-white dark:bg-gray-900 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
                <h4 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                  Comments
                </h4>
                
                {user && user.role === 'student' && announcement.options?.requirePostBeforeSeeingReplies && !userHasPosted && (
                  <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                      <Lightbulb className="w-4 h-4" />
                      <span>Post a comment first to see replies from other students.</span>
                    </div>
                  </div>
                )}
                
                {commentsLoading ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    Loading comments...
                  </div>
                ) : (
                  <>
                    {renderComments(comments)}
                    
                    {user && (
                      <div className="mt-6">
                        <textarea
                          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          rows={3}
                          placeholder="Write a comment..."
                          value={commentText}
                          onChange={e => setCommentText(e.target.value)}
                          disabled={posting}
                        />
                        <div className="flex gap-3 mt-3 justify-end">
                          <button
                            className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                            onClick={handlePostComment}
                            disabled={posting || !commentText.trim()}
                          >
                            {posting ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                            {posting ? 'Posting...' : 'Post Comment'}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementDetailModal; 