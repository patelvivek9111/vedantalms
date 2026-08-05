import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  User, 
  Gauge, 
  BookOpen, 
  Calendar, 
  Inbox, 
  Users, 
  LogOut,
  Settings,
  Shield,
  Database,
  Search,
  FileText
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCourse } from '../../contexts/CourseContext';
import { useOptionalTenant } from '../../contexts/TenantContext';
import { useUnreadMessages } from '../../hooks/useUnreadMessages';
import { getImageUrl } from '../../services/api';
import { NavCountBadge } from '../common/NavCountBadge';
import { performLogout } from '../../utils/authLogout';

const getNavItems = (userRole: string) => {
  // Platform boss — tenants only, not school LMS / registrar
  if (userRole === 'platform_admin') {
    return [
      { label: 'Account', icon: User, to: '/account' },
      { label: 'Institutions', icon: Database, to: '/admin/institutions' },
    ];
  }

  const baseItems = [
    { label: 'Account', icon: User, to: '/account' },
    { label: 'Dashboard', icon: Gauge, to: '/dashboard' },
    { label: 'Courses', icon: BookOpen, to: '/courses' },
    { label: 'Calendar', icon: Calendar, to: '/calendar' },
    { label: 'Inbox', icon: Inbox, to: '/inbox' },
  ];

  // Registrar office — distinct from teaching LMS shell
  if (userRole === 'registrar' || userRole === 'department_admin') {
    return [
      { label: 'Account', icon: User, to: '/account' },
      { label: 'Registrar', icon: FileText, to: '/registrar' },
      { label: 'Inbox', icon: Inbox, to: '/inbox' },
    ];
  }

  // Add admin-specific items
  if (userRole === 'admin') {
    return [
      ...baseItems,
      { label: 'Users', icon: Users, to: '/admin/users' },
      { label: 'Registrar', icon: FileText, to: '/registrar' },
      { label: 'Settings', icon: Settings, to: '/admin/settings' },
      { label: 'Security', icon: Shield, to: '/admin/security' },
    ];
  }

  // Add teacher-specific items
  if (userRole === 'teacher') {
    return [
      ...baseItems,
      { label: 'Groups', icon: Users, to: '/groups' },
      { label: 'Catalog', icon: Search, to: '/catalog' },
    ];
  }

  // Add Groups, Catalog, and Reports for students
  const studentItems = userRole === 'student' 
    ? [{ label: 'Report', icon: FileText, to: '/reports/transcript' }]
    : [];
  return [...baseItems, { label: 'Groups', icon: Users, to: '/groups' }, { label: 'Catalog', icon: Search, to: '/catalog' }, ...studentItems];
};

/** Shared nav tile + active rail for bottom dock selection state */
const sidebarNavBase =
  'flex flex-col items-center justify-center min-w-[4rem] px-3 py-2 rounded-xl relative transition-[color,background-color,box-shadow,transform] duration-200 ease-out group outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-900 dark:focus-visible:ring-offset-gray-900';

const sidebarNavInactive =
  'text-blue-100/85 dark:text-gray-400 hover:bg-white/[0.08] dark:hover:bg-white/[0.06] hover:text-white dark:hover:text-gray-100';

const sidebarNavActive =
  'text-white dark:text-gray-50 bg-white/[0.12] dark:bg-white/[0.08] ring-1 ring-inset ring-white/15 dark:ring-white/10 shadow-sm';

/** How close the cursor must get to the viewport bottom before a tucked dock slides back up. */
const DOCK_REVEAL_ZONE_PX = 56;

/** Sliver of the dock left on screen while tucked, so it stays discoverable. */
const DOCK_PEEK_PX = 8;

function SidebarActiveRail({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span
      className="pointer-events-none absolute left-2 right-2 bottom-0.5 h-[3px] rounded-full bg-gradient-to-r from-sky-200 to-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.45)] dark:from-sky-300 dark:to-sky-500 dark:shadow-[0_0_12px_rgba(56,189,248,0.35)]"
      aria-hidden
    />
  );
}

