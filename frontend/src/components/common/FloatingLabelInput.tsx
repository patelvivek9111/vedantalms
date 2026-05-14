import React, { useState, useRef, useEffect, forwardRef } from 'react';

interface FloatingLabelInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  showCharacterCount?: boolean;
  maxLength?: number;
  helperText?: string;
  enterKeyHint?: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send';
}

const FloatingLabelInput = forwardRef<HTMLInputElement, FloatingLabelInputProps>(({
  label,
  error,
  showCharacterCount = false,
  maxLength,
  value,
  onChange,
  onFocus,
  onBlur,
  className = '',
  helperText,
  enterKeyHint,
  ...props
}, ref) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Use forwarded ref or internal ref
  const actualRef = (ref as React.RefObject<HTMLInputElement>) || inputRef;

  // Check if value exists (including 0) and is not empty string
  // For number inputs, 0 is a valid value, so we need to check if value is not null/undefined
  const checkHasValue = (val: string | number | readonly string[] | undefined | null): boolean => {
    const valueStr = val !== null && val !== undefined ? String(val) : '';
    return valueStr.length > 0;
  };

  const [hasValue, setHasValue] = useState(() => checkHasValue(value));

  useEffect(() => {
    setHasValue(checkHasValue(value));
  }, [value]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    
    // Auto-scroll to input on mobile devices when focused
    // Small delay to account for virtual keyboard appearing
    const scrollToInput = () => {
      const inputElement = actualRef.current;
      if (inputElement) {
        // Check if it's a mobile device
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || 
                        (window.innerWidth <= 768 && 'ontouchstart' in window);
        
        if (isMobile) {
          // Scroll input into view, centered vertically
          setTimeout(() => {
            inputElement.scrollIntoView({
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
  const currentLength = value ? String(value).length : 0;

  const autofillReset =
    '[&:-webkit-autofill]:[-webkit-text-fill-color:rgb(15,23,42)] [&:-webkit-autofill]:[caret-color:rgb(15,23,42)] [&:-webkit-autofill]:!shadow-[inset_0_0_0_1000px_rgb(255,255,255)] dark:[&:-webkit-autofill]:[-webkit-text-fill-color:rgb(241,245,249)] dark:[&:-webkit-autofill]:[caret-color:rgb(241,245,249)] dark:[&:-webkit-autofill]:!shadow-[inset_0_0_0_1000px_rgb(15,23,42)]';

  const autofillError =
    '[&:-webkit-autofill]:[-webkit-text-fill-color:rgb(136,19,55)] [&:-webkit-autofill]:[caret-color:rgb(136,19,55)] [&:-webkit-autofill]:!shadow-[inset_0_0_0_1000px_rgb(255,241,242)] dark:[&:-webkit-autofill]:[-webkit-text-fill-color:rgb(254,205,211)] dark:[&:-webkit-autofill]:[caret-color:rgb(254,205,211)] dark:[&:-webkit-autofill]:!shadow-[inset_0_0_0_1000px_rgb(69,10,26)]';
  
  // Generate unique IDs for accessibility
  const inputId = props.id || `floating-input-${Math.random().toString(36).substr(2, 9)}`;
  const labelId = `${inputId}-label`;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;
  
  // Build aria-describedby string
  const ariaDescribedBy = [
    error ? errorId : null,
    helperText && !error ? helperId : null,
    showCharacterCount && maxLength ? `${inputId}-count` : null
  ].filter(Boolean).join(' ') || undefined;

  // Determine inputMode based on type for better mobile keyboard
  const getInputMode = (): React.InputHTMLAttributes<HTMLInputElement>['inputMode'] => {
    // If inputMode is explicitly provided, use it
    if (props.inputMode) {
      return props.inputMode;
    }
    
    // Map input types to appropriate inputMode for mobile keyboards
    switch (props.type) {
      case 'email':
        return 'email';
      case 'tel':
        return 'tel';
      case 'url':
        return 'url';
      case 'number':
        return 'numeric';
      case 'search':
        return 'search';
      default:
        return undefined;
    }
  };

  const inputMode = getInputMode();

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={actualRef}
          {...props}
          id={inputId}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          maxLength={maxLength}
          inputMode={inputMode}
          enterKeyHint={enterKeyHint}
          aria-labelledby={labelId}
          aria-describedby={ariaDescribedBy}
          aria-invalid={error ? 'true' : 'false'}
          aria-required={props.required ? 'true' : undefined}
          className={`
            w-full rounded-xl border px-3.5 text-sm font-normal leading-normal text-slate-900
            shadow-sm placeholder-transparent
            transition-[border-color,box-shadow,background-color] duration-150
            focus:outline-none focus:ring-2 focus:ring-offset-0 dark:focus:ring-offset-0
            h-12
            bg-white dark:bg-slate-900/90 dark:text-slate-100
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
      </div>
      
      {/* Helper text and character count */}
      <div className="mt-1 flex items-center justify-between">
        <div className="flex-1">
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
        {showCharacterCount && maxLength && (
          <span id={`${inputId}-count`} className={`text-xs ml-2 ${currentLength > maxLength * 0.9 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`} aria-live="polite">
            {currentLength}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
});

FloatingLabelInput.displayName = 'FloatingLabelInput';

export default FloatingLabelInput;

