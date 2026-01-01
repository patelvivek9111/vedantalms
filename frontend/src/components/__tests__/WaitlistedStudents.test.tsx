import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WaitlistedStudents from '../course/WaitlistedStudents';
import { getImageUrl } from '../../services/api';

// Mock dependencies
vi.mock('../../services/api', () => ({
  getImageUrl: vi.fn((url) => `/uploads/${url}`),
}));

describe('WaitlistedStudents', () => {
  const mockHandleApproveEnrollment = vi.fn();
  const mockHandleDenyEnrollment = vi.fn();

  const mockCourse = {
    _id: 'course1',
    students: [],
    enrollmentRequests: [
      {
        _id: 'request1',
        status: 'waitlisted',
        student: {
          _id: 'student1',
          firstName: 'John',
          lastName: 'Doe',
          profilePicture: null,
        },
      },
    ],
    waitlist: [
      {
        student: { _id: 'student1' },
        position: 1,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render waitlisted students', () => {
    render(
      <WaitlistedStudents
        course={mockCourse}
        handleApproveEnrollment={mockHandleApproveEnrollment}
        handleDenyEnrollment={mockHandleDenyEnrollment}
      />
    );

    expect(screen.getByText(/waitlisted students/i)).toBeInTheDocument();
    expect(screen.getByText('John Doe wants to join')).toBeInTheDocument();
  });

  it('should show waitlist position', () => {
    render(
      <WaitlistedStudents
        course={mockCourse}
        handleApproveEnrollment={mockHandleApproveEnrollment}
        handleDenyEnrollment={mockHandleDenyEnrollment}
      />
    );

    expect(screen.getByText(/waitlist position 1/i)).toBeInTheDocument();
  });

  it('should show empty state when no waitlisted students', () => {
    const courseWithoutWaitlist = {
      ...mockCourse,
      enrollmentRequests: [],
    };

    render(
      <WaitlistedStudents
        course={courseWithoutWaitlist}
        handleApproveEnrollment={mockHandleApproveEnrollment}
        handleDenyEnrollment={mockHandleDenyEnrollment}
      />
    );

    expect(screen.getByText('No waitlisted students at this time.')).toBeInTheDocument();
  });

  it('should approve enrollment', () => {
    render(
      <WaitlistedStudents
        course={mockCourse}
        handleApproveEnrollment={mockHandleApproveEnrollment}
        handleDenyEnrollment={mockHandleDenyEnrollment}
      />
    );

    const approveButton = screen.getByText('Approve');
    fireEvent.click(approveButton);

    expect(mockHandleApproveEnrollment).toHaveBeenCalledWith('student1');
  });

  it('should deny enrollment', () => {
    render(
      <WaitlistedStudents
        course={mockCourse}
        handleApproveEnrollment={mockHandleApproveEnrollment}
        handleDenyEnrollment={mockHandleDenyEnrollment}
      />
    );

    const denyButton = screen.getByText('Deny');
    fireEvent.click(denyButton);

    expect(mockHandleDenyEnrollment).toHaveBeenCalledWith('student1');
  });

  it('should show capacity note when course is full', () => {
    const fullCourse = {
      ...mockCourse,
      catalog: {
        maxStudents: 10,
      },
      students: Array(10).fill({ _id: 'student' }),
    };

    render(
      <WaitlistedStudents
        course={fullCourse}
        handleApproveEnrollment={mockHandleApproveEnrollment}
        handleDenyEnrollment={mockHandleDenyEnrollment}
      />
    );

    expect(screen.getByText(/course is full/i)).toBeInTheDocument();
  });

  it('should display student profile picture', () => {
    const courseWithPicture = {
      ...mockCourse,
      enrollmentRequests: [
        {
          ...mockCourse.enrollmentRequests[0],
          student: {
            ...mockCourse.enrollmentRequests[0].student,
            profilePicture: 'profile.jpg',
          },
        },
      ],
    };

    render(
      <WaitlistedStudents
        course={courseWithPicture}
        handleApproveEnrollment={mockHandleApproveEnrollment}
        handleDenyEnrollment={mockHandleDenyEnrollment}
      />
    );

    const image = screen.getByAltText('John Doe');
    expect(image).toBeInTheDocument();
  });

  it('should show initials when no profile picture', () => {
    render(
      <WaitlistedStudents
        course={mockCourse}
        handleApproveEnrollment={mockHandleApproveEnrollment}
        handleDenyEnrollment={mockHandleDenyEnrollment}
      />
    );

    expect(screen.getByText('JD')).toBeInTheDocument();
  });
});

