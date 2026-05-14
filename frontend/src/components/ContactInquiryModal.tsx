import React, { useCallback, useEffect, useId, useState } from 'react';
import { X } from 'lucide-react';
import { API_URL } from '../config';

export type ContactInquiryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const inquiryEndpoint = `${(API_URL || '').replace(/\/$/, '')}/api/contact/inquiry`;

export function ContactInquiryModal({ open, onOpenChange }: ContactInquiryModalProps) {
  const titleId = useId();
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [userCount, setUserCount] = useState('');
  const [extra, setExtra] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const reset = useCallback(() => {
    setName('');
    setOrganization('');
    setJobTitle('');
    setUserCount('');
    setExtra('');
    setError(null);
    setSent(false);
    setSubmitting(false);
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange, reset]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(inquiryEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          organization: organization.trim(),
          jobTitle: jobTitle.trim(),
          userCount: userCount.trim(),
          extra: extra.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setError(data.message || 'Something went wrong. Please try again.');
        return;
      }
      setSent(true);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const inputClass =
    'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-indigo-500/0 transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onOpenChange(false);
      }}
    >
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-[1] max-h-[min(92vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-950 sm:p-8"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              Contact us
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Tell us about your organization and how we can help.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {sent ? (
          <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100">
            <p className="font-medium">Thank you — your message was sent.</p>
            <p className="mt-2 text-emerald-800/90 dark:text-emerald-200/90">We will get back to you as soon as we can.</p>
            <button
              type="button"
              className="mt-5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
              onClick={() => onOpenChange(false)}
            >
              Close
            </button>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="contact-name" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Full name
              </label>
              <input
                id="contact-name"
                name="name"
                className={inputClass}
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
              />
            </div>
            <div>
              <label htmlFor="contact-title" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Your job title
              </label>
              <input
                id="contact-title"
                name="jobTitle"
                className={inputClass}
                autoComplete="organization-title"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                required
                maxLength={120}
              />
            </div>
            <div>
              <label htmlFor="contact-org" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Organization
              </label>
              <input
                id="contact-org"
                name="organization"
                className={inputClass}
                autoComplete="organization"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                required
                maxLength={200}
              />
            </div>
            <div>
              <label htmlFor="contact-users" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                How many users are you looking to serve?
              </label>
              <input
                id="contact-users"
                name="userCount"
                className={inputClass}
                placeholder="e.g. 50 students, 200 staff, 10–25 classrooms"
                value={userCount}
                onChange={(e) => setUserCount(e.target.value)}
                required
                maxLength={80}
              />
            </div>
            <div>
              <label htmlFor="contact-extra" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Anything else we should know?
              </label>
              <textarea
                id="contact-extra"
                name="extra"
                className={`${inputClass} min-h-[100px] resize-y`}
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                maxLength={5000}
                rows={4}
              />
            </div>

            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
              >
                {submitting ? 'Sending…' : 'Send'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
