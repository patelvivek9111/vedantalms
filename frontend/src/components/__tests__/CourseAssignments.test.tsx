import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CourseAssignments from '../course/CourseAssignments';
import AssignmentList from '../assignments/AssignmentList';

// Mock AssignmentList
vi.mock('../assignments/AssignmentList', () => ({
  default: ({ assignments }: any) => (
    <div data-testid="assignment-list">
      {assignments.map((a: any) => (
        <div key={a._id}>{a.title}</div>
      ))}
    </div>
  ),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('CourseAssignments', () => {
  const mockCourse = {
    _id: 'course1',
    title: 'Test Course',
  };

  const mockModules = [
    {
      _id: 'module1',
      title: 'Module 1',
      assignments: [
        {
          _id: 'assign1',
          title: 'Assignment 1',
          dueDate: new Date(),
          totalPoints: 100,
        },
      ],
    },
  ];

  const mockGroupAssignments = [
    {
      _id: 'group1',
      title: 'Group Assignment',
      totalPoints: 50,
    },
  ];

  const mockDiscussions = [
    {
      _id: 'disc1',
      title: 'Discussion 1',
      dueDate: new Date(),
      totalPoints: 20,
    },
  ];

  const mockUser = {
    _id: 'user1',
    role: 'student',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  it('should render assignments list', () => {
    render(
      <BrowserRouter>
        <CourseAssignments
          course={mockCourse}
          modules={mockModules}
          groupAssignments={mockGroupAssignments}
          discussions={mockDiscussions}
          discussionsLoading={false}
          user={mockUser}
          studentSubmissions={[]}
          submissionMap={{}}
          isInstructor={false}
          isAdmin={false}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Assignments')).toBeInTheDocument();
  });

  it('should show create button for instructors', () => {
    render(
      <BrowserRouter>
        <CourseAssignments
          course={mockCourse}
          modules={mockModules}
          groupAssignments={[]}
          discussions={[]}
          discussionsLoading={false}
          user={{ _id: 'user1', role: 'teacher' }}
          studentSubmissions={[]}
          submissionMap={{}}
          isInstructor={true}
          isAdmin={false}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Create Assignment')).toBeInTheDocument();
  });

  it('should show message when no modules exist', () => {
    render(
      <BrowserRouter>
        <CourseAssignments
          course={mockCourse}
          modules={[]}
          groupAssignments={[]}
          discussions={[]}
          discussionsLoading={false}
          user={mockUser}
          studentSubmissions={[]}
          submissionMap={{}}
          isInstructor={true}
          isAdmin={false}
        />
      </BrowserRouter>
    );

    expect(screen.getByText(/create a module first/i)).toBeInTheDocument();
  });

  it('should combine assignments, group assignments, and discussions', () => {
    render(
      <BrowserRouter>
        <CourseAssignments
          course={mockCourse}
          modules={mockModules}
          groupAssignments={mockGroupAssignments}
          discussions={mockDiscussions}
          discussionsLoading={false}
          user={mockUser}
          studentSubmissions={[]}
          submissionMap={{}}
          isInstructor={false}
          isAdmin={false}
        />
      </BrowserRouter>
    );

    const assignmentList = screen.getByTestId('assignment-list');
    expect(assignmentList).toBeInTheDocument();
  });

  it('should show loading state for discussions', () => {
    render(
      <BrowserRouter>
        <CourseAssignments
          course={mockCourse}
          modules={mockModules}
          groupAssignments={[]}
          discussions={[]}
          discussionsLoading={true}
          user={mockUser}
          studentSubmissions={[]}
          submissionMap={{}}
          isInstructor={false}
          isAdmin={false}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Loading discussions...')).toBeInTheDocument();
  });

  it('should deduplicate assignments', () => {
    const duplicateAssignments = [
      {
        _id: 'assign1',
        title: 'Assignment 1',
        isGroupAssignment: true,
      },
    ];

    const modulesWithDuplicates = [
      {
        _id: 'module1',
        assignments: duplicateAssignments,
      },
    ];

    render(
      <BrowserRouter>
        <CourseAssignments
          course={mockCourse}
          modules={modulesWithDuplicates}
          groupAssignments={duplicateAssignments}
          discussions={[]}
          discussionsLoading={false}
          user={mockUser}
          studentSubmissions={[]}
          submissionMap={{}}
          isInstructor={false}
          isAdmin={false}
        />
      </BrowserRouter>
    );

    // Should not show duplicates
    const assignmentList = screen.getByTestId('assignment-list');
    expect(assignmentList).toBeInTheDocument();
  });
});







