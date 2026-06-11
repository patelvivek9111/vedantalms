import React, { useState, useRef } from 'react';
import { Calendar } from 'lucide-react';

interface DatePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: string;
  helperText?: string;
  showTime?: boolean;
  compact?: boolean;
}

const DatePicker: React.FC<DatePickerProps> = ({
  label,
  error,
  helperText,
  showTime = false,
  compact = false,
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
        className={
          compact
            ? 'mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400'
            : 'mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300'
        }
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
            w-full border bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
            focus:outline-none focus:ring-2 transition-all duration-200
            [&::-webkit-calendar-picker-indicator]:hidden
            [&::-webkit-calendar-picker-indicator]:appearance-none
            [&::-webkit-inner-spin-button]:hidden
            [&::-webkit-outer-spin-button]:hidden
            ${
              compact
                ? 'compact-control h-10 min-h-0 rounded-lg px-3 pr-10 text-[10px] font-medium sm:text-[11px]'
                : 'min-h-[48px] rounded-md px-4 py-3 pr-12 text-base sm:px-3 sm:py-2.5 sm:pr-10'
            }
            ${error
              ? 'border-red-500 dark:border-red-500 focus:ring-red-500 dark:focus:ring-red-500'
              : compact
                ? 'border-gray-200 focus:border-blue-400 focus:ring-blue-100 dark:border-gray-700 dark:focus:border-blue-500 dark:focus:ring-blue-900/40'
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
          <Calendar
            className={`text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 ${compact ? 'h-3.5 w-3.5' : 'h-5 w-5'}`}
            aria-hidden="true"
          />
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

