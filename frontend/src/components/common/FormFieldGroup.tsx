import React from 'react';

interface FormFieldGroupProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

const FormFieldGroup: React.FC<FormFieldGroupProps> = ({
  title,
  description,
  children,
  className = ''
}) => {
  return (
    <div className={`border border-gray-200 dark:border-gray-700 rounded-lg p-4 sm:p-6 bg-white dark:bg-gray-900 ${className}`}>
      {(title || description) && (
        <div className="mb-4">
          {title && (
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
              {title}
            </h3>
          )}
          {description && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {description}
            </p>
          )}
        </div>
      )}
      <div className="space-y-5 sm:space-y-4">
        {children}
      </div>
    </div>
  );
};

export default FormFieldGroup;

