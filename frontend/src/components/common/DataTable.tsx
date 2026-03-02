import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, X } from 'lucide-react';
import { TableRowSkeleton } from './SkeletonLoader';

export type SortDirection = 'asc' | 'desc' | null;

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (item: T, index: number) => React.ReactNode;
  sortFn?: (a: T, b: T) => number;
  className?: string;
  headerClassName?: string;
  hidden?: boolean | ((breakpoint: string) => boolean);
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T, event: React.MouseEvent) => void;
  emptyMessage?: string;
  emptyStateComponent?: React.ReactNode;
  pageSize?: number;
  pageSizeOptions?: number[];
  className?: string;
  tableClassName?: string;
  rowClassName?: string | ((item: T, index: number) => string);
  loading?: boolean;
  loadingComponent?: React.ReactNode;
  // Row selection props
  selectable?: boolean;
  selectedKeys?: string[];
  onSelectionChange?: (selectedKeys: string[]) => void;
  renderCheckbox?: (item: T, isSelected: boolean, onChange: () => void) => React.ReactNode;
  // Bulk actions props
  bulkActions?: React.ReactNode;
  bulkActionsClassName?: string;
  // Virtual scrolling props
  virtualScrolling?: boolean;
  virtualScrollingThreshold?: number; // Enable virtual scrolling when data exceeds this count
  virtualScrollingHeight?: number; // Height of the scrollable container in pixels
  estimatedRowHeight?: number; // Estimated height of each row in pixels
}

