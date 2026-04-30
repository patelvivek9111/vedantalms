import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { Calendar, Clock, ExternalLink, Link, Plus, Save, Unlink, X } from 'lucide-react';

interface GroupMeeting {
  _id: string;
  title: string;
  description?: string;
  startTime: string;
  durationMinutes: number;
  joinUrl: string;
  recordingUrl?: string;
  status: 'scheduled' | 'cancelled';
}

const toLocalInputValue = (date: Date) => {
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const GroupMeetings: React.FC = () => {
  const { groupId } = useParams();
  const { user } = useAuth();
  const canManage = user?.role === 'teacher' || user?.role === 'admin';

  const [meetings, setMeetings] = useState<GroupMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [zohoConnected, setZohoConnected] = useState(false);
  const [zohoLoading, setZohoLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    startTime: toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)),
    durationMinutes: 60,
    joinUrl: '',
    recordingUrl: '',
  });

  const loadMeetings = async () => {
    if (!groupId) return;
    try {
      setLoading(true);
      const res = await api.get(`/groups/${groupId}/meetings`);
      setMeetings(Array.isArray(res.data?.data) ? res.data.data : []);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load meetings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeetings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  useEffect(() => {
    const fetchZohoStatus = async () => {
      if (!canManage) return;
      try {
        const res = await api.get('/integrations/zoho-meeting/status');
        setZohoConnected(Boolean(res.data?.connected));
      } catch {
        setZohoConnected(false);
      }
    };
    fetchZohoStatus();
  }, [canManage]);

  const now = Date.now();
  const upcoming = useMemo(
    () => meetings.filter((m) => new Date(m.startTime).getTime() >= now).sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime)),
    [meetings, now]
  );
  const past = useMemo(
    () => meetings.filter((m) => new Date(m.startTime).getTime() < now).sort((a, b) => +new Date(b.startTime) - +new Date(a.startTime)),
    [meetings, now]
  );

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      startTime: toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)),
      durationMinutes: 60,
      joinUrl: '',
      recordingUrl: '',
    });
    setEditingId(null);
    setShowForm(false);
  };

  const openEdit = (meeting: GroupMeeting) => {
    setEditingId(meeting._id);
    setShowForm(true);
    setForm({
      title: meeting.title,
      description: meeting.description || '',
      startTime: toLocalInputValue(new Date(meeting.startTime)),
      durationMinutes: meeting.durationMinutes,
      joinUrl: meeting.joinUrl,
      recordingUrl: meeting.recordingUrl || '',
    });
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId) return;
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        startTime: new Date(form.startTime).toISOString(),
        durationMinutes: Number(form.durationMinutes),
      };
      if (editingId) {
        await api.patch(`/groups/${groupId}/meetings/${editingId}`, payload);
      } else {
        await api.post(`/groups/${groupId}/meetings`, payload);
      }
      resetForm();
      loadMeetings();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save meeting');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelMeeting = async (meeting: GroupMeeting) => {
    if (!groupId) return;
    try {
      await api.patch(`/groups/${groupId}/meetings/${meeting._id}`, { status: 'cancelled' });
      loadMeetings();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to cancel meeting');
    }
  };

  const connectZoho = async () => {
    try {
      setZohoLoading(true);
      const res = await api.get('/integrations/zoho-meeting/auth-url');
      const url = res.data?.authUrl;
      if (url) {
        window.location.href = url;
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to start Zoho connect flow');
    } finally {
      setZohoLoading(false);
    }
  };

  const disconnectZoho = async () => {
    try {
      setZohoLoading(true);
      await api.delete('/integrations/zoho-meeting/disconnect');
      setZohoConnected(false);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to disconnect Zoho');
    } finally {
      setZohoLoading(false);
    }
  };

  const quickAddRecording = async (meetingId: string) => {
    const value = window.prompt('Paste Zoho recording URL');
    if (!value) return;
    if (!groupId) return;
    try {
      await api.patch(`/groups/${groupId}/meetings/${meetingId}`, { recordingUrl: value.trim() });
      loadMeetings();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save recording URL');
    }
  };

  const section = (title: string, data: GroupMeeting[]) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">{title}</h3>
      {data.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No meetings.</p>
      ) : (
        <div className="space-y-3">
          {data.map((meeting) => (
            <div key={meeting._id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{meeting.title}</p>
                  {meeting.description ? (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{meeting.description}</p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{new Date(meeting.startTime).toLocaleString()}</span>
                    <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{meeting.durationMinutes} min</span>
                    {meeting.status === 'cancelled' ? (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">Cancelled</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  {meeting.joinUrl ? (
                    <a href={meeting.joinUrl} target="_blank" rel="noreferrer" className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white inline-flex items-center gap-1">
                      Join <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                  {meeting.recordingUrl ? (
                    <a href={meeting.recordingUrl} target="_blank" rel="noreferrer" className="px-3 py-1.5 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                      Recording
                    </a>
                  ) : null}
                  {canManage ? (
                    <>
                      <button onClick={() => openEdit(meeting)} className="px-3 py-1.5 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                        Edit
                      </button>
                      {meeting.status !== 'cancelled' ? (
                        <button onClick={() => cancelMeeting(meeting)} className="px-3 py-1.5 text-xs rounded bg-red-600 text-white">
                          Cancel
                        </button>
                      ) : null}
                      {!meeting.recordingUrl && new Date(meeting.startTime).getTime() < Date.now() ? (
                        <button onClick={() => quickAddRecording(meeting._id)} className="px-3 py-1.5 text-xs rounded bg-emerald-600 text-white">
                          Add Recording
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full h-full overflow-y-auto pb-20 lg:pb-0">
      <div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Meetings</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Zoho meeting links and recordings for this group.</p>
          </div>
          {canManage ? (
            <div className="flex items-center gap-2">
              {zohoConnected ? (
                <button onClick={disconnectZoho} disabled={zohoLoading} className="px-3 py-2 rounded bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm inline-flex items-center gap-1">
                  <Unlink className="h-4 w-4" /> {zohoLoading ? 'Working...' : 'Disconnect Zoho'}
                </button>
              ) : (
                <button onClick={connectZoho} disabled={zohoLoading} className="px-3 py-2 rounded bg-violet-600 text-white text-sm inline-flex items-center gap-1">
                  <Link className="h-4 w-4" /> {zohoLoading ? 'Connecting...' : 'Connect Zoho'}
                </button>
              )}
              <button onClick={() => { setShowForm((v) => !v); setEditingId(null); }} className="px-3 py-2 rounded bg-blue-600 text-white text-sm inline-flex items-center gap-1">
                <Plus className="h-4 w-4" /> Schedule
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

        {showForm && canManage ? (
          <form onSubmit={submitForm} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <input className="w-full border rounded p-2 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700" placeholder="Meeting title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
            <textarea className="w-full border rounded p-2 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700" placeholder="Description (optional)" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input type="datetime-local" className="w-full border rounded p-2 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} required />
              <input type="number" min={1} max={1440} className="w-full border rounded p-2 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700" value={form.durationMinutes} onChange={(e) => setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))} required />
            </div>
            <input type="url" className="w-full border rounded p-2 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700" placeholder="Zoho join URL" value={form.joinUrl} onChange={(e) => setForm((f) => ({ ...f, joinUrl: e.target.value }))} required />
            <input type="url" className="w-full border rounded p-2 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700" placeholder="Recording URL (optional)" value={form.recordingUrl} onChange={(e) => setForm((f) => ({ ...f, recordingUrl: e.target.value }))} />
            <div className="flex items-center gap-2">
              <button disabled={submitting} className="px-3 py-2 rounded bg-blue-600 text-white text-sm inline-flex items-center gap-1">
                <Save className="h-4 w-4" /> {submitting ? 'Saving...' : editingId ? 'Update Meeting' : 'Create Meeting'}
              </button>
              <button type="button" onClick={resetForm} className="px-3 py-2 rounded bg-gray-100 dark:bg-gray-700 text-sm inline-flex items-center gap-1">
                <X className="h-4 w-4" /> Cancel
              </button>
            </div>
          </form>
        ) : null}

        {loading ? <p className="text-sm text-gray-500 dark:text-gray-400">Loading meetings...</p> : null}
        {!loading && section('Upcoming Meetings', upcoming)}
        {!loading && section('Past Meetings', past)}
      </div>
    </div>
  );
};

export default GroupMeetings;
