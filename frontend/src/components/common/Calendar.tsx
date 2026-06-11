import React, { useEffect, useState, useRef } from 'react';
// Make sure to run: npm install react-big-calendar date-fns
import { Calendar, dateFnsLocalizer, Event as RBCEvent, SlotInfo, NavigateAction, Views } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { parse, startOfWeek, endOfWeek, getDay, format, addMonths, subMonths, getDaysInMonth, startOfMonth, endOfMonth, isSameMonth, isSameDay, addWeeks, subWeeks, startOfDay, endOfDay, eachDayOfInterval, isSameWeek, getWeek } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { useAuth } from '../../contexts/AuthContext';
import { useCourse } from '../../contexts/CourseContext';
import api, { getImageUrl } from '../../services/api';
import { ToDoPanel } from './ToDoPanel';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, ChevronDown, Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Check } from 'lucide-react';
import DatePicker from './DatePicker';
import SwipeableContainer from './SwipeableContainer';
import { MobileAppShell } from './MobileAppShell';
import { FORM_ERROR } from './formStyles';

/** Match InboxToolbar control sizing */
const CONTROL =
  'h-10 rounded-lg border border-gray-200 transition-colors dark:border-gray-700';
const CONTROL_TEXT =
  'text-[10px] font-medium text-gray-600 sm:text-[11px] dark:text-gray-300';
const CONTROL_FOCUS =
  'focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:border-blue-500 dark:focus:ring-blue-900/40';
const ICON_BTN =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 active:bg-gray-100 touch-manipulation dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700/80';
const FORM_LABEL =
  'mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400';
const FIELD_CLASS = `compact-control ${CONTROL} ${CONTROL_TEXT} ${CONTROL_FOCUS} w-full bg-white px-3 text-gray-900 placeholder:font-normal placeholder:text-gray-400 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500`;
const SELECT_CLASS = `${FIELD_CLASS} appearance-none pr-9`;
import { useBottomNavSwipe } from '../../hooks/useBottomNavSwipe';
import { useSwipeGesture } from '../../hooks/useSwipeGesture';
import { hapticNavigation } from '../../utils/hapticFeedback';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
});

type Event = {
  _id?: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  type: string;
  color?: string;
  location?: string;
  calendar?: string;
};

const defaultEvent: Event = {
  title: '',
  description: '',
  start: new Date(),
  end: new Date(),
  type: 'Event',
  color: '',
  location: '',
  calendar: '',
};

const eventTypes = [
  { label: 'Event', value: 'Event' },
  { label: 'My To Do', value: 'My To Do' },
  { label: 'Appointment Group', value: 'Appointment Group' },
];

// --- TIMEZONE BEST PRACTICE ---
// All dates/times are stored in UTC in the backend (MongoDB).
// Always display and input times in the user's local time zone in the frontend.
// This ensures correct behavior for all users, regardless of location or DST.
// --------------------------------

// Utility function to format a Date as 'HH:mm' in the user's local time zone
function formatLocalTime(date: Date) {
  return date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0');
}

// Utility function to format a Date as 'yyyy-MM-dd' in the user's local time zone
function formatLocalDate(date: Date) {
  return date.getFullYear() + '-' + (date.getMonth() + 1).toString().padStart(2, '0') + '-' + date.getDate().toString().padStart(2, '0');
}

// Helper to detect overlap (for a given event, check if any other event overlaps in time)
function hasOverlap(event: RBCEvent, allEvents: RBCEvent[]) {
  // Ensure event.start and event.end are valid Date objects
  let eventStart: Date | null = null;
  let eventEnd: Date | null = null;
  if (event.start) {
    eventStart = event.start instanceof Date ? event.start : new Date(event.start);
    if (isNaN(eventStart.getTime())) eventStart = null;
  }
  if (event.end) {
    eventEnd = event.end instanceof Date ? event.end : new Date(event.end);
    if (isNaN(eventEnd.getTime())) eventEnd = null;
  }
  if (!eventStart || !eventEnd) return false;
  return allEvents.some(e => {
    if (e === event) return false;
    let eStart: Date | null = null;
    let eEnd: Date | null = null;
    if (e.start) {
      eStart = e.start instanceof Date ? e.start : new Date(e.start);
      if (isNaN(eStart.getTime())) eStart = null;
    }
    if (e.end) {
      eEnd = e.end instanceof Date ? e.end : new Date(e.end);
      if (isNaN(eEnd.getTime())) eEnd = null;
    }
    if (!eStart || !eEnd) return false;
    // TypeScript now knows eventStart and eventEnd are not null
    const start = eventStart as Date;
    const end = eventEnd as Date;
    return (
      (start.getTime() < eEnd.getTime() && end.getTime() > eStart.getTime()) ||
      (eStart.getTime() < end.getTime() && eEnd.getTime() > start.getTime())
    );
  });
}

