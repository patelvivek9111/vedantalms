import api from './api';

// Helper to validate ObjectId-like strings (24 hex characters)
const isValidId = (id: string): boolean => {
  return id && typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id.trim());
};

// Helper to sanitize text input (prevent XSS)
const sanitizeText = (text: string): string => {
  if (!text || typeof text !== 'string') return '';
  // Remove HTML tags and trim
  return text.replace(/<[^>]*>/g, '').trim();
};

// Helper to validate folder name
const isValidFolder = (folder: string): boolean => {
  const validFolders = ['inbox', 'sent', 'archived'];
  return validFolders.includes(folder);
};

export const fetchConversations = async () => {
  const res = await api.get('/inbox/conversations');
  return res.data;
};

export const fetchMessages = async (conversationId: string) => {
  // Validate conversationId
  if (!isValidId(conversationId)) {
    throw new Error('Invalid conversation ID format');
  }

  const res = await api.get(`/inbox/conversations/${conversationId}/messages`);
  return res.data;
};

export const sendMessage = async (conversationId: string, body: string) => {
  // Validate conversationId
  if (!isValidId(conversationId)) {
    throw new Error('Invalid conversation ID format');
  }

  // Validate and sanitize body
  const sanitizedBody = sanitizeText(body);
  if (!sanitizedBody || sanitizedBody.length === 0) {
    throw new Error('Message body is required');
  }

  const res = await api.post(`/inbox/conversations/${conversationId}/messages`, { body: sanitizedBody });
  return res.data;
};

export const createConversation = async (participantIds: string[], subject: string, body: string) => {
  // Validate participantIds
  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    throw new Error('At least one participant is required');
  }

  // Validate all participant IDs
  for (const id of participantIds) {
    if (!isValidId(id)) {
      throw new Error('Invalid participant ID format');
    }
  }

  // Validate and sanitize subject
  const sanitizedSubject = sanitizeText(subject);
  if (!sanitizedSubject || sanitizedSubject.length === 0) {
    throw new Error('Subject is required');
  }

  // Validate and sanitize body
  const sanitizedBody = sanitizeText(body);
  if (!sanitizedBody || sanitizedBody.length === 0) {
    throw new Error('Message body is required');
  }

  const res = await api.post('/inbox/conversations', { 
    participantIds, 
    subject: sanitizedSubject, 
    body: sanitizedBody 
  });
  return res.data;
};

export const searchUsers = async (query: string) => {
  // Validate query
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    throw new Error('Search query is required');
  }

  // Limit query length to prevent ReDoS
  if (query.length > 100) {
    throw new Error('Search query is too long (max 100 characters)');
  }

  // Sanitize query
  const sanitizedQuery = sanitizeText(query);
  if (!sanitizedQuery) {
    throw new Error('Invalid search query');
  }

  const res = await api.get(`/users/search?name=${encodeURIComponent(sanitizedQuery)}`);
  return res.data.data;
};

export const toggleStar = async (conversationId: string) => {
  // Validate conversationId
  if (!isValidId(conversationId)) {
    throw new Error('Invalid conversation ID format');
  }

  const res = await api.post(`/inbox/conversations/${conversationId}/star`);
  return res.data;
};

// Move conversation to a folder (archive, delete, etc.)
export const moveConversation = async (conversationId: string, folder: string) => {
  // Validate conversationId
  if (!isValidId(conversationId)) {
    throw new Error('Invalid conversation ID format');
  }

  // Validate folder
  if (!isValidFolder(folder)) {
    throw new Error('Invalid folder. Must be one of: inbox, sent, archived');
  }

  const res = await api.post(`/inbox/conversations/${conversationId}/move`, { folder });
  return res.data;
};

// Bulk operations
export const bulkMoveConversations = async (conversationIds: string[], folder: string) => {
  // Validate folder
  if (!isValidFolder(folder)) {
    throw new Error('Invalid folder. Must be one of: inbox, sent, archived');
  }

  // Validate conversationIds array
  if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
    throw new Error('At least one conversation ID is required');
  }

  // Validate all IDs
  for (const id of conversationIds) {
    if (!isValidId(id)) {
      throw new Error('Invalid conversation ID format');
    }
  }

  const promises = conversationIds.map(id => moveConversation(id, folder));
  return Promise.all(promises);
};

export const deleteForever = async (conversationId: string) => {
  // Validate conversationId
  if (!isValidId(conversationId)) {
    throw new Error('Invalid conversation ID format');
  }

  const res = await api.delete(`/inbox/conversations/${conversationId}/forever`);
  return res.data;
};

export const bulkDeleteForever = async (conversationIds: string[]) => {
  // Validate conversationIds array
  if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
    throw new Error('At least one conversation ID is required');
  }

  // Validate all IDs
  for (const id of conversationIds) {
    if (!isValidId(id)) {
      throw new Error('Invalid conversation ID format');
    }
  }

  const promises = conversationIds.map(id => deleteForever(id));
  return Promise.all(promises);
}; 