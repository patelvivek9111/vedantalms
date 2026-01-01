import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import CourseList from '../CourseList';
import { useCourse } from '../../contexts/CourseContext';
import { useAuth } from '../../context/AuthContext';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock dependencies
vi.mock('../../contexts/CourseContext', () => ({
  useCourse: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  default: {
    error: vi.fn(),
  },
}));

// Mock window.confirm
window.confirm = vi.fn(() => true);

const mockedUseCourse = useCourse as any;
const mockedUseAuth = useAuth as any;

describe('CourseList', () => {
  const mockDeleteCourse = vi.fn();
  const mockCourses = [
    {
      _id: 'course1',
      title: 'Course 1',
      published: true,
    },
    {
      _id: 'course2',
      title: 'Course 2',
      published: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockedUseCourse.mockReturnValue({
      courses: [],
      loading: false,
      error: null,
      deleteCourse: mockDeleteCourse,
    });
    mockedUseAuth.mockReturnValue({
      user: { _id: '1', role: 'student' },
    });
  });

  it('should show loading state', () => {
    mockedUseCourse.mockReturnValue({
      courses: [],
      loading: true,
      error: null,
      deleteCourse: mockDeleteCourse,
    });

    render(
      <BrowserRouter>
        <CourseList />
      </BrowserRouter>
    );

    // Check for loading spinner
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('should show error message', () => {
    mockedUseCourse.mockReturnValue({
      courses: [],
      loading: false,
      error: 'Failed to load courses',
      deleteCourse: mockDeleteCourse,
    });

    render(
      <BrowserRouter>
        <CourseList />
      </BrowserRouter>
    );

    expect(screen.getByText('Failed to load courses')).toBeInTheDocument();
  });

  it('should redirect to first course for students', async () => {
    mockedUseCourse.mockReturnValue({
      courses: mockCourses,
      loading: false,
      error: null,
      deleteCourse: mockDeleteCourse,
    });

    render(
      <MemoryRouter>
        <CourseList />
      </MemoryRouter>
    );

    await waitFor(() => {
      // Should redirect to first published course
      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  it('should show empty state for students when no published courses', () => {
    mockedUseCourse.mockReturnValue({
      courses: [
        { _id: 'course1', title: 'Course 1', published: false },
      ],
      loading: false,
      error: null,
      deleteCourse: mockDeleteCourse,
    });

    render(
      <BrowserRouter>
        <CourseList />
      </BrowserRouter>
    );

    expect(screen.getByText('No published courses available')).toBeInTheDocument();
  });

  it('should show empty state for teachers with create button', () => {
    mockedUseAuth.mockReturnValue({
      user: { _id: '1', role: 'teacher' },
    });

    mockedUseCourse.mockReturnValue({
      courses: [],
      loading: false,
      error: null,
      deleteCourse: mockDeleteCourse,
    });

    render(
      <BrowserRouter>
        <CourseList />
      </BrowserRouter>
    );

    expect(screen.getByText('No courses available')).toBeInTheDocument();
    expect(screen.getByText('Create Your First Course')).toBeInTheDocument();
  });

  it('should show all courses for teachers', () => {
    mockedUseAuth.mockReturnValue({
      user: { _id: '1', role: 'teacher' },
    });

    mockedUseCourse.mockReturnValue({
      courses: mockCourses,
      loading: false,
      error: null,
      deleteCourse: mockDeleteCourse,
    });

    render(
      <BrowserRouter>
        <CourseList />
      </BrowserRouter>
    );

    // Should redirect to first course (all courses visible to teachers)
    expect(screen.getByText(/redirecting/i)).toBeInTheDocument();
  });

  it('should filter published courses for students', () => {
    mockedUseAuth.mockReturnValue({
      user: { _id: '1', role: 'student' },
    });

    mockedUseCourse.mockReturnValue({
      courses: mockCourses,
      loading: false,
      error: null,
      deleteCourse: mockDeleteCourse,
    });

    render(
      <BrowserRouter>
        <CourseList />
      </BrowserRouter>
    );

    // Should only show published courses
    expect(screen.getByText(/redirecting/i)).toBeInTheDocument();
  });
});

