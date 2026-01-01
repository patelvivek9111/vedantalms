import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AnnouncementList from '../announcements/AnnouncementList';
import { useAuth } from '../../context/AuthContext';

// Mock dependencies
vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = useAuth as any;

describe('AnnouncementList', () => {
  const mockAnnouncements = [
    {
      _id: 'announcement1',
      title: 'Test Announcement',
      body: 'This is a test announcement body',
      createdAt: new Date().toISOString(),
      author: {
        firstName: 'John',
        lastName: 'Doe',
      },
    },
    {
      _id: 'announcement2',
      title: 'Another Announcement',
      body: 'Another test announcement',
      createdAt: new Date().toISOString(),
      author: {
        firstName: 'Jane',
        lastName: 'Smith',
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      user: { _id: 'user1' },
    });
  });

  it('should render announcements', () => {
    render(
      <AnnouncementList
        announcements={mockAnnouncements}
      />
    );

    expect(screen.getByText('Test Announcement')).toBeInTheDocument();
    expect(screen.getByText('Another Announcement')).toBeInTheDocument();
  });

  it('should show empty state when no announcements', () => {
    render(
      <AnnouncementList announcements={[]} />
    );

    expect(screen.getByText('No announcements yet')).toBeInTheDocument();
  });

  it('should call onSelect when announcement is clicked', () => {
    const mockOnSelect = vi.fn();

    render(
      <AnnouncementList
        announcements={mockAnnouncements}
        onSelect={mockOnSelect}
      />
    );

    const announcement = screen.getByText('Test Announcement');
    fireEvent.click(announcement.closest('li') || announcement);

    expect(mockOnSelect).toHaveBeenCalledWith(mockAnnouncements[0]);
  });

  it('should display announcement body preview', () => {
    render(
      <AnnouncementList
        announcements={mockAnnouncements}
      />
    );

    // Should show truncated body
    expect(screen.getByText(/this is a test announcement/i)).toBeInTheDocument();
  });

  it('should display formatted date', () => {
    render(
      <AnnouncementList
        announcements={mockAnnouncements}
      />
    );

    // Should show date
    const dateElements = screen.getAllByText(/at/i);
    expect(dateElements.length).toBeGreaterThan(0);
  });

  it('should truncate long body text', () => {
    const longBodyAnnouncement = [
      {
        ...mockAnnouncements[0],
        body: 'A'.repeat(200),
      },
    ];

    render(
      <AnnouncementList
        announcements={longBodyAnnouncement}
      />
    );

    // Should truncate to 120 characters
    const bodyText = screen.getByText(/…/);
    expect(bodyText).toBeInTheDocument();
  });

  it('should handle HTML in body', () => {
    const htmlAnnouncement = [
      {
        ...mockAnnouncements[0],
        body: '<p>HTML content</p>',
      },
    ];

    render(
      <AnnouncementList
        announcements={htmlAnnouncement}
      />
    );

    // Should strip HTML tags
    expect(screen.getByText('HTML content')).toBeInTheDocument();
  });
});







