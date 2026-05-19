import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BookOpen, MessageCircle, Award, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { InteractiveEyes } from '../components/InteractiveEyes';
import FloatingLabelInput from '../components/common/FloatingLabelInput';
import FloatingLabelPasswordInput from '../components/common/FloatingLabelPasswordInput';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const emailInputRef = useRef<HTMLInputElement>(null);
  const { login, user } = useAuth();
  const logoFallbackUsed = useRef(false);
  const navigate = useNavigate();
  const primaryLogo = `${import.meta.env.BASE_URL}assets/Vedanta_logo1.png`;
  const fallbackLogo = `${import.meta.env.BASE_URL}assets/Vedanta_logo.png`;
  const [logoSrc, setLogoSrc] = useState(primaryLogo);

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    setEmail('');
    setPassword('');
    setError('');
  }, []);

  const validateEmail = (emailValue: string) => {
    if (!emailValue) {
      setEmailError('Email is required');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailValue)) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  };

  const validatePassword = (passwordValue: string) => {
    if (!passwordValue) {
      setPasswordError('Password is required');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (emailError) {
      validateEmail(e.target.value);
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (passwordError) {
      validatePassword(e.target.value);
    }
  };

  const handleEmailBlur = () => {
    validateEmail(email);
    setIsEmailFocused(false);
  };

  const handlePasswordBlur = () => {
    validatePassword(password);
    setIsPasswordFocused(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isPasswordValid) {
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const axiosMsg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(
        typeof axiosMsg === 'string' && axiosMsg.trim()
          ? axiosMsg
          : 'Failed to login. Please check your credentials.'
      );
      setIsLoading(false);
    }
  };

  const highlights = [
    {
      Icon: BookOpen,
      title: 'Structured courses',
      desc: 'Modules, pages, and media organized so learners always know what’s next.',
    },
    {
      Icon: MessageCircle,
      title: 'Course discussions',
      desc: 'Threads tied to each class—no lost links or side channels.',
    },
    {
      Icon: Award,
      title: 'Built-in grading',
      desc: 'Assignments and gradebook views for instructors and students.',
    },
  ] as const;

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-slate-50 dark:bg-slate-950">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-15%,rgba(99,102,241,0.18),transparent)] dark:bg-[radial-gradient(ellipse_85%_50%_at_50%_-20%,rgba(129,140,248,0.22),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(148,163,184,0.06)_50%,rgba(148,163,184,0.12)_100%)] dark:bg-[linear-gradient(180deg,transparent_40%,rgba(15,23,42,0.85)_100%)]"
        aria-hidden
      />

      <div
        className="pointer-events-none absolute -left-32 top-1/4 h-72 w-72 rounded-full bg-indigo-400/10 blur-3xl dark:bg-indigo-500/[0.07] lg:left-0"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-32 bottom-1/4 h-80 w-80 rounded-full bg-violet-400/10 blur-3xl dark:bg-violet-500/[0.06] lg:right-0"
        aria-hidden
      />

      <div className="relative flex min-h-[100dvh] items-center justify-center px-4 py-4 sm:px-6 sm:py-6 [@media(max-height:700px)]:items-start [@media(max-height:700px)]:py-3">
        <div className="flex w-full max-w-6xl flex-col items-stretch justify-center gap-8 lg:flex-row lg:items-center lg:gap-10 xl:gap-14">
          {/* Left column — desktop only */}
          <aside className="order-2 hidden min-w-0 flex-1 flex-col justify-center text-left lg:order-1 lg:flex lg:pr-4 xl:pr-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-500">
              Learning platform
            </p>
            <h2 className="mt-4 max-w-sm text-balance text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 xl:text-[1.65rem] xl:leading-snug">
              Everything your cohort needs, without the noise.
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Courses, discussions, and grades live together so people spend less time hunting tabs and more time on
              the work that matters.
            </p>

            <ul className="mt-10 max-w-sm space-y-5">
              {highlights.map(({ Icon, title, desc }) => (
                <li key={title} className="flex gap-3.5">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>

            <Link
              to="/catalog"
              className="group mt-10 inline-flex items-center gap-2 text-sm font-medium text-slate-800 transition hover:text-slate-950 dark:text-slate-200 dark:hover:text-white"
            >
              <span className="border-b border-slate-300 transition group-hover:border-slate-800 dark:border-slate-600 dark:group-hover:border-slate-200">
                View course catalog
              </span>
              <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200" aria-hidden />
            </Link>
          </aside>

          {/* Center — login card */}
          <div className="order-1 w-full shrink-0 lg:order-2 lg:w-[min(100%,400px)]">
            <div className="rounded-2xl border border-slate-200/90 bg-white/85 p-5 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/75 dark:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.55)] sm:p-6">
            <div className="flex flex-col items-center text-center">
              {/* Logo + eyes: no vertical gap under the image (avoids “dead” space + scroll) */}
              <div className="flex w-full flex-col items-center gap-0">
                <div className="w-full px-1 leading-none">
                  <img
                    src={logoSrc}
                    alt="Vedanta"
                    width={640}
                    height={240}
                    className="mx-auto block h-40 w-auto max-h-[min(46dvh,380px)] max-w-full object-contain object-center sm:h-44 md:h-52 md:max-h-[min(50dvh,440px)]"
                    decoding="async"
                    onError={() => {
                      if (logoFallbackUsed.current) return;
                      logoFallbackUsed.current = true;
                      setLogoSrc(fallbackLogo);
                    }}
                  />
                </div>
                <div className="-mt-1 flex w-full justify-center sm:-mt-1.5">
                  <div className="origin-center scale-[0.72] opacity-[0.95] sm:scale-[0.76]">
                    <InteractiveEyes
                      isPasswordFocused={isPasswordFocused}
                      isUsernameFocused={isEmailFocused}
                      usernameValue={email}
                      passwordValue={password}
                      hasError={!!error}
                      isLoading={isLoading}
                    />
                  </div>
                </div>
              </div>

              <div
                className="mb-2 mt-1 h-px w-full max-w-[160px] bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-slate-600/80"
                aria-hidden
              />

              <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-xl">
                Sign in
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Welcome back.{' '}
                <span className="text-slate-500 dark:text-slate-500">New here?</span>{' '}
                <Link
                  to="/signup"
                  className="font-semibold text-indigo-600 underline-offset-2 transition hover:text-indigo-700 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  Create an account
                </Link>
              </p>
            </div>

            <form className="mt-4 space-y-3 sm:mt-5" onSubmit={handleSubmit}>
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-200/90 bg-rose-50/90 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/35 dark:text-rose-100"
                >
                  {error}
                </div>
              )}
              <div className="space-y-3">
                <FloatingLabelInput
                  ref={emailInputRef}
                  id="email-address"
                  name="email"
                  type="email"
                  label="Email address"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={handleEmailChange}
                  onFocus={() => {
                    setIsEmailFocused(true);
                    setIsPasswordFocused(false);
                  }}
                  onBlur={handleEmailBlur}
                  error={emailError}
                  enterKeyHint="next"
                />
                <FloatingLabelPasswordInput
                  id="password"
                  name="password"
                  label="Password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={handlePasswordChange}
                  onFocus={() => {
                    setIsPasswordFocused(true);
                    setIsEmailFocused(false);
                  }}
                  onBlur={handlePasswordBlur}
                  error={passwordError}
                  enterKeyHint="done"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="mt-1 w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-55 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-400 dark:focus-visible:outline-offset-slate-900 sm:py-3"
              >
                {isLoading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
            </div>
          </div>

          {/* Right column — desktop only */}
          <aside className="order-3 hidden min-w-0 flex-1 flex-col justify-center text-left lg:flex lg:pl-4 xl:pl-8">
            <figure className="max-w-sm border-l-2 border-slate-200 pl-5 dark:border-slate-600">
              <blockquote className="text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
                Sign in once to reach your dashboard, enrolled courses, and calendar. Fewer handoffs, clearer next steps
                for both instructors and students.
              </blockquote>
              <figcaption className="mt-5 text-xs leading-relaxed text-slate-500 dark:text-slate-500">
                Prefer the email your school or instructor used when you were added—your roster updates automatically
                after you access your account.
              </figcaption>
            </figure>
          </aside>
        </div>
      </div>
    </div>
  );
}
