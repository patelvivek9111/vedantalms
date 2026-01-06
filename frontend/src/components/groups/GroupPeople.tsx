import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { getImageUrl } from '../../services/api';

// Detect mobile device
const useMobileDevice = () => {
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileDevice(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return isMobileDevice;
};

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
  const isMobileDevice = useMobileDevice();

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

  if (loading) {
    return (
      <div className={`${isMobileDevice ? 'p-4' : 'p-6'} text-center`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 dark:border-blue-400 mx-auto"></div>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading group members...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className={`${isMobileDevice ? 'p-4' : 'p-6'} text-center`}>
        <div className="text-red-500 dark:text-red-400 text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full overflow-y-auto ${isMobileDevice ? 'pb-20' : ''}`}>
      {/* Header - Mobile Optimized */}
      <div className={`bg-white dark:bg-gray-800 ${isMobileDevice ? 'p-3 mb-3 border-b' : 'p-4 sm:p-6 mb-4 sm:mb-6'} border-gray-200 dark:border-gray-700`}>
        <h2 className={`${isMobileDevice ? 'text-lg' : 'text-xl sm:text-2xl'} font-bold text-gray-800 dark:text-gray-100`}>
          Group Members
        </h2>
        {!isMobileDevice && (
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
            Manage group members and add new students
          </p>
        )}
      </div>

      <div className={`${isMobileDevice ? 'px-4 space-y-3' : 'px-4 sm:px-6 space-y-4'} pb-4 sm:pb-6`}>
      {/* Search bar for adding students */}
      <div>
        <input
          type="text"
          id="group-search-students"
          name="search"
            className={`w-full border border-gray-300 dark:border-gray-700 rounded-lg ${isMobileDevice ? 'px-3 py-2.5 text-sm' : 'px-4 py-2'} bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 mb-2 touch-manipulation`}
          placeholder="Search students by name or email"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
          {searchLoading && (
            <div className={`${isMobileDevice ? 'text-xs' : 'text-sm'} text-gray-500 dark:text-gray-400 py-2`}>
              Searching...
            </div>
          )}
        {search && searchResults.length > 0 && (
            <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg ${isMobileDevice ? 'p-2 mt-2' : 'p-3 mt-2'}`}>
            {searchResults.map(student => (
                <div 
                  key={student._id} 
                  className={`${isMobileDevice ? 'py-2.5 px-2' : 'py-3 px-3'} hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors ${searchResults.indexOf(student) !== searchResults.length - 1 ? 'mb-2 border-b border-gray-100 dark:border-gray-700' : ''}`}
                >
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <div className="relative flex-shrink-0">
                    {student.profilePicture ? (
                      <img
                        src={student.profilePicture.startsWith('http')
                          ? student.profilePicture
                          : getImageUrl(student.profilePicture)}
                        alt={`${student.firstName} ${student.lastName}`}
                            className={`${isMobileDevice ? 'w-8 h-8' : 'w-10 h-10'} rounded-full object-cover border-2 border-gray-200 dark:border-gray-700`}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                          if (fallback) {
                            fallback.style.display = 'flex';
                          }
                        }}
                      />
                    ) : null}
                    <div 
                          className={`${isMobileDevice ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'} bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold`}
                      style={{ display: student.profilePicture ? 'none' : 'flex' }}
                    >
                      {student.firstName.charAt(0)}{student.lastName.charAt(0)}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                        <span className={`${isMobileDevice ? 'text-sm' : 'text-base'} font-medium text-gray-900 dark:text-gray-100 block truncate`}>
                          {student.firstName} {student.lastName}
                        </span>
                        <span className={`${isMobileDevice ? 'text-xs' : 'text-sm'} text-gray-500 dark:text-gray-400 block truncate`}>
                          {student.email}
                        </span>
                  </div>
                </div>
                <button
                      className={`bg-gradient-to-r from-blue-600 to-blue-500 dark:from-blue-500 dark:to-blue-600 hover:from-blue-700 hover:to-blue-600 dark:hover:from-blue-600 dark:hover:to-blue-700 text-white ${isMobileDevice ? 'px-3 py-1.5 text-xs' : 'px-3 py-1.5 text-sm'} rounded-lg font-medium flex-shrink-0 shadow-md hover:shadow-lg transition-all active:scale-95 touch-manipulation disabled:opacity-50`}
                  onClick={() => handleAdd(student._id)}
                  disabled={adding === student._id}
                >
                  {adding === student._id ? 'Adding...' : 'Add'}
                </button>
                  </div>
              </div>
            ))}
          </div>
        )}
        {search && !searchLoading && searchResults.length === 0 && (
            <div className={`${isMobileDevice ? 'text-xs p-2' : 'text-sm p-3'} text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg mt-2`}>
              No students found.
            </div>
        )}
      </div>
      {/* Members list */}
      {members.length === 0 ? (
          <div className={`${isMobileDevice ? 'py-12 px-4' : 'py-16'} text-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600`}>
            <div className="flex flex-col items-center">
              <div className={`${isMobileDevice ? 'w-12 h-12' : 'w-16 h-16'} bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4`}>
                <svg className={`${isMobileDevice ? 'h-6 w-6' : 'h-8 w-8'} text-gray-400 dark:text-gray-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h3 className={`${isMobileDevice ? 'text-base' : 'text-lg'} font-bold text-gray-900 dark:text-gray-100 mb-2`}>
                No members yet
              </h3>
              <p className={`${isMobileDevice ? 'text-xs' : 'text-sm'} text-gray-600 dark:text-gray-400`}>
                No members in this group.
              </p>
            </div>
          </div>
      ) : (
          <div className={`${isMobileDevice ? 'space-y-3' : 'space-y-4'}`}>
            {members.map((member) => (
          <div
            key={member._id}
                className={`${isMobileDevice ? 'p-3' : 'p-4'} bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/50 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all`}
          >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
              <div className="relative flex-shrink-0">
                {member.profilePicture ? (
                  <img
                    src={member.profilePicture.startsWith('http')
                      ? member.profilePicture
                      : getImageUrl(member.profilePicture)}
                    alt={`${member.firstName} ${member.lastName}`}
                          className={`${isMobileDevice ? 'w-10 h-10' : 'w-12 h-12'} rounded-full object-cover border-2 border-gray-200 dark:border-gray-700`}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                      if (fallback) {
                        fallback.style.display = 'flex';
                      }
                    }}
                  />
                ) : null}
                <div 
                        className={`${isMobileDevice ? 'w-10 h-10 text-sm' : 'w-12 h-12 text-base'} bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold`}
                  style={{ display: member.profilePicture ? 'none' : 'flex' }}
                >
                  {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                      <div className={`${isMobileDevice ? 'text-base' : 'text-lg'} font-semibold text-gray-900 dark:text-gray-100 truncate`}>
                  {member.firstName} {member.lastName}
                </div>
                      <div className={`${isMobileDevice ? 'text-xs' : 'text-sm'} text-gray-500 dark:text-gray-400 truncate mt-0.5`}>
                        {member.email}
                      </div>
              </div>
            </div>
            <button
                    className={`w-full bg-gradient-to-r from-red-600 to-red-500 dark:from-red-500 dark:to-red-600 hover:from-red-700 hover:to-red-600 dark:hover:from-red-600 dark:hover:to-red-700 text-white ${isMobileDevice ? 'px-4 py-2 text-sm' : 'px-4 py-2.5 text-base'} rounded-lg font-semibold shadow-md hover:shadow-lg transition-all active:scale-95 touch-manipulation disabled:opacity-50`}
              onClick={() => handleRemove(member._id)}
              disabled={removing === member._id}
            >
                    {removing === member._id ? 'Removing...' : 'Remove Member'}
            </button>
                </div>
              </div>
            ))}
          </div>
      )}
      </div>
    </div>
  );
};

export default GroupPeople; 