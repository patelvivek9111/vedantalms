import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import CoursePages from '../CoursePages';

vi.mock('axios');
const mockedAxios = axios as any;

vi.mock('../CreatePageForm', () => ({
  default: () => <div>CreatePageForm</div>
}));

vi.mock('../../contexts/ModuleContext', () => ({
  ModuleProvider: ({ children }: any) => <div>{children}</div>
}));

describe('CourseSyllabus replacement coverage', () => {
  it('renders pages list for a course', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { data: [{ _id: 'p1', title: 'Syllabus', module: 'm1' }] }
    });

    render(
      <MemoryRouter>
        <CoursePages courseId="course-1" modules={[{ _id: 'm1', title: 'Module 1' }]} isInstructor isAdmin={false} />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Syllabus')).toBeInTheDocument());
    expect(screen.getByText('+ Add Page')).toBeInTheDocument();
  });
});









