import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import FloatingLabelInput from '../components/common/FloatingLabelInput';
import FloatingLabelPasswordInput from '../components/common/FloatingLabelPasswordInput';
import { validatePassword, passwordPolicyHint } from '../utils/passwordPolicy';

interface ValidationError {
  field: string;
  message: string;
}

export function Signup() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [generalError, setGeneralError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const { signup } = useAuth();
  const navigate = useNavigate();

  const validateFirstName = (value: string) => {
    if (!value.trim()) {
      setFieldErrors((prev) => ({ ...prev, firstName: 'First name is required' }));
      return false;
    }
    if (value.trim().length < 2) {
      setFieldErrors((prev) => ({ ...prev, firstName: 'First name must be at least 2 characters' }));
      return false;
    }
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.firstName;
      return next;
    });
    return true;
  };

  const validateLastName = (value: string) => {
    if (!value.trim()) {
      setFieldErrors((prev) => ({ ...prev, lastName: 'Last name is required' }));
      return false;
    }
    if (value.trim().length < 2) {
      setFieldErrors((prev) => ({ ...prev, lastName: 'Last name must be at least 2 characters' }));
      return false;
    }
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.lastName;
      return next;
    });
    return true;
  };

  const validateEmail = (value: string) => {
    if (!value.trim()) {
      setFieldErrors((prev) => ({ ...prev, email: 'Email is required' }));
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      setFieldErrors((prev) => ({ ...prev, email: 'Please enter a valid email address' }));
      return false;
    }
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.email;
      return next;
    });
    return true;
  };

  const validatePasswordField = (value: string) => {
    const check = validatePassword(value);
    if (!check.valid) {
      setFieldErrors((prev) => ({ ...prev, password: check.message || 'Invalid password' }));
      return false;
    }
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.password;
      return next;
    });
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setGeneralError('');

    const isFirstNameValid = validateFirstName(firstName);
    const isLastNameValid = validateLastName(lastName);
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePasswordField(password);

    if (!termsAccepted) {
      setGeneralError('You must accept the Terms of Service and Privacy Policy');
      return;
    }

    if (!isFirstNameValid || !isLastNameValid || !isEmailValid || !isPasswordValid) {
      return;
    }

    try {
      await signup(firstName, lastName, email, password, termsAccepted);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors);
        err.response.data.errors.forEach((error: ValidationError) => {
          setFieldErrors((prev) => ({ ...prev, [error.field]: error.message }));
        });
      } else {
        setGeneralError(err.response?.data?.message || 'Failed to create an account.');
      }
    }
  };

  const getFieldError = (fieldName: string) => {
    if (fieldErrors[fieldName]) {
      return fieldErrors[fieldName];
    }
    return errors.find((err) => err.field === fieldName)?.message;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8">
        <div>
          <h2 className="mt-4 sm:mt-6 text-center text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-gray-100">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Student accounts only. Staff access is provisioned by your administrator.
          </p>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Or{' '}
            <Link to="/login" className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500">
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
                if (fieldErrors.firstName) validateFirstName(e.target.value);
              }}
              onBlur={(e) => validateFirstName(e.target.value)}
              error={getFieldError('firstName')}
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
                if (fieldErrors.lastName) validateLastName(e.target.value);
              }}
              onBlur={(e) => validateLastName(e.target.value)}
              error={getFieldError('lastName')}
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
                if (fieldErrors.email) validateEmail(e.target.value);
              }}
              onBlur={(e) => validateEmail(e.target.value)}
              error={getFieldError('email')}
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
                if (fieldErrors.password) validatePasswordField(e.target.value);
              }}
              onBlur={(e) => validatePasswordField(e.target.value)}
              error={getFieldError('password')}
              helperText={passwordPolicyHint()}
            />
            <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 rounded border-gray-300"
              />
              <span>
                I agree to the{' '}
                <Link to="/terms" target="_blank" className="text-indigo-600 dark:text-indigo-400">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" target="_blank" className="text-indigo-600 dark:text-indigo-400">
                  Privacy Policy
                </Link>
              </span>
            </label>
          </div>
          <button
            type="submit"
            className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Sign up
          </button>
        </form>
      </div>
    </div>
  );
}
