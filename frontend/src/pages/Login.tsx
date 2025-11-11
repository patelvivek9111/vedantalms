import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen } from 'lucide-react';
import { LottieLoginAnimation } from '../components/LottieLoginAnimation';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [animationState, setAnimationState] = useState<'idle' | 'typing' | 'success' | 'error' | 'loading'>('idle');
  const [focusedInput, setFocusedInput] = useState<'email' | 'password' | null>(null);
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
    setAnimationState('idle');
  }, []);

  // Update animation state based on user interaction
  useEffect(() => {
    if (isLoading) {
      setAnimationState('loading');
    } else if (error) {
      setAnimationState('error');
      // Reset error state after 3 seconds
      const timer = setTimeout(() => {
        setError('');
        setAnimationState(focusedInput ? 'typing' : 'idle');
      }, 3000);
      return () => clearTimeout(timer);
    } else if (focusedInput || email || password) {
      setAnimationState('typing');
    } else {
      setAnimationState('idle');
    }
  }, [email, password, focusedInput, isLoading, error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAnimationState('loading');
    try {
      await login(email, password);
      setAnimationState('success');
      // Wait a moment to show success animation before redirecting
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 1000);
    } catch (err) {
      setIsLoading(false);
      setError('Failed to login. Please check your credentials.');
      setAnimationState('error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl w-full grid md:grid-cols-2 gap-8 items-center">
        {/* Lottie Animation Section */}
        <div className="hidden md:flex items-center justify-center">
          <div className="w-full max-w-md">
            <LottieLoginAnimation 
              animationState={animationState}
              className="w-full h-full"
            />
          </div>
        </div>
        
        {/* Login Form Section */}
        <div className="max-w-md w-full mx-auto space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <img 
              src="/assets/vedanta-logo.png" 
              alt="Vedanta Logo" 
              className="h-16 w-auto"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'block';
              }}
            />
            <div className="flex items-center justify-center" style={{ display: 'none' }}>
              <BookOpen className="h-12 w-12 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-gray-100">
            Sign in to Vedanta
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Modern Learning. Ancient Wisdom.
          </p>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Or{' '}
            <Link to="/signup" className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300">
              create a new account
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800">
              <div className="text-sm text-red-700 dark:text-red-400">{error}</div>
            </div>
          )}
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm transition-all duration-200"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocusedInput('email')}
                onBlur={() => setFocusedInput(null)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm transition-all duration-200"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusedInput('password')}
                onBlur={() => setFocusedInput(null)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-900 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </div>
        </form>
        
        {/* Mobile Lottie Animation */}
        <div className="md:hidden flex items-center justify-center mt-8">
          <div className="w-full max-w-xs">
            <LottieLoginAnimation 
              animationState={animationState}
              className="w-full h-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