// Custom Event component for day/week view
const CustomEvent: React.FC<{ event: RBCEvent }> = ({ event }) => {
  const navigate = useNavigate();
  const { title } = event;
  const color = (event as any).color || (event.resource && event.resource.color) || '#93c5fd';
  let start: Date | null = null;
  let end: Date | null = null;
  if (event.start) {
    start = event.start instanceof Date ? event.start : new Date(event.start);
    if (isNaN(start.getTime())) start = null;
  }
  if (event.end) {
    end = event.end instanceof Date ? event.end : new Date(event.end);
    if (isNaN(end.getTime())) end = null;
  }
  // Access all events from context or prop (here, using window for demo)
  const allEvents = (window as any).allCalendarEvents || [];
  // Find all events that overlap with this one (including itself)
  const overlappingEvents = allEvents.filter((e: RBCEvent) => {
    let eStart: Date | null = null;
    let eEnd: Date | null = null;
    if (e.start) {
      eStart = e.start instanceof Date ? e.start : new Date(e.start);
      if (isNaN(eStart.getTime())) eStart = null;
    }
    if (e.end) {
      eEnd = e.end instanceof Date ? e.end : new Date(e.end);
      if (isNaN(eEnd.getTime())) eEnd = null;
    }
    if (!eStart || !eEnd || !start || !end) return false;
    // TypeScript now knows all are not null
    const sStart = start as Date;
    const sEnd = end as Date;
    // Same day, and overlap
    return (
      eStart.toDateString() === sStart.toDateString() &&
      ((sStart.getTime() < eEnd.getTime() && sEnd.getTime() > eStart.getTime()) ||
        (eStart.getTime() < sEnd.getTime() && eEnd.getTime() > sStart.getTime()))
    );
  });
  // Sort by start time
  overlappingEvents.sort((a: RBCEvent, b: RBCEvent) => {
    let aStart: Date = new Date(0);
    let bStart: Date = new Date(0);
    if (a.start) {
      aStart = a.start instanceof Date ? a.start : new Date(a.start);
      if (isNaN(aStart.getTime())) aStart = new Date(0);
    }
    if (b.start) {
      bStart = b.start instanceof Date ? b.start : new Date(b.start);
      if (isNaN(bStart.getTime())) bStart = new Date(0);
    }
    return aStart.getTime() - bStart.getTime();
  });
  // Is this the second overlapping event?
  const isSecondOverlap = overlappingEvents.length > 1 && overlappingEvents[1] === event;
  // Assignment icon
  const isAssignment = event.resource?.type === 'Assignment';
  let tooltip = title;
  if (start && end) {
    if (isAssignment && start.getTime() === end.getTime()) {
      tooltip += `\nDue: ${format(start, 'h:mm a')}`;
    } else if (start.getTime() === end.getTime()) {
      tooltip += `\n${format(start, 'h:mm a')}`;
    } else if (event.allDay) {
      tooltip += `\nAll Day`;
    } else {
      tooltip += `\n${format(start, 'h:mm a')} – ${format(end, 'h:mm a')}`;
    }
  }
  // Determine text color based on background brightness
  const getTextColor = (bgColor: string) => {
    // Convert hex to RGB
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    // Calculate brightness
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    // Return dark text for light backgrounds, light text for dark backgrounds
    return { color: brightness > 128 ? '#1f2937' : '#f9fafb', brightness };
  };

  const { color: textColor, brightness } = getTextColor(color);

  return (
    <div
      className={`relative px-1 py-0.5 rounded h-full flex flex-col justify-center shadow-sm transition-all duration-150 ${overlappingEvents.length > 1 ? 'border-l-4 border-pink-400 shadow' : 'border-l-4 border-transparent'} hover:ring-2 hover:ring-blue-400 ${isAssignment ? 'font-bold border-l-4 border-yellow-400' : ''}`}
      style={{ background: color, color: textColor, minHeight: 28, fontSize: 13, cursor: 'pointer' }}
      title={String(tooltip)}
    >
      <div className="flex items-center gap-1">
        {isAssignment && <FileText className="w-3 h-3 mr-1" style={{ color: textColor }} />}
        <span className="font-semibold truncate" style={{ maxWidth: 80, color: textColor }}>{title}</span>
      </div>
      {start && end && (
        isAssignment && start.getTime() === end.getTime() ? (
          <span className="text-xs" style={{ color: textColor, opacity: 0.9 }}>Due: {format(start, 'h:mm a')}</span>
        ) : start.getTime() === end.getTime() ? (
          <span className="text-xs" style={{ color: textColor, opacity: 0.9 }}>{format(start, 'h:mm a')}</span>
        ) : (event.allDay ? (
          <span className="text-xs" style={{ color: textColor, opacity: 0.9 }}>All Day</span>
        ) : (
          <span className="text-xs" style={{ color: textColor, opacity: 0.9 }}>{format(start, 'h:mm a')} – {format(end, 'h:mm a')}</span>
        ))
      )}
      {/* Show +N more only on the second overlapping event in the cell (month view only) */}
      {isSecondOverlap && (
        <span className="absolute bottom-0 right-1 text-xs bg-white dark:bg-gray-800 bg-opacity-90 dark:bg-opacity-90 rounded px-1" style={{ color: brightness > 128 ? '#1e40af' : '#60a5fa' }}>+{overlappingEvents.length - 1} more</span>
      )}
    </div>
  );
};

// Professional calendar palette (Google Calendar–inspired)
const colorPalette = [
  '#7986CB', '#33B679', '#8E24AA', '#E67C73', '#F6BF26',
  '#F4511E', '#039BE5', '#3F51B5', '#0B8043', '#D50000',
  '#616161', '#AD1457', '#009688', '#5C6BC0', '#7CB342',
  '#FF7043', '#26A69A', '#AB47BC', '#42A5F5', '#78909C',
];

