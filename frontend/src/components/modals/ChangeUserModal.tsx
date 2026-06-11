import React, { useState, useEffect } from 'react';
import { X, Plus, LogOut, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getImageUrl } from '../../services/api';
import api from '../../services/api';

const SECTION_LABEL =
  'mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400';
const ITEM_CARD =
  'flex items-center gap-2.5 rounded-lg border border-gray-200/90 bg-white px-2.5 py-2 transition-colors dark:border-gray-700 dark:bg-gray-800 sm:gap-3 sm:px-3 sm:py-2.5';
const CONTROL =
  'compact-control h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-[11px] text-gray-900 transition-colors dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 sm:text-xs';
const CONTROL_FOCUS =
  'focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:border-blue-500 dark:focus:ring-blue-900/40';

interface StoredUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  profilePicture?: string;
  token: string;
  lastUsed: number;
}

interface ChangeUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STORAGE_KEY = 'storedUsers';

export const ChangeUserModal: React.FC<ChangeUserModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user, token, setUser, setToken } = useAuth();
  const [storedUsers, setStoredUsers] = useState<StoredUser[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Load stored users from localStorage
  useEffect(() => {
    if (!isOpen) return;
    
    const loadStoredUsers = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      let users: StoredUser[] = stored ? JSON.parse(stored) : [];
      
      // Ensure current user is in the list
      if (user && token) {
        const existingUserIndex = users.findIndex(u => u.email === user.email);
        if (existingUserIndex >= 0) {
          // Update existing user's token, profilePicture, and lastUsed
          users[existingUserIndex] = {
            ...users[existingUserIndex],
            token: token,
            profilePicture: user.profilePicture, // Update profile picture if it changed
            firstName: user.firstName, // Update name if it changed
            lastName: user.lastName,
            role: user.role, // Update role if it changed
            lastUsed: Date.now()
          };
        } else {
          // Add current user if not in list
          const currentUser: StoredUser = {
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
            profilePicture: user.profilePicture,
            token: token,
            lastUsed: Date.now()
          };
          users.push(currentUser);
        }
        
        // Keep only last 5 users
        if (users.length > 5) {
          users = users
            .sort((a, b) => b.lastUsed - a.lastUsed)
            .slice(0, 5);
        }
        
        // Save updated list
        localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
      }
      
      // Sort by lastUsed (most recent first)
      const sortedUsers = users.sort((a, b) => b.lastUsed - a.lastUsed);
      setStoredUsers(sortedUsers);
    } catch (error) {
      setStoredUsers([]);
    }
    };
    
    loadStoredUsers();
  }, [isOpen, user, token]);

  const saveStoredUser = (userData: StoredUser) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      let users: StoredUser[] = stored ? JSON.parse(stored) : [];
      
      // Remove existing user with same email
      users = users.filter(u => u.email !== userData.email);
      
      // Add new user
      users.push(userData);
      
      // Keep only last 5 users
      if (users.length > 5) {
        users = users
          .sort((a, b) => b.lastUsed - a.lastUsed)
          .slice(0, 5);
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
      setStoredUsers(users.sort((a, b) => b.lastUsed - a.lastUsed));
    } catch (error) {
      }
  };

  const handleSwitchUser = (selectedUser: StoredUser) => {
    // Update lastUsed timestamp
    const updatedUser = { ...selectedUser, lastUsed: Date.now() };
    saveStoredUser(updatedUser);
    
    // Switch to selected user
    setToken(updatedUser.token);
    setUser({
      _id: updatedUser._id,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      email: updatedUser.email,
      role: updatedUser.role,
      profilePicture: updatedUser.profilePicture
    });
    
    // Update localStorage
    localStorage.setItem('token', updatedUser.token);
    localStorage.setItem('user', JSON.stringify({
      _id: updatedUser._id,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      email: updatedUser.email,
      role: updatedUser.role,
      profilePicture: updatedUser.profilePicture
    }));
    
    onClose();
    // Reload page to refresh all contexts
    window.location.reload();
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user: userData } = response.data;

      if (token && userData) {
        const newUser: StoredUser = {
          _id: userData.id || userData._id,
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          role: userData.role,
          profilePicture: userData.profilePicture,
          token: token,
          lastUsed: Date.now()
        };

        saveStoredUser(newUser);
        setEmail('');
        setPassword('');
        setShowAddUser(false);
        setError('');
      } else {
        setError('Failed to login. Please check your credentials.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to login. Please check your credentials.');
      } finally {
      setLoading(false);
    }
  };

  const handleRemoveUser = (userEmail: string) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        let users: StoredUser[] = JSON.parse(stored);
        users = users.filter(u => u.email !== userEmail);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
        setStoredUsers(users);
      }
    } catch (error) {
      }
  };

  const isCurrentUser = (userEmail: string) => {
    return user?.email === userEmail;
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-500';
      case 'teacher':
        return 'bg-blue-500';
      case 'student':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-xl border border-gray-200/90 bg-white dark:border-gray-700 dark:bg-gray-800 sm:max-w-md sm:rounded-xl sm:shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700/60">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Change User</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            aria-label="Close change user"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
          <div>
            <h3 className={SECTION_LABEL}>Available Users</h3>

            {storedUsers.length === 0 ? (
              <p className="py-6 text-center text-[11px] text-gray-500 dark:text-gray-400">
                No users available. Add a user to switch accounts.
              </p>
            ) : (
              <div className="space-y-1.5">
                {storedUsers.map((storedUser) => {
                  const isCurrent = isCurrentUser(storedUser.email);
                  return (
                    <div
                      key={storedUser.email}
                      role="button"
                      tabIndex={isCurrent ? -1 : 0}
                      className={`${ITEM_CARD} ${
                        isCurrent
                          ? 'border-blue-500 bg-blue-50/80 ring-2 ring-blue-100 dark:border-blue-400 dark:bg-blue-950/30 dark:ring-blue-900/40'
                          : 'cursor-pointer hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                      onClick={() => !isCurrent && handleSwitchUser(storedUser)}
                      onKeyDown={(e) => {
                        if (!isCurrent && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          handleSwitchUser(storedUser);
                        }
                      }}
                    >
                      <div className="relative shrink-0">
                        {storedUser.profilePicture && storedUser.profilePicture.trim() !== '' ? (
                          <>
                            <img
                              src={
                                storedUser.profilePicture.startsWith('http')
                                  ? storedUser.profilePicture
                                  : getImageUrl(storedUser.profilePicture)
                              }
                              alt={`${storedUser.firstName} ${storedUser.lastName}`}
                              className="h-9 w-9 rounded-full border border-gray-200 object-cover dark:border-gray-600"
                              onError={(e) => {
                                const target = e.currentTarget;
                                target.style.display = 'none';
                                const fallback = target.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                            <div
                              className={`hidden h-9 w-9 rounded-full ${getRoleColor(storedUser.role)} items-center justify-center text-[11px] font-bold text-white`}
                            >
                              {storedUser.firstName?.charAt(0) || ''}
                              {storedUser.lastName?.charAt(0) || 'U'}
                            </div>
                          </>
                        ) : (
                          <div
                            className={`flex h-9 w-9 items-center justify-center rounded-full ${getRoleColor(storedUser.role)} text-[11px] font-bold text-white`}
                          >
                            {storedUser.firstName?.charAt(0) || ''}
                            {storedUser.lastName?.charAt(0) || 'U'}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11px] font-semibold text-gray-900 dark:text-gray-100 sm:text-xs">
                          {storedUser.firstName} {storedUser.lastName}
                        </div>
                        <div className="truncate text-[10px] text-gray-500 dark:text-gray-400 sm:text-[11px]">
                          {storedUser.email}
                        </div>
                        {isCurrent && (
                          <div className="mt-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                            Current User
                          </div>
                        )}
                      </div>

                      {isCurrent ? (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 dark:bg-blue-500">
                          <Check className="h-3 w-3 text-white" strokeWidth={3} />
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveUser(storedUser.email);
                          }}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                          title="Remove user"
                          aria-label={`Remove ${storedUser.firstName} ${storedUser.lastName}`}
                        >
                          <LogOut className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {!showAddUser ? (
            <button
              type="button"
              onClick={() => setShowAddUser(true)}
              className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 text-[11px] font-medium text-gray-600 transition-colors hover:border-blue-400 hover:text-blue-600 dark:border-gray-600 dark:text-gray-400 dark:hover:border-blue-500 dark:hover:text-blue-400 sm:text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Another User
            </button>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200/90 bg-gray-50/80 p-3 dark:border-gray-700 dark:bg-gray-800/50 sm:p-3.5">
              <h4 className="mb-2 text-[11px] font-semibold text-gray-900 dark:text-gray-100 sm:text-xs">
                Login as Another User
              </h4>
              <form onSubmit={handleAddUser} className="space-y-2">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={`${CONTROL} ${CONTROL_FOCUS}`}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={`${CONTROL} ${CONTROL_FOCUS}`}
                />
                {error && (
                  <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={loading}
                    className="h-10 flex-1 rounded-lg bg-blue-600 text-[11px] font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:text-xs"
                  >
                    {loading ? 'Logging in…' : 'Login'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddUser(false);
                      setEmail('');
                      setPassword('');
                      setError('');
                    }}
                    className="h-10 rounded-lg border border-gray-200 px-3 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700 sm:text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

