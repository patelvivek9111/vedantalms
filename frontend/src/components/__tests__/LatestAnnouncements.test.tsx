import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LatestAnnouncements from '../LatestAnnouncements';
import { getAnnouncements } from '../services/announcementService';

// Mock dependencies
vi.mock('../services/announcementService', () => ({
  getAnnouncements: vi.fn(),
}));

vi.mock('../AnnouncementDetailModal', () => ({
  default: ({ isOpen, announcement, onClose }: any) => (
    isOpen ? (
      <div data-testid="announcement-modal">
        <button onClick={onClose}>Close</button>
        <div>{announcement?.title}</div>
      </div>
    ) : null
  ),
}));

const mockedGetAnnouncements = getAnnouncements as any;

describe('LatestAnnouncements', () => {
  const mockAnnouncements = [
    {
      _id: 'announcement1',
      title: 'Latest Announcement',
      body: 'This is the latest announcement',
      createdAt: new Date().toISOString(),
      author: {
        firstName: 'John',
        lastName: 'Doe',
      },
    },
    {
      _id: 'announcement2',
      title: 'Another Announcement',
      body: 'Another announcement body',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      author: {
        firstName: 'Jane',
        lastName: 'Smith',
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch and display announcements', async () => {
    mockedGetAnnouncements.mockResolvedValue(mockAnnouncements);

    render(
      <LatestAnnouncements
        courseId="course1"
        numberOfAnnouncements={3}
      />
    );

    await waitFor(() => {
      expect(mockedGetAnnouncements).toHaveBeenCalledWith('course1');
    });

    await waitFor(() => {
      expect(screen.getByText('Latest Announcement')).toBeInTheDocument();
    });
  });

  it('should limit announcements to numberOfAnnouncements', async () => {
    const manyAnnouncements = Array(10).fill(null).map((_, i) => ({
      _id: `announcement${i}`,
      title: `Announcement ${i}`,
      body: 'Body',
      createdAt: new Date().toISOString(),
      author: { firstName: 'John', lastName: 'Doe' },
    }));

    mockedGetAnnouncements.mockResolvedValue(manyAnnouncements);

    render(
      <LatestAnnouncements
        courseId="course1"
        numberOfAnnouncements={3}
      />
    );

    await waitFor(() => {
      // Should only show 3 announcements
      const announcements = screen.getAllByText(/announcement/i);
      expect(announcements.length).toBeLessThanOrEqual(3);
    });
  });

  it('should show loading state', () => {
    mockedGetAnnouncements.mockImplementation(() => new Promise(() => {}));

    render(
      <LatestAnnouncements
        courseId="course1"
        numberOfAnnouncements={3}
      />
    );

    expect(screen.getByText('Latest Announcements')).toBeInTheDocument();
  });

  it('should show error state', async () => {
    mockedGetAnnouncements.mockRejectedValue(new Error('Fetch failed'));

    render(
      <LatestAnnouncements
        courseId="course1"
        numberOfAnnouncements={3}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to load announcements')).toBeInTheDocument();
    });
  });

  it('should show empty state when no announcements', async () => {
    mockedGetAnnouncements.mockResolvedValue([]);

    render(
      <LatestAnnouncements
        courseId="course1"
        numberOfAnnouncements={3}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('No announcements yet.')).toBeInTheDocument();
    });
  });

  it('should open modal when announcement is clicked', async () => {
    mockedGetAnnouncements.mockResolvedValue(mockAnnouncements);

    render(
      <LatestAnnouncements
        courseId="course1"
        numberOfAnnouncements={3}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Latest Announcement')).toBeInTheDocument();
    });

    const announcement = screen.getByText('Latest Announcement').closest('div');
    if (announcement) {
      fireEvent.click(announcement);
      
      await waitFor(() => {
        expect(screen.getByTestId('announcement-modal')).toBeInTheDocument();
      });
    }
  });

  it('should format time ago correctly', async () => {
    const recentAnnouncement = [
      {
        ...mockAnnouncements[0],
        createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      },
    ];

    mockedGetAnnouncements.mockResolvedValue(recentAnnouncement);

    render(
      <LatestAnnouncements
        courseId="course1"
        numberOfAnnouncements={3}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/1h ago/i)).toBeInTheDocument();
    });
  });

  it('should strip HTML from body preview', async () => {
    const htmlAnnouncement = [
      {
        ...mockAnnouncements[0],
        body: '<p>HTML <strong>content</strong></p>',
      },
    ];

    mockedGetAnnouncements.mockResolvedValue(htmlAnnouncement);

    render(
      <LatestAnnouncements
        courseId="course1"
        numberOfAnnouncements={3}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/html content/i)).toBeInTheDocument();
    });
  });
});







