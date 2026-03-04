import React from 'react';

export interface SkeletonLoaderProps {
  variant?: 'card' | 'table' | 'text' | 'circle' | 'custom';
  count?: number;
  className?: string;
  width?: string;
  height?: string;
  rounded?: boolean;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  variant = 'text',
  count = 1,
  className = '',
  width,
  height,
  rounded = true
}) => {
  const baseClasses = 'animate-pulse bg-gray-200 dark:bg-gray-700';
  const roundedClass = rounded ? 'rounded' : '';

  const renderSkeleton = () => {
    switch (variant) {
      case 'card':
        return (
          <div className={`${baseClasses} ${roundedClass} ${className}`} style={{ width, height }}>
            <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-t-lg"></div>
            <div className="p-4 space-y-3">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
            </div>
          </div>
        );

      case 'table':
        return (
          <tr className={className}>
            <td colSpan={100} className="p-4">
              <div className="space-y-3">
                {Array.from({ length: count }).map((_, index) => (
                  <div key={index} className="flex items-center space-x-4">
                    <div className={`${baseClasses} ${roundedClass} h-4 w-4`}></div>
                    <div className={`${baseClasses} ${roundedClass} h-4 flex-1`}></div>
                    <div className={`${baseClasses} ${roundedClass} h-4 w-24`}></div>
                    <div className={`${baseClasses} ${roundedClass} h-4 w-20`}></div>
                    <div className={`${baseClasses} ${roundedClass} h-4 w-16`}></div>
                  </div>
                ))}
              </div>
            </td>
          </tr>
        );

      case 'circle':
        return (
          <div className={`${baseClasses} ${roundedClass} ${className}`} style={{ width: width || '40px', height: height || '40px', borderRadius: '50%' }}></div>
        );

      case 'text':
        return (
          <>
            {Array.from({ length: count }).map((_, index) => (
              <div
                key={index}
                className={`${baseClasses} ${roundedClass} ${className}`}
                style={{ width: width || '100%', height: height || '1rem' }}
              ></div>
            ))}
          </>
        );

      case 'custom':
        return (
          <div className={`${baseClasses} ${roundedClass} ${className}`} style={{ width, height }}></div>
        );

      default:
        return null;
    }
  };

  return <>{renderSkeleton()}</>;
};

// Course Card Skeleton
export const CourseCardSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700"
        >
          {/* Top section - colored header */}
          <div className="h-32 sm:h-48 bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
          
          {/* Content section */}
          <div className="p-4 sm:p-6 space-y-3">
            {/* Title */}
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4"></div>
            
            {/* Description lines */}
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-full"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-5/6"></div>
            </div>
            
            {/* Metadata */}
            <div className="flex items-center gap-4 pt-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-20"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-16"></div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
};

// Table Row Skeleton
export const TableRowSkeleton: React.FC<{ columns?: number; rows?: number }> = ({ columns = 5, rows = 5 }) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-b border-gray-200 dark:border-gray-700">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <td key={colIndex} className="p-4">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-full"></div>
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};

// Quiz Card Skeleton
export const QuizCardSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 hover:shadow-xl transition-shadow"
        >
          {/* Title */}
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4 mb-4"></div>
          
          {/* Metadata */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-4">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-20"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-16"></div>
          </div>
          
          {/* Buttons */}
          <div className="flex gap-2">
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse flex-1"></div>
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-10"></div>
          </div>
          <div className="flex justify-center mt-2">
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-10"></div>
          </div>
        </div>
      ))}
    </>
  );
};

// App Loading Skeleton
export const AppLoadingSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 dark:text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Header skeleton */}
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-48 mb-4"></div>
          
          {/* Course cards skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <CourseCardSkeleton count={6} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkeletonLoader;


