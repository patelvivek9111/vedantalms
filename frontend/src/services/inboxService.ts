import api from './api';

export const fetchConversations = async () => {
  const res = await api.get('/inbox/conversations');
  return res.data;
};

export const fetchMessages = async (conversationId: string) => {
  const res = await api.get(`/inbox/conversations/${conversationId}/messages`);
  return res.data;
};

export const sendMessage = async (conversationId: string, body: string) => {
  const res = await api.post(`/inbox/conversations/${conversationId}/messages`, { body });
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
  // Ensure conversationId is a string
  const id = typeof conversationId === 'string' ? conversationId : String(conversationId);
  console.log(`Moving conversation ${id} to folder: ${folder}`);
  console.log(`API URL will be: /inbox/conversations/${id}/move`);
  console.log(`Request body:`, { folder });
  
  try {
    const res = await api.post(`/inbox/conversations/${id}/move`, { folder });
    console.log(`Move response for ${id}:`, res.data);
    return res.data;
  } catch (error: any) {
    console.error(`Error moving conversation ${id} to ${folder}:`, error);
    console.error('Error response status:', error.response?.status);
    console.error('Error response data:', error.response?.data);
    console.error('Error response headers:', error.response?.headers);
    console.error('Request config:', error.config);
    throw error;
  }
};

// Bulk operations
export const bulkMoveConversations = async (conversationIds: string[], folder: string) => {
  console.log(`Bulk moving ${conversationIds.length} conversations to folder: ${folder}`);
  console.log('Conversation IDs:', conversationIds);
  try {
    const promises = conversationIds.map(id => moveConversation(id, folder));
    const results = await Promise.all(promises);
    console.log('Bulk move results:', results);
    return results;
  } catch (error: any) {
    console.error('Bulk move error:', error);
    throw error;
  }
};

export const deleteForever = async (conversationId: string) => {
  const res = await api.delete(`/inbox/conversations/${conversationId}/forever`);
  return res.data;
};

export const bulkDeleteForever = async (conversationIds: string[]) => {
  const promises = conversationIds.map(id => deleteForever(id));
  return Promise.all(promises);
}; 