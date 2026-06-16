import React, { useState, useEffect } from 'react';
import RichTextEditor from '../common/RichTextEditor';
import { useAuth } from '../../contexts/AuthContext';
import FloatingLabelInput from '../common/FloatingLabelInput';
import FloatingLabelSelect from '../common/FloatingLabelSelect';
import DatePicker from '../common/DatePicker';
import FormFieldGroup from '../common/FormFieldGroup';
import { useDraftManager } from '../../hooks/useDraftManager';
import { FormCheckboxOption, FormPageHeader, FormActions } from '../common/FormControls';
import { FORM_SHELL, FORM_ERROR } from '../common/formStyles';
import ConfirmationModal from '../common/ConfirmationModal';
import FileAttachmentPanel from '../files/FileAttachmentPanel';
import type { NormalizedFile } from '../../utils/fileTypes';
import { stripHtmlToText } from '../../utils/htmlUtils';

interface AnnouncementFormProps {
  onSubmit: (data: FormData) => void;
  loading?: boolean;
  onCancel?: () => void;
  initialValues?: {
    title?: string;
    body?: string;
    postTo?: string;
    options?: any;
    delayedUntil?: string;
  };
}

const AnnouncementForm: React.FC<AnnouncementFormProps> = ({ onSubmit, loading, onCancel, initialValues }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [postTo, setPostTo] = useState('all');
  const [attachmentFiles, setAttachmentFiles] = useState<NormalizedFile[]>([]);
  const [options, setOptions] = useState({
    delayPosting: false,
    allowComments: false,
    requirePostBeforeSeeingReplies: false,
    enablePodcastFeed: false,
    allowLiking: false,
  });
  const [delayedUntil, setDelayedUntil] = useState<string>('');
  const [groupSets, setGroupSets] = useState<{ _id: string; name: string }[]>([]);
  const [courseId, setCourseId] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const { token } = useAuth();

  // Draft manager
  const formId = `announcement-${courseId || 'new'}`;
  const { draft, isDraftSaved, saveDraft, autoSave, clearDraft } = useDraftManager<{
    title: string;
    body: string;
    postTo: string;
    options: typeof options;
    delayedUntil: string;
  }>({
    formId,
    autoSaveDelay: 2000
  });

  // Load draft on mount
  useEffect(() => {
    if (draft && !initialValues) {
      setTitle(draft.title || '');
      setBody(draft.body || '');
      setPostTo(draft.postTo || 'all');
      setOptions(draft.options || options);
      setDelayedUntil(draft.delayedUntil || '');
    }
  }, [draft, initialValues]);

  // Auto-save draft on form changes
  useEffect(() => {
    if (title || body) {
      autoSave({
        title,
        body,
        postTo,
        options,
        delayedUntil
      });
    }
  }, [title, body, postTo, options, delayedUntil, autoSave]);

  useEffect(() => {
    // Try to get courseId from URL if not passed as prop
    const match = window.location.pathname.match(/courses\/(\w+)/);
    const id = match ? match[1] : '';
    setCourseId(id);
    if (id) {
      fetch(`/api/groups/sets/${id}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setGroupSets(data);
        });
    }
  }, [token]);

  useEffect(() => {
    if (initialValues) {
      setTitle(initialValues.title || '');
      setBody(initialValues.body || '');
      setPostTo(initialValues.postTo || 'all');
      setOptions({
        delayPosting: !!initialValues.options?.delayPosting,
        allowComments: !!initialValues.options?.allowComments,
        requirePostBeforeSeeingReplies: !!initialValues.options?.requirePostBeforeSeeingReplies,
        enablePodcastFeed: !!initialValues.options?.enablePodcastFeed,
        allowLiking: !!initialValues.options?.allowLiking,
      });
      setDelayedUntil(initialValues.delayedUntil || '');
    }
  }, [initialValues]);

  // Reset form function
  const handleResetForm = () => {
    setShowResetConfirm(true);
  };

  const confirmResetForm = () => {
    setShowResetConfirm(false);
      clearDraft();
      setTitle('');
      setBody('');
      setPostTo('all');
      setAttachmentFiles([]);
      setOptions({
        delayPosting: false,
        allowComments: false,
        requirePostBeforeSeeingReplies: false,
        enablePodcastFeed: false,
        allowLiking: false,
      });
      setDelayedUntil('');
      setFieldErrors({});
  };

  // Validation
  const validateTitle = (value: string) => {
    if (!value.trim()) {
      setFieldErrors(prev => ({ ...prev, title: 'Topic title is required' }));
      return false;
    }
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.title;
      return newErrors;
    });
    return true;
  };

  const validateBody = (value: string) => {
    if (!stripHtmlToText(value)) {
      setFieldErrors((prev) => ({ ...prev, body: 'Announcement content is required' }));
      return false;
    }
    setFieldErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.body;
      return newErrors;
    });
    return true;
  };

  const validateDelayedUntil = () => {
    if (options.delayPosting && !delayedUntil) {
      setFieldErrors(prev => ({ ...prev, delayedUntil: 'Release date and time is required when delay posting is enabled' }));
      return false;
    }
    if (options.delayPosting && delayedUntil && new Date(delayedUntil) <= new Date()) {
      setFieldErrors(prev => ({ ...prev, delayedUntil: 'Release date must be in the future' }));
      return false;
    }
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.delayedUntil;
      return newErrors;
    });
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const isTitleValid = validateTitle(title);
    const isBodyValid = validateBody(body);
    const isDelayedUntilValid = validateDelayedUntil();

    if (!isTitleValid || !isBodyValid || !isDelayedUntilValid) {
      return;
    }

    // Clear draft on successful submit
    clearDraft();

    const formData = new FormData();
    formData.append('title', title);
    formData.append('body', body);
    formData.append('postTo', postTo);
    const ids = attachmentFiles.map((f) => f.fileAssetId).filter(Boolean);
    if (ids.length) formData.append('fileAssetIds', JSON.stringify(ids));
    formData.append('options', JSON.stringify(options));
    if (options.delayPosting && delayedUntil) {
      formData.append('delayedUntil', delayedUntil);
    }
    onSubmit(formData);
  };

  return (
    <div className={`${FORM_SHELL} p-4 sm:p-6`}>
      <FormPageHeader
        title="Announcement"
        subtitle="Share updates with your course."
        isDraftSaved={isDraftSaved && !initialValues}
        onReset={!initialValues ? handleResetForm : undefined}
        resetLabel="Reset form"
      />

      <form onSubmit={handleSubmit} className="space-y-6">
      <FormFieldGroup
        title="Announcement details"
        description="Enter the topic title and content for your announcement"
      >
        <FloatingLabelInput
          id="announcement-title"
          name="title"
          type="text"
          label="Topic Title"
          required
          value={title}
          onChange={e => {
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
          <label
            htmlFor="announcement-body"
            className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Content
          </label>
          <RichTextEditor
            id="announcement-body"
            content={body}
            placeholder="Write announcement content..."
            onChange={(value) => {
              setBody(value);
              if (fieldErrors.body) {
                validateBody(value);
              }
            }}
          />
          {fieldErrors.body && (
            <p id="announcement-body-error" className={`${FORM_ERROR} mt-2`} role="alert">
              {fieldErrors.body}
            </p>
          )}
        </div>
      </FormFieldGroup>

      <FormFieldGroup
        title="Posting Options"
        description="Choose where to post and add attachments"
      >
        <FloatingLabelSelect
          id="announcement-post-to"
          name="postTo"
          label="Post to"
          value={postTo}
          onChange={e => setPostTo(e.target.value)}
          options={[
            { value: 'all', label: 'All Sections' },
            ...groupSets.map(gs => ({
              value: gs._id,
              label: gs.name
            }))
          ]}
        />
        <FileAttachmentPanel
          files={attachmentFiles}
          onChange={setAttachmentFiles}
          courseId={courseId}
          category="announcement"
          label="Drop announcement attachments here or browse"
        />
      </FormFieldGroup>

      <FormFieldGroup
        title="Advanced options"
        description="Configure additional settings for your announcement"
      >
        <div className="space-y-3">
          <FormCheckboxOption
            id="delayPosting"
            checked={options.delayPosting}
            onChange={(e) => {
              setOptions((o) => ({ ...o, delayPosting: e.target.checked }));
              if (!e.target.checked && fieldErrors.delayedUntil) {
                setFieldErrors((prev) => {
                  const newErrors = { ...prev };
                  delete newErrors.delayedUntil;
                  return newErrors;
                });
              }
            }}
            title="Delay posting"
            description="Schedule this announcement to publish at a later date and time."
          />
          {options.delayPosting && (
            <DatePicker
              id="announcement-delayed-until"
              name="delayedUntil"
              label="Release date and time"
              showTime={true}
              required={options.delayPosting}
              value={delayedUntil}
              onChange={(e) => {
                setDelayedUntil(e.target.value);
                if (fieldErrors.delayedUntil) {
                  validateDelayedUntil();
                }
              }}
              onBlur={validateDelayedUntil}
              error={fieldErrors.delayedUntil}
              helperText="Select when this announcement should be published"
            />
          )}
          <FormCheckboxOption
            id="allowComments"
            checked={options.allowComments}
            onChange={(e) => setOptions((o) => ({ ...o, allowComments: e.target.checked }))}
            title="Allow comments"
            description="Let students reply to this announcement."
          />
          <div className="pl-2">
            <FormCheckboxOption
              id="requirePostBeforeSeeingReplies"
              checked={options.requirePostBeforeSeeingReplies}
              onChange={(e) =>
                setOptions((o) => ({ ...o, requirePostBeforeSeeingReplies: e.target.checked }))
              }
              title="Require post before seeing replies"
              description="Students must comment before they can read other replies."
              disabled={!options.allowComments}
            />
          </div>
          <FormCheckboxOption
            id="enablePodcastFeed"
            checked={options.enablePodcastFeed}
            onChange={(e) => setOptions((o) => ({ ...o, enablePodcastFeed: e.target.checked }))}
            title="Enable podcast feed"
            description="Include this announcement in the course podcast feed."
          />
          <FormCheckboxOption
            id="allowLiking"
            checked={options.allowLiking}
            onChange={(e) => setOptions((o) => ({ ...o, allowLiking: e.target.checked }))}
            title="Allow liking"
            description="Let students like this announcement."
          />
        </div>
      </FormFieldGroup>

      <FormActions
        onCancel={onCancel}
        submitLabel="Save"
        loading={loading}
        loadingLabel="Saving…"
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

export default AnnouncementForm; 