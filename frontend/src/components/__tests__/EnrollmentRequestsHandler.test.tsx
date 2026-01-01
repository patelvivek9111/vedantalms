import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EnrollmentRequestsHandler from '../course/EnrollmentRequestsHandler';
import api from '../../services/api';

// Mock dependencies
vi.mock('../../services/api', () => ({
  default: {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../../utils/logger', () => ({
  default: {
    error: vi.fn(),
  },
}));

// Mock window.alert
window.alert = vi.fn();

const mockedApi = api as any;

describe('EnrollmentRequestsHandler', () => {
  const mockEnrollmentRequests = [
    {
      _id: 'todo1',
      type: 'enrollment_request',
      courseId: 'course1',
      action: 'pending',
      studentId: 'student1',
      title: 'Enrollment Request from John Doe',
      createdAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state', () => {
    mockedApi.get.mockImplementation(() => new Promise(() => {}));

    render(<EnrollmentRequestsHandler courseId="course1" />);

    expect(screen.getByText('Loading enrollment requests...')).toBeInTheDocument();
  });

  it('should fetch and display enrollment requests', async () => {
    mockedApi.get.mockResolvedValue({
      data: mockEnrollmentRequests,
    });

    render(<EnrollmentRequestsHandler courseId="course1" />);

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/todos');
    });

    await waitFor(() => {
      expect(screen.getByText('Enrollment Request from John Doe')).toBeInTheDocument();
    });
  });

  it('should show empty state when no requests', async () => {
    mockedApi.get.mockResolvedValue({
      data: [],
    });

    render(<EnrollmentRequestsHandler courseId="course1" />);

    await waitFor(() => {
      expect(screen.getByText('No pending enrollment requests')).toBeInTheDocument();
    });
  });

  it('should approve enrollment request', async () => {
    mockedApi.get.mockResolvedValue({
      data: mockEnrollmentRequests,
    });
    mockedApi.post.mockResolvedValue({ data: { success: true } });

    render(<EnrollmentRequestsHandler courseId="course1" />);

    await waitFor(() => {
      expect(screen.getByText('Enrollment Request from John Doe')).toBeInTheDocument();
    });

    const approveButton = screen.getByText('Approve');
    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/courses/course1/enrollment/student1/approve'
      );
    });
  });

  it('should deny enrollment request', async () => {
    mockedApi.get.mockResolvedValue({
      data: mockEnrollmentRequests,
    });
    mockedApi.post.mockResolvedValue({ data: { success: true } });

    render(<EnrollmentRequestsHandler courseId="course1" />);

    await waitFor(() => {
      expect(screen.getByText('Enrollment Request from John Doe')).toBeInTheDocument();
    });

    const denyButton = screen.getByText('Deny');
    fireEvent.click(denyButton);

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/courses/course1/enrollment/student1/deny'
      );
    });
  });

  it('should handle approval errors', async () => {
    mockedApi.get.mockResolvedValue({
      data: mockEnrollmentRequests,
    });
    mockedApi.post.mockRejectedValue(new Error('Approval failed'));

    render(<EnrollmentRequestsHandler courseId="course1" />);

    await waitFor(() => {
      expect(screen.getByText('Enrollment Request from John Doe')).toBeInTheDocument();
    });

    const approveButton = screen.getByText('Approve');
    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Failed to approve enrollment');
    });
  });

  it('should filter requests by courseId', async () => {
    const allTodos = [
      ...mockEnrollmentRequests,
      {
        _id: 'todo2',
        type: 'enrollment_request',
        courseId: 'course2',
        action: 'pending',
        studentId: 'student2',
        title: 'Other Course Request',
        createdAt: new Date().toISOString(),
      },
    ];

    mockedApi.get.mockResolvedValue({
      data: allTodos,
    });

    render(<EnrollmentRequestsHandler courseId="course1" />);

    await waitFor(() => {
      expect(screen.getByText('Enrollment Request from John Doe')).toBeInTheDocument();
      expect(screen.queryByText('Other Course Request')).not.toBeInTheDocument();
    });
  });

  it('should only show pending requests', async () => {
    const todosWithApproved = [
      ...mockEnrollmentRequests,
      {
        _id: 'todo2',
        type: 'enrollment_request',
        courseId: 'course1',
        action: 'approved',
        studentId: 'student2',
        title: 'Approved Request',
        createdAt: new Date().toISOString(),
      },
    ];

    mockedApi.get.mockResolvedValue({
      data: todosWithApproved,
    });

    render(<EnrollmentRequestsHandler courseId="course1" />);

    await waitFor(() => {
      expect(screen.getByText('Enrollment Request from John Doe')).toBeInTheDocument();
      expect(screen.queryByText('Approved Request')).not.toBeInTheDocument();
    });
  });
});







