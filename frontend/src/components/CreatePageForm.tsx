import React, { useState, useEffect } from 'react';
import { useModule } from '../contexts/ModuleContext';
import api from '../services/api';

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
      await createPage(payload);
      setTitle('');
      setContent('');
      setSelectedModule('');
      setSelectedGroupSet('');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-8 relative">
        <button
          type="button"
          onClick={handleCancel}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl font-bold focus:outline-none"
          aria-label="Close"
        >
          ×
        </button>
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Create New Page</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Page Title
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="mb-4">
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
              Content
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={5}
            />
          </div>
          <div className="mb-6 flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Module</label>
              <select
                id="page-module"
                name="module"
                value={selectedModule}
                onChange={e => {
                  setSelectedModule(e.target.value);
                  if (e.target.value) setSelectedGroupSet('');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                disabled={!!selectedGroupSet}
              >
                <option value="">Select a module</option>
                {modules.map(mod => (
                  <option key={mod._id} value={mod._id}>{mod.title}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Group Set</label>
              <select
                id="page-group-set"
                name="groupSet"
                value={selectedGroupSet}
                onChange={e => {
                  setSelectedGroupSet(e.target.value);
                  if (e.target.value) setSelectedModule('');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                disabled={!!selectedModule}
              >
                <option value="">Select a group set</option>
                {groupSets.map(gs => (
                  <option key={gs._id} value={gs._id}>{gs.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (!selectedModule && !selectedGroupSet)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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