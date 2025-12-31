import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, Folder, Settings, HelpCircle, User as UserIcon, LogOut } from 'lucide-react';
import { getImageUrl } from '../services/api';
import { ToDoPanel } from '../components/ToDoPanel';
import { ChangeUserModal } from '../components/ChangeUserModal';

const ToDoPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showBurgerMenu, setShowBurgerMenu] = useState(false);
  const [showChangeUserModal, setShowChangeUserModal] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Navigation Bar (Mobile Only) */}
      <nav className="lg:hidden fixed top-0 left-0 right-0 z-[150] bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="relative flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setShowBurgerMenu(!showBurgerMenu)}
            className="text-gray-700 dark:text-gray-300 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">To Do</h1>
          <div className="w-10"></div> {/* Spacer for centering */}
          
          {/* Burger Menu Dropdown */}
          {showBurgerMenu && (
            <>
              {/* Overlay */}
              <div
                className="fixed inset-0 bg-black bg-opacity-50 z-[151]"
                onClick={() => setShowBurgerMenu(false)}
              />
              {/* Menu */}
              <div className="absolute top-full left-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-[280px] z-[152] overflow-hidden">
                {/* Profile Information */}
                <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      {user?.profilePicture ? (
                        <img
                          src={user.profilePicture.startsWith('http') 
                            ? user.profilePicture 
                            : getImageUrl(user.profilePicture)}
                          alt={`${user.firstName} ${user.lastName}`}
                          className="w-12 h-12 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                            if (fallback) {
                              fallback.style.display = 'flex';
                            }
                          }}
                        />
                      ) : null}
                      {/* Fallback avatar */}
                      <div
                        className={`w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-base font-bold ${
                          user?.profilePicture ? 'hidden' : 'flex'
                        }`}
                        style={{
                          display: user?.profilePicture ? 'none' : 'flex'
                        }}
                      >
                        {user?.firstName?.charAt(0) || ''}{user?.lastName?.charAt(0) || 'U'}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">
                        {user?.firstName} {user?.lastName}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {user?.email}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Options */}
                <div className="py-2">
                  <button
                    onClick={() => {
                      setShowBurgerMenu(false);
                      navigate('/account');
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
                  >
                    <Folder className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    <span>Files</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowBurgerMenu(false);
                      navigate('/account');
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
                  >
                    <Settings className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    <span>Settings</span>
                  </button>
                </div>

                {/* Separator */}
                <div className="border-t border-gray-200 dark:border-gray-700"></div>

                {/* Account Actions */}
                <div className="py-2">
                  <button
                    onClick={() => {
                      setShowBurgerMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
                  >
                    <HelpCircle className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    <span>Help</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowBurgerMenu(false);
                      setShowChangeUserModal(true);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
                  >
                    <UserIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    <span>Change User</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowBurgerMenu(false);
                      logout();
                      navigate('/login');
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
                  >
                    <LogOut className="h-5 w-5" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </nav>
      
      <ChangeUserModal
        isOpen={showChangeUserModal}
        onClose={() => setShowChangeUserModal(false)}
      />
      
      <div className="px-4 sm:px-6 py-4 lg:pt-8 pt-20">
        <div className="max-w-4xl mx-auto">
          <ToDoPanel />
        </div>
      </div>
    </div>
  );
};

export default ToDoPage;

