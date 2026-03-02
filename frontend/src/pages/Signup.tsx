import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import FloatingLabelInput from '../components/common/FloatingLabelInput';
import FloatingLabelPasswordInput from '../components/common/FloatingLabelPasswordInput';
import FloatingLabelSelect from '../components/common/FloatingLabelSelect';

interface ValidationError {
  field: string;
  message: string;
}

export function Signup() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [generalError, setGeneralError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const { signup } = useAuth();
  const navigate = useNavigate();

  // Validation functions
  const validateFirstName = (value: string) => {
    if (!value.trim()) {
      setFieldErrors(prev => ({ ...prev, firstName: 'First name is required' }));
      return false;
    }
    if (value.trim().length < 2) {
      setFieldErrors(prev => ({ ...prev, firstName: 'First name must be at least 2 characters' }));
      return false;
    }
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.firstName;
      return newErrors;
    });
    return true;
  };

  const validateLastName = (value: string) => {
    if (!value.trim()) {
      setFieldErrors(prev => ({ ...prev, lastName: 'Last name is required' }));
      return false;
    }
    if (value.trim().length < 2) {
      setFieldErrors(prev => ({ ...prev, lastName: 'Last name must be at least 2 characters' }));
      return false;
    }
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.lastName;
      return newErrors;
    });
    return true;
  };

  const validateEmail = (value: string) => {
    if (!value.trim()) {
      setFieldErrors(prev => ({ ...prev, email: 'Email is required' }));
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      setFieldErrors(prev => ({ ...prev, email: 'Please enter a valid email address' }));
      return false;
    }
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.email;
      return newErrors;
    });
    return true;
  };

  const validatePassword = (value: string) => {
    if (!value) {
      setFieldErrors(prev => ({ ...prev, password: 'Password is required' }));
      return false;
    }
    if (value.length < 6) {
      setFieldErrors(prev => ({ ...prev, password: 'Password must be at least 6 characters' }));
      return false;
    }
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.password;
      return newErrors;
    });
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setGeneralError('');
    
    // Validate all fields
    const isFirstNameValid = validateFirstName(firstName);
    const isLastNameValid = validateLastName(lastName);
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);
    
    if (!isFirstNameValid || !isLastNameValid || !isEmailValid || !isPasswordValid) {
      return;
    }
    
    try {
      await signup(firstName, lastName, email, password, role);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors);
        // Map server errors to field errors
        err.response.data.errors.forEach((error: ValidationError) => {
          setFieldErrors(prev => ({ ...prev, [error.field]: error.message }));
        });
      } else {
        setGeneralError(err.response?.data?.message || 'Failed to create an account.');
      }
    }
  };

  const getFieldError = (fieldName: string) => {
    // Prioritize inline validation errors over server errors
    if (fieldErrors[fieldName]) {
      return fieldErrors[fieldName];
    }
    return errors.find(err => err.field === fieldName)?.message;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8">
        <div>
          <h2 className="mt-4 sm:mt-6 text-center text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-gray-100">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Or{' '}
            <Link to="/login" className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300">
              sign in to your account
            </Link>
          </p>
        </div>
        <form className="mt-6 sm:mt-8 space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
          {generalError && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800">
              <div className="text-sm text-red-700 dark:text-red-400">{generalError}</div>
            </div>
          )}
          <div className="space-y-4">
            <FloatingLabelInput
                id="first-name"
                name="firstName"
                type="text"
              label="First Name"
                required
                value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                if (fieldErrors.firstName) {
                  validateFirstName(e.target.value);
                }
              }}
              onBlur={(e) => validateFirstName(e.target.value)}
              error={getFieldError('firstName')}
              enterKeyHint="next"
            />
            <FloatingLabelInput
                id="last-name"
                name="lastName"
                type="text"
              label="Last Name"
                required
                value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                if (fieldErrors.lastName) {
                  validateLastName(e.target.value);
                }
              }}
              onBlur={(e) => validateLastName(e.target.value)}
              error={getFieldError('lastName')}
              enterKeyHint="next"
            />
            <FloatingLabelInput
                id="email-address"
                name="email"
                type="email"
              label="Email address"
                autoComplete="email"
                required
                value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) {
                  validateEmail(e.target.value);
                }
              }}
              onBlur={(e) => validateEmail(e.target.value)}
              error={getFieldError('email')}
              enterKeyHint="next"
            />
            <FloatingLabelPasswordInput
                id="password"
                name="password"
              label="Password"
                autoComplete="new-password"
                required
                value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  validatePassword(e.target.value);
                }
              }}
              onBlur={(e) => validatePassword(e.target.value)}
              error={getFieldError('password')}
              helperText="Must be at least 6 characters"
              enterKeyHint="done"
            />
            <FloatingLabelSelect
                id="role"
                name="role"
              label="Role"
                required
                value={role}
                onChange={(e) => setRole(e.target.value)}
              options={[
                { value: 'student', label: 'Student' },
                { value: 'teacher', label: 'Teacher' },
                { value: 'admin', label: 'Admin' }
              ]}
            />
          </div>

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-900 transition-colors"
            >
              Sign up
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 