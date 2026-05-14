import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Loader2, CheckCircle2, XCircle, Clock, ListOrdered, Info, KeyRound } from 'lucide-react';
import { API_URL } from '../config';
import { useCourse } from '../contexts/CourseContext';
import { parseJoinCredential } from '../utils/joinCourseToken';

type JoinPhase =
  | 'idle'
  | 'loading'
  | 'done_enrolled'
  | 'done_awaiting'
  | 'done_waitlist'
  | 'info_join_state'
  | 'error';

const QR_DUPLICATE_STATES = ['already_pending', 'already_waitlist', 'already_enrolled'] as const;
type QrDuplicateState = (typeof QR_DUPLICATE_STATES)[number];

function headlineForJoinState(state: string): string {
  switch (state) {
    case 'already_pending':
      return 'Already waiting for approval';
    case 'already_waitlist':
      return 'Already on the waitlist';
    case 'already_enrolled':
      return 'Already in this course';
    default:
      return 'Here is your status';
  }
}

const JoinCoursePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { getCourses } = useCourse();
  const [manualCode, setManualCode] = useState('');
  const [phase, setPhase] = useState<JoinPhase>('idle');
  const [message, setMessage] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [waitlistPosition, setWaitlistPosition] = useState<number | null>(null);
  const [joinStateKind, setJoinStateKind] = useState<QrDuplicateState | ''>('');
  const urlAttemptRef = useRef(false);

  const enrollWithCredential = useCallback(
    async (raw: string) => {
      const cred = parseJoinCredential(raw);
      if (!cred?.token && !cred?.joinCode) {
        setPhase('error');
        setJoinStateKind('');
        setMessage(
          'That does not look like a valid join code. Enter the 8 characters from your instructor, or paste the full page address if you opened it from a QR scan.'
        );
        return;
      }
      setPhase('loading');
      setMessage('');
      setCourseTitle('');
      setWaitlistPosition(null);
      setJoinStateKind('');
      try {
        const auth = localStorage.getItem('token');
        const body = cred.joinCode ? { joinCode: cred.joinCode } : { token: cred.token };
        const res = await axios.post(`${API_URL}/api/courses/enroll-by-qr`, body, {
          headers: { Authorization: `Bearer ${auth}` },
        });
        const d = res.data || {};
        await getCourses().catch(() => {});

        if (d.awaitingTeacherApproval) {
          setPhase('done_awaiting');
          setCourseTitle(typeof d.courseTitle === 'string' ? d.courseTitle : 'This course');
          setMessage(typeof d.message === 'string' ? d.message : '');
          return;
        }

        if (d.waitlisted) {
          setPhase('done_waitlist');
          setCourseTitle(typeof d.courseTitle === 'string' ? d.courseTitle : 'This course');
          setWaitlistPosition(typeof d.position === 'number' ? d.position : null);
          setMessage(typeof d.message === 'string' ? d.message : '');
          return;
        }

        const cid = d.courseId as string | undefined;
        const okMsg = d.message || 'Successfully enrolled in the course!';
        setPhase('done_enrolled');
        setMessage(okMsg);
        toast.success(okMsg);
        setTimeout(() => {
          if (cid) navigate(`/courses/${cid}`, { replace: true });
          else navigate('/dashboard', { replace: true });
        }, 1600);
      } catch (e: any) {
        const data = e.response?.data;
        const msg = data?.message || e.message || 'Could not join this course';
        const joinState = data?.joinState as string | undefined;
        if (joinState && (QR_DUPLICATE_STATES as readonly string[]).includes(joinState)) {
          setPhase('info_join_state');
          setJoinStateKind(joinState as QrDuplicateState);
          setMessage(typeof data?.message === 'string' ? data.message : msg);
          return;
        }
        setPhase('error');
        urlAttemptRef.current = false;
        setMessage(msg);
        toast.error(msg);
      }
    },
    [getCourses, navigate]
  );

  useEffect(() => {
    const t = searchParams.get('t');
    const c = searchParams.get('c');
    const raw = t || c;
    if (!raw || urlAttemptRef.current) return;
    urlAttemptRef.current = true;
    void enrollWithCredential(raw);
  }, [searchParams, enrollWithCredential]);

  const onSubmitManual = (e: React.FormEvent) => {
    e.preventDefault();
    void enrollWithCredential(manualCode);
  };

  const hasAutoJoinParam = Boolean(searchParams.get('t') || searchParams.get('c'));
  const showManualForm =
    !hasAutoJoinParam &&
    phase !== 'done_awaiting' &&
    phase !== 'done_waitlist' &&
    phase !== 'done_enrolled' &&
    phase !== 'info_join_state';

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-50 via-white to-slate-50/80 px-4 py-10 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="mx-auto max-w-md">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
          Enrollment
        </p>
        <h1 className="text-balance text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
          Join a course
        </h1>
        <p className="mt-3 text-pretty text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Enter the <span className="font-semibold text-slate-800 dark:text-slate-200">8-character join code</span> your
          instructor shared (often next to a QR on the course materials). Scanning the QR may open this page for you
          automatically. When seats are open, your instructor approves new students before enrollment is final. If the
          course is full, you&apos;ll be placed on the waitlist—same as joining from the catalog.
        </p>
      </div>

      <div className="mx-auto mt-8 max-w-md space-y-6">
      {phase === 'loading' && (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <Loader2 className="h-8 w-8 shrink-0 animate-spin text-blue-600" aria-hidden />
          <span className="text-slate-800 dark:text-slate-200">Joining course…</span>
        </div>
      )}

      {phase === 'done_enrolled' && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/30">
          <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <div>
            <div className="font-semibold text-emerald-900 dark:text-emerald-100">You&apos;re enrolled</div>
            <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">{message}</p>
            <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">Redirecting…</p>
          </div>
        </div>
      )}

      {phase === 'done_awaiting' && (
        <div className="flex flex-col gap-4 rounded-xl border border-blue-200 bg-blue-50/90 p-6 dark:border-blue-900 dark:bg-blue-950/30">
          <div className="flex items-start gap-3">
            <Clock className="h-8 w-8 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden />
            <div>
              <div className="font-semibold text-blue-950 dark:text-blue-100">Request received</div>
              <p className="mt-1 text-base font-medium text-blue-900 dark:text-blue-50">{courseTitle}</p>
              <p className="mt-2 text-sm leading-relaxed text-blue-900/90 dark:text-blue-100/90">
                {message || 'Please wait for your instructor to approve your enrollment. You are not enrolled yet.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard', { replace: true })}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 dark:hover:bg-blue-500"
          >
            Back to dashboard
          </button>
        </div>
      )}

      {phase === 'done_waitlist' && (
        <div className="flex flex-col gap-4 rounded-xl border border-amber-200 bg-amber-50/90 p-6 dark:border-amber-900 dark:bg-amber-950/25">
          <div className="flex items-start gap-3">
            <ListOrdered className="h-8 w-8 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
            <div>
              <div className="font-semibold text-amber-950 dark:text-amber-100">On the waitlist</div>
              <p className="mt-1 text-base font-medium text-amber-900 dark:text-amber-50">{courseTitle}</p>
              {waitlistPosition != null && (
                <p className="mt-1 text-sm font-medium text-amber-900 dark:text-amber-200">Position {waitlistPosition}</p>
              )}
              <p className="mt-2 text-sm leading-relaxed text-amber-900/90 dark:text-amber-100/90">
                {message || 'The course is full. Please wait while your instructor manages the waitlist.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard', { replace: true })}
            className="w-full rounded-lg bg-amber-700 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500"
          >
            Back to dashboard
          </button>
        </div>
      )}

      {phase === 'info_join_state' && joinStateKind && (
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-600 dark:bg-slate-800/80">
          <div className="flex items-start gap-3">
            <Info className="h-8 w-8 shrink-0 text-slate-600 dark:text-slate-300" aria-hidden />
            <div>
              <div className="font-semibold text-slate-900 dark:text-slate-100">{headlineForJoinState(joinStateKind)}</div>
              <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard', { replace: true })}
            className="w-full rounded-lg bg-slate-800 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-900 dark:bg-slate-600 dark:hover:bg-slate-500"
          >
            Back to dashboard
          </button>
        </div>
      )}

      {phase === 'error' && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/30">
          <XCircle className="h-8 w-8 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
          <div>
            <div className="font-semibold text-red-900 dark:text-red-100">Could not join</div>
            <p className="mt-1 text-sm text-red-800 dark:text-red-200">{message}</p>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="mt-4 text-sm font-medium text-blue-700 underline dark:text-blue-400"
            >
              Back to dashboard
            </button>
          </div>
        </div>
      )}

      {showManualForm && (
        <form
          onSubmit={onSubmitManual}
          className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-lg shadow-slate-200/50 ring-1 ring-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-none dark:ring-white/10"
        >
          <div className="flex gap-4 p-6 sm:p-7">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/40 sm:h-12 sm:w-12 sm:rounded-2xl"
              aria-hidden
            >
              <KeyRound className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="min-w-0 flex-1 space-y-5">
              <div>
                <label htmlFor="join-course-credential" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Join code
                </label>
                <input
                  id="join-course-credential"
                  type="text"
                  name="joinCode"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  inputMode="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 font-mono text-base text-slate-900 shadow-inner shadow-slate-900/5 placeholder:font-sans placeholder:text-sm placeholder:tracking-normal placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:border-slate-600 dark:bg-slate-950/50 dark:text-slate-100 dark:placeholder:text-slate-500"
                  placeholder="e.g. F4KH9P2N"
                />
              </div>
              <button
                type="submit"
                disabled={phase === 'loading' || !manualCode.trim()}
                className="flex h-12 w-full items-center justify-center rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:pointer-events-none disabled:opacity-45 dark:shadow-indigo-900/40 dark:hover:bg-indigo-500"
              >
                {phase === 'loading' ? 'Joining…' : 'Join course'}
              </button>
            </div>
          </div>
        </form>
      )}
      </div>
    </div>
  );
};

export default JoinCoursePage;
