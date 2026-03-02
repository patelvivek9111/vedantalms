import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { API_URL } from '../config';
import RichTextEditor from './RichTextEditor';
import axios from 'axios';
import FloatingLabelInput from './common/FloatingLabelInput';
import FloatingLabelTextarea from './common/FloatingLabelTextarea';
import FloatingLabelSelect from './common/FloatingLabelSelect';
import DatePicker from './common/DatePicker';
import FormFieldGroup from './common/FormFieldGroup';
import { useDraftManager } from '../hooks/useDraftManager';
import { Save, RefreshCw } from 'lucide-react';

interface CreateThreadModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  onThreadCreated: (newThread: any) => void;
  courseGroups?: { name: string; weight: number }[];
  modules?: { _id: string; title: string }[];
  defaultGroupSetId?: string;
}

interface GroupSet {
  _id: string;
  name: string;
  course: string;
  allowSelfSignup: boolean;
}

const CreateThreadModal: React.FC<CreateThreadModalProps> = ({
  isOpen,
  onClose,
  courseId,
  onThreadCreated,
  courseGroups = [],
  modules = [],
  defaultGroupSetId
}) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // New state for grading options
  const [isGraded, setIsGraded] = useState(false);
  const [totalPoints, setTotalPoints] = useState(100);
  const [selectedGroup, setSelectedGroup] = useState('Discussions');
  const [dueDate, setDueDate] = useState('');
  const [selectedModule, setSelectedModule] = useState('');
  
  // New state for groupset
  const [groupSets, setGroupSets] = useState<GroupSet[]>([]);
  const [isGroupDiscussion, setIsGroupDiscussion] = useState(false);
  const [selectedGroupSet, setSelectedGroupSet] = useState('');
  
  // New state for discussion settings
  const [requirePostBeforeSee, setRequirePostBeforeSee] = useState(false);
  const [allowLikes, setAllowLikes] = useState(true);
  const [allowComments, setAllowComments] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

  // Draft manager
  const formId = `thread-create-${courseId}`;
  const { draft, isDraftSaved, saveDraft, autoSave, clearDraft } = useDraftManager<{
    title: string;
    content: string;
    isGraded: boolean;
    totalPoints: number;
    selectedGroup: string;
    dueDate: string;
    selectedModule: string;
    isGroupDiscussion: boolean;
    selectedGroupSet: string;
    requirePostBeforeSee: boolean;
    allowLikes: boolean;
    allowComments: boolean;
  }>({
    formId,
    autoSaveDelay: 2000
  });

  // Load draft on mount
  useEffect(() => {
    if (draft && isOpen) {
      setTitle(draft.title || '');
      setContent(draft.content || '');
      setIsGraded(draft.isGraded || false);
      setTotalPoints(draft.totalPoints || 100);
      setSelectedGroup(draft.selectedGroup || 'Discussions');
      setDueDate(draft.dueDate || '');
      setSelectedModule(draft.selectedModule || '');
      setIsGroupDiscussion(draft.isGroupDiscussion || false);
      setSelectedGroupSet(draft.selectedGroupSet || '');
      setRequirePostBeforeSee(draft.requirePostBeforeSee || false);
      setAllowLikes(draft.allowLikes !== undefined ? draft.allowLikes : true);
      setAllowComments(draft.allowComments !== undefined ? draft.allowComments : true);
    }
  }, [draft, isOpen]);

  // Auto-save draft on form changes
  useEffect(() => {
    if (isOpen && (title || content)) {
      autoSave({
        title,
        content,
        isGraded,
        totalPoints,
        selectedGroup,
        dueDate,
        selectedModule,
        isGroupDiscussion,
        selectedGroupSet,
        requirePostBeforeSee,
        allowLikes,
        allowComments
      });
    }
  }, [title, content, isGraded, totalPoints, selectedGroup, dueDate, selectedModule, isGroupDiscussion, selectedGroupSet, requirePostBeforeSee, allowLikes, allowComments, isOpen, autoSave]);

  // Set default groupset if provided
  useEffect(() => {
    if (defaultGroupSetId) {
      setIsGroupDiscussion(true);
      setSelectedGroupSet(defaultGroupSetId);
    }
  }, [defaultGroupSetId]);

  // Fetch groupsets when modal opens
  useEffect(() => {
    const fetchGroupSets = async () => {
      if (!courseId || !isOpen) return;
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/api/groups/sets/${courseId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setGroupSets(response.data);
      } catch (err: any) {
        }
    };
    fetchGroupSets();
  }, [courseId, isOpen]);

  // Validation
  const validateTitle = (value: string) => {
    if (!value.trim()) {
      setFieldErrors(prev => ({ ...prev, title: 'Thread title is required' }));
      return false;
    }
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.title;
      return newErrors;
    });
    return true;
  };

  const validateContent = (value: string) => {
    if (!value.trim()) {
      setFieldErrors(prev => ({ ...prev, content: 'Thread content is required' }));
      return false;
    }
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.content;
      return newErrors;
    });
    return true;
  };

  const validateGroupSet = () => {
    if (isGroupDiscussion && !selectedGroupSet) {
      setFieldErrors(prev => ({ ...prev, groupSet: 'Please select a group set for the group discussion' }));
      return false;
    }
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.groupSet;
      return newErrors;
    });
    return true;
  };

  const validateGrading = () => {
    if (isGraded) {
      if (totalPoints <= 0) {
        setFieldErrors(prev => ({ ...prev, totalPoints: 'Total points must be greater than 0' }));
        return false;
      }
      if (dueDate && new Date(dueDate) <= new Date()) {
        setFieldErrors(prev => ({ ...prev, dueDate: 'Due date must be in the future' }));
        return false;
      }
    }
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.totalPoints;
      delete newErrors.dueDate;
      return newErrors;
    });
    return true;
  };

  const handleResetForm = () => {
    setTitle('');
    setContent('');
    setIsGraded(false);
    setTotalPoints(100);
    setSelectedGroup('Discussions');
    setDueDate('');
    setSelectedModule('');
    setIsGroupDiscussion(false);
    setSelectedGroupSet('');
    setRequirePostBeforeSee(false);
    setAllowLikes(true);
    setAllowComments(true);
    setFieldErrors({});
    clearDraft();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const isTitleValid = validateTitle(title);
    const isContentValid = validateContent(content);
    const isGroupSetValid = validateGroupSet();
    const isGradingValid = validateGrading();
    
    if (!isTitleValid || !isContentValid || !isGroupSetValid || !isGradingValid) {
      return;
    }

    // Clear draft on successful submit
    clearDraft();

    setIsSubmitting(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const threadData: any = {
        title: title.trim(),
        content: content,
        courseId,
        module: selectedModule || undefined,
        isGraded,
        totalPoints: isGraded ? totalPoints : null,
        group: selectedGroup,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        settings: {
          requirePostBeforeSee,
          allowLikes,
          allowComments
        }
      };

      // Add groupset if this is a group discussion
      if (isGroupDiscussion && selectedGroupSet) {
        threadData.groupSet = selectedGroupSet;
      }

      const response = await api.post(
        `${API_URL}/api/threads`,
        threadData,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        onThreadCreated(response.data.data);
        onClose();
        // Reset form
        setTitle('');
        setContent('');
        setIsGraded(false);
        setTotalPoints(100);
        setSelectedGroup('Discussions');
        setDueDate('');
        setSelectedModule('');
        setIsGroupDiscussion(false);
        setSelectedGroupSet('');
        setRequirePostBeforeSee(false);
        setAllowLikes(true);
        setAllowComments(true);
        setFieldErrors({});
      } else {
        setError('Failed to create thread');
      }
    } catch (err) {
      setError('Failed to create thread. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6 border dark:border-gray-700">
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-lg sm:text-2xl font-semibold text-gray-800 dark:text-gray-100">Create New Discussion Thread</h2>
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
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none flex-shrink-0"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <form id="create-thread-form" onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 rounded">
              {error}
            </div>
          )}

          <FormFieldGroup
            title="Thread Information"
            description="Enter the title and content for your discussion thread"
          >
            <FloatingLabelInput
              id="title"
              type="text"
              label="Thread Title"
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Content
              </label>
              {fieldErrors.content && (
                <p className="text-sm text-red-600 dark:text-red-400 mb-1">{fieldErrors.content}</p>
              )}
              <div className="border border-gray-300 dark:border-gray-700 rounded-md">
                <RichTextEditor
                  content={content}
                  onChange={(value) => {
                    setContent(value);
                    if (fieldErrors.content) {
                      validateContent(value);
                    }
                  }}
                  placeholder="Write your thread content..."
                  className="h-64"
                />
              </div>
            </div>
          </FormFieldGroup>

          <FormFieldGroup
            title="Group Discussion"
            description="Configure group discussion settings"
          >
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isGroupDiscussion"
                checked={isGroupDiscussion}
                onChange={(e) => {
                  setIsGroupDiscussion(e.target.checked);
                  if (!e.target.checked && fieldErrors.groupSet) {
                    setFieldErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors.groupSet;
                      return newErrors;
                    });
                  }
                }}
                className="h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900"
              />
              <label htmlFor="isGroupDiscussion" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                This is a group discussion
              </label>
            </div>

            {isGroupDiscussion && (
              <FloatingLabelSelect
                id="groupSet"
                label="Group Set"
                required={isGroupDiscussion}
                value={selectedGroupSet}
                onChange={(e) => {
                  setSelectedGroupSet(e.target.value);
                  if (fieldErrors.groupSet) {
                    validateGroupSet();
                  }
                }}
                onBlur={validateGroupSet}
                error={fieldErrors.groupSet}
                options={[
                  ...groupSets.map((set) => ({
                    value: set._id,
                    label: `${set.name} ${set.allowSelfSignup ? '(Self-signup enabled)' : ''}`
                  }))
                ]}
              />
            )}
          </FormFieldGroup>

          <FormFieldGroup
            title="Grading Options"
            description="Configure grading settings for this discussion"
          >
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isGraded"
                checked={isGraded}
                onChange={(e) => {
                  setIsGraded(e.target.checked);
                  if (!e.target.checked) {
                    setFieldErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors.totalPoints;
                      delete newErrors.dueDate;
                      return newErrors;
                    });
                  }
                }}
                className="h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900"
              />
              <label htmlFor="isGraded" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                Make this a graded discussion
              </label>
            </div>

            {isGraded && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FloatingLabelInput
                    id="totalPoints"
                    type="number"
                    label="Total Points"
                    required={isGraded}
                    min={1}
                    value={totalPoints.toString()}
                    onChange={(e) => {
                      const value = Math.max(1, parseInt(e.target.value) || 1);
                      setTotalPoints(value);
                      if (fieldErrors.totalPoints) {
                        validateGrading();
                      }
                    }}
                    onBlur={validateGrading}
                    error={fieldErrors.totalPoints}
                  />
                  <DatePicker
                    id="dueDate"
                    label="Due Date"
                    showTime={true}
                    value={dueDate}
                    onChange={(e) => {
                      setDueDate(e.target.value);
                      if (fieldErrors.dueDate) {
                        validateGrading();
                      }
                    }}
                    onBlur={validateGrading}
                    error={fieldErrors.dueDate}
                    helperText="Optional: Set a due date for this discussion"
                  />
                </div>

                <FloatingLabelSelect
                  id="group"
                  label="Assignment Group"
                  required={isGraded}
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  options={[
                    ...courseGroups.map((group) => ({
                      value: group.name,
                      label: `${group.name} (${group.weight}%)`
                    })),
                    { value: 'Discussions', label: 'Discussions' }
                  ]}
                />
              </>
            )}
          </FormFieldGroup>

          <FormFieldGroup
            title="Discussion Settings"
            description="Configure additional discussion settings"
          >
            <div className="space-y-4 sm:space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="requirePostBeforeSee"
                  checked={requirePostBeforeSee}
                  onChange={(e) => setRequirePostBeforeSee(e.target.checked)}
                  className="h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900"
                />
                <label htmlFor="requirePostBeforeSee" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Users must post before seeing replies
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="allowLikes"
                  checked={allowLikes}
                  onChange={(e) => setAllowLikes(e.target.checked)}
                  className="h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900"
                />
                <label htmlFor="allowLikes" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Allow liking
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="allowComments"
                  checked={allowComments}
                  onChange={(e) => setAllowComments(e.target.checked)}
                  className="h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900"
                />
                <label htmlFor="allowComments" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Allow comments
                </label>
              </div>
            </div>
          </FormFieldGroup>

          <FormFieldGroup
            title="Module Assignment"
            description="Optionally assign this thread to a module"
          >
            <FloatingLabelSelect
              id="module"
              label="Module (optional)"
              value={selectedModule}
              onChange={e => setSelectedModule(e.target.value)}
              options={[
                { value: '', label: 'No module' },
                ...(modules || []).map((mod: any) => ({
                  value: mod._id,
                  label: mod.title
                }))
              ]}
            />
          </FormFieldGroup>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 touch-manipulation active:scale-95 transition-transform"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !title.trim() || !content.trim() || (isGroupDiscussion && !selectedGroupSet)}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 border border-transparent rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation active:scale-95 transition-transform"
          >
            {isSubmitting ? 'Creating...' : 'Create Thread'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateThreadModal; 