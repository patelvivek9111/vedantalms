import { io, Socket } from 'socket.io-client';
import { API_URL } from '../config';

let socket: Socket | null = null;

export const getQuizWaveSocket = (token: string): Socket => {
  // Validate token
  if (!token || typeof token !== 'string' || token.trim() === '') {
    throw new Error('Invalid token: token is required for socket connection');
  }

  if (socket && socket.connected) {
    return socket;
  }

  // Validate API_URL
  if (!API_URL || typeof API_URL !== 'string') {
    throw new Error('Invalid API_URL configuration');
  }

  // Extract base URL from API_URL
  const baseURL = API_URL.replace('/api', '');

  // Validate baseURL
  if (!baseURL || baseURL.trim() === '') {
    throw new Error('Invalid base URL for socket connection');
  }

  socket = io(baseURL, {
    auth: {
      token: token.trim()
    },
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {
    console.log('✅ QuizWave Socket connected');
  });

  socket.on('disconnect', () => {
    console.log('❌ QuizWave Socket disconnected');
  });

  socket.on('connect_error', (error) => {
    console.error('QuizWave Socket connection error:', error);
  });

  return socket;
};

export const disconnectQuizWaveSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export { socket };