const CalendarColorPicker: React.FC<{
  colors: string[];
  selectedColor?: string;
  onSelect: (color: string) => void;
  onClose: () => void;
}> = ({ colors, selectedColor, onSelect, onClose }) => {
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      ref={pickerRef}
      className="w-full max-w-[240px] rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      role="dialog"
      aria-label="Choose calendar color"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Calendar color
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="Close color picker"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-5 gap-2.5">
        {colors.map((color) => {
          const isSelected = selectedColor?.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              onClick={() => onSelect(color)}
              className={`relative h-8 w-8 rounded-full transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
                isSelected ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900' : 'ring-1 ring-black/10 dark:ring-white/15'
              }`}
              style={{ backgroundColor: color }}
              aria-label={`Select color ${color}`}
              aria-pressed={isSelected}
            >
              {isSelected && (
                <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]" strokeWidth={3} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

type CalendarOption = { label: string; value: string };

const CalendarFilterRow: React.FC<{
  opt: CalendarOption;
  checked: boolean;
  color: string;
  inputId: string;
  colorPickerActive?: boolean;
  onToggle: () => void;
  onColorClick: (e: React.MouseEvent) => void;
}> = ({
  opt,
  checked,
  color,
  inputId,
  colorPickerActive,
  onToggle,
  onColorClick,
}) => (
  <div className="flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30">
    <input
      type="checkbox"
      id={inputId}
      name={inputId}
      checked={checked}
      onChange={onToggle}
      className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-gray-300 accent-blue-600 touch-manipulation"
    />
    <button
      type="button"
      className={`icon-only flex h-7 w-7 shrink-0 items-center justify-center rounded-full p-0 transition-transform hover:scale-105 touch-manipulation ${
        colorPickerActive ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-800' : ''
      }`}
      onClick={onColorClick}
      aria-label={`Pick color for ${opt.label}`}
      title="Change calendar color"
    >
      <span
        className="h-3 w-3 rounded-full ring-1 ring-black/10 dark:ring-white/15"
        style={{ backgroundColor: color }}
      />
    </button>
    <label
      htmlFor={inputId}
      className="min-w-0 flex-1 cursor-pointer text-sm font-medium leading-snug text-slate-800 dark:text-slate-100"
    >
      <span className="line-clamp-2">{opt.label}</span>
    </label>
  </div>
);

const CalendarPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { courses } = useCourse();
  const [events, setEvents] = useState<RBCEvent[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('Event');
  const [selectedCalendars, setSelectedCalendars] = useState<string[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const prevEventId = useRef<string | undefined>();
  const [miniSelectedDate, setMiniSelectedDate] = useState(new Date());
  // Store calendar colors in state (by calendar id)
  // Only stores custom colors set by user - default colors come from palette based on calendarOptions index
  const [calendarColors, setCalendarColors] = useState<Record<string, string>>({});
  // For color wheel popover
  const [colorWheelOpen, setColorWheelOpen] = useState<string | null>(null); // calendarId or null
  const navigate = useNavigate();
  // Swipe navigation for bottom nav
  const { handleSwipeLeft, handleSwipeRight, enabled: swipeEnabled } = useBottomNavSwipe();
  const [mobileViewMode, setMobileViewMode] = useState<'week' | 'month'>('month');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCalendarsModal, setShowCalendarsModal] = useState(false);

  // Swipe to dismiss calendars modal
  const handleDismissModal = () => {
    hapticNavigation();
    setShowCalendarsModal(false);
  };

  const calendarModalSwipe = useSwipeGesture({
    onSwipeDown: handleDismissModal,
    threshold: 80,
    velocityThreshold: 0.4,
    preventDefault: false,
    enabled: showCalendarsModal
  });

  // Only show for teachers/admins
  const isTeacherOrAdmin = user && (user.role === 'teacher' || user.role === 'admin');

  // Build calendar options: admin only gets personal calendar, teachers get personal + courses
  // For teachers/admins: show all their courses (published and unpublished) - same as dashboard
  // For students: only show published courses they're enrolled in

  const calendarOptions = user ? [
    { label: `${user.firstName} ${user.lastName}`, value: user._id },
    ...(user.role === 'admin' 
      ? [] 
      : (user.role === 'student' 
        ? courses.filter((course: any) => course.published).map((course: any) => ({ label: course.title, value: course._id, course }))
        : courses.map((course: any) => ({ label: course.title, value: course._id, course }))
      )
    )
  ] : [];

  // Update: Multi-calendar selection logic
  const handleCalendarToggle = (calendarId: string) => {
    setSelectedCalendars(prev =>
      prev.includes(calendarId)
        ? prev.filter(id => id !== calendarId)
        : [...prev, calendarId]
    );
  };

  // Helper to get a calendar's color - always use stored color or fallback to palette
  const getCalendarColor = (calendarId: string, idx: number) => {
    // If color is already set in state, use it (this preserves custom colors)
    if (calendarColors[calendarId]) {
      return calendarColors[calendarId];
    }
    // Otherwise, use palette color based on calendarOptions index (consistent)
    return colorPalette[idx % colorPalette.length] || '#60a5fa';
  };

  // Handler to change a calendar's color
  const handleCalendarColorChange = (calendarId: string, color: string) => {
    setCalendarColors(prev => ({ ...prev, [calendarId]: color }));
    // Update colors on existing events for this calendar
    setEvents(prevEvents => 
      prevEvents.map(event => {
        const eventCalendar = (event.resource as any)?.calendar || (event as any).calendar;
        const eventCourseId = (event.resource as any)?.courseId;
        // Check if this event belongs to the calendar (either direct calendar match or courseId match)
        if (eventCalendar === calendarId || eventCourseId === calendarId) {
          return {
            ...event,
            color: color,
            resource: {
              ...(event.resource || {}),
              color: color,
            }
          };
        }
        return event;
      })
    );
  };

  // Fetch events for all selected calendars (single aggregated feed)
  const fetchEvents = async () => {
    if (!selectedCalendars.length || !user) {
      setEvents([]);
      return;
    }

    try {
      const calendarIds = selectedCalendars.join(',');
      const res = await api.get(`/calendar/feed?calendarIds=${encodeURIComponent(calendarIds)}`);
      const feedEvents = res.data?.data?.events || [];
      const globalSeenAssignmentIds = new Set<string>();

      const allEvents: RBCEvent[] = feedEvents
        .filter((event: any) => {
          if (event.source === 'assignment' || event.type === 'Assignment') {
            const id = String(event.assignmentId || event._id || '');
            if (!id || globalSeenAssignmentIds.has(id)) return false;
            globalSeenAssignmentIds.add(id);
          }
          return true;
        })
        .map((event: any) => {
          const calId = event.calendar;
          const calIdx = calendarOptions.findIndex((opt) => opt.value === calId);
          const colorIdx = calIdx >= 0 ? calIdx : 0;
          const isAssignment = event.source === 'assignment' || event.type === 'Assignment';
          return {
            _id: event._id,
            title: event.title,
            start: new Date(event.start),
            end: new Date(event.end),
            type: event.type || 'Event',
            color: getCalendarColor(calId, colorIdx),
            allDay: false,
            resource: isAssignment
              ? { ...event, readOnly: true, courseId: event.courseId || calId }
              : { ...event, color: getCalendarColor(calId, colorIdx) },
          } as RBCEvent;
        });

      setEvents(allEvents);
    } catch {
      setEvents([]);
    }
  };

  useEffect(() => {
    if (selectedCalendars.length && user && calendarOptions.length > 0) {
      fetchEvents();
    } else {
      setEvents([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCalendars]);

  // On mount, select personal calendar by default (admin only gets their personal calendar)
  useEffect(() => {
    if (user && selectedCalendars.length === 0 && calendarOptions.length > 0) {
      if (user.role === 'admin') {
        // Admin only selects their personal calendar
        setSelectedCalendars([user._id]);
      } else {
        // Teachers/students can select all available calendars
      setSelectedCalendars(calendarOptions.map(opt => opt.value));
      }
    }
  }, [user, selectedCalendars, calendarOptions]);

  // Light color palette for event types
  const lightColors: Record<string, string> = {
    Event: '#93c5fd', // light blue
    'My To Do': '#fde68a', // light yellow
    'Appointment Group': '#fbcfe8', // light pink
    Default: '#e5e7eb', // light gray
  };

  // Handle slot selection (for creating)
  const handleSelectSlot = (slotInfo: SlotInfo) => {
    const defaultStart = slotInfo?.start || new Date();
    let defaultEnd = slotInfo?.end;
    if (!defaultEnd || defaultEnd.getTime() === defaultStart.getTime()) {
      defaultEnd = new Date(defaultStart.getTime() + 60 * 60 * 1000); // +1 hour
    }
    const type = activeTab;
    // Use the first selected calendar or user's calendar
    const calId = selectedCalendars[0] || (user ? user._id : '');
    const calIdx = calendarOptions.findIndex(opt => opt.value === calId);
    setEditingEvent({
      ...defaultEvent,
      start: defaultStart,
      end: defaultEnd,
      type,
      color: getCalendarColor(calId, calIdx),
      calendar: calId,
    });
    setModalOpen(true);
  };

  // Handle event click (for editing)
  const handleSelectEvent = (event: RBCEvent) => {

    // Make assignment detection case-insensitive and fallback to event.type
    const type = event.resource?.type || (event as any).type;
    const isAssignment = typeof type === 'string' && type.toLowerCase() === 'assignment';
    const assignmentId = event.resource?._id || (event as any)._id;
    if (isAssignment && assignmentId) {
      navigate(`/assignments/${assignmentId}/view`);
      return;
    }
    const editingEventData = {
      _id: (event as any)._id,
      title: typeof event.title === 'string' ? event.title : '',
      description: event.resource?.description || '',
      start: event.start ? new Date(event.start) : new Date(),
      end: event.end ? new Date(event.end) : new Date(),
      type: event.resource?.type || 'Event',
      color: event.resource?.color || '',
      location: event.resource?.location || '',
      calendar: event.resource?.calendar || (user ? user._id : ''),
    };
    
    setEditingEvent(editingEventData);
    setActiveTab(event.resource?.type || 'Event');
    setModalOpen(true);
  };

  // Handle form submit (now accepts a payload override)
  const handleSubmit = async (e: React.FormEvent, override?: Partial<Event>) => {
    e.preventDefault();
    if (!editingEvent) return;
    const payload = {
      title: override?.title ?? editingEvent.title,
      description: editingEvent.description,
      start: (override?.start ?? editingEvent.start)?.toISOString(),
      end: (override?.end ?? editingEvent.end)?.toISOString(),
      type: activeTab,
      color: override?.color ?? editingEvent.color,
      location: override?.location ?? editingEvent.location,
      calendar: override?.calendar ?? editingEvent.calendar,
    };
    try {
      if (editingEvent._id) {
        // Edit
        await api.put(`/events/${editingEvent._id}`, payload);
      } else {
        // Create
        await api.post('/events', payload);
      }
      setModalOpen(false);
      setEditingEvent(null);
      fetchEvents();
    } catch (error) {
      // You might want to show an error message to the user here
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (editingEvent && editingEvent._id) {
      try {
        // Check if the event is an assignment
        const type = editingEvent.type || (editingEvent as any).type;
        const isAssignment = typeof type === 'string' && type.toLowerCase() === 'assignment';
        if (isAssignment) {
          await api.delete(`/assignments/${editingEvent._id}`);
        } else {
          await api.delete(`/events/${editingEvent._id}`);
        }
        setModalOpen(false);
        setEditingEvent(null);
        fetchEvents();
      } catch (error: any) {
        // Show error message to user
        alert(`Failed to delete event: ${error.response?.data?.message || error.message || 'Unknown error'}`);
      }
    }
  };

  // Custom event styling
  const eventPropGetter = (event: any) => {
    const backgroundColor = event.color || (event.type === 'assignment'
      ? '#2563eb'
      : event.type === 'quiz'
      ? '#22c55e'
      : '#a3a3a3');
    return {
      style: {
        backgroundColor,
        borderRadius: '8px',
        color: '#fff',
        border: 'none',
        paddingLeft: '8px',
        paddingRight: '8px',
      },
    };
  };

  // Sync main calendar navigation
  const handleNavigate = (date: Date) => {
    setCurrentDate(date);
    setSelectedDate(date);
  };

  // Mini calendar navigation
  const handleMiniPrev = () => setCurrentDate(prev => subMonths(prev, 1));
  const handleMiniNext = () => setCurrentDate(prev => addMonths(prev, 1));

  // Mini calendar month/year
  const miniMonth = format(currentDate, 'MMMM yyyy');

  // Generate mini calendar days
  const start = startOfMonth(currentDate);
  const end = endOfMonth(currentDate);
  const daysInMonth = getDaysInMonth(currentDate);
  const startDay = start.getDay();
  const weeks: (Date | null)[][] = [];
  let week: (Date | null)[] = new Array(7).fill(null);
  let day = 1;
  // Fill first week
  for (let i = 0; i < 7; i++) {
    if (i >= startDay) {
      week[i] = new Date(currentDate.getFullYear(), currentDate.getMonth(), day++);
    }
  }
  weeks.push(week);
  // Fill remaining weeks
  while (day <= daysInMonth) {
    week = new Array(7).fill(null);
    for (let i = 0; i < 7 && day <= daysInMonth; i++) {
      week[i] = new Date(currentDate.getFullYear(), currentDate.getMonth(), day++);
    }
    weeks.push(week);
  }

  // Custom toolbar to add + button
  const CustomToolbar = (toolbarProps: any) => (
    <div className="rbc-toolbar mb-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 shadow-sm">
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <div className="flex items-center gap-1.5">
          <button type="button" className="rbc-btn inline-flex items-center justify-center h-8 px-3 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-100 transition text-sm font-medium leading-none" onClick={() => toolbarProps.onNavigate('TODAY')}>Today</button>
          <button type="button" className="rbc-btn inline-flex items-center justify-center h-8 w-8 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-100 transition text-base leading-none" onClick={() => toolbarProps.onNavigate('PREV')}>‹</button>
          <button type="button" className="rbc-btn inline-flex items-center justify-center h-8 w-8 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-100 transition text-base leading-none" onClick={() => toolbarProps.onNavigate('NEXT')}>›</button>
        </div>

        <span className="rbc-toolbar-label text-center text-lg sm:text-2xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight leading-none">{toolbarProps.label}</span>

        <div className="flex items-center gap-1.5 justify-end">
          <div className="inline-flex items-center rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/70 overflow-hidden">
            {['month', 'week', 'day', 'agenda'].map(view => (
              <button
                key={view}
                type="button"
                className={`inline-flex items-center justify-center px-3 h-8 text-sm font-medium capitalize leading-none transition ${
                  toolbarProps.view === view
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-white/70 dark:hover:bg-gray-600/60'
                }`}
                onClick={() => toolbarProps.onView(view)}
              >
                {view.charAt(0).toUpperCase() + view.slice(1)}
              </button>
            ))}
          </div>
          {!showCalendarsModal && (
            <button
              type="button"
              className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-100 text-lg leading-none hover:bg-gray-50 dark:hover:bg-gray-600 transition"
              onClick={() => {
                const now = new Date();
                const type = activeTab;
                setEditingEvent({
                  ...defaultEvent,
                  start: now,
                  end: new Date(now.getTime() + 60 * 60 * 1000), // +1 hour
                  type,
                  color: lightColors[type] || lightColors.Default,
                  calendar: user ? user._id : '',
                });
                setActiveTab('Event');
                setModalOpen(true);
              }}
            >
              +
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // Modal for create/edit (styled like the image)
  const EventModal = ({ isEdit }: { isEdit?: boolean }) => {
    const [localTitle, setLocalTitle] = useState(editingEvent?.title ?? '');
    const [localLocation, setLocalLocation] = useState(editingEvent?.location ?? '');
    const [localColor, setLocalColor] = useState(editingEvent?.color || lightColors[editingEvent?.type || 'Default']);
    const [colorManuallySet, setColorManuallySet] = useState(false);
    const [localCalendar, setLocalCalendar] = useState(editingEvent?.calendar || (user ? user._id : ''));
    const [error, setError] = useState<string | null>(null);
    const [localDate, setLocalDate] = useState('');
    const [localStartTime, setLocalStartTime] = useState('');
    const [localEndTime, setLocalEndTime] = useState('');
    const prevEditingEvent = useRef<typeof editingEvent | null>(null);

    useEffect(() => {
      if (editingEvent) {
        setLocalTitle(editingEvent.title ?? '');
        setLocalLocation(editingEvent.location ?? '');
        // Default to calendar color if present
        const calIdx = calendarOptions.findIndex(opt => opt.value === (editingEvent.calendar || (user ? user._id : '')));
        setLocalColor(editingEvent.color || getCalendarColor(editingEvent.calendar || (user ? user._id : ''), calIdx));
        setLocalCalendar(editingEvent.calendar || (user ? user._id : ''));
        setColorManuallySet(false);
        // Set date and time fields from event
        const startDate = new Date(editingEvent.start);
        const endDate = new Date(editingEvent.end);
        setLocalDate(formatLocalDate(startDate));
        setLocalStartTime(formatLocalTime(startDate));
        setLocalEndTime(formatLocalTime(endDate));
      }
    }, [editingEvent]);

    // Generate 5-min increment time options
    const timeOptions: string[] = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 5) {
        timeOptions.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
      }
    }

    const handleLocalSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (activeTab === 'My To Do') {
        // Only title and date
        if (!localTitle || !localDate) {
          setError('Title and date are required.');
          return;
        }
        try {
          await api.post('/todos', {
            title: localTitle,
            dueDate: localDate,
          });
          setModalOpen(false);
          setEditingEvent(null);
        } catch (err: any) {
          setError('Failed to create to-do');
        }
        return;
      }
      // Combine date and time into Date objects
      const start = new Date(`${localDate}T${localStartTime}`);
      const end = new Date(`${localDate}T${localEndTime}`);
      if (!start || !end || end <= start) {
        setError('End time must be after start time.');
        return;
      }
      if (!isTeacherOrAdmin && !user) {
        setError('User not found.');
        return;
      }
      handleSubmit(e, {
        title: localTitle,
        location: localLocation,
        color: localColor,
        start,
        end,
        calendar: isTeacherOrAdmin ? localCalendar : (user ? user._id : ''),
        type: activeTab,
      });
    };

    return (
      <div
        className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm lg:flex lg:items-center lg:justify-center lg:p-4"
        onClick={() => { setModalOpen(false); setEditingEvent(null); }}
      >
        <form
          className="flex h-full w-full flex-col bg-white dark:bg-gray-800 lg:h-auto lg:max-h-[90vh] lg:max-w-md lg:overflow-hidden lg:rounded-xl lg:border lg:border-gray-200/90 lg:shadow-lg dark:lg:border-gray-700"
          onSubmit={handleLocalSubmit}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="shrink-0 border-b border-gray-100 px-4 py-3 dark:border-gray-700/60">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {isEdit ? 'Edit Event' : 'Create Event'}
            </h2>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            <div
              className={`${CONTROL} flex gap-0.5 bg-gray-100 p-0.5 dark:bg-gray-800`}
              role="tablist"
              aria-label="Event type"
            >
              {eventTypes.map((tab) => {
                const active = activeTab === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`flex h-8 min-w-0 flex-1 items-center justify-center truncate rounded-md px-1 text-[10px] font-medium transition-colors touch-manipulation sm:text-[11px] ${
                      active
                        ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-50'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                    onClick={() => {
                      setActiveTab(tab.value);
                      setEditingEvent(editingEvent ? { ...editingEvent, type: tab.value } : null);
                      if (!colorManuallySet) {
                        setLocalColor(lightColors[tab.value] || lightColors.Default);
                      }
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div>
              <label htmlFor="event-title" className={FORM_LABEL}>
                Title <span className="text-red-500">*</span>
              </label>
              <input
                id="event-title"
                name="title"
                className={FIELD_CLASS}
                placeholder="Enter event title"
                type="text"
                value={localTitle}
                onChange={(e) => setLocalTitle(e.target.value)}
                required
              />
            </div>

            {activeTab !== 'My To Do' && (
              <div>
                <label htmlFor="event-color" className={FORM_LABEL}>Color</label>
                <div className="flex items-center gap-2">
                  <input
                    id="event-color"
                    name="color"
                    type="color"
                    className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-gray-200 bg-transparent p-1 touch-manipulation dark:border-gray-700"
                    value={localColor}
                    onChange={(e) => { setLocalColor(e.target.value); setColorManuallySet(true); }}
                  />
                  <button
                    type="button"
                    className={`${FIELD_CLASS} flex-1 text-left`}
                    onClick={() => {
                      const randomColor = colorPalette[Math.floor(Math.random() * colorPalette.length)];
                      setLocalColor(randomColor);
                      setColorManuallySet(true);
                    }}
                  >
                    Random color
                  </button>
                </div>
              </div>
            )}

            <DatePicker
              id="event-date"
              name="date"
              label="Date"
              required
              compact
              value={localDate}
              onChange={(e) => setLocalDate(e.target.value)}
            />

            {activeTab !== 'My To Do' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="event-time-from" className={FORM_LABEL}>
                    From <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id="event-time-from"
                      name="startTime"
                      className={SELECT_CLASS}
                      value={localStartTime}
                      onChange={(e) => setLocalStartTime(e.target.value)}
                      required
                    >
                      {timeOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                      aria-hidden
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="event-time-to" className={FORM_LABEL}>
                    To <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id="event-time-to"
                      name="endTime"
                      className={SELECT_CLASS}
                      value={localEndTime}
                      onChange={(e) => setLocalEndTime(e.target.value)}
                      required
                    >
                      {timeOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                      aria-hidden
                    />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className={`${FORM_ERROR} text-[11px] sm:text-xs`}>
                {error}
              </div>
            )}

            {activeTab !== 'My To Do' && (
              <div>
                <label htmlFor="event-location" className={FORM_LABEL}>Location</label>
                <input
                  id="event-location"
                  name="location"
                  className={FIELD_CLASS}
                  placeholder="Add location (optional)"
                  type="text"
                  value={localLocation}
                  onChange={(e) => setLocalLocation(e.target.value)}
                />
              </div>
            )}

            {activeTab !== 'My To Do' && isTeacherOrAdmin && (
              <div>
                <label htmlFor="event-calendar" className={FORM_LABEL}>
                  Calendar <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    id="event-calendar"
                    name="calendar"
                    className={SELECT_CLASS}
                    value={localCalendar}
                    onChange={(e) => {
                      setLocalCalendar(e.target.value);
                      if (!colorManuallySet) {
                        const calIdx = calendarOptions.findIndex((opt) => opt.value === e.target.value);
                        setLocalColor(getCalendarColor(e.target.value, calIdx));
                      }
                    }}
                    required
                  >
                    {calendarOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    aria-hidden
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-gray-100 px-4 py-3 dark:border-gray-700/60">
            <button
              type="button"
              className={`${CONTROL} ${CONTROL_TEXT} ${CONTROL_FOCUS} bg-white px-4 hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700`}
              onClick={() => { setModalOpen(false); setEditingEvent(null); }}
            >
              Cancel
            </button>
            <div className="flex items-center gap-2">
              {(() => {
                const canDelete = isEdit && (isTeacherOrAdmin || (user && editingEvent?.calendar === user._id));
                return canDelete ? (
                  <button
                    type="button"
                    className={`${CONTROL} ${CONTROL_TEXT} bg-red-600 px-4 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600`}
                    onClick={handleDelete}
                  >
                    Delete
                  </button>
                ) : null;
              })()}
              <button
                type="submit"
                className={`${CONTROL} px-4 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 sm:text-xs`}
              >
                {isEdit ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  };

  // Helper to get events for a specific date
  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      if (!event.start) return false;
      const eventStart = event.start instanceof Date ? event.start : new Date(event.start);
      return isSameDay(eventStart, date);
    });
  };

  // Generate calendar grid for mobile view
  const generateMobileCalendarGrid = () => {
    if (mobileViewMode === 'week') {
      const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
      const days = eachDayOfInterval({
        start: weekStart,
        end: addWeeks(weekStart, 1)
      }).slice(0, 7);
      return [days];
    } else {
      // Month view
      const start = startOfMonth(selectedDate);
      const daysInMonth = getDaysInMonth(selectedDate);
      const startDay = start.getDay();
      const weeks: Date[][] = [];
      let week: Date[] = [];
      
      // Fill first week with previous month days if needed
      for (let i = 0; i < startDay; i++) {
        const daysToSubtract = startDay - i;
        const prevDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), -daysToSubtract + 1);
        week.push(prevDate);
      }
      
      // Fill current month days
      for (let day = 1; day <= daysInMonth; day++) {
        week.push(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day));
        if (week.length === 7) {
          weeks.push(week);
          week = [];
        }
      }
      
      // Fill last week with next month days if needed
      if (week.length > 0) {
        let nextMonthDay = 1;
        while (week.length < 7) {
          week.push(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, nextMonthDay++));
        }
        weeks.push(week);
      }
      
      return weeks;
    }
  };

  // Get events for selected date (for events list)
  const selectedDateEvents = getEventsForDate(selectedDate);

  // Before rendering Calendar, set all events globally for overlap detection
  (window as any).allCalendarEvents = events;
  
  const calendarGrid = generateMobileCalendarGrid();
  
  return (
    <SwipeableContainer
      onSwipeLeft={swipeEnabled ? handleSwipeLeft : undefined}
      onSwipeRight={swipeEnabled ? handleSwipeRight : undefined}
      enabled={swipeEnabled}
      preventScrollInterference={true}
      className="min-h-screen bg-gray-50 dark:bg-gray-900"
    >
      <MobileAppShell
        title="Calendar"
        customRightAction={
          <button
            type="button"
            onClick={() => setShowCalendarsModal(true)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-blue-600 transition-colors hover:bg-gray-100 touch-manipulation dark:text-blue-400 dark:hover:bg-gray-700"
            aria-label="Manage calendars"
          >
            <CalendarIcon className="h-5 w-5" strokeWidth={2} />
          </button>
        }
      >
      {/* Mobile View */}
      <div className="lg:hidden">
        <div className="space-y-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (mobileViewMode === 'month') {
                  setSelectedDate((prev) => subMonths(prev, 1));
                } else {
                  setSelectedDate((prev) => subWeeks(prev, 1));
                }
              }}
              className={ICON_BTN}
              aria-label="Previous period"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => setMobileViewMode(mobileViewMode === 'month' ? 'week' : 'month')}
              className={`compact-control ${CONTROL} ${CONTROL_TEXT} ${CONTROL_FOCUS} flex flex-1 items-center justify-center gap-1 bg-white dark:bg-gray-800`}
              aria-label={`Switch to ${mobileViewMode === 'month' ? 'week' : 'month'} view`}
            >
              <span className="truncate text-[11px] font-semibold text-gray-900 dark:text-gray-100">
                {mobileViewMode === 'week'
                  ? `${format(startOfWeek(selectedDate, { weekStartsOn: 0 }), 'MMM d')} – ${format(endOfWeek(selectedDate, { weekStartsOn: 0 }), 'MMM d')}`
                  : format(selectedDate, 'MMMM yyyy')}
              </span>
              <ChevronDown size={14} className="shrink-0 text-gray-400" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => {
                if (mobileViewMode === 'month') {
                  setSelectedDate((prev) => addMonths(prev, 1));
                } else {
                  setSelectedDate((prev) => addWeeks(prev, 1));
                }
              }}
              className={ICON_BTN}
              aria-label="Next period"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              const today = new Date();
              setSelectedDate(today);
              setCurrentDate(today);
            }}
            className={`compact-control ${CONTROL} ${CONTROL_TEXT} ${CONTROL_FOCUS} w-full bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/60`}
          >
            Today
          </button>

          <div className="overflow-hidden rounded-lg border border-gray-200/90 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div className="grid grid-cols-7 border-b border-gray-100 px-1 py-1.5 dark:border-gray-700/60">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                <div
                  key={`${day}-${idx}`}
                  className="text-center text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="space-y-0.5 p-1.5">
              {calendarGrid.map((week, weekIdx) => (
                <div key={weekIdx} className="grid grid-cols-7 gap-0.5">
                  {week.map((date, dayIdx) => {
                    const isSelected = isSameDay(date, selectedDate);
                    const isCurrentMonth = isSameMonth(date, selectedDate);
                    const isToday = isSameDay(date, new Date());
                    const dayEvents = getEventsForDate(date);
                    const hasEvents = dayEvents.length > 0;

                    return (
                      <button
                        key={dayIdx}
                        type="button"
                        onClick={() => setSelectedDate(date)}
                        className={`relative flex aspect-square flex-col items-center justify-center rounded-lg touch-manipulation transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white dark:bg-blue-500'
                            : isToday
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                              : isCurrentMonth
                                ? 'text-gray-900 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-700/40'
                                : 'text-gray-300 dark:text-gray-600'
                        }`}
                      >
                        <span className={`text-[11px] font-medium ${isSelected ? 'font-semibold' : ''}`}>
                          {format(date, 'd')}
                        </span>
                        {hasEvents && (
                          <div className="absolute bottom-1 flex gap-0.5">
                            {dayEvents.slice(0, 3).map((_, dotIdx) => (
                              <div
                                key={dotIdx}
                                className={`h-1 w-1 rounded-full ${
                                  isSelected ? 'bg-white/90' : 'bg-blue-500 dark:bg-blue-400'
                                }`}
                              />
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200/90 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-700/60">
              <h3 className="text-[11px] font-semibold text-gray-900 dark:text-gray-100">
                {format(selectedDate, 'EEEE, MMM d')}
              </h3>
            </div>
            {selectedDateEvents.length === 0 ? (
              <div className="py-8 text-center">
                <CalendarIcon className="mx-auto mb-2 h-7 w-7 text-gray-300 dark:text-gray-600" strokeWidth={1.5} />
                <p className="text-[10px] text-gray-500 dark:text-gray-400 sm:text-[11px]">No events scheduled</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {selectedDateEvents.map((event, idx) => {
                  const eventColor =
                    (event as any).color || (event.resource && event.resource.color) || '#93c5fd';
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectEvent(event)}
                      className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 active:bg-gray-50 dark:hover:bg-gray-700/30"
                    >
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: eventColor }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-semibold text-gray-900 dark:text-gray-100 sm:text-xs">
                          {typeof event.title === 'string' ? event.title : 'Untitled Event'}
                        </span>
                        {event.start && (() => {
                          const startDate =
                            event.start instanceof Date ? event.start : new Date(event.start);
                          const endDate = event.end
                            ? event.end instanceof Date
                              ? event.end
                              : new Date(event.end)
                            : null;
                          return (
                            <span className="mt-0.5 block text-[10px] text-gray-500 dark:text-gray-400">
                              {format(startDate, 'h:mm a')}
                              {endDate && startDate.getTime() !== endDate.getTime() && (
                                <> – {format(endDate, 'h:mm a')}</>
                              )}
                            </span>
                          );
                        })()}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200/90 bg-white dark:border-gray-700 dark:bg-gray-800">
            <ToDoPanel />
          </div>
        </div>
      </div>
      </MobileAppShell>

      {/* Desktop View */}
      <div className="hidden lg:flex p-8 gap-6 calendar-modern">
      {/* Main Calendar */}
      <div className="flex-1">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
            style={{ height: 600 }}
          popup
          selectable
          date={currentDate}
          onNavigate={handleNavigate}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          eventPropGetter={eventPropGetter}
          showMultiDayTimes={false}
          components={{
            toolbar: CustomToolbar,
            event: CustomEvent,
            month: { event: CustomEvent },
            week: { event: CustomEvent },
            day: { event: CustomEvent },
            agenda: { event: CustomEvent },
          }}
        />
        </div>
      </div>
      {/* Right Panel */}
      <div className="w-80 flex flex-col gap-3">
        {/* Mini Month Picker */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setMiniSelectedDate(prev => subMonths(prev, 1))}
              className="h-9 w-9 inline-flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95 transition-all text-gray-700 dark:text-gray-300"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center font-semibold text-lg text-gray-900 dark:text-gray-100">{format(miniSelectedDate, 'MMMM yyyy')}</div>
            <button
              onClick={() => setMiniSelectedDate(prev => addMonths(prev, 1))}
              className="h-9 w-9 inline-flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95 transition-all text-gray-700 dark:text-gray-300"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <table className="w-full text-xs select-none">
            <thead>
              <tr>
                <th className="font-semibold text-gray-500 dark:text-gray-400">Su</th><th className="font-semibold text-gray-500 dark:text-gray-400">Mo</th><th className="font-semibold text-gray-500 dark:text-gray-400">Tu</th><th className="font-semibold text-gray-500 dark:text-gray-400">We</th><th className="font-semibold text-gray-500 dark:text-gray-400">Th</th><th className="font-semibold text-gray-500 dark:text-gray-400">Fr</th><th className="font-semibold text-gray-500 dark:text-gray-400">Sa</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Generate mini calendar days for miniSelectedDate
                const start = startOfMonth(miniSelectedDate);
                const end = endOfMonth(miniSelectedDate);
                const daysInMonth = getDaysInMonth(miniSelectedDate);
                const startDay = start.getDay();
                const weeks: (Date | null)[][] = [];
                let week: (Date | null)[] = new Array(7).fill(null);
                let day = 1;
                // Fill first week
                for (let i = 0; i < 7; i++) {
                  if (i >= startDay) {
                    week[i] = new Date(miniSelectedDate.getFullYear(), miniSelectedDate.getMonth(), day++);
                  }
                }
                weeks.push(week);
                // Fill remaining weeks
                while (day <= daysInMonth) {
                  week = new Array(7).fill(null);
                  for (let i = 0; i < 7 && day <= daysInMonth; i++) {
                    week[i] = new Date(miniSelectedDate.getFullYear(), miniSelectedDate.getMonth(), day++);
                  }
                  weeks.push(week);
                }
                return weeks.map((week, i) => (
                  <tr key={i}>
                    {week.map((date, j) => (
                      <td
                        key={j}
                        className={
                          date && isSameMonth(date, miniSelectedDate)
                            ? `cursor-pointer rounded-full w-8 h-8 text-center align-middle transition ${isSameDay(date, miniSelectedDate) ? 'bg-blue-200 dark:bg-blue-900/50 text-blue-900 dark:text-blue-200 font-bold shadow' : 'hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 text-gray-700 dark:text-gray-300'}`
                            : 'text-gray-300 dark:text-gray-600'
                        }
                        onClick={() => date && setMiniSelectedDate(date)}
                      >
                        {date ? format(date, 'd').padStart(2, '0') : ''}
                      </td>
                    ))}
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
        {/* Calendar List */}
        <div className="relative overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200/70 dark:bg-gray-800 dark:ring-gray-700/60">
          <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-700/80">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Calendars
            </p>
          </div>
          <div className="max-h-44 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/50">
            {calendarOptions.map((opt, idx) => (
              <CalendarFilterRow
                key={opt.value}
                opt={opt}
                checked={selectedCalendars.includes(opt.value)}
                color={getCalendarColor(opt.value, idx)}
                inputId={`calendar-checkbox-${opt.value}`}
                colorPickerActive={colorWheelOpen === opt.value}
                onToggle={() => handleCalendarToggle(opt.value)}
                onColorClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setColorWheelOpen(opt.value);
                }}
              />
            ))}
          </div>
          {colorWheelOpen && (
            <div className="border-t border-gray-100 px-3 py-3 dark:border-gray-700/50">
              <CalendarColorPicker
                colors={colorPalette}
                selectedColor={getCalendarColor(
                  colorWheelOpen,
                  calendarOptions.findIndex((opt) => opt.value === colorWheelOpen)
                )}
                onSelect={(color) => {
                  handleCalendarColorChange(colorWheelOpen, color);
                  setColorWheelOpen(null);
                }}
                onClose={() => setColorWheelOpen(null)}
              />
            </div>
          )}
        </div>
        {/* To-Do Panel below calendar list */}
        <div className="max-h-64 overflow-y-auto pr-1 rounded-2xl">
          <ToDoPanel />
        </div>
      </div>
      </div>

      {/* Modal for create/edit - Outside both mobile and desktop views */}
      {modalOpen && editingEvent && user && (
        <EventModal isEdit={!!editingEvent._id} />
      )}

      {/* Floating Action Button (Mobile Only) */}
      {!showCalendarsModal && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Use selectedDate instead of now, but set time to current time
            const selectedDateTime = new Date(selectedDate);
            const now = new Date();
            selectedDateTime.setHours(now.getHours());
            selectedDateTime.setMinutes(now.getMinutes());
            
            const endTime = new Date(selectedDateTime);
            endTime.setHours(endTime.getHours() + 1); // +1 hour
            
            const type = activeTab;
            setEditingEvent({
              ...defaultEvent,
              start: selectedDateTime,
              end: endTime,
              type,
              color: lightColors[type] || lightColors.Default,
              calendar: user ? user._id : '',
            });
            setActiveTab('Event');
            setModalOpen(true);
          }}
          className="lg:hidden fixed bottom-20 right-4 z-[100] inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm transition-colors hover:bg-blue-700 active:bg-blue-800 touch-manipulation dark:bg-blue-500 dark:hover:bg-blue-600"
          aria-label="Create event"
          type="button"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
        </button>
      )}

      {/* Calendars Modal (Mobile Only) */}
      {showCalendarsModal && (
        <div
          className="lg:hidden fixed inset-x-0 top-0 z-50 bg-black/40 backdrop-blur-sm"
          style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
          onClick={() => setShowCalendarsModal(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 flex max-h-[65vh] flex-col overflow-hidden rounded-t-2xl border border-gray-200/80 border-b-0 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
            {...(showCalendarsModal
              ? {
                  onTouchStart: calendarModalSwipe.onTouchStart,
                  onTouchMove: calendarModalSwipe.onTouchMove,
                  onTouchEnd: calendarModalSwipe.onTouchEnd,
                }
              : {})}
          >
            <div className="flex shrink-0 justify-center pt-2.5 pb-1">
              <span className="h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-2.5 dark:border-gray-700/80">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Calendars</h2>
              <button
                type="button"
                onClick={() => setShowCalendarsModal(false)}
                className="icon-only flex h-8 w-8 items-center justify-center rounded-full p-0 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 touch-manipulation dark:hover:bg-slate-700 dark:hover:text-slate-200"
                aria-label="Close"
              >
                <X className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3">
              <div className="overflow-hidden rounded-xl ring-1 ring-gray-200/70 divide-y divide-gray-100 dark:ring-gray-700/60 dark:divide-gray-700/50">
                {calendarOptions.map((opt, idx) => (
                  <CalendarFilterRow
                    key={opt.value}
                    opt={opt}
                    checked={selectedCalendars.includes(opt.value)}
                    color={getCalendarColor(opt.value, idx)}
                    inputId={`mobile-calendar-${opt.value}`}
                    colorPickerActive={colorWheelOpen === opt.value}
                    onToggle={() => handleCalendarToggle(opt.value)}
                    onColorClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setColorWheelOpen(opt.value);
                    }}
                  />
                ))}
              </div>
              {colorWheelOpen && (
                <div className="pt-4">
                  <CalendarColorPicker
                    colors={colorPalette}
                    selectedColor={getCalendarColor(
                      colorWheelOpen,
                      calendarOptions.findIndex((opt) => opt.value === colorWheelOpen)
                    )}
                    onSelect={(color) => {
                      handleCalendarColorChange(colorWheelOpen, color);
                      setColorWheelOpen(null);
                    }}
                    onClose={() => setColorWheelOpen(null)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </SwipeableContainer>
  );
};

export default CalendarPage; 