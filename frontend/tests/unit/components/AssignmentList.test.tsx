import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AssignmentList from '@/components/assignments/AssignmentList';
import api from '@/services/api';

// Mock dependencies
vi.mock('@/services/api', () => ({
  default: {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    get: vi.fn(),
    delete: vi.fn(),
  },
}));
vi.mock('@/config', () => ({
  API_URL: 'http://localhost:5000',
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockedApi = api as any;

/** AssignmentList accepts discussions and extra fields beyond the exported Assignment type. */
type TestAssignmentInput = {
  _id: string;
  title: string;
  description?: string;
  dueDate?: string;
  published?: boolean;
  type?: string;
  group?: string;
  totalPoints?: number;
  attachments?: { _id: string; filename: string; path: string }[];
  createdBy?: { _id: string; firstName: string; lastName: string };
  studentGrades?: unknown[];
  hasSubmission?: boolean;
};

const asAssignmentListProps = (assignments: TestAssignmentInput[]) =>
  assignments as React.ComponentProps<typeof AssignmentList>['assignments'];

describe('AssignmentList', () => {
  const createdBy = { _id: 'teacher1', firstName: 'Test', lastName: 'Teacher' };

  const mockAssignments: TestAssignmentInput[] = [
    {
      _id: 'assign1',
      title: 'Assignment 1',
      description: 'Test assignment',
      dueDate: new Date('2026-06-10T12:00:00.000Z').toISOString(),
      published: true,
      type: 'assignment',
      totalPoints: 100,
      attachments: [] as { _id: string; filename: string; path: string }[],
      createdBy,
    },
    {
      _id: 'assign2',
      title: 'Assignment 2',
      description: 'Another assignment',
      dueDate: new Date('2026-06-20T12:00:00.000Z').toISOString(),
      published: true,
      type: 'assignment',
      totalPoints: 50,
      attachments: [] as { _id: string; filename: string; path: string }[],
      createdBy,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(new Date('2026-05-27T12:00:00.000Z'));
    localStorage.setItem('token', 'test-token');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render assignments from props', () => {
    render(
      <BrowserRouter>
        <AssignmentList assignments={asAssignmentListProps(mockAssignments)} userRole="student" />
      </BrowserRouter>
    );

    const assignment1Elements = screen.getAllByText('Assignment 1');
    const assignment2Elements = screen.getAllByText('Assignment 2');
    expect(assignment1Elements.length).toBeGreaterThan(0);
    expect(assignment2Elements.length).toBeGreaterThan(0);
  });

  it('should fetch assignments when moduleId is provided', async () => {
    mockedApi.get.mockResolvedValue({
      data: mockAssignments,
    });

    render(
      <BrowserRouter>
        <AssignmentList moduleId="module1" userRole="student" />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalled();
    });
  });

  it('should filter by search query', () => {
    render(
      <BrowserRouter>
        <AssignmentList
          assignments={asAssignmentListProps([
            mockAssignments[0],
            { ...mockAssignments[1], published: false },
          ])}
          userRole="teacher"
        />
      </BrowserRouter>
    );

    fireEvent.change(screen.getByPlaceholderText(/search for assignment/i), {
      target: { value: 'Assignment 1' },
    });

    expect(screen.getByText('Assignment 1')).toBeInTheDocument();
    expect(screen.queryByText('Assignment 2')).not.toBeInTheDocument();
  });

  it('should show all assignments for teachers', () => {
    render(
      <BrowserRouter>
        <AssignmentList assignments={asAssignmentListProps(mockAssignments)} userRole="teacher" />
      </BrowserRouter>
    );

    const assignment1Elements = screen.getAllByText('Assignment 1');
    const assignment2Elements = screen.getAllByText('Assignment 2');
    expect(assignment1Elements.length).toBeGreaterThan(0);
    expect(assignment2Elements.length).toBeGreaterThan(0);
  });

  it('should navigate to assignment on row click', () => {
    render(
      <BrowserRouter>
        <AssignmentList assignments={asAssignmentListProps(mockAssignments)} userRole="student" />
      </BrowserRouter>
    );

    const titleEl = screen.getByText('Assignment 1');
    const rowButton = titleEl.closest('button');
    expect(rowButton).toBeTruthy();
    fireEvent.click(rowButton as HTMLElement);
    expect(mockNavigate).toHaveBeenCalledWith(`/assignments/${mockAssignments[0]._id}/view`);
  });

  it('should handle bulk actions for teachers', () => {
    render(
      <BrowserRouter>
        <AssignmentList assignments={asAssignmentListProps(mockAssignments)} userRole="teacher" />
      </BrowserRouter>
    );

    // Select assignments
    const checkboxes = screen.getAllByRole('checkbox');
    if (checkboxes.length > 0) {
      fireEvent.click(checkboxes[0]);
    }
  });

  it('should show empty state when no assignments', () => {
    render(
      <BrowserRouter>
        <AssignmentList assignments={[]} userRole="student" />
      </BrowserRouter>
    );

    const emptyMessages = screen.getAllByText(/no assignments/i);
    expect(emptyMessages.length).toBeGreaterThan(0);
  });

  it('should display submission status for students', () => {
    const assignmentsWithSubmissions: TestAssignmentInput[] = [
      {
        ...mockAssignments[0],
        hasSubmission: true,
      },
    ];

    render(
      <BrowserRouter>
        <AssignmentList
          assignments={asAssignmentListProps(assignmentsWithSubmissions)}
          userRole="student"
          studentSubmissions={[{ _id: 'sub1', assignment: 'assign1' }]}
        />
      </BrowserRouter>
    );

    const assignmentElements = screen.getAllByText('Assignment 1');
    expect(assignmentElements.length).toBeGreaterThan(0);
  });

  it('shows class average over enrolled students, not only submitters', async () => {
    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('/courses/course1/students')) {
        return Promise.resolve({
          data: Array.from({ length: 10 }, (_, index) => ({ _id: `student-${index}` })),
        });
      }
      if (url.includes('/submissions/assignment/assign1')) {
        return Promise.resolve({
          data: {
            data: [
              { student: { _id: 'student-0' }, grade: 80 },
              { student: { _id: 'student-1' }, grade: 80 },
            ],
            hasMore: false,
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    render(
      <BrowserRouter>
        <AssignmentList
          assignments={asAssignmentListProps([mockAssignments[0]])}
          userRole="teacher"
          courseId="course1"
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByTitle(/Class average across enrolled students/i)).toHaveTextContent('16%');
    });
  });

  it('fetches discussion grades when computing class average', async () => {
    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('/courses/course1/students')) {
        return Promise.resolve({
          data: [{ _id: 'student-1' }, { _id: 'student-2' }],
        });
      }
      if (url.includes('/threads/disc1')) {
        return Promise.resolve({
          data: {
            data: {
              _id: 'disc1',
              totalPoints: 10,
              studentGrades: [{ student: { _id: 'student-1' }, grade: 8 }],
            },
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    render(
      <BrowserRouter>
        <AssignmentList
          assignments={asAssignmentListProps([
            {
              _id: 'disc1',
              title: 'Discussion 1',
              dueDate: new Date().toISOString(),
              published: true,
              type: 'discussion',
              group: 'Discussions',
              totalPoints: 10,
              attachments: [],
              createdBy,
              studentGrades: [],
            },
          ])}
          userRole="teacher"
          courseId="course1"
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/threads/disc1', {
        params: { includeGrades: 'true', limit: 0 },
      });
      expect(screen.getByTitle(/Class average across enrolled students/i)).toHaveTextContent('40%');
    });
  });

  it('groups student assignments into collapsible due-date sections', () => {
    const now = new Date('2026-05-27T12:00:00.000Z');
    vi.setSystemTime(now);

    const pastDue = new Date('2026-05-20T12:00:00.000Z').toISOString();
    const futureDue = new Date('2026-06-10T12:00:00.000Z').toISOString();

    render(
      <BrowserRouter>
        <AssignmentList
          assignments={asAssignmentListProps([
            {
              _id: 'overdue1',
              title: 'Late Work',
              dueDate: pastDue,
              published: true,
              type: 'assignment',
              totalPoints: 10,
              attachments: [],
              createdBy,
            },
            {
              _id: 'upcoming1',
              title: 'Future Work',
              dueDate: futureDue,
              published: true,
              type: 'assignment',
              totalPoints: 10,
              attachments: [],
              createdBy,
            },
            {
              _id: 'undated1',
              title: 'No Date Work',
              published: true,
              type: 'assignment',
              totalPoints: 10,
              attachments: [],
              createdBy,
            },
            {
              _id: 'past1',
              title: 'Turned In',
              dueDate: pastDue,
              published: true,
              type: 'assignment',
              totalPoints: 10,
              attachments: [],
              createdBy,
            },
          ])}
          userRole="student"
          studentId="student-1"
          studentSubmissions={[{ _id: 'sub1', assignment: 'past1' }]}
          submissionMap={{ 'student-1_past1': 'sub1' }}
        />
      </BrowserRouter>
    );

    expect(screen.getByRole('button', { name: /Overdue Assignments/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upcoming Assignments/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Undated Assignments/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Past Assignments/i })).toBeInTheDocument();
    expect(screen.getByText('Late Work')).toBeInTheDocument();
    expect(screen.getByText('Future Work')).toBeInTheDocument();
    expect(screen.getByText('No Date Work')).toBeInTheDocument();
    expect(screen.getByText('Turned In')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Empty/i })).not.toBeInTheDocument();
  });

  it('hides empty student sections', () => {
    const now = new Date('2026-05-27T12:00:00.000Z');
    vi.setSystemTime(now);

    render(
      <BrowserRouter>
        <AssignmentList
          assignments={asAssignmentListProps([
            {
              _id: 'upcoming1',
              title: 'Future Work',
              dueDate: new Date('2026-06-10T12:00:00.000Z').toISOString(),
              published: true,
              type: 'assignment',
              totalPoints: 10,
              attachments: [],
              createdBy,
            },
          ])}
          userRole="student"
          studentId="student-1"
        />
      </BrowserRouter>
    );

    expect(screen.getByRole('button', { name: /Upcoming Assignments/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Overdue Assignments/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Past Assignments/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Undated Assignments/i })).not.toBeInTheDocument();
  });
});

