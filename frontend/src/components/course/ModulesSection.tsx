import React from 'react';
import { ModuleProvider } from '../../contexts/ModuleContext';
import ModuleList from '../modules/ModuleList';

interface ModulesSectionProps {
  courseId: string;
  prefetchedModules?: any[] | null;
}

const ModulesSection: React.FC<ModulesSectionProps> = ({ courseId, prefetchedModules }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
        <ModuleProvider>
          <ModuleList courseId={courseId} prefetchedModules={prefetchedModules} />
        </ModuleProvider>
      </div>
    </div>
  );
};

export default ModulesSection;










