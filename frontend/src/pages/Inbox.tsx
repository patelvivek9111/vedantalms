import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { searchUsers } from '../services/inboxService';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { isInboxWebSocketEnabled } from '../utils/messagingSocket';
import { User } from 'lucide-react';
import { BurgerMenu } from '../components/layout/BurgerMenu';
import { useOnlineStatus, markUserOnline } from '../hooks/useOnlineStatus';
import ConfirmationModal from '../components/common/ConfirmationModal';
import PullToRefresh from '../components/common/PullToRefresh';
import SwipeableContainer from '../components/common/SwipeableContainer';
import { useBottomNavSwipe } from '../hooks/useBottomNavSwipe';
import { matchesInboxFilters } from '../utils/inboxFilters';
import type { NormalizedFile } from '../utils/fileTypes';
import { fileAssetIdsFromFiles } from '../utils/fileTypes';
import InboxToolbar from '../components/inbox/InboxToolbar';
import ConversationList from '../components/inbox/ConversationList';
import MessageThread from '../components/inbox/MessageThread';
import ComposeModal from '../components/inbox/ComposeModal';
import { useInboxUrlState } from '../hooks/inbox/useInboxUrlState';
import { useInboxConversationsQuery } from '../hooks/inbox/useInboxConversationsQuery';
import { useInboxMessagesQuery } from '../hooks/inbox/useInboxMessagesQuery';
import { useInboxMutations } from '../hooks/inbox/useInboxMutations';
import { useInboxRealtime } from '../hooks/inbox/useInboxRealtime';
import { useInboxInvalidate } from '../hooks/inbox/useInboxInvalidate';

const EMPTY_CONVERSATIONS: any[] = [];
const EMPTY_MESSAGES: any[] = [];

