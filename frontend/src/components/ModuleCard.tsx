import React, { useState, useEffect } from 'react';
import { Module, useModule } from '../contexts/ModuleContext';
import PageViewer from './PageViewer';
import { useAuth } from '../context/AuthContext';
import { ChevronDown, ChevronRight, FileText, Plus, ClipboardList, Trash2, Lock, Unlock, Pencil } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CreatePageForm from './CreatePageForm';
import axios from 'axios';
import { API_URL } from '../config';

// Vite env type for TypeScript
interface ImportMeta {
  env: {
    VITE_API_URL?: string;
    [key: string]: any;
  };
}

interface ModuleCardProps {
  module: Module & { published?: boolean };
  onAddPage: (moduleId: string) => void;
}

// Discussion icon SVG component
const DiscussionIcon = () => (
  <svg className="h-5 w-5 text-blue-400 group-hover:text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M7 8h10M7 12h6m-6 4h8M5 20l1.5-4.5M19 20l-1.5-4.5M12 4a8 8 0 100 16 8 8 0 000-16z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ModuleCard: React.FC<ModuleCardProps> = ({ module, onAddPage }) => {
  const [searchParams] = useSearchParams();
  const expandModuleId = searchParams.get('expand');
  const [isExpanded, setIsExpanded] = useState(expandModuleId === module._id);
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [pages, setPages] = useState<any[]>([]);
  const [isLoadingPages, setIsLoadingPages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { getPages, deleteModule, toggleModulePublish } = useModule();
  const navigate = useNavigate();
  const [showCreatePageForm, setShowCreatePageForm] = useState(false);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [assignmentPublishing, setAssignmentPublishing] = useState<string | null>(null);
  const [assignmentPublished, setAssignmentPublished] = useState<{ [id: string]: boolean }>({});
  const [discussions, setDiscussions] = useState<any[]>([]);
  const [isLoadingDiscussions, setIsLoadingDiscussions] = useState(false);
  const [discussionsError, setDiscussionsError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPages = async () => {
      if (isExpanded) {
        setIsLoadingPages(true);
        setError(null);
        try {
          const fetchedPages = await getPages(module._id);
          setPages(fetchedPages);
        } catch (err) {
          console.error('Error fetching pages:', err);
          setError('Failed to load pages');
        } finally {
          setIsLoadingPages(false);
        }
      }
    };

    fetchPages();
  }, [isExpanded, module._id, getPages]);

  useEffect(() => {
    const fetchAssignments = async () => {
      if (isExpanded) {
        setIsLoadingAssignments(true);
        setAssignmentsError(null);
        try {
          const token = localStorage.getItem('token');
          const res = await axios.get(`${API_URL}/api/assignments/module/${module._id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          setAssignments(res.data);
        } catch (err) {
          console.error('Assignments fetch error:', err);
          setAssignmentsError('Failed to load assignments');
        } finally {
          setIsLoadingAssignments(false);
        }
      }
    };
    fetchAssignments();
  }, [isExpanded, module._id]);

  useEffect(() => {
    const fetchDiscussions = async () => {
      if (isExpanded) {
        setIsLoadingDiscussions(true);
        setDiscussionsError(null);
        try {
          const token = localStorage.getItem('token');
          const res = await axios.get(`${API_URL}/api/threads/module/${module._id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const discussions = res.data.data || res.data || [];
          setDiscussions(discussions);
        } catch (err) {
          console.error('Discussions fetch error:', err);
          setDiscussionsError('Failed to load discussions');
        } finally {
          setIsLoadingDiscussions(false);
        }
      }
    };
    fetchDiscussions();
  }, [isExpanded, module._id]);

  const handleModuleClick = () => {
    setIsExpanded(!isExpanded);
  };

  const handlePageClick = (e: React.MouseEvent, pageId: string) => {
    e.stopPropagation();
    navigate(`/pages/${pageId}`);
  };

  const handleAddPageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowCreatePageForm(true);
    // Ensure module is expanded when adding a page
    if (!isExpanded) {
      setIsExpanded(true);
    }
  };

  const handlePageCreated = async () => {
    setShowCreatePageForm(false);
    await getPages(module._id);
  };

  const handleTogglePublish = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPublishing(true);
    try {
      await toggleModulePublish(module._id);
    } catch (err) {
      console.error('Error toggling publish:', err);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleToggleAssignmentPublish = async (assignment: any) => {
    setAssignmentPublishing(assignment._id);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.patch(
        `${API_URL}/api/assignments/${assignment._id}/publish`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAssignmentPublished(prev => ({ ...prev, [assignment._id]: res.data.published }));
    } catch (err) {
      console.error('Error toggling assignment publish:', err);
    } finally {
      setAssignmentPublishing(null);
    }
  };

  const handleDeletePage = async (pageId: string) => {
    if (window.confirm('Are you sure you want to delete this page?')) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`${API_URL}/api/pages/${pageId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPages(pages.filter((p) => p._id !== pageId));
      } catch (err) {
        alert('Error deleting page');
      }
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (window.confirm('Are you sure you want to delete this assignment?')) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`${API_URL}/api/assignments/${assignmentId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAssignments(assignments.filter((a) => a._id !== assignmentId));
      } catch (err) {
        alert('Error deleting assignment');
      }
    }
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mb-4">
      <div 
        className="p-4 bg-white dark:bg-gray-900 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-between"
        onClick={handleModuleClick}
      >
        <div className="flex items-center space-x-2">
          {isExpanded ? <ChevronDown className="h-5 w-5 text-gray-900 dark:text-gray-100" /> : <ChevronRight className="h-5 w-5 text-gray-900 dark:text-gray-100" />}
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{module.title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {(user?.role === 'teacher' || user?.role === 'admin') && (
            <>
              <button
                onClick={handleTogglePublish}
                className={`p-1 rounded ${module.published ? 'text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                title={module.published ? 'Unpublish Module (lock)' : 'Publish Module (unlock)'}
                disabled={isPublishing}
              >
                {module.published ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
              </button>
              <button
                onClick={handleAddPageClick}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-gray-900 dark:text-gray-100"
              >
                <Plus className="h-5 w-5" />
              </button>
              <button
                onClick={e => {
                  e.stopPropagation();
                  navigate(`/modules/${module._id}/edit`);
                }}
                className="p-1 hover:bg-yellow-100 dark:hover:bg-yellow-900/50 rounded text-yellow-600 dark:text-yellow-400"
                title="Edit Module"
              >
                <Pencil className="h-5 w-5" />
              </button>
              <button
                onClick={e => {
                  e.stopPropagation();
                  if (window.confirm('Are you sure you want to delete this module? This will remove all its pages and assignments.')) {
                    deleteModule(module._id, module.course);
                  }
                }}
                className="p-1 hover:bg-red-100 dark:hover:bg-red-900/50 rounded text-red-600 dark:text-red-400"
                title="Delete Module"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          {showCreatePageForm && (
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <CreatePageForm
                modules={[module]}
                courseId={module.course}
                onSuccess={handlePageCreated}
                onCancel={() => setShowCreatePageForm(false)}
              />
            </div>
          )}
          
          {isLoadingPages ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">Loading pages...</div>
          ) : error ? (
            <div className="p-4 text-center text-red-500 dark:text-red-400">{error}</div>
          ) : pages.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">No pages available</div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {pages.map((page) => (
                <div
                  key={page._id}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 flex justify-between items-center group"
                  onClick={(e) => handlePageClick(e, page._id)}
                >
                  <div className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-gray-400 dark:text-gray-500 group-hover:text-blue-500 dark:group-hover:text-blue-400" />
                    <span className={
                      page._id === selectedPage
                        ? 'text-blue-600 dark:text-blue-400 font-semibold'
                        : 'text-gray-500 dark:text-gray-300'
                    }>{page.title}</span>
                  </div>
                  {(user?.role === 'teacher' || user?.role === 'admin') && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          navigate(`/pages/${page._id}/edit`);
                        }}
                        className="p-1 hover:bg-yellow-100 dark:hover:bg-yellow-900/50 rounded text-yellow-600 dark:text-yellow-400"
                        title="Edit Page"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleDeletePage(page._id);
                        }}
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900/50 rounded text-red-600 dark:text-red-400"
                        title="Delete Page"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {isLoadingAssignments ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400">Loading assignments...</div>
              ) : assignmentsError ? (
                <div className="p-4 text-center text-red-500 dark:text-red-400">{assignmentsError}</div>
              ) : assignments.length === 0 ? null : (
                assignments.map(a => (
                  <div
                    key={a._id}
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 flex justify-between items-center group"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/assignments/${a._id}/view`);
                    }}
                  >
                    <div className="flex items-center space-x-2">
                      <ClipboardList className="h-5 w-5 text-green-400 dark:text-green-500 group-hover:text-green-600 dark:group-hover:text-green-400" />
                      <span className="group-hover:text-green-600 dark:group-hover:text-green-400 text-gray-900 dark:text-gray-100">{a.title}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        ({a.isOfflineAssignment && a.totalPoints 
                          ? a.totalPoints 
                          : (a.questions ? a.questions.reduce((sum: number, q: any) => sum + (q.points || 0), 0) : (a.totalPoints || 0))} pts)
                      </span>
                    </div>
                    {(user?.role === 'teacher' || user?.role === 'admin') && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleToggleAssignmentPublish(a);
                          }}
                          className={`p-1 rounded ${
                            (assignmentPublished[a._id] ?? a.published)
                              ? 'text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50'
                              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                          title={
                            (assignmentPublished[a._id] ?? a.published)
                              ? 'Unpublish Assignment (lock)'
                              : 'Publish Assignment (unlock)'
                          }
                          disabled={assignmentPublishing === a._id}
                        >
                          {(assignmentPublished[a._id] ?? a.published)
                            ? <Unlock className="h-5 w-5" />
                            : <Lock className="h-5 w-5" />}
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            navigate(`/assignments/${a._id}/edit`);
                          }}
                          className="p-1 hover:bg-yellow-100 dark:hover:bg-yellow-900/50 rounded text-yellow-600 dark:text-yellow-400"
                          title="Edit Assignment"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleDeleteAssignment(a._id);
                          }}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/50 rounded text-red-600 dark:text-red-400"
                          title="Delete Assignment"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
          
          {/* Discussions Section - Moved outside assignments conditional */}
          {isLoadingDiscussions ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">Loading discussions...</div>
          ) : discussionsError ? (
            <div className="p-4 text-center text-red-500 dark:text-red-400">{discussionsError}</div>
          ) : discussions.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">No discussions available</div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {discussions.map(d => (
                <div
                  key={d._id}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 flex justify-between items-center group"
                  onClick={e => {
                    e.stopPropagation();
                    navigate(`/courses/${d.course}/threads/${d._id}`);
                  }}
                >
                  <div className="flex items-center space-x-2">
                    <DiscussionIcon />
                    <span className="group-hover:text-blue-600 dark:group-hover:text-blue-400 text-gray-900 dark:text-gray-100">{d.title}</span>
                    {d.totalPoints ? (
                      <span className="text-xs text-gray-500 dark:text-gray-400">({d.totalPoints} pts)</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedPage && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          <PageViewer pageId={selectedPage} />
        </div>
      )}
    </div>
  );
};

export default ModuleCard; 