import React, { useEffect, useState } from 'react';
import AnnouncementList, { Announcement } from '../announcements/AnnouncementList';
import { getGroupSetAnnouncements, getAnnouncementComments, postAnnouncementComment, postAnnouncementReply, likeAnnouncementComment, unlikeAnnouncementComment, AnnouncementComment } from '../../services/announcementService';
import { useAuth } from '../../context/AuthContext';
import { ThumbsUp } from 'lucide-react';
import logger from '../../utils/logger';

interface GroupAnnouncementsProps {
  courseId: string;
  groupSetId: string;
}

const GroupAnnouncements: React.FC<GroupAnnouncementsProps> = ({ courseId, groupSetId }) => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [comments, setComments] = useState<AnnouncementComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({});
  const [posting, setPosting] = useState(false);
  const [liking, setLiking] = useState<{ [key: string]: boolean }>({});
  const [userHasPosted, setUserHasPosted] = useState(false);

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
        const hasPosted = data.some((comment: AnnouncementComment) => comment.author._id === user._id);
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
      logger.error('Failed to post reply', err);
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

  const renderComments = (comments: AnnouncementComment[], level = 0, parentKey = '') => {
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
    return (
      <ul className={level === 0 ? 'space-y-4 sm:space-y-6 mt-4 sm:mt-8' : 'ml-4 sm:ml-8 space-y-3 sm:space-y-4 mt-3 sm:mt-4'}>
        {visibleComments
          .filter(comment => comment._id)
          .map((comment) => {
            const isLiked = user && comment.likes && comment.likes.some(like => like.user === user._id || like._id === user._id);
            const isOwnComment = user && comment.author._id === user._id;
            const shouldShowReplies = userHasPosted || 
              !selectedAnnouncement?.options?.requirePostBeforeSeeingReplies ||
              user?.role !== 'student';
            const visibleReplies = shouldShowReplies ? (comment.replies || []) : [];
            return (
              <li key={parentKey + comment._id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 sm:p-4 border border-gray-100 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-2">
                  <span className="font-semibold text-sm sm:text-base text-gray-800 dark:text-gray-200">{comment.author.firstName} {comment.author.lastName}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{new Date(comment.createdAt).toLocaleString()}</span>
                </div>
                <div className="mb-2 text-sm sm:text-base text-gray-700 dark:text-gray-300 break-words">{comment.text}</div>
                <div className="flex flex-wrap gap-2 mb-2 items-center">
                  {user && selectedAnnouncement?.options?.allowLiking && !isOwnComment && (
                    <button
                      className={`text-xs flex items-center gap-1 px-2 py-1 rounded ${isLiked ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'}`}
                      onClick={e => {
                        e.preventDefault();
                        isLiked ? handleUnlike(comment._id) : handleLike(comment._id);
                      }}
                      disabled={liking[comment._id]}
                    >
                      <ThumbsUp className="w-3 h-3" />
                      {comment.likes?.length || 0}
                    </button>
                  )}
                  {user && (
                    <button
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      onClick={() => setReplyingTo(comment._id)}
                    >
                      Reply
                    </button>
                  )}
                </div>
                {replyingTo === comment._id && (
                  <div className="mb-2">
                    <textarea
                      className="w-full border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                      rows={2}
                      placeholder="Write a reply..."
                      value={replyText[comment._id] || ''}
                      onChange={e => setReplyText(prev => ({ ...prev, [comment._id]: e.target.value }))}
                      disabled={posting}
                    />
                    <div className="flex gap-2 mt-1 justify-end">
                      <button
                        className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                        onClick={() => setReplyingTo(null)}
                        disabled={posting}
                      >
                        Cancel
                      </button>
                      <button
                        className="px-3 py-1 text-xs bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600"
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
    <div className="max-w-4xl mx-auto py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6 lg:space-y-8 px-2 sm:px-4">
      <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-gray-900 dark:text-gray-100">Group Announcements</h2>
      {error && <div className="text-sm text-red-500 dark:text-red-400 mb-2">{error}</div>}
      {selectedAnnouncement ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border border-gray-100 dark:border-gray-700 max-w-2xl mx-auto">
          <button
            className="mb-3 sm:mb-4 px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-xs sm:text-sm"
            onClick={() => setSelectedAnnouncement(null)}
          >
            ← Back to Announcements
          </button>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-start gap-2 mb-2">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 break-words">{selectedAnnouncement.title}</h3>
            <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">{new Date(selectedAnnouncement.createdAt).toLocaleString()}</span>
          </div>
          <div className="text-sm text-gray-800 dark:text-gray-200 mb-2 prose max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: selectedAnnouncement.body }} />
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">By {selectedAnnouncement.author.firstName} {selectedAnnouncement.author.lastName}</div>
          {selectedAnnouncement.options && Object.values(selectedAnnouncement.options).some(Boolean) && user && user.role !== 'student' && (
            <div className="mt-1 flex flex-wrap gap-2">
              {selectedAnnouncement.options.delayPosting && <span className="bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300 px-2 py-0.5 rounded text-xs font-semibold">Delay posting</span>}
              {selectedAnnouncement.options.allowComments && <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded text-xs font-semibold">Comments enabled</span>}
              {selectedAnnouncement.options.requirePostBeforeSeeingReplies && <span className="bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded text-xs font-semibold">Post before seeing replies</span>}
              {selectedAnnouncement.options.enablePodcastFeed && <span className="bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 px-2 py-0.5 rounded text-xs font-semibold">Podcast feed</span>}
              {selectedAnnouncement.options.allowLiking && <span className="bg-pink-100 dark:bg-pink-900/50 text-pink-800 dark:text-pink-300 px-2 py-0.5 rounded text-xs font-semibold">Liking enabled</span>}
            </div>
          )}
          {/* Comments Section */}
          <div className="mt-10">
            <h4 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">Comments</h4>
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
                  <div className="mt-6">
                    <textarea
                      className="w-full border border-gray-300 dark:border-gray-700 rounded px-2 py-2 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                      rows={3}
                      placeholder="Write a comment..."
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      disabled={posting}
                    />
                    <div className="flex gap-2 mt-2 justify-end">
                      <button
                        className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600"
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
          <div className="text-gray-500 dark:text-gray-400">Loading announcements...</div>
        ) : (
          <AnnouncementList announcements={announcements} onSelect={setSelectedAnnouncement} />
        )
      )}
    </div>
  );
};

export default GroupAnnouncements; 