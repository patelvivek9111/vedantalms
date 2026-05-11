import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import api from '../../services/api';
import * as inboxService from '../../services/inboxService';
import * as announcementService from '../../services/announcementService';

vi.mock('axios');
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  },
  getImageUrl: vi.fn((v: string) => v)
}));

const mockedAxios = axios as any;
const mockedApi = api as any;

describe('Service coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Storage.prototype.getItem = vi.fn(() => 'token');
  });

  it('inboxService fetches and posts conversations/messages', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [{ id: 1 }] });
    mockedApi.post.mockResolvedValueOnce({ data: { ok: true } });

    const list = await inboxService.fetchConversations();
    const sent = await inboxService.sendMessage('conv-1', 'hello');

    expect(list).toEqual([{ id: 1 }]);
    expect(sent).toEqual({ ok: true });
    expect(mockedApi.get).toHaveBeenCalledWith('/inbox/conversations', { params: undefined });
    expect(mockedApi.post).toHaveBeenCalledWith('/inbox/conversations/conv-1/messages', { body: 'hello' });
  });

  it('announcementService calls announcement endpoints with token', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { data: [{ _id: 'a1' }] } });
    mockedAxios.post.mockResolvedValueOnce({ data: { ok: true } });

    const items = await announcementService.getAnnouncements('course-1');
    const commentResult = await announcementService.postAnnouncementComment('ann-1', 'Nice');

    expect(items).toEqual([{ _id: 'a1' }]);
    expect(commentResult).toEqual({ ok: true });
    expect(mockedAxios.get).toHaveBeenCalled();
    expect(mockedAxios.post).toHaveBeenCalled();
  });

  it('api service helper returns external URL unchanged', async () => {
    const { getImageUrl } = await import('../../services/api');
    expect(getImageUrl('https://cdn.example.com/image.png')).toBe('https://cdn.example.com/image.png');
  });
});

