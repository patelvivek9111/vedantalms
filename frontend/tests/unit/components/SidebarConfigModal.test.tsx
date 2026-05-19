import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import SidebarConfigModal from '@/components/modals/SidebarConfigModal';
import api from '@/services/api';
import { normalizeSidebarItemsForModal } from '@/constants/sidebarConfigDefaults';

const mockAuthUser = { role: 'teacher' as string, _id: 't1' };
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockAuthUser }),
}));

// Mock dependencies
vi.mock('@/services/api', () => ({
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
    mockAuthUser.role = 'teacher';
    mockAuthUser._id = 't1';
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

    expect(screen.getByText(/customize course sidebar/i)).toBeInTheDocument();
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

    // Items appear in both "Sidebar Items" and "Student Visibility" sections
    const overviewItems = screen.getAllByText('Overview');
    expect(overviewItems.length).toBeGreaterThan(0);
    
    const assignmentItems = screen.getAllByText('Assignments');
    expect(assignmentItems.length).toBeGreaterThan(0);
  });

  it('should toggle item visibility', async () => {
    render(
      <SidebarConfigModal
        isOpen={true}
        onClose={mockOnClose}
        courseId={mockCourseId}
        currentConfig={mockCurrentConfig}
        onConfigUpdated={mockOnConfigUpdated}
      />
    );

    // Find visibility toggle buttons (Eye/EyeOff icons)
    const toggleButtons = screen.getAllByTitle(/hide item|show item/i);
    if (toggleButtons.length > 0) {
      const toggle = toggleButtons[0];
      // Get the parent item to check visibility state
      const itemContainer = toggle.closest('.flex.items-center');
      const wasVisible = itemContainer?.classList.contains('bg-white') || itemContainer?.classList.contains('dark:bg-gray-800');
      
      fireEvent.click(toggle);
      
      // Wait for state update
      await waitFor(() => {
        const updatedContainer = toggle.closest('.flex.items-center');
        const isNowVisible = updatedContainer?.classList.contains('bg-white') || updatedContainer?.classList.contains('dark:bg-gray-800');
        expect(isNowVisible).toBe(!wasVisible);
      });
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

  it('should reset to defaults', async () => {
    render(
      <SidebarConfigModal
        isOpen={true}
        onClose={mockOnClose}
        courseId={mockCourseId}
        currentConfig={mockCurrentConfig}
        onConfigUpdated={mockOnConfigUpdated}
      />
    );

    const resetButton = screen.getByText(/reset to default/i);
    fireEvent.click(resetButton);
    
    // Wait for reset to apply - should show all default items
    // Items appear in both sections, so use getAllByText
    await waitFor(() => {
      const syllabusItems = screen.getAllByText('Syllabus');
      expect(syllabusItems.length).toBeGreaterThan(0);

      const modulesItems = screen.getAllByText('Modules');
      expect(modulesItems.length).toBeGreaterThan(0);

      const meetingsItems = screen.getAllByText('Meetings');
      expect(meetingsItems.length).toBeGreaterThan(0);
    });
  });

  it('teacher: Grades only under Student Visibility; Gradebook not in Student Visibility', async () => {
    const fullItems = normalizeSidebarItemsForModal(undefined);
    expect(fullItems.some((i) => i.id === 'grades')).toBe(true);

    render(
      <SidebarConfigModal
        isOpen={true}
        onClose={mockOnClose}
        courseId={mockCourseId}
        currentConfig={{ items: fullItems, studentVisibility: {} }}
        onConfigUpdated={mockOnConfigUpdated}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Customize Course Sidebar')).toBeInTheDocument();
    });

    const sidebarBlock = screen.getByRole('heading', { name: 'Sidebar Items' }).parentElement!;
    const studentBlock = screen.getByRole('heading', { name: 'Student Visibility' }).parentElement!;

    expect(within(sidebarBlock).queryByText('Grades')).not.toBeInTheDocument();
    expect(within(studentBlock).getByText('Grades')).toBeInTheDocument();

    expect(within(sidebarBlock).getByText('Gradebook')).toBeInTheDocument();
    expect(within(studentBlock).queryByText('Gradebook')).not.toBeInTheDocument();
  });

  it('does not show Gradebook row for students (cannot toggle teacher-only link)', async () => {
    mockAuthUser.role = 'student';
    mockAuthUser._id = 's1';

    const fullItems = normalizeSidebarItemsForModal(undefined);
    expect(fullItems.some((i) => i.id === 'gradebook')).toBe(true);

    render(
      <SidebarConfigModal
        isOpen={true}
        onClose={mockOnClose}
        courseId={mockCourseId}
        currentConfig={{ items: fullItems, studentVisibility: {} }}
        onConfigUpdated={mockOnConfigUpdated}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Customize Course Sidebar')).toBeInTheDocument();
    });

    expect(screen.queryByText('Gradebook')).not.toBeInTheDocument();
  });
});







