import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreatePageForm from '../CreatePageForm';
import { useModule } from '../../contexts/ModuleContext';
import api from '../../services/api';

// Mock dependencies
vi.mock('../../contexts/ModuleContext', () => ({
  useModule: vi.fn(),
}));

vi.mock('../../services/api', () => ({
  default: {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    get: vi.fn(),
  },
}));

vi.mock('../RichTextEditor', () => ({
  default: ({ content, onChange }: any) => (
    <textarea
      data-testid="rich-text-editor"
      value={content}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock('../../utils/logger', () => ({
  default: {
    error: vi.fn(),
  },
}));

const mockedUseModule = useModule as any;
const mockedApi = api as any;

describe('CreatePageForm', () => {
  const mockOnSuccess = vi.fn();
  const mockOnCancel = vi.fn();
  const mockCreatePage = vi.fn();
  const mockModules = [
    { _id: 'module1', title: 'Module 1' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseModule.mockReturnValue({
      createPage: mockCreatePage,
    });
    mockedApi.get.mockResolvedValue({
      data: [],
    });
  });

  it('should render form', () => {
    render(
      <CreatePageForm
        modules={mockModules}
        courseId="course1"
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByPlaceholderText(/page title/i)).toBeInTheDocument();
  });

  it('should create page', async () => {
    mockCreatePage.mockResolvedValue({});

    render(
      <CreatePageForm
        modules={mockModules}
        courseId="course1"
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const titleInput = screen.getByPlaceholderText(/page title/i);
    fireEvent.change(titleInput, { target: { value: 'New Page' } });

    const moduleSelect = screen.getByLabelText(/module/i);
    fireEvent.change(moduleSelect, { target: { value: 'module1' } });

    const submitButton = screen.getByText(/create page/i);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreatePage).toHaveBeenCalled();
    });
  });

  it('should validate required fields', async () => {
    render(
      <CreatePageForm
        modules={mockModules}
        courseId="course1"
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const submitButton = screen.getByText(/create page/i);
    fireEvent.click(submitButton);

    // Should not submit without title and module
    expect(mockCreatePage).not.toHaveBeenCalled();
  });

  it('should cancel form', () => {
    render(
      <CreatePageForm
        modules={mockModules}
        courseId="course1"
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByText(/cancel/i);
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should fetch group sets', async () => {
    const mockGroupSets = [
      { _id: 'groupset1', name: 'Group Set 1' },
    ];
    mockedApi.get.mockResolvedValue({
      data: mockGroupSets,
    });

    render(
      <CreatePageForm
        modules={mockModules}
        courseId="course1"
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/groups/sets/course1');
    });
  });
});

