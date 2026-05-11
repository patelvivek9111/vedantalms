type InboxFilterArgs = {
  conversation: any;
  currentUserId: string;
  selectedCourse: string;
  selectedFolder: string;
  search: string;
  userRole?: string;
};

const getParticipant = (conversation: any, currentUserId: string) =>
  (conversation?.participants || []).find((p: any) => String(p?._id) === String(currentUserId));

const getParticipantFolder = (conversation: any, currentUserId: string) => {
  const participant = getParticipant(conversation, currentUserId);
  return participant?.folder || conversation?.folder || 'inbox';
};

export const matchesInboxFilters = ({
  conversation,
  currentUserId,
  selectedCourse,
  selectedFolder,
  search,
  userRole,
}: InboxFilterArgs) => {
  if (userRole !== 'admin' && selectedCourse !== 'all' && conversation?.course !== selectedCourse) return false;

  const participant = getParticipant(conversation, currentUserId);
  const folder = getParticipantFolder(conversation, currentUserId);
  const searchLower = (search || '').toLowerCase();

  if (searchLower) {
    const subject = (conversation?.subject || '').toLowerCase();
    const snippet = (conversation?.lastMessage?.body || '').toLowerCase();
    const senders = (conversation?.participants || [])
      .map((p: any) => p?.name || `${p?.firstName || ''} ${p?.lastName || ''}`)
      .join(', ')
      .toLowerCase();
    const matchesSearch = subject.includes(searchLower) || snippet.includes(searchLower) || senders.includes(searchLower);
    if (!matchesSearch) return false;

    const isInInbox = conversation?.hasReceivedMessage === true && folder !== 'archived' && folder !== 'deleted';
    const isSent = conversation?.hasSentMessage === true;
    const isArchived = folder === 'archived';
    const isFavorite = participant?.starred === true;
    const isDeleted = folder === 'deleted';
    if (isDeleted) return false;
    return isInInbox || isSent || isArchived || isFavorite;
  }

  if (selectedFolder !== 'deleted' && folder === 'deleted') return false;

  if (selectedFolder === 'inbox') {
    if (!(conversation?.hasReceivedMessage === true)) return false;
    if (folder === 'archived' || folder === 'deleted') return false;
  }
  if (selectedFolder === 'sent') {
    if (conversation?.hasSentMessage !== true) return false;
    if (folder === 'deleted') return false;
  }
  if (selectedFolder === 'archived' && folder !== 'archived') return false;
  if (selectedFolder === 'favorite' && (!participant?.starred || folder === 'deleted')) return false;
  if (selectedFolder === 'deleted' && folder !== 'deleted') return false;

  return true;
};

