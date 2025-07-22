import React, { useState, useEffect } from 'react';
import CreatePageForm from './CreatePageForm';
import { ModuleProvider } from '../contexts/ModuleContext';
import { API_URL } from '../config';
import axios from 'axios';
import { Link } from 'react-router-dom';

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
  const [selectedModule, setSelectedModule] = useState<string>('');

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
    <div className="flex justify-center items-start py-8">
      <div className="w-full max-w-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-0">
        <div className="flex justify-between items-center px-8 pt-8 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Pages</h2>
            <p className="text-gray-500 dark:text-gray-300 mt-1">All pages for this course</p>
          </div>
          {(isInstructor || isAdmin) && modules.length > 0 && (
            <div className="relative">
              <button
                onClick={handleCreateClick}
                className="px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow transition-colors text-base"
              >
                + Page
              </button>
              {showCreate && (
                <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-10 p-4">
                  <ModuleProvider>
                    <CreatePageForm
                      modules={modules}
                      courseId={courseId}
                      onSuccess={handleCreateSuccess}
                      onCancel={() => setShowCreate(false)}
                    />
                  </ModuleProvider>
                </div>
              )}
            </div>
          )}
        </div>
        {loading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading pages...</div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">{error}</div>
        ) : pages.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">No pages available for this course.</div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {pages.map(page => (
              <li
                key={page._id}
                className="flex items-center px-8 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition group cursor-pointer"
              >
                <span className="mr-4 text-gray-400 group-hover:text-blue-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 8h8M8 12h8M8 16h4" />
                  </svg>
                </span>
                <Link
                  to={`/courses/${courseId}/pages/${page._id}`}
                  className="font-medium text-blue-700 dark:text-blue-400 group-hover:underline text-lg truncate"
                >
                  {page.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default CoursePages; 