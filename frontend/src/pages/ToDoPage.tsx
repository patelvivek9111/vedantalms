import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User } from 'lucide-react';
import { ToDoPanel } from '../components/ToDoPanel';
import { BurgerMenu } from '../components/BurgerMenu';

const ToDoPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showBurgerMenu, setShowBurgerMenu] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Navigation Bar (Mobile Only) */}
      <nav className="lg:hidden fixed top-0 left-0 right-0 z-[150] bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="relative flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setShowBurgerMenu(!showBurgerMenu)}
            className="text-gray-700 dark:text-gray-300 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
            aria-label="Open account menu"
          >
            <User className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">To Do</h1>
          <div className="w-10"></div> {/* Spacer for centering */}
          
          {/* Burger Menu */}
          <BurgerMenu
            showBurgerMenu={showBurgerMenu}
            setShowBurgerMenu={setShowBurgerMenu}
          />
        </div>
      </nav>
      
      <div className="lg:px-4 sm:px-6 lg:py-4 lg:pt-8 pt-16 pb-20">
        <div className="lg:max-w-4xl lg:mx-auto">
          <ToDoPanel />
        </div>
      </div>
    </div>
  );
};

export default ToDoPage;

