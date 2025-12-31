import React from 'react';
import { Editor } from '@tinymce/tinymce-react';

interface RichTextEditorProps {
  content: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  height?: number;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ content, onChange, placeholder, className, height }) => {
  return (
    <Editor
      apiKey="gdng5aigkhrb5lsxhh4j8u2s4elts687j9k2uzu63l6zd4gw"
      value={content}
      onEditorChange={onChange}
      init={{
        height: height || 200,
        menubar: false,
        plugins: [
          'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview', 'anchor',
          'searchreplace', 'visualblocks', 'code', 'fullscreen',
          'insertdatetime', 'media', 'table', 'help', 'wordcount'
        ],
        toolbar: 'undo redo | formatselect | bold italic underline backcolor | \
          alignleft aligncenter alignright alignjustify | \
          bullist numlist outdent indent | removeformat | help',
        placeholder: placeholder || 'Write something...',
        content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }'
      }}
      textareaName="content"
      className={className}
    />
  );
};

export default RichTextEditor;
