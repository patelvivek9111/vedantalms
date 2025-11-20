import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { getImageUrl } from '../../services/api';

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
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  // For searching and adding students
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Member[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    axios
      .get(`/api/groups/${groupId}/members`)
      .then((res) => {
        setMembers(res.data);
        setLoading(false);
      })
      .catch((err) => {
        setError('Failed to load group members');
        setLoading(false);
      });
  }, [groupId]);

  // Search for available students
  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    axios
      .get(`/api/groups/sets/${groupSetId}/available-students?search=${encodeURIComponent(search)}`)
      .then((res) => {
        setSearchResults(res.data);
        setSearchLoading(false);
      })
      .catch(() => {
        setSearchResults([]);
        setSearchLoading(false);
      });
  }, [search, groupSetId]);

  const handleRemove = (userId: string) => {
    setRemoving(userId);
    axios
      .delete(`/api/groups/${groupId}/members/${userId}`)
      .then(() => {
        setMembers((prev) => prev.filter((m) => m._id !== userId));
        setRemoving(null);
      })
      .catch(() => {
        setError('Failed to remove member');
        setRemoving(null);
      });
  };

  const handleAdd = (userId: string) => {
    setAdding(userId);
    axios
      .post(`/api/groups/${groupId}/members`, { userId })
      .then(() => {
        // Refetch members and clear search
        axios.get(`/api/groups/${groupId}/members`).then((res) => setMembers(res.data));
        setSearch('');
        setSearchResults([]);
        setAdding(null);
      })
      .catch(() => {
        setError('Failed to add member');
        setAdding(null);
      });
  };

  if (loading) return <div className="text-gray-500 dark:text-gray-400">Loading group members...</div>;
  if (error) return <div className="text-red-500 dark:text-red-400">{error}</div>;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Search bar for adding students */}
      <div>
        <input
          type="text"
          id="group-search-students"
          name="search"
          className="w-full border border-gray-300 dark:border-gray-700 rounded px-4 py-2 mb-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          placeholder="Search students by name or email"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {searchLoading && <div className="text-gray-500 dark:text-gray-400">Searching...</div>}
        {search && searchResults.length > 0 && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow p-2 mt-1">
            {searchResults.map(student => (
              <div key={student._id} className="flex justify-between items-center py-2 px-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    {student.profilePicture ? (
                      <img
                        src={student.profilePicture.startsWith('http')
                          ? student.profilePicture
                          : getImageUrl(student.profilePicture)}
                        alt={`${student.firstName} ${student.lastName}`}
                        className="w-8 h-8 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                        onError={(e) => {
                          // Hide the failed image and show fallback
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                          if (fallback) {
                            fallback.style.display = 'flex';
                          }
                        }}
                      />
                    ) : null}
                    {/* Fallback avatar - always present but hidden when image loads */}
                    <div 
                      className={`w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold ${student.profilePicture ? 'hidden' : ''}`}
                      style={{ display: student.profilePicture ? 'none' : 'flex' }}
                    >
                      {student.firstName.charAt(0)}{student.lastName.charAt(0)}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-sm sm:text-base text-gray-900 dark:text-gray-100 block truncate">{student.firstName} {student.lastName}</span>
                    <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 block truncate">{student.email}</span>
                  </div>
                </div>
                <button
                  className="bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white px-2 sm:px-3 py-1 rounded text-xs sm:text-sm flex-shrink-0"
                  onClick={() => handleAdd(student._id)}
                  disabled={adding === student._id}
                >
                  {adding === student._id ? 'Adding...' : 'Add'}
                </button>
              </div>
            ))}
          </div>
        )}
        {search && !searchLoading && searchResults.length === 0 && (
          <div className="text-gray-500 dark:text-gray-400 p-2">No students found.</div>
        )}
      </div>
      {/* Members list */}
      {members.length === 0 ? (
        <div className="text-gray-500 dark:text-gray-400">No members in this group.</div>
      ) : (
        members.map((member) => (
          <div
            key={member._id}
            className="bg-white dark:bg-gray-800 rounded shadow p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border dark:border-gray-700"
          >
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
              <div className="relative flex-shrink-0">
                {member.profilePicture ? (
                  <img
                    src={member.profilePicture.startsWith('http')
                      ? member.profilePicture
                      : getImageUrl(member.profilePicture)}
                    alt={`${member.firstName} ${member.lastName}`}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                    onError={(e) => {
                      // Hide the failed image and show fallback
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                      if (fallback) {
                        fallback.style.display = 'flex';
                      }
                    }}
                  />
                ) : null}
                {/* Fallback avatar - always present but hidden when image loads */}
                <div 
                  className={`w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-bold ${member.profilePicture ? 'hidden' : ''}`}
                  style={{ display: member.profilePicture ? 'none' : 'flex' }}
                >
                  {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-base sm:text-lg text-gray-900 dark:text-gray-100 truncate">
                  {member.firstName} {member.lastName}
                </div>
                <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{member.email}</div>
              </div>
            </div>
            <button
              className="w-full sm:w-auto mt-2 sm:mt-0 bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600 text-white px-3 sm:px-4 py-2 rounded text-sm sm:text-base"
              onClick={() => handleRemove(member._id)}
              disabled={removing === member._id}
            >
              {removing === member._id ? 'Removing...' : 'Remove'}
            </button>
          </div>
        ))
      )}
    </div>
  );
};

export default GroupPeople; 