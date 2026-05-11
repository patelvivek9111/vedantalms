import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import { CourseProvider, useCourse } from '../../contexts/CourseContext';
import { ModuleProvider, useModule } from '../../contexts/ModuleContext';

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn((path: string) => {
      if (path === '/auth/me') {
        return Promise.resolve({
          data: { success: true, user: { _id: 'u1', firstName: 'A', lastName: 'B', email: 'a@b.com', role: 'student' } }
        });
      }
      if (path === '/courses') {
        return Promise.resolve({ data: { success: true, data: [{ _id: 'c1', title: 'Course 1' }] } });
      }
      if (path === '/modules/course-1') {
        return Promise.resolve({ data: { success: true, data: [{ _id: 'm1', title: 'Module 1', course: 'course-1' }] } });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    }),
    post: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
    patch: vi.fn().mockResolvedValue({ data: { success: true, published: true } }),
    delete: vi.fn().mockResolvedValue({ data: { success: true } })
  }
}));

function AuthConsumer() {
  const { user, logout } = useAuth();
  return (
    <div>
      <span>{user ? user.email : 'no-user'}</span>
      <button onClick={logout}>logout</button>
    </div>
  );
}

function CourseConsumer() {
  const { courses } = useCourse();
  return <div>courses:{courses.length}</div>;
}

function ModuleConsumer() {
  const { modules, getModules } = useModule();
  return (
    <div>
      <span>modules:{modules.length}</span>
      <button onClick={() => getModules('course-1')}>load</button>
    </div>
  );
}

describe('Context coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'token');
  });

  it('AuthContext loads user and supports logout', async () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText('a@b.com')).toBeInTheDocument());
    fireEvent.click(screen.getByText('logout'));
    expect(screen.getByText('no-user')).toBeInTheDocument();
  });

  it('CourseContext fetches courses when authenticated', async () => {
    render(
      <AuthProvider>
        <CourseProvider>
          <CourseConsumer />
        </CourseProvider>
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText('courses:1')).toBeInTheDocument());
  });

  it('ModuleContext fetches modules by course', async () => {
    render(
      <AuthProvider>
        <ModuleProvider>
          <ModuleConsumer />
        </ModuleProvider>
      </AuthProvider>
    );
    fireEvent.click(screen.getByText('load'));
    await waitFor(() => expect(screen.getByText('modules:1')).toBeInTheDocument());
  });
});

