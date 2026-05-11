import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { Calendar, ExternalLink, Plus, Save, Video, X } from 'lucide-react';

interface CourseMeetingsSectionProps {
  courseId: string;
  canManage: boolean;
}

interface CourseMeeting {
  _id: string;
  title: string;
  description?: string;
  startTime: string;
  durationMinutes: number;
  joinUrl: string;
  recordingUrl?: string;
  status: 'scheduled' | 'cancelled';
  group?: { _id: string; name: string };
}

const toLocalInputValue = (date: Date) => {
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatMeetingDateTime = (isoDate: string) =>
  new Date(isoDate).toLocaleString(undefined, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

const getMeetingStatus = (meeting: CourseMeeting) => {
  const now = Date.now();
  const start = new Date(meeting.startTime).getTime();
  const end = start + meeting.durationMinutes * 60 * 1000;

  if (meeting.status === 'cancelled') {
    return {
      label: 'Cancelled',
      className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    };
  }

  if (now >= start && now <= end) {
    return {
      label: 'Live now',
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    };
  }

  if (now < start) {
    const mins = Math.max(1, Math.round((start - now) / (1000 * 60)));
    if (mins < 60) {
      return {
        label: `Starts in ${mins} min`,
        className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
      };
    }
    const hours = Math.round(mins / 60);
    return {
      label: `Starts in ${hours} hr`,
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    };
  }

  return {
    label: 'Completed',
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  };
};

const CourseMeetingsSection: React.FC<CourseMeetingsSectionProps> = ({ courseId, canManage }) => {
  const initialDateTime = toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000));
  const [meetings, setMeetings] = useState<CourseMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'previous' | 'recordings'>('upcoming');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    startDate: initialDateTime.split('T')[0],
    startTime: initialDateTime.split('T')[1],
    durationMinutes: 40,
    joinUrl: '',
    recordingUrl: '',
  });

  const loadData = async () => {
    if (!courseId) return;
    try {
      setLoading(true);
      const res = await api.get(`/groups/course/${courseId}/meetings`);
      setMeetings(Array.isArray(res.data?.data) ? res.data.data : []);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load course meetings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const now = Date.now();
  const upcoming = useMemo(
    () =>
      meetings
        .filter((m) => {
          const start = new Date(m.startTime).getTime();
          const end = start + m.durationMinutes * 60 * 1000;
          // Keep live meetings in "Upcoming" until fully finished.
          return now <= end;
        })
        .sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime)),
    [meetings, now]
  );
  const past = useMemo(
    () =>
      meetings
        .filter((m) => {
          const start = new Date(m.startTime).getTime();
          const end = start + m.durationMinutes * 60 * 1000;
          return now > end;
        })
        .sort((a, b) => +new Date(b.startTime) - +new Date(a.startTime)),
    [meetings, now]
  );
  const recordings = useMemo(
    () =>
      meetings
        .filter((m) => Boolean(m.recordingUrl))
        .sort((a, b) => +new Date(b.startTime) - +new Date(a.startTime)),
    [meetings]
  );

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;
    setSubmitting(true);
    try {
      await api.post(`/groups/course/${courseId}/meetings`, {
        title: form.title,
        description: form.description,
        startTime: new Date(`${form.startDate}T${form.startTime}`).toISOString(),
        durationMinutes: form.durationMinutes,
        joinUrl: form.joinUrl,
        recordingUrl: form.recordingUrl,
      });
      setShowForm(false);
      setForm((f) => ({ ...f, title: '', description: '', joinUrl: '', recordingUrl: '' }));
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create meeting');
    } finally {
      setSubmitting(false);
    }
  };

  const quickAddRecording = async (meetingId: string) => {
    const value = window.prompt('Paste recording URL');
    if (!value) return;
    try {
      const meeting = meetings.find((m) => m._id === meetingId);
      if (!meeting) return;
      await api.patch(`/groups/course/${courseId}/meetings/${meetingId}`, { recordingUrl: value.trim() });
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update recording');
    }
  };

  const section = (title: string, data: CourseMeeting[]) => (
    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur rounded-2xl shadow-sm border border-gray-200/80 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium">
          {data.length} {data.length === 1 ? 'meeting' : 'meetings'}
        </span>
      </div>
      {data.length === 0 ? (
        <div className="text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center">
          No meetings yet.
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((meeting) => {
            const status = getMeetingStatus(meeting);
            return (
            <div key={meeting._id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-gradient-to-r from-transparent to-blue-50/30 dark:to-blue-900/10">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 text-lg">{meeting.title}</p>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1 inline-flex items-center gap-1.5">
                    <Video className="h-3.5 w-3.5" />
                    Course Meeting
                  </p>
                  {meeting.description ? <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">{meeting.description}</p> : null}
                  <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50 dark:bg-gray-900/60"><Calendar className="h-3.5 w-3.5" />{formatMeetingDateTime(meeting.startTime)}</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap justify-end shrink-0">
                  <a href={meeting.joinUrl} target="_blank" rel="noreferrer" className="px-3.5 py-2 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1.5 transition-colors">
                    Join <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  {meeting.recordingUrl ? (
                    <a href={meeting.recordingUrl} target="_blank" rel="noreferrer" className="px-3.5 py-2 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 transition-colors">
                      Recording
                    </a>
                  ) : null}
                  {canManage && !meeting.recordingUrl && new Date(meeting.startTime).getTime() < Date.now() ? (
                    <button onClick={() => quickAddRecording(meeting._id)} className="px-3.5 py-2 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">
                      Add Recording
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          )})}
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full h-full overflow-y-auto pb-20 lg:pb-0">
      <div className="space-y-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:p-5">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50/80 p-3 dark:border-gray-700 dark:bg-gray-800/70">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Create and manage meetings for this course</p>
            {canManage ? (
              <button
                onClick={() => setShowForm((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" /> Schedule
              </button>
            ) : null}
          </div>
        </div>

        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
            {error}
          </p>
        ) : null}
        {showForm && canManage ? (
          <form onSubmit={submitCreate} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 space-y-3">
            <input className="w-full border rounded-lg p-2.5 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition" placeholder="Meeting title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
            <textarea className="w-full border rounded-lg p-2.5 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition" placeholder="Description (optional)" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input type="date" className="w-full border rounded-lg p-2.5 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} required />
              <input type="time" step={60} className="w-full border rounded-lg p-2.5 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} required />
            </div>
            <input type="url" className="w-full border rounded-lg p-2.5 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition" placeholder="Zoho join URL" value={form.joinUrl} onChange={(e) => setForm((f) => ({ ...f, joinUrl: e.target.value }))} required />
            <input type="url" className="w-full border rounded-lg p-2.5 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition" placeholder="Recording URL (optional)" value={form.recordingUrl} onChange={(e) => setForm((f) => ({ ...f, recordingUrl: e.target.value }))} />
            <div className="flex items-center gap-2">
              <button disabled={submitting} className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-70 text-white text-sm inline-flex items-center gap-1.5 transition-colors">
                <Save className="h-4 w-4" /> {submitting ? 'Saving...' : 'Create Meeting'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm inline-flex items-center gap-1.5 transition-colors">
                <X className="h-4 w-4" /> Cancel
              </button>
            </div>
          </form>
        ) : null}

        {loading ? <p className="text-sm text-gray-500 dark:text-gray-400">Loading meetings...</p> : null}
        {!loading ? (
          <div className="space-y-4">
            <div className="inline-flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
              <button
                type="button"
                onClick={() => setActiveTab('upcoming')}
                className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors ${
                  activeTab === 'upcoming'
                    ? 'bg-white text-blue-700 shadow-sm dark:bg-gray-900 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700'
                }`}
              >
                Upcoming Meetings
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('previous')}
                className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors ${
                  activeTab === 'previous'
                    ? 'bg-white text-blue-700 shadow-sm dark:bg-gray-900 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700'
                }`}
              >
                Previous Meetings
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('recordings')}
                className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors ${
                  activeTab === 'recordings'
                    ? 'bg-white text-blue-700 shadow-sm dark:bg-gray-900 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700'
                }`}
              >
                Cloud Recordings
              </button>
            </div>

            {activeTab === 'upcoming' && section('Upcoming Meetings', upcoming)}
            {activeTab === 'previous' && section('Previous Meetings', past)}
            {activeTab === 'recordings' && section('Cloud Recordings', recordings)}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default CourseMeetingsSection;
