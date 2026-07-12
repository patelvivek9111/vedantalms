import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ContactInquiryModal } from '../components/modals/ContactInquiryModal';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  ClipboardList,
  LayoutGrid,
  ListChecks,
  Mail,
  MessageSquare,
  QrCode,
  Shield,
  BarChart3,
  Smartphone,
  Users,
  Menu,
  X,
} from 'lucide-react';

const aboutHighlights = [
  {
    icon: ListChecks,
    title: 'To-do for teachers',
    description:
      'Grading queues and enrollment reminders surface where instructors already work—so nothing slips through the cracks.',
  },
  {
    icon: Smartphone,
    title: 'Student experience',
    description:
      'Dashboard, course home, modules, and discussions stay consistent across devices for a calmer day-to-day.',
  },
  {
    icon: QrCode,
    title: 'Flexible enrollment',
    description:
      'Catalog, join codes, QR deep links, waitlists, and instructor approve or deny—one model you can tune per course.',
  },
] as const;

const logoSrc = () => `${import.meta.env.BASE_URL}assets/Vedanta_logo.png`;

const NAV = [
  { label: 'Home', to: '#top' },
  { label: 'Features', to: '#features' },
  { label: 'About', to: '#about' },
  { label: 'Catalog', to: '/catalog' },
] as const;

const features = [
  {
    icon: BookOpen,
    title: 'Courses & modules',
    description: 'Structured modules, rich pages, and media so every cohort follows a clear path from start to finish.',
  },
  {
    icon: MessageSquare,
    title: 'Discussions',
    description: 'Course-scoped threads and conversations that stay where your class lives—not lost in email.',
  },
  {
    icon: ClipboardList,
    title: 'Assignments & grading',
    description: 'Create assignments, collect work, and give feedback with workflows built for teachers and TAs.',
  },
  {
    icon: BarChart3,
    title: 'Gradebook & progress',
    description: 'Instructor and student views so performance is transparent and easy to act on.',
  },
  {
    icon: Calendar,
    title: 'Calendar',
    description: 'Deadlines, events, and course rhythm in one schedule students and staff can trust.',
  },
  {
    icon: LayoutGrid,
    title: 'Catalog & enrollment',
    description: 'Browse offerings, enroll when there is capacity, or join a waitlist when a section is full.',
  },
  {
    icon: QrCode,
    title: 'Enrollment codes & QR',
    description: 'Instructors share an 8-character join code or QR; students request access and teachers approve when ready.',
  },
  {
    icon: Users,
    title: 'People & groups',
    description: 'Rosters, roles, and group spaces so collaboration matches how your institution actually runs.',
  },
  {
    icon: Shield,
    title: 'Roles & access',
    description: 'Students, teachers, and admins each see what they should—without extra complexity.',
  },
] as const;

function LogoMark({ className = '' }: { className?: string }) {
  return (
    <img
      src={logoSrc()}
      alt="MySl8te"
      className={`block shrink-0 object-contain object-center ${className}`}
      width={200}
      height={64}
      decoding="async"
    />
  );
}

