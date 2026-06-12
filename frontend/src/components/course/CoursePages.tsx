import React, { useState, useEffect } from 'react';
import CreatePageForm from '../pages/CreatePageForm';
import { ModuleProvider } from '../../contexts/ModuleContext';
import { API_URL } from '../../config';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { SectionDividerHeading } from '../common/SectionDividerHeading';

interface Module {
  _id: string;
  title: string;
}

interface Page {
  _id: string;
  title: string;
  module: string;
}

interface CoursePagesProps {
  courseId: string;
  modules: Module[];
  isInstructor: boolean;
  isAdmin: boolean;
}

const CoursePages: React.FC<CoursePagesProps> = ({ courseId, modules, isInstructor, isAdmin }) => {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const fetchPages = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/api/pages/course/${courseId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPages(res.data.data || []);
      } catch (err) {
        setError('Failed to load pages');
      } finally {
        setLoading(false);
      }
    };
    if (courseId) fetchPages();
  }, [courseId, showCreate]);

  const handleCreateClick = () => {
    setShowCreate(true);
  };

  const handleCreateSuccess = () => {
    setShowCreate(false);
  };

  return (
    <div className="space-y-4">
      {showCreate ? (
        <ModuleProvider>
          <CreatePageForm
            modules={modules}
            courseId={courseId}
            onSuccess={handleCreateSuccess}
            onCancel={() => setShowCreate(false)}
          />
        </ModuleProvider>
      ) : (
        <>
          {(isInstructor || isAdmin) && modules.length > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">Create and organize pages for this course</p>
              <button
                onClick={handleCreateClick}
                className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                + Add Page
              </button>
            </div>
          )}

          {loading ? (
            <div className="py-8 text-center text-gray-500 dark:text-gray-400">Loading pages...</div>
          ) : error ? (
            <div className="py-8 text-center text-red-500">{error}</div>
          ) : pages.length === 0 ? (
            <div className="py-12 text-center text-gray-500 dark:text-gray-400">No pages available for this course.</div>
          ) : (
            <section aria-labelledby="pages-heading">
              <SectionDividerHeading id="pages-heading">Pages</SectionDividerHeading>
              <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl bg-white ring-1 ring-gray-200/70 dark:divide-gray-800 dark:bg-gray-900 dark:ring-gray-700/60">
              {pages.map(page => (
                <li
                  key={page._id}
                  className="group flex cursor-pointer items-center px-4 py-3.5 transition hover:bg-gray-50 dark:hover:bg-gray-800/60 sm:px-5"
                >
                  <span className="mr-3 flex-shrink-0 text-gray-400 group-hover:text-blue-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 8h8M8 12h8M8 16h4" />
                    </svg>
                  </span>
                  <Link
                    to={`/courses/${courseId}/pages/${page._id}`}
                    className="min-w-0 flex-1 truncate text-base font-medium text-slate-700 group-hover:text-blue-700 dark:text-slate-200 dark:group-hover:text-blue-400"
                  >
                    {page.title}
                  </Link>
                </li>
              ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default CoursePages;
