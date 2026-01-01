import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AnnouncementForm from '../announcements/AnnouncementForm';
import { useAuth } from '../../context/AuthContext';

// Mock dependencies
vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
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

vi.mock('../../config', () => ({
  API_URL: 'http://localhost:5000',
}));

global.fetch = vi.fn();

const mockedUseAuth = useAuth as any;
const mockedFetch = global.fetch as any;

describe('AnnouncementForm', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      token: 'test-token',
    });
    mockedFetch.mockResolvedValue({
      json: async () => [],
    });
  });

  it('should render form fields', () => {
    render(
      <AnnouncementForm onSubmit={mockOnSubmit} />
    );

    expect(screen.getByPlaceholderText('Topic Title')).toBeInTheDocument();
    expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument();
  });

  it('should submit form with data', async () => {
    render(
      <AnnouncementForm onSubmit={mockOnSubmit} />
    );

    const titleInput = screen.getByPlaceholderText('Topic Title');
    const editor = screen.getByTestId('rich-text-editor');
    const submitButton = screen.getByRole('button', { name: /save/i });

    fireEvent.change(titleInput, { target: { value: 'Test Title' } });
    fireEvent.change(editor, { target: { value: 'Test body' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled();
    });
  });

  it('should validate required fields', async () => {
    render(
      <AnnouncementForm onSubmit={mockOnSubmit} />
    );

    const submitButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(submitButton);

    // Form should prevent submission without title (HTML5 validation)
    await waitFor(() => {
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  it('should load initial values', () => {
    const initialValues = {
      title: 'Initial Title',
      body: 'Initial Body',
      postTo: 'groups',
    };

    render(
      <AnnouncementForm
        onSubmit={mockOnSubmit}
        initialValues={initialValues}
      />
    );

    const titleInput = screen.getByPlaceholderText('Topic Title') as HTMLInputElement;
    expect(titleInput.value).toBe('Initial Title');
  });

  it('should handle cancel', () => {
    render(
      <AnnouncementForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByText(/cancel/i);
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should show loading state', () => {
    render(
      <AnnouncementForm
        onSubmit={mockOnSubmit}
        loading={true}
      />
    );

    const submitButton = screen.getByRole('button', { name: /saving/i });
    expect(submitButton).toBeDisabled();
  });

  it('should handle file uploads', async () => {
    render(
      <AnnouncementForm onSubmit={mockOnSubmit} />
    );

    // Now that the label has htmlFor, we can use getByLabelText
    const fileInput = screen.getByLabelText(/^attachments$/i) as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();
    
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(fileInput.files).toHaveLength(1);
  });

  it('should toggle announcement options', () => {
    render(
      <AnnouncementForm onSubmit={mockOnSubmit} />
    );

    const allowCommentsCheckbox = screen.getByLabelText(/allow users to comment/i);
    fireEvent.click(allowCommentsCheckbox);
    expect(allowCommentsCheckbox).toBeChecked();
  });
});

