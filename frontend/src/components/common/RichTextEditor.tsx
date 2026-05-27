import React from 'react';
import { Editor } from '@tinymce/tinymce-react';

interface RichTextEditorProps {
  content: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  height?: number;
  id?: string;
}

const base = import.meta.env.BASE_URL ?? '/';
const courseHtmlSharedCss = `${base.endsWith('/') ? base : `${base}/`}course-html-shared.css`;

const RichTextEditor: React.FC<RichTextEditorProps> = ({ content, onChange, placeholder, className, height, id }) => {
  if (typeof window !== 'undefined' && window.localStorage.getItem('lms:e2e:plain-editor') === '1') {
    return (
      <textarea
        id={id}
        aria-label={placeholder || 'Discussion rich text editor'}
        value={content}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder || 'Write something...'}
        className={`w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 ${className || ''}`}
        style={{ minHeight: height || 160 }}
      />
    );
  }

  return (
    <Editor
      apiKey="gdng5aigkhrb5lsxhh4j8u2s4elts687j9k2uzu63l6zd4gw"
      value={content}
      onEditorChange={onChange}
      id={id}
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
        content_css: [courseHtmlSharedCss],
        content_style: 'body { margin: 8px; }'
      }}
      textareaName="content"
      className={className}
    />
  );
};

export default RichTextEditor;
