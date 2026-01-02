import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AssignmentCard } from '../CourseDetail';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('AssignmentCard', () => {
  const mockAssignment = {
    _id: 'assign1',
    title: 'Test Assignment',
    description: 'This is a test assignment',
    dueDate: new Date().toISOString(),
    totalPoints: 100,
    moduleTitle: 'Module 1',
    hasSubmission: false,
    questions: [
      { points: 50 },
      { points: 50 },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  it('should render assignment card', () => {
    render(
      <BrowserRouter>
        <AssignmentCard
          assignment={mockAssignment}
          isInstructor={false}
          isAdmin={false}
          navigate={mockNavigate}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Test Assignment')).toBeInTheDocument();
    expect(screen.getByText('This is a test assignment')).toBeInTheDocument();
  });

  it('should display due date', () => {
    render(
      <BrowserRouter>
        <AssignmentCard
          assignment={mockAssignment}
          isInstructor={false}
          isAdmin={false}
          navigate={mockNavigate}
        />
      </BrowserRouter>
    );

    expect(screen.getByText(/due:/i)).toBeInTheDocument();
  });

  it('should display total points', () => {
    render(
      <BrowserRouter>
        <AssignmentCard
          assignment={mockAssignment}
          isInstructor={false}
          isAdmin={false}
          navigate={mockNavigate}
        />
      </BrowserRouter>
    );

    expect(screen.getByText(/points: 100/i)).toBeInTheDocument();
  });

  it('should show submission status', () => {
    const assignmentWithSubmission = {
      ...mockAssignment,
      hasSubmission: true,
    };

    render(
      <BrowserRouter>
        <AssignmentCard
          assignment={assignmentWithSubmission}
          isInstructor={false}
          isAdmin={false}
          navigate={mockNavigate}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Submitted')).toBeInTheDocument();
  });

  it('should show grade button for instructors', () => {
    render(
      <BrowserRouter>
        <AssignmentCard
          assignment={mockAssignment}
          isInstructor={true}
          isAdmin={false}
          navigate={mockNavigate}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Grade')).toBeInTheDocument();
  });

  it('should navigate to view on view button click', () => {
    render(
      <BrowserRouter>
        <AssignmentCard
          assignment={mockAssignment}
          isInstructor={false}
          isAdmin={false}
          navigate={mockNavigate}
        />
      </BrowserRouter>
    );

    const viewButton = screen.getByText('View');
    fireEvent.click(viewButton);
    
    expect(mockNavigate).toHaveBeenCalledWith(`/assignments/${mockAssignment._id}/view`);
  });

  it('should display module title', () => {
    render(
      <BrowserRouter>
        <AssignmentCard
          assignment={mockAssignment}
          isInstructor={false}
          isAdmin={false}
          navigate={mockNavigate}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Module 1')).toBeInTheDocument();
  });

  it('should display group if assigned', () => {
    const assignmentWithGroup = {
      ...mockAssignment,
      group: 'Group A',
    };

    render(
      <BrowserRouter>
        <AssignmentCard
          assignment={assignmentWithGroup}
          isInstructor={false}
          isAdmin={false}
          navigate={mockNavigate}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Group A')).toBeInTheDocument();
  });

  it('should calculate points from questions if totalPoints not provided', () => {
    const assignmentWithoutTotal = {
      ...mockAssignment,
      totalPoints: undefined,
    };

    render(
      <BrowserRouter>
        <AssignmentCard
          assignment={assignmentWithoutTotal}
          isInstructor={false}
          isAdmin={false}
          navigate={mockNavigate}
        />
      </BrowserRouter>
    );

    expect(screen.getByText(/points: 100/i)).toBeInTheDocument();
  });
});