function DataTable<T extends Record<string, any>>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  emptyMessage = 'No data available',
  emptyStateComponent,
  pageSize: initialPageSize = 25,
  pageSizeOptions = [10, 25, 50, 100],
  className = '',
  tableClassName = '',
  rowClassName = '',
  loading = false,
  loadingComponent,
  selectable = false,
  selectedKeys = [],
  onSelectionChange,
  renderCheckbox,
  bulkActions,
  bulkActionsClassName = '',
  virtualScrolling = false,
  virtualScrollingThreshold = 100,
  virtualScrollingHeight = 600,
  estimatedRowHeight = 50
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(initialPageSize);
  const [scrollTop, setScrollTop] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tbodyRef = useRef<HTMLTableSectionElement>(null);

  // Filter visible columns based on breakpoint (for responsive)
  const visibleColumns = useMemo(() => {
    return columns.filter(col => {
      if (col.hidden === true) return false;
      if (typeof col.hidden === 'function') {
        // For now, we'll show all columns. Responsive hiding can be handled via CSS classes
        return true;
      }
      return true;
    });
  }, [columns]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return data;

    const column = columns.find(col => col.key === sortColumn);
    if (!column || !column.sortable) return data;

    const sorted = [...data].sort((a, b) => {
      if (column.sortFn) {
        return column.sortFn(a, b) * (sortDirection === 'asc' ? 1 : -1);
      }

      // Default sorting
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      // Handle null/undefined
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      // Handle dates
      if (aValue instanceof Date && bValue instanceof Date) {
        return (aValue.getTime() - bValue.getTime()) * (sortDirection === 'asc' ? 1 : -1);
      }

      // Handle strings
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return aValue.localeCompare(bValue) * (sortDirection === 'asc' ? 1 : -1);
      }

      // Handle numbers
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return (aValue - bValue) * (sortDirection === 'asc' ? 1 : -1);
      }

      // Fallback to string comparison
      return String(aValue).localeCompare(String(bValue)) * (sortDirection === 'asc' ? 1 : -1);
    });

    return sorted;
  }, [data, sortColumn, sortDirection, columns]);

  // Determine if virtual scrolling should be used
  const useVirtualScrolling = virtualScrolling && sortedData.length >= virtualScrollingThreshold;

  // Calculate visible range for virtual scrolling
  const virtualScrollRange = useMemo(() => {
    if (!useVirtualScrolling) return { start: 0, end: sortedData.length };

    const buffer = 5; // Render a few extra rows above and below for smooth scrolling
    const visibleCount = Math.ceil(virtualScrollingHeight / estimatedRowHeight);
    const start = Math.max(0, Math.floor(scrollTop / estimatedRowHeight) - buffer);
    const end = Math.min(sortedData.length, start + visibleCount + buffer * 2);

    return { start, end };
  }, [useVirtualScrolling, scrollTop, virtualScrollingHeight, estimatedRowHeight, sortedData.length]);

  // Paginate data (only if not using virtual scrolling)
  const paginatedData = useMemo(() => {
    if (useVirtualScrolling) {
      // For virtual scrolling, return only visible range
      return sortedData.slice(virtualScrollRange.start, virtualScrollRange.end);
    }
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedData.slice(startIndex, endIndex);
  }, [sortedData, currentPage, itemsPerPage, useVirtualScrolling, virtualScrollRange]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);

  // Handle scroll for virtual scrolling
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (useVirtualScrolling) {
      setScrollTop(e.currentTarget.scrollTop);
    }
  }, [useVirtualScrolling]);

  // Handle row selection
  const handleSelectAll = () => {
    if (!selectable || !onSelectionChange) return;
    // When using virtual scrolling, select all items in the dataset, not just visible ones
    const allKeys = useVirtualScrolling 
      ? sortedData.map(item => keyExtractor(item))
      : paginatedData.map(item => keyExtractor(item));
    const allSelected = allKeys.every(key => selectedKeys.includes(key));
    if (allSelected) {
      onSelectionChange(selectedKeys.filter(key => !allKeys.includes(key)));
    } else {
      onSelectionChange([...new Set([...selectedKeys, ...allKeys])]);
    }
  };

  const handleSelectRow = (item: T, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    if (!selectable || !onSelectionChange) return;
    const key = keyExtractor(item);
    if (selectedKeys.includes(key)) {
      onSelectionChange(selectedKeys.filter(k => k !== key));
    } else {
      onSelectionChange([...selectedKeys, key]);
    }
  };

  const isRowSelected = (item: T) => {
    return selectedKeys.includes(keyExtractor(item));
  };

  // For "select all" checkbox state, check all items when using virtual scrolling
  const itemsToCheck = useVirtualScrolling ? sortedData : paginatedData;
  const allRowsSelected = itemsToCheck.length > 0 && itemsToCheck.every(item => isRowSelected(item));
  const someRowsSelected = itemsToCheck.some(item => isRowSelected(item)) && !allRowsSelected;

  // Handle sorting
  const handleSort = (columnKey: string) => {
    const column = columns.find(col => col.key === columnKey);
    if (!column || !column.sortable) return;

    if (sortColumn === columnKey) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortColumn(null);
      }
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting changes
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Handle page size change
  const handlePageSizeChange = (size: number) => {
    setItemsPerPage(size);
    setCurrentPage(1); // Reset to first page when page size changes
  };

  // Get sort icon for column
  const getSortIcon = (columnKey: string) => {
    if (sortColumn !== columnKey) {
      return <ChevronsUpDown className="w-4 h-4 text-gray-400" />;
    }
    if (sortDirection === 'asc') {
      return <ChevronUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    }
    if (sortDirection === 'desc') {
      return <ChevronDown className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    }
    return <ChevronsUpDown className="w-4 h-4 text-gray-400" />;
  };

  // Get row className
  const getRowClassName = (item: T, index: number) => {
    const baseClass = 'hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors';
    const clickableClass = onRowClick ? 'cursor-pointer' : '';
    
    if (typeof rowClassName === 'function') {
      return `${baseClass} ${clickableClass} ${rowClassName(item, index)}`;
    }
    return `${baseClass} ${clickableClass} ${rowClassName}`;
  };

  if (loading) {
    if (loadingComponent) {
      return <div className={className}>{loadingComponent}</div>;
    }
    // Default skeleton loading state
    return (
      <div className={className}>
        <div className="bg-white dark:bg-gray-900 shadow rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {selectable && (
                  <th className="px-2 sm:px-4 py-2 sm:py-3 w-12 bg-gray-50 dark:bg-gray-800">
                    <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </th>
                )}
                {visibleColumns.map((column) => (
                  <th
                    key={column.key}
                    className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800"
                  >
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-24"></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              <TableRowSkeleton columns={visibleColumns.length + (selectable ? 1 : 0)} rows={itemsPerPage} />
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={className}>
        {emptyStateComponent || (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p className="text-sm">{emptyMessage}</p>
          </div>
        )}
      </div>
    );
  }

  const selectedCount = selectedKeys.length;
  const hasSelection = selectable && selectedCount > 0;

  const handleClearSelection = () => {
    if (onSelectionChange) {
      onSelectionChange([]);
    }
  };

  return (
    <div className={className}>
      {/* Bulk Actions Bar */}
      {hasSelection && bulkActions && (
        <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg ${bulkActionsClassName}`}>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
              {selectedCount} {selectedCount === 1 ? 'item' : 'items'} selected
            </span>
            <button
              onClick={handleClearSelection}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            >
              Clear selection
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {bulkActions}
          </div>
        </div>
      )}

      {/* Table */}
      <div 
        ref={scrollContainerRef}
        className={`bg-white dark:bg-gray-900 shadow rounded-lg border border-gray-200 dark:border-gray-700 ${
          useVirtualScrolling ? 'overflow-auto' : 'overflow-x-auto'
        }`}
        style={useVirtualScrolling ? { maxHeight: `${virtualScrollingHeight}px` } : {}}
        onScroll={handleScroll}
      >
        <table className={`min-w-full divide-y divide-gray-200 dark:divide-gray-700 ${tableClassName}`}>
          <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
            <tr>
              {selectable && (
                <th className="px-2 sm:px-4 py-2 sm:py-3 w-12 bg-gray-50 dark:bg-gray-800">
                  {renderCheckbox ? (
                    renderCheckbox({} as T, allRowsSelected, handleSelectAll)
                  ) : (
                    <input
                      type="checkbox"
                      checked={allRowsSelected}
                      ref={(input) => {
                        if (input) input.indeterminate = someRowsSelected;
                      }}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      onClick={(e) => e.stopPropagation()}
                      aria-label={allRowsSelected ? 'Deselect all rows' : 'Select all rows'}
                      aria-describedby={someRowsSelected ? 'select-all-indeterminate' : undefined}
                    />
                  )}
                  {someRowsSelected && (
                    <span id="select-all-indeterminate" className="sr-only">
                      Some rows are selected
                    </span>
                  )}
                </th>
              )}
              {visibleColumns.map((column) => {
                const isSorted = sortColumn === column.key;
                const currentSortDirection = isSorted ? sortDirection : null;
                const ariaSort = isSorted 
                  ? (currentSortDirection === 'asc' ? 'ascending' : 'descending')
                  : 'none';
                
                return (
                  <th
                    key={column.key}
                    className={`
                      px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-medium 
                      text-gray-500 dark:text-gray-400 uppercase tracking-wider
                      bg-gray-50 dark:bg-gray-800
                      ${column.sortable ? 'cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-700' : ''}
                      ${column.headerClassName || ''}
                    `}
                    onClick={() => column.sortable && handleSort(column.key)}
                    aria-sort={column.sortable ? ariaSort : undefined}
                    aria-label={column.sortable ? `${column.label}, click to sort` : column.label}
                    scope="col"
                  >
                    <div className="flex items-center space-x-1">
                      <span>{column.label}</span>
                      {column.sortable && (
                        <span className="flex-shrink-0" aria-hidden="true">
                          {getSortIcon(column.key)}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody 
            ref={tbodyRef}
            className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700"
          >
            {useVirtualScrolling && virtualScrollRange.start > 0 && (
              <tr aria-hidden="true">
                <td 
                  colSpan={visibleColumns.length + (selectable ? 1 : 0)}
                  style={{ height: `${virtualScrollRange.start * estimatedRowHeight}px`, padding: 0, border: 'none' }}
                  className="p-0"
                />
              </tr>
            )}
            {paginatedData.map((item, index) => {
              const actualIndex = useVirtualScrolling 
                ? virtualScrollRange.start + index 
                : (currentPage - 1) * itemsPerPage + index;
              return (
                <tr
                  key={keyExtractor(item)}
                  className={getRowClassName(item, actualIndex)}
                  onClick={(e) => {
                    // Don't trigger row click if clicking on checkbox
                    const target = e.target as HTMLElement;
                    if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
                      return;
                    }
                    onRowClick && onRowClick(item, e);
                  }}
                >
                  {selectable && (
                    <td className="px-2 sm:px-4 py-2 sm:py-3" onClick={(e) => e.stopPropagation()}>
                      {renderCheckbox ? (
                        renderCheckbox(item, isRowSelected(item), () => handleSelectRow(item))
                      ) : (
                        <input
                          type="checkbox"
                          checked={isRowSelected(item)}
                          onChange={() => handleSelectRow(item)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          onClick={(e) => e.stopPropagation()}
                          aria-label={isRowSelected(item) ? `Deselect row ${actualIndex + 1}` : `Select row ${actualIndex + 1}`}
                        />
                      )}
                    </td>
                  )}
                  {visibleColumns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-gray-100 ${column.className || ''}`}
                    >
                      {column.render ? column.render(item, actualIndex) : String(item[column.key] ?? '')}
                    </td>
                  ))}
                </tr>
              );
            })}
            {useVirtualScrolling && virtualScrollRange.end < sortedData.length && (
              <tr aria-hidden="true">
                <td 
                  colSpan={visibleColumns.length + (selectable ? 1 : 0)}
                  style={{ height: `${(sortedData.length - virtualScrollRange.end) * estimatedRowHeight}px`, padding: 0, border: 'none' }}
                  className="p-0"
                />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination - Hide when using virtual scrolling */}
      {!useVirtualScrolling && (totalPages > 1 || itemsPerPage < sortedData.length) ? (
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
          {/* Page size selector */}
          <div className="flex items-center space-x-2">
            <label htmlFor="page-size-select" className="text-sm text-gray-700 dark:text-gray-300">
              Show:
            </label>
            <select
              id="page-size-select"
              value={itemsPerPage}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md 
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 
                       text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 
                       dark:focus:ring-blue-400"
              aria-label="Items per page"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              of {sortedData.length} entries
            </span>
          </div>

          {/* Page navigation */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 
                       bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 
                       rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 
                       disabled:opacity-50 disabled:cursor-not-allowed 
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Go to first page"
            >
              First
            </button>
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 
                       bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 
                       rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 
                       disabled:opacity-50 disabled:cursor-not-allowed 
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Go to previous page"
            >
              Previous
            </button>
            
            <span className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300">
              Page {currentPage} of {totalPages}
            </span>
            
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 
                       bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 
                       rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 
                       disabled:opacity-50 disabled:cursor-not-allowed 
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Go to next page"
            >
              Next
            </button>
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 
                       bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 
                       rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 
                       disabled:opacity-50 disabled:cursor-not-allowed 
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Go to last page"
            >
              Last
            </button>
          </div>
        </div>
      ) : useVirtualScrolling ? (
        // Show entry count for virtual scrolling
        <div className="mt-4 px-2">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Showing {virtualScrollRange.start + 1}-{Math.min(virtualScrollRange.end, sortedData.length)} of {sortedData.length} entries
          </p>
        </div>
      ) : (
        // Show entry count even if no pagination needed
        <div className="mt-4 px-2">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Showing all {sortedData.length} entries
          </p>
        </div>
      )}
    </div>
  );
}

export default DataTable;

