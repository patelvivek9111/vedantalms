import React, { useState, useEffect } from 'react';
import { useModule } from '../contexts/ModuleContext';
import api from '../services/api';
import RichTextEditor from './RichTextEditor';

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
      console.error('Error creating page:', error);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-[90%] max-w-6xl h-[90vh] p-6 relative overflow-hidden flex flex-col border dark:border-gray-700">
        <button
          type="button"
          onClick={handleCancel}
          className="absolute top-4 right-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-2xl font-bold focus:outline-none"
          aria-label="Close"
        >
          ×
        </button>
        <h2 className="text-2xl font-bold mb-4 text-center text-gray-800 dark:text-gray-100">Create New Page</h2>
        <form onSubmit={handleSubmit} className="flex-1 overflow-auto">
          <div className="mb-4">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Page Title
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content</label>
            <RichTextEditor content={content} onChange={setContent} height={400} />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Attachments (optional)</label>
            <input
              type="file"
              multiple
              onChange={(e) => setAttachments(Array.from(e.target.files || []))}
              className="block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/50 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/70"
            />
          </div>
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Module</label>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Group Set</label>
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
          <div className="flex justify-end space-x-2 sticky bottom-0 bg-white dark:bg-gray-800 py-3">
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