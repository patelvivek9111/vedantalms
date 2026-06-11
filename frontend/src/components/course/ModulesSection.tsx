import React from 'react';
import { ModuleProvider } from '../../contexts/ModuleContext';
import ModuleList from '../modules/ModuleList';

interface ModulesSectionProps {
  courseId: string;
  prefetchedModules?: any[] | null;
}

const ModulesSection: React.FC<ModulesSectionProps> = ({ courseId, prefetchedModules }) => {
  return (
    <ModuleProvider>
      <ModuleList courseId={courseId} prefetchedModules={prefetchedModules} />
    </ModuleProvider>
  );
};

export default ModulesSection;
