import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import StudentsManagement from '@/components/students/StudentsManagement';

vi.mock('@/services/api', () => ({
  getImageUrl: (path: string) => path,
}));

const noop = vi.fn();

function renderRoster(course: any) {
  return render(
    <StudentsManagement
      course={course}
      isInstructor
      isAdmin={false}
      searchQuery=""
      handleSearchChange={noop}
      isSearching={false}
      searchResults={[]}
      searchError={null}
      handleEnroll={noop}
      handleApproveEnrollment={noop}
      handleDenyEnrollment={noop}
      handleUnenroll={noop}
    />
  );
}

const alice = { _id: 'u1', firstName: 'Alice', lastName: 'Ng', email: 'alice@example.com' };

describe('StudentsManagement with deleted accounts', () => {
  it('renders a placeholder instead of crashing when the instructor was deleted', () => {
    renderRoster({ instructor: null, students: [alice], enrollmentRequests: [], waitlist: [] });

    expect(screen.getByText('No instructor assigned.')).toBeInTheDocument();
    expect(screen.getByText('Alice Ng')).toBeInTheDocument();
  });

  it('skips null entries in the roster and counts only real students', () => {
    renderRoster({
      instructor: alice,
      students: [alice, null, undefined],
      enrollmentRequests: [],
      waitlist: [],
    });

    expect(screen.getByText('Enrolled students (1)')).toBeInTheDocument();
  });

  it('shows the pending and waitlist sections for requests with a live student', () => {
    const bob = { _id: 'u2', firstName: 'Bob', lastName: 'Lee', email: 'bob@example.com' };
    renderRoster({
      instructor: alice,
      students: [],
      enrollmentRequests: [
        { _id: 'r1', status: 'pending', student: bob, requestDate: new Date().toISOString() },
        { _id: 'r2', status: 'waitlisted', student: bob, requestDate: new Date().toISOString() },
      ],
      waitlist: [],
    });

    expect(screen.getByText('Pending approval (1)')).toBeInTheDocument();
    expect(screen.getByText('Waitlist (1)')).toBeInTheDocument();
  });

  it('drops enrollment requests and waitlist entries whose student no longer exists', () => {
    renderRoster({
      instructor: alice,
      students: [],
      enrollmentRequests: [
        { _id: 'r1', status: 'pending', student: null, requestDate: new Date().toISOString() },
        { _id: 'r2', status: 'waitlisted', student: null, requestDate: new Date().toISOString() },
      ],
      waitlist: [{ student: null, position: 1 }],
    });

    expect(screen.queryByText('Pending approval (1)')).not.toBeInTheDocument();
    expect(screen.queryByText('Waitlist (1)')).not.toBeInTheDocument();
    expect(screen.getByText('No students enrolled yet.')).toBeInTheDocument();
  });

  it('still resolves waitlist position when the entry is intact', () => {
    const bob = { _id: 'u2', firstName: 'Bob', lastName: 'Lee', email: 'bob@example.com' };
    renderRoster({
      instructor: alice,
      students: [],
      enrollmentRequests: [
        { _id: 'r3', status: 'waitlisted', student: bob, requestDate: new Date().toISOString() },
      ],
      waitlist: [{ student: null, position: 1 }, { student: bob, position: 2 }],
    });

    expect(screen.getByText('Bob Lee')).toBeInTheDocument();
    expect(screen.getByText('· #2')).toBeInTheDocument();
  });
});
