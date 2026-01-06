import React, { useEffect, useState } from 'react';
import AnnouncementList, { Announcement } from '../announcements/AnnouncementList';
import { getGroupSetAnnouncements, getAnnouncementComments, postAnnouncementComment, postAnnouncementReply, likeAnnouncementComment, unlikeAnnouncementComment } from '../../services/announcementService';
import { useAuth } from '../../context/AuthContext';
import { ThumbsUp } from 'lucide-react';

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
  author: { _id: string; firstName: string; lastName: string };
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
      setComments(data);
      if (user && selectedAnnouncement?.options?.requirePostBeforeSeeingReplies) {
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
      console.error('Failed to post reply:', err);
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
    <div className={`w-full h-full overflow-y-auto ${isMobileDevice ? 'pb-20' : ''}`}>
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
          <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 ${isMobileDevice ? 'p-4' : 'p-4 sm:p-6'}`}>
          <button
              className={`mb-3 sm:mb-4 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 ${isMobileDevice ? 'text-xs' : 'text-sm'} font-medium transition-colors touch-manipulation active:scale-95`}
            onClick={() => setSelectedAnnouncement(null)}
          >
            ← Back to Announcements
          </button>
            <div className={`${isMobileDevice ? 'flex flex-col gap-2' : 'flex flex-col sm:flex-row justify-between items-start sm:items-start gap-2'} mb-3`}>
              <h3 className={`${isMobileDevice ? 'text-base' : 'text-base sm:text-lg'} font-bold text-gray-900 dark:text-gray-100 break-words`}>
                {selectedAnnouncement.title}
              </h3>
              <span className={`${isMobileDevice ? 'text-xs' : 'text-xs'} text-gray-400 dark:text-gray-500 ${isMobileDevice ? '' : 'whitespace-nowrap'}`}>
                {new Date(selectedAnnouncement.createdAt).toLocaleString()}
              </span>
          </div>
            <div className={`${isMobileDevice ? 'text-sm' : 'text-sm'} text-gray-800 dark:text-gray-200 mb-3 prose max-w-none dark:prose-invert`} dangerouslySetInnerHTML={{ __html: selectedAnnouncement.body }} />
            <div className={`${isMobileDevice ? 'text-xs' : 'text-xs'} text-gray-500 dark:text-gray-400 mb-3`}>
              By {selectedAnnouncement.author.firstName} {selectedAnnouncement.author.lastName}
            </div>
          {selectedAnnouncement.options && Object.values(selectedAnnouncement.options).some(Boolean) && user && user.role !== 'student' && (
              <div className={`${isMobileDevice ? 'mt-2' : 'mt-1'} flex flex-wrap gap-2`}>
                {selectedAnnouncement.options.delayPosting && <span className={`${isMobileDevice ? 'px-2 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'} bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300 rounded-full font-semibold`}>Delay posting</span>}
                {selectedAnnouncement.options.allowComments && <span className={`${isMobileDevice ? 'px-2 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'} bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 rounded-full font-semibold`}>Comments enabled</span>}
                {selectedAnnouncement.options.requirePostBeforeSeeingReplies && <span className={`${isMobileDevice ? 'px-2 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'} bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 rounded-full font-semibold`}>Post before seeing replies</span>}
                {selectedAnnouncement.options.enablePodcastFeed && <span className={`${isMobileDevice ? 'px-2 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'} bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 rounded-full font-semibold`}>Podcast feed</span>}
                {selectedAnnouncement.options.allowLiking && <span className={`${isMobileDevice ? 'px-2 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'} bg-pink-100 dark:bg-pink-900/50 text-pink-800 dark:text-pink-300 rounded-full font-semibold`}>Liking enabled</span>}
            </div>
          )}
          {/* Comments Section */}
            <div className={`${isMobileDevice ? 'mt-6' : 'mt-10'}`}>
              <h4 className={`${isMobileDevice ? 'text-base' : 'text-lg'} font-bold mb-4 text-gray-900 dark:text-gray-100`}>Comments</h4>
            {user && user.role === 'student' && selectedAnnouncement?.options?.requirePostBeforeSeeingReplies && !userHasPosted && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-sm text-blue-700 dark:text-blue-300">
                <span role="img" aria-label="Info">💡</span> Post a comment first to see replies from other students.
              </div>
            )}
            {commentsLoading ? (
              <div className="text-gray-500 dark:text-gray-400">Loading comments...</div>
            ) : (
              <>
                {renderComments(comments)}
                {user && (
                  <div className={`${isMobileDevice ? 'mt-4' : 'mt-6'}`}>
                    <textarea
                      className={`w-full border border-gray-300 dark:border-gray-700 rounded-lg ${isMobileDevice ? 'px-3 py-2 text-sm' : 'px-2 py-2 text-sm'} bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400`}
                      rows={isMobileDevice ? 4 : 3}
                      placeholder="Write a comment..."
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      disabled={posting}
                    />
                    <div className={`flex gap-2 ${isMobileDevice ? 'mt-2' : 'mt-2'} justify-end`}>
                      <button
                        className={`${isMobileDevice ? 'px-4 py-2 text-sm' : 'px-4 py-2'} bg-gradient-to-r from-blue-600 to-blue-500 dark:from-blue-500 dark:to-blue-600 hover:from-blue-700 hover:to-blue-600 dark:hover:from-blue-600 dark:hover:to-blue-700 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all active:scale-95 touch-manipulation disabled:opacity-50`}
                        onClick={handlePostComment}
                        disabled={posting}
                      >
                        {posting ? 'Posting...' : 'Post Comment'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
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