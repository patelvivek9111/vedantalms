import React, { useState } from 'react';
import { useModule } from '../../contexts/ModuleContext';
import FloatingLabelInput from '../common/FloatingLabelInput';
import FormFieldGroup from '../common/FormFieldGroup';
import { FormActions } from '../common/FormControls';

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

  const validateTitle = (value: string) => {
    if (!value.trim()) {
      setFieldErrors((prev) => ({ ...prev, title: 'Module title is required' }));
      return false;
    }
    setFieldErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.title;
      return newErrors;
    });
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateTitle(title)) {
      return;
    }

    setIsSubmitting(true);
    try {
      await createModule(courseId, { title, description: '' });
      setTitle('');
      setFieldErrors({});
      onSuccess();
    } catch {
      /* handled by context */
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setTitle('');
    onCancel();
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-0">
      <FormFieldGroup title="New module" description="Add a module to organize course content">
        <FloatingLabelInput
          id="title"
          type="text"
          label="Module title"
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
        <FormActions
          onCancel={handleCancel}
          submitLabel="Create module"
          loading={isSubmitting}
          loadingLabel="Creating…"
        />
      </FormFieldGroup>
    </form>
  );
};

export default CreateModuleForm;
