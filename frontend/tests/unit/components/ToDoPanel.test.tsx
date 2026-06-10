import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToDoPanel } from '@/components/common/ToDoPanel';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  default: {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    get: vi.fn(),
  },
  getUserPreferences: vi.fn().mockResolvedValue({ data: { preferences: {} } }),
}));

vi.mock('@/utils/logger', () => ({
  default: {
    error: vi.fn(),
  },
}));

const mockedUseAuth = useAuth as any;
const mockedApi = api as any;

function renderToDoPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToDoPanel />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('ToDoPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render todo panel for teachers', async () => {
    mockedUseAuth.mockReturnValue({
      user: { _id: 'user1', role: 'teacher' },
    });
    mockedApi.get.mockResolvedValue({
      data: [],
    });

    renderToDoPanel();

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalled();
    });
  });

  it('should fetch ungraded assignments for teachers', async () => {
    mockedUseAuth.mockReturnValue({
      user: { _id: 'user1', role: 'teacher' },
    });
    mockedApi.get.mockResolvedValueOnce({
      data: [
        {
          id: 'assign1',
          title: 'Assignment 1',
          ungradedCount: 5,
          course: {
            title: 'Test Course',
          },
        },
      ],
    }).mockResolvedValueOnce({
      data: [],
    });

    renderToDoPanel();

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/assignments/todo/ungraded');
    });
  });

  it('should fetch due items for students', async () => {
    mockedUseAuth.mockReturnValue({
      user: { _id: 'user1', role: 'student' },
    });
    mockedApi.get.mockResolvedValueOnce({
      data: [],
    }).mockResolvedValueOnce({
      data: [],
    });

    renderToDoPanel();

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/assignments/todo/due-all');
    });
  });

  it('should fetch personal todos', async () => {
    mockedUseAuth.mockReturnValue({
      user: { _id: 'user1', role: 'student' },
    });
    mockedApi.get.mockResolvedValueOnce({
      data: [],
    }).mockResolvedValueOnce({
      data: [],
    });

    renderToDoPanel();

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/todos');
    });
  });

  it('should display ungraded assignments', async () => {
    mockedUseAuth.mockReturnValue({
      user: { _id: 'user1', role: 'teacher' },
    });
    mockedApi.get.mockResolvedValueOnce({
      data: [
        {
          id: 'assign1',
          _id: 'assign1',
          title: 'Assignment 1',
          ungradedCount: 5,
          course: {
            _id: 'course1',
            title: 'Test Course',
          },
        },
      ],
    }).mockResolvedValueOnce({
      data: [],
    });

    renderToDoPanel();

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/assignments/todo/ungraded');
    }, { timeout: 3000 });

    await waitFor(() => {
      expect(screen.getByText('Assignment 1')).toBeInTheDocument();
      expect(screen.getByText('Test Course')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should show loading state', () => {
    mockedUseAuth.mockReturnValue({
      user: { _id: 'user1', role: 'teacher' },
    });
    mockedApi.get.mockImplementation(() => new Promise(() => {}));

    renderToDoPanel();

    expect(mockedApi.get).toHaveBeenCalled();
  });

  it('should handle errors', async () => {
    mockedUseAuth.mockReturnValue({
      user: { _id: 'user1', role: 'teacher' },
    });
    mockedApi.get.mockRejectedValueOnce(new Error('Fetch failed')).mockResolvedValueOnce({
      data: [],
    });

    renderToDoPanel();

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalled();
    }, { timeout: 3000 });
  });
});
