import React, { useState, useEffect } from 'react';
import { X, User as UserIcon, Plus, LogOut, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getImageUrl } from '../services/api';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';

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
      console.error('Error loading stored users:', error);
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
      console.error('Error saving stored user:', error);
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
      console.error('Login error:', err);
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
      console.error('Error removing user:', error);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[200] flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
            Change User
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation"
          >
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
          {/* Available Roles/Users Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Available Users
            </h3>
            
            {storedUsers.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p className="text-sm">No users available. Add a user to switch accounts.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {storedUsers.map((storedUser) => {
                  const isCurrent = isCurrentUser(storedUser.email);
                  return (
                    <div
                      key={storedUser.email}
                      className={`relative p-3 sm:p-4 rounded-lg border-2 transition-all cursor-pointer touch-manipulation ${
                        isCurrent
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-gray-50 dark:bg-gray-700/50'
                      }`}
                      onClick={() => !isCurrent && handleSwitchUser(storedUser)}
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        {/* Avatar */}
                        <div className="relative flex-shrink-0">
                          {storedUser.profilePicture && storedUser.profilePicture.trim() !== '' ? (
                            <>
                            <img
                              src={storedUser.profilePicture.startsWith('http')
                                ? storedUser.profilePicture
                                : getImageUrl(storedUser.profilePicture)}
                              alt={`${storedUser.firstName} ${storedUser.lastName}`}
                                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
                              onError={(e) => {
                                  const target = e.currentTarget;
                                  target.style.display = 'none';
                                  const fallback = target.nextElementSibling as HTMLElement;
                                if (fallback) {
                                  fallback.style.display = 'flex';
                                }
                              }}
                            />
                              {/* Fallback avatar (shown only if image fails to load) */}
                          <div
                                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${getRoleColor(storedUser.role)} flex items-center justify-center text-white text-sm sm:text-base font-bold hidden`}
                              >
                                {storedUser.firstName?.charAt(0) || ''}{storedUser.lastName?.charAt(0) || 'U'}
                              </div>
                            </>
                          ) : (
                            <div
                              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${getRoleColor(storedUser.role)} flex items-center justify-center text-white text-sm sm:text-base font-bold`}
                          >
                            {storedUser.firstName?.charAt(0) || ''}{storedUser.lastName?.charAt(0) || 'U'}
                          </div>
                          )}
                        </div>

                        {/* User Info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base">
                            {storedUser.firstName} {storedUser.lastName}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {storedUser.email}
                          </div>
                          {isCurrent && (
                            <div className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1">
                              Current User
                            </div>
                          )}
                        </div>

                        {/* Current User Indicator */}
                        {isCurrent && (
                          <div className="flex-shrink-0">
                            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-500 flex items-center justify-center">
                              <Check className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                            </div>
                          </div>
                        )}

                        {/* Remove Button (only if not current user) */}
                        {!isCurrent && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveUser(storedUser.email);
                            }}
                            className="flex-shrink-0 p-1.5 sm:p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors touch-manipulation"
                            title="Remove user"
                          >
                            <LogOut className="h-4 w-4 text-red-500" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add User Section */}
          {!showAddUser ? (
            <button
              onClick={() => setShowAddUser(true)}
              className="w-full p-3 sm:p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-colors flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 touch-manipulation"
            >
              <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="font-medium text-sm sm:text-base">Add Another User</span>
            </button>
          ) : (
            <div className="p-3 sm:p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/30">
              <h4 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-100 mb-2 sm:mb-3">
                Login as Another User
              </h4>
              <form onSubmit={handleAddUser} className="space-y-3">
                <div>
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {error && (
                  <div className="text-sm text-red-600 dark:text-red-400">
                    {error}
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-2 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors touch-manipulation"
                  >
                    {loading ? 'Logging in...' : 'Login'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddUser(false);
                      setEmail('');
                      setPassword('');
                      setError('');
                    }}
                    className="w-full sm:w-auto px-4 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
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

