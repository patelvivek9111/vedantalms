import React, { useState } from 'react';
import { format } from 'date-fns';
import { getImageUrl } from '../../services/api';
import type { Announcement } from './AnnouncementList';

const OPTION_BADGE =
  'inline-flex items-center rounded-full border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400';

export function formatAnnouncementDate(dateString: string): string {
  try {
    return format(new Date(dateString), "MMM d, yyyy 'at' h:mm a");
  } catch {
    return new Date(dateString).toLocaleString();
  }
}

export function AnnouncementOptionBadges({
  options,
  className = '',
}: {
  options?: Announcement['options'];
  className?: string;
}) {
  if (!options) return null;

  const badges: { key: string; label: string }[] = [];
  if (options.delayPosting) badges.push({ key: 'delay', label: 'Scheduled' });
  if (options.allowComments) badges.push({ key: 'comments', label: 'Comments on' });
  if (options.requirePostBeforeSeeingReplies) {
    badges.push({ key: 'replies', label: 'Reply gate' });
  }
  if (options.enablePodcastFeed) badges.push({ key: 'podcast', label: 'Podcast' });
  if (options.allowLiking) badges.push({ key: 'likes', label: 'Likes on' });

  if (badges.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {badges.map(({ key, label }) => (
        <span key={key} className={OPTION_BADGE}>
          {label}
        </span>
      ))}
    </div>
  );
}

export function AnnouncementAuthorAvatar({
  firstName,
  lastName,
  profilePicture,
  size = 'md',
}: {
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
  size?: 'sm' | 'md';
}) {
  const [imgError, setImgError] = useState(false);
  const initials = `${firstName?.[0] ?? '?'}${lastName?.[0] ?? ''}`.toUpperCase();
  const sizeClass = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';

  if (profilePicture && !imgError) {
    return (
      <img
        src={profilePicture.startsWith('http') ? profilePicture : getImageUrl(profilePicture)}
        alt={`${firstName ?? ''} ${lastName ?? ''}`.trim()}
        className={`${sizeClass} shrink-0 rounded-full border border-slate-200 object-cover dark:border-slate-700`}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300`}
      aria-hidden
    >
      {initials}
    </div>
  );
}

export function AnnouncementCommentComposer({
  value,
  onChange,
  onSubmit,
  posting,
  placeholder = 'Write a comment…',
  submitLabel = 'Post comment',
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  posting?: boolean;
  placeholder?: string;
  submitLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/30">
      <textarea
        className="block w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
        rows={3}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={posting}
      />
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onSubmit}
          disabled={posting || !value.trim()}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
        >
          {posting ? 'Posting…' : submitLabel}
        </button>
      </div>
    </div>
  );
}
