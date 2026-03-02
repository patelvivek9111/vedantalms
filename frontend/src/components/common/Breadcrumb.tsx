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
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, showHome = true }) => {
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
      className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 mb-4"
      aria-label="Breadcrumb"
    >
      {breadcrumbItems.map((item, index) => {
        const isLast = index === breadcrumbItems.length - 1;
        
        return (
          <React.Fragment key={`${item.path}-${index}`}>
            {index === 0 && showHome ? (
              <Link
                to={item.path}
                className="flex items-center hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                aria-label="Home"
              >
                <Home className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                {isLast ? (
                  <span className="text-gray-900 dark:text-gray-100 font-medium">
                    {item.label}
                  </span>
                ) : (
                  <Link
                    to={item.path}
                    className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
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

