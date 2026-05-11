import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  path: string;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  showHome?: boolean;
  /** Merged onto the root nav; default keeps bottom spacing for standalone use */
  className?: string;
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, showHome = true, className }) => {
  const location = useLocation();

  // Auto-generate breadcrumbs from pathname if items not provided
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [];

    if (showHome) {
      breadcrumbs.push({ label: 'Dashboard', path: '/dashboard' });
    }

    let currentPath = '';
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      
      // Skip numeric IDs and use more readable labels
      if (!/^\d+$/.test(segment)) {
        // Convert segment to readable label
        const label = segment
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        
        breadcrumbs.push({
          label,
          path: currentPath
        });
      } else if (index === pathSegments.length - 1) {
        // Last segment might be an ID, use a generic label
        breadcrumbs.push({
          label: 'Details',
          path: currentPath
        });
      }
    });

    return breadcrumbs;
  };

  const breadcrumbItems = items || generateBreadcrumbs();

  if (breadcrumbItems.length === 0) {
    return null;
  }

  return (
    <nav 
      className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-slate-100 to-white px-2.5 py-1.5 text-sm text-slate-600 dark:from-slate-800 dark:to-slate-900 dark:text-slate-300 ${className ?? 'mb-4'}`}
      aria-label="Breadcrumb"
    >
      {breadcrumbItems.map((item, index) => {
        const isLast = index === breadcrumbItems.length - 1;
        
        return (
          <React.Fragment key={`${item.path}-${index}`}>
            {index === 0 && showHome ? (
              <Link
                to={item.path}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm transition-colors hover:text-blue-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:text-blue-300"
                aria-label="Home"
              >
                <Home className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                {isLast ? (
                  <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow-sm dark:bg-blue-500">
                    {item.label}
                  </span>
                ) : (
                  <Link
                    to={item.path}
                    className="rounded-full px-2 py-1 text-slate-600 transition-colors hover:bg-white hover:text-blue-600 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-blue-300"
                  >
                    {item.label}
                  </Link>
                )}
              </>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumb;

