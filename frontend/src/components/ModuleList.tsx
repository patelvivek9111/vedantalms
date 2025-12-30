import React, { useEffect, useRef, useState } from 'react';
import { useModule } from '../contexts/ModuleContext';
import { useAuth } from '../context/AuthContext';
import ModuleCard from './ModuleCard';
import CreateModuleForm from './CreateModuleForm';
import logger from '../utils/logger';

interface ModuleListProps {
  courseId: string;
}

const ModuleList: React.FC<ModuleListProps> = ({ courseId }) => {
  const { modules, loading, error, getModules } = useModule();
  const { user } = useAuth();
  const [showCreateModuleForm, setShowCreateModuleForm] = useState(false);
  const getModulesRef = useRef(getModules);

  // Update ref when getModules changes
  useEffect(() => {
    getModulesRef.current = getModules;
  }, [getModules]);

  useEffect(() => {
    if (courseId) {
      getModulesRef.current(courseId).catch(err => {
        logger.error('Error in ModuleList useEffect', err);
      });
    }
  }, [courseId]);

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
    <div>
      {(user?.role === 'teacher' || user?.role === 'admin') && (
        <div className="mb-6">
          {showCreateModuleForm ? (
            <CreateModuleForm
              courseId={courseId}
              onSuccess={handleModuleCreated}
              onCancel={() => setShowCreateModuleForm(false)}
            />
          ) : (
            <button
              onClick={() => setShowCreateModuleForm(true)}
              className="w-full p-3 sm:p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-700 dark:hover:text-gray-300 active:bg-gray-50 dark:active:bg-gray-800 transition-colors text-sm sm:text-base font-medium touch-manipulation"
            >
              + Add Module
            </button>
          )}
        </div>
      )}

      {modules.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No modules available for this course.</p>
          <p className="text-sm mt-2">Modules will appear here once they are created.</p>
        </div>
      ) : (
        <div className="space-y-4">
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