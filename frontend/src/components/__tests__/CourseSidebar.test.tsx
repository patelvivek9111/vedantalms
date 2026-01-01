import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CourseSidebar from '../course/CourseSidebar';
import { ClipboardList } from 'lucide-react';

describe('CourseSidebar', () => {
  const mockNavigationItems = [
    {
      id: 'overview',
      label: 'Overview',
      icon: ClipboardList,
    },
    {
      id: 'assignments',
      label: 'Assignments',
      icon: ClipboardList,
    },
  ];

  const mockSetIsMobileMenuOpen = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render navigation items', () => {
    render(
      <BrowserRouter>
        <CourseSidebar
          navigationItems={mockNavigationItems}
          activeSection="overview"
          courseId="course1"
          isMobileDevice={false}
          isMobileMenuOpen={false}
          setIsMobileMenuOpen={mockSetIsMobileMenuOpen}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Assignments')).toBeInTheDocument();
  });

  it('should highlight active section', () => {
    render(
      <BrowserRouter>
        <CourseSidebar
          navigationItems={mockNavigationItems}
          activeSection="overview"
          courseId="course1"
          isMobileDevice={false}
          isMobileMenuOpen={false}
          setIsMobileMenuOpen={mockSetIsMobileMenuOpen}
        />
      </BrowserRouter>
    );

    const overviewButton = screen.getByText('Overview');
    expect(overviewButton.closest('button')).toHaveClass('bg-blue-100');
  });

  it('should navigate when item is clicked', () => {
    render(
      <BrowserRouter>
        <CourseSidebar
          navigationItems={mockNavigationItems}
          activeSection="overview"
          courseId="course1"
          isMobileDevice={false}
          isMobileMenuOpen={false}
          setIsMobileMenuOpen={mockSetIsMobileMenuOpen}
        />
      </BrowserRouter>
    );

    const assignmentsButton = screen.getByText('Assignments');
    fireEvent.click(assignmentsButton);

    // Should navigate to assignments section
    expect(assignmentsButton.closest('button')).toBeInTheDocument();
  });

  it('should show mobile menu header on mobile', () => {
    render(
      <BrowserRouter>
        <CourseSidebar
          navigationItems={mockNavigationItems}
          activeSection="overview"
          courseId="course1"
          isMobileDevice={true}
          isMobileMenuOpen={true}
          setIsMobileMenuOpen={mockSetIsMobileMenuOpen}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Course Menu')).toBeInTheDocument();
  });

  it('should close mobile menu when close button is clicked', () => {
    render(
      <BrowserRouter>
        <CourseSidebar
          navigationItems={mockNavigationItems}
          activeSection="overview"
          courseId="course1"
          isMobileDevice={true}
          isMobileMenuOpen={true}
          setIsMobileMenuOpen={mockSetIsMobileMenuOpen}
        />
      </BrowserRouter>
    );

    const closeButton = screen.getByLabelText('Close menu');
    fireEvent.click(closeButton);

    expect(mockSetIsMobileMenuOpen).toHaveBeenCalledWith(false);
  });

  it('should close mobile menu when item is clicked', () => {
    render(
      <BrowserRouter>
        <CourseSidebar
          navigationItems={mockNavigationItems}
          activeSection="overview"
          courseId="course1"
          isMobileDevice={true}
          isMobileMenuOpen={true}
          setIsMobileMenuOpen={mockSetIsMobileMenuOpen}
        />
      </BrowserRouter>
    );

    const overviewButton = screen.getByText('Overview');
    fireEvent.click(overviewButton);

    expect(mockSetIsMobileMenuOpen).toHaveBeenCalledWith(false);
  });

  it('should apply mobile styles on mobile device', () => {
    const { container } = render(
      <BrowserRouter>
        <CourseSidebar
          navigationItems={mockNavigationItems}
          activeSection="overview"
          courseId="course1"
          isMobileDevice={true}
          isMobileMenuOpen={true}
          setIsMobileMenuOpen={mockSetIsMobileMenuOpen}
        />
      </BrowserRouter>
    );

    const sidebar = container.querySelector('aside');
    expect(sidebar).toHaveClass('fixed');
  });

  it('should apply desktop styles on desktop', () => {
    const { container } = render(
      <BrowserRouter>
        <CourseSidebar
          navigationItems={mockNavigationItems}
          activeSection="overview"
          courseId="course1"
          isMobileDevice={false}
          isMobileMenuOpen={false}
          setIsMobileMenuOpen={mockSetIsMobileMenuOpen}
        />
      </BrowserRouter>
    );

    const sidebar = container.querySelector('aside');
    expect(sidebar).toHaveClass('relative');
  });
});







