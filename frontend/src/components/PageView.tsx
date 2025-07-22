import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useModule } from '../contexts/ModuleContext';
import ReactMarkdown from 'react-markdown';

const PageView: React.FC = () => {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const { getPage } = useModule();
  const [page, setPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPage = async () => {
      if (!pageId) return;
      
      try {
        setLoading(true);
        const pageData = await getPage(pageId);
        if (!pageData) {
          throw new Error('Page not found');
        }
        setPage(pageData);
      } catch (err) {
        console.error('Error fetching page:', err);
        setError('Failed to load page');
      } finally {
        setLoading(false);
      }
    };

    fetchPage();
  }, [pageId, getPage]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-red-500 mb-4">{error}</div>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-gray-500 mb-4">Page not found</div>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">{page.title}</h1>
        <div className="prose max-w-none">
          <ReactMarkdown>{page.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

export default PageView; 