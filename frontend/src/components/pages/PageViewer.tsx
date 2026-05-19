import React, { useEffect, useState } from 'react';
import { useModule, Page } from '../../contexts/ModuleContext';
import { coursePageBodyHtmlClass, sanitizePageHtml } from './PageView';

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
    <div className="rounded-lg border border-slate-200 bg-white p-3 sm:p-4 dark:border-slate-600 dark:bg-slate-900/40">
      <h4 className="mb-2 break-words text-base font-normal tracking-tight text-slate-400 dark:text-slate-500 sm:text-lg">
        {page.title}
      </h4>
      <div className="mb-2 border-b border-slate-100 dark:border-slate-700" role="presentation" />
      <div className={coursePageBodyHtmlClass} dangerouslySetInnerHTML={{ __html: sanitizePageHtml(page.content || '') }} />
      {page.attachments && page.attachments.length > 0 && (
        <div className="mt-2 sm:mt-3">
          <div className="font-semibold text-xs sm:text-sm mb-1 text-gray-900 dark:text-gray-100">Attachments:</div>
          <ul className="list-disc ml-4 sm:ml-5 space-y-1">
            {page.attachments.map((url, idx) => (
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