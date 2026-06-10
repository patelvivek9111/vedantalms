import React, { useMemo } from 'react';
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

function useIsMobileEditor() {
  return useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 1023px)').matches;
  }, []);
}

const DESKTOP_TOOLBAR =
  'undo redo | formatselect | bold italic underline backcolor | ' +
  'alignleft aligncenter alignright alignjustify | ' +
  'bullist numlist outdent indent | removeformat | help';

const MOBILE_TOOLBAR =
  'bold italic underline | bullist numlist | link | removeformat';

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  content,
  onChange,
  placeholder,
  className,
  height,
  id,
}) => {
  const isMobile = useIsMobileEditor();
  const editorHeight = height ?? (isMobile ? 180 : 200);

  if (typeof window !== 'undefined' && window.localStorage.getItem('lms:e2e:plain-editor') === '1') {
    return (
      <textarea
        id={id}
        aria-label={placeholder || 'Discussion rich text editor'}
        value={content}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder || 'Write something...'}
        className={`w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 ${className || ''}`}
        style={{ minHeight: editorHeight }}
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
        height: editorHeight,
        menubar: false,
        mobile: {
          theme: 'silver',
          plugins: ['lists', 'link'],
          toolbar: MOBILE_TOOLBAR,
        },
        plugins: [
          'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview', 'anchor',
          'searchreplace', 'visualblocks', 'code', 'fullscreen',
          'insertdatetime', 'media', 'table', 'help', 'wordcount',
        ],
        toolbar: isMobile ? MOBILE_TOOLBAR : DESKTOP_TOOLBAR,
        toolbar_mode: isMobile ? 'scrolling' : 'wrap',
        placeholder: placeholder || 'Write something...',
        content_css: [courseHtmlSharedCss],
        content_style: 'body { margin: 8px; font-size: 16px; }',
      }}
      textareaName="content"
      className={className}
    />
  );
};

export default RichTextEditor;