export default function GlobalSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { courses } = useCourse();
  const tenant = useOptionalTenant()?.tenant;
  const { unreadCount } = useUnreadMessages();
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [courseDropdownPos, setCourseDropdownPos] = useState({ top: 0, left: 0 });
  const [pointerNearBottom, setPointerNearBottom] = useState(false);
  const [pointerOnDock, setPointerOnDock] = useState(false);
  const [dockFocused, setDockFocused] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const coursesButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownPanelRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateCourseDropdownPos = useCallback(() => {
    const button = coursesButtonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const panelWidth = 192; // min-w-48
    const left = Math.min(
      Math.max(8, rect.left + rect.width / 2 - panelWidth / 2),
      window.innerWidth - panelWidth - 8
    );
    setCourseDropdownPos({ top: rect.top - 8, left });
  }, []);

  const prefersFinePointer =
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /** Dashboard keeps the dock pinned; elsewhere it tucks away until the pointer nears it. */
  const isDashboardHome =
    location.pathname === '/dashboard' || location.pathname === '/';
  const dockRevealed =
    isDashboardHome || pointerNearBottom || pointerOnDock || dockFocused || showCourseDropdown;

  useEffect(() => {
    if (isDashboardHome) {
      setPointerNearBottom(false);
      return undefined;
    }
    const handlePointerMove = (event: MouseEvent) => {
      const nearBottom = event.clientY >= window.innerHeight - DOCK_REVEAL_ZONE_PX;
      setPointerNearBottom((prev) => (prev === nearBottom ? prev : nearBottom));
    };
    window.addEventListener('mousemove', handlePointerMove);
    return () => window.removeEventListener('mousemove', handlePointerMove);
  }, [isDashboardHome]);

  // Leaving a page while the dock is peeking would otherwise strand it open.
  useEffect(() => {
    setPointerOnDock(false);
    setDockFocused(false);
  }, [location.pathname]);

  // Close dropdown when clicking/tapping outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      const insideTrigger = dropdownRef.current?.contains(target);
      const insidePanel = dropdownPanelRef.current?.contains(target);
      if (!insideTrigger && !insidePanel) {
        setShowCourseDropdown(false);
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
          hideTimeoutRef.current = null;
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!showCourseDropdown) return undefined;
    updateCourseDropdownPos();
    window.addEventListener('resize', updateCourseDropdownPos);
    window.addEventListener('scroll', updateCourseDropdownPos, true);
    return () => {
      window.removeEventListener('resize', updateCourseDropdownPos);
      window.removeEventListener('scroll', updateCourseDropdownPos, true);
    };
  }, [showCourseDropdown, updateCourseDropdownPos]);

  // Handle mouse enter - show dropdown and clear any pending hide
  const handleMouseEnter = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    updateCourseDropdownPos();
    setShowCourseDropdown(true);
  };

  // Handle mouse leave - delay hiding to allow time to move to dropdown
  const handleMouseLeave = () => {
    hideTimeoutRef.current = setTimeout(() => {
      setShowCourseDropdown(false);
      hideTimeoutRef.current = null;
    }, 300); // 300ms delay before hiding
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await performLogout(logout, navigate);
    } catch {
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  const availableCourses = courses.filter((course) => course.published);

  const defaultLogoSrc = `${import.meta.env.BASE_URL}assets/Vedanta_logo.png`;
  const brandLogoSrc = tenant?.brand?.logoUrl
    ? getImageUrl(tenant.brand.logoUrl)
    : defaultLogoSrc;

  const courseDropdownPanel =
    showCourseDropdown ? (
      <div
        ref={dropdownPanelRef}
        className="fixed z-[100] w-auto min-w-48 -translate-y-full rounded-lg border border-gray-200 bg-white py-2 shadow-lg dark:border-gray-700 dark:bg-gray-800"
        style={{ top: courseDropdownPos.top, left: courseDropdownPos.left }}
        onMouseEnter={prefersFinePointer ? handleMouseEnter : undefined}
        onMouseLeave={prefersFinePointer ? handleMouseLeave : undefined}
      >
        {(!user || user.role !== 'teacher') && (
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Your Courses</span>
          </div>
        )}
        {availableCourses.length > 0 ? availableCourses.map((course) => {
          const isCurrentCourse = location.pathname.startsWith(`/courses/${course._id}`);
          const courseCode = course.catalog?.courseCode || course.title;
          return (
            <Link
              key={course._id}
              to={`/courses/${course._id}`}
              onClick={() => {
                setShowCourseDropdown(false);
              }}
              className={`flex min-h-[44px] items-center px-3 py-2 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${
                isCurrentCourse ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'
              }`}
              title={course.title}
            >
              <div className="flex items-center justify-between">
                <span className="truncate">{courseCode}</span>
                {isCurrentCourse && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full ml-2"></div>
                )}
              </div>
            </Link>
          );
        }) : user?.role === 'teacher' ? null : (
          <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No courses available</div>
        )}
        {user?.role === 'teacher' && (
          <>
            {availableCourses.length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
            )}
            <Link
              to="/teacher/courses"
              onClick={() => {
                setShowCourseDropdown(false);
              }}
              className={`flex min-h-[44px] items-center px-3 py-2 text-sm font-medium transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${
                location.pathname === '/teacher/courses' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>My Courses</span>
                {location.pathname === '/teacher/courses' && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full ml-2"></div>
                )}
              </div>
            </Link>
          </>
        )}
      </div>
    ) : null;


  return (
    <>
      {/* Soft fade so page content doesn't read through under/around the dock */}
      <div
        className={`pointer-events-none fixed inset-x-0 bottom-0 z-[55] hidden h-32 bg-gradient-to-t from-gray-50 from-25% via-gray-50/85 to-transparent transition-opacity duration-300 print:hidden dark:from-gray-900 dark:via-gray-900/85 lg:block ${
          dockRevealed ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden
      />

      {/* Desktop global nav — centered bottom dock (mobile uses BottomNav) */}
      <nav 
        className="print:hidden hidden lg:flex fixed bottom-4 left-1/2 z-[60] max-w-[calc(100vw-2rem)] flex-row items-center gap-2 overflow-hidden rounded-2xl border border-blue-700 bg-blue-900 px-3 py-2 shadow-[0_12px_40px_rgba(15,23,42,0.35)] transition-transform duration-300 ease-out isolate dark:border-gray-700 dark:bg-gray-900"
        style={{
          transform: `translate(-50%, ${
            dockRevealed ? '0px' : `calc(100% + 1rem - ${DOCK_PEEK_PX}px)`
          })`,
        }}
        onMouseEnter={() => setPointerOnDock(true)}
        onMouseLeave={() => setPointerOnDock(false)}
        onFocusCapture={() => setDockFocused(true)}
        onBlurCapture={() => setDockFocused(false)}
        data-testid="global-sidebar"
        aria-label="Global navigation"
      >
      {/* Opaque paint layer — blocks scroll content behind rounded dock */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl bg-blue-900 dark:bg-gray-900"
        aria-hidden
      />
      <div className="relative z-[1] flex shrink-0 items-center justify-center px-1">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-blue-700 bg-white dark:border-gray-600 dark:bg-gray-800">
          <img
            src={brandLogoSrc}
            alt={tenant?.brand?.displayName || tenant?.name || 'MYSL8TE'}
            className="h-7 w-7 object-contain object-center"
            onError={(e) => {
              e.currentTarget.src = defaultLogoSrc;
            }}
          />
        </div>
      </div>

      <div className="relative z-[1] flex max-w-[min(80vw,60rem)] flex-row items-center gap-2 overflow-x-auto overflow-y-hidden px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {getNavItems(user?.role || '').map(({ label, icon: Icon, to }) => {
          // Highlight 'Courses' for any /courses* route (but not /teacher/courses or /admin/courses)
          const isActive =
            (label === 'Courses' && (location.pathname.startsWith('/courses') || location.pathname === '/teacher/courses') && !location.pathname.startsWith('/admin/courses')) ||
            (label === 'Registrar' && location.pathname.startsWith('/registrar')) ||
            (location.pathname === to && label !== 'Courses' && label !== 'Registrar');
          
          // Dashboard home
          if (label === 'Dashboard') {
            const dashActive =
              location.pathname === '/dashboard' || location.pathname === '/';
            return (
              <Link
                key={label}
                to="/dashboard"
                className={`${sidebarNavBase} ${dashActive ? sidebarNavActive : sidebarNavInactive}`}
              >
                <SidebarActiveRail show={dashActive} />
                <Icon className={`mb-0.5 h-5 w-5 transition-opacity duration-200 ${dashActive ? 'opacity-100' : 'opacity-90 group-hover:opacity-100'}`} />
                <span className={`text-[10px] font-medium leading-tight tracking-tight ${dashActive ? 'font-semibold' : ''}`}>
                  {label}
                </span>
              </Link>
            );
          }

          // Special handling for Account item to show profile picture
          if (label === 'Account') {
            return (
              <Link
                key={label}
                to={to}
                className={`${sidebarNavBase} ${isActive ? sidebarNavActive : sidebarNavInactive}`}
              >
                <SidebarActiveRail show={isActive} />
                <div className="relative mb-0.5 flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-blue-800/80 dark:border-gray-600 dark:bg-gray-700 transition-transform duration-200 group-hover:border-white/30">
                  {/* Fallback initials - always present as background */}
                  <span className="text-white dark:text-gray-200 text-xs font-bold absolute inset-0 flex items-center justify-center">
                    {user?.firstName?.charAt(0) || ''}{user?.lastName?.charAt(0) || 'U'}
                  </span>
                  {/* Profile picture - overlays fallback when loaded */}
                  {user?.profilePicture && (
                    <img 
                      src={user.profilePicture.startsWith('http') 
                        ? user.profilePicture 
                        : getImageUrl(user.profilePicture)} 
                      alt={`${user.firstName} ${user.lastName}`}
                      className="w-full h-full object-cover rounded-full relative z-10"
                      onError={(e) => {
                        // Hide image on error - fallback will show through
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                </div>
                <span className={`text-[10px] font-medium leading-tight tracking-tight ${isActive ? 'font-semibold' : ''}`}>
                  {label}
                </span>
              </Link>
            );
          }
          
          // Special handling for Courses with dropdown (skip hover for admins)
          if (label === 'Courses') {
            // Admins: Simple link to Course Oversight page
            if (user?.role === 'admin') {
              const isAdminCoursesActive = location.pathname === '/admin/courses';
              return (
                <Link
                  key={label}
                  to="/admin/courses"
                  className={`${sidebarNavBase} ${isAdminCoursesActive ? sidebarNavActive : sidebarNavInactive}`}
                >
                  <SidebarActiveRail show={isAdminCoursesActive} />
                  <BookOpen className={`mb-0.5 h-5 w-5 transition-opacity duration-200 ${isAdminCoursesActive ? 'opacity-100' : 'opacity-90 group-hover:opacity-100'}`} />
                  <span className={`text-[10px] font-medium leading-tight tracking-tight ${isAdminCoursesActive ? 'font-semibold' : ''}`}>
                    {label}
                  </span>
                </Link>
              );
            }
            
            // Non-admin users: Dropdown with hover
            return (
              <div 
                key={label} 
                className="relative shrink-0" 
                ref={dropdownRef}
                onMouseEnter={prefersFinePointer ? handleMouseEnter : undefined}
                onMouseLeave={prefersFinePointer ? handleMouseLeave : undefined}
              >
                <button
                  ref={coursesButtonRef}
                  type="button"
                  onClick={() => {
                    if (hideTimeoutRef.current) {
                      clearTimeout(hideTimeoutRef.current);
                      hideTimeoutRef.current = null;
                    }
                    const next = !showCourseDropdown;
                    if (next) updateCourseDropdownPos();
                    setShowCourseDropdown(next);
                  }}
                  aria-expanded={showCourseDropdown}
                  aria-haspopup="true"
                  className={`${sidebarNavBase} ${isActive ? sidebarNavActive : sidebarNavInactive}`}
                >
                  <SidebarActiveRail show={isActive} />
                  <BookOpen className={`mb-0.5 h-5 w-5 transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-90 group-hover:opacity-100'}`} />
                  <span className={`text-[10px] font-medium leading-tight tracking-tight ${isActive ? 'font-semibold' : ''}`}>
                    {label}
                  </span>
                </button>
              </div>
            );
          }
          
          // Special handling for Inbox with unread indicator
          if (label === 'Inbox') {
            return (
              <Link
                key={label}
                to={to}
                className={`${sidebarNavBase} ${isActive ? sidebarNavActive : sidebarNavInactive}`}
                aria-label={
                  unreadCount > 0 ? `${label}, ${unreadCount} unread` : label
                }
              >
                <SidebarActiveRail show={isActive} />
                <div className="relative mb-0.5 inline-flex">
                  <Icon className={`h-5 w-5 transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-90 group-hover:opacity-100'}`} />
                  <NavCountBadge count={unreadCount} variant="sidebar" />
                </div>
                <span className={`text-[10px] font-medium leading-tight tracking-tight ${isActive ? 'font-semibold' : ''}`}>
                  {label}
                </span>
              </Link>
            );
          }
          
          return (
            <Link
              key={label}
              to={to}
              className={`${sidebarNavBase} ${isActive ? sidebarNavActive : sidebarNavInactive}`}
            >
              <SidebarActiveRail show={isActive} />
              <Icon className={`mb-0.5 h-5 w-5 transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-90 group-hover:opacity-100'}`} />
              <span className={`text-[10px] font-medium leading-tight tracking-tight ${isActive ? 'font-semibold' : ''}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
      
      {/* Logout — trailing edge of dock */}
      <div className="relative z-[1] shrink-0 border-l border-white/10 pl-2 ml-1">
        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={loggingOut}
          className="group flex min-w-[4rem] flex-col items-center justify-center rounded-xl px-3 py-2 text-blue-100/85 transition-colors duration-200 hover:bg-white/[0.08] hover:text-white disabled:opacity-60 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-100"
        >
          <LogOut className="mb-0.5 h-5 w-5 opacity-90 transition-opacity group-hover:opacity-100" />
          <span className="text-[10px] font-medium leading-tight tracking-tight">
            {loggingOut ? '…' : 'Logout'}
          </span>
        </button>
      </div>
    </nav>
    {typeof document !== 'undefined' ? createPortal(courseDropdownPanel, document.body) : courseDropdownPanel}
    </>
  );
}
