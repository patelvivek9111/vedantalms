import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface Member {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
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

  if (loading) return <div>Loading group members...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="space-y-4">
      {/* Search bar for adding students */}
      <div>
        <input
          type="text"
          id="group-search-students"
          name="search"
          className="w-full border rounded px-4 py-2 mb-2"
          placeholder="Search students by name or email"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {searchLoading && <div className="text-gray-500">Searching...</div>}
        {search && searchResults.length > 0 && (
          <div className="bg-white border rounded shadow p-2 mt-1">
            {searchResults.map(student => (
              <div key={student._id} className="flex justify-between items-center py-1 px-2 hover:bg-gray-50 rounded">
                <div>
                  <span className="font-medium">{student.firstName} {student.lastName}</span>
                  <span className="text-gray-500 ml-2">{student.email}</span>
                </div>
                <button
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
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
          <div className="text-gray-500 p-2">No students found.</div>
        )}
      </div>
      {/* Members list */}
      {members.length === 0 ? (
        <div>No members in this group.</div>
      ) : (
        members.map((member) => (
          <div
            key={member._id}
            className="bg-white rounded shadow p-4 flex flex-col md:flex-row md:items-center md:justify-between"
          >
            <div>
              <div className="font-semibold text-lg">
                {member.firstName} {member.lastName}
              </div>
              <div className="text-gray-500">{member.email}</div>
            </div>
            <button
              className="mt-2 md:mt-0 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
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