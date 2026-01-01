import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { PrivateRoute } from '../PrivateRoute';
import { AuthProvider, useAuth } from '../../context/AuthContext';

// Mock AuthContext
vi.mock('../../context/AuthContext', async () => {
  const actual = await vi.importActual('../../context/AuthContext');
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

const mockedUseAuth = useAuth as any;

const TestComponent = () => <div>Protected Content</div>;

describe('PrivateRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render children when user is authenticated', () => {
    mockedUseAuth.mockReturnValue({
      user: { _id: '1', role: 'student' },
      loading: false,
    });

    render(
      <BrowserRouter>
        <PrivateRoute>
          <TestComponent />
        </PrivateRoute>
      </BrowserRouter>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should show loading when auth is loading', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      loading: true,
    });

    render(
      <BrowserRouter>
        <PrivateRoute>
          <TestComponent />
        </PrivateRoute>
      </BrowserRouter>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should redirect to login when user is not authenticated', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <PrivateRoute>
          <TestComponent />
        </PrivateRoute>
      </MemoryRouter>
    );

    // Should redirect to login
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should allow access when user role matches allowedRoles', () => {
    mockedUseAuth.mockReturnValue({
      user: { _id: '1', role: 'admin' },
      loading: false,
    });

    render(
      <BrowserRouter>
        <PrivateRoute allowedRoles={['admin', 'teacher']}>
          <TestComponent />
        </PrivateRoute>
      </BrowserRouter>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should redirect to unauthorized when user role does not match', () => {
    mockedUseAuth.mockReturnValue({
      user: { _id: '1', role: 'student' },
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <PrivateRoute allowedRoles={['admin', 'teacher']}>
          <TestComponent />
        </PrivateRoute>
      </MemoryRouter>
    );

    // Should redirect to unauthorized
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should allow access when no allowedRoles specified', () => {
    mockedUseAuth.mockReturnValue({
      user: { _id: '1', role: 'student' },
      loading: false,
    });

    render(
      <BrowserRouter>
        <PrivateRoute>
          <TestComponent />
        </PrivateRoute>
      </BrowserRouter>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});







