import React, { useEffect, useRef, useState } from 'react';
import { useModule } from '../../contexts/ModuleContext';
import { useAuth } from '../../contexts/AuthContext';
import ModuleCard from '../modules/ModuleCard';
import CreateModuleForm from '../modules/CreateModuleForm';

interface ModuleListProps {
  courseId: string;
  /** Parent already loaded modules + assignments (avoids duplicate /modules + N assignment calls). */
  prefetchedModules?: any[] | null;
}

const ModuleList: React.FC<ModuleListProps> = ({ courseId, prefetchedModules }) => {
  const { modules, loading, error, getModules, seedModules } = useModule();
  const { user } = useAuth();
  const [showCreateModuleForm, setShowCreateModuleForm] = useState(false);
  const getModulesRef = useRef(getModules);

  // Update ref when getModules changes
  useEffect(() => {
    getModulesRef.current = getModules;
  }, [getModules]);

  const prefetchedKey =
    prefetchedModules && prefetchedModules.length > 0
      ? `${courseId}:${prefetchedModules.map((m: any) => m._id).join(',')}`
      : '';

  useEffect(() => {
    if (!courseId) return;
    if (prefetchedKey) {
      seedModules(prefetchedModules as any);
      return;
    }
    getModulesRef.current(courseId).catch(() => {});
  }, [courseId, prefetchedKey, prefetchedModules, seedModules]);

  const handleModuleCreated = async () => {
    setShowCreateModuleForm(false);
    if (courseId) {
      await getModulesRef.current(courseId);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mb-4">
        <strong className="font-bold">Error: </strong>
        <span className="block sm:inline">{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {(user?.role === 'teacher' || user?.role === 'admin') && (
        <div className="mb-2">
          {showCreateModuleForm ? (
            <CreateModuleForm
              courseId={courseId}
              onSuccess={handleModuleCreated}
              onCancel={() => setShowCreateModuleForm(false)}
            />
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/80 p-3 dark:border-gray-700 dark:bg-gray-800/70">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Create and organize course content by week or topic</p>
              <button
                onClick={() => setShowCreateModuleForm(true)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                + Add Module
              </button>
            </div>
          )}
        </div>
      )}

      {modules.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No modules available for this course.</p>
          <p className="text-sm mt-2">Modules will appear here once they are created.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {modules.map((module) => (
            <ModuleCard
              key={module._id}
              module={module}
              onAddPage={() => {}} // This is now handled within ModuleCard
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ModuleList; 