import React, { useState, useEffect, useRef } from 'react';

interface FloatingLabelTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  showCharacterCount?: boolean;
  maxLength?: number;
  helperText?: string;
}

const FloatingLabelTextarea: React.FC<FloatingLabelTextareaProps> = ({
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
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [hasValue, setHasValue] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setHasValue(!!value && String(value).length > 0);
  }, [value]);

  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    setIsFocused(true);
    
    // Auto-scroll to textarea on mobile devices when focused
    const scrollToTextarea = () => {
      if (textareaRef.current) {
        // Check if it's a mobile device
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || 
                        (window.innerWidth <= 768 && 'ontouchstart' in window);
        
        if (isMobile) {
          // Scroll textarea into view, centered vertically
          setTimeout(() => {
            textareaRef.current?.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
              inline: 'nearest'
            });
          }, 300); // Delay to account for keyboard animation
        }
      }
    };
    
    scrollToTextarea();
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setHasValue(e.target.value.length > 0);
    onChange?.(e);
  };

  const isFloating = isFocused || hasValue;
  const currentLength = value ? String(value).length : 0;
  
  // Generate unique IDs for accessibility
  const textareaId = props.id || `floating-textarea-${Math.random().toString(36).substr(2, 9)}`;
  const labelId = `${textareaId}-label`;
  const errorId = `${textareaId}-error`;
  const helperId = `${textareaId}-helper`;
  
  // Build aria-describedby string
  const ariaDescribedBy = [
    error ? errorId : null,
    helperText && !error ? helperId : null,
    showCharacterCount && maxLength ? `${textareaId}-count` : null
  ].filter(Boolean).join(' ') || undefined;

  return (
    <div className="relative">
      <div className="relative">
        <textarea
          ref={textareaRef}
          {...props}
          id={textareaId}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          maxLength={maxLength}
          aria-labelledby={labelId}
          aria-describedby={ariaDescribedBy}
          aria-invalid={error ? 'true' : 'false'}
          aria-required={props.required ? 'true' : undefined}
          className={`
            w-full min-h-[120px] px-4 sm:px-3 ${isFloating ? 'pt-8 pb-3 sm:pb-2' : 'pt-4 pb-4'} border rounded-md 
            bg-white dark:bg-gray-900 
            text-gray-900 dark:text-gray-100 text-base
            placeholder-transparent
            focus:outline-none focus:ring-2 
            transition-all duration-200
            resize-none
            ${error 
              ? 'border-red-500 dark:border-red-500 focus:ring-red-500 dark:focus:ring-red-500' 
              : 'border-gray-300 dark:border-gray-700 focus:ring-blue-500 dark:focus:ring-blue-400'
            }
            ${className}
          `}
        />
        <label
          id={labelId}
          htmlFor={textareaId}
          className={`
            absolute left-3 transition-all duration-200 pointer-events-none z-20
            ${isFloating
              ? 'top-2.5 text-xs text-blue-600 dark:text-blue-400 font-medium bg-white dark:bg-gray-900 px-1.5 -mx-1.5 rounded backdrop-blur-sm'
              : 'top-3 text-base text-gray-500 dark:text-gray-400'
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
          <span id={`${textareaId}-count`} className={`text-xs ml-2 ${currentLength > maxLength * 0.9 ? 'text-orange-500' : 'text-gray-500 dark:text-gray-400'}`} aria-live="polite">
            {currentLength}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
};

export default FloatingLabelTextarea;

