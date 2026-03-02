import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { InteractiveEyes } from '../components/InteractiveEyes';
import FloatingLabelInput from '../components/common/FloatingLabelInput';
import FloatingLabelPasswordInput from '../components/common/FloatingLabelPasswordInput';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const emailInputRef = useRef<HTMLInputElement>(null);
  const { login, user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determine which logo to use based on theme
  const logoPath = theme === 'dark' 
    ? '/assets/Vedanta_dark_logo.png' 
    : '/assets/Vedanta_light_logo.png';

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // Clear form state when component mounts (prevents showing previous user's data)
  useEffect(() => {
    setEmail('');
    setPassword('');
    setError('');
  }, []);

  // Email validation
  const validateEmail = (emailValue: string) => {
    if (!emailValue) {
      setEmailError('Email is required');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailValue)) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  };

  // Password validation
  const validatePassword = (passwordValue: string) => {
    if (!passwordValue) {
      setPasswordError('Password is required');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (emailError) {
      validateEmail(e.target.value);
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (passwordError) {
      validatePassword(e.target.value);
    }
  };

  const handleEmailBlur = () => {
    validateEmail(email);
    setIsEmailFocused(false);
  };

  const handlePasswordBlur = () => {
    validatePassword(password);
    setIsPasswordFocused(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);
    
    if (!isEmailValid || !isPasswordValid) {
      return;
    }
    
    setIsLoading(true);
    try {
      await login(email, password);
      // Always redirect to dashboard after login, not the previous page
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError('Failed to login. Please check your credentials.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8">
        <div className="text-center">
          {/* Logo Container - Framed and larger design */}
          <div className="flex flex-col items-center justify-center mb-4">
            <div className="relative inline-block p-4 sm:p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 border-gray-200 dark:border-gray-700">
            <img 
              src={logoPath} 
              alt="Vedanta Logo" 
                className="h-32 w-auto sm:h-40 object-contain"
                style={{ maxWidth: '320px', display: 'block' }}
            />
            </div>
          </div>
          
          {/* Interactive Eyes */}
          <div className="mt-2">
            <InteractiveEyes
              isPasswordFocused={isPasswordFocused}
              isUsernameFocused={isEmailFocused}
              usernameValue={email}
              passwordValue={password}
              hasError={!!error}
              isLoading={isLoading}
            />
          </div>
          
          <h2 className="mt-6 text-center text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-gray-100">
            Sign in to Vedanta
          </h2>
          
          <p className="mt-3 text-center text-sm text-gray-600 dark:text-gray-400">
            Or{' '}
            <Link to="/signup" className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300">
              create a new account
            </Link>
          </p>
        </div>
        <form className="mt-6 sm:mt-8 space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800">
              <div className="text-sm text-red-700 dark:text-red-400">{error}</div>
            </div>
          )}
          <div className="space-y-4">
            <FloatingLabelInput
                ref={emailInputRef}
                id="email-address"
                name="email"
                type="email"
              label="Email address"
                autoComplete="email"
                required
                value={email}
              onChange={handleEmailChange}
                onFocus={() => {
                  setIsEmailFocused(true);
                  setIsPasswordFocused(false);
                }}
              onBlur={handleEmailBlur}
              error={emailError}
              enterKeyHint="next"
              />
            <FloatingLabelPasswordInput
                id="password"
                name="password"
              label="Password"
                autoComplete="current-password"
                required
                value={password}
              onChange={handlePasswordChange}
                onFocus={() => {
                  setIsPasswordFocused(true);
                  setIsEmailFocused(false);
                }}
              onBlur={handlePasswordBlur}
              error={passwordError}
              enterKeyHint="done"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
