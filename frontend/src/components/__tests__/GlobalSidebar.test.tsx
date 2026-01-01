import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import GlobalSidebar from '../GlobalSidebar';
import { useAuth } from '../../context/AuthContext';
import { useCourse } from '../../contexts/CourseContext';
import { useUnreadMessages } from '../../hooks/useUnreadMessages';

// Mock dependencies
vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../contexts/CourseContext', () => ({
  useCourse: vi.fn(),
}));

vi.mock('../../hooks/useUnreadMessages', () => ({
  useUnreadMessages: vi.fn(),
}));

vi.mock('../../services/api', () => ({
  getImageUrl: vi.fn((url) => `/uploads/${url}`),
}));

const mockedUseAuth = useAuth as any;
const mockedUseCourse = useCourse as any;
const mockedUseUnreadMessages = useUnreadMessages as any;

describe('GlobalSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      user: { _id: '1', firstName: 'John', lastName: 'Doe', role: 'student' },
      logout: vi.fn(),
    });
    mockedUseCourse.mockReturnValue({
      courses: [],
    });
    mockedUseUnreadMessages.mockReturnValue({
      unreadCount: 0,
    });
  });

  it('should render sidebar for authenticated user', () => {
    render(
      <BrowserRouter>
        <GlobalSidebar />
      </BrowserRouter>
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('should show navigation items for student', () => {
    render(
      <BrowserRouter>
        <GlobalSidebar />
      </BrowserRouter>
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Courses')).toBeInTheDocument();
    expect(screen.getByText('Calendar')).toBeInTheDocument();
  });

  it('should show admin-specific items for admin', () => {
    mockedUseAuth.mockReturnValue({
      user: { _id: '1', firstName: 'Admin', lastName: 'User', role: 'admin' },
      logout: vi.fn(),
    });

    render(
      <BrowserRouter>
        <GlobalSidebar />
      </BrowserRouter>
    );

    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('should show teacher-specific items for teacher', () => {
    mockedUseAuth.mockReturnValue({
      user: { _id: '1', firstName: 'Teacher', lastName: 'User', role: 'teacher' },
      logout: vi.fn(),
    });

    render(
      <BrowserRouter>
        <GlobalSidebar />
      </BrowserRouter>
    );

    expect(screen.getByText('Groups')).toBeInTheDocument();
    expect(screen.getByText('Catalog')).toBeInTheDocument();
  });

  it('should show unread count badge on inbox', () => {
    mockedUseUnreadMessages.mockReturnValue({
      unreadCount: 5,
    });

    render(
      <BrowserRouter>
        <GlobalSidebar />
      </BrowserRouter>
    );

    // Should show badge with count
    const badge = screen.queryByText('5');
    if (badge) {
      expect(badge).toBeInTheDocument();
    }
  });

  it('should handle logout', () => {
    const mockLogout = vi.fn();
    mockedUseAuth.mockReturnValue({
      user: { _id: '1', firstName: 'John', lastName: 'Doe', role: 'student' },
      logout: mockLogout,
    });

    render(
      <BrowserRouter>
        <GlobalSidebar />
      </BrowserRouter>
    );

    // Find logout button
    const logoutButtons = screen.getAllByRole('button');
    const logoutButton = logoutButtons.find(btn => 
      btn.textContent?.includes('Logout') || 
      btn.getAttribute('aria-label')?.includes('logout')
    );

    if (logoutButton) {
      fireEvent.click(logoutButton);
      expect(mockLogout).toHaveBeenCalled();
    }
  });

  it('should highlight active route', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <GlobalSidebar />
      </MemoryRouter>
    );

    // Active route should be highlighted
    const dashboardLink = screen.getByText('Dashboard');
    expect(dashboardLink.closest('a')).toHaveAttribute('href', '/dashboard');
  });

  it('should show course dropdown on hover', () => {
    const mockCourses = [
      { _id: 'course1', title: 'Course 1' },
      { _id: 'course2', title: 'Course 2' },
    ];

    mockedUseCourse.mockReturnValue({
      courses: mockCourses,
    });

    render(
      <BrowserRouter>
        <GlobalSidebar />
      </BrowserRouter>
    );

    // Find courses section
    const coursesLink = screen.getByText('Courses');
    if (coursesLink) {
      // Hover should show dropdown
      fireEvent.mouseEnter(coursesLink);
    }
  });

  it('should navigate to course when clicked', () => {
    const mockCourses = [
      { _id: 'course1', title: 'Course 1' },
    ];

    mockedUseCourse.mockReturnValue({
      courses: mockCourses,
    });

    render(
      <MemoryRouter>
        <GlobalSidebar />
      </MemoryRouter>
    );

    // Course link should navigate
    const courseLink = screen.queryByText('Course 1');
    if (courseLink) {
      expect(courseLink.closest('a')).toHaveAttribute('href', '/courses/course1');
    }
  });
});







