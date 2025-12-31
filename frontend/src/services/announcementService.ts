import axios from 'axios';
import { API_URL } from '../config';

export const getAnnouncements = async (courseId: string) => {
  const token = localStorage.getItem('token');
  const res = await axios.get(`${API_URL}/api/courses/${courseId}/announcements`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data.data;
};

export const createAnnouncement = async (courseId: string, data: FormData) => {
  const token = localStorage.getItem('token');
  const res = await axios.post(`${API_URL}/api/courses/${courseId}/announcements`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data.data;
};

export const getAnnouncementComments = async (announcementId: string) => {
  const token = localStorage.getItem('token');
  const res = await axios.get(`${API_URL}/api/announcements/${announcementId}/comments`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data.data;
};

export const postAnnouncementComment = async (announcementId: string, text: string) => {
  const token = localStorage.getItem('token');
  const res = await axios.post(`${API_URL}/api/announcements/${announcementId}/comments`, { text }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const postAnnouncementReply = async (announcementId: string, commentId: string, text: string) => {
  const token = localStorage.getItem('token');
  const res = await axios.post(`${API_URL}/api/announcements/${announcementId}/comments/${commentId}/reply`, { text }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const likeAnnouncementComment = async (announcementId: string, commentId: string) => {
  const token = localStorage.getItem('token');
  const res = await axios.post(`${API_URL}/api/announcements/${announcementId}/comments/${commentId}/like`, {}, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const unlikeAnnouncementComment = async (announcementId: string, commentId: string) => {
  const token = localStorage.getItem('token');
  const res = await axios.post(`${API_URL}/api/announcements/${announcementId}/comments/${commentId}/unlike`, {}, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

export const getGroupSetAnnouncements = async (courseId: string, groupsetId: string) => {
  const token = localStorage.getItem('token');
  const res = await axios.get(`${API_URL}/api/courses/${courseId}/announcements?groupset=${groupsetId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data.data;
};

export const updateAnnouncement = async (announcementId: string, data: FormData) => {
  const token = localStorage.getItem('token');
  const res = await axios.put(`${API_URL}/api/announcements/${announcementId}`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data.data;
};

export const deleteAnnouncement = async (announcementId: string) => {
  const token = localStorage.getItem('token');
  const res = await axios.delete(`${API_URL}/api/announcements/${announcementId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
}; 