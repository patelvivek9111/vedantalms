import React, { useEffect, useState } from 'react';
import AnnouncementList, { Announcement } from '../components/announcements/AnnouncementList';
import AnnouncementForm from '../components/announcements/AnnouncementForm';
import { getAnnouncements, createAnnouncement, getAnnouncementComments, postAnnouncementComment, postAnnouncementReply, likeAnnouncementComment, unlikeAnnouncementComment, updateAnnouncement, deleteAnnouncement } from '../services/announcementService';
import { useAuth } from '../contexts/AuthContext';
import { useState as useReactState } from 'react';
import { ArrowLeft, ThumbsUp, Info, Lightbulb, Pencil, Trash2 } from 'lucide-react';
import ConfirmationModal from '../components/common/ConfirmationModal';
import { BTN_PRIMARY, BTN_SECONDARY, FORM_ERROR, FORM_SHELL } from '../components/common/formStyles';
import {
  AnnouncementAuthorAvatar,
  AnnouncementCommentComposer,
  AnnouncementOptionBadges,
  formatAnnouncementDate,
} from '../components/announcements/announcementUi';

interface AnnouncementsProps {
  courseId: string;
}

interface Comment {
  _id: string;
  author: { _id: string; firstName: string; lastName: string; profilePicture?: string };
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
      setAnnouncements(Array.isArray(data) ? data : []);
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
      const safeComments = Array.isArray(data) ? data : [];
      setComments(safeComments);
      if (user && selectedAnnouncement?.options?.requirePostBeforeSeeingReplies) {
        const hasPosted = safeComments.some(
          (comment: Comment) => comment.author?._id === user._id
        );
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

  const handleDeleteAnnouncement = () => {
    if (!selectedAnnouncement) return;
    setShowDeleteConfirm(true);
  };

  const confirmDeleteAnnouncement = async () => {
    if (!selectedAnnouncement) return;
    setShowDeleteConfirm(false);
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
      visibleComments = comments.filter((comment) => comment.author?._id === user._id);
    }
    return (
      <ul className={level === 0 ? 'space-y-6' : 'ml-8 space-y-4 mt-4'}>
        {visibleComments
          .filter(comment => comment._id)
          .map((comment) => {
            const isLiked = Boolean(
              user && Array.isArray(comment.likes) && comment.likes.includes(user._id)
            );
            const shouldShowReplies = userHasPosted || 
              !selectedAnnouncement?.options?.requirePostBeforeSeeingReplies ||
              user?.role !== 'student';
            const visibleReplies = shouldShowReplies ? comment.replies : [];
            return (
              <li
                key={parentKey + comment._id}
                className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5"
              >
                <div className="mb-3 flex items-start gap-3">
                  <AnnouncementAuthorAvatar
                    firstName={comment.author?.firstName}
                    lastName={comment.author?.lastName}
                    profilePicture={comment.author?.profilePicture}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {[comment.author?.firstName, comment.author?.lastName].filter(Boolean).join(' ') ||
                        'Unknown user'}
                    </span>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {formatAnnouncementDate(comment.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="mb-4 leading-relaxed text-slate-700 dark:text-slate-300">{comment.text}</div>
                <div className="flex flex-wrap items-center gap-2">
                  {user && selectedAnnouncement?.options?.allowLiking && (
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                        isLiked
                          ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                      onClick={e => {
                        e.preventDefault();
                        isLiked ? handleUnlike(comment._id) : handleLike(comment._id);
                      }}
                      disabled={liking[comment._id]}
                    >
                      <ThumbsUp className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
                      {comment.likes?.length || 0}
                    </button>
                  )}
                  {user && (
                    <button
                      type="button"
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                      onClick={() => setReplyingTo(comment._id)}
                    >
                      Reply
                    </button>
                  )}
                </div>
                {replyingTo === comment._id && (
                  <div className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 dark:border-slate-700 dark:bg-slate-800/30">
                    <textarea
                      className="block w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      rows={3}
                      placeholder="Write a reply…"
                      value={replyText[comment._id] || ''}
                      onChange={e => setReplyText(prev => ({ ...prev, [comment._id]: e.target.value }))}
                      disabled={posting}
                    />
                    <div className="mt-3 flex justify-end gap-2">
                      <button type="button" className={BTN_SECONDARY} onClick={() => setReplyingTo(null)} disabled={posting}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={BTN_PRIMARY}
                        onClick={() => handlePostReply(comment._id)}
                        disabled={posting}
                      >
                        {posting ? 'Replying…' : 'Reply'}
                      </button>
                    </div>
                  </div>
                )}
                {!shouldShowReplies && comment.replies && comment.replies.length > 0 && (
                  <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/80 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                    <Info className="mr-2 inline h-4 w-4" />
                    {comment.replies.length} repl{comment.replies.length === 1 ? 'y' : 'ies'} hidden. Post a
                    comment first to see replies.
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
    <div className="space-y-6">
        {(user?.role === 'teacher' || user?.role === 'admin') && !selectedAnnouncement && !showCreate && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Course announcements</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Share updates with everyone in the class.</p>
            </div>
            <button type="button" onClick={() => setShowCreate(true)} className={`${BTN_PRIMARY} w-full sm:w-auto`}>
              Create announcement
            </button>
          </div>
        )}

        {showCreate && (
          <div className="mb-6">
            <AnnouncementForm
              onSubmit={async (formData) => {
                await handleCreate(formData);
                setShowCreate(false);
              }}
              loading={formLoading}
              onCancel={() => setShowCreate(false)}
            />
          </div>
        )}

        {error && (
          <div className={`${FORM_ERROR} mb-6`} role="alert">
            {error}
          </div>
        )}

        {selectedAnnouncement ? (
          <div className="mx-auto max-w-4xl overflow-hidden">
            <button
              type="button"
              className={`${BTN_SECONDARY} mb-4`}
              onClick={() => setSelectedAnnouncement(null)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to announcements
            </button>

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
                <article className={`${FORM_SHELL} overflow-hidden`}>
                  <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:px-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                          Announcement
                        </p>
                        <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
                          {selectedAnnouncement.title}
                        </h1>
                      </div>
                      {user && (user.role === 'teacher' || user.role === 'admin') && (
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            className={BTN_SECONDARY}
                            onClick={() => setEditMode(true)}
                          >
                            <Pencil className="mr-1.5 h-4 w-4" />
                            Edit
                          </button>
                          <button
                            type="button"
                            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
                            onClick={handleDeleteAnnouncement}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                      <time dateTime={selectedAnnouncement.createdAt}>
                        {formatAnnouncementDate(selectedAnnouncement.createdAt)}
                      </time>
                      <span className="hidden text-slate-300 sm:inline dark:text-slate-600">·</span>
                      <div className="flex items-center gap-2">
                        <AnnouncementAuthorAvatar
                          firstName={selectedAnnouncement.author?.firstName}
                          lastName={selectedAnnouncement.author?.lastName}
                          profilePicture={selectedAnnouncement.author?.profilePicture}
                          size="sm"
                        />
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {[selectedAnnouncement.author?.firstName, selectedAnnouncement.author?.lastName]
                            .filter(Boolean)
                            .join(' ') || 'Unknown user'}
                        </span>
                      </div>
                    </div>
                    {user && user.role !== 'student' && (
                      <AnnouncementOptionBadges options={selectedAnnouncement.options} className="mt-4" />
                    )}
                  </div>

                  <div className="px-5 py-6 sm:px-6">
                    <div
                      className="prose prose-slate max-w-none dark:prose-invert prose-headings:text-slate-900 dark:prose-headings:text-slate-100 prose-p:text-slate-700 dark:prose-p:text-slate-300"
                      dangerouslySetInnerHTML={{ __html: selectedAnnouncement.body ?? '' }}
                    />
                  </div>
                </article>

                <section className={`${FORM_SHELL} mt-6 p-5 sm:p-6`}>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Comments</h2>
                  {user &&
                    user.role === 'student' &&
                    selectedAnnouncement?.options?.requirePostBeforeSeeingReplies &&
                    !userHasPosted && (
                      <div className="mt-4 rounded-xl border border-blue-200/80 bg-blue-50/80 p-4 text-sm text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
                        <Lightbulb className="mr-2 inline h-4 w-4" />
                        Post a comment first to see replies from other students.
                      </div>
                    )}
                  {commentsLoading ? (
                    <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                      Loading comments…
                    </div>
                  ) : (
                    <div className="mt-5 space-y-6">
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
              </>
            )}
          </div>
        ) : loading ? (
          <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Loading announcements…</div>
        ) : (
          <AnnouncementList announcements={announcements} onSelect={setSelectedAnnouncement} />
        )}

      {/* Delete Announcement Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDeleteAnnouncement}
        title="Delete Announcement"
        message="Are you sure you want to delete this announcement? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={formLoading}
      />
    </div>
  );
};

export default Announcements; 