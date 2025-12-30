import api from './api';

export interface Conversation {
  _id: string;
  participants: Array<{
    user: {
      _id: string;
      firstName: string;
      lastName: string;
      email: string;
      profilePicture?: string;
    };
    lastRead?: string;
  }>;
  lastMessage?: {
    body: string;
    createdAt: string;
    sender: {
      _id: string;
      firstName: string;
      lastName: string;
    };
  };
  unreadCount?: number;
  starred?: boolean;
  folder?: string;
  updatedAt: string;
}

export interface Message {
  _id: string;
  body: string;
  senderId: {
    _id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
    lastLogin?: string;
    showOnlineStatus?: boolean;
  };
  createdAt: string;
  readBy?: Array<{
    user: string;
    readAt: string;
  }>;
}

export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture?: string;
}

export const fetchConversations = async (): Promise<Conversation[]> => {
  const response = await api.get('/inbox/conversations');
  return response.data || [];
};

export const fetchMessages = async (conversationId: string): Promise<Message[]> => {
  const response = await api.get(`/inbox/conversations/${conversationId}/messages`);
  return response.data || [];
};

export const sendMessage = async (conversationId: string, text: string): Promise<Message> => {
  const response = await api.post(`/inbox/conversations/${conversationId}/messages`, { body: text });
  return response.data;
};

export const createConversation = async (participantIds: string[], initialMessage?: string): Promise<Conversation> => {
  const response = await api.post('/inbox/conversations', {
    participants: participantIds,
    initialMessage
  });
  return response.data;
};

export const searchUsers = async (query: string): Promise<User[]> => {
  const response = await api.get(`/users/search?q=${encodeURIComponent(query)}`);
  return response.data || [];
};

export const toggleStar = async (conversationId: string): Promise<Conversation> => {
  const response = await api.post(`/inbox/conversations/${conversationId}/star`);
  return response.data;
};

export const moveConversation = async (conversationId: string, folder: string): Promise<Conversation> => {
  const response = await api.post(`/inbox/conversations/${conversationId}/move`, { folder });
  return response.data;
};

export const bulkMoveConversations = async (conversationIds: string[], folder: string): Promise<void> => {
  await Promise.all(conversationIds.map(id => moveConversation(id, folder)));
};

export const bulkDeleteForever = async (conversationIds: string[]): Promise<void> => {
  await Promise.all(conversationIds.map(id => api.delete(`/inbox/conversations/${id}/forever`)));
};



