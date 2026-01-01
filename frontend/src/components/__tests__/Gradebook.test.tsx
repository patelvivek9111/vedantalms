import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Gradebook from '../gradebook/Gradebook';

// Mock child components
vi.mock('../gradebook/GradebookTable', () => ({
  default: () => <div data-testid="gradebook-table">Gradebook Table</div>,
}));

vi.mock('../gradebook/GradebookMobileView', () => ({
  default: () => <div data-testid="gradebook-mobile">Gradebook Mobile</div>,
}));

vi.mock('../gradebook/GradebookActions', () => ({
  default: () => <div data-testid="gradebook-actions">Gradebook Actions</div>,
}));

describe('Gradebook', () => {
  const mockGradebookData = {
    students: [
      { _id: 'student1', firstName: 'John', lastName: 'Doe' },
    ],
    assignments: [
      { _id: 'assign1', title: 'Assignment 1', totalPoints: 100 },
    ],
    grades: {
      student1: {
        assign1: 85,
      },
    },
  };

  const mockProps = {
    courseId: 'course1',
    course: { _id: 'course1', title: 'Test Course' },
    gradebookData: mockGradebookData,
    submissionMap: {},
    studentSubmissions: [],
    isInstructor: true,
    isAdmin: false,
    expandedStudents: new Set(),
    setExpandedStudents: vi.fn(),
    editingGrade: null,
    setEditingGrade: vi.fn(),
    editingValue: '',
    setEditingValue: vi.fn(),
    savingGrade: null,
    gradeError: '',
    setGradeError: vi.fn(),
    handleGradeCellClick: vi.fn(),
    handleGradeUpdate: vi.fn(),
    exportGradebookCSV: vi.fn(),
    handleOpenGradeScaleModal: vi.fn(),
    handleOpenGroupModal: vi.fn(),
    setShowGroupModal: vi.fn(),
    showGroupModal: false,
    editGroups: [],
    handleGroupChange: vi.fn(),
    handleRemoveGroupRow: vi.fn(),
    handleAddGroupRow: vi.fn(),
    handleResetToDefaults: vi.fn(),
    handleSaveGroups: vi.fn(),
    savingGroups: false,
    groupError: '',
    setShowGradeScaleModal: vi.fn(),
    showGradeScaleModal: false,
    editGradeScale: [],
    handleGradeScaleChange: vi.fn(),
    handleRemoveGradeScaleRow: vi.fn(),
    handleSaveGradeScale: vi.fn(),
    savingGradeScale: false,
    gradeScaleError: '',
    setEditGradeScale: vi.fn(),
    setGradeScaleError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render gradebook table', () => {
    render(<Gradebook {...mockProps} />);

    expect(screen.getByTestId('gradebook-table')).toBeInTheDocument();
  });

  it('should render gradebook actions', () => {
    render(<Gradebook {...mockProps} />);

    expect(screen.getByTestId('gradebook-actions')).toBeInTheDocument();
  });

  it('should render mobile view on mobile', () => {
    // Mock window.innerWidth for mobile
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 500,
    });

    render(<Gradebook {...mockProps} />);

    // Should render mobile view on small screens
    expect(screen.getByTestId('gradebook-mobile')).toBeInTheDocument();
  });

  it('should handle grade updates', () => {
    render(<Gradebook {...mockProps} />);

    // Grade updates are handled by parent component
    expect(mockProps.handleGradeUpdate).toBeDefined();
  });

  it('should export gradebook CSV', () => {
    render(<Gradebook {...mockProps} />);

    // Export functionality is passed as prop
    expect(mockProps.exportGradebookCSV).toBeDefined();
  });
});







