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
            w-full min-h-[48px] px-4 sm:px-3 ${isFloating ? 'pt-8 pb-3 sm:pb-2' : 'pt-4 pb-4'} border rounded-md 
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
      </div>
      
      {/* Helper text and character count */}
      <div className="mt-1 flex items-center justify-between">
        <div className="flex-1">
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
        {showCharacterCount && maxLength && (
          <span id={`${inputId}-count`} className={`text-xs ml-2 ${currentLength > maxLength * 0.9 ? 'text-orange-500' : 'text-gray-500 dark:text-gray-400'}`} aria-live="polite">
            {currentLength}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
});

FloatingLabelInput.displayName = 'FloatingLabelInput';

export default FloatingLabelInput;

