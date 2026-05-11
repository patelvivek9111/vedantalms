import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import EnrollmentRequestsHandler from '../enrollment/EnrollmentRequestsHandler';

const getMock = vi.fn();
const postMock = vi.fn();

vi.mock('../../services/api', () => ({
  default: {
    get: (...args: any[]) => getMock(...args),
    post: (...args: any[]) => postMock(...args)
  }
}));

describe('WaitlistedStudents replacement coverage', () => {
  it('shows pending enrollment request and approves it', async () => {
    getMock.mockResolvedValueOnce({
      data: {
        data: [
          {
            _id: 'todo1',
            type: 'enrollment_request',
            courseId: 'c1',
            action: 'pending',
            studentId: 's1',
            title: 'Request from Jane',
            createdAt: new Date().toISOString()
          }
        ]
      }
    });
    postMock.mockResolvedValueOnce({ data: { success: true } });

    render(<EnrollmentRequestsHandler courseId="c1" />);

    await waitFor(() => expect(screen.getByText('Request from Jane')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Approve'));
    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/courses/c1/enrollment/s1/approve'));
  });
});

