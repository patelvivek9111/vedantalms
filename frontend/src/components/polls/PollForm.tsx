import React, { useState, useEffect } from 'react';
import { getMemoryAuthToken, authFetchInit } from '../../utils/authToken';
import axios from 'axios';
import { API_URL } from '../../config';
import { Plus, Trash2 } from 'lucide-react';
import FloatingLabelInput from '../common/FloatingLabelInput';
import DatePicker from '../common/DatePicker';
import FormFieldGroup from '../common/FormFieldGroup';
import { useDraftManager } from '../../hooks/useDraftManager';
import { FormCheckboxOption, FormPageHeader, FormActions } from '../common/FormControls';
import { BTN_ADD, BTN_ICON_DANGER, FORM_ERROR, FORM_INPUT, FORM_SHELL } from '../common/formStyles';
import ConfirmationModal from '../common/ConfirmationModal';

interface PollFormProps {
  courseId: string;
  poll?: {
    _id: string;
    title: string;
    options: Array<{text: string, votes: number}>;
    endDate: string;
    allowMultipleVotes: boolean;
    resultsVisible: boolean;
  } | null;
  onClose: () => void;
  onSuccess: () => void;
}

const PollForm: React.FC<PollFormProps> = ({ courseId, poll, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    title: '',
    options: ['', ''],
    endDate: '',
    allowMultipleVotes: false,
    resultsVisible: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const isEditing = !!poll;

  // Draft manager (only for create mode)
  const formId = `poll-create-${courseId}`;
  const { draft, isDraftSaved, saveDraft, autoSave, clearDraft } = useDraftManager<{
    title: string;
    options: string[];
    endDate: string;
    allowMultipleVotes: boolean;
    resultsVisible: boolean;
  }>({
    formId,
    autoSaveDelay: 2000,
    enabled: !isEditing // Only enable draft saving for new polls
  });

  // Load draft on mount (only for create mode)
  useEffect(() => {
    if (draft && !isEditing) {
      setFormData({
        title: draft.title || '',
        options: draft.options && draft.options.length >= 2 ? draft.options : ['', ''],
        endDate: draft.endDate || formData.endDate,
        allowMultipleVotes: draft.allowMultipleVotes || false,
        resultsVisible: draft.resultsVisible || false
      });
    }
  }, [draft, isEditing]);

  // Auto-save draft on form changes (only for create mode)
  useEffect(() => {
    if (!isEditing && (formData.title || formData.options.some(opt => opt.trim()))) {
      autoSave({
        title: formData.title,
        options: formData.options,
        endDate: formData.endDate,
        allowMultipleVotes: formData.allowMultipleVotes,
        resultsVisible: formData.resultsVisible
      });
    }
  }, [formData, isEditing, autoSave]);

  // Reset form function
  const handleResetForm = () => {
    setShowResetConfirm(true);
  };

  const confirmResetForm = () => {
    setShowResetConfirm(false);
      clearDraft();
      // Reset to default end date (7 days from now)
      const defaultEndDate = new Date();
      defaultEndDate.setDate(defaultEndDate.getDate() + 7);
      const minutes = Math.round(defaultEndDate.getMinutes() / 10) * 10;
      defaultEndDate.setMinutes(minutes);
      const year = defaultEndDate.getFullYear();
      const month = String(defaultEndDate.getMonth() + 1).padStart(2, '0');
      const day = String(defaultEndDate.getDate()).padStart(2, '0');
      const hours = String(defaultEndDate.getHours()).padStart(2, '0');
      const minutesStr = String(minutes).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}T${hours}:${minutesStr}`;
      
      setFormData({
        title: '',
        options: ['', ''],
        endDate: formattedDate,
        allowMultipleVotes: false,
        resultsVisible: false
      });
      setFieldErrors({});
  };

  useEffect(() => {
    if (poll) {
             // Format the end date properly for datetime-local input with 10-minute increments
       const pollEndDate = new Date(poll.endDate);
       // Round minutes to nearest 10-minute increment
       const minutes = Math.round(pollEndDate.getMinutes() / 10) * 10;
       pollEndDate.setMinutes(minutes);
       const year = pollEndDate.getFullYear();
       const month = String(pollEndDate.getMonth() + 1).padStart(2, '0');
       const day = String(pollEndDate.getDate()).padStart(2, '0');
       const hours = String(pollEndDate.getHours()).padStart(2, '0');
       const minutesStr = String(minutes).padStart(2, '0');
       const formattedEndDate = `${year}-${month}-${day}T${hours}:${minutesStr}`;
      
      setFormData({
        title: poll.title,
        options: poll.options.map(option => option.text),
        endDate: formattedEndDate,
        allowMultipleVotes: poll.allowMultipleVotes,
        resultsVisible: poll.resultsVisible
      });
    } else {
             // Set default end date to 7 days from now with 10-minute increments
       const defaultEndDate = new Date();
       defaultEndDate.setDate(defaultEndDate.getDate() + 7);
       // Round minutes to nearest 10-minute increment
       const minutes = Math.round(defaultEndDate.getMinutes() / 10) * 10;
       defaultEndDate.setMinutes(minutes);
       // Format for datetime-local input (YYYY-MM-DDTHH:MM)
       const year = defaultEndDate.getFullYear();
       const month = String(defaultEndDate.getMonth() + 1).padStart(2, '0');
       const day = String(defaultEndDate.getDate()).padStart(2, '0');
       const hours = String(defaultEndDate.getHours()).padStart(2, '0');
       const minutesStr = String(minutes).padStart(2, '0');
       const formattedDate = `${year}-${month}-${day}T${hours}:${minutesStr}`;
      
      setFormData(prev => ({
        ...prev,
        endDate: formattedDate
      }));
    }
  }, [poll]);

  const handleInputChange = (field: string, value: any) => {
    if (field === 'endDate') {
      // Ensure time is rounded to 10-minute increments
      const date = new Date(value);
      const minutes = Math.round(date.getMinutes() / 10) * 10;
      date.setMinutes(minutes);
      
      // Format for datetime-local input (24-hour format for backend)
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutesStr = String(minutes).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}T${hours}:${minutesStr}`;
      
      setFormData(prev => ({
        ...prev,
        [field]: formattedDate
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...formData.options];
    newOptions[index] = value;
    setFormData(prev => ({
      ...prev,
      options: newOptions
    }));
  };

  const addOption = () => {
    if (formData.options.length < 10) {
      setFormData(prev => ({
        ...prev,
        options: [...prev.options, '']
      }));
    }
  };

  const removeOption = (index: number) => {
    if (formData.options.length > 2) {
      const newOptions = formData.options.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        options: newOptions
      }));
    }
  };

  const validateEndDate = () => {
    if (!formData.endDate) {
      setFieldErrors(prev => ({ ...prev, endDate: 'End date is required' }));
      return false;
    }
    if (new Date(formData.endDate) <= new Date()) {
      setFieldErrors(prev => ({ ...prev, endDate: 'End date must be in the future' }));
      return false;
    }
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.endDate;
      return newErrors;
    });
    return true;
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      setError('Title is required');
      return false;
    }
    if (formData.options.length < 2) {
      setError('At least 2 options are required');
      return false;
    }
    if (formData.options.some(option => !option.trim())) {
      setError('All options must have text');
      return false;
    }
    if (!validateEndDate()) {
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const token = getMemoryAuthToken();
      const payload = {
        title: formData.title.trim(),
        options: formData.options.map(option => option.trim()),
        endDate: new Date(formData.endDate).toISOString(),
        allowMultipleVotes: formData.allowMultipleVotes,
        resultsVisible: formData.resultsVisible
      };

      if (isEditing) {
        await axios.put(`${API_URL}/api/polls/${poll._id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API_URL}/api/polls/courses/${courseId}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save poll');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${FORM_SHELL} p-4 sm:p-6`}>
      <FormPageHeader
        title={isEditing ? 'Edit poll' : 'Create new poll'}
        subtitle="Ask your class a question and collect votes."
        isDraftSaved={isDraftSaved && !isEditing}
        onReset={!isEditing ? handleResetForm : undefined}
        onClose={onClose}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className={FORM_ERROR} role="alert">
              {error}
            </div>
          )}

          <FormFieldGroup title="Poll details" description="Title and when voting closes">
            <FloatingLabelInput
              id="title"
              name="title"
              type="text"
              label="Poll title"
              required
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              showCharacterCount
              maxLength={200}
              placeholder="e.g., What type of content would you prefer for next week?"
            />
            <DatePicker
              id="endDate"
              label="End date"
              showTime={true}
              required
              value={formData.endDate}
              onChange={(e) => {
                handleInputChange('endDate', e.target.value);
                if (fieldErrors.endDate) {
                  validateEndDate();
                }
              }}
              onBlur={validateEndDate}
              error={fieldErrors.endDate}
              helperText="Select when the poll should end (10-minute increments)"
              min={new Date().toISOString().split('T')[0]}
            />
          </FormFieldGroup>

          <FormFieldGroup title="Answer options" description="Add at least two choices for students">
            <div className="space-y-3">
              {formData.options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    className={`${FORM_INPUT} min-w-0 flex-1`}
                    placeholder={`Option ${index + 1}`}
                    maxLength={200}
                  />
                  {formData.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className={BTN_ICON_DANGER}
                      title="Remove option"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {formData.options.length < 10 && (
              <button type="button" onClick={addOption} className={`${BTN_ADD} mt-3`}>
                <Plus className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                Add option
              </button>
            )}
          </FormFieldGroup>

          <FormFieldGroup title="Poll settings" description="Control how students vote and see results">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormCheckboxOption
                id="allowMultipleVotes"
                checked={formData.allowMultipleVotes}
                onChange={(e) => handleInputChange('allowMultipleVotes', e.target.checked)}
                title="Allow multiple votes"
                description="Students can select more than one option."
              />
              <FormCheckboxOption
                id="resultsVisible"
                checked={formData.resultsVisible}
                onChange={(e) => handleInputChange('resultsVisible', e.target.checked)}
                title="Show results to students"
                description="Students can see results before the poll ends."
              />
            </div>
          </FormFieldGroup>

        <FormActions
          onCancel={onClose}
          submitLabel={isEditing ? 'Update poll' : 'Create poll'}
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

export default PollForm; 