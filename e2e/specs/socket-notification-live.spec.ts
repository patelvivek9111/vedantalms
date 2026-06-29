import { test, expect } from '@playwright/test';
import { io } from 'socket.io-client';
import { apiURL, student, getAuthToken } from '../helpers/live-auth';

test.describe('§5.6 notification socket — live smoke', () => {
  test('socket.io /notifications namespace accepts authenticated connection', async ({ request }) => {
    const token = await getAuthToken(request, student);
    const connected = await new Promise<boolean>((resolve) => {
      const socket = io(`${apiURL}/notifications`, {
        auth: { token },
        transports: ['websocket'],
        timeout: 8000,
      });
      socket.on('connect', () => {
        socket.disconnect();
        resolve(true);
      });
      socket.on('connect_error', () => {
        socket.disconnect();
        resolve(false);
      });
      setTimeout(() => {
        socket.disconnect();
        resolve(false);
      }, 10_000);
    });

    expect(connected, 'notification socket should connect with valid JWT').toBe(true);
  });
});
