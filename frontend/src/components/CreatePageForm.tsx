import React, { useState, useEffect } from 'react';
import { useModule } from '../contexts/ModuleContext';
import api from '../services/api';
import RichTextEditor from './RichTextEditor';
import logger from '../utils/logger';

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
  const { createPage } = useModule();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (!selectedModule && !selectedGroupSet) return;
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
      logger.error('Error creating page', error);
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 p-2 sm:p-4 lg:left-[336px] lg:right-0">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full h-full lg:h-[calc(100vh-2rem)] lg:max-w-none lg:rounded-none lg:shadow-none p-4 sm:p-6 lg:p-8 relative overflow-hidden flex flex-col border dark:border-gray-700 lg:border-l lg:border-r-0 lg:border-t-0 lg:border-b-0">
        <button
          type="button"
          onClick={handleCancel}
          className="absolute top-2 right-2 sm:top-4 sm:right-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl sm:text-2xl font-bold focus:outline-none z-10"
          aria-label="Close"
        >
          ×
        </button>
        <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-center text-gray-800 dark:text-gray-100">Create New Page</h2>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pb-4">
          <div className="mb-4">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Page Title
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              required
            />
          </div>
          <div className="mb-4">
            <label htmlFor="page-content" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content</label>
            <RichTextEditor id="page-content" name="content" content={content} onChange={setContent} height={400} />
          </div>
          <div className="mb-6">
            <label htmlFor="attachments" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Attachments (optional)</label>
            <input
              type="file"
              id="attachments"
              name="attachments"
              multiple
              onChange={(e) => setAttachments(Array.from(e.target.files || []))}
              className="block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/50 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/70"
            />
          </div>
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex-1">
              <label htmlFor="page-module" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Module</label>
              <select
                id="page-module"
                name="module"
                value={selectedModule}
                onChange={e => {
                  setSelectedModule(e.target.value);
                  if (e.target.value) setSelectedGroupSet('');
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                disabled={!!selectedGroupSet}
              >
                <option value="">Select a module</option>
                {modules.map(mod => (
                  <option key={mod._id} value={mod._id}>{mod.title}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label htmlFor="page-group-set" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Group Set</label>
              <select
                id="page-group-set"
                name="groupSet"
                value={selectedGroupSet}
                onChange={e => {
                  setSelectedGroupSet(e.target.value);
                  if (e.target.value) setSelectedModule('');
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                disabled={!!selectedModule}
              >
                <option value="">Select a group set</option>
                {groupSets.map(gs => (
                  <option key={gs._id} value={gs._id}>{gs.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end space-x-2 py-3 mt-4 border-t dark:border-gray-700">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-500 dark:bg-gray-600 text-white rounded hover:bg-gray-600 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (!selectedModule && !selectedGroupSet)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Page'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreatePageForm; 