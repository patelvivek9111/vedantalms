import React, { useEffect, useState } from 'react';
import AnnouncementList, { Announcement } from '../announcements/AnnouncementList';
import { getGroupSetAnnouncements, getAnnouncementComments, postAnnouncementComment, postAnnouncementReply, likeAnnouncementComment, unlikeAnnouncementComment } from '../../services/announcementService';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, ThumbsUp } from 'lucide-react';
import { BTN_SECONDARY, FORM_SHELL } from '../common/formStyles';
import {
  AnnouncementAuthorAvatar,
  AnnouncementCommentComposer,
  AnnouncementOptionBadges,
  formatAnnouncementDate,
} from '../announcements/announcementUi';

// Detect mobile device
const useMobileDevice = () => {
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileDevice(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return isMobileDevice;
};

interface GroupAnnouncementsProps {
  courseId: string;
  groupSetId: string;
}

interface Comment {
  _id: string;
  author: { _id: string; firstName: string; lastName: string; profilePicture?: string };
  text: string;
  createdAt: string;
  replies: Comment[];
  likes?: string[];
}

const GroupAnnouncements: React.FC<GroupAnnouncementsProps> = ({ courseId, groupSetId }) => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({});
  const [posting, setPosting] = useState(false);
  const [liking, setLiking] = useState<{ [key: string]: boolean }>({});
  const [userHasPosted, setUserHasPosted] = useState(false);
  const isMobileDevice = useMobileDevice();

  // Show loading state if courseId or groupSetId are not yet available
  if (!courseId || !groupSetId || courseId === '' || groupSetId === '') {
    return (
      <div className="p-4">
        <div className="text-gray-500 dark:text-gray-400 text-center">Loading announcements...</div>
      </div>
    );
  }

  const fetchAnnouncements = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getGroupSetAnnouncements(courseId, groupSetId);
      setAnnouncements(data);
    } catch (err: any) {
      setError('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async (announcementId: string) => {
    setCommentsLoading(true);
    try {
      const data = await getAnnouncementComments(announcementId);
      const commentsData = Array.isArray(data) ? data : [];
      setComments(commentsData);
      if (user && selectedAnnouncement?.options?.requirePostBeforeSeeingReplies) {
        const hasPosted = commentsData.some((comment: Comment) => comment.author._id === user._id);
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

  useEffect(() => {
    fetchAnnouncements();
    // eslint-disable-next-line
  }, [courseId, groupSetId]);

  useEffect(() => {
    if (selectedAnnouncement) {
      fetchComments(selectedAnnouncement._id);
    }
  }, [selectedAnnouncement]);

  const handlePostComment = async () => {
    if (!selectedAnnouncement || !commentText.trim()) return;
    setPosting(true);
    await postAnnouncementComment(selectedAnnouncement._id, commentText);
    setCommentText('');
    setUserHasPosted(true);
    await fetchComments(selectedAnnouncement._id);
    setPosting(false);
  };

  const handlePostReply = async (commentId: string) => {
    if (!selectedAnnouncement || !commentId || !replyText[commentId]?.trim()) return;
    setPosting(true);
    try {
      await postAnnouncementReply(selectedAnnouncement._id, commentId, replyText[commentId]);
      setReplyText((prev) => ({ ...prev, [commentId]: '' }));
      setReplyingTo(null);
      await fetchComments(selectedAnnouncement._id);
    } catch (err) {
    }
    setPosting(false);
  };

  const handleLike = async (commentId: string) => {
    if (!selectedAnnouncement || !commentId) return;
    setLiking(prev => ({ ...prev, [commentId]: true }));
    try {
      await likeAnnouncementComment(selectedAnnouncement._id, commentId);
      await fetchComments(selectedAnnouncement._id);
    } catch (err) {}
    setLiking(prev => ({ ...prev, [commentId]: false }));
  };

  const handleUnlike = async (commentId: string) => {
    if (!selectedAnnouncement || !commentId) return;
    setLiking(prev => ({ ...prev, [commentId]: true }));
    try {
      await unlikeAnnouncementComment(selectedAnnouncement._id, commentId);
      await fetchComments(selectedAnnouncement._id);
    } catch (err) {}
    setLiking(prev => ({ ...prev, [commentId]: false }));
  };

  const renderComments = (comments: Comment[], level = 0, parentKey = '') => {
    if (!Array.isArray(comments)) {
      return null;
    }
    let visibleComments = comments;
    const shouldHideOthers =
      level === 0 &&
      user &&
      user.role === 'student' &&
      selectedAnnouncement?.options?.requirePostBeforeSeeingReplies &&
      !userHasPosted;
    if (shouldHideOthers) {
      visibleComments = comments.filter((comment) => comment.author._id === user._id);
    }
    const isMobile = window.innerWidth < 1024;
    return (
      <ul className={level === 0 ? `${isMobile ? 'space-y-3 mt-4' : 'space-y-4 sm:space-y-6 mt-4 sm:mt-8'}` : `${isMobile ? 'ml-3 space-y-2 mt-2' : 'ml-4 sm:ml-8 space-y-3 sm:space-y-4 mt-3 sm:mt-4'}`}>
        {visibleComments
          .filter(comment => comment._id)
          .map((comment) => {
            const isLiked = user && comment.likes && comment.likes.includes(user._id);
            const isOwnComment = user && comment.author._id === user._id;
            const shouldShowReplies = userHasPosted || 
              !selectedAnnouncement?.options?.requirePostBeforeSeeingReplies ||
              user?.role !== 'student';
            const visibleReplies = shouldShowReplies ? comment.replies : [];
            return (
              <li key={parentKey + comment._id} className={`bg-gray-50 dark:bg-gray-700/50 rounded-lg ${isMobile ? 'p-3' : 'p-3 sm:p-4'} border border-gray-100 dark:border-gray-700`}>
                <div className={`${isMobile ? 'flex flex-col gap-1' : 'flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2'} mb-2`}>
                  <span className={`${isMobile ? 'text-sm' : 'text-sm sm:text-base'} font-semibold text-gray-800 dark:text-gray-200`}>
                    {comment.author.firstName} {comment.author.lastName}
                  </span>
                  <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-gray-400 dark:text-gray-500`}>
                    {new Date(comment.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className={`mb-2 ${isMobile ? 'text-sm' : 'text-sm sm:text-base'} text-gray-700 dark:text-gray-300 break-words`}>
                  {comment.text}
                </div>
                <div className={`${isMobile ? 'flex flex-wrap gap-2' : 'flex flex-wrap gap-2'} mb-2 items-center`}>
                  {user && selectedAnnouncement?.options?.allowLiking && !isOwnComment && (
                    <button
                      className={`${isMobile ? 'text-[10px] px-2 py-1' : 'text-xs px-2 py-1'} flex items-center gap-1 rounded-lg ${isLiked ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'} transition-colors touch-manipulation active:scale-95`}
                      onClick={e => {
                        e.preventDefault();
                        isLiked ? handleUnlike(comment._id) : handleLike(comment._id);
                      }}
                      disabled={liking[comment._id]}
                    >
                      <ThumbsUp className={`${isMobile ? 'w-3 h-3' : 'w-3 h-3'}`} />
                      {comment.likes?.length || 0}
                    </button>
                  )}
                  {user && (
                    <button
                      className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-blue-600 dark:text-blue-400 hover:underline touch-manipulation`}
                      onClick={() => setReplyingTo(comment._id)}
                    >
                      Reply
                    </button>
                  )}
                </div>
                {replyingTo === comment._id && (
                  <div className="mb-2">
                    <textarea
                      className={`w-full border border-gray-300 dark:border-gray-700 rounded-lg ${isMobile ? 'px-2 py-1.5 text-sm' : 'px-2 py-1 text-sm'} bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400`}
                      rows={isMobile ? 3 : 2}
                      placeholder="Write a reply..."
                      value={replyText[comment._id] || ''}
                      onChange={e => setReplyText(prev => ({ ...prev, [comment._id]: e.target.value }))}
                      disabled={posting}
                    />
                    <div className={`flex gap-2 ${isMobile ? 'mt-2' : 'mt-1'} justify-end`}>
                      <button
                        className={`${isMobile ? 'px-3 py-1.5 text-xs' : 'px-3 py-1 text-xs'} bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors touch-manipulation active:scale-95 disabled:opacity-50`}
                        onClick={() => setReplyingTo(null)}
                        disabled={posting}
                      >
                        Cancel
                      </button>
                      <button
                        className={`${isMobile ? 'px-3 py-1.5 text-xs' : 'px-3 py-1 text-xs'} bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors touch-manipulation active:scale-95 disabled:opacity-50`}
                        onClick={() => handlePostReply(comment._id)}
                        disabled={posting}
                      >
                        {posting ? 'Replying...' : 'Reply'}
                      </button>
                    </div>
                  </div>
                )}
                {!shouldShowReplies && comment.replies && comment.replies.length > 0 && (
                  <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-700 dark:text-yellow-300">
                    <span role="img" aria-label="Info">ℹ️</span> {comment.replies.length} repl{comment.replies.length === 1 ? 'y' : 'ies'} hidden. Post a comment first to see replies.
                  </div>
                )}
                {visibleReplies && visibleReplies.length > 0 && renderComments(visibleReplies, level + 1, parentKey + comment._id + '-')}
              </li>
            );
          })}
      </ul>
    );
  };

  return (
    <div className={`w-full overflow-visible lg:h-full lg:overflow-y-auto ${isMobileDevice ? 'pb-20' : ''}`}>
      {/* Header - Mobile Optimized */}
      <div className={`bg-white dark:bg-gray-800 ${isMobileDevice ? 'p-3 mb-3 border-b' : 'p-4 sm:p-6 mb-4 sm:mb-6'} border-gray-200 dark:border-gray-700`}>
        <h2 className={`${isMobileDevice ? 'text-lg' : 'text-xl sm:text-2xl'} font-bold text-gray-900 dark:text-gray-100`}>
          Group Announcements
        </h2>
        {error && (
          <div className={`${isMobileDevice ? 'text-xs mt-2' : 'text-sm mt-2'} text-red-500 dark:text-red-400`}>
            {error}
          </div>
        )}
      </div>

      <div className={`${isMobileDevice ? 'px-4' : 'px-4 sm:px-6'} pb-4 sm:pb-6`}>
      {selectedAnnouncement ? (
          <div className="mx-auto max-w-4xl">
          <button
              type="button"
              className={`${BTN_SECONDARY} mb-4 ${isMobileDevice ? 'text-xs' : ''}`}
            onClick={() => setSelectedAnnouncement(null)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to announcements
          </button>
            <article className={`${FORM_SHELL} overflow-hidden ${isMobileDevice ? '' : ''}`}>
              <div className="border-b border-slate-100 px-4 py-4 dark:border-slate-800 sm:px-6">
                <h3 className={`font-bold tracking-tight text-slate-900 dark:text-slate-50 ${isMobileDevice ? 'text-lg' : 'text-xl sm:text-2xl'}`}>
                  {selectedAnnouncement.title}
                </h3>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <time dateTime={selectedAnnouncement.createdAt}>
                    {formatAnnouncementDate(selectedAnnouncement.createdAt)}
                  </time>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <AnnouncementAuthorAvatar
                    firstName={selectedAnnouncement.author.firstName}
                    lastName={selectedAnnouncement.author.lastName}
                    profilePicture={selectedAnnouncement.author.profilePicture}
                    size="sm"
                  />
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {selectedAnnouncement.author.firstName} {selectedAnnouncement.author.lastName}
                  </span>
                </div>
                {user && user.role !== 'student' && (
                  <AnnouncementOptionBadges options={selectedAnnouncement.options} className="mt-3" />
                )}
              </div>
              <div className="px-4 py-5 sm:px-6">
                <div
                  className="prose prose-slate max-w-none text-sm dark:prose-invert sm:text-base"
                  dangerouslySetInnerHTML={{ __html: selectedAnnouncement.body }}
                />
              </div>
            </article>
          <section className={`${FORM_SHELL} mt-6 p-4 sm:p-6`}>
              <h4 className={`font-semibold text-slate-900 dark:text-slate-100 ${isMobileDevice ? 'text-base' : 'text-lg'}`}>Comments</h4>
            {user && user.role === 'student' && selectedAnnouncement?.options?.requirePostBeforeSeeingReplies && !userHasPosted && (
              <div className="mt-4 rounded-xl border border-blue-200/80 bg-blue-50/80 p-3 text-sm text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
                Post a comment first to see replies from other students.
              </div>
            )}
            {commentsLoading ? (
              <div className="py-8 text-center text-sm text-slate-500">Loading comments…</div>
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
        </div>
      ) : (
        loading ? (
            <div className={`${isMobileDevice ? 'py-8' : 'py-12'} text-center`}>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 dark:border-blue-400 mx-auto"></div>
              <p className={`${isMobileDevice ? 'text-xs mt-2' : 'text-sm mt-2'} text-gray-500 dark:text-gray-400`}>
                Loading announcements...
              </p>
            </div>
        ) : (
          <AnnouncementList announcements={announcements} onSelect={setSelectedAnnouncement} />
        )
      )}
      </div>
    </div>
  );
};

export default GroupAnnouncements; 