function sameIdList(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

const Inbox: React.FC = () => {
  const { user, token } = useAuth();
  const { isUserOnline } = useOnlineStatus(user?._id);
  const currentUserId = user?._id || '';

  const url = useInboxUrlState();
  const {
    folder: selectedFolder,
    course: selectedCourse,
    conversationId,
    search,
    composeOpen: showCompose,
    setFolder: setSelectedFolder,
    setCourse: setSelectedCourse,
    setConversationId,
    setSearch,
    setComposeOpen: setShowCompose,
  } = url;

  const conversationsQuery = useInboxConversationsQuery(currentUserId);
  const conversations = conversationsQuery.data ?? EMPTY_CONVERSATIONS;
  const loading = conversationsQuery.isLoading;
  const conversationsError = conversationsQuery.isError;
  const refetchConversations = conversationsQuery.refetch;

  const selectedConversation = useMemo(() => {
    if (!conversationId) return null;
    return conversations.find((c: any) => c._id === conversationId) ?? null;
  }, [conversations, conversationId]);

  const messagesQuery = useInboxMessagesQuery(
    conversationId || undefined,
    Boolean(conversationId)
  );
  const messages = messagesQuery.data ?? EMPTY_MESSAGES;
  const messagesLoading = messagesQuery.isLoading;
  const messagesQueryError = messagesQuery.isError;

  const mutations = useInboxMutations(currentUserId);
  const { invalidateConversations } = useInboxInvalidate(currentUserId);
  useInboxRealtime({
    token,
    conversationId: conversationId || undefined,
    enabled: isInboxWebSocketEnabled(),
  });

  const [showBurgerMenu, setShowBurgerMenu] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [selectedConversations, setSelectedConversations] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isPermanentDelete, setIsPermanentDelete] = useState(false);

  const [composeRecipients, setComposeRecipients] = useState<any[]>([]);
  const [composeQuery, setComposeQuery] = useState('');
  const [composeUserResults, setComposeUserResults] = useState<any[]>([]);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeAttachments, setComposeAttachments] = useState<NormalizedFile[]>([]);
  const [replyAttachments, setReplyAttachments] = useState<NormalizedFile[]>([]);
  const [composeLoading, setComposeLoading] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [composeCourse, setComposeCourse] = useState('');
  const [composeCourseOptions, setComposeCourseOptions] = useState<any[]>([]);
  const [composeToGroup, setComposeToGroup] = useState('');
  const [composeGroupUsers, setComposeGroupUsers] = useState<any[]>([]);
  const composeToDropdownRef = useRef<HTMLDivElement>(null);
  const [composeToInput, setComposeToInput] = useState('');
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [sendIndividually, setSendIndividually] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [courseOptions, setCourseOptions] = useState([{ value: 'all', label: 'All Courses' }]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const error = conversationsError ? 'Failed to load conversations' : null;
  const messagesError = messagesQueryError ? 'Failed to load messages' : null;

  const filteredConversations = useMemo(
    () =>
      conversations.filter((conv: any) =>
        matchesInboxFilters({
          conversation: conv,
          currentUserId,
          selectedCourse,
          selectedFolder,
          search,
          userRole: user?.role,
        })
      ),
    [conversations, currentUserId, selectedCourse, selectedFolder, search, user?.role]
  );

  const filteredConversationIdSet = useMemo(
    () => new Set(filteredConversations.map((conv: any) => conv._id)),
    [filteredConversations]
  );

  useEffect(() => {
    setSelectedConversations((prev) => {
      const next = prev.filter((id) => filteredConversationIdSet.has(id));
      return sameIdList(prev, next) ? prev : next;
    });
  }, [filteredConversationIdSet]);

  const presenceUserKey = useMemo(() => {
    const ids = new Set<string>();
    selectedConversation?.participants?.forEach((participant: any) => {
      if (participant._id && participant._id !== currentUserId) {
        ids.add(String(participant._id));
      }
    });
    messages.forEach((msg: any) => {
      if (msg.senderId?._id && msg.senderId._id !== currentUserId) {
        ids.add(String(msg.senderId._id));
      }
    });
    return Array.from(ids).sort().join(',');
  }, [selectedConversation, messages, currentUserId]);

  useEffect(() => {
    if (!presenceUserKey) return;
    presenceUserKey.split(',').forEach((userId) => markUserOnline(userId));
  }, [presenceUserKey]);

  const markConversationReadIfNeeded = useCallback(
    async (conv: any) => {
      if (!conv?._id || !(conv.unreadCount > 0)) return;
      try {
        await mutations.markRead.mutateAsync(conv._id);
      } catch {
        /* list will reconcile on next poll */
      }
    },
    [mutations.markRead]
  );

  const handleSelectConversation = useCallback(
    async (conv: any) => {
      setConversationId(conv._id);
      setShowReplyBox(false);
      await markConversationReadIfNeeded(conv);
    },
    [setConversationId, markConversationReadIfNeeded]
  );

  useEffect(() => {
    if (!selectedConversation) return;
    void markConversationReadIfNeeded(selectedConversation);
  }, [selectedConversation, markConversationReadIfNeeded]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim() || !selectedConversation) return;
    setSending(true);
    setSendError(null);
    try {
      await mutations.sendReply.mutateAsync({
        conversationId: selectedConversation._id,
        body: reply,
        fileAssetIds: fileAssetIdsFromFiles(replyAttachments),
      });
      setReplyAttachments([]);
      setReply('');
      setShowReplyBox(false);
    } catch {
      setSendError('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleToggleStar = async (conv: any) => {
    try {
      await mutations.starConversation.mutateAsync(conv._id);
    } catch {
      /* optional toast */
    }
  };

  const handleArchive = async () => {
    const isUnarchive = selectedFolder === 'archived';
    const isRestore = selectedFolder === 'deleted';
    const movesToInbox = isUnarchive || isRestore;
    if (selectedConversations.length === 0) {
      alert(
        isUnarchive
          ? 'Please select conversations to unarchive'
          : isRestore
            ? 'Please select conversations to restore'
            : 'Please select conversations to archive'
      );
      return;
    }
    setBulkActionLoading(true);
    try {
      if (movesToInbox) {
        await mutations.unarchiveConversations.mutateAsync(selectedConversations);
      } else {
        await mutations.archiveConversations.mutateAsync(selectedConversations);
      }
      setSelectedConversations([]);
      if (conversationId && selectedConversations.includes(conversationId)) {
        setConversationId(null);
      }
    } catch {
      alert(
        isUnarchive
          ? 'Failed to unarchive conversations'
          : isRestore
            ? 'Failed to restore conversations'
            : 'Failed to archive conversations'
      );
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleRestoreConversation = async () => {
    if (!conversationId) return;
    const isRestore = selectedFolder === 'deleted';
    setBulkActionLoading(true);
    try {
      await mutations.unarchiveConversations.mutateAsync([conversationId]);
      setConversationId(null);
    } catch {
      alert(isRestore ? 'Failed to restore conversation' : 'Failed to unarchive conversation');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleDelete = () => {
    if (selectedConversations.length === 0) {
      alert('Please select conversations to delete');
      return;
    }
    setIsPermanentDelete(selectedFolder === 'deleted');
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    setShowDeleteConfirm(false);
    setBulkActionLoading(true);
    try {
      await mutations.deleteConversations.mutateAsync({
        ids: selectedConversations,
        permanent: isPermanentDelete,
      });
      setSelectedConversations([]);
      if (conversationId && selectedConversations.includes(conversationId)) {
        setConversationId(null);
      }
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Failed to delete conversations';
      alert(`Failed to delete conversations: ${errorMsg}`);
    } finally {
      setBulkActionLoading(false);
    }
  };

  useEffect(() => {
    if (composeQuery.length < 2) {
      setComposeUserResults([]);
      return;
    }
    let active = true;
    setComposeError(null);
    searchUsers(composeQuery)
      .then((users) => {
        if (active) setComposeUserResults(users);
      })
      .catch(() => {
        if (active) setComposeError('Failed to search users');
      });
    return () => {
      active = false;
    };
  }, [composeQuery]);

  useEffect(() => {
    if (!showCompose) return;
    api.get('/courses').then((res) => {
      setComposeCourseOptions(res.data.data || []);
      if (res.data.data?.length > 0) {
        setComposeCourse(res.data.data[0]._id);
      }
    });
  }, [showCompose]);

  useEffect(() => {
    if (!composeToGroup) return;
    if (user?.role === 'admin') {
      if (composeToGroup === 'teachers') {
        api.get('/users/search?role=teacher,admin').then((res) => {
          setComposeGroupUsers(res.data.data || []);
        });
      } else if (composeToGroup === 'students') {
        api.get('/users/search?role=student').then((res) => {
          setComposeGroupUsers(res.data.data || []);
        });
      } else if (composeToGroup === 'admins') {
        api.get('/users/search?role=admin').then((res) => {
          setComposeGroupUsers(res.data.data || []);
        });
      }
    } else {
      if (!composeCourse) return;
      if (composeToGroup === 'teachers') {
        if (user?.role === 'teacher' || user?.role === 'admin') {
          api.get('/users/search?role=teacher,admin').then((res) => {
            setComposeGroupUsers(res.data.data || []);
          });
        } else {
          api.get(`/courses/${composeCourse}`).then((res) => {
            const instructor = res.data.data.instructor ? [res.data.data.instructor] : [];
            setComposeGroupUsers(instructor);
          });
        }
      } else if (composeToGroup === 'students') {
        api.get(`/courses/${composeCourse}/students`).then((res) => {
          setComposeGroupUsers(res.data || []);
        });
      } else if (composeToGroup === 'sections') {
        setComposeGroupUsers([]);
      }
    }
  }, [composeCourse, composeToGroup, user]);

  useEffect(() => {
    if (composeToInput.length < 2) {
      setComposeUserResults([]);
      return;
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      let roleParam = '';
      if (user?.role === 'admin') {
        if (composeToGroup === 'teachers') roleParam = 'teacher,admin';
        else if (composeToGroup === 'students') roleParam = 'student';
      } else {
        if (composeToGroup === 'teachers') {
          roleParam =
            user?.role === 'teacher' || user?.role === 'admin' ? 'teacher,admin' : 'teacher';
        } else if (composeToGroup === 'students') {
          roleParam = 'student';
        }
      }
      const searchUrl = roleParam
        ? `/users/search?name=${encodeURIComponent(composeToInput)}&email=${encodeURIComponent(composeToInput)}&role=${roleParam}`
        : `/users/search?name=${encodeURIComponent(composeToInput)}&email=${encodeURIComponent(composeToInput)}`;
      api
        .get(searchUrl)
        .then((res) => setComposeUserResults(res.data.data || []))
        .catch(() => setComposeUserResults([]));
    }, 300);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [composeToInput, composeToGroup, user]);

  useEffect(() => {
    if (user?.role === 'admin') return;
    api.get('/courses').then((res) => {
      const userCourses = (res.data.data || []).map((c: any) => ({
        value: c._id,
        label: c.catalog?.courseCode || c.title,
      }));
      setCourseOptions([{ value: 'all', label: 'All Courses' }, ...userCourses]);
    });
  }, [user]);

  const handleAddRecipient = (recipient: any) => {
    if (!composeRecipients.some((u) => u._id === recipient._id)) {
      setComposeRecipients([...composeRecipients, recipient]);
    }
    setComposeQuery('');
    setComposeUserResults([]);
  };

  const handleRemoveRecipient = (userId: string) => {
    setComposeRecipients(composeRecipients.filter((u) => u._id !== userId));
  };

  const handleCompose = async (e: React.FormEvent) => {
    e.preventDefault();
    setComposeLoading(true);
    setComposeError('');
    try {
      let recipients = composeRecipients.map((u) => u._id);
      if (composeToGroup === 'sections') {
        const res = await api.get(`/courses/${composeCourse}/students`);
        recipients = Array.isArray(res.data) ? res.data.map((u: any) => u._id) : [];
      }
      await api.post('/inbox/conversations', {
        course: user?.role === 'admin' ? null : composeCourse,
        participantIds: recipients,
        subject: composeSubject,
        body: composeBody,
        sendIndividually,
        fileAssetIds: fileAssetIdsFromFiles(composeAttachments),
      });
      setShowCompose(false);
      setComposeRecipients([]);
      setComposeSubject('');
      setComposeBody('');
      setComposeAttachments([]);
      setComposeToGroup('');
      setComposeGroupUsers([]);
      setComposeCourse('');
      setSendIndividually(false);
      await invalidateConversations();
    } catch (err: any) {
      setComposeError(err.response?.data?.message || 'Failed to send message');
    } finally {
      setComposeLoading(false);
    }
  };

  const handleRefresh = async () => {
    await refetchConversations();
  };

  const { handleSwipeLeft, handleSwipeRight, enabled: swipeEnabled } = useBottomNavSwipe();

  return (
    <SwipeableContainer
      onSwipeLeft={swipeEnabled ? handleSwipeLeft : undefined}
      onSwipeRight={swipeEnabled ? handleSwipeRight : undefined}
      enabled={swipeEnabled}
      preventScrollInterference
      className="flex h-full min-h-[calc(100dvh-4rem-env(safe-area-inset-bottom,0px))] flex-col bg-gray-50 dark:bg-gray-950 lg:min-h-[calc(100dvh-4rem)]"
    >
      <PullToRefresh
        onRefresh={handleRefresh}
        className="flex h-full min-h-0 flex-1 flex-col bg-gray-50 dark:bg-gray-950"
      >
        <div className="flex h-full min-h-0 w-full flex-1 flex-col bg-gray-50 dark:bg-gray-950 lg:min-h-[calc(100dvh-4rem)]">
          {!conversationId && (
            <nav className="lg:hidden fixed top-0 left-0 right-0 z-[150] bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm safe-area-inset-top">
              <div className="relative flex items-center justify-between px-4 py-3">
                <button
                  type="button"
                  onClick={() => setShowBurgerMenu(!showBurgerMenu)}
                  className="text-gray-700 dark:text-gray-300 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
                  aria-label="Open account menu"
                >
                  <User className="w-6 h-6" />
                </button>
                <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Inbox</h1>
                <div className="w-10" />
                <BurgerMenu showBurgerMenu={showBurgerMenu} setShowBurgerMenu={setShowBurgerMenu} />
              </div>
            </nav>
          )}

          <div className={conversationId ? 'hidden lg:block' : undefined}>
          <InboxToolbar
            userRole={user?.role}
            courseOptions={courseOptions}
            selectedCourse={selectedCourse}
            selectedFolder={selectedFolder}
            search={search}
            selectedCount={selectedConversations.length}
            bulkActionLoading={bulkActionLoading}
            searchInputRef={searchInputRef}
            onCourseChange={setSelectedCourse}
            onFolderChange={setSelectedFolder}
            onSearchChange={setSearch}
            onCompose={() => setShowCompose(true)}
            onArchive={handleArchive}
            onDelete={handleDelete}
          />
          </div>

          <div
            className={`flex min-h-0 w-full flex-1 flex-col gap-3 px-0 lg:flex-row lg:gap-4 lg:px-6 lg:pb-6 ${conversationId ? 'py-0 lg:pt-4' : 'pt-2 pb-0 lg:pt-4'}`}
          >
            <ComposeModal
              open={showCompose}
              onClose={() => setShowCompose(false)}
              user={user}
              composeCourse={composeCourse}
              composeCourseOptions={composeCourseOptions}
              setComposeCourse={setComposeCourse}
              composeRecipients={composeRecipients}
              composeToGroup={composeToGroup}
              composeGroupUsers={composeGroupUsers}
              composeToInput={composeToInput}
              composeUserResults={composeUserResults}
              composeSubject={composeSubject}
              composeBody={composeBody}
              composeAttachments={composeAttachments}
              sendIndividually={sendIndividually}
              composeLoading={composeLoading}
              composeError={composeError}
              showGroupDropdown={showGroupDropdown}
              composeToDropdownRef={composeToDropdownRef}
              isUserOnline={isUserOnline}
              onSubmit={handleCompose}
              handleAddRecipient={handleAddRecipient}
              handleRemoveRecipient={handleRemoveRecipient}
              setComposeToGroup={setComposeToGroup}
              setComposeGroupUsers={setComposeGroupUsers}
              setComposeToInput={setComposeToInput}
              setComposeUserResults={setComposeUserResults}
              setShowGroupDropdown={setShowGroupDropdown}
              setComposeSubject={setComposeSubject}
              setComposeBody={setComposeBody}
              setComposeAttachments={setComposeAttachments}
              setSendIndividually={setSendIndividually}
            />

            <ConversationList
              conversations={conversations}
              filteredConversations={filteredConversations}
              loading={loading}
              error={error}
              currentUserId={currentUserId}
              selectedConversationId={conversationId}
              selectedConversations={selectedConversations}
              bulkActionLoading={bulkActionLoading}
              isUserOnline={isUserOnline}
              onSelectConversation={handleSelectConversation}
              onToggleStar={handleToggleStar}
              onSelectionChange={setSelectedConversations}
            />

            <div
              className={`flex min-h-[400px] min-w-0 flex-1 flex-col bg-white p-0 dark:bg-gray-800 lg:min-h-0 lg:overflow-hidden lg:rounded-xl lg:border lg:border-gray-200/80 lg:shadow-sm dark:lg:border-gray-700 ${!selectedConversation ? 'hidden lg:flex' : 'flex'}`}
            >
              {!selectedConversation && (
                <div className="flex h-full flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                  <svg width="96" height="96" fill="none" viewBox="0 0 24 24">
                    <path
                      d="M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6Zm2 0 8 7 8-7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                    No Conversations Selected
                  </div>
                </div>
              )}
              {selectedConversation && (
                <MessageThread
                  conversation={selectedConversation}
                  messages={messages}
                  messagesLoading={messagesLoading}
                  messagesError={messagesError}
                  currentUserId={currentUserId}
                  showReplyBox={showReplyBox}
                  reply={reply}
                  replyAttachments={replyAttachments}
                  sending={sending}
                  sendError={sendError}
                  isUserOnline={isUserOnline}
                  onBack={() => setConversationId(null)}
                  onShowReply={() => setShowReplyBox(true)}
                  onHideReply={() => setShowReplyBox(false)}
                  onReplyChange={setReply}
                  onReplyAttachmentsChange={setReplyAttachments}
                  onSendReply={handleSendReply}
                  restoreAction={
                    selectedFolder === 'archived' || selectedFolder === 'deleted'
                      ? {
                          label: selectedFolder === 'deleted' ? 'Restore' : 'Unarchive',
                          loading: bulkActionLoading,
                          onRestore: handleRestoreConversation,
                        }
                      : undefined
                  }
                />
              )}
            </div>
          </div>

          <ConfirmationModal
            isOpen={showDeleteConfirm}
            onClose={() => setShowDeleteConfirm(false)}
            onConfirm={confirmDelete}
            title={
              isPermanentDelete ? 'Permanently Delete Conversations' : 'Delete Conversations'
            }
            message={
              isPermanentDelete
                ? `Are you sure you want to permanently delete ${selectedConversations.length} conversation${selectedConversations.length !== 1 ? 's' : ''}? This cannot be undone.`
                : `Are you sure you want to delete ${selectedConversations.length} conversation${selectedConversations.length !== 1 ? 's' : ''}?`
            }
            confirmText="Delete"
            cancelText="Cancel"
            variant="danger"
            isLoading={bulkActionLoading}
          />

        </div>
      </PullToRefresh>
    </SwipeableContainer>
  );
};

export default Inbox;
