import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StudentCard from '../students/StudentCard';

vi.mock('../../services/api', () => ({
  getImageUrl: vi.fn((v: string) => v)
}));

describe('CourseStudents replacement coverage', () => {
  it('renders student details and supports unenroll action', () => {
    const handleUnenroll = vi.fn();
    render(
      <StudentCard
        student={{ _id: 's1', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' }}
        isInstructor
        handleUnenroll={handleUnenroll}
      />
    );

    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Remove student'));
    expect(handleUnenroll).toHaveBeenCalledWith('s1');
  });
});


