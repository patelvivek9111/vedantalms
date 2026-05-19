import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StudentsManagement from '@/components/students/StudentsManagement';

vi.mock('@/services/api', () => ({
  getImageUrl: vi.fn((v: string) => v)
}));

describe('StudentSearchSection replacement coverage', () => {
  it('renders add-students search and triggers enroll from results', () => {
    const handleEnroll = vi.fn();

    render(
      <StudentsManagement
        course={{ students: [], enrollmentRequests: [], catalog: { maxStudents: 20 }, instructor: { _id: 'i1' } }}
        isInstructor
        isAdmin={false}
        searchQuery="jane"
        handleSearchChange={vi.fn()}
        isSearching={false}
        searchResults={[{ _id: 's1', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' }]}
        searchError={null}
        handleEnroll={handleEnroll}
        handleApproveEnrollment={vi.fn()}
        handleDenyEnrollment={vi.fn()}
        handleUnenroll={vi.fn()}
      />
    );

    expect(screen.getByText('Add Students')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Add'));
    expect(handleEnroll).toHaveBeenCalledWith('s1');
  });
});

