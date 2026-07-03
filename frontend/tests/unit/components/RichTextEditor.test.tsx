import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import RichTextEditor from '@/components/common/RichTextEditor';

// Mock TinyMCE Editor
vi.mock('@tinymce/tinymce-react', () => ({
  Editor: ({ value, onEditorChange, init, className, id }: any) => (
    <div data-testid="tinymce-editor" className={className} id={id}>
      <textarea
        data-testid="editor-textarea"
        value={value}
        onChange={(e) => onEditorChange(e.target.value)}
        placeholder={init?.placeholder}
      />
    </div>
  ),
}));

describe('RichTextEditor', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // The component renders the TinyMCE editor only when an API key is configured;
    // otherwise it falls back to a plain textarea. Stub the key so these tests
    // exercise the TinyMCE integration path they are written for.
    vi.stubEnv('VITE_TINYMCE_API_KEY', 'test-api-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should render editor with content', () => {
    const { getByTestId } = render(
      <RichTextEditor content="Test content" onChange={mockOnChange} />
    );

    const editor = getByTestId('tinymce-editor');
    expect(editor).toBeInTheDocument();
  });

  it('should call onChange when content changes', () => {
    const { getByTestId } = render(
      <RichTextEditor content="" onChange={mockOnChange} />
    );

    const textarea = getByTestId('editor-textarea');
    fireEvent.change(textarea, { target: { value: 'New content' } });

    expect(mockOnChange).toHaveBeenCalledWith('New content');
  });

  it('should apply custom placeholder', () => {
    const { getByTestId } = render(
      <RichTextEditor
        content=""
        onChange={mockOnChange}
        placeholder="Enter text here"
      />
    );

    const textarea = getByTestId('editor-textarea');
    expect(textarea).toHaveAttribute('placeholder', 'Enter text here');
  });

  it('should apply custom className', () => {
    const { getByTestId } = render(
      <RichTextEditor
        content=""
        onChange={mockOnChange}
        className="custom-class"
      />
    );

    const editor = getByTestId('tinymce-editor');
    expect(editor).toHaveClass('custom-class');
  });

  it('should use default placeholder when not provided', () => {
    const { getByTestId } = render(
      <RichTextEditor content="" onChange={mockOnChange} />
    );

    const textarea = getByTestId('editor-textarea');
    expect(textarea).toHaveAttribute('placeholder', 'Write something...');
  });

  it('should apply custom id and name', () => {
    const { getByTestId } = render(
      <RichTextEditor
        content=""
        onChange={mockOnChange}
        id="custom-id"
        name="custom-name"
      />
    );

    const editor = getByTestId('tinymce-editor');
    expect(editor).toHaveAttribute('id', 'custom-id');
  });

  it('should render with default props', () => {
    const { getByTestId } = render(
      <RichTextEditor content="" onChange={mockOnChange} />
    );

    const editor = getByTestId('tinymce-editor');
    expect(editor).toBeInTheDocument();
    const textarea = getByTestId('editor-textarea');
    expect(textarea).toBeInTheDocument();
  });
});

