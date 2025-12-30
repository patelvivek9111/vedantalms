import React, { useState, useEffect } from 'react';
import RichTextEditor from '../RichTextEditor';
import { useAuth } from '../../context/AuthContext';

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
  const { token } = useAuth();

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
    <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 bg-white dark:bg-gray-800 rounded shadow p-4 sm:p-6 border dark:border-gray-700">
      <input
        type="text"
        id="announcement-title"
        name="title"
        className="w-full border border-gray-300 dark:border-gray-700 rounded px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm sm:text-base"
        placeholder="Topic Title"
        value={title}
        onChange={e => setTitle(e.target.value)}
        required
      />
      <label htmlFor="announcement-body" className="sr-only">Announcement body</label>
      <RichTextEditor id="announcement-body" name="body" content={body} onChange={setBody} />
      <div>
        <label htmlFor="announcement-post-to" className="block mb-1 font-medium text-gray-700 dark:text-gray-300">Post to</label>
        <select
          id="announcement-post-to"
          name="postTo"
          className="border border-gray-300 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          value={postTo}
          onChange={e => setPostTo(e.target.value)}
        >
          <option value="all">All Sections</option>
          {groupSets.map(gs => (
            <option key={gs._id} value={gs._id}>{gs.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block mb-1 font-medium text-gray-700 dark:text-gray-300">Attachments</label>
        <input 
          type="file" 
          id="announcement-attachments" 
          name="attachments" 
          multiple 
          onChange={e => setFiles(e.target.files)}
          className="block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/50 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/70"
        />
      </div>
      <div className="space-y-2">
        <label className="block font-medium text-gray-700 dark:text-gray-300">Options</label>
        <div>
          <input 
            type="checkbox" 
            id="delayPosting" 
            checked={options.delayPosting} 
            onChange={e => setOptions(o => ({ ...o, delayPosting: e.target.checked }))}
            className="h-4 w-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-gray-700 rounded focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-900"
          />
          <label htmlFor="delayPosting" className="ml-2 text-gray-700 dark:text-gray-300">Delay posting</label>
        </div>
        {options.delayPosting && (
          <div className="ml-6 mt-2">
            <label className="block text-xs mb-1 text-gray-600 dark:text-gray-400">Release date and time</label>
            <input
              type="datetime-local"
              id="announcement-delayed-until"
              name="delayedUntil"
              className="border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              value={delayedUntil}
              onChange={e => setDelayedUntil(e.target.value)}
              required
            />
          </div>
        )}
        <div>
          <input 
            type="checkbox" 
            id="allowComments" 
            checked={options.allowComments} 
            onChange={e => setOptions(o => ({ ...o, allowComments: e.target.checked }))}
            className="h-4 w-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-gray-700 rounded focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-900"
          />
          <label htmlFor="allowComments" className="ml-2 text-gray-700 dark:text-gray-300">Allow users to comment</label>
        </div>
        <div className="ml-6">
          <input 
            type="checkbox" 
            id="requirePostBeforeSeeingReplies" 
            checked={options.requirePostBeforeSeeingReplies} 
            onChange={e => setOptions(o => ({ ...o, requirePostBeforeSeeingReplies: e.target.checked }))} 
            disabled={!options.allowComments}
            className="h-4 w-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-gray-700 rounded focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-900 disabled:opacity-50"
          />
          <label htmlFor="requirePostBeforeSeeingReplies" className="ml-2 text-gray-700 dark:text-gray-300">Users must post before seeing replies</label>
        </div>
        <div>
          <input 
            type="checkbox" 
            id="enablePodcastFeed" 
            checked={options.enablePodcastFeed} 
            onChange={e => setOptions(o => ({ ...o, enablePodcastFeed: e.target.checked }))}
            className="h-4 w-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-gray-700 rounded focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-900"
          />
          <label htmlFor="enablePodcastFeed" className="ml-2 text-gray-700 dark:text-gray-300">Enable podcast feed</label>
        </div>
        <div>
          <input 
            type="checkbox" 
            id="allowLiking" 
            checked={options.allowLiking} 
            onChange={e => setOptions(o => ({ ...o, allowLiking: e.target.checked }))}
            className="h-4 w-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-gray-700 rounded focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-900"
          />
          <label htmlFor="allowLiking" className="ml-2 text-gray-700 dark:text-gray-300">Allow liking</label>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button
          type="button"
          className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700 dark:hover:bg-blue-600"
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
};

export default AnnouncementForm; 