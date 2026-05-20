import React, { useEffect, useState } from 'react';
import { Search, Users, UserPlus, Trash2, Loader2 } from 'lucide-react';
import api from '../../services/api';
import ProfileImage from '../common/ProfileImage';
import { useAuth } from '../../contexts/AuthContext';

interface Member {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture?: string;
}

interface GroupPeopleProps {
  groupId: string;
  groupSetId: string;
}

const GroupPeople: React.FC<GroupPeopleProps> = ({ groupId, groupSetId }) => {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Member[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);

  const canManage = user?.role === 'teacher' || user?.role === 'admin';

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get(`/groups/${groupId}/members`)
      .then((res: { data?: { data?: Member[] } | Member[] }) => {
        const membersData = (res.data as { data?: Member[] })?.data ?? res.data;
        setMembers(Array.isArray(membersData) ? membersData : []);
      })
      .catch(() => setError('Failed to load group members'))
      .finally(() => setLoading(false));
  }, [groupId]);

  useEffect(() => {
    if (!search.trim() || !groupSetId || groupSetId === 'temp') {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    api
      .get(`/groups/sets/${groupSetId}/available-students?search=${encodeURIComponent(search)}`)
      .then((res: { data?: { data?: Member[] } | Member[] }) => {
        const studentsData = (res.data as { data?: Member[] })?.data ?? res.data;
        setSearchResults(Array.isArray(studentsData) ? studentsData : []);
      })
      .catch(() => setSearchResults([]))
      .finally(() => setSearchLoading(false));
  }, [search, groupSetId]);

  const handleRemove = (userId: string) => {
    setRemoving(userId);
    api
      .delete(`/groups/${groupId}/members/${userId}`)
      .then(() => setMembers((prev) => prev.filter((m) => m._id !== userId)))
      .catch(() => setError('Failed to remove member'))
      .finally(() => setRemoving(null));
  };

  const handleAdd = (userId: string) => {
    setAdding(userId);
    api
      .post(`/groups/${groupId}/members`, { userId })
      .then(() =>
        api.get(`/groups/${groupId}/members`).then((res: { data?: { data?: Member[] } | Member[] }) => {
          const membersData = (res.data as { data?: Member[] })?.data ?? res.data;
          setMembers(Array.isArray(membersData) ? membersData : []);
        })
      )
      .then(() => {
        setSearch('');
        setSearchResults([]);
      })
      .catch(() => setError('Failed to add member'))
      .finally(() => setAdding(null));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Loading group members…</p>
      </div>
    );
  }

  if (error && members.length === 0) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-900/20">
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-100">
              Group Members
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Manage group members and add new students
            </p>
          </div>
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
            <Users className="h-4 w-4 text-slate-500" />
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {canManage && groupSetId && groupSetId !== 'temp' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
            <UserPlus className="h-4 w-4 text-slate-500" />
            Add students
          </h3>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              id="group-search-students"
              name="search"
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
              placeholder="Search students by name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {searchLoading && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
            )}
          </div>

          {search && searchResults.length > 0 && (
            <div className="mt-3 max-h-60 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
              {searchResults.map((student, idx) => (
                <div
                  key={student._id}
                  className={`flex items-center justify-between gap-3 bg-white p-3 dark:bg-slate-900 ${
                    idx > 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <ProfileImage
                      firstName={student.firstName}
                      lastName={student.lastName}
                      profilePicture={student.profilePicture}
                      size="md"
                    />
                    <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                      {student.firstName} {student.lastName}
                    </p>
                    <p className="truncate text-sm text-slate-500 dark:text-slate-400">{student.email}</p>
                  </div>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
                    onClick={() => handleAdd(student._id)}
                    disabled={adding === student._id}
                  >
                    {adding === student._id ? 'Adding…' : 'Add'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {search && !searchLoading && searchResults.length === 0 && (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No students found.</p>
          )}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {members.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              <Users className="h-7 w-7 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">No members yet</h3>
            <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
              {canManage
                ? 'Search above to add students to this group.'
                : 'This group does not have any members yet.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {members.map((member, index) => (
              <li key={member._id}>
                <div className="flex items-center gap-3 p-4 sm:gap-4 sm:p-5">
                  <ProfileImage
                    firstName={member.firstName}
                    lastName={member.lastName}
                    profilePicture={member.profilePicture}
                    size="lg"
                  />
                  <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                        {member.firstName} {member.lastName}
                      </p>
                      {index === 0 && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                          Leader
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
                      {member.email}
                    </p>
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300 dark:hover:bg-rose-900/50"
                      onClick={() => handleRemove(member._id)}
                      disabled={removing === member._id}
                      title="Remove member"
                    >
                      {removing === member._id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      <span className="hidden sm:inline">
                        {removing === member._id ? 'Removing…' : 'Remove'}
                      </span>
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default GroupPeople;
