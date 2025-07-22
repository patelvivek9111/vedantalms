import React, { useEffect, useState } from 'react';
import AnnouncementList, { Announcement } from '../components/announcements/AnnouncementList';
import AnnouncementForm from '../components/announcements/AnnouncementForm';
import { getAnnouncements, createAnnouncement, getAnnouncementComments, postAnnouncementComment, postAnnouncementReply, likeAnnouncementComment, unlikeAnnouncementComment, updateAnnouncement, deleteAnnouncement } from '../services/announcementService';
import { useAuth } from '../context/AuthContext';
import { useState as useReactState } from 'react';
import { ThumbsUp, Info, Lightbulb } from 'lucide-react';

interface AnnouncementsProps {
  courseId: string;
}

interface Comment {
  _id: string;
  author: { _id: string; firstName: string; lastName: string };
  text: string;
  createdAt: string;
  replies: Comment[];
  likes?: string[];
}

const Announcements: React.FC<AnnouncementsProps> = ({ courseId }) => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
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
  const [editMode, setEditMode] = useReactState(false);
  const [showCreate, setShowCreate] = useState(false);

  const fetchAnnouncements = async () => {
    if (!courseId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getAnnouncements(courseId);
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
  }, [courseId]);

  useEffect(() => {
    if (selectedAnnouncement) {
      fetchComments(selectedAnnouncement._id);
    }
  }, [selectedAnnouncement]);

  const handleCreate = async (formData: FormData) => {
    if (!courseId) return;
    setFormLoading(true);
    setError(null);
    try {
      await createAnnouncement(courseId, formData);
      await fetchAnnouncements();
    } catch (err: any) {
      setError('Failed to post announcement');
    } finally {
      setFormLoading(false);
    }
  };

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
    } catch (err) {
      // Optionally show error
    }
    setLiking(prev => ({ ...prev, [commentId]: false }));
  };

  const handleUnlike = async (commentId: string) => {
    if (!selectedAnnouncement || !commentId) return;
    setLiking(prev => ({ ...prev, [commentId]: true }));
    try {
      await unlikeAnnouncementComment(selectedAnnouncement._id, commentId);
      await fetchComments(selectedAnnouncement._id);
    } catch (err) {
      // Optionally show error
    }
    setLiking(prev => ({ ...prev, [commentId]: false }));
  };

  const handleEditAnnouncement = async (formData: FormData) => {
    if (!selectedAnnouncement) return;
    setFormLoading(true);
    setError(null);
    try {
      await updateAnnouncement(selectedAnnouncement._id, formData);
      setEditMode(false);
      await fetchAnnouncements();
      // Refresh detail view
      const updated = await getAnnouncements(courseId);
      setSelectedAnnouncement(updated.find((a: any) => a._id === selectedAnnouncement._id) || null);
    } catch (err: any) {
      setError('Failed to update announcement');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteAnnouncement = async () => {
    if (!selectedAnnouncement) return;
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;
    setFormLoading(true);
    setError(null);
    try {
      await deleteAnnouncement(selectedAnnouncement._id);
      setSelectedAnnouncement(null);
      await fetchAnnouncements();
    } catch (err: any) {
      setError('Failed to delete announcement');
    } finally {
      setFormLoading(false);
    }
  };

  const renderComments = (comments: Comment[], level = 0, parentKey = '') => {
    // If top-level and hiding is required, filter to only show user's own comments
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
      <ul className={level === 0 ? 'space-y-6' : 'ml-8 space-y-4 mt-4'}>
        {visibleComments
          .filter(comment => comment._id)
          .map((comment) => {
            const isLiked = user && comment.likes && comment.likes.includes(user._id);
            const shouldShowReplies = userHasPosted || 
              !selectedAnnouncement?.options?.requirePostBeforeSeeingReplies ||
              user?.role !== 'student';
            const visibleReplies = shouldShowReplies ? comment.replies : [];
            return (
              <li key={parentKey + comment._id} className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-semibold text-sm">
                      {comment.author.firstName[0]}{comment.author.lastName[0]}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900">{comment.author.firstName} {comment.author.lastName}</span>
                    <div className="text-xs text-gray-500">{new Date(comment.createdAt).toLocaleString()}</div>
                  </div>
                </div>
                <div className="mb-4 text-gray-700 leading-relaxed">{comment.text}</div>
                <div className="flex gap-3 items-center">
                  {user && selectedAnnouncement?.options?.allowLiking && (
                    <button
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors font-medium text-sm ${isLiked ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      onClick={e => {
                        e.preventDefault();
                        isLiked ? handleUnlike(comment._id) : handleLike(comment._id);
                      }}
                      disabled={liking[comment._id]}
                    >
                      <ThumbsUp className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                      {comment.likes?.length || 0}
                    </button>
                  )}
                  {user && (
                    <button
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      onClick={() => setReplyingTo(comment._id)}
                    >
                      Reply
                    </button>
                  )}
                </div>
                {replyingTo === comment._id && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <textarea
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={3}
                      placeholder="Write a reply..."
                      value={replyText[comment._id] || ''}
                      onChange={e => setReplyText(prev => ({ ...prev, [comment._id]: e.target.value }))}
                      disabled={posting}
                    />
                    <div className="flex gap-3 mt-3 justify-end">
                      <button
                        className="px-4 py-2 text-sm bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                        onClick={() => setReplyingTo(null)}
                        disabled={posting}
                      >
                        Cancel
                      </button>
                      <button
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        onClick={() => handlePostReply(comment._id)}
                        disabled={posting}
                      >
                        {posting ? 'Replying...' : 'Reply'}
                      </button>
                    </div>
                  </div>
                )}
                {!shouldShowReplies && comment.replies && comment.replies.length > 0 && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                    <Info className="w-4 h-4 inline mr-2" /> {comment.replies.length} repl{comment.replies.length === 1 ? 'y' : 'ies'} hidden. Post a comment first to see replies.
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
    <div className="max-w-5xl mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Announcements</h2>
          <p className="text-gray-600">Stay updated with the latest course information</p>
        </div>
        {!selectedAnnouncement && user && (user.role === 'teacher' || user.role === 'admin') && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            New Announcement
          </button>
        )}
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-700 font-medium">{error}</span>
          </div>
        </div>
      )}
      
      {selectedAnnouncement ? (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 max-w-4xl mx-auto overflow-hidden">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
            <button
              className="mb-4 px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium border border-gray-200 flex items-center gap-2 shadow-sm"
              onClick={() => setSelectedAnnouncement(null)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back to Announcements
            </button>
          </div>
          
          <div className="p-6">
            {user && (user.role === 'teacher' || user.role === 'admin') && !editMode && (
              <div className="flex gap-2 mb-6 justify-end">
                <button
                  className="px-4 py-2 text-sm bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 transition-colors font-medium"
                  onClick={() => setEditMode(true)}
                >
                  Edit
                </button>
                <button
                  className="px-4 py-2 text-sm bg-red-100 text-red-800 rounded-lg hover:bg-red-200 transition-colors font-medium"
                  onClick={handleDeleteAnnouncement}
                >
                  Delete
                </button>
              </div>
            )}
            
            {editMode ? (
              <AnnouncementForm
                key={selectedAnnouncement?._id || 'new'}
                onSubmit={handleEditAnnouncement}
                loading={formLoading}
                onCancel={() => setEditMode(false)}
                initialValues={{
                  title: selectedAnnouncement.title,
                  body: selectedAnnouncement.body,
                  postTo: selectedAnnouncement.postTo,
                  options: selectedAnnouncement.options,
                  delayedUntil: selectedAnnouncement.delayedUntil,
                }}
              />
            ) : (
              <>
                <div className="mb-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-2xl font-bold text-gray-900">{selectedAnnouncement.title}</h3>
                    <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                      {new Date(selectedAnnouncement.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="prose max-w-none text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: selectedAnnouncement.body }} />
                  <div className="mt-4 text-sm text-gray-600">
                    By <span className="font-medium">{selectedAnnouncement.author.firstName} {selectedAnnouncement.author.lastName}</span>
                  </div>
                </div>
                
                {selectedAnnouncement.options && Object.values(selectedAnnouncement.options).some(Boolean) && (
                  user && user.role !== 'student' && (
                    <div className="mb-6 flex flex-wrap gap-2">
                      {selectedAnnouncement.options.delayPosting && <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-medium">Delay posting</span>}
                      {selectedAnnouncement.options.allowComments && <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">Comments enabled</span>}
                      {selectedAnnouncement.options.requirePostBeforeSeeingReplies && <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-medium">Post before seeing replies</span>}
                      {selectedAnnouncement.options.enablePodcastFeed && <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-medium">Podcast feed</span>}
                      {selectedAnnouncement.options.allowLiking && <span className="bg-pink-100 text-pink-800 px-3 py-1 rounded-full text-xs font-medium">Liking enabled</span>}
                    </div>
                  )
                )}
                
                {/* Comments Section */}
                <div className="border-t border-gray-200 pt-6">
                  <h4 className="text-xl font-bold mb-6 text-gray-900">Comments</h4>
                  {user && user.role === 'student' && selectedAnnouncement?.options?.requirePostBeforeSeeingReplies && !userHasPosted && (
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                      <Lightbulb className="w-4 h-4 inline mr-2" /> Post a comment first to see replies from other students.
                    </div>
                  )}
                  {commentsLoading ? (
                    <div className="text-center py-8 text-gray-500">Loading comments...</div>
                  ) : (
                    <>
                      {renderComments(comments)}
                      {user && (
                        <div className="mt-8">
                          <textarea
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            rows={3}
                            placeholder="Write a comment..."
                            value={commentText}
                            onChange={e => setCommentText(e.target.value)}
                            disabled={posting}
                          />
                          <div className="flex gap-3 mt-3 justify-end">
                            <button
                              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
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
              </>
            )}
          </div>
        </div>
      ) : (
        loading ? (
          <div>Loading announcements...</div>
        ) : (
          <AnnouncementList announcements={announcements} onSelect={setSelectedAnnouncement} />
        )
      )}
    </div>
  );
};

export default Announcements; 