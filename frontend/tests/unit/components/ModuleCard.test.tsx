import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import ModuleCard from '@/components/modules/ModuleCard';
import { useModule } from '@/contexts/ModuleContext';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';

// Mock dependencies
vi.mock('@/contexts/ModuleContext', () => ({
  useModule: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    create: vi.fn(() => ({
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
  },
}));
vi.mock('@/config', () => ({
  API_URL: 'http://localhost:5000',
}));

vi.mock('@/utils/logger', () => ({
  default: {
    error: vi.fn(),
  },
}));

// Mock window.confirm
window.confirm = vi.fn(() => true);

const mockedUseModule = useModule as any;
const mockedUseAuth = useAuth as any;
const mockedAxios = axios as any;

describe('ModuleCard', () => {
  const mockModule = {
    _id: 'module1',
    title: 'Test Module',
    course: 'course1',
    published: true,
  };

  const mockGetPages = vi.fn();
  const mockDeleteModule = vi.fn();
  const mockToggleModulePublish = vi.fn();
  const mockOnAddPage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'test-token');
    mockedUseModule.mockReturnValue({
      getPages: mockGetPages,
      deleteModule: mockDeleteModule,
      toggleModulePublish: mockToggleModulePublish,
    });
    mockedUseAuth.mockReturnValue({
      user: { _id: 'user1', role: 'teacher' },
    });
  });

  it('should render module title', () => {
    render(
      <BrowserRouter>
        <ModuleCard module={mockModule} onAddPage={mockOnAddPage} />
      </BrowserRouter>
    );

    expect(screen.getByText('Test Module')).toBeInTheDocument();
  });

  it('should expand module on click', async () => {
    mockGetPages.mockResolvedValue([]);
    mockedAxios.get.mockResolvedValue({ data: [] });

    render(
      <BrowserRouter>
        <ModuleCard module={mockModule} onAddPage={mockOnAddPage} />
      </BrowserRouter>
    );

    const moduleHeader = screen.getByText('Test Module').closest('div');
    if (moduleHeader) {
      fireEvent.click(moduleHeader);
      
      await waitFor(() => {
        expect(mockGetPages).toHaveBeenCalled();
      });
    }
  });

  it('should fetch pages when expanded', async () => {
    const mockPages = [
      { _id: 'page1', title: 'Page 1' },
    ];
    mockGetPages.mockResolvedValue(mockPages);
    mockedAxios.get.mockResolvedValue({ data: [] });

    render(
      <BrowserRouter>
        <ModuleCard module={mockModule} onAddPage={mockOnAddPage} />
      </BrowserRouter>
    );

    const moduleHeader = screen.getByText('Test Module').closest('div');
    if (moduleHeader) {
      fireEvent.click(moduleHeader);
      
      await waitFor(() => {
        expect(screen.getByText('Page 1')).toBeInTheDocument();
      });
    }
  });

  it('should toggle publish for instructors', async () => {
    mockToggleModulePublish.mockResolvedValue({});
    mockGetPages.mockResolvedValue([]);
    mockedAxios.get.mockResolvedValue({ data: [] });

    render(
      <BrowserRouter>
        <ModuleCard module={mockModule} onAddPage={mockOnAddPage} />
      </BrowserRouter>
    );

    const moduleHeader = screen.getByText('Test Module').closest('div');
    if (moduleHeader) {
      fireEvent.click(moduleHeader);
    }

    await waitFor(() => {
      const publishButton = screen.getByTitle(/publish module/i);
      if (publishButton) {
        fireEvent.click(publishButton);
        expect(mockToggleModulePublish).toHaveBeenCalled();
      }
    });
  });

  it('should show add page button for instructors', async () => {
    mockGetPages.mockResolvedValue([]);
    mockedAxios.get.mockResolvedValue({ data: [] });

    render(
      <BrowserRouter>
        <ModuleCard module={mockModule} onAddPage={mockOnAddPage} />
      </BrowserRouter>
    );

    const moduleHeader = screen.getByText('Test Module').closest('div');
    if (moduleHeader) {
      fireEvent.click(moduleHeader);
    }

    await waitFor(() => {
      const addButton = screen.getByTitle('Add Content');
      expect(addButton).toBeInTheDocument();
    });
  });

  it('should delete module', async () => {
    mockGetPages.mockResolvedValue([]);
    mockedAxios.get.mockResolvedValue({ data: [] });

    render(
      <BrowserRouter>
        <ModuleCard module={mockModule} onAddPage={mockOnAddPage} />
      </BrowserRouter>
    );

    const deleteButton = screen.getByTitle('Delete Module');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      const confirmDeleteButton = screen.getByRole('button', { name: 'Delete' });
      fireEvent.click(confirmDeleteButton);
    });

    await waitFor(() => {
      expect(mockDeleteModule).toHaveBeenCalledWith('module1', 'course1');
    });
  });

  it('should fetch assignments when expanded', async () => {
    const mockAssignments = [
      { _id: 'assign1', title: 'Assignment 1' },
    ];
    mockGetPages.mockResolvedValue([]);
    mockedAxios.get.mockResolvedValue({ data: mockAssignments });

    render(
      <BrowserRouter>
        <ModuleCard module={mockModule} onAddPage={mockOnAddPage} />
      </BrowserRouter>
    );

    const moduleHeader = screen.getByText('Test Module').closest('div');
    if (moduleHeader) {
      fireEvent.click(moduleHeader);
      
      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalled();
      });
    }
  });

  it('should not show edit buttons for students', () => {
    mockedUseAuth.mockReturnValue({
      user: { _id: 'user1', role: 'student' },
    });

    render(
      <BrowserRouter>
        <ModuleCard module={mockModule} onAddPage={mockOnAddPage} />
      </BrowserRouter>
    );

    expect(screen.queryByTitle('Add Content')).not.toBeInTheDocument();
  });
});







