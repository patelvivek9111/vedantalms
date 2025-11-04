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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b flex-shrink-0">
          <h2 className="text-2xl font-semibold text-gray-800">Create New Discussion Thread</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <form id="create-thread-form" onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter thread title"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Content
            </label>
            <div className="border border-gray-300 rounded-md">
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
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="isGroupDiscussion" className="ml-2 block text-sm text-gray-700">
                This is a group discussion
              </label>
            </div>

            {isGroupDiscussion && (
              <div>
                <label htmlFor="groupSet" className="block text-sm font-medium text-gray-700 mb-1">
                  Group Set
                </label>
                <select
                  id="groupSet"
                  value={selectedGroupSet}
                  onChange={(e) => setSelectedGroupSet(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  <p className="mt-1 text-sm text-red-600">
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
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="isGraded" className="ml-2 block text-sm text-gray-700">
                Make this a graded discussion
              </label>
            </div>

            {isGraded && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="totalPoints" className="block text-sm font-medium text-gray-700 mb-1">
                      Total Points
                    </label>
                    <input
                      type="number"
                      id="totalPoints"
                      value={totalPoints}
                      onChange={(e) => setTotalPoints(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="0"
                      required={isGraded}
                    />
                  </div>
                  <div>
                    <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-1">
                      Due Date
                    </label>
                    <input
                      type="datetime-local"
                      id="dueDate"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="group" className="block text-sm font-medium text-gray-700 mb-1">
                    Assignment Group
                  </label>
                  <select
                    id="group"
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <h3 className="text-lg font-medium text-gray-800">Discussion Settings</h3>
            
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="requirePostBeforeSee"
                  checked={requirePostBeforeSee}
                  onChange={(e) => setRequirePostBeforeSee(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="requirePostBeforeSee" className="ml-2 block text-sm text-gray-700">
                  Users must post before seeing replies
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="allowLikes"
                  checked={allowLikes}
                  onChange={(e) => setAllowLikes(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="allowLikes" className="ml-2 block text-sm text-gray-700">
                  Allow liking
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="allowComments"
                  checked={allowComments}
                  onChange={(e) => setAllowComments(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="allowComments" className="ml-2 block text-sm text-gray-700">
                  Allow comments
                </label>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="module" className="block text-sm font-medium text-gray-700 mb-1">
              Module (optional)
            </label>
            <select
              id="module"
              value={selectedModule}
              onChange={e => setSelectedModule(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No module</option>
              {modules && modules.map((mod: any) => (
                <option key={mod._id} value={mod._id}>{mod.title}</option>
              ))}
            </select>
          </div>
          </form>
        </div>

        <div className="flex justify-end space-x-3 p-6 border-t bg-gray-50 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-thread-form"
            disabled={isSubmitting || !title.trim() || !content.trim() || (isGroupDiscussion && !selectedGroupSet)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating...' : 'Create Thread'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateThreadModal; 