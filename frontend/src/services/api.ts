import axios from 'axios';
import { API_URL } from '../config';
import { getMemoryAuthToken } from '../utils/authToken';

const getBaseURL = () => {
  if (!API_URL || API_URL === '') {
    return '/api';
  }
  return `${API_URL}/api`;
};

const api = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const PUBLIC_APP_PATHS = new Set([
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/privacy',
  '/terms',
  '/',
]);

function isSessionBootstrapRequest(url: string | undefined): boolean {
  const rel = String(url || '').replace(/^\//, '');
  return (
    rel === 'auth/me' ||
    rel.startsWith('auth/me?') ||
    rel === 'auth/login' ||
    rel.startsWith('auth/login?') ||
    rel === 'auth/register' ||
    rel.startsWith('auth/register?') ||
    rel === 'auth/forgot-password' ||
    rel === 'auth/reset-password' ||
    rel === 'auth/logout'
  );
}

function isPublicAppPath(): boolean {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  return PUBLIC_APP_PATHS.has(path);
}

export const normalizeApiInstancePath = (url: string | undefined, baseURL: string | undefined): string | undefined => {
  if (!url || /^https?:\/\//i.test(url)) return url;
  const base = (baseURL || '').replace(/\/$/, '');
  if (base.endsWith('/api') && url.startsWith('/api/')) {
    return url.slice(4) || '/';
  }
  return url;
};

api.interceptors.request.use(
  (config) => {
    config.url = normalizeApiInstancePath(config.url, config.baseURL);
    const token = getMemoryAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const requestUrl = error.config?.url;
      if (!isSessionBootstrapRequest(requestUrl) && !isPublicAppPath()) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const updateUserProfile = async (profile: {
  firstName?: string;
  lastName?: string;
  bio?: string;
  profilePicture?: string;
}) => {
  return api.put('/users/me', profile);
};

export const uploadProfilePicture = async (file: File) => {
  const formData = new FormData();
  formData.append('profilePicture', file);
  return api.post('/users/me/profile-picture', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const getUserPreferences = async () => {
  return api.get('/users/me/preferences');
};

export const updateUserPreferences = async (prefs: {
  language?: string;
  timeZone?: string;
  theme?: string;
  courseColors?: { [courseId: string]: string };
  showOnlineStatus?: boolean;
}) => {
  return api.put('/users/me/preferences', prefs);
};

export const getLoginActivity = async (page = 1, limit = 20, days = 150) => {
  return api.get(`/auth/login-activity?page=${page}&limit=${limit}&days=${days}`);
};

export const updateOverviewConfig = async (courseId: string, config: {
  showLatestAnnouncements?: boolean;
  numberOfAnnouncements?: number;
}) => {
  const response = await api.put(`/courses/${courseId}/overview-config`, config);
  return response.data;
};

export const getImageUrl = (filename: string): string => {
  if (!filename) return '';
  if (filename.startsWith('http')) return filename;

  if (filename.startsWith('/api/files/')) {
    return !API_URL || API_URL === '' ? filename : `${API_URL}${filename}`;
  }

  if (!API_URL || API_URL === '') {
    if (filename.startsWith('/uploads/')) {
      return filename;
    }
    return `/uploads/${filename}`;
  }

  if (filename.startsWith('/uploads/')) {
    return `${API_URL}${filename}`;
  }
  return `${API_URL}/uploads/${filename}`;
};

export default api;
