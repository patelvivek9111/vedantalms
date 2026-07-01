import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getMemoryAuthToken, authFetchInit } from '../utils/authToken';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Loader2, CheckCircle2, XCircle, Clock, ListOrdered, Info, KeyRound } from 'lucide-react';
import { API_URL } from '../config';
import { useCourse } from '../contexts/CourseContext';
import { parseJoinCredential } from '../utils/joinCourseToken';
import { MobileAppShell } from '../components/common/MobileAppShell';
import SwipeableContainer from '../components/common/SwipeableContainer';
import { useBottomNavSwipe } from '../hooks/useBottomNavSwipe';

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

const SECTION_LABEL =
  'mb-1 block text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400';
const ITEM_CARD =
  'overflow-hidden rounded-lg border border-gray-200/90 bg-white dark:border-gray-700 dark:bg-gray-800';
const CONTROL =
  'compact-control h-10 w-full rounded-lg border border-gray-200 bg-white px-3 font-mono text-[11px] uppercase tracking-wide text-gray-900 transition-colors dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 sm:text-xs';
const CONTROL_FOCUS =
  'focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:border-blue-500 dark:focus:ring-blue-900/40';
const BTN_PRIMARY =
  'inline-flex h-10 w-full items-center justify-center rounded-lg bg-blue-600 text-[11px] font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600 sm:text-xs';
