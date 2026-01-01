import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreateModuleForm from '../CreateModuleForm';
import { useModule } from '../../contexts/ModuleContext';

// Mock dependencies
vi.mock('../../contexts/ModuleContext', () => ({
  useModule: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  default: {
    error: vi.fn(),
  },
}));

const mockedUseModule = useModule as any;

describe('CreateModuleForm', () => {
  const mockOnSuccess = vi.fn();
  const mockOnCancel = vi.fn();
  const mockCreateModule = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseModule.mockReturnValue({
      createModule: mockCreateModule,
    });
  });

  it('should render form', () => {
    render(
      <CreateModuleForm
        courseId="course1"
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByLabelText(/module title/i)).toBeInTheDocument();
  });

  it('should create module', async () => {
    mockCreateModule.mockResolvedValue({});

    render(
      <CreateModuleForm
        courseId="course1"
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const titleInput = screen.getByLabelText(/module title/i);
    fireEvent.change(titleInput, { target: { value: 'New Module' } });

    const submitButton = screen.getByText(/create module/i);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreateModule).toHaveBeenCalledWith('course1', { title: 'New Module' });
    });

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('should validate required fields', async () => {
    render(
      <CreateModuleForm
        courseId="course1"
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const submitButton = screen.getByText(/create module/i);
    fireEvent.click(submitButton);

    // Should not submit without title
    expect(mockCreateModule).not.toHaveBeenCalled();
  });

  it('should cancel form', () => {
    render(
      <CreateModuleForm
        courseId="course1"
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByText(/cancel/i);
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should show loading state', async () => {
    mockCreateModule.mockImplementation(() => new Promise(() => {}));

    render(
      <CreateModuleForm
        courseId="course1"
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const titleInput = screen.getByLabelText(/module title/i);
    fireEvent.change(titleInput, { target: { value: 'New Module' } });

    const submitButton = screen.getByText(/create module/i);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Creating...')).toBeInTheDocument();
    });
  });
});

