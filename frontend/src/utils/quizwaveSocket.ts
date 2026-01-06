import { io, Socket } from 'socket.io-client';
import { API_URL } from '../config';

let socket: Socket | null = null;

export const getQuizWaveSocket = (token: string): Socket => {
  // Extract base URL from API_URL
  const baseURL = API_URL.replace('/api', '');

  // If socket exists and is connected, return it
  if (socket && socket.connected) {
    return socket;
  }

  // If socket exists but not connected, disconnect and create new one
  if (socket) {
    socket.disconnect();
    socket.removeAllListeners();
    socket = null;
  }

  // Create new socket connection
  socket = io(baseURL, {
    auth: {
      token: token
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5
  });

  socket.on('connect', () => {
    console.log('✅ QuizWave Socket Connected');
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ QuizWave Socket Disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('❌ QuizWave Socket Connection Error:', error);
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log('✅ QuizWave Socket Reconnected after', attemptNumber, 'attempts');
  });

  socket.on('reconnect_error', (error) => {
    console.error('❌ QuizWave Socket Reconnection Error:', error);
  });

  socket.on('reconnect_failed', () => {
    console.error('❌ QuizWave Socket Reconnection Failed');
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

