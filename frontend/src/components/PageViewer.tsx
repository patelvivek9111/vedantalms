import React, { useEffect, useState } from 'react';
import { useModule, Page } from '../contexts/ModuleContext';
import ReactMarkdown from 'react-markdown';

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
    <div className="bg-gray-50 p-4 rounded">
      <h4 className="text-md font-bold mb-2">{page.title}</h4>
      <div className="prose max-w-none mb-2">
        <ReactMarkdown>{page.content}</ReactMarkdown>
      </div>
      {page.attachments && page.attachments.length > 0 && (
        <div className="mt-2">
          <div className="font-semibold text-sm mb-1">Attachments:</div>
          <ul className="list-disc ml-5">
            {page.attachments.map((url, idx) => (
              <li key={idx}>
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
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