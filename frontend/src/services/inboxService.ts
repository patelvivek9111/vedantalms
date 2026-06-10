import api from './api';

export const fetchInboxUnreadCount = async (): Promise<number> => {
  const res = await api.get('/inbox/unread-count');
  return typeof res.data?.count === 'number' ? res.data.count : 0;
};

export const fetchConversations = async (folder?: string) => {
  const res = await api.get('/inbox/conversations', { params: folder ? { folder } : undefined });
  return res.data;
};

export const fetchMessages = async (conversationId: string) => {
  const res = await api.get(`/inbox/conversations/${conversationId}/messages`);
  return Array.isArray(res.data?.data) ? res.data.data : [];
};

export const markConversationRead = async (conversationId: string) => {
  const res = await api.post(`/inbox/conversations/${conversationId}/read`);
  return res.data;
};

export const sendMessage = async (
  conversationId: string,
  body: string,
  fileAssetIds?: string[],
  legacyAttachments?: string[]
) => {
  const payload: {
    body: string;
    fileAssetIds?: string[];
    attachments?: string[];
  } = { body };
  if (fileAssetIds?.length) {
    payload.fileAssetIds = fileAssetIds;
  }
  if (legacyAttachments?.length) {
    payload.attachments = legacyAttachments;
  }
  const res = await api.post(`/inbox/conversations/${conversationId}/messages`, payload);
  return res.data;
};

export const createConversation = async (participantIds: string[], subject: string, body: string) => {
  const res = await api.post('/inbox/conversations', { participantIds, subject, body });
  return res.data;
};

export const searchUsers = async (query: string) => {
  const res = await api.get(`/users/search?name=${encodeURIComponent(query)}`);
  return res.data.data;
};

export const toggleStar = async (conversationId: string) => {
  const res = await api.post(`/inbox/conversations/${conversationId}/star`);
  return res.data;
};

// Move conversation to a folder (archive, delete, etc.)
export const moveConversation = async (conversationId: string, folder: string) => {
  const id = typeof conversationId === 'string' ? conversationId : String(conversationId);
  const res = await api.post(`/inbox/conversations/${id}/move`, { folder });
  return res.data;
};

// Bulk operations
export const bulkMoveConversations = async (conversationIds: string[], folder: string) => {
  const promises = conversationIds.map((id) => moveConversation(id, folder));
  return Promise.all(promises);
};

export const deleteForever = async (conversationId: string) => {
  const res = await api.delete(`/inbox/conversations/${conversationId}/forever`);
  return res.data;
};

export const bulkDeleteForever = async (conversationIds: string[]) => {
  const promises = conversationIds.map(id => deleteForever(id));
  return Promise.all(promises);
}; 