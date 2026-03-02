import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface FloatingLabelPasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: string;
  helperText?: string;
  showPasswordToggle?: boolean;
}

const FloatingLabelPasswordInput: React.FC<FloatingLabelPasswordInputProps> = ({
  label,
  error,
  showPasswordToggle = true,
  value,
  onChange,
  onFocus,
  onBlur,
  className = '',
  helperText,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [hasValue, setHasValue] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHasValue(!!value && String(value).length > 0);
  }, [value]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    
    // Auto-scroll to input on mobile devices when focused
    const scrollToInput = () => {
      if (inputRef.current) {
        // Check if it's a mobile device
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || 
                        (window.innerWidth <= 768 && 'ontouchstart' in window);
        
        if (isMobile) {
          // Scroll input into view, centered vertically
          setTimeout(() => {
            inputRef.current?.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
              inline: 'nearest'
            });
          }, 300); // Delay to account for keyboard animation
        }
      }
    };
    
    scrollToInput();
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHasValue(e.target.value.length > 0);
    onChange?.(e);
  };

  const isFloating = isFocused || hasValue;
  
  // Generate unique IDs for accessibility
  const inputId = props.id || `floating-password-${Math.random().toString(36).substr(2, 9)}`;
  const labelId = `${inputId}-label`;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;
  
  // Build aria-describedby string
  const ariaDescribedBy = [
    error ? errorId : null,
    helperText && !error ? helperId : null
  ].filter(Boolean).join(' ') || undefined;

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          {...props}
          id={inputId}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          aria-labelledby={labelId}
          aria-describedby={ariaDescribedBy}
          aria-invalid={error ? 'true' : 'false'}
          aria-required={props.required ? 'true' : undefined}
          className={`
            w-full min-h-[48px] px-4 sm:px-3 ${isFloating ? 'pt-8 pb-3 sm:pb-2' : 'pt-4 pb-4'} ${showPasswordToggle ? 'pr-12 sm:pr-10' : ''} border rounded-md 
            bg-white dark:bg-gray-900 
            text-gray-900 dark:text-gray-100 text-base
            placeholder-transparent
            focus:outline-none focus:ring-2 
            transition-all duration-200
            ${error 
              ? 'border-red-500 dark:border-red-500 focus:ring-red-500 dark:focus:ring-red-500' 
              : 'border-gray-300 dark:border-gray-700 focus:ring-blue-500 dark:focus:ring-blue-400'
            }
            ${className}
          `}
        />
        <label
          id={labelId}
          htmlFor={inputId}
          className={`
            absolute left-3 transition-all duration-200 pointer-events-none z-20
            ${isFloating
              ? 'top-2.5 text-xs text-blue-600 dark:text-blue-400 font-medium bg-white dark:bg-gray-900 px-1.5 -mx-1.5 rounded backdrop-blur-sm'
              : 'top-1/2 -translate-y-1/2 text-base text-gray-500 dark:text-gray-400'
            }
          `}
        >
          {label}
          {props.required && <span className="text-red-500 ml-1" aria-label="required">*</span>}
        </label>
        {showPasswordToggle && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Eye className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      
      {/* Helper text */}
      <div className="mt-1">
        {error && (
          <p id={errorId} className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={helperId} className="text-xs text-gray-500 dark:text-gray-400">
            {helperText}
          </p>
        )}
      </div>
    </div>
  );
};

export default FloatingLabelPasswordInput;

