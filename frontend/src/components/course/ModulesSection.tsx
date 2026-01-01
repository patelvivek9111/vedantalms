import React from 'react';
import { ModuleProvider } from '../../contexts/ModuleContext';
import ModuleList from '../ModuleList';

interface ModulesSectionProps {
  courseId: string;
}

const ModulesSection: React.FC<ModulesSectionProps> = ({ courseId }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Course Modules</h2>
        <ModuleProvider>
          <ModuleList courseId={courseId} />
        </ModuleProvider>
      </div>
    </div>
  );
};

export default ModulesSection;

