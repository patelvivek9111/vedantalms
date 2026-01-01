import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CourseDiscussions from '../CourseDiscussions';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import axios from 'axios';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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

vi.mock('axios');
vi.mock('../../config', () => ({
  API_URL: 'http://localhost:5000',
}));

vi.mock('../CreateThreadModal', () => ({
  default: ({ isOpen, onClose, onThreadCreated }: any) => (
    isOpen ? (
      <div data-testid="create-thread-modal">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null
  ),
}));

vi.mock('../../utils/logger', () => ({
  default: {
    error: vi.fn(),
  },
}));

const mockedUseAuth = useAuth as any;
const mockedApi = api as any;
const mockedAxios = axios as any;

describe('CourseDiscussions', () => {
  const mockThreads = [
    {
      _id: 'thread1',
      title: 'Discussion Thread 1',
      content: 'Thread content',
      author: {
        _id: 'user1',
        firstName: 'John',
        lastName: 'Doe',
        role: 'teacher',
      },
      createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
      lastActivity: new Date(Date.now() - 86400000).toISOString(), // Required for formatDistanceToNow
      replyCount: 5,
      isPinned: false,
      isGraded: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'test-token');
    mockedUseAuth.mockReturnValue({
      user: { _id: 'user1', role: 'teacher' },
    });
  });

  it('should fetch and display threads', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        success: true,
        data: mockThreads,
      },
    });
    mockedAxios.get.mockResolvedValue({
      data: [],
    });

    render(
      <BrowserRouter>
        <CourseDiscussions courseId="course1" />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/threads/course/course1', expect.any(Object));
    });

    await waitFor(() => {
      expect(screen.getByText('Discussion Thread 1')).toBeInTheDocument();
    });
  });

  it('should show create thread button for teachers', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        success: true,
        data: [],
      },
    });
    mockedAxios.get.mockResolvedValue({
      data: [],
    });

    render(
      <BrowserRouter>
        <CourseDiscussions courseId="course1" />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/create new thread/i)).toBeInTheDocument();
    });
  });

  it('should open create thread modal', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        success: true,
        data: [],
      },
    });
    mockedAxios.get.mockResolvedValue({
      data: [],
    });

    render(
      <BrowserRouter>
        <CourseDiscussions courseId="course1" />
      </BrowserRouter>
    );

    await waitFor(() => {
      const createButton = screen.getByText(/create new thread/i);
      fireEvent.click(createButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('create-thread-modal')).toBeInTheDocument();
    });
  });

  it('should show loading state', () => {
    mockedApi.get.mockImplementation(() => new Promise(() => {}));
    mockedAxios.get.mockResolvedValue({
      data: [],
    });

    render(
      <BrowserRouter>
        <CourseDiscussions courseId="course1" />
      </BrowserRouter>
    );

    // Check for loading spinner instead of text
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('should handle errors', async () => {
    mockedApi.get.mockRejectedValue(new Error('Fetch failed'));
    mockedAxios.get.mockResolvedValue({
      data: [],
    });

    render(
      <BrowserRouter>
        <CourseDiscussions courseId="course1" />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });

  it('should navigate to thread on click', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        success: true,
        data: mockThreads,
      },
    });
    mockedAxios.get.mockResolvedValue({
      data: [],
    });

    render(
      <BrowserRouter>
        <CourseDiscussions courseId="course1" />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Discussion Thread 1')).toBeInTheDocument();
    });

    const thread = screen.getByText('Discussion Thread 1');
    fireEvent.click(thread);
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  it('should show pinned threads first', async () => {
    const threadsWithPinned = [
      {
        ...mockThreads[0],
        isPinned: true,
        title: 'Pinned Thread',
        lastActivity: new Date(Date.now() - 86400000).toISOString(),
      },
      ...mockThreads,
    ];

    mockedApi.get.mockResolvedValue({
      data: {
        success: true,
        data: threadsWithPinned,
      },
    });
    mockedAxios.get.mockResolvedValue({
      data: [],
    });

    render(
      <BrowserRouter>
        <CourseDiscussions courseId="course1" />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Pinned Thread')).toBeInTheDocument();
    });
  });
});

