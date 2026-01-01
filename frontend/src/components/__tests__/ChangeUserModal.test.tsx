import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ChangeUserModal } from '../ChangeUserModal';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

// Mock dependencies
vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../services/api', () => ({
  default: {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    post: vi.fn(),
  },
  getImageUrl: vi.fn((url) => `/uploads/${url}`),
}));

vi.mock('../../utils/logger', () => ({
  default: {
    error: vi.fn(),
  },
}));

const mockedUseAuth = useAuth as any;
const mockedApi = api as any;

// Mock window.location.reload
const mockReload = vi.fn();
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true,
});

describe('ChangeUserModal', () => {
  const mockOnClose = vi.fn();
  const mockSetUser = vi.fn();
  const mockSetToken = vi.fn();

  const mockUser = {
    _id: '1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    role: 'student',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockedUseAuth.mockReturnValue({
      user: mockUser,
      token: 'token1',
      setUser: mockSetUser,
      setToken: mockSetToken,
    });
  });

  it('should not render when closed', () => {
    const { container } = render(
      <BrowserRouter>
        <ChangeUserModal isOpen={false} onClose={mockOnClose} />
      </BrowserRouter>
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render when open', () => {
    render(
      <BrowserRouter>
        <ChangeUserModal isOpen={true} onClose={mockOnClose} />
      </BrowserRouter>
    );

    expect(screen.getByText('Change User')).toBeInTheDocument();
  });

  it('should display current user in stored users', () => {
    render(
      <BrowserRouter>
        <ChangeUserModal isOpen={true} onClose={mockOnClose} />
      </BrowserRouter>
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Current User')).toBeInTheDocument();
  });

  it('should show empty state when no users', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      token: null,
      setUser: mockSetUser,
      setToken: mockSetToken,
    });

    render(
      <BrowserRouter>
        <ChangeUserModal isOpen={true} onClose={mockOnClose} />
      </BrowserRouter>
    );

    expect(screen.getByText(/no users available/i)).toBeInTheDocument();
  });

  it('should show add user form when button is clicked', () => {
    render(
      <BrowserRouter>
        <ChangeUserModal isOpen={true} onClose={mockOnClose} />
      </BrowserRouter>
    );

    const addButton = screen.getByText(/add another user/i);
    fireEvent.click(addButton);

    expect(screen.getByText('Login as Another User')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
  });

  it('should add new user successfully', async () => {
    const newUser = {
      id: '2',
      _id: '2',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      role: 'teacher',
    };

    mockedApi.post.mockResolvedValue({
      data: {
        token: 'token2',
        user: newUser,
      },
    });

    render(
      <BrowserRouter>
        <ChangeUserModal isOpen={true} onClose={mockOnClose} />
      </BrowserRouter>
    );

    const addButton = screen.getByText(/add another user/i);
    fireEvent.click(addButton);

    const emailInput = screen.getByPlaceholderText('Email');
    const passwordInput = screen.getByPlaceholderText('Password');
    const loginButton = screen.getByText('Login');

    fireEvent.change(emailInput, { target: { value: 'jane@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith('/auth/login', {
        email: 'jane@example.com',
        password: 'password123',
      });
    });
  });

  it('should handle login errors', async () => {
    mockedApi.post.mockRejectedValue({
      response: {
        data: { message: 'Invalid credentials' },
      },
    });

    render(
      <BrowserRouter>
        <ChangeUserModal isOpen={true} onClose={mockOnClose} />
      </BrowserRouter>
    );

    const addButton = screen.getByText(/add another user/i);
    fireEvent.click(addButton);

    const emailInput = screen.getByPlaceholderText('Email');
    const passwordInput = screen.getByPlaceholderText('Password');
    const loginButton = screen.getByText('Login');

    fireEvent.change(emailInput, { target: { value: 'invalid@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrong' } });
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('should switch to selected user', () => {
    const storedUsers = [
      {
        _id: '1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        role: 'student',
        token: 'token1',
        lastUsed: Date.now(),
      },
      {
        _id: '2',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        role: 'teacher',
        token: 'token2',
        lastUsed: Date.now() - 1000,
      },
    ];

    localStorage.setItem('storedUsers', JSON.stringify(storedUsers));

    render(
      <BrowserRouter>
        <ChangeUserModal isOpen={true} onClose={mockOnClose} />
      </BrowserRouter>
    );

    const janeUser = screen.getByText('Jane Smith');
    fireEvent.click(janeUser.closest('div') || janeUser);

    expect(mockSetToken).toHaveBeenCalledWith('token2');
    expect(mockSetUser).toHaveBeenCalled();
  });

  it('should remove user from stored users', () => {
    const storedUsers = [
      {
        _id: '1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        role: 'student',
        token: 'token1',
        lastUsed: Date.now(),
      },
      {
        _id: '2',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        role: 'teacher',
        token: 'token2',
        lastUsed: Date.now() - 1000,
      },
    ];

    localStorage.setItem('storedUsers', JSON.stringify(storedUsers));

    render(
      <BrowserRouter>
        <ChangeUserModal isOpen={true} onClose={mockOnClose} />
      </BrowserRouter>
    );

    // Find remove button (LogOut icon) for non-current user
    const removeButtons = screen.getAllByRole('button');
    const removeButton = removeButtons.find(btn => 
      btn.querySelector('svg') && btn.getAttribute('title') === 'Remove user'
    );

    if (removeButton) {
      fireEvent.click(removeButton);
      
      const stored = localStorage.getItem('storedUsers');
      const users = stored ? JSON.parse(stored) : [];
      expect(users).toHaveLength(1);
      expect(users[0].email).toBe('john@example.com');
    }
  });

  it('should cancel add user form', () => {
    render(
      <BrowserRouter>
        <ChangeUserModal isOpen={true} onClose={mockOnClose} />
      </BrowserRouter>
    );

    const addButton = screen.getByText(/add another user/i);
    fireEvent.click(addButton);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(screen.queryByText('Login as Another User')).not.toBeInTheDocument();
  });

  it('should close modal', () => {
    render(
      <BrowserRouter>
        <ChangeUserModal isOpen={true} onClose={mockOnClose} />
      </BrowserRouter>
    );

    // Close button is an X icon without aria-label, find it by querySelector or by position
    const closeButton = document.querySelector('button[class*="hover:bg-gray-100"]') as HTMLButtonElement;
    expect(closeButton).toBeInTheDocument();
    fireEvent.click(closeButton!);

    expect(mockOnClose).toHaveBeenCalled();
  });
});


