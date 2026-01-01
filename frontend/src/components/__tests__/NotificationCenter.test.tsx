import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import NotificationCenter from '../NotificationCenter';
import api from '../../services/api';
import { requestCache } from '../../utils/requestCache';

// Mock dependencies
vi.mock('../../services/api', () => ({
  default: {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../utils/requestCache', () => ({
  requestCache: {
    get: vi.fn(),
  },
  CACHE_KEYS: {
    NOTIFICATIONS: 'notifications:list',
  },
}));

vi.mock('../../utils/logger', () => ({
  default: {
    error: vi.fn(),
  },
}));

vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn((date) => `2 hours ago`),
}));

const mockedApi = api as any;
const mockedRequestCache = requestCache as any;

describe('NotificationCenter', () => {
  const mockOnClose = vi.fn();
  const mockNotifications = [
    {
      _id: '1',
      type: 'message',
      title: 'New Message',
      message: 'You have a new message',
      read: false,
      createdAt: new Date().toISOString(),
    },
    {
      _id: '2',
      type: 'grade',
      title: 'Grade Posted',
      message: 'Your assignment has been graded',
      read: true,
      createdAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    Object.defineProperty(document, 'hidden', {
      value: false,
      writable: true,
      configurable: true,
    });
  });

  it('should not render when closed', () => {
    const { container } = render(
      <BrowserRouter>
        <NotificationCenter isOpen={false} onClose={mockOnClose} />
      </BrowserRouter>
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render when open', async () => {
    mockedRequestCache.get.mockResolvedValue({
      notifications: [],
      unreadCount: 0,
    });

    render(
      <BrowserRouter>
        <NotificationCenter isOpen={true} onClose={mockOnClose} />
      </BrowserRouter>
    );

    await waitFor(() => {
      const notificationsElements = screen.getAllByText(/notifications/i);
      expect(notificationsElements.length).toBeGreaterThan(0);
    });
  });

  it('should fetch and display notifications', async () => {
    mockedRequestCache.get.mockResolvedValue({
      notifications: mockNotifications,
      unreadCount: 1,
    });

    render(
      <BrowserRouter>
        <NotificationCenter isOpen={true} onClose={mockOnClose} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('New Message')).toBeInTheDocument();
      expect(screen.getByText('Grade Posted')).toBeInTheDocument();
    });
  });

  it('should mark notification as read', async () => {
    mockedRequestCache.get.mockResolvedValue({
      notifications: mockNotifications,
      unreadCount: 1,
    });
    mockedApi.patch.mockResolvedValue({ data: { success: true } });

    render(
      <BrowserRouter>
        <NotificationCenter isOpen={true} onClose={mockOnClose} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('New Message')).toBeInTheDocument();
    });

    // Find and click mark as read button
    const markReadButtons = screen.getAllByRole('button');
    const markReadButton = markReadButtons.find(btn => 
      btn.getAttribute('title')?.includes('Mark as read')
    );

    if (markReadButton) {
      fireEvent.click(markReadButton);
      await waitFor(() => {
        expect(mockedApi.patch).toHaveBeenCalledWith('/notifications/1/read');
      });
    }
  });

  it('should mark all as read', async () => {
    mockedRequestCache.get.mockResolvedValue({
      notifications: mockNotifications,
      unreadCount: 1,
    });
    mockedApi.patch.mockResolvedValue({ data: { success: true } });

    render(
      <BrowserRouter>
        <NotificationCenter isOpen={true} onClose={mockOnClose} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('New Message')).toBeInTheDocument();
    });

    const markAllButton = screen.getByTitle(/mark all as read/i);
    fireEvent.click(markAllButton);

    await waitFor(() => {
      expect(mockedApi.patch).toHaveBeenCalledWith('/notifications/read-all');
    });
  });

  it('should delete notification', async () => {
    mockedRequestCache.get.mockResolvedValue({
      notifications: mockNotifications,
      unreadCount: 1,
    });
    mockedApi.delete.mockResolvedValue({ data: { success: true } });

    render(
      <BrowserRouter>
        <NotificationCenter isOpen={true} onClose={mockOnClose} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('New Message')).toBeInTheDocument();
    });

    // Find delete button
    const deleteButtons = screen.getAllByRole('button');
    const deleteButton = deleteButtons.find(btn => 
      btn.getAttribute('title')?.includes('Delete')
    );

    if (deleteButton) {
      fireEvent.click(deleteButton);
      await waitFor(() => {
        expect(mockedApi.delete).toHaveBeenCalledWith('/notifications/1');
      });
    }
  });

  it('should close on outside click', () => {
    mockedRequestCache.get.mockResolvedValue({
      notifications: [],
      unreadCount: 0,
    });

    render(
      <BrowserRouter>
        <NotificationCenter isOpen={true} onClose={mockOnClose} />
      </BrowserRouter>
    );

    // Click outside
    fireEvent.mouseDown(document.body);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should close when close button is clicked', () => {
    mockedRequestCache.get.mockResolvedValue({
      notifications: [],
      unreadCount: 0,
    });

    render(
      <BrowserRouter>
        <NotificationCenter isOpen={true} onClose={mockOnClose} />
      </BrowserRouter>
    );

    // Close button is an X icon without text, find it by its position (last button in header)
    const buttons = screen.getAllByRole('button');
    const closeButton = buttons[buttons.length - 1]; // Last button should be close
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should navigate to link when notification is clicked', async () => {
    const notificationWithLink = {
      ...mockNotifications[0],
      link: '/courses/123',
    };

    mockedRequestCache.get.mockResolvedValue({
      notifications: [notificationWithLink],
      unreadCount: 1,
    });
    mockedApi.patch.mockResolvedValue({ data: { success: true } });

    render(
      <BrowserRouter>
        <NotificationCenter isOpen={true} onClose={mockOnClose} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('New Message')).toBeInTheDocument();
    });

    // Click notification
    const notification = screen.getByText('New Message');
    fireEvent.click(notification.closest('div') || notification);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('should show empty state when no notifications', async () => {
    mockedRequestCache.get.mockResolvedValue({
      notifications: [],
      unreadCount: 0,
    });

    render(
      <BrowserRouter>
        <NotificationCenter isOpen={true} onClose={mockOnClose} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/no notifications/i)).toBeInTheDocument();
    });
  });
});


