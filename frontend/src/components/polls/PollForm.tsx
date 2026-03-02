import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import { X, Plus, Trash2, Calendar, Save, RefreshCw } from 'lucide-react';
import FloatingLabelInput from '../common/FloatingLabelInput';
import DatePicker from '../common/DatePicker';
import FormFieldGroup from '../common/FormFieldGroup';
import { useDraftManager } from '../../hooks/useDraftManager';
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
      const token = localStorage.getItem('token');
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
    <div className="w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6 border dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
            {isEditing ? 'Edit Poll' : 'Create New Poll'}
          </h2>
          {isDraftSaved && !isEditing && (
            <div className="flex items-center text-sm text-green-600 dark:text-green-400">
              <Save className="w-4 h-4 mr-1" />
              Draft saved
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isEditing && (
            <button
              type="button"
              onClick={handleResetForm}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title="Clear form and start fresh"
            >
              <RefreshCw className="w-4 h-4" />
              Reset
            </button>
          )}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Poll Title *
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
              placeholder="e.g., What type of content would you prefer for next week?"
              maxLength={200}
            />
          </div>

          

            <DatePicker
              id="endDate"
              label="End Date"
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

          {/* Options */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Poll Options * (at least 2)
            </label>
            <div className="space-y-3">
              {formData.options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                    placeholder={`Option ${index + 1}`}
                    maxLength={200}
                  />
                  {formData.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className="p-2 text-red-500 hover:text-red-700 transition-colors"
                      title="Remove option"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {formData.options.length < 10 && (
              <button
                type="button"
                onClick={addOption}
                className="mt-3 flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Option
              </button>
            )}
          </div>

          {/* Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Allow Multiple Votes
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Students can select multiple options
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.allowMultipleVotes}
                  onChange={(e) => handleInputChange('allowMultipleVotes', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Show Results to Students
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Students can see voting results before poll ends
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.resultsVisible}
                  onChange={(e) => handleInputChange('resultsVisible', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors touch-manipulation active:scale-95"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="min-h-[44px] px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 touch-manipulation active:scale-95"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                {isEditing ? 'Update Poll' : 'Create Poll'}
              </>
            )}
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

export default PollForm; 