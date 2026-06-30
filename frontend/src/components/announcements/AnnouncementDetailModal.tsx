import React, { useState, useEffect } from 'react';
import { getAnnouncementComments, postAnnouncementComment, postAnnouncementReply, likeAnnouncementComment, unlikeAnnouncementComment } from '../../services/announcementService';
import { useAuth } from '../../contexts/AuthContext';
import { X, MessageSquare, ThumbsUp, Reply, Lightbulb } from 'lucide-react';
import { BTN_PRIMARY, BTN_SECONDARY, FORM_SHELL } from '../common/formStyles';
import {
  AnnouncementAuthorAvatar,
  AnnouncementCommentComposer,
  AnnouncementOptionBadges,
  formatAnnouncementDate,
} from './announcementUi';

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
      profilePicture?: string;
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
    profilePicture?: string;
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
      }
    setLiking(prev => ({ ...prev, [commentId]: false }));
  };

  const renderComments = (comments: Comment[], level = 0) => {
    if (!comments || !Array.isArray(comments)) {
      return null;
    }
    
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
              <li key={comment._id} className="rounded-xl border border-slate-200/80 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="mb-3 flex items-start gap-3">
                  <AnnouncementAuthorAvatar
                    firstName={comment.author.firstName}
                    lastName={comment.author.lastName}
                    profilePicture={comment.author.profilePicture}
                    size="sm"
                  />
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {comment.author.firstName} {comment.author.lastName}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {formatAnnouncementDate(comment.createdAt)}
                    </div>
                  </div>
                </div>

                <div className="mb-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
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
                        className={BTN_PRIMARY}
                      >
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 backdrop-blur-sm sm:p-4">
      <div className={`${FORM_SHELL} mx-2 flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden sm:mx-4 sm:max-h-[90vh]`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 dark:border-slate-800 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950/50">
              <MessageSquare className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">Announcement</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Details and discussion</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-6">
          <article className="rounded-xl border border-slate-200/80 bg-slate-50/30 p-4 dark:border-slate-700 dark:bg-slate-800/30 sm:p-5">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50 sm:text-2xl">{announcement.title}</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {formatAnnouncementDate(announcement.createdAt)} · {announcement.author.firstName}{' '}
              {announcement.author.lastName}
            </p>
            <div
              className="prose prose-slate mt-4 max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: announcement.body }}
            />
            <AnnouncementOptionBadges options={announcement.options} className="mt-4" />
          </article>

          {announcement.options?.allowComments && (
            <section className="mt-6">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Comments</h4>
              {user &&
                user.role === 'student' &&
                announcement.options?.requirePostBeforeSeeingReplies &&
                !userHasPosted && (
                  <div className="mt-4 rounded-xl border border-blue-200/80 bg-blue-50/80 p-4 text-sm text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
                    <Lightbulb className="mr-2 inline h-4 w-4" />
                    Post a comment first to see replies from other students.
                  </div>
                )}
              {commentsLoading ? (
                <div className="py-10 text-center text-sm text-slate-500">Loading comments…</div>
              ) : (
                <div className="mt-4 space-y-4">
                  {renderComments(comments)}
                  {user && (
                    <AnnouncementCommentComposer
                      value={commentText}
                      onChange={setCommentText}
                      onSubmit={handlePostComment}
                      posting={posting}
                    />
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnnouncementDetailModal; 