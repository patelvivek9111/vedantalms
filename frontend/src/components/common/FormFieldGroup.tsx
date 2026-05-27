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
  className = '',
}) => {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {(title || description) && (
        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:px-6">
          {title && (
            <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-lg">
              {title}
            </h3>
          )}
          {description && (
            <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {description}
            </p>
          )}
        </div>
      )}
      <div className="space-y-5 px-5 py-5 sm:space-y-4 sm:px-6 sm:py-6">{children}</div>
    </section>
  );
};

export default FormFieldGroup;
