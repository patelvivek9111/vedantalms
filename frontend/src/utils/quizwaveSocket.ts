import { io, Socket } from 'socket.io-client';
import { getBackendOrigin } from '../config';

let socket: Socket | null = null;

export const getQuizWaveSocket = (token: string): Socket => {
  const baseURL = getBackendOrigin();

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
    reconnectionAttempts: Infinity, // Keep trying to reconnect
    timeout: 20000,
    forceNew: false // Reuse connection if possible
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

