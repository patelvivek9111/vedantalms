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

  const autofillReset =
    '[&:-webkit-autofill]:[-webkit-text-fill-color:rgb(15,23,42)] [&:-webkit-autofill]:[caret-color:rgb(15,23,42)] [&:-webkit-autofill]:!shadow-[inset_0_0_0_1000px_rgb(255,255,255)] dark:[&:-webkit-autofill]:[-webkit-text-fill-color:rgb(241,245,249)] dark:[&:-webkit-autofill]:[caret-color:rgb(241,245,249)] dark:[&:-webkit-autofill]:!shadow-[inset_0_0_0_1000px_rgb(15,23,42)]';

  const autofillError =
    '[&:-webkit-autofill]:[-webkit-text-fill-color:rgb(136,19,55)] [&:-webkit-autofill]:[caret-color:rgb(136,19,55)] [&:-webkit-autofill]:!shadow-[inset_0_0_0_1000px_rgb(255,241,242)] dark:[&:-webkit-autofill]:[-webkit-text-fill-color:rgb(254,205,211)] dark:[&:-webkit-autofill]:[caret-color:rgb(254,205,211)] dark:[&:-webkit-autofill]:!shadow-[inset_0_0_0_1000px_rgb(69,10,26)]';
  
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
            w-full h-12 rounded-xl border px-3.5 text-sm font-normal leading-normal
            ${showPasswordToggle ? 'pr-11' : ''}
            bg-white dark:bg-slate-900/90
            text-slate-900 dark:text-slate-100
            placeholder-transparent shadow-sm
            transition-[border-color,box-shadow,background-color] duration-150
            focus:outline-none focus:ring-2 focus:ring-offset-0 dark:focus:ring-offset-0
            ${error ? autofillError : autofillReset}
            ${isFloating ? 'pt-[1.375rem] pb-2' : 'py-3'}
            ${
              error
                ? 'border-rose-300 bg-rose-50/50 focus:border-rose-400 focus:ring-rose-500/20 dark:border-rose-500/45 dark:bg-rose-950/30 dark:focus:border-rose-400 dark:focus:ring-rose-500/25'
                : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20 dark:border-slate-600 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/25'
            }
            ${className}
          `}
        />
        <label
          id={labelId}
          htmlFor={inputId}
          className={`
            absolute left-3.5 z-20 pointer-events-none transition-all duration-150 ease-out
            ${isFloating
              ? `top-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 px-0.5 ${
                  error
                    ? 'bg-rose-50/50 dark:bg-rose-950/30'
                    : 'bg-white dark:bg-slate-900/90'
                }`
              : 'top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500 dark:text-slate-400'
            }
          `}
        >
          {label}
          {props.required && (
            <span className="ml-0.5 text-rose-500/90 dark:text-rose-400/90" aria-label="required">
              *
            </span>
          )}
        </label>
        {showPasswordToggle && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-indigo-500/35 dark:hover:bg-slate-800 dark:hover:text-slate-200 dark:focus-visible:ring-indigo-400/40"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4 sm:h-[18px] sm:w-[18px]" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4 sm:h-[18px] sm:w-[18px]" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      
      {/* Helper text */}
      <div className="mt-1">
        {error && (
          <p id={errorId} className="text-xs font-medium text-rose-700 dark:text-rose-300" role="alert">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={helperId} className="text-xs text-slate-500 dark:text-slate-400">
            {helperText}
          </p>
        )}
      </div>
    </div>
  );
};

export default FloatingLabelPasswordInput;

