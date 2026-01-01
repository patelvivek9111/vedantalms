import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ModuleList from '../ModuleList';
import { useModule } from '../contexts/ModuleContext';
import { useAuth } from '../context/AuthContext';

// Mock dependencies
vi.mock('../contexts/ModuleContext', () => ({
  useModule: vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../ModuleCard', () => ({
  default: ({ module }: any) => <div data-testid="module-card">{module.title}</div>,
}));

vi.mock('../CreateModuleForm', () => ({
  default: ({ onSuccess, onCancel }: any) => (
    <div data-testid="create-module-form">
      <button onClick={onSuccess}>Create</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

vi.mock('../utils/logger', () => ({
  default: {
    error: vi.fn(),
  },
}));

const mockedUseModule = useModule as any;
const mockedUseAuth = useAuth as any;

describe('ModuleList', () => {
  const mockGetModules = vi.fn();
  const mockModules = [
    { _id: 'module1', title: 'Module 1', course: 'course1' },
    { _id: 'module2', title: 'Module 2', course: 'course1' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseModule.mockReturnValue({
      modules: [],
      loading: false,
      error: null,
      getModules: mockGetModules,
    });
    mockedUseAuth.mockReturnValue({
      user: { _id: 'user1', role: 'teacher' },
    });
  });

  it('should fetch modules on mount', async () => {
    mockGetModules.mockResolvedValue(mockModules);
    mockedUseModule.mockReturnValue({
      modules: mockModules,
      loading: false,
      error: null,
      getModules: mockGetModules,
    });

    render(<ModuleList courseId="course1" />);

    await waitFor(() => {
      expect(mockGetModules).toHaveBeenCalledWith('course1');
    });
  });

  it('should show loading state', () => {
    mockedUseModule.mockReturnValue({
      modules: [],
      loading: true,
      error: null,
      getModules: mockGetModules,
    });

    render(<ModuleList courseId="course1" />);

    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('should show error state', () => {
    mockedUseModule.mockReturnValue({
      modules: [],
      loading: false,
      error: 'Failed to load modules',
      getModules: mockGetModules,
    });

    render(<ModuleList courseId="course1" />);

    expect(screen.getByText('Failed to load modules')).toBeInTheDocument();
  });

  it('should show create module button for teachers', () => {
    render(<ModuleList courseId="course1" />);

    expect(screen.getByText('+ Add Module')).toBeInTheDocument();
  });

  it('should show create form when button is clicked', () => {
    render(<ModuleList courseId="course1" />);

    const addButton = screen.getByText('+ Add Module');
    fireEvent.click(addButton);

    expect(screen.getByTestId('create-module-form')).toBeInTheDocument();
  });

  it('should display modules', () => {
    mockedUseModule.mockReturnValue({
      modules: mockModules,
      loading: false,
      error: null,
      getModules: mockGetModules,
    });

    render(<ModuleList courseId="course1" />);

    expect(screen.getByText('Module 1')).toBeInTheDocument();
    expect(screen.getByText('Module 2')).toBeInTheDocument();
  });

  it('should show empty state when no modules', () => {
    render(<ModuleList courseId="course1" />);

    expect(screen.getByText(/no modules available/i)).toBeInTheDocument();
  });

  it('should refresh modules after creation', async () => {
    mockGetModules.mockResolvedValue(mockModules);
    mockedUseModule.mockReturnValue({
      modules: [],
      loading: false,
      error: null,
      getModules: mockGetModules,
    });

    render(<ModuleList courseId="course1" />);

    const addButton = screen.getByText('+ Add Module');
    fireEvent.click(addButton);

    const createButton = screen.getByText('Create');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockGetModules).toHaveBeenCalled();
    });
  });

  it('should not show create button for students', () => {
    mockedUseAuth.mockReturnValue({
      user: { _id: 'user1', role: 'student' },
    });

    render(<ModuleList courseId="course1" />);

    expect(screen.queryByText('+ Add Module')).not.toBeInTheDocument();
  });
});







