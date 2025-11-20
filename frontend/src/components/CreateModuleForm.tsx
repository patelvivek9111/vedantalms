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
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-lg shadow mb-4 border dark:border-gray-700">
      <div className="mb-3 sm:mb-4">
        <label htmlFor="title" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Module Title
        </label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          required
        />
      </div>
      <div className="mb-3 sm:mb-4">
        <label htmlFor="description" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          rows={3}
        />
      </div>
      <div className="flex flex-col sm:flex-row justify-end gap-2 sm:space-x-2">
        <button
          type="button"
          onClick={handleCancel}
          className="w-full sm:w-auto px-4 py-2 text-sm sm:text-base bg-gray-500 dark:bg-gray-600 text-white rounded hover:bg-gray-600 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
        >
          {isSubmitting ? 'Creating...' : 'Create Module'}
        </button>
      </div>
    </form>
  );
};

export default CreateModuleForm; 