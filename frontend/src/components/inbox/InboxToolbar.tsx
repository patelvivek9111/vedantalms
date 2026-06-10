import React from 'react';
import { PenLine, Archive, ArchiveRestore, Trash2, Search, ChevronDown } from 'lucide-react';
import { FOLDER_OPTIONS } from './inboxUtils';
import type { InboxFolder } from '../../hooks/inbox/useInboxUrlState';

type CourseOption = { value: string; label: string };

type InboxToolbarProps = {
  userRole?: string;
  courseOptions: CourseOption[];
  selectedCourse: string;
  selectedFolder: InboxFolder;
  search: string;
  selectedCount: number;
  bulkActionLoading: boolean;
  searchInputRef: React.RefObject<HTMLInputElement>;
  onCourseChange: (course: string) => void;
  onFolderChange: (folder: InboxFolder) => void;
  onSearchChange: (search: string) => void;
  onCompose: () => void;
  onArchive: () => void;
  onDelete: () => void;
};

/** Shared sizing — every interactive control uses h-10 + rounded-lg */
const CONTROL =
  'h-10 rounded-lg border border-gray-200 transition-colors dark:border-gray-700';
const CONTROL_TEXT =
  'text-[10px] font-medium text-gray-600 sm:text-[11px] dark:text-gray-300';
const DESKTOP_CONTROL_TEXT = 'text-xs font-medium text-gray-600 dark:text-gray-300';
const CONTROL_FOCUS =
  'focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:border-blue-500 dark:focus:ring-blue-900/40';

