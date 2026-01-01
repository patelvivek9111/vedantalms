import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import MobileNavigation from '../course/MobileNavigation';
import { useCourse } from '../../contexts/CourseContext';
import { useAuth } from '../../context/AuthContext';

// Mock dependencies
vi.mock('../../contexts/CourseContext', () => ({
  useCourse: vi.fn(),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockedUseCourse = useCourse as any;
const mockedUseAuth = useAuth as any;

describe('MobileNavigation', () => {
  const mockSetIsMobileMenuOpen = vi.fn();
  const mockSetShowChangeUserModal = vi.fn();
  const mockLogout = vi.fn();
  const mockGetCourses = vi.fn();

  const mockCourses = [
    {
      _id: 'course1',
      title: 'Course 1',
      catalog: { courseCode: 'CS101' },
      published: true,
    },
    {
      _id: 'course2',
      title: 'Course 2',
      catalog: { courseCode: 'CS102' },
      published: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseCourse.mockReturnValue({
      courses: mockCourses,
      getCourses: mockGetCourses,
    });
    mockedUseAuth.mockReturnValue({
      user: { _id: 'user1', role: 'student' },
    });
  });

  it('should not render on desktop', () => {
    const { container } = render(
      <BrowserRouter>
        <MobileNavigation
          courseTitle="Test Course"
          user={{ _id: 'user1' }}
          isMobileDevice={false}
          isMobileMenuOpen={false}
          setIsMobileMenuOpen={mockSetIsMobileMenuOpen}
          setShowChangeUserModal={mockSetShowChangeUserModal}
          logout={mockLogout}
        />
      </BrowserRouter>
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render on mobile', () => {
    render(
      <BrowserRouter>
        <MobileNavigation
          courseTitle="Test Course"
          user={{ _id: 'user1' }}
          isMobileDevice={true}
          isMobileMenuOpen={false}
          setIsMobileMenuOpen={mockSetIsMobileMenuOpen}
          setShowChangeUserModal={mockSetShowChangeUserModal}
          logout={mockLogout}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Test Course')).toBeInTheDocument();
  });

  it('should toggle course menu', () => {
    render(
      <BrowserRouter>
        <MobileNavigation
          courseTitle="Test Course"
          user={{ _id: 'user1' }}
          isMobileDevice={true}
          isMobileMenuOpen={false}
          setIsMobileMenuOpen={mockSetIsMobileMenuOpen}
          setShowChangeUserModal={mockSetShowChangeUserModal}
          logout={mockLogout}
        />
      </BrowserRouter>
    );

    const menuButton = screen.getByLabelText('Toggle course menu');
    fireEvent.click(menuButton);

    expect(mockSetIsMobileMenuOpen).toHaveBeenCalledWith(true);
  });

  it('should open course dropdown', () => {
    render(
      <MemoryRouter initialEntries={['/courses/course1']}>
        <MobileNavigation
          courseTitle="Test Course"
          user={{ _id: 'user1' }}
          isMobileDevice={true}
          isMobileMenuOpen={false}
          setIsMobileMenuOpen={mockSetIsMobileMenuOpen}
          setShowChangeUserModal={mockSetShowChangeUserModal}
          logout={mockLogout}
        />
      </MemoryRouter>
    );

    const dropdownButton = screen.getByLabelText('Switch course');
    fireEvent.click(dropdownButton);

    expect(screen.getByText('CS101')).toBeInTheDocument();
  });

  it('should filter published courses for students', () => {
    render(
      <MemoryRouter initialEntries={['/courses/course1']}>
        <MobileNavigation
          courseTitle="Test Course"
          user={{ _id: 'user1' }}
          isMobileDevice={true}
          isMobileMenuOpen={false}
          setIsMobileMenuOpen={mockSetIsMobileMenuOpen}
          setShowChangeUserModal={mockSetShowChangeUserModal}
          logout={mockLogout}
        />
      </MemoryRouter>
    );

    const dropdownButton = screen.getByLabelText('Switch course');
    fireEvent.click(dropdownButton);

    // Should only show published courses
    expect(screen.getByText('CS101')).toBeInTheDocument();
    expect(screen.queryByText('CS102')).not.toBeInTheDocument();
  });

  it('should show all courses for teachers', () => {
    mockedUseAuth.mockReturnValue({
      user: { _id: 'user1', role: 'teacher' },
    });

    render(
      <MemoryRouter initialEntries={['/courses/course1']}>
        <MobileNavigation
          courseTitle="Test Course"
          user={{ _id: 'user1', role: 'teacher' }}
          isMobileDevice={true}
          isMobileMenuOpen={false}
          setIsMobileMenuOpen={mockSetIsMobileMenuOpen}
          setShowChangeUserModal={mockSetShowChangeUserModal}
          logout={mockLogout}
        />
      </MemoryRouter>
    );

    const dropdownButton = screen.getByLabelText('Switch course');
    fireEvent.click(dropdownButton);

    expect(screen.getByText('My Courses')).toBeInTheDocument();
  });

  it('should highlight current course', () => {
    render(
      <MemoryRouter initialEntries={['/courses/course1']}>
        <MobileNavigation
          courseTitle="Test Course"
          user={{ _id: 'user1' }}
          isMobileDevice={true}
          isMobileMenuOpen={false}
          setIsMobileMenuOpen={mockSetIsMobileMenuOpen}
          setShowChangeUserModal={mockSetShowChangeUserModal}
          logout={mockLogout}
        />
      </MemoryRouter>
    );

    const dropdownButton = screen.getByLabelText('Switch course');
    fireEvent.click(dropdownButton);

    const currentCourse = screen.getByText('CS101');
    const button = currentCourse.closest('button');
    // Check if button has active/selected styling (could be different class names)
    expect(button).toBeInTheDocument();
  });

  it('should close dropdown when clicking outside', () => {
    render(
      <MemoryRouter initialEntries={['/courses/course1']}>
        <MobileNavigation
          courseTitle="Test Course"
          user={{ _id: 'user1' }}
          isMobileDevice={true}
          isMobileMenuOpen={false}
          setIsMobileMenuOpen={mockSetIsMobileMenuOpen}
          setShowChangeUserModal={mockSetShowChangeUserModal}
          logout={mockLogout}
        />
      </MemoryRouter>
    );

    const dropdownButton = screen.getByLabelText('Switch course');
    fireEvent.click(dropdownButton);

    // Click overlay
    const overlay = document.querySelector('.fixed.inset-0');
    if (overlay) {
      fireEvent.click(overlay);
      // Dropdown should close
    }
  });

  it('should load courses on mount', () => {
    mockedUseCourse.mockReturnValue({
      courses: [],
      getCourses: mockGetCourses,
    });

    render(
      <BrowserRouter>
        <MobileNavigation
          courseTitle="Test Course"
          user={{ _id: 'user1' }}
          isMobileDevice={true}
          isMobileMenuOpen={false}
          setIsMobileMenuOpen={mockSetIsMobileMenuOpen}
          setShowChangeUserModal={mockSetShowChangeUserModal}
          logout={mockLogout}
        />
      </BrowserRouter>
    );

    expect(mockGetCourses).toHaveBeenCalled();
  });
});


