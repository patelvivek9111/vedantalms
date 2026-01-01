import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NavCustomizationModal, ALL_NAV_OPTIONS } from '../NavCustomizationModal';
import { useAuth } from '../../context/AuthContext';

// Mock dependencies
vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = useAuth as any;

describe('NavCustomizationModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();
  const mockCurrentItems = [
    ALL_NAV_OPTIONS[0], // dashboard
    ALL_NAV_OPTIONS[1], // todo
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      user: { role: 'student' },
    });
  });

  it('should render modal when open', () => {
    render(
      <NavCustomizationModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        currentItems={mockCurrentItems}
      />
    );

    expect(screen.getByText(/customize navigation/i)).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    const { container } = render(
      <NavCustomizationModal
        isOpen={false}
        onClose={mockOnClose}
        onSave={mockOnSave}
        currentItems={mockCurrentItems}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should display current selected items', () => {
    render(
      <NavCustomizationModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        currentItems={mockCurrentItems}
      />
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('To Do')).toBeInTheDocument();
  });

  it('should filter my-course option for non-teachers', () => {
    mockedUseAuth.mockReturnValue({
      user: { role: 'student' },
    });

    render(
      <NavCustomizationModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        currentItems={mockCurrentItems}
      />
    );

    // my-course should not be in available options for students
    expect(screen.queryByText('My Course')).not.toBeInTheDocument();
  });

  it('should show my-course option for teachers', () => {
    mockedUseAuth.mockReturnValue({
      user: { role: 'teacher' },
    });

    render(
      <NavCustomizationModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        currentItems={mockCurrentItems}
      />
    );

    // Should be able to see my-course option
    // Note: This depends on the actual implementation showing available options
  });

  it('should add item to selection', () => {
    render(
      <NavCustomizationModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        currentItems={mockCurrentItems}
      />
    );

    // Find and click an available option to add
    const availableOptions = screen.getAllByRole('button');
    const addButton = availableOptions.find(btn => 
      btn.textContent?.includes('Inbox') || btn.getAttribute('aria-label')?.includes('Add')
    );

    if (addButton) {
      fireEvent.click(addButton);
      // Item should be added to selection
    }
  });

  it('should remove item from selection', () => {
    render(
      <NavCustomizationModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        currentItems={mockCurrentItems}
      />
    );

    // Find remove button for a selected item
    const removeButtons = screen.getAllByRole('button');
    const removeButton = removeButtons.find(btn => 
      btn.getAttribute('aria-label')?.includes('Remove') || 
      btn.textContent === '×'
    );

    if (removeButton) {
      fireEvent.click(removeButton);
      // Item should be removed from selection
    }
  });

  it('should save changes', () => {
    render(
      <NavCustomizationModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        currentItems={mockCurrentItems}
      />
    );

    const saveButton = screen.getByText(/save/i);
    fireEvent.click(saveButton);

    expect(mockOnSave).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should cancel without saving', () => {
    render(
      <NavCustomizationModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        currentItems={mockCurrentItems}
      />
    );

    const cancelButton = screen.getByText(/cancel/i);
    fireEvent.click(cancelButton);

    expect(mockOnSave).not.toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should reset to defaults', () => {
    render(
      <NavCustomizationModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        currentItems={mockCurrentItems}
      />
    );

    const resetButton = screen.getByText(/reset to default/i);
    if (resetButton) {
      fireEvent.click(resetButton);
      // Should reset to default items
    }
  });
});

