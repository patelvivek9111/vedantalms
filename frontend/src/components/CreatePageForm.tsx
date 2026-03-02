import React, { useState, useEffect } from 'react';
import { useModule } from '../contexts/ModuleContext';
import api from '../services/api';
import RichTextEditor from './RichTextEditor';
import FloatingLabelInput from './common/FloatingLabelInput';
import FloatingLabelSelect from './common/FloatingLabelSelect';
import FormFieldGroup from './common/FormFieldGroup';
import { useDraftManager } from '../hooks/useDraftManager';
import { Save, RefreshCw } from 'lucide-react';
import ConfirmationModal from './common/ConfirmationModal';

interface Module {
  _id: string;
  title: string;
}

interface GroupSet {
  _id: string;
  name: string;
}

interface CreatePageFormProps {
  modules: Module[];
  courseId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const CreatePageForm: React.FC<CreatePageFormProps> = ({ modules, courseId, onSuccess, onCancel }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedModule, setSelectedModule] = useState('');
  const [groupSets, setGroupSets] = useState<GroupSet[]>([]);
  const [selectedGroupSet, setSelectedGroupSet] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const { createPage } = useModule();

  // Draft manager
  const formId = `page-create-${courseId}`;
  const { draft, isDraftSaved, saveDraft, autoSave, clearDraft } = useDraftManager<{
    title: string;
    content: string;
    selectedModule: string;
    selectedGroupSet: string;
  }>({
    formId,
    autoSaveDelay: 2000
  });

  // Load draft on mount
  useEffect(() => {
    if (draft) {
      setTitle(draft.title || '');
      setContent(draft.content || '');
      setSelectedModule(draft.selectedModule || '');
      setSelectedGroupSet(draft.selectedGroupSet || '');
    }
  }, [draft]);

  // Auto-save draft on form changes
  useEffect(() => {
    if (title || content) {
      autoSave({
        title,
        content,
        selectedModule,
        selectedGroupSet
      });
    }
  }, [title, content, selectedModule, selectedGroupSet, autoSave]);

  // Reset form function
  const handleResetForm = () => {
    setShowResetConfirm(true);
  };

  const confirmResetForm = () => {
    setShowResetConfirm(false);
      clearDraft();
      setTitle('');
      setContent('');
      setSelectedModule('');
      setSelectedGroupSet('');
      setAttachments([]);
      setFieldErrors({});
  };

  useEffect(() => {
    const fetchGroupSets = async () => {
      try {
        const res = await api.get(`/groups/sets/${courseId}`);
        setGroupSets(res.data || []);
      } catch (err) {
        setGroupSets([]);
      }
    };
    if (courseId) fetchGroupSets();
  }, [courseId]);

  // Validation
  const validateTitle = (value: string) => {
    if (!value.trim()) {
      setFieldErrors(prev => ({ ...prev, title: 'Page title is required' }));
      return false;
    }
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.title;
      return newErrors;
    });
    return true;
  };

  const validateSelection = () => {
    if (!selectedModule && !selectedGroupSet) {
      setFieldErrors(prev => ({ ...prev, selection: 'Please select either a module or a group set' }));
      return false;
    }
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.selection;
      return newErrors;
    });
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const isTitleValid = validateTitle(title);
    const isSelectionValid = validateSelection();
    
    if (!isTitleValid || !isSelectionValid) {
      return;
    }

    // Clear draft on successful submit
    clearDraft();

    setIsSubmitting(true);
    try {
      const payload: any = { title, content };
      if (selectedModule) payload.module = selectedModule;
      if (selectedGroupSet) payload.groupSet = selectedGroupSet;
      await createPage(payload, attachments);
      setTitle('');
      setContent('');
      setSelectedModule('');
      setSelectedGroupSet('');
      setAttachments([]);
      onSuccess();
    } catch (error) {
      } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setTitle('');
    setContent('');
    setSelectedModule('');
    setSelectedGroupSet('');
    onCancel();
  };

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6 border dark:border-gray-700">
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">Create New Page</h2>
          {isDraftSaved && (
            <div className="flex items-center text-sm text-green-600 dark:text-green-400">
              <Save className="w-4 h-4 mr-1" />
              Draft saved
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetForm}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            title="Clear form and start fresh"
          >
            <RefreshCw className="w-4 h-4" />
            Reset
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl sm:text-2xl font-bold focus:outline-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <FormFieldGroup
            title="Page Information"
            description="Enter the page title and content"
          >
            <FloatingLabelInput
              id="title"
              type="text"
              label="Page Title"
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
              showCharacterCount
              maxLength={200}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content</label>
              <RichTextEditor content={content} onChange={setContent} height={400} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Attachments (optional)</label>
              <input
                type="file"
                multiple
                onChange={(e) => setAttachments(Array.from(e.target.files || []))}
                className="block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/50 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/70"
              />
            </div>
          </FormFieldGroup>

          <FormFieldGroup
            title="Page Location"
            description="Select where this page should be available"
          >
            {fieldErrors.selection && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-2">{fieldErrors.selection}</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FloatingLabelSelect
                id="page-module"
                name="module"
                label="Module"
                value={selectedModule}
                onChange={e => {
                  setSelectedModule(e.target.value);
                  if (e.target.value) {
                    setSelectedGroupSet('');
                    if (fieldErrors.selection) {
                      validateSelection();
                    }
                  }
                }}
                disabled={!!selectedGroupSet}
                options={[
                  ...modules.map(mod => ({
                    value: mod._id,
                    label: mod.title
                  }))
                ]}
                helperText={selectedGroupSet ? 'Disabled when Group Set is selected' : 'Select a module for this page'}
              />
              <FloatingLabelSelect
                id="page-group-set"
                name="groupSet"
                label="Group Set"
                value={selectedGroupSet}
                onChange={e => {
                  setSelectedGroupSet(e.target.value);
                  if (e.target.value) {
                    setSelectedModule('');
                    if (fieldErrors.selection) {
                      validateSelection();
                    }
                  }
                }}
                disabled={!!selectedModule}
                options={[
                  ...groupSets.map(gs => ({
                    value: gs._id,
                    label: gs.name
                  }))
                ]}
                helperText={selectedModule ? 'Disabled when Module is selected' : 'Select a group set for this page'}
              />
            </div>
          </FormFieldGroup>
          <div className="flex justify-end space-x-2 pt-4 border-t dark:border-gray-700">
            <button
              type="button"
              onClick={handleCancel}
              className="min-h-[44px] px-4 py-2.5 bg-gray-500 dark:bg-gray-600 text-white rounded hover:bg-gray-600 dark:hover:bg-gray-700 touch-manipulation active:scale-95 transition-transform"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (!selectedModule && !selectedGroupSet)}
              className="min-h-[44px] px-4 py-2.5 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 touch-manipulation active:scale-95 transition-transform"
            >
              {isSubmitting ? 'Creating...' : 'Create Page'}
            </button>
          </div>
        </form>

        {/* Reset Form Confirmation Modal */}
        <ConfirmationModal
          isOpen={showResetConfirm}
          onClose={() => setShowResetConfirm(false)}
          onConfirm={confirmResetForm}
          title="Clear Form"
          message="Are you sure you want to clear all fields and start fresh? This will delete your saved draft."
          confirmText="Clear"
          cancelText="Cancel"
          variant="warning"
        />
    </div>
  );
};

export default CreatePageForm; 