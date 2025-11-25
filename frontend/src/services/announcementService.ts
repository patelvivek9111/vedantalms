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

export const getAnnouncements = async (courseId: string) => {
  // Validate courseId
  if (!isValidId(courseId)) {
    throw new Error('Invalid course ID format');
  }

  const res = await api.get(`/courses/${courseId}/announcements`);
  return res.data.data;
};

export const createAnnouncement = async (courseId: string, data: FormData) => {
  // Validate courseId
  if (!isValidId(courseId)) {
    throw new Error('Invalid course ID format');
  }

  // Validate FormData
  if (!data || !(data instanceof FormData)) {
    throw new Error('Invalid form data');
  }

  const res = await api.post(`/courses/${courseId}/announcements`, data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data.data;
};

export const getAnnouncementComments = async (announcementId: string) => {
  // Validate announcementId
  if (!isValidId(announcementId)) {
    throw new Error('Invalid announcement ID format');
  }

  const res = await api.get(`/announcements/${announcementId}/comments`);
  return res.data.data;
};

export const postAnnouncementComment = async (announcementId: string, text: string) => {
  // Validate announcementId
  if (!isValidId(announcementId)) {
    throw new Error('Invalid announcement ID format');
  }

  // Validate and sanitize text
  const sanitizedText = sanitizeText(text);
  if (!sanitizedText || sanitizedText.length === 0) {
    throw new Error('Comment text is required');
  }

  const res = await api.post(`/announcements/${announcementId}/comments`, { text: sanitizedText });
  return res.data;
};

export const postAnnouncementReply = async (announcementId: string, commentId: string, text: string) => {
  // Validate IDs
  if (!isValidId(announcementId)) {
    throw new Error('Invalid announcement ID format');
  }
  if (!isValidId(commentId)) {
    throw new Error('Invalid comment ID format');
  }

  // Validate and sanitize text
  const sanitizedText = sanitizeText(text);
  if (!sanitizedText || sanitizedText.length === 0) {
    throw new Error('Reply text is required');
  }

  const res = await api.post(`/announcements/${announcementId}/comments/${commentId}/reply`, { text: sanitizedText });
  return res.data;
};

export const likeAnnouncementComment = async (announcementId: string, commentId: string) => {
  // Validate IDs
  if (!isValidId(announcementId)) {
    throw new Error('Invalid announcement ID format');
  }
  if (!isValidId(commentId)) {
    throw new Error('Invalid comment ID format');
  }

  const res = await api.post(`/announcements/${announcementId}/comments/${commentId}/like`);
  return res.data;
};

export const unlikeAnnouncementComment = async (announcementId: string, commentId: string) => {
  // Validate IDs
  if (!isValidId(announcementId)) {
    throw new Error('Invalid announcement ID format');
  }
  if (!isValidId(commentId)) {
    throw new Error('Invalid comment ID format');
  }

  const res = await api.post(`/announcements/${announcementId}/comments/${commentId}/unlike`);
  return res.data;
};

export const getGroupSetAnnouncements = async (courseId: string, groupsetId: string) => {
  // Validate IDs
  if (!isValidId(courseId)) {
    throw new Error('Invalid course ID format');
  }
  if (!isValidId(groupsetId)) {
    throw new Error('Invalid groupset ID format');
  }

  const res = await api.get(`/courses/${courseId}/announcements?groupset=${groupsetId}`);
  return res.data.data;
};

export const updateAnnouncement = async (announcementId: string, data: FormData) => {
  // Validate announcementId
  if (!isValidId(announcementId)) {
    throw new Error('Invalid announcement ID format');
  }

  // Validate FormData
  if (!data || !(data instanceof FormData)) {
    throw new Error('Invalid form data');
  }

  const res = await api.put(`/announcements/${announcementId}`, data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data.data;
};

export const deleteAnnouncement = async (announcementId: string) => {
  // Validate announcementId
  if (!isValidId(announcementId)) {
    throw new Error('Invalid announcement ID format');
  }

  const res = await api.delete(`/announcements/${announcementId}`);
  return res.data;
}; 