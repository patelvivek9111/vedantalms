import api from './api';

export interface AnnouncementComment {
  _id: string;
  text: string;
  author: {
    _id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
  createdAt: string;
  replies?: AnnouncementComment[];
  likes?: Array<{
    user: string;
    _id: string;
  }>;
}

export interface Announcement {
  _id: string;
  title: string;
  body: string;
  course: string;
  author: {
    _id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
  createdAt: string;
  postTo?: string;
  options?: {
    allowComments?: boolean;
    requirePostBeforeSeeingReplies?: boolean;
    allowLiking?: boolean;
    delayPosting?: boolean;
    enablePodcastFeed?: boolean;
  };
  delayedUntil?: string;
}

export const getAnnouncements = async (courseId: string): Promise<Announcement[]> => {
  const response = await api.get(`/courses/${courseId}/announcements`);
  return response.data.data || response.data || [];
};

export const getGroupSetAnnouncements = async (courseId: string, groupSetId: string): Promise<Announcement[]> => {
  const response = await api.get(`/announcements/groupset/${groupSetId}`);
  return response.data.data || response.data || [];
};

export const createAnnouncement = async (courseId: string, formData: any): Promise<Announcement> => {
  const response = await api.post(`/announcements`, { ...formData, course: courseId });
  return response.data.data || response.data;
};

export const updateAnnouncement = async (announcementId: string, formData: any): Promise<Announcement> => {
  const response = await api.put(`/announcements/${announcementId}`, formData);
  return response.data.data || response.data;
};

export const deleteAnnouncement = async (announcementId: string): Promise<void> => {
  await api.delete(`/announcements/${announcementId}`);
};

export const getAnnouncementComments = async (announcementId: string): Promise<AnnouncementComment[]> => {
  const response = await api.get(`/announcements/${announcementId}/comments`);
  return response.data || [];
};

export const postAnnouncementComment = async (announcementId: string, text: string): Promise<AnnouncementComment> => {
  const response = await api.post(`/announcements/${announcementId}/comments`, { text });
  return response.data;
};

export const postAnnouncementReply = async (
  announcementId: string,
  commentId: string,
  text: string
): Promise<AnnouncementComment> => {
  const response = await api.post(`/announcements/${announcementId}/comments/${commentId}/reply`, { text });
  return response.data;
};

export const likeAnnouncementComment = async (
  announcementId: string,
  commentId: string
): Promise<AnnouncementComment> => {
  const response = await api.post(`/announcements/${announcementId}/comments/${commentId}/like`);
  return response.data;
};

export const unlikeAnnouncementComment = async (
  announcementId: string,
  commentId: string
): Promise<AnnouncementComment> => {
  const response = await api.post(`/announcements/${announcementId}/comments/${commentId}/unlike`);
  return response.data;
};

