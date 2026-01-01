import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OverviewConfigModal from '../OverviewConfigModal';
import { updateOverviewConfig } from '../../services/api';

// Mock dependencies
vi.mock('../../services/api', () => ({
  updateOverviewConfig: vi.fn(),
}));

const mockedUpdateOverviewConfig = updateOverviewConfig as any;

describe('OverviewConfigModal', () => {
  const mockOnClose = vi.fn();
  const mockOnConfigUpdated = vi.fn();
  const mockCourseId = 'course1';
  const mockCurrentConfig = {
    showLatestAnnouncements: false,
    numberOfAnnouncements: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when closed', () => {
    const { container } = render(
      <OverviewConfigModal
        isOpen={false}
        onClose={mockOnClose}
        courseId={mockCourseId}
        currentConfig={mockCurrentConfig}
        onConfigUpdated={mockOnConfigUpdated}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render when open', () => {
    render(
      <OverviewConfigModal
        isOpen={true}
        onClose={mockOnClose}
        courseId={mockCourseId}
        currentConfig={mockCurrentConfig}
        onConfigUpdated={mockOnConfigUpdated}
      />
    );

    expect(screen.getByText('Overview Configuration')).toBeInTheDocument();
  });

  it('should display current config', () => {
    render(
      <OverviewConfigModal
        isOpen={true}
        onClose={mockOnClose}
        courseId={mockCourseId}
        currentConfig={mockCurrentConfig}
        onConfigUpdated={mockOnConfigUpdated}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
  });

  it('should toggle show latest announcements', () => {
    render(
      <OverviewConfigModal
        isOpen={true}
        onClose={mockOnClose}
        courseId={mockCourseId}
        currentConfig={mockCurrentConfig}
        onConfigUpdated={mockOnConfigUpdated}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(checkbox).toBeChecked();
  });

  it('should show number selector when announcements are enabled', () => {
    const configWithAnnouncements = {
      ...mockCurrentConfig,
      showLatestAnnouncements: true,
    };

    render(
      <OverviewConfigModal
        isOpen={true}
        onClose={mockOnClose}
        courseId={mockCourseId}
        currentConfig={configWithAnnouncements}
        onConfigUpdated={mockOnConfigUpdated}
      />
    );

    expect(screen.getByText('Number of Announcements to Show')).toBeInTheDocument();
  });

  it('should change number of announcements', () => {
    const configWithAnnouncements = {
      ...mockCurrentConfig,
      showLatestAnnouncements: true,
    };

    render(
      <OverviewConfigModal
        isOpen={true}
        onClose={mockOnClose}
        courseId={mockCourseId}
        currentConfig={configWithAnnouncements}
        onConfigUpdated={mockOnConfigUpdated}
      />
    );

    const button5 = screen.getByText('5');
    fireEvent.click(button5);

    expect(button5).toHaveClass('bg-blue-500');
  });

  it('should save configuration successfully', async () => {
    mockedUpdateOverviewConfig.mockResolvedValue({
      success: true,
      data: {
        showLatestAnnouncements: true,
        numberOfAnnouncements: 5,
      },
    });

    render(
      <OverviewConfigModal
        isOpen={true}
        onClose={mockOnClose}
        courseId={mockCourseId}
        currentConfig={mockCurrentConfig}
        onConfigUpdated={mockOnConfigUpdated}
      />
    );

    const saveButton = screen.getByText('Save Configuration');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockedUpdateOverviewConfig).toHaveBeenCalledWith(mockCourseId, {
        showLatestAnnouncements: false,
        numberOfAnnouncements: 3,
      });
    });

    await waitFor(() => {
      expect(mockOnConfigUpdated).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('should handle save errors', async () => {
    mockedUpdateOverviewConfig.mockRejectedValue({
      response: {
        data: { message: 'Save failed' },
      },
    });

    render(
      <OverviewConfigModal
        isOpen={true}
        onClose={mockOnClose}
        courseId={mockCourseId}
        currentConfig={mockCurrentConfig}
        onConfigUpdated={mockOnConfigUpdated}
      />
    );

    const saveButton = screen.getByText('Save Configuration');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Save failed')).toBeInTheDocument();
    });
  });

  it('should cancel without saving', () => {
    render(
      <OverviewConfigModal
        isOpen={true}
        onClose={mockOnClose}
        courseId={mockCourseId}
        currentConfig={mockCurrentConfig}
        onConfigUpdated={mockOnConfigUpdated}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
    expect(mockedUpdateOverviewConfig).not.toHaveBeenCalled();
  });

  it('should close when X button is clicked', () => {
    render(
      <OverviewConfigModal
        isOpen={true}
        onClose={mockOnClose}
        courseId={mockCourseId}
        currentConfig={mockCurrentConfig}
        onConfigUpdated={mockOnConfigUpdated}
      />
    );

    // Close button is the first button (X icon) without accessible name
    const buttons = screen.getAllByRole('button');
    const closeButton = buttons[0]; // First button should be the X close button
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});









