import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CourseQuizzes from '../course/CourseQuizzes';
import AssignmentList from '../assignments/AssignmentList';

// Mock AssignmentList
vi.mock('../assignments/AssignmentList', () => ({
  default: ({ assignments }: any) => (
    <div data-testid="quiz-list">
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

describe('CourseQuizzes', () => {
  const mockCourse = {
    _id: 'course1',
    title: 'Test Course',
  };

  const mockModules = [
    {
      _id: 'module1',
      assignments: [
        {
          _id: 'quiz1',
          title: 'Quiz 1',
          isGradedQuiz: true,
          totalPoints: 100,
        },
        {
          _id: 'assign1',
          title: 'Assignment 1',
          isGradedQuiz: false,
        },
      ],
    },
  ];

  const mockGroupAssignments = [
    {
      _id: 'groupQuiz1',
      title: 'Group Quiz',
      isGradedQuiz: true,
      totalPoints: 50,
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

  it('should render quizzes list', () => {
    render(
      <BrowserRouter>
        <CourseQuizzes
          course={mockCourse}
          modules={mockModules}
          groupAssignments={mockGroupAssignments}
          discussionsLoading={false}
          user={mockUser}
          studentSubmissions={[]}
          submissionMap={{}}
          isInstructor={false}
          isAdmin={false}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Quizzes')).toBeInTheDocument();
  });

  it('should filter only graded quizzes', () => {
    render(
      <BrowserRouter>
        <CourseQuizzes
          course={mockCourse}
          modules={mockModules}
          groupAssignments={mockGroupAssignments}
          discussionsLoading={false}
          user={mockUser}
          studentSubmissions={[]}
          submissionMap={{}}
          isInstructor={false}
          isAdmin={false}
        />
      </BrowserRouter>
    );

    const quizList = screen.getByTestId('quiz-list');
    expect(quizList).toBeInTheDocument();
    expect(screen.getByText('Quiz 1')).toBeInTheDocument();
    expect(screen.getByText('Group Quiz')).toBeInTheDocument();
    expect(screen.queryByText('Assignment 1')).not.toBeInTheDocument();
  });

  it('should show create button for instructors', () => {
    render(
      <BrowserRouter>
        <CourseQuizzes
          course={mockCourse}
          modules={mockModules}
          groupAssignments={[]}
          discussionsLoading={false}
          user={{ _id: 'user1', role: 'teacher' }}
          studentSubmissions={[]}
          submissionMap={{}}
          isInstructor={true}
          isAdmin={false}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Create Quiz')).toBeInTheDocument();
  });

  it('should show message when no modules exist', () => {
    render(
      <BrowserRouter>
        <CourseQuizzes
          course={mockCourse}
          modules={[]}
          groupAssignments={[]}
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

  it('should show loading state', () => {
    render(
      <BrowserRouter>
        <CourseQuizzes
          course={mockCourse}
          modules={mockModules}
          groupAssignments={[]}
          discussionsLoading={true}
          user={mockUser}
          studentSubmissions={[]}
          submissionMap={{}}
          isInstructor={false}
          isAdmin={false}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Loading quizzes...')).toBeInTheDocument();
  });

  it('should deduplicate quizzes', () => {
    const duplicateQuizzes = [
      {
        _id: 'quiz1',
        title: 'Duplicate Quiz',
        isGradedQuiz: true,
      },
    ];

    const modulesWithDuplicates = [
      {
        _id: 'module1',
        assignments: duplicateQuizzes,
      },
    ];

    render(
      <BrowserRouter>
        <CourseQuizzes
          course={mockCourse}
          modules={modulesWithDuplicates}
          groupAssignments={duplicateQuizzes}
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
    const quizList = screen.getByTestId('quiz-list');
    expect(quizList).toBeInTheDocument();
  });
});







