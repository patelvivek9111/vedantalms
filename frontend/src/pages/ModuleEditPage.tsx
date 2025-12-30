import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ModuleEditWrapper from '../components/ModuleEditWrapper';

const ModuleEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) {
    return (
      <div className="p-6">
        <p className="text-gray-600 dark:text-gray-400">Module ID is required</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  return <ModuleEditWrapper />;
};

export default ModuleEditPage;

