import React from 'react';
import { Megaphone, ChevronRight } from 'lucide-react';
import FileAttachmentChips from '../files/FileAttachmentChips';
import { formatAnnouncementDate } from './announcementUi';
import { SectionDividerHeading } from '../common/SectionDividerHeading';

export interface Announcement {
  _id: string;
  title: string;
  body: string;
  createdAt: string;
  author: { firstName: string; lastName: string; profilePicture?: string };
  options?: {
    delayPosting?: boolean;
    allowComments?: boolean;
    requirePostBeforeSeeingReplies?: boolean;
    enablePodcastFeed?: boolean;
    allowLiking?: boolean;
  };
  postTo?: string;
  delayedUntil?: string;
  attachments?: Array<string | Record<string, unknown>>;
  fileAssets?: Array<string | Record<string, unknown>>;
}

interface AnnouncementListProps {
  announcements: Announcement[];
  onSelect?: (announcement: Announcement) => void;
}

const AnnouncementList: React.FC<AnnouncementListProps> = ({ announcements, onSelect }) => {
  const items = Array.isArray(announcements) ? announcements : [];
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-16 text-center dark:border-slate-700 dark:bg-slate-800/30">
        <Megaphone className="mx-auto mb-4 h-12 w-12 text-slate-300 dark:text-slate-600" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">No announcements yet</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Check back later for course updates.
        </p>
      </div>
    );
  }
  return (
    <section aria-labelledby="announcements-heading">
      <SectionDividerHeading id="announcements-heading">Announcements</SectionDividerHeading>
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200/70 dark:divide-slate-800 dark:bg-slate-900 dark:ring-slate-700/60">
      {items.map(a => {
        const plain = String(a.body ?? '').replace(/<[^>]+>/g, '');
        const preview =
          plain.length > 140 ? `${plain.slice(0, 140).trim()}…` : plain;
        const authorName = [a.author?.firstName, a.author?.lastName].filter(Boolean).join(' ');

        return (
          <li key={a._id}>
            <button
              type="button"
              className="group flex w-full items-start gap-4 px-4 py-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60 sm:px-5 sm:py-5"
              onClick={() => onSelect?.(a)}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/40">
                <Megaphone className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <h3 className="text-base font-semibold text-slate-900 group-hover:text-indigo-700 dark:text-slate-100 dark:group-hover:text-indigo-300 sm:text-lg">
                    {a.title}
                  </h3>
                  <time
                    className="shrink-0 text-xs text-slate-500 dark:text-slate-400"
                    dateTime={a.createdAt}
                  >
                    {formatAnnouncementDate(a.createdAt)}
                  </time>
                </div>
                {preview ? (
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {preview}
                  </p>
                ) : null}
                {authorName ? (
                  <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-500">
                    {authorName}
                  </p>
                ) : null}
                <FileAttachmentChips files={a.fileAssets || a.attachments} />
              </div>
              <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-300 transition group-hover:text-indigo-500 dark:text-slate-600" />
            </button>
          </li>
        );
      })}
      </ul>
    </section>
  );
};

export default AnnouncementList;
