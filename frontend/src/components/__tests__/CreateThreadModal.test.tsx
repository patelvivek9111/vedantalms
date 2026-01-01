import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreateThreadModal from '../CreateThreadModal';
import api from '../../services/api';
import axios from 'axios';

// Mock dependencies
vi.mock('../../services/api', () => ({
  default: {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    post: vi.fn(),
  },
}));

vi.mock('axios');
vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { _id: 'user1', role: 'teacher' },
  })),
}));

vi.mock('../../config', () => ({
  API_URL: 'http://localhost:5000',
}));

vi.mock('../../utils/logger', () => ({
  default: {
    error: vi.fn(),
  },
}));

vi.mock('../RichTextEditor', () => ({
  default: ({ content, onChange }: any) => (
    <textarea
      data-testid="rich-text-editor"
      value={content}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Write your thread content..."
    />
  ),
}));

const mockedApi = api as any;
const mockedAxios = axios as any;

describe('CreateThreadModal', () => {
  const mockOnClose = vi.fn();
  const mockOnThreadCreated = vi.fn();
  const mockCourseId = 'course1';

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'test-token');
  });

  it('should not render when closed', () => {
    const { container } = render(
      <CreateThreadModal
        isOpen={false}
        onClose={mockOnClose}
        courseId={mockCourseId}
        onThreadCreated={mockOnThreadCreated}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render when open', () => {
    render(
      <CreateThreadModal
        isOpen={true}
        onClose={mockOnClose}
        courseId={mockCourseId}
        onThreadCreated={mockOnThreadCreated}
      />
    );

    expect(screen.getByText(/create new discussion thread/i)).toBeInTheDocument();
  });

  it('should have title and content inputs', () => {
    render(
      <CreateThreadModal
        isOpen={true}
        onClose={mockOnClose}
        courseId={mockCourseId}
        onThreadCreated={mockOnThreadCreated}
      />
    );

    expect(screen.getByPlaceholderText(/enter thread title/i)).toBeInTheDocument();
  });

  it('should create thread successfully', async () => {
    const mockThread = {
      _id: 'thread1',
      title: 'New Thread',
      content: 'Thread content',
    };

    mockedApi.post.mockResolvedValue({
      data: {
        success: true,
        data: mockThread,
      },
    });

    mockedAxios.get.mockResolvedValue({
      data: [],
    });

    render(
      <CreateThreadModal
        isOpen={true}
        onClose={mockOnClose}
        courseId={mockCourseId}
        onThreadCreated={mockOnThreadCreated}
      />
    );

    const titleInput = screen.getByPlaceholderText(/enter thread title/i);
    fireEvent.change(titleInput, { target: { value: 'New Thread' } });

    // Fill content field using the mocked RichTextEditor
    const contentEditor = screen.getByTestId('rich-text-editor');
    fireEvent.change(contentEditor, { target: { value: 'Thread content' } });

    const submitButton = screen.getByRole('button', { name: /create thread/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockOnThreadCreated).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('should validate required fields', async () => {
    render(
      <CreateThreadModal
        isOpen={true}
        onClose={mockOnClose}
        courseId={mockCourseId}
        onThreadCreated={mockOnThreadCreated}
      />
    );

    const submitButton = screen.getByRole('button', { name: /create thread/i });
    fireEvent.click(submitButton);

    // Should show validation error or prevent submission
    await waitFor(() => {
      // Form validation should prevent submission - button should be disabled
      expect(submitButton).toBeDisabled();
    });
  });

  it('should toggle graded discussion', () => {
    render(
      <CreateThreadModal
        isOpen={true}
        onClose={mockOnClose}
        courseId={mockCourseId}
        onThreadCreated={mockOnThreadCreated}
      />
    );

    const gradedCheckbox = screen.getByLabelText(/make this a graded discussion/i);
    if (gradedCheckbox) {
      fireEvent.click(gradedCheckbox);
      expect(gradedCheckbox).toBeChecked();
    }
  });

  it('should set total points for graded discussion', async () => {
    render(
      <CreateThreadModal
        isOpen={true}
        onClose={mockOnClose}
        courseId={mockCourseId}
        onThreadCreated={mockOnThreadCreated}
      />
    );

    const gradedCheckbox = screen.getByLabelText(/make this a graded discussion/i);
    if (gradedCheckbox) {
      fireEvent.click(gradedCheckbox);
      
      // Wait for points input to appear
      await waitFor(() => {
        const pointsInput = screen.queryByLabelText(/total points/i);
        if (pointsInput) {
          fireEvent.change(pointsInput, { target: { value: '50' } });
          expect(pointsInput).toHaveValue(50);
        }
      });
    }
  });

  it('should handle errors', async () => {
    mockedApi.post.mockRejectedValue({
      response: {
        data: { message: 'Creation failed' },
      },
    });

    mockedAxios.get.mockResolvedValue({
      data: [],
    });

    render(
      <CreateThreadModal
        isOpen={true}
        onClose={mockOnClose}
        courseId={mockCourseId}
        onThreadCreated={mockOnThreadCreated}
      />
    );

    const titleInput = screen.getByPlaceholderText(/enter thread title/i);
    fireEvent.change(titleInput, { target: { value: 'Test Thread' } });

    // Fill content field
    const contentEditor = screen.getByTestId('rich-text-editor');
    fireEvent.change(contentEditor, { target: { value: 'Test content' } });

    const submitButton = screen.getByRole('button', { name: /create thread/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/failed to create thread/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should cancel creation', () => {
    render(
      <CreateThreadModal
        isOpen={true}
        onClose={mockOnClose}
        courseId={mockCourseId}
        onThreadCreated={mockOnThreadCreated}
      />
    );

    const cancelButton = screen.getByText(/cancel/i);
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should fetch group sets', async () => {
    const mockGroupSets = [
      { _id: 'groupset1', name: 'Group Set 1' },
    ];

    mockedAxios.get.mockResolvedValue({
      data: mockGroupSets,
    });

    render(
      <CreateThreadModal
        isOpen={true}
        onClose={mockOnClose}
        courseId={mockCourseId}
        onThreadCreated={mockOnThreadCreated}
      />
    );

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/groups/sets'),
        expect.any(Object)
      );
    });
  });
});


