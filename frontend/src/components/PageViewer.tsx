import React, { useEffect, useState } from 'react';
import { useModule, Page } from '../contexts/ModuleContext';
import ReactMarkdown from 'react-markdown';
function sanitizeHtml(html: string): string {
  if (!html) return '';
  // Basic sanitization: remove script/style tags and event handlers
  let sanitized = html.replace(/<\/(script|style)>/gi, '</removed>');
  sanitized = sanitized.replace(/<(script|style)[^>]*>[\s\S]*?<\/(script|style)>/gi, '');
  sanitized = sanitized.replace(/ on\w+="[^"]*"/gi, '');
  sanitized = sanitized.replace(/ on\w+='[^']*'/gi, '');
  return sanitized;
}

interface PageViewerProps {
  pageId: string;
}

const PageViewer: React.FC<PageViewerProps> = ({ pageId }) => {
  const { getPage } = useModule();
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getPage(pageId)
      .then(setPage)
      .catch(err => setError('Failed to load page'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line
  }, [pageId]);

  if (loading) return <div className="text-gray-400">Loading page...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (!page) return null;

  return (
    <div className="bg-gray-50 dark:bg-gray-800 p-3 sm:p-4 rounded">
      <h4 className="text-base sm:text-lg font-bold mb-2 text-gray-900 dark:text-gray-100 break-words">{page.title}</h4>
      <div className="prose prose-sm sm:prose-base max-w-none mb-2 dark:prose-invert" dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.content) }} />
      {page.attachments && page.attachments.length > 0 && (
        <div className="mt-2 sm:mt-3">
          <div className="font-semibold text-xs sm:text-sm mb-1 text-gray-900 dark:text-gray-100">Attachments:</div>
          <ul className="list-disc ml-4 sm:ml-5 space-y-1">
            {page.attachments.map((url: string, idx: number) => (
              <li key={idx} className="text-xs sm:text-sm">
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline break-all">
                  {url.split('/').pop()}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PageViewer; 