const LandingPage: React.FC = () => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileNavOpen(false), []);
  const openContact = useCallback(() => {
    setContactOpen(true);
    setMobileNavOpen(false);
  }, []);

  const navLinkClass =
    'rounded-full px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white';

  const footerLinkClass =
    '-mx-1 block rounded-lg px-1 py-1.5 text-sm text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white';

  return (
    <div
      id="top"
      className="relative flex min-h-0 flex-1 flex-col scroll-smooth bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
    >
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.12),transparent)] dark:bg-[radial-gradient(ellipse_70%_45%_at_50%_-25%,rgba(129,140,248,0.18),transparent)]"
        aria-hidden
      />

      {/* Nav */}
      <header className="sticky top-0 z-50 shrink-0 border-b border-slate-200/70 bg-white/90 shadow-sm shadow-slate-900/[0.03] backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/90 dark:shadow-black/20">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="group flex min-h-10 shrink-0 items-center gap-3 rounded-xl py-1.5 pl-1.5 pr-2.5 transition-colors hover:bg-slate-100/90 dark:hover:bg-slate-800/50 sm:min-h-11 sm:gap-3.5"
            onClick={closeMobile}
            aria-label="MySl8te home"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center sm:h-11 sm:w-11">
              <LogoMark className="max-h-[2.125rem] w-auto max-w-[2.6rem] sm:max-h-10 sm:max-w-[2.85rem]" />
            </span>
            <span className="hidden text-[1.0625rem] font-semibold leading-none tracking-[-0.04em] text-slate-900 dark:text-slate-50 sm:inline sm:text-[1.125rem]">
              MySl8te
            </span>
          </Link>

          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Primary">
            {NAV.map((item) =>
              item.to.startsWith('#') ? (
                <a key={item.label} href={item.to} className={navLinkClass}>
                  {item.label}
                </a>
              ) : (
                <Link key={item.label} to={item.to} className={navLinkClass}>
                  {item.label}
                </Link>
              )
            )}
          </nav>

          <div className="hidden items-center gap-2 sm:flex">
            <Link
              to="/login"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              Sign in
            </Link>
            <button
              type="button"
              onClick={openContact}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              Contact
            </button>
          </div>

          <button
            type="button"
            className="inline-flex rounded-lg p-2 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 lg:hidden"
            aria-expanded={mobileNavOpen}
            aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMobileNavOpen((o) => !o)}
          >
            {mobileNavOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {mobileNavOpen && (
          <div className="border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950 lg:hidden">
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              {NAV.map((item) =>
                item.to.startsWith('#') ? (
                  <a key={item.label} href={item.to} className={navLinkClass} onClick={closeMobile}>
                    {item.label}
                  </a>
                ) : (
                  <Link key={item.label} to={item.to} className={navLinkClass} onClick={closeMobile}>
                    {item.label}
                  </Link>
                )
              )}
              <Link
                to="/login"
                className="mt-2 rounded-xl border border-slate-200 py-2.5 text-center text-sm font-semibold dark:border-slate-700"
                onClick={closeMobile}
              >
                Sign in
              </Link>
              <button
                type="button"
                className="rounded-xl bg-indigo-600 py-2.5 text-center text-sm font-semibold text-white"
                onClick={openContact}
              >
                Contact
              </button>
            </nav>
          </div>
        )}
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col">
        <section className="relative mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-400">
              Learning platform
            </p>
            <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight leading-[1.2] sm:text-5xl lg:text-[3.25rem] lg:leading-[1.25]">
              Elevate the
              <span className="mt-1 block bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text pb-1 text-transparent dark:from-indigo-400 dark:to-violet-400">
                learning experience.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-slate-600 dark:text-slate-400 sm:text-lg">
              MySl8te brings courses, people, and outcomes together—so instructors spend less time juggling tools and
              students always know where to go next.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={openContact}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
              >
                Contact
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/90 bg-white/90 shadow-lg shadow-slate-900/[0.06] ring-1 ring-slate-900/[0.04] dark:border-slate-700/80 dark:bg-slate-900/70 dark:shadow-black/30 dark:ring-white/[0.06]">
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_80%_at_90%_0%,rgba(99,102,241,0.12),transparent_55%),radial-gradient(ellipse_70%_60%_at_0%_100%,rgba(139,92,246,0.1),transparent_50%)]"
                aria-hidden
              />
              <div className="relative p-6 sm:p-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
                  At a glance
                </p>
                <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                  Everything your cohort needs—without switching tools.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  {[
                    { Icon: BookOpen, label: 'Courses & pages' },
                    { Icon: MessageSquare, label: 'Discussions' },
                    { Icon: ClipboardList, label: 'Assignments' },
                    { Icon: BarChart3, label: 'Gradebook' },
                  ].map(({ Icon, label }) => (
                    <div
                      key={label}
                      className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/90 px-3.5 py-3 dark:border-slate-600/60 dark:bg-slate-950/50"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="text-xs font-semibold leading-snug text-slate-700 dark:text-slate-200">{label}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Calendar, catalog, enrollment, and role-aware access—built in, not bolted on.
                </p>
              </div>
            </div>
          </div>
        </div>
        </section>

      {/* Features */}
      <section id="features" className="border-t border-slate-200/80 bg-white py-16 dark:border-slate-800 dark:bg-slate-900/40 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Built for real classrooms</h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-400 sm:text-lg">
              Everything below ships in the product today—from structured content to enrollment flows instructors
              control.
            </p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="rounded-2xl border border-slate-200/90 bg-slate-50/80 p-6 transition hover:border-indigo-200/80 hover:shadow-md dark:border-slate-700/80 dark:bg-slate-950/40 dark:hover:border-indigo-500/30"
              >
                <div className="inline-flex rounded-xl bg-indigo-50 p-2.5 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section
        id="about"
        className="relative border-t border-slate-200/80 bg-gradient-to-b from-slate-50/90 via-white to-white py-16 dark:border-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 sm:py-24"
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-200/50 to-transparent dark:via-indigo-500/20"
          aria-hidden
        />
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-16">
            <div className="lg:col-span-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-400">
                About
              </p>
              <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-4xl">
                About MySl8te
              </h2>
              <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                Clarity over clutter—one calm place for your whole program.
              </p>
              <p className="mt-6 text-pretty text-base leading-relaxed text-slate-600 dark:text-slate-400 sm:text-lg">
                MySl8te keeps lessons, conversations, grades, and scheduling in one place. Teachers stay in control of
                enrollment: catalog when there is room, join codes and QR with optional instructor approval, and
                waitlists that stay predictable when a section is full.
              </p>
            </div>
            <div className="lg:col-span-7">
              <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)_inset,0_20px_50px_-24px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.03] dark:border-slate-700/80 dark:bg-slate-900/60 dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_24px_60px_-28px_rgba(0,0,0,0.45)] dark:ring-white/[0.04]">
                <ul className="divide-y divide-slate-100 dark:divide-slate-700/80">
                  {aboutHighlights.map(({ icon: Icon, title, description }) => (
                    <li key={title} className="group transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <div className="flex gap-4 p-5 sm:gap-5 sm:p-6">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/15 to-violet-500/10 text-indigo-700 ring-1 ring-indigo-500/15 dark:from-indigo-500/20 dark:to-violet-500/10 dark:text-indigo-300 dark:ring-indigo-400/20">
                          <Icon className="h-5 w-5" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 sm:text-base">{title}</h3>
                          <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{description}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      </div>

      {/* CTA + footer — unified dark shell */}
      <div className="relative overflow-hidden border-t border-slate-200/10 bg-slate-950 text-white">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-30%,rgba(99,102,241,0.18),transparent_55%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-indigo-500/25 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 left-1/2 h-64 w-[min(100%,42rem)] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.12),transparent_70%)]"
          aria-hidden
        />

        <div className="relative z-10 mx-auto max-w-6xl px-4 pb-6 pt-16 sm:px-6 sm:pb-8 sm:pt-20 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-300/90">Get in touch</p>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-[2.5rem] md:leading-[1.15]">
              Talk to us
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-slate-400 sm:text-lg">
              Share a few details about your organization and how many people you want to serve—we will follow up by
              email.
            </p>
            <div className="mt-10 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={openContact}
                className="group inline-flex w-full max-w-sm items-center justify-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-slate-900 shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_8px_24px_-4px_rgba(0,0,0,0.35)] ring-1 ring-white/30 transition hover:bg-slate-50 hover:shadow-[0_1px_0_rgba(255,255,255,0.5)_inset,0_12px_32px_-6px_rgba(79,70,229,0.35)] active:scale-[0.99] sm:w-auto sm:min-w-[200px]"
              >
                <Mail className="h-4 w-4 shrink-0 text-indigo-600 transition group-hover:scale-105" aria-hidden />
                Contact
              </button>
              <p className="text-xs font-medium text-slate-500">We typically reply within a few business days.</p>
            </div>
          </div>
        </div>

        <footer className="relative z-10 border-t border-white/[0.06] pb-10 pt-12 text-slate-300">
          <div className="mx-auto grid max-w-6xl items-start gap-12 px-4 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-12 sm:px-6 lg:grid-cols-4 lg:items-center lg:gap-x-8 lg:px-8">
            <div className="flex flex-col items-center text-center sm:col-span-2 lg:col-span-1 lg:items-start lg:text-left">
              <div className="flex justify-center lg:justify-start">
                <LogoMark className="h-11 max-w-[220px]" />
              </div>
              <p className="mt-5 max-w-sm text-sm leading-relaxed text-slate-400">
                Elevate the learning experience. A calmer place for courses, people, and outcomes.
              </p>
            </div>
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Platform</h3>
              <ul className="mt-5 space-y-1 text-sm">
                <li>
                  <Link to="/catalog" className={footerLinkClass}>
                    Catalog
                  </Link>
                </li>
                <li>
                  <Link to="/login" className={footerLinkClass}>
                    Sign in
                  </Link>
                </li>
                <li>
                  <button type="button" onClick={openContact} className={`${footerLinkClass} w-full text-left`}>
                    Contact
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">On this page</h3>
              <ul className="mt-5 space-y-1 text-sm">
                <li>
                  <a href="#top" className={footerLinkClass}>
                    Home
                  </a>
                </li>
                <li>
                  <a href="#features" className={footerLinkClass}>
                    Features
                  </a>
                </li>
                <li>
                  <a href="#about" className={footerLinkClass}>
                    About
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">After sign-in</h3>
              <ul className="mt-5 space-y-2 text-sm text-slate-500">
                <li className="leading-relaxed text-slate-400">Dashboard, courses, calendar, and more</li>
                <li className="text-xs leading-relaxed text-slate-500">
                  Links like Courses and To-do open once you are logged in.
                </li>
              </ul>
            </div>
          </div>
          <div className="mx-auto mt-12 max-w-6xl border-t border-white/[0.06] px-4 pt-8 text-center text-xs text-slate-500 sm:px-6 lg:px-8">
            © {new Date().getFullYear()} MySl8te. All rights reserved.
          </div>
        </footer>
      </div>
      </main>
      <ContactInquiryModal open={contactOpen} onOpenChange={setContactOpen} />
    </div>
  );
};

export default LandingPage;
