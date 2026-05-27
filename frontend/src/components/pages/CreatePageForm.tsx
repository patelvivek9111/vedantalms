import React, { useState, useEffect } from 'react';
import { useModule } from '../../contexts/ModuleContext';
import api from '../../services/api';
import RichTextEditor from '../common/RichTextEditor';
import FloatingLabelInput from '../common/FloatingLabelInput';
import FloatingLabelSelect from '../common/FloatingLabelSelect';
import FormFieldGroup from '../common/FormFieldGroup';
import { useDraftManager } from '../../hooks/useDraftManager';
import { FormPageHeader, FormActions } from '../common/FormControls';
import { FORM_ERROR, FORM_SHELL } from '../common/formStyles';
import ConfirmationModal from '../common/ConfirmationModal';
import FileAttachmentPanel from '../files/FileAttachmentPanel';
import type { NormalizedFile } from '../../utils/fileTypes';

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
  const [attachmentFiles, setAttachmentFiles] = useState<NormalizedFile[]>([]);
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
      setAttachmentFiles([]);
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
      await createPage(payload, {
        fileAssetIds: attachmentFiles.map((f) => f.fileAssetId).filter(Boolean) as string[],
      });
      setTitle('');
      setContent('');
      setSelectedModule('');
      setSelectedGroupSet('');
      setAttachmentFiles([]);
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
    <div className={`${FORM_SHELL} p-4 sm:p-6`}>
      <FormPageHeader
        title="Create new page"
        subtitle="Add content and choose where students will find it."
        isDraftSaved={isDraftSaved}
        onReset={handleResetForm}
        onClose={handleCancel}
      />
        <form onSubmit={handleSubmit} className="space-y-6">
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
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Content
              </label>
              <RichTextEditor content={content} onChange={setContent} height={400} />
            </div>
            <FileAttachmentPanel
              files={attachmentFiles}
              onChange={setAttachmentFiles}
              courseId={courseId}
              category="page"
              label="Drop page attachments here or browse"
            />
          </FormFieldGroup>

          <FormFieldGroup
            title="Page Location"
            description="Select where this page should be available"
          >
            {fieldErrors.selection && (
              <p className={`${FORM_ERROR} mb-2`} role="alert">{fieldErrors.selection}</p>
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
          <FormActions
            onCancel={handleCancel}
            submitLabel="Create page"
            loading={isSubmitting}
            loadingLabel="Creating…"
            disabled={!selectedModule && !selectedGroupSet}
          />
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