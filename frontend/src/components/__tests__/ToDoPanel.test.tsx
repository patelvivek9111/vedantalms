import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ToDoPanel } from '../ToDoPanel';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

// Mock dependencies
vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../services/api', () => ({
  default: {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    get: vi.fn(),
  },
}));

vi.mock('../../utils/logger', () => ({
  default: {
    error: vi.fn(),
  },
}));

const mockedUseAuth = useAuth as any;
const mockedApi = api as any;

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

    render(
      <BrowserRouter>
        <ToDoPanel />
      </BrowserRouter>
    );

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

    render(
      <BrowserRouter>
        <ToDoPanel />
      </BrowserRouter>
    );

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

    render(
      <BrowserRouter>
        <ToDoPanel />
      </BrowserRouter>
    );

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

    render(
      <BrowserRouter>
        <ToDoPanel />
      </BrowserRouter>
    );

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

    render(
      <BrowserRouter>
        <ToDoPanel />
      </BrowserRouter>
    );

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

    render(
      <BrowserRouter>
        <ToDoPanel />
      </BrowserRouter>
    );

    // Should show loading
    expect(mockedApi.get).toHaveBeenCalled();
  });

  it('should handle errors', async () => {
    mockedUseAuth.mockReturnValue({
      user: { _id: 'user1', role: 'teacher' },
    });
    mockedApi.get.mockRejectedValueOnce(new Error('Fetch failed')).mockResolvedValueOnce({
      data: [],
    });

    render(
      <BrowserRouter>
        <ToDoPanel />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });
});

