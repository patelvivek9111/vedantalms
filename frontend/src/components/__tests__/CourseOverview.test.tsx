import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CourseOverview from '../course/CourseOverview';

// Mock LatestAnnouncements
vi.mock('../LatestAnnouncements', () => ({
  default: () => <div>Latest Announcements</div>,
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

describe('CourseOverview', () => {
  const mockCourse = {
    _id: 'course1',
    title: 'Test Course',
    catalog: {
      courseCode: 'CS101',
    },
    instructor: {
      firstName: 'John',
      lastName: 'Doe',
    },
    published: true,
    students: [{ _id: 'student1' }],
    overviewConfig: {
      showLatestAnnouncements: true,
      numberOfAnnouncements: 3,
    },
  };

  const mockModules = [
    {
      _id: 'module1',
      title: 'Module 1',
      assignments: [{ _id: 'assign1' }],
    },
  ];

  const mockHandleToggleCoursePublish = vi.fn();
  const mockSetShowOverviewConfigModal = vi.fn();
  const mockSetShowSidebarConfigModal = vi.fn();
  const mockSetActiveSection = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  it('should render course header', () => {
    render(
      <BrowserRouter>
        <CourseOverview
          course={mockCourse}
          modules={mockModules}
          courseId="course1"
          isInstructor={true}
          isAdmin={false}
          publishingCourse={false}
          publishError={null}
          handleToggleCoursePublish={mockHandleToggleCoursePublish}
          setShowOverviewConfigModal={mockSetShowOverviewConfigModal}
          setShowSidebarConfigModal={mockSetShowSidebarConfigModal}
          setActiveSection={mockSetActiveSection}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('CS101')).toBeInTheDocument();
    expect(screen.getByText(/instructor: john doe/i)).toBeInTheDocument();
  });

  it('should show publish button for instructors', () => {
    render(
      <BrowserRouter>
        <CourseOverview
          course={mockCourse}
          modules={mockModules}
          courseId="course1"
          isInstructor={true}
          isAdmin={false}
          publishingCourse={false}
          publishError={null}
          handleToggleCoursePublish={mockHandleToggleCoursePublish}
          setShowOverviewConfigModal={mockSetShowOverviewConfigModal}
          setShowSidebarConfigModal={mockSetShowSidebarConfigModal}
          setActiveSection={mockSetActiveSection}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Unpublish')).toBeInTheDocument();
  });

  it('should show unpublish button for unpublished courses', () => {
    const unpublishedCourse = {
      ...mockCourse,
      published: false,
    };

    render(
      <BrowserRouter>
        <CourseOverview
          course={unpublishedCourse}
          modules={mockModules}
          courseId="course1"
          isInstructor={true}
          isAdmin={false}
          publishingCourse={false}
          publishError={null}
          handleToggleCoursePublish={mockHandleToggleCoursePublish}
          setShowOverviewConfigModal={mockSetShowOverviewConfigModal}
          setShowSidebarConfigModal={mockSetShowSidebarConfigModal}
          setActiveSection={mockSetActiveSection}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Publish')).toBeInTheDocument();
  });

  it('should show statistics cards for instructors', () => {
    render(
      <BrowserRouter>
        <CourseOverview
          course={mockCourse}
          modules={mockModules}
          courseId="course1"
          isInstructor={true}
          isAdmin={false}
          publishingCourse={false}
          publishError={null}
          handleToggleCoursePublish={mockHandleToggleCoursePublish}
          setShowOverviewConfigModal={mockSetShowOverviewConfigModal}
          setShowSidebarConfigModal={mockSetShowSidebarConfigModal}
          setActiveSection={mockSetActiveSection}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Students')).toBeInTheDocument();
    expect(screen.getByText('Modules')).toBeInTheDocument();
    expect(screen.getByText('Assignments')).toBeInTheDocument();
  });

  it('should show quick actions for instructors', () => {
    render(
      <BrowserRouter>
        <CourseOverview
          course={mockCourse}
          modules={mockModules}
          courseId="course1"
          isInstructor={true}
          isAdmin={false}
          publishingCourse={false}
          publishError={null}
          handleToggleCoursePublish={mockHandleToggleCoursePublish}
          setShowOverviewConfigModal={mockSetShowOverviewConfigModal}
          setShowSidebarConfigModal={mockSetShowSidebarConfigModal}
          setActiveSection={mockSetActiveSection}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Create Module')).toBeInTheDocument();
    expect(screen.getByText('Manage Students')).toBeInTheDocument();
    expect(screen.getByText('View Gradebook')).toBeInTheDocument();
  });

  it('should open overview config modal', () => {
    render(
      <BrowserRouter>
        <CourseOverview
          course={mockCourse}
          modules={mockModules}
          courseId="course1"
          isInstructor={true}
          isAdmin={false}
          publishingCourse={false}
          publishError={null}
          handleToggleCoursePublish={mockHandleToggleCoursePublish}
          setShowOverviewConfigModal={mockSetShowOverviewConfigModal}
          setShowSidebarConfigModal={mockSetShowSidebarConfigModal}
          setActiveSection={mockSetActiveSection}
        />
      </BrowserRouter>
    );

    const configButton = screen.getByText(/configure overview/i);
    fireEvent.click(configButton);

    expect(mockSetShowOverviewConfigModal).toHaveBeenCalledWith(true);
  });

  it('should open sidebar config modal', () => {
    render(
      <BrowserRouter>
        <CourseOverview
          course={mockCourse}
          modules={mockModules}
          courseId="course1"
          isInstructor={true}
          isAdmin={false}
          publishingCourse={false}
          publishError={null}
          handleToggleCoursePublish={mockHandleToggleCoursePublish}
          setShowOverviewConfigModal={mockSetShowOverviewConfigModal}
          setShowSidebarConfigModal={mockSetShowSidebarConfigModal}
          setActiveSection={mockSetActiveSection}
        />
      </BrowserRouter>
    );

    const sidebarButton = screen.getByText(/customize sidebar/i);
    fireEvent.click(sidebarButton);

    expect(mockSetShowSidebarConfigModal).toHaveBeenCalledWith(true);
  });

  it('should show latest announcements for students', () => {
    render(
      <BrowserRouter>
        <CourseOverview
          course={mockCourse}
          modules={mockModules}
          courseId="course1"
          isInstructor={false}
          isAdmin={false}
          publishingCourse={false}
          publishError={null}
          handleToggleCoursePublish={mockHandleToggleCoursePublish}
          setShowOverviewConfigModal={mockSetShowOverviewConfigModal}
          setShowSidebarConfigModal={mockSetShowSidebarConfigModal}
          setActiveSection={mockSetActiveSection}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Latest Announcements')).toBeInTheDocument();
  });

  it('should show publish error', () => {
    render(
      <BrowserRouter>
        <CourseOverview
          course={mockCourse}
          modules={mockModules}
          courseId="course1"
          isInstructor={true}
          isAdmin={false}
          publishingCourse={false}
          publishError="Failed to publish course"
          handleToggleCoursePublish={mockHandleToggleCoursePublish}
          setShowOverviewConfigModal={mockSetShowOverviewConfigModal}
          setShowSidebarConfigModal={mockSetShowSidebarConfigModal}
          setActiveSection={mockSetActiveSection}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Failed to publish course')).toBeInTheDocument();
  });

  it('should disable publish button when publishing', () => {
    render(
      <BrowserRouter>
        <CourseOverview
          course={mockCourse}
          modules={mockModules}
          courseId="course1"
          isInstructor={true}
          isAdmin={false}
          publishingCourse={true}
          publishError={null}
          handleToggleCoursePublish={mockHandleToggleCoursePublish}
          setShowOverviewConfigModal={mockSetShowOverviewConfigModal}
          setShowSidebarConfigModal={mockSetShowSidebarConfigModal}
          setActiveSection={mockSetActiveSection}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Updating...')).toBeInTheDocument();
  });

  it('should show delete button for admins', () => {
    render(
      <BrowserRouter>
        <CourseOverview
          course={mockCourse}
          modules={mockModules}
          courseId="course1"
          isInstructor={false}
          isAdmin={true}
          publishingCourse={false}
          publishError={null}
          handleToggleCoursePublish={mockHandleToggleCoursePublish}
          setShowOverviewConfigModal={mockSetShowOverviewConfigModal}
          setShowSidebarConfigModal={mockSetShowSidebarConfigModal}
          setActiveSection={mockSetActiveSection}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Delete Course')).toBeInTheDocument();
  });
});







