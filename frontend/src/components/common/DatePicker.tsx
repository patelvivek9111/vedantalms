import React, { useState, useRef } from 'react';
import { Calendar } from 'lucide-react';

interface DatePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: string;
  helperText?: string;
  showTime?: boolean;
}

const DatePicker: React.FC<DatePickerProps> = ({
  label,
  error,
  helperText,
  showTime = false,
  value,
  onChange,
  onFocus,
  onBlur,
  className = '',
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    
    // Auto-scroll to input on mobile devices when focused
    // Small delay to account for virtual keyboard appearing
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
    onChange?.(e);
  };

  const handleCalendarClick = () => {
    if (inputRef.current) {
      inputRef.current.focus();
      // Try to show the native picker if available (modern browsers)
      if ('showPicker' in inputRef.current && typeof inputRef.current.showPicker === 'function') {
        try {
          inputRef.current.showPicker();
        } catch (err) {
          // Fallback to just focusing if showPicker fails
          inputRef.current.focus();
        }
      } else {
        // For older browsers, just focus the input
        inputRef.current.focus();
      }
    }
  };

  const inputType = showTime ? 'datetime-local' : 'date';
  
  // Generate unique IDs for accessibility
  const inputId = props.id || `date-picker-${Math.random().toString(36).substr(2, 9)}`;
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
      {/* Label above input */}
      <label
        id={labelId}
        htmlFor={inputId}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
      >
        {label}
        {props.required && <span className="text-red-500 ml-1" aria-label="required">*</span>}
      </label>
      
      {/* Input with calendar icon */}
      <div className="relative">
        <input
          ref={inputRef}
          {...props}
          id={inputId}
          type={inputType}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          aria-labelledby={labelId}
          aria-describedby={ariaDescribedBy}
          aria-invalid={error ? 'true' : 'false'}
          aria-required={props.required ? 'true' : undefined}
          className={`
            w-full min-h-[48px] px-4 sm:px-3 py-3 sm:py-2.5 pr-12 sm:pr-10 border rounded-md 
            bg-white dark:bg-gray-900 
            text-gray-900 dark:text-gray-100 text-base
            focus:outline-none focus:ring-2 
            transition-all duration-200
            [&::-webkit-calendar-picker-indicator]:hidden
            [&::-webkit-calendar-picker-indicator]:appearance-none
            [&::-webkit-inner-spin-button]:hidden
            [&::-webkit-outer-spin-button]:hidden
            ${error 
              ? 'border-red-500 dark:border-red-500 focus:ring-red-500 dark:focus:ring-red-500' 
              : 'border-gray-300 dark:border-gray-700 focus:ring-blue-500 dark:focus:ring-blue-400'
            }
            ${className}
          `}
          style={{
            ...props.style,
            WebkitAppearance: 'none',
            MozAppearance: 'textfield'
          }}
        />
        {/* Clickable calendar icon */}
        <button
          type="button"
          onClick={handleCalendarClick}
          className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer hover:opacity-70 transition-opacity focus:outline-none"
          aria-label="Open date picker"
          tabIndex={-1}
        >
          <Calendar className="w-5 h-5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" aria-hidden="true" />
        </button>
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

export default DatePicker;

