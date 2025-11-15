import { io, Socket } from 'socket.io-client';
import { API_URL } from '../config';

let socket: Socket | null = null;

export const getQuizWaveSocket = (token: string): Socket => {
  if (socket && socket.connected) {
    return socket;
  }

  // Extract base URL from API_URL
  const baseURL = API_URL.replace('/api', '');

  socket = io(baseURL, {
    auth: {
      token: token
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