const BTN_SECONDARY =
  'inline-flex h-10 w-full items-center justify-center rounded-lg border border-gray-200 bg-white text-[11px] font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 sm:text-xs';

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
  const { handleSwipeLeft, handleSwipeRight, enabled: swipeEnabled } = useBottomNavSwipe();
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
        const auth = getMemoryAuthToken();
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

  const content = (
    <div className="mx-auto w-full max-w-md space-y-3">
      <div>
        <p className={SECTION_LABEL}>Enrollment</p>
        <h1 className="hidden text-2xl font-bold text-gray-900 dark:text-gray-100 lg:block">Join a course</h1>
        <p className="text-[10px] leading-relaxed text-gray-500 dark:text-gray-400 sm:text-[11px] lg:mt-2 lg:text-sm lg:text-gray-600">
          Enter the <span className="font-medium text-gray-700 dark:text-gray-300">8-character join code</span> your
          instructor shared (often next to a QR on the course materials). Scanning the QR may open this page for you
          automatically. When seats are open, your instructor approves new students before enrollment is final. If the
          course is full, you&apos;ll be placed on the waitlist—same as joining from the catalog.
        </p>
      </div>

      {phase === 'loading' && (
        <div className={`${ITEM_CARD} flex items-center gap-2.5 px-3 py-3`}>
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-blue-600 dark:text-blue-400" aria-hidden />
          <span className="text-[11px] font-medium text-gray-900 dark:text-gray-100 sm:text-xs">Joining course…</span>
        </div>
      )}

      {phase === 'done_enrolled' && (
        <div className="rounded-lg border border-emerald-200/90 bg-emerald-50/80 px-3 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <div>
              <div className="text-[11px] font-semibold text-emerald-900 dark:text-emerald-100 sm:text-xs">
                You&apos;re enrolled
              </div>
              <p className="mt-0.5 text-[10px] leading-relaxed text-emerald-800 dark:text-emerald-200 sm:text-[11px]">
                {message}
              </p>
              <p className="mt-1 text-[10px] text-emerald-700 dark:text-emerald-300">Redirecting…</p>
            </div>
          </div>
        </div>
      )}

      {phase === 'done_awaiting' && (
        <div className="space-y-2 rounded-lg border border-blue-200/90 bg-blue-50/80 px-3 py-3 dark:border-blue-900/50 dark:bg-blue-950/30">
          <div className="flex items-start gap-2.5">
            <Clock className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden />
            <div>
              <div className="text-[11px] font-semibold text-blue-950 dark:text-blue-100 sm:text-xs">
                Request received
              </div>
              <p className="mt-0.5 text-[11px] font-medium text-blue-900 dark:text-blue-50">{courseTitle}</p>
              <p className="mt-1 text-[10px] leading-relaxed text-blue-900/90 dark:text-blue-100/90 sm:text-[11px]">
                {message || 'Please wait for your instructor to approve your enrollment. You are not enrolled yet.'}
              </p>
            </div>
          </div>
          <button type="button" onClick={() => navigate('/dashboard', { replace: true })} className={BTN_PRIMARY}>
            Back to dashboard
          </button>
        </div>
      )}

      {phase === 'done_waitlist' && (
        <div className="space-y-2 rounded-lg border border-amber-200/90 bg-amber-50/80 px-3 py-3 dark:border-amber-900/50 dark:bg-amber-950/25">
          <div className="flex items-start gap-2.5">
            <ListOrdered className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
            <div>
              <div className="text-[11px] font-semibold text-amber-950 dark:text-amber-100 sm:text-xs">
                On the waitlist
              </div>
              <p className="mt-0.5 text-[11px] font-medium text-amber-900 dark:text-amber-50">{courseTitle}</p>
              {waitlistPosition != null && (
                <p className="mt-0.5 text-[10px] font-medium text-amber-900 dark:text-amber-200 sm:text-[11px]">
                  Position {waitlistPosition}
                </p>
              )}
              <p className="mt-1 text-[10px] leading-relaxed text-amber-900/90 dark:text-amber-100/90 sm:text-[11px]">
                {message || 'The course is full. Please wait while your instructor manages the waitlist.'}
              </p>
            </div>
          </div>
          <button type="button" onClick={() => navigate('/dashboard', { replace: true })} className={BTN_PRIMARY}>
            Back to dashboard
          </button>
        </div>
      )}

      {phase === 'info_join_state' && joinStateKind && (
        <div className={`${ITEM_CARD} space-y-2 px-3 py-3`}>
          <div className="flex items-start gap-2.5">
            <Info className="h-5 w-5 shrink-0 text-gray-500 dark:text-gray-400" aria-hidden />
            <div>
              <div className="text-[11px] font-semibold text-gray-900 dark:text-gray-100 sm:text-xs">
                {headlineForJoinState(joinStateKind)}
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-gray-600 dark:text-gray-400 sm:text-[11px]">
                {message}
              </p>
            </div>
          </div>
          <button type="button" onClick={() => navigate('/dashboard', { replace: true })} className={BTN_SECONDARY}>
            Back to dashboard
          </button>
        </div>
      )}

      {phase === 'error' && (
        <div className="rounded-lg border border-red-200/90 bg-red-50/80 px-3 py-3 dark:border-red-900/50 dark:bg-red-950/30">
          <div className="flex items-start gap-2.5">
            <XCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
            <div>
              <div className="text-[11px] font-semibold text-red-900 dark:text-red-100 sm:text-xs">Could not join</div>
              <p className="mt-0.5 text-[10px] leading-relaxed text-red-800 dark:text-red-200 sm:text-[11px]">
                {message}
              </p>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="mt-2 text-[10px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 sm:text-[11px]"
              >
                Back to dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {showManualForm && (
        <form onSubmit={onSubmitManual} className={`${ITEM_CARD} px-3 py-3`}>
          <div className="flex gap-2.5">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/40"
              aria-hidden
            >
              <KeyRound className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <label
                  htmlFor="join-course-credential"
                  className="text-[11px] font-semibold text-gray-900 dark:text-gray-100 sm:text-xs"
                >
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
                  className={`${CONTROL} ${CONTROL_FOCUS} mt-1.5 placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-[10px] placeholder:text-gray-400 dark:placeholder:text-gray-500`}
                  placeholder="e.g. F4KH9P2N"
                />
              </div>
              <button type="submit" disabled={phase === 'loading' || !manualCode.trim()} className={BTN_PRIMARY}>
                {phase === 'loading' ? 'Joining…' : 'Join course'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );

  return (
    <SwipeableContainer
      onSwipeLeft={swipeEnabled ? handleSwipeLeft : undefined}
      onSwipeRight={swipeEnabled ? handleSwipeRight : undefined}
      enabled={swipeEnabled}
      preventScrollInterference={true}
      className="min-h-screen bg-gray-50 dark:bg-gray-900"
    >
      <MobileAppShell title="Join Course" backButtonPath="/dashboard" backButtonLabel="Back to dashboard">
        <div className="px-4 py-3 lg:p-6">{content}</div>
      </MobileAppShell>
    </SwipeableContainer>
  );
};

export default JoinCoursePage;
