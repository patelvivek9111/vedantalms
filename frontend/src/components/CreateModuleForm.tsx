import React, { useState } from 'react';
import { useModule } from '../contexts/ModuleContext';

interface CreateModuleFormProps {
  courseId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const CreateModuleForm: React.FC<CreateModuleFormProps> = ({ courseId, onSuccess, onCancel }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { createModule } = useModule();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await createModule(courseId, { title, description });
      setTitle('');
      setDescription('');
      onSuccess();
    } catch (error) {
      console.error('Error creating module:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setTitle('');
    setDescription('');
    onCancel();
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow mb-4">
      <div className="mb-4">
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
          Module Title
        </label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      <div className="mb-4">
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
        />
      </div>
      <div className="flex justify-end space-x-2">
        <button
          type="button"
          onClick={handleCancel}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isSubmitting ? 'Creating...' : 'Create Module'}
        </button>
      </div>
    </form>
  );
};

export default CreateModuleForm; 