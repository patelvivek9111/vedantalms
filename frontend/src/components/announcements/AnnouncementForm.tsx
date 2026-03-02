import React, { useState, useEffect } from 'react';
import RichTextEditor from '../RichTextEditor';
import { useAuth } from '../../context/AuthContext';
import FloatingLabelInput from '../common/FloatingLabelInput';
import FloatingLabelSelect from '../common/FloatingLabelSelect';
import DatePicker from '../common/DatePicker';
import FormFieldGroup from '../common/FormFieldGroup';
import { useDraftManager } from '../../hooks/useDraftManager';
import { Save, RefreshCw } from 'lucide-react';
import ConfirmationModal from '../common/ConfirmationModal';

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
  const [files, setFiles] = useState<FileList | null>(null);
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
      setFiles(null);
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
    const isDelayedUntilValid = validateDelayedUntil();
    
    if (!isTitleValid || !isDelayedUntilValid) {
      return;
    }

    // Clear draft on successful submit
    clearDraft();

    const formData = new FormData();
    formData.append('title', title);
    formData.append('body', body);
    formData.append('postTo', postTo);
    if (files) {
      Array.from(files).forEach(file => formData.append('attachments', file));
    }
    formData.append('options', JSON.stringify(options));
    if (options.delayPosting && delayedUntil) {
      formData.append('delayedUntil', delayedUntil);
    }
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-4 bg-white dark:bg-gray-800 rounded shadow p-4 sm:p-6 border dark:border-gray-700">
      {/* Draft saved indicator and reset button */}
      <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-md mb-4">
        {isDraftSaved ? (
          <div className="flex items-center text-sm text-green-600 dark:text-green-400">
            <Save className="w-4 h-4 mr-2" />
            Draft saved automatically
          </div>
        ) : (
          <div></div>
        )}
        <button
          type="button"
          onClick={handleResetForm}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white dark:hover:bg-gray-800 rounded-md transition-colors"
          title="Clear form and start fresh"
        >
          <RefreshCw className="w-4 h-4" />
          Reset Form
        </button>
      </div>

      <FormFieldGroup
        title="Announcement Details"
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content</label>
          <RichTextEditor content={body} onChange={setBody} />
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
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Attachments</label>
          <input 
            type="file" 
            id="announcement-attachments" 
            name="attachments" 
            multiple 
            onChange={e => setFiles(e.target.files)}
            className="block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/50 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/70"
          />
        </div>
      </FormFieldGroup>

      <FormFieldGroup
        title="Advanced Options"
        description="Configure additional settings for your announcement"
      >
        <div className="space-y-3">
          <label htmlFor="delayPosting" className="flex items-center min-h-[44px] cursor-pointer">
            <input 
              type="checkbox" 
              id="delayPosting" 
              checked={options.delayPosting} 
              onChange={e => {
                setOptions(o => ({ ...o, delayPosting: e.target.checked }));
                if (!e.target.checked && fieldErrors.delayedUntil) {
                  setFieldErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors.delayedUntil;
                    return newErrors;
                  });
                }
              }}
              className="h-4 w-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-gray-700 rounded focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-900"
            />
            <span className="ml-2 text-gray-700 dark:text-gray-300">Delay posting</span>
          </label>
          {options.delayPosting && (
            <DatePicker
              id="announcement-delayed-until"
              name="delayedUntil"
              label="Release Date and Time"
              showTime={true}
              required={options.delayPosting}
              value={delayedUntil}
              onChange={e => {
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
          <label htmlFor="allowComments" className="flex items-center min-h-[44px] cursor-pointer">
            <input 
              type="checkbox" 
              id="allowComments" 
              checked={options.allowComments} 
              onChange={e => setOptions(o => ({ ...o, allowComments: e.target.checked }))}
              className="h-4 w-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-gray-700 rounded focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-900"
            />
            <span className="ml-2 text-gray-700 dark:text-gray-300">Allow users to comment</span>
          </label>
          <label htmlFor="requirePostBeforeSeeingReplies" className="flex items-center min-h-[44px] cursor-pointer ml-6">
            <input 
              type="checkbox" 
              id="requirePostBeforeSeeingReplies" 
              checked={options.requirePostBeforeSeeingReplies} 
              onChange={e => setOptions(o => ({ ...o, requirePostBeforeSeeingReplies: e.target.checked }))} 
              disabled={!options.allowComments}
              className="h-4 w-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-gray-700 rounded focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-900 disabled:opacity-50"
            />
            <span className="ml-2 text-gray-700 dark:text-gray-300">Users must post before seeing replies</span>
          </label>
          <label htmlFor="enablePodcastFeed" className="flex items-center min-h-[44px] cursor-pointer">
            <input 
              type="checkbox" 
              id="enablePodcastFeed" 
              checked={options.enablePodcastFeed} 
              onChange={e => setOptions(o => ({ ...o, enablePodcastFeed: e.target.checked }))}
              className="h-4 w-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-gray-700 rounded focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-900"
            />
            <span className="ml-2 text-gray-700 dark:text-gray-300">Enable podcast feed</span>
          </label>
          <label htmlFor="allowLiking" className="flex items-center min-h-[44px] cursor-pointer">
            <input 
              type="checkbox" 
              id="allowLiking" 
              checked={options.allowLiking} 
              onChange={e => setOptions(o => ({ ...o, allowLiking: e.target.checked }))}
              className="h-4 w-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-gray-700 rounded focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-900"
            />
            <span className="ml-2 text-gray-700 dark:text-gray-300">Allow liking</span>
          </label>
        </div>
      </FormFieldGroup>
      <div className="flex justify-end gap-2 mt-6">
        <button
          type="button"
          className="min-h-[44px] bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2.5 rounded hover:bg-gray-300 dark:hover:bg-gray-600 touch-manipulation active:scale-95 transition-transform"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="min-h-[44px] bg-blue-600 dark:bg-blue-500 text-white px-4 py-2.5 rounded hover:bg-blue-700 dark:hover:bg-blue-600 touch-manipulation active:scale-95 transition-transform disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
      </div>

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
    </form>
  );
};

export default AnnouncementForm; 