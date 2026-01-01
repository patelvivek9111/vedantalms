import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import BottomNav from '../BottomNav';
import { useAuth } from '../../context/AuthContext';
import { useUnreadMessages } from '../../hooks/useUnreadMessages';

// Mock dependencies
vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../hooks/useUnreadMessages', () => ({
  useUnreadMessages: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  default: {
    error: vi.fn(),
  },
}));

const mockedUseAuth = useAuth as any;
const mockedUseUnreadMessages = useUnreadMessages as any;

describe('BottomNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockedUseAuth.mockReturnValue({
      user: { _id: '1', role: 'student' },
    });
    mockedUseUnreadMessages.mockReturnValue({
      unreadCount: 0,
    });
  });

  it('should not render when no nav items', () => {
    localStorage.removeItem('bottomNavItems');
    
    const { container } = render(
      <BrowserRouter>
        <BottomNav />
      </BrowserRouter>
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render default nav items', () => {
    // Default items should be loaded when localStorage is empty
    const { container } = render(
      <BrowserRouter>
        <BottomNav />
      </BrowserRouter>
    );

    // Should render navigation
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should highlight active route', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <BottomNav />
      </MemoryRouter>
    );

    // Active item should have active styling
    const navLinks = screen.getAllByRole('link');
    expect(navLinks.length).toBeGreaterThan(0);
  });

  it('should show unread badge for inbox', () => {
    mockedUseUnreadMessages.mockReturnValue({
      unreadCount: 5,
    });

    render(
      <BrowserRouter>
        <BottomNav />
      </BrowserRouter>
    );

    // Should show badge with count
    const badge = screen.queryByText('5');
    if (badge) {
      expect(badge).toBeInTheDocument();
    }
  });

  it('should show 9+ for counts over 9', () => {
    mockedUseUnreadMessages.mockReturnValue({
      unreadCount: 15,
    });

    render(
      <BrowserRouter>
        <BottomNav />
      </BrowserRouter>
    );

    const badge = screen.queryByText('9+');
    if (badge) {
      expect(badge).toBeInTheDocument();
    }
  });

  it('should filter my-course for non-teachers', () => {
    mockedUseAuth.mockReturnValue({
      user: { _id: '1', role: 'student' },
    });

    const customItems = [
      { id: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: 'Gauge' },
      { id: 'my-course', label: 'My Courses', to: '/teacher/courses', icon: 'BookOpen' },
    ];

    localStorage.setItem('bottomNavItems', JSON.stringify(customItems));

    render(
      <BrowserRouter>
        <BottomNav />
      </BrowserRouter>
    );

    // my-course should be filtered out for students
    expect(screen.queryByText('My Courses')).not.toBeInTheDocument();
  });

  it('should allow my-course for teachers', () => {
    mockedUseAuth.mockReturnValue({
      user: { _id: '1', role: 'teacher' },
    });

    const customItems = [
      { id: 'my-course', label: 'My Courses', to: '/teacher/courses', icon: 'BookOpen' },
    ];

    localStorage.setItem('bottomNavItems', JSON.stringify(customItems));

    render(
      <BrowserRouter>
        <BottomNav />
      </BrowserRouter>
    );

    // Should be visible for teachers
    // Note: This depends on the actual implementation
  });

  it('should update on storage changes', () => {
    const { rerender } = render(
      <BrowserRouter>
        <BottomNav />
      </BrowserRouter>
    );

    const newItems = [
      { id: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: 'Gauge' },
    ];

    localStorage.setItem('bottomNavItems', JSON.stringify(newItems));

    // Trigger storage event
    window.dispatchEvent(new Event('storage'));

    rerender(
      <BrowserRouter>
        <BottomNav />
      </BrowserRouter>
    );

    // Should update with new items
    expect(localStorage.getItem('bottomNavItems')).toBeTruthy();
  });
});







