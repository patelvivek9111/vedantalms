import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import RichTextEditor from '../RichTextEditor';

// Mock TinyMCE Editor
vi.mock('@tinymce/tinymce-react', () => ({
  Editor: ({ value, onEditorChange, init, ...props }: any) => (
    <div data-testid="tinymce-editor" {...props}>
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

