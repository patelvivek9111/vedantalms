import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ThreadView from '@/components/threads/ThreadView';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';

vi.mock('react-router-dom', () => ({
  useParams: () => ({ courseId: 'course1', threadId: 'thread1' }),
  useNavigate: () => vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
  getImageUrl: (value: string) => value,
}));

vi.mock('@/config', () => ({ API_URL: 'http://localhost:5000' }));

vi.mock('@/components/common/RichTextEditor', () => ({
  default: ({ content, onChange }: any) => (
    <textarea aria-label="rich text editor" value={content} onChange={(event) => onChange(event.target.value)} />
  ),
}));

vi.mock('@/components/common/PullToRefresh', () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/common/ConfirmationModal', () => ({
  default: () => null,
}));

vi.mock('@/components/discussions/DiscussionReplyComposer', () => ({
  default: () => <div data-testid="reply-composer" />,
}));

vi.mock('@/components/files/FileAttachmentChips', () => ({
  default: () => null,
}));

vi.mock('@/components/files/FileAttachmentPanel', () => ({
  default: () => null,
  normalizeLegacyFiles: () => [],
}));

const mockedUseAuth = useAuth as any;
const mockedApi = api as any;

const threadPayload = {
  _id: 'thread1',
  title: 'Certified Discussion',
  content: '<p>Welcome</p>',
  course: 'course1',
  author: { _id: 'teacher1', firstName: 'Tina', lastName: 'Teacher', role: 'teacher' },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastActivity: new Date().toISOString(),
  replies: [{
    _id: 'reply1',
    content: '<p>Hidden text</p>',
    author: { _id: 'student1', firstName: 'Sam', lastName: 'Student', role: 'student' },
    parentReply: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    moderationState: 'hidden',
    isHidden: true,
    childCount: 2,
    likes: [],
  }],
  repliesPagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
  isPinned: false,
  isGraded: true,
  totalPoints: 10,
  group: 'Discussions',
  dueDate: null,
  locked: true,
  published: true,
  gradeHidden: true,
  discussionReleaseMode: 'hidden',
  studentGrades: [],
  settings: { requirePostBeforeSee: false, allowLikes: true, allowComments: true },
  unreadCount: 4,
  hasPosted: false,
  hasInstructorReply: true,
  currentUserParticipation: { unreadCount: 4, hasPosted: false, hasInstructorReply: true },
};

describe('ThreadView discussion certification behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'token');
    mockedUseAuth.mockReturnValue({ user: { _id: 'student2', role: 'student' } });
    mockedApi.get.mockImplementation((url: string) => {
      if (url.startsWith('/threads/thread1')) {
        return Promise.resolve({ data: { success: true, data: threadPayload } });
      }
      if (url.startsWith('/courses/course1')) {
        return Promise.resolve({ data: { success: true, data: { students: [], operationalStatus: 'active' } } });
      }
      if (url.startsWith('/modules/course1')) {
        return Promise.resolve({ data: { success: true, data: [] } });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    });
    mockedApi.post.mockResolvedValue({
      data: {
        success: true,
        data: { ...threadPayload, unreadCount: 0, currentUserParticipation: { unreadCount: 0 } },
      },
    });
  });

  it('renders lock/status badges and hidden reply semantics without exposing hidden content', async () => {
    render(<ThreadView />);

    expect(await screen.findByText('Certified Discussion')).toBeInTheDocument();
    expect(screen.getAllByText('Locked').length).toBeGreaterThan(0);
    expect(screen.getByText('Grade hidden')).toBeInTheDocument();
    expect(screen.getByText('Instructor replied')).toBeInTheDocument();
    expect(screen.getByText('This reply is hidden by a moderator.')).toBeInTheDocument();
    expect(screen.queryByText('Hidden text')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith('/threads/thread1/mark-read', {}, expect.any(Object));
    });
  });
});
