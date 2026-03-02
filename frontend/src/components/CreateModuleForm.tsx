import React, { useState } from 'react';
import { useModule } from '../contexts/ModuleContext';
import FloatingLabelInput from './common/FloatingLabelInput';

interface CreateModuleFormProps {
  courseId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const CreateModuleForm: React.FC<CreateModuleFormProps> = ({ courseId, onSuccess, onCancel }) => {
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const { createModule } = useModule();

  // Validation
  const validateTitle = (value: string) => {
    if (!value.trim()) {
      setFieldErrors(prev => ({ ...prev, title: 'Module title is required' }));
      return false;
    }
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.title;
      return newErrors;
    });
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const isTitleValid = validateTitle(title);
    if (!isTitleValid) {
      return;
    }

    setIsSubmitting(true);
    try {
      await createModule(courseId, { title, description: '' });
      setTitle('');
      setFieldErrors({});
      onSuccess();
    } catch (error) {
      } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setTitle('');
    onCancel();
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-lg shadow mb-4 border dark:border-gray-700">
      <div className="mb-3 sm:mb-4">
        <FloatingLabelInput
          id="title"
          type="text"
          label="Module Title"
          required
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (fieldErrors.title) {
              validateTitle(e.target.value);
            }
          }}
          onBlur={(e) => validateTitle(e.target.value)}
          error={fieldErrors.title}
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







