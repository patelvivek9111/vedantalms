import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ModuleProvider } from '../contexts/ModuleContext';
import CreateModuleForm from '../components/CreateModuleForm';
import ModuleList from '../components/ModuleList';

const CourseDetail: React.FC = () => {
  const { id: courseId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);

  if (!courseId) return <div>Invalid course ID.</div>;

  const handleModuleCreated = () => {
    setShowCreateForm(false);
  };

  const handleCancelCreate = () => {
    setShowCreateForm(false);
  };

  return (
    <ModuleProvider>
      <div className="max-w-4xl mx-auto py-8">
        <h2 className="text-2xl font-bold mb-4">Course Content</h2>
        {(user?.role === 'teacher' || user?.role === 'admin') && (
          <>
            {!showCreateForm ? (
              <button
                onClick={() => setShowCreateForm(true)}
                className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Add Module
              </button>
            ) : (
              <CreateModuleForm 
                courseId={courseId} 
                onSuccess={handleModuleCreated}
                onCancel={handleCancelCreate}
              />
            )}
          </>
        )}
        <ModuleList courseId={courseId} />
        {/*
          To allow teachers/admins to add pages to modules, 
          you can render <CreatePageForm moduleId={module._id} /> inside ModuleCard when expanded and user is teacher/admin.
        */}
      </div>
    </ModuleProvider>
  );
};

export default CourseDetail; 