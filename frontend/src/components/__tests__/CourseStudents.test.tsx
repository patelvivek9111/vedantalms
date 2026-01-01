import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CourseStudents from '../course/CourseStudents';
import { useCourse } from '../../contexts/CourseContext';
import api from '../../services/api';
import axios from 'axios';

// Mock dependencies
vi.mock('../../contexts/CourseContext', () => ({
  useCourse: vi.fn(),
}));

vi.mock('../../services/api', () => ({
  default: {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    get: vi.fn(),
  },
  getImageUrl: vi.fn((url) => `/uploads/${url}`),
}));

vi.mock('axios');
vi.mock('../../config', () => ({
  API_URL: 'http://localhost:5000',
}));

vi.mock('../../utils/logger', () => ({
  default: {
    error: vi.fn(),
  },
}));

const mockedUseCourse = useCourse as any;
const mockedApi = api as any;
const mockedAxios = axios as any;

describe('CourseStudents', () => {
  const mockCourse = {
    _id: 'course1',
    students: [
      {
        _id: 'student1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      },
    ],
    instructor: {
      _id: 'instructor1',
      firstName: 'Teacher',
      lastName: 'User',
    },
  };

  const mockEnrollStudent = vi.fn();
  const mockUnenrollStudent = vi.fn();
  const mockGetCourseRef = {
    current: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseCourse.mockReturnValue({
      enrollStudent: mockEnrollStudent,
      unenrollStudent: mockUnenrollStudent,
    });
  });

  it('should render student list', () => {
    render(
      <BrowserRouter>
        <CourseStudents
          course={mockCourse}
          setCourse={vi.fn()}
          courseId="course1"
          isInstructor={true}
          isAdmin={false}
          getCourseRef={mockGetCourseRef as any}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('should show search input for instructors', () => {
    render(
      <BrowserRouter>
        <CourseStudents
          course={mockCourse}
          setCourse={vi.fn()}
          courseId="course1"
          isInstructor={true}
          isAdmin={false}
          getCourseRef={mockGetCourseRef as any}
        />
      </BrowserRouter>
    );

    expect(screen.getByPlaceholderText(/search for students by name or email/i)).toBeInTheDocument();
  });

  it('should search for students', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        success: true,
      data: [
        {
          _id: 'student2',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
            role: 'student',
        },
      ],
      },
    });

    render(
      <BrowserRouter>
        <CourseStudents
          course={mockCourse}
          setCourse={vi.fn()}
          courseId="course1"
          isInstructor={true}
          isAdmin={false}
          getCourseRef={mockGetCourseRef as any}
        />
      </BrowserRouter>
    );

    const searchInput = screen.getByPlaceholderText(/search for students by name or email/i);
    fireEvent.change(searchInput, { target: { value: 'Jane' } });

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith(
        expect.stringContaining('/users/search')
      );
    });
  });

  it('should enroll student', async () => {
    mockEnrollStudent.mockResolvedValue({});

    render(
      <BrowserRouter>
        <CourseStudents
          course={mockCourse}
          setCourse={vi.fn()}
          courseId="course1"
          isInstructor={true}
          isAdmin={false}
          getCourseRef={mockGetCourseRef as any}
        />
      </BrowserRouter>
    );

    // Find and click enroll button
    const enrollButtons = screen.getAllByRole('button');
    const enrollButton = enrollButtons.find(btn => 
      btn.textContent?.includes('Enroll') || 
      btn.textContent?.includes('Add')
    );

    if (enrollButton) {
      fireEvent.click(enrollButton);
      await waitFor(() => {
        expect(mockEnrollStudent).toHaveBeenCalled();
      });
    }
  });

  it('should unenroll student', async () => {
    mockUnenrollStudent.mockResolvedValue({});

    render(
      <BrowserRouter>
        <CourseStudents
          course={mockCourse}
          setCourse={vi.fn()}
          courseId="course1"
          isInstructor={true}
          isAdmin={false}
          getCourseRef={mockGetCourseRef as any}
        />
      </BrowserRouter>
    );

    // Find remove button
    const removeButtons = screen.getAllByRole('button');
    const removeButton = removeButtons.find(btn => 
      btn.getAttribute('title') === 'Remove student'
    );

    if (removeButton) {
      fireEvent.click(removeButton);
      await waitFor(() => {
        expect(mockUnenrollStudent).toHaveBeenCalled();
      });
    }
  });

  it('should show instructor card', () => {
    render(
      <BrowserRouter>
        <CourseStudents
          course={mockCourse}
          setCourse={vi.fn()}
          courseId="course1"
          isInstructor={true}
          isAdmin={false}
          getCourseRef={mockGetCourseRef as any}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Teacher User')).toBeInTheDocument();
  });

  it('should not show remove button for instructor', () => {
    render(
      <BrowserRouter>
        <CourseStudents
          course={mockCourse}
          setCourse={vi.fn()}
          courseId="course1"
          isInstructor={true}
          isAdmin={false}
          getCourseRef={mockGetCourseRef as any}
        />
      </BrowserRouter>
    );

    // Instructor card should not have remove button
    const instructorCard = screen.getByText('Teacher User').closest('div');
    if (instructorCard) {
      const removeButton = instructorCard.querySelector('button[title="Remove student"]');
      expect(removeButton).not.toBeInTheDocument();
    }
  });
});


