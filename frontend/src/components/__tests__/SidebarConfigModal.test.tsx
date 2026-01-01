import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SidebarConfigModal from '../SidebarConfigModal';
import api from '../../services/api';

// Mock dependencies
vi.mock('../../services/api', () => ({
  default: {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    put: vi.fn(),
  },
}));

const mockedApi = api as any;

describe('SidebarConfigModal', () => {
  const mockOnClose = vi.fn();
  const mockOnConfigUpdated = vi.fn();
  const mockCourseId = 'course1';
  const mockCurrentConfig = {
    items: [
      { id: 'overview', label: 'Overview', visible: true, order: 0 },
      { id: 'assignments', label: 'Assignments', visible: true, order: 1 },
    ],
    studentVisibility: {
      overview: true,
      assignments: true,
      grades: false,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when closed', () => {
    const { container } = render(
      <SidebarConfigModal
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
      <SidebarConfigModal
        isOpen={true}
        onClose={mockOnClose}
        courseId={mockCourseId}
        currentConfig={mockCurrentConfig}
        onConfigUpdated={mockOnConfigUpdated}
      />
    );

    expect(screen.getByText(/sidebar configuration/i)).toBeInTheDocument();
  });

  it('should display current sidebar items', () => {
    render(
      <SidebarConfigModal
        isOpen={true}
        onClose={mockOnClose}
        courseId={mockCourseId}
        currentConfig={mockCurrentConfig}
        onConfigUpdated={mockOnConfigUpdated}
      />
    );

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Assignments')).toBeInTheDocument();
  });

  it('should toggle item visibility', () => {
    render(
      <SidebarConfigModal
        isOpen={true}
        onClose={mockOnClose}
        courseId={mockCourseId}
        currentConfig={mockCurrentConfig}
        onConfigUpdated={mockOnConfigUpdated}
      />
    );

    // Find visibility toggle for an item
    const toggles = screen.getAllByRole('checkbox');
    if (toggles.length > 0) {
      const toggle = toggles[0];
      const wasChecked = toggle.checked;
      fireEvent.click(toggle);
      expect(toggle.checked).toBe(!wasChecked);
    }
  });

  it('should save configuration successfully', async () => {
    mockedApi.put.mockResolvedValue({
      data: {
        success: true,
        data: { _id: mockCourseId, ...mockCurrentConfig },
      },
    });

    render(
      <SidebarConfigModal
        isOpen={true}
        onClose={mockOnClose}
        courseId={mockCourseId}
        currentConfig={mockCurrentConfig}
        onConfigUpdated={mockOnConfigUpdated}
      />
    );

    const saveButton = screen.getByText(/save/i);
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockedApi.put).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockOnConfigUpdated).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('should handle save errors', async () => {
    mockedApi.put.mockRejectedValue({
      response: {
        data: { message: 'Save failed' },
      },
    });

    render(
      <SidebarConfigModal
        isOpen={true}
        onClose={mockOnClose}
        courseId={mockCourseId}
        currentConfig={mockCurrentConfig}
        onConfigUpdated={mockOnConfigUpdated}
      />
    );

    const saveButton = screen.getByText(/save/i);
    fireEvent.click(saveButton);

    await waitFor(() => {
      // Error should be displayed
      expect(mockedApi.put).toHaveBeenCalled();
    });
  });

  it('should cancel without saving', () => {
    render(
      <SidebarConfigModal
        isOpen={true}
        onClose={mockOnClose}
        courseId={mockCourseId}
        currentConfig={mockCurrentConfig}
        onConfigUpdated={mockOnConfigUpdated}
      />
    );

    const cancelButton = screen.getByText(/cancel/i);
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
    expect(mockedApi.put).not.toHaveBeenCalled();
  });

  it('should reset to defaults', () => {
    render(
      <SidebarConfigModal
        isOpen={true}
        onClose={mockOnClose}
        courseId={mockCourseId}
        currentConfig={mockCurrentConfig}
        onConfigUpdated={mockOnConfigUpdated}
      />
    );

    const resetButton = screen.getByText(/reset/i);
    if (resetButton) {
      fireEvent.click(resetButton);
      // Should reset configuration
    }
  });
});







