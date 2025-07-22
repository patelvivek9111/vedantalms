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
    <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded shadow p-6">
      <input
        type="text"
        id="announcement-title"
        name="title"
        className="w-full border rounded px-3 py-2"
        placeholder="Topic Title"
        value={title}
        onChange={e => setTitle(e.target.value)}
        required
      />
      <RichTextEditor content={body} onChange={setBody} />
      <div>
        <label className="block mb-1 font-medium">Post to</label>
        <select
          id="announcement-post-to"
          name="postTo"
          className="border rounded px-2 py-1"
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
        <label className="block mb-1 font-medium">Attachments</label>
        <input type="file" id="announcement-attachments" name="attachments" multiple onChange={e => setFiles(e.target.files)} />
      </div>
      <div className="space-y-2">
        <label className="block font-medium">Options</label>
        <div>
          <input type="checkbox" id="delayPosting" checked={options.delayPosting} onChange={e => setOptions(o => ({ ...o, delayPosting: e.target.checked }))} />
          <label htmlFor="delayPosting" className="ml-2">Delay posting</label>
        </div>
        {options.delayPosting && (
          <div className="ml-6 mt-2">
            <label className="block text-xs mb-1">Release date and time</label>
            <input
              type="datetime-local"
              id="announcement-delayed-until"
              name="delayedUntil"
              className="border rounded px-2 py-1 text-sm"
              value={delayedUntil}
              onChange={e => setDelayedUntil(e.target.value)}
              required
            />
          </div>
        )}
        <div>
          <input type="checkbox" id="allowComments" checked={options.allowComments} onChange={e => setOptions(o => ({ ...o, allowComments: e.target.checked }))} />
          <label htmlFor="allowComments" className="ml-2">Allow users to comment</label>
        </div>
        <div className="ml-6">
          <input type="checkbox" id="requirePostBeforeSeeingReplies" checked={options.requirePostBeforeSeeingReplies} onChange={e => setOptions(o => ({ ...o, requirePostBeforeSeeingReplies: e.target.checked }))} disabled={!options.allowComments} />
          <label htmlFor="requirePostBeforeSeeingReplies" className="ml-2">Users must post before seeing replies</label>
        </div>
        <div>
          <input type="checkbox" id="enablePodcastFeed" checked={options.enablePodcastFeed} onChange={e => setOptions(o => ({ ...o, enablePodcastFeed: e.target.checked }))} />
          <label htmlFor="enablePodcastFeed" className="ml-2">Enable podcast feed</label>
        </div>
        <div>
          <input type="checkbox" id="allowLiking" checked={options.allowLiking} onChange={e => setOptions(o => ({ ...o, allowLiking: e.target.checked }))} />
          <label htmlFor="allowLiking" className="ml-2">Allow liking</label>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button
          type="button"
          className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
};

export default AnnouncementForm; 