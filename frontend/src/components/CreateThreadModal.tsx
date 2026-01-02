import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { API_URL } from '../config';
import RichTextEditor from './RichTextEditor';
import axios from 'axios';

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
        console.error('Error fetching group sets:', err);
      }
    };
    fetchGroupSets();
  }, [courseId, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

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
      } else {
        setError('Failed to create thread');
      }
    } catch (err) {
      console.error('Error creating thread:', err);
      setError('Failed to create thread. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6 border dark:border-gray-700">
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-2xl font-semibold text-gray-800 dark:text-gray-100">Create New Discussion Thread</h2>
        <button
          onClick={onClose}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none flex-shrink-0"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form id="create-thread-form" onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 rounded">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              placeholder="Enter thread title"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Content
            </label>
            <div className="border border-gray-300 dark:border-gray-700 rounded-md">
              <RichTextEditor
                content={content}
                onChange={setContent}
                placeholder="Write your thread content..."
                className="h-64"
              />
            </div>
          </div>

          {/* Group Discussion Options */}
          <div className="mb-4 space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isGroupDiscussion"
                checked={isGroupDiscussion}
                onChange={(e) => setIsGroupDiscussion(e.target.checked)}
                className="h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900"
              />
              <label htmlFor="isGroupDiscussion" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                This is a group discussion
              </label>
            </div>

            {isGroupDiscussion && (
              <div>
                <label htmlFor="groupSet" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Group Set
                </label>
                <select
                  id="groupSet"
                  value={selectedGroupSet}
                  onChange={(e) => setSelectedGroupSet(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  required={isGroupDiscussion}
                >
                  <option value="">Select a group set</option>
                  {groupSets.map((set) => (
                    <option key={set._id} value={set._id}>
                      {set.name} {set.allowSelfSignup ? '(Self-signup enabled)' : ''}
                    </option>
                  ))}
                </select>
                {isGroupDiscussion && !selectedGroupSet && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    Please select a group set for the group discussion
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Grading Options */}
          <div className="mb-4 space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isGraded"
                checked={isGraded}
                onChange={(e) => setIsGraded(e.target.checked)}
                className="h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900"
              />
              <label htmlFor="isGraded" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                Make this a graded discussion
              </label>
            </div>

            {isGraded && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="totalPoints" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Total Points
                    </label>
                    <input
                      type="number"
                      id="totalPoints"
                      value={totalPoints}
                      onChange={(e) => setTotalPoints(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                      min="0"
                      required={isGraded}
                    />
                  </div>
                  <div>
                    <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Due Date
                    </label>
                    <input
                      type="datetime-local"
                      id="dueDate"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="group" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Assignment Group
                  </label>
                  <select
                    id="group"
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    required={isGraded}
                  >
                    {courseGroups.map((group) => (
                      <option key={group.name} value={group.name}>
                        {group.name} ({group.weight}%)
                      </option>
                    ))}
                    <option value="Discussions">Discussions</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Discussion Settings */}
          <div className="mb-4 space-y-4">
            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">Discussion Settings</h3>
            
            <div className="space-y-3">
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
          </div>

          <div className="mb-4">
            <label htmlFor="module" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Module (optional)
            </label>
            <select
              id="module"
              value={selectedModule}
              onChange={e => setSelectedModule(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            >
              <option value="">No module</option>
              {modules && modules.map((mod: any) => (
                <option key={mod._id} value={mod._id}>{mod.title}</option>
              ))}
            </select>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !title.trim() || !content.trim() || (isGroupDiscussion && !selectedGroupSet)}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 border border-transparent rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating...' : 'Create Thread'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateThreadModal; 