const FolderTabs: React.FC<{
  selectedFolder: InboxFolder;
  onFolderChange: (folder: InboxFolder) => void;
  tabClassName?: string;
}> = ({ selectedFolder, onFolderChange, tabClassName = '' }) => (
  <>
    {FOLDER_OPTIONS.map((opt) => {
      const active = selectedFolder === opt.value;
      return (
        <button
          key={opt.value}
          type="button"
          role="tab"
          onClick={() => onFolderChange(opt.value)}
          className={`flex h-8 min-w-0 flex-1 items-center justify-center truncate rounded-md px-0.5 font-medium transition-colors touch-manipulation sm:px-1 ${tabClassName} ${
            active
              ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-50'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
          aria-selected={active}
          title={opt.label}
        >
          {opt.label}
        </button>
      );
    })}
  </>
);

const BulkActionBar: React.FC<{
  selectedCount: number;
  bulkActionLoading: boolean;
  archiveMode: 'archive' | 'unarchive' | 'restore';
  onArchive: () => void;
  onDelete: () => void;
  className?: string;
}> = ({ selectedCount, bulkActionLoading, archiveMode, onArchive, onDelete, className = '' }) => {
  const archiveLabel =
    archiveMode === 'unarchive' ? 'Unarchive' : archiveMode === 'restore' ? 'Restore' : 'Archive';
  const showRestoreIcon = archiveMode === 'unarchive' || archiveMode === 'restore';

  return (
  <div
    className={`flex h-10 items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 dark:border-gray-700 dark:bg-gray-800/80 ${className}`}
  >
    <span className="shrink-0 text-[10px] font-medium text-gray-600 dark:text-gray-300">
      {bulkActionLoading ? 'Processing…' : `${selectedCount} selected`}
    </span>
    <div className="flex shrink-0 items-center gap-0.5">
      <button
        className="icon-only inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md p-0 text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-40 touch-manipulation dark:text-gray-300 dark:hover:bg-gray-700"
        title={archiveLabel}
        aria-label={`${archiveLabel} ${selectedCount} selected conversation${selectedCount !== 1 ? 's' : ''}`}
        onClick={onArchive}
        disabled={bulkActionLoading}
        type="button"
      >
        {showRestoreIcon ? (
          <ArchiveRestore className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
        ) : (
          <Archive className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
        )}
      </button>
      <button
        className="icon-only inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md p-0 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40 touch-manipulation dark:text-red-400 dark:hover:bg-red-950/40"
        title="Delete"
        aria-label={`Delete ${selectedCount} selected conversation${selectedCount !== 1 ? 's' : ''}`}
        onClick={onDelete}
        disabled={bulkActionLoading}
        type="button"
      >
        <Trash2 className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  </div>
  );
};

const InboxToolbar: React.FC<InboxToolbarProps> = ({
  userRole,
  courseOptions,
  selectedCourse,
  selectedFolder,
  search,
  selectedCount,
  bulkActionLoading,
  searchInputRef,
  onCourseChange,
  onFolderChange,
  onSearchChange,
  onCompose,
  onArchive,
  onDelete,
}) => {
  const archiveMode =
    selectedFolder === 'archived'
      ? 'unarchive'
      : selectedFolder === 'deleted'
        ? 'restore'
        : 'archive';

  return (
  <div className="sticky top-0 z-20 border-b border-gray-200 bg-white pt-20 dark:border-gray-800 dark:bg-gray-900 lg:border-gray-200/80 lg:bg-white/95 lg:pt-0 lg:backdrop-blur-sm dark:lg:bg-gray-900/95">
    {/* Mobile — unchanged stacked layout */}
    <div className="mx-auto w-full max-w-3xl space-y-2 px-4 py-3 lg:hidden">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <label htmlFor="inbox-search" className="sr-only">
            Search conversations
          </label>
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
            aria-hidden="true"
          />
          <input
            id="inbox-search"
            name="search"
            ref={searchInputRef}
            className={`compact-control ${CONTROL} ${CONTROL_TEXT} ${CONTROL_FOCUS} w-full bg-gray-50 pl-9 pr-3 text-gray-900 placeholder:font-normal placeholder:text-[10px] placeholder:text-gray-400 focus:bg-white sm:placeholder:text-[11px] dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:bg-gray-800`}
            type="text"
            placeholder="Search messages"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <button
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 p-2.5 text-white shadow-sm transition-colors hover:bg-blue-700 active:bg-blue-800 touch-manipulation dark:bg-blue-500 dark:hover:bg-blue-600"
          title="Compose"
          aria-label="Compose new message"
          onClick={onCompose}
          type="button"
        >
          <PenLine className="h-full w-full" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      <div
        className={`${CONTROL} flex gap-0.5 bg-gray-100 p-0.5 dark:bg-gray-800`}
        role="tablist"
        aria-label="Message folders"
      >
        <FolderTabs
          selectedFolder={selectedFolder}
          onFolderChange={onFolderChange}
          tabClassName="text-[10px] sm:text-[11px]"
        />
      </div>

      {userRole !== 'admin' && (
        <div className="relative">
          <select
            id="topbar-course-dropdown"
            name="topbarCourseDropdown"
            className={`compact-control ${CONTROL} ${CONTROL_TEXT} ${CONTROL_FOCUS} w-full appearance-none bg-white px-3 pr-9 dark:bg-gray-800`}
            value={selectedCourse}
            onChange={(e) => onCourseChange(e.target.value)}
          >
            {courseOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
        </div>
      )}

      {selectedCount > 0 && (
        <BulkActionBar
          selectedCount={selectedCount}
          bulkActionLoading={bulkActionLoading}
          archiveMode={archiveMode}
          onArchive={onArchive}
          onDelete={onDelete}
        />
      )}
    </div>

    {/* Desktop — full-width horizontal toolbar */}
    <div className="hidden w-full space-y-3 px-6 py-4 lg:block">
      <div className="flex items-center gap-3">
        <div className="relative w-72 shrink-0 xl:w-80">
          <label htmlFor="inbox-search-desktop" className="sr-only">
            Search conversations
          </label>
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
            aria-hidden="true"
          />
          <input
            id="inbox-search-desktop"
            name="searchDesktop"
            className={`compact-control ${CONTROL} ${DESKTOP_CONTROL_TEXT} ${CONTROL_FOCUS} w-full bg-gray-50 pl-10 pr-3 text-gray-900 placeholder:font-normal placeholder:text-gray-400 focus:bg-white dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:bg-gray-800`}
            type="text"
            placeholder="Search messages"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div
          className={`${CONTROL} flex min-w-0 flex-1 gap-0.5 bg-gray-100 p-0.5 dark:bg-gray-800`}
          role="tablist"
          aria-label="Message folders"
        >
          <FolderTabs
            selectedFolder={selectedFolder}
            onFolderChange={onFolderChange}
            tabClassName="text-xs"
          />
        </div>

        {userRole !== 'admin' && (
          <div className="relative w-52 shrink-0 xl:w-60">
            <select
              id="topbar-course-dropdown-desktop"
              name="topbarCourseDropdownDesktop"
              className={`compact-control ${CONTROL} ${DESKTOP_CONTROL_TEXT} ${CONTROL_FOCUS} w-full appearance-none bg-white px-3 pr-9 dark:bg-gray-800`}
              value={selectedCourse}
              onChange={(e) => onCourseChange(e.target.value)}
            >
              {courseOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
          </div>
        )}

        <button
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 p-2.5 text-white shadow-sm transition-colors hover:bg-blue-700 active:bg-blue-800 dark:bg-blue-500 dark:hover:bg-blue-600"
          title="Compose"
          aria-label="Compose new message"
          onClick={onCompose}
          type="button"
        >
          <PenLine className="h-full w-full" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      {selectedCount > 0 && (
        <BulkActionBar
          selectedCount={selectedCount}
          bulkActionLoading={bulkActionLoading}
          archiveMode={archiveMode}
          onArchive={onArchive}
          onDelete={onDelete}
          className="max-w-xl"
        />
      )}
    </div>
  </div>
  );
};

export default InboxToolbar;
