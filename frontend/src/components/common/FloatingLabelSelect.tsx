import React, { useState, useEffect } from 'react';

interface FloatingLabelSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  helperText?: string;
  options: Array<{ value: string; label: string }>;
}

const FloatingLabelSelect: React.FC<FloatingLabelSelectProps> = ({
  label,
  error,
  value,
  onChange,
  onFocus,
  onBlur,
  className = '',
  helperText,
  options,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [hasValue, setHasValue] = useState(false);

  useEffect(() => {
    setHasValue(!!value && String(value).length > 0);
  }, [value]);

  const handleFocus = (e: React.FocusEvent<HTMLSelectElement>) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLSelectElement>) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setHasValue(e.target.value.length > 0);
    onChange?.(e);
  };

  const isFloating = isFocused || hasValue;
  
  // Generate unique IDs for accessibility
  const selectId = props.id || `floating-select-${Math.random().toString(36).substr(2, 9)}`;
  const labelId = `${selectId}-label`;
  const errorId = `${selectId}-error`;
  const helperId = `${selectId}-helper`;
  
  // Build aria-describedby string
  const ariaDescribedBy = [
    error ? errorId : null,
    helperText && !error ? helperId : null
  ].filter(Boolean).join(' ') || undefined;

  return (
    <div className="relative">
      <div className="relative">
        <select
          {...props}
          id={selectId}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          aria-labelledby={labelId}
          aria-describedby={ariaDescribedBy}
          aria-invalid={error ? 'true' : 'false'}
          aria-required={props.required ? 'true' : undefined}
          className={`
            w-full min-h-[48px] px-4 sm:px-3 ${isFloating ? 'pt-8 pb-3 sm:pb-2' : 'pt-4 pb-4'} border rounded-md 
            bg-white dark:bg-gray-900 
            text-gray-900 dark:text-gray-100 text-base sm:text-sm
            appearance-none
            focus:outline-none focus:ring-2 
            transition-all duration-200
            ${error 
              ? 'border-red-500 dark:border-red-500 focus:ring-red-500 dark:focus:ring-red-500' 
              : 'border-gray-300 dark:border-gray-700 focus:ring-blue-500 dark:focus:ring-blue-400'
            }
            ${className}
          `}
        >
          {!hasValue && (
            <option value="" disabled hidden>
              {/* Empty option for placeholder - hidden to avoid conflict with floating label */}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <label
          id={labelId}
          htmlFor={selectId}
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
        {/* Dropdown arrow */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none" aria-hidden="true">
          <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
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

export default FloatingLabelSelect;

