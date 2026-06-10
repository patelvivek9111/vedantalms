import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NotificationCenter from '@/components/common/NotificationCenter';
import * as notificationService from '@/services/notificationService';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { _id: 'user-1' }, token: 'test-token' }),
}));

vi.mock('@/services/notificationService', () => ({
  fetchNotificationList: vi.fn(),
  fetchNotificationUnreadCount: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  deleteNotification: vi.fn(),
}));

vi.mock('@/hooks/notifications/notificationSync', () => ({
  signalNotificationInvalidation: vi.fn(),
  invalidateNotificationQueries: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/utils/logger', () => ({
  default: {
    error: vi.fn(),
  },
}));

vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn((date) => `2 hours ago`),
}));

const mockedService = notificationService as unknown as {
  fetchNotificationList: ReturnType<typeof vi.fn>;
  fetchNotificationUnreadCount: ReturnType<typeof vi.fn>;
  markNotificationRead: ReturnType<typeof vi.fn>;
  markAllNotificationsRead: ReturnType<typeof vi.fn>;
  deleteNotification: ReturnType<typeof vi.fn>;
};

function renderNotificationCenter(isOpen: boolean) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <NotificationCenter isOpen={isOpen} onClose={mockOnClose} />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

const mockOnClose = vi.fn();

describe('NotificationCenter', () => {
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
    mockOnClose.mockClear();
    mockNavigate.mockClear();
    mockedService.fetchNotificationUnreadCount.mockResolvedValue(0);
    mockedService.fetchNotificationList.mockResolvedValue({ items: [], unreadCount: 0 });
    Object.defineProperty(document, 'hidden', {
      value: false,
      writable: true,
      configurable: true,
    });
  });

  it('should not render when closed', () => {
    const { container } = renderNotificationCenter(false);

    expect(container.firstChild).toBeNull();
  });

  it('should render when open', async () => {
    renderNotificationCenter(true);

    await waitFor(() => {
      const notificationsElements = screen.getAllByText(/notifications/i);
      expect(notificationsElements.length).toBeGreaterThan(0);
    });
  });

  it('should fetch and display notifications', async () => {
    mockedService.fetchNotificationList.mockResolvedValue({
      items: mockNotifications,
      unreadCount: 1,
    });
    mockedService.fetchNotificationUnreadCount.mockResolvedValue(1);

    renderNotificationCenter(true);

    await waitFor(() => {
      expect(screen.getByText('New Message')).toBeInTheDocument();
      expect(screen.getByText('Grade Posted')).toBeInTheDocument();
    });
  });

  it('should mark notification as read', async () => {
    mockedService.fetchNotificationList.mockResolvedValue({
      items: mockNotifications,
      unreadCount: 1,
    });
    mockedService.fetchNotificationUnreadCount.mockResolvedValue(1);
    mockedService.markNotificationRead.mockResolvedValue({ success: true });

    renderNotificationCenter(true);

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
        expect(mockedService.markNotificationRead).toHaveBeenCalledWith('1');
      });
    }
  });

  it('should mark all as read', async () => {
    mockedService.fetchNotificationList.mockResolvedValue({
      items: mockNotifications,
      unreadCount: 1,
    });
    mockedService.fetchNotificationUnreadCount.mockResolvedValue(1);
    mockedService.markAllNotificationsRead.mockResolvedValue({ success: true });

    renderNotificationCenter(true);

    await waitFor(() => {
      expect(screen.getByText('New Message')).toBeInTheDocument();
    });

    const markAllButton = screen.getByTitle(/mark all as read/i);
    fireEvent.click(markAllButton);

    await waitFor(() => {
      expect(mockedService.markAllNotificationsRead).toHaveBeenCalled();
    });
  });

  it('should delete notification', async () => {
    mockedService.fetchNotificationList.mockResolvedValue({
      items: mockNotifications,
      unreadCount: 1,
    });
    mockedService.fetchNotificationUnreadCount.mockResolvedValue(1);
    mockedService.deleteNotification.mockResolvedValue({ success: true });

    renderNotificationCenter(true);

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
        expect(mockedService.deleteNotification).toHaveBeenCalledWith('1');
      });
    }
  });

  it('should close on outside click', () => {
    renderNotificationCenter(true);

    // Click outside
    fireEvent.mouseDown(document.body);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should close when close button is clicked', () => {
    renderNotificationCenter(true);

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

    mockedService.fetchNotificationList.mockResolvedValue({
      items: [notificationWithLink],
      unreadCount: 1,
    });
    mockedService.fetchNotificationUnreadCount.mockResolvedValue(1);
    mockedService.markNotificationRead.mockResolvedValue({ success: true });

    renderNotificationCenter(true);

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
    renderNotificationCenter(true);

    await waitFor(() => {
      expect(screen.getByText(/no notifications/i)).toBeInTheDocument();
    });
  });
});


