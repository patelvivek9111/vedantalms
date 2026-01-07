import React, { useEffect, useState, useRef } from 'react';
// Make sure to run: npm install react-big-calendar date-fns
import { Calendar, dateFnsLocalizer, Event as RBCEvent, SlotInfo, NavigateAction, Views } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { parse, startOfWeek, getDay, format, addMonths, subMonths, getDaysInMonth, startOfMonth, endOfMonth, isSameMonth, isSameDay, addWeeks, subWeeks, startOfDay, endOfDay, eachDayOfInterval, isSameWeek, getWeek } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import { useCourse } from '../contexts/CourseContext';
import api, { getImageUrl } from '../services/api';
import { ToDoPanel } from './ToDoPanel';
import { useNavigate } from 'react-router-dom';
import { FileText, User, Plus, ChevronDown, Calendar as CalendarIcon } from 'lucide-react';
import { BurgerMenu } from './BurgerMenu';

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

// 20 light color palette
const colorPalette = [
  '#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF',
  '#b5ead7', '#c7ceea', '#f3b0c3', '#f6dfeb', '#d0f4de',
  '#f7d6e0', '#e2f0cb', '#b2f7ef', '#f6eac2', '#f9f9c5',
  '#e4c1f9', '#a9def9', '#e2f0cb', '#fdffb6', '#caffbf'
];

// ColorWheelPicker component
const ColorWheelPicker: React.FC<{
  colors: string[];
  onSelect: (color: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement>;
  positionRight?: boolean; // For mobile view to position on right side
}> = ({ colors, onSelect, onClose, anchorRef, positionRight = false }) => {
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node) &&
        (!anchorRef.current || !anchorRef.current.contains(event.target as Node))
      ) {
        onClose();
      }
    }
    // Use a small delay to prevent immediate closing when opening
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside as any);
    }, 100);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside as any);
    };
  }, [onClose, anchorRef]);

  // Position the wheel near the anchor
  const [style, setStyle] = useState<React.CSSProperties>({});
  useEffect(() => {
    if (anchorRef.current && pickerRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      // Smaller wheel for mobile view
      const wheelSize = positionRight ? 80 : 112; // 40 * 2 for mobile, 56 * 2 for desktop
      if (positionRight) {
        // Position all the way to the right edge of the screen
        setStyle({
          position: 'fixed',
          top: rect.top + (rect.height / 2) - (wheelSize / 2),
          right: 16, // 16px padding from right edge
          zIndex: 9999,
        });
      } else {
        // Default: position below the anchor
        setStyle({
          position: 'fixed',
          top: rect.bottom + 8,
          left: rect.left - 40,
          zIndex: 9999,
        });
      }
    }
  }, [anchorRef, positionRight]);

  // Arrange colors in a wheel - smaller for mobile
  const radius = positionRight ? 32 : 48;
  const center = positionRight ? 40 : 56;
  const circleRadius = positionRight ? 10 : 14;
  const angleStep = (2 * Math.PI) / colors.length;

  return (
    <div ref={pickerRef} style={style} className="bg-white dark:bg-gray-800 rounded-full shadow-lg p-2 border border-gray-200 dark:border-gray-700" >
      <svg width={center * 2} height={center * 2} style={{ display: 'block' }}>
        {colors.map((color, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const x = center + radius * Math.cos(angle);
          const y = center + radius * Math.sin(angle);
          return (
            <circle
              key={color + '-' + i}
              cx={x}
              cy={y}
              r={circleRadius}
              fill={color}
              stroke="#fff"
              strokeWidth={positionRight ? 1.5 : 2}
              className="dark:stroke-gray-700"
              style={{ cursor: 'pointer', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.08))' }}
              onClick={() => onSelect(color)}
            />
          );
        })}
      </svg>
    </div>
  );
};

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
  const colorDotRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const navigate = useNavigate();
  // Mobile view state
  const [showBurgerMenu, setShowBurgerMenu] = useState(false);
  const [mobileViewMode, setMobileViewMode] = useState<'week' | 'month'>('month');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCalendarsModal, setShowCalendarsModal] = useState(false);

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

  // Fetch events for all selected calendars
  const fetchEvents = async () => {
    if (!selectedCalendars.length || !user) {
      setEvents([]);
      return;
    }
    let allEvents: RBCEvent[] = [];
    const globalSeenAssignmentIds = new Set(); // Global deduplication across all courses
    
    for (const [idx, calId] of selectedCalendars.entries()) {
      // If teacher calendar (personal)
      if (calId === user._id) {
        try {
          const res = await api.get('/events?calendar=' + user._id);
          const data = res.data.data || res.data; // Handle both new and old response formats
          const calIdx = calendarOptions.findIndex(opt => opt.value === user._id);
          // If calendar not found in options (shouldn't happen), use 0 as fallback
          const colorIdx = calIdx >= 0 ? calIdx : 0;
          if (Array.isArray(data)) {
            allEvents.push(...data
              .filter((event: any) => event.calendar === user._id)
              .map((event: any) => ({
                ...event,
                start: new Date(event.start),
                end: new Date(event.end),
                title: event.title,
                allDay: false,
                color: getCalendarColor(user._id, colorIdx),
                resource: { ...event, color: getCalendarColor(user._id, colorIdx) },
              })));
          }
        } catch (error) {
          }
        continue;
      }
      // Else, course calendar: fetch events for course and assignments as events
      // Skip course events for admins (should not happen since admins don't have course calendars, but just in case)
      if (user?.role === 'admin') {
        continue; // Skip course calendars for admins
      }
      try {
        const res = await api.get('/events?calendar=' + calId);
        const data = res.data.data || res.data; // Handle both new and old response formats
        // Use calendarOptions index instead of selectedCalendars index to maintain consistent colors
        const calIdx = calendarOptions.findIndex(opt => opt.value === calId);
        // If calendar not found in options (shouldn't happen), use 0 as fallback
        const colorIdx = calIdx >= 0 ? calIdx : 0;
        let courseEvents: RBCEvent[] = [];
        if (Array.isArray(data)) {
          courseEvents = data
            .filter((event: any) => event.calendar === calId)
            .map((event: any) => ({
              ...event,
              start: new Date(event.start),
              end: new Date(event.end),
              title: event.title,
              allDay: false,
              color: getCalendarColor(calId, colorIdx),
              resource: { ...event, color: getCalendarColor(calId, colorIdx) },
            }));
        }
        
        // Fetch assignments for all modules in this course
        let assignmentEvents: RBCEvent[] = [];
        

        
        try {
          const courseObj = courses.find((c: any) => c._id === calId);
          if (courseObj && Array.isArray((courseObj as any).modules)) {
            for (const module of (courseObj as any).modules) {
              try {
                const response = await api.get(`/assignments/module/${module._id}`);
                const assignments = response.data;
                
                if (Array.isArray(assignments)) {
                  assignments.forEach((a: any) => {
                  // Only add if we haven't seen this assignment before globally
                  if (!globalSeenAssignmentIds.has(a._id)) {
                    globalSeenAssignmentIds.add(a._id);
                    
                    // Use calendarOptions index instead of selectedCalendars index
                    const calIdxForAssignments = calendarOptions.findIndex(opt => opt.value === calId);
                    // If calendar not found in options (shouldn't happen), use 0 as fallback
                    const colorIdxForAssignments = calIdxForAssignments >= 0 ? calIdxForAssignments : 0;
                    assignmentEvents.push({
                      _id: a._id,
                      title: a.title,
                      start: new Date(a.dueDate),
                      end: new Date(a.dueDate),
                      type: 'Assignment',
                      color: getCalendarColor(calId, colorIdxForAssignments),
                      allDay: false,
                      resource: { ...a, readOnly: true, courseId: calId },
                    } as RBCEvent);
                  } else {
                    
                  }
                  });
                }
              } catch (error) {
                }
            }
          } else {
            try {
              const modulesRes = await api.get(`/courses/${calId}/modules`);
              const modules = modulesRes.data.data || modulesRes.data; // Handle both new and old response formats
              if (Array.isArray(modules)) {
                for (const module of modules) {
                  try {
                    const response = await api.get(`/assignments/module/${module._id}`);
                    const assignments = response.data;

                    if (Array.isArray(assignments)) {
                      assignments.forEach((a: any) => {
                      // Only add if we haven't seen this assignment before globally
                      if (!globalSeenAssignmentIds.has(a._id)) {
                        globalSeenAssignmentIds.add(a._id);

                        // Use calendarOptions index instead of selectedCalendars index
                        const calIdxForAssignments2 = calendarOptions.findIndex(opt => opt.value === calId);
                        // If calendar not found in options (shouldn't happen), use 0 as fallback
                        const colorIdxForAssignments2 = calIdxForAssignments2 >= 0 ? calIdxForAssignments2 : 0;
                        assignmentEvents.push({
                          _id: a._id,
                          title: a.title,
                          start: new Date(a.dueDate),
                          end: new Date(a.dueDate),
                          type: 'Assignment',
                          color: getCalendarColor(calId, colorIdxForAssignments2),
                          allDay: false,
                          resource: { ...a, readOnly: true, courseId: calId },
                        } as RBCEvent);
                      } else {

                      }
                      });
                    }
                  } catch (error) {
                    }
                }
              }
            } catch (error) {
              }
          }
        } catch (e) {
          }
        

        allEvents.push(...courseEvents, ...assignmentEvents);
      } catch (error) {
        }
    }
    setEvents(allEvents);
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
    <div className="rbc-toolbar flex items-center justify-between mb-2">
      <div className="flex gap-2">
        <button type="button" className="rbc-btn px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900/50 active:bg-blue-200 dark:active:bg-blue-800 text-gray-700 dark:text-gray-300 transition" onClick={() => toolbarProps.onNavigate('TODAY')}>Today</button>
        <button type="button" className="rbc-btn px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900/50 active:bg-blue-200 dark:active:bg-blue-800 text-gray-700 dark:text-gray-300 transition" onClick={() => toolbarProps.onNavigate('PREV')}>Back</button>
        <button type="button" className="rbc-btn px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900/50 active:bg-blue-200 dark:active:bg-blue-800 text-gray-700 dark:text-gray-300 transition" onClick={() => toolbarProps.onNavigate('NEXT')}>Next</button>
      </div>
      <span className="rbc-toolbar-label text-lg font-semibold text-gray-900 dark:text-gray-100">{toolbarProps.label}</span>
      <div className="flex gap-2 items-center">
        {['month', 'week', 'day', 'agenda'].map(view => (
          <button
            key={view}
            type="button"
            className={`px-3 py-1 rounded-lg transition font-medium capitalize ${toolbarProps.view === view ? 'bg-blue-600 dark:bg-blue-500 text-white shadow' : 'bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900/50 active:bg-blue-200 dark:active:bg-blue-800 text-gray-700 dark:text-gray-300'}`}
            onClick={() => toolbarProps.onView(view)}
          >
            {view.charAt(0).toUpperCase() + view.slice(1)}
          </button>
        ))}
        {!showCalendarsModal && (
          <button
            type="button"
            className="px-3 py-1 bg-blue-600 dark:bg-blue-500 text-white rounded-lg text-xl ml-2 shadow hover:bg-blue-700 dark:hover:bg-blue-600 transition"
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
          >+</button>
        )}
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
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] lg:flex lg:items-center lg:justify-center lg:p-4 animate-in fade-in duration-200"
        onClick={() => { setModalOpen(false); setEditingEvent(null); }}
      >
        <form
          className="bg-white dark:bg-gray-800 w-full h-full flex flex-col shadow-2xl lg:h-auto lg:max-w-lg lg:max-h-[90vh] lg:rounded-2xl animate-in slide-in-from-bottom-full duration-300 lg:slide-in-from-bottom-0"
          onSubmit={handleLocalSubmit}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile Header - Sticky with gradient */}
          <div className="flex justify-between items-center px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 border-b border-gray-200/50 dark:border-gray-700 flex-shrink-0 lg:px-6 lg:py-4 lg:bg-white lg:dark:bg-gray-800">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 lg:text-lg">{isEdit ? 'Edit Event' : 'Create Event'}</h2>
            <button 
              type="button" 
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-xl w-8 h-8 flex items-center justify-center rounded-full transition-all touch-manipulation active:scale-95 lg:text-2xl lg:w-auto lg:h-auto" 
              onClick={() => { setModalOpen(false); setEditingEvent(null); }}
            >
              &times;
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 py-3 bg-gray-50/50 dark:bg-gray-900/50 lg:px-6 lg:py-4 lg:bg-white lg:dark:bg-gray-800">
            {/* Tabs */}
            <div className="flex gap-1.5 mb-4 overflow-x-auto -mx-4 px-4 pb-2 lg:mx-0 lg:px-0 lg:border-b lg:border-gray-200 lg:dark:border-gray-700">
              {eventTypes.map(tab => (
                <button
                  key={tab.value}
                  type="button"
                  className={`px-3 py-2 font-semibold whitespace-nowrap flex-shrink-0 touch-manipulation text-xs rounded-lg transition-all active:scale-95 lg:px-4 lg:py-2 lg:text-sm lg:rounded-none lg:border-b-4 ${
                    activeTab === tab.value 
                      ? 'bg-blue-600 dark:bg-blue-500 text-white lg:bg-transparent lg:shadow-none lg:border-purple-600 dark:lg:border-purple-400 lg:text-purple-700 dark:lg:text-purple-300' 
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 lg:border-0 lg:hover:bg-transparent'
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
              ))}
            </div>

            {/* Title Field */}
            <div className="mb-4">
              <label htmlFor="event-title" className="block text-xs font-semibold mb-1.5 text-gray-700 dark:text-gray-300 lg:text-sm lg:mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                id="event-title"
                name="title"
                className="border-2 border-gray-200 dark:border-gray-700 p-2.5 w-full rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm lg:p-2 lg:text-sm"
                placeholder="Enter event title"
                type="text"
                value={localTitle}
                onChange={e => setLocalTitle(e.target.value)}
                required
              />
            </div>

            {/* Color Picker - Only for non-ToDo */}
            {activeTab !== 'My To Do' && (
              <div className="mb-4">
                <label htmlFor="event-color" className="block text-xs font-semibold mb-2 text-gray-700 dark:text-gray-300 lg:text-sm lg:mb-1">Color</label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-shrink-0">
                    <input
                      id="event-color"
                      name="color"
                      type="color"
                      className="w-10 h-10 p-0 border-2 border-gray-200 dark:border-gray-600 rounded-lg bg-transparent cursor-pointer touch-manipulation lg:w-10 lg:h-10"
                      value={localColor}
                      onChange={e => { setLocalColor(e.target.value); setColorManuallySet(true); }}
                      style={{ background: 'none' }}
                    />
                  </div>
                  <button
                    type="button"
                    className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 touch-manipulation transition-all active:scale-95 shadow-sm lg:px-3 lg:py-1 lg:text-sm"
                    onClick={() => {
                      const randomColor = colorPalette[Math.floor(Math.random() * colorPalette.length)];
                      setLocalColor(randomColor);
                      setColorManuallySet(true);
                    }}
                  >
                    🎲 Random
                  </button>
                </div>
              </div>
            )}

            {/* Date Field */}
            <div className="mb-4">
              <label htmlFor="event-date" className="block text-xs font-semibold mb-1.5 text-gray-700 dark:text-gray-300 lg:text-sm lg:mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                id="event-date"
                name="date"
                className="border-2 border-gray-200 dark:border-gray-700 p-2.5 w-full rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm lg:p-2 lg:text-sm"
                type="date"
                value={localDate}
                onChange={e => setLocalDate(e.target.value)}
                required
              />
            </div>

            {/* Time Fields - Only for non-ToDo */}
            {activeTab !== 'My To Do' && (
              <div className="mb-4">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label htmlFor="event-time-from" className="block text-xs font-semibold mb-1.5 text-gray-700 dark:text-gray-300 lg:text-sm lg:mb-1">
                      From <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="event-time-from"
                      name="startTime"
                      className="border-2 border-gray-200 dark:border-gray-700 p-2.5 w-full rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm lg:p-2 lg:text-sm"
                      value={localStartTime}
                      onChange={e => setLocalStartTime(e.target.value)}
                      required
                    >
                      {timeOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="event-time-to" className="block text-xs font-semibold mb-1.5 text-gray-700 dark:text-gray-300 lg:text-sm lg:mb-1">
                      To <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="event-time-to"
                      name="endTime"
                      className="border-2 border-gray-200 dark:border-gray-700 p-2.5 w-full rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm lg:p-2 lg:text-sm"
                      value={localEndTime}
                      onChange={e => setLocalEndTime(e.target.value)}
                      required
                    >
                      {timeOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-3 p-2.5 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg shadow-sm">
                <div className="text-red-600 dark:text-red-400 text-xs font-medium flex items-center gap-1.5">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* Location Field - Only for non-ToDo */}
            {activeTab !== 'My To Do' && (
              <div className="mb-4">
                <label htmlFor="event-location" className="block text-xs font-semibold mb-1.5 text-gray-700 dark:text-gray-300 lg:text-sm lg:mb-1">Location</label>
                <input
                  id="event-location"
                  name="location"
                  className="border-2 border-gray-200 dark:border-gray-700 p-2.5 w-full rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm lg:p-2 lg:text-sm"
                  placeholder="Add location (optional)"
                  type="text"
                  value={localLocation}
                  onChange={e => setLocalLocation(e.target.value)}
                />
              </div>
            )}

            {/* Calendar Select - Only for non-ToDo and teachers/admins */}
            {activeTab !== 'My To Do' && isTeacherOrAdmin && (
              <div className="mb-4">
                <label htmlFor="event-calendar" className="block text-xs font-semibold mb-1.5 text-gray-700 dark:text-gray-300 lg:text-sm lg:mb-1">
                  Calendar <span className="text-red-500">*</span>
                </label>
                <select
                  id="event-calendar"
                  name="calendar"
                  className="border-2 border-gray-200 dark:border-gray-700 p-2.5 w-full rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm lg:p-2 lg:text-sm"
                  value={localCalendar}
                  onChange={e => {
                    setLocalCalendar(e.target.value);
                    if (!colorManuallySet) {
                      const calIdx = calendarOptions.findIndex(opt => opt.value === e.target.value);
                      setLocalColor(getCalendarColor(e.target.value, calIdx));
                    }
                  }}
                  required
                >
                  {calendarOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Footer - Sticky */}
          <div className="flex justify-between items-center px-4 py-3 bg-white dark:bg-gray-800 border-t-2 border-gray-100 dark:border-gray-700 gap-2 flex-shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] lg:px-6 lg:py-4 lg:mt-6 lg:border-t-0 lg:shadow-none">
            <button 
              type="button" 
              className="bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs font-medium touch-manipulation flex-1 transition-all active:scale-95 shadow-sm lg:flex-none lg:px-4 lg:py-2 lg:text-sm"
            >
              More Options
            </button>
            <div className="flex gap-2">
              {(() => {
                const canDelete = isEdit && (isTeacherOrAdmin || (user && editingEvent?.calendar === user._id));
                return canDelete ? (
                  <button
                    type="button"
                    className="bg-red-500 dark:bg-red-600 hover:bg-red-600 dark:hover:bg-red-700 text-white px-3 py-2 rounded-lg text-xs font-semibold touch-manipulation transition-all active:scale-95 shadow-lg shadow-red-500/30 lg:px-4 lg:py-2 lg:text-sm lg:shadow-none"
                    onClick={handleDelete}
                  >
                    Delete
                  </button>
                ) : null;
              })()}
              <button 
                type="submit" 
                className="bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold touch-manipulation transition-all active:scale-95 lg:px-4 lg:py-2 lg:text-sm"
              >
                ✓ {isEdit ? 'Save Changes' : 'Create Event'}
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile Top Navigation */}
      <nav className="lg:hidden fixed top-0 left-0 right-0 z-[150] bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="relative flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setShowBurgerMenu(!showBurgerMenu)}
            className="text-gray-700 dark:text-gray-300 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
            aria-label="Open account menu"
          >
            <User className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Calendar</h1>
          <button
            onClick={() => setShowCalendarsModal(true)}
            className="text-blue-600 dark:text-blue-400 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
            aria-label="Manage calendars"
          >
            <CalendarIcon className="w-6 h-6" />
          </button>
          
          {/* Burger Menu */}
          <BurgerMenu
            showBurgerMenu={showBurgerMenu}
            setShowBurgerMenu={setShowBurgerMenu}
          />
        </div>
      </nav>

      {/* Mobile View */}
      <div className="lg:hidden pt-20 pb-16 bg-gray-50 dark:bg-gray-900 min-h-screen">
        {/* Calendar Header */}
        <div className="px-3 py-2.5 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm backdrop-blur-sm bg-white/95 dark:bg-gray-800/95">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                if (mobileViewMode === 'month') {
                  setSelectedDate(prev => subMonths(prev, 1));
                } else {
                  setSelectedDate(prev => subWeeks(prev, 1));
                }
              }}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all active:scale-95 touch-manipulation"
            >
              <span className="text-gray-700 dark:text-gray-300 font-bold text-lg">‹</span>
            </button>
            <button
              onClick={() => setMobileViewMode(mobileViewMode === 'month' ? 'week' : 'month')}
              className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all active:scale-95 touch-manipulation bg-gray-50 dark:bg-gray-700/50"
            >
              <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                {format(selectedDate, 'MMMM')}
              </span>
              <span className="text-base font-semibold text-gray-600 dark:text-gray-400">
                {format(selectedDate, 'yyyy')}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
            </button>
            <button
              onClick={() => {
                if (mobileViewMode === 'month') {
                  setSelectedDate(prev => addMonths(prev, 1));
                } else {
                  setSelectedDate(prev => addWeeks(prev, 1));
                }
              }}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all active:scale-95 touch-manipulation"
            >
              <span className="text-gray-700 dark:text-gray-300 font-bold text-lg">›</span>
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-white dark:bg-gray-800 px-3 py-3 shadow-sm">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
              <div key={day} className="text-center text-xs font-bold text-gray-600 dark:text-gray-400 py-1 uppercase tracking-wide">
                {day.substring(0, 3)}
              </div>
            ))}
          </div>
          
          {/* Calendar days */}
          <div className="space-y-1">
            {calendarGrid.map((week, weekIdx) => (
              <div key={weekIdx} className="grid grid-cols-7 gap-1.5">
                {week.map((date, dayIdx) => {
                  const isSelected = isSameDay(date, selectedDate);
                  const isCurrentMonth = isSameMonth(date, selectedDate);
                  const isToday = isSameDay(date, new Date());
                  const dayEvents = getEventsForDate(date);
                  const hasEvents = dayEvents.length > 0;
                  
                  return (
                    <button
                      key={dayIdx}
                      onClick={() => setSelectedDate(date)}
                      className={`
                        relative aspect-square flex flex-col items-center justify-center rounded-2xl transition-all duration-200 touch-manipulation
                        ${isSelected 
                          ? 'bg-gradient-to-br from-blue-600 to-blue-500 dark:from-blue-500 dark:to-blue-600 text-white shadow-xl scale-105 ring-2 ring-blue-200 dark:ring-blue-800 ring-offset-2' 
                          : isCurrentMonth 
                            ? isToday
                              ? 'bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/30 dark:to-blue-800/20 text-blue-700 dark:text-blue-300 border-2 border-blue-300 dark:border-blue-700 font-bold shadow-md'
                              : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/50 active:scale-95 hover:shadow-sm'
                            : 'text-gray-300 dark:text-gray-600 opacity-50'
                        }
                      `}
                    >
                      <span className={`text-sm font-semibold ${isSelected ? 'text-white' : isToday ? 'text-blue-700 dark:text-blue-300' : ''}`}>
                        {format(date, 'd')}
                      </span>
                      {hasEvents && !isSelected && (
                        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                          {dayEvents.slice(0, 3).map((_, idx) => (
                            <div key={idx} className="w-1 h-1 bg-blue-500 dark:bg-blue-400 rounded-full"></div>
                          ))}
                          {dayEvents.length > 3 && (
                            <div className="w-1 h-1 bg-gray-400 dark:bg-gray-500 rounded-full"></div>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Events List */}
        <div className="px-3 py-3 bg-white dark:bg-gray-800 mt-2 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-1.5">
            <span>{format(selectedDate, 'EEEE')}</span>
            <span className="text-gray-400 dark:text-gray-500">•</span>
            <span className="text-gray-600 dark:text-gray-400 font-semibold">{format(selectedDate, 'MMMM d')}</span>
          </h3>
          {selectedDateEvents.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 dark:text-gray-500 text-3xl mb-2">📅</div>
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                No events scheduled
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedDateEvents.map((event, idx) => {
                const eventColor = (event as any).color || (event.resource && event.resource.color) || '#93c5fd';
                const isAssignment = event.resource?.type === 'Assignment';
                return (
                  <div
                    key={idx}
                    onClick={() => handleSelectEvent(event)}
                    className="group flex items-start gap-3 p-3 rounded-xl hover:bg-gradient-to-r hover:from-gray-50 hover:to-transparent dark:hover:from-gray-700/30 dark:hover:to-transparent transition-all cursor-pointer border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 active:scale-[0.98]"
                  >
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0 mt-1 shadow-sm ring-1 ring-white dark:ring-gray-800"
                      style={{ backgroundColor: eventColor }}
                    ></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate mb-0.5">
                        {typeof event.title === 'string' ? event.title : 'Untitled Event'}
                      </div>
                      {event.start && (() => {
                        const startDate = event.start instanceof Date ? event.start : new Date(event.start);
                        const endDate = event.end ? (event.end instanceof Date ? event.end : new Date(event.end)) : null;
                        return (
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <span>🕐</span>
                            <span>
                              {format(startDate, 'h:mm a')}
                              {endDate && startDate.getTime() !== endDate.getTime() && (
                                <> – {format(endDate, 'h:mm a')}</>
                              )}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Desktop View */}
      <div className="hidden lg:flex p-8 gap-8">
      {/* Main Calendar */}
      <div className="flex-1">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4">
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
      <div className="w-80 flex flex-col gap-4">
        {/* Mini Month Picker */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-md p-4 mb-2">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setMiniSelectedDate(prev => subMonths(prev, 1))} className="px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-lg font-bold transition text-gray-700 dark:text-gray-300">{'<'}</button>
            <div className="text-center font-semibold text-lg text-gray-900 dark:text-gray-100">{format(miniSelectedDate, 'MMMM yyyy')}</div>
            <button onClick={() => setMiniSelectedDate(prev => addMonths(prev, 1))} className="px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-lg font-bold transition text-gray-700 dark:text-gray-300">{'>'}</button>
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
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-4 relative">
          <div className="max-h-44 overflow-y-auto pr-1">
            <div className="font-semibold mb-2 text-gray-900 dark:text-gray-100">CALENDARS</div>
            {calendarOptions.map((opt, idx) => (
              <div className="flex items-center mb-1" key={opt.value}>
                <input
                  type="checkbox"
                  id={`calendar-checkbox-${opt.value}`}
                  name={`calendar-checkbox-${opt.value}`}
                  checked={selectedCalendars.includes(opt.value)}
                  onChange={() => handleCalendarToggle(opt.value)}
                  className="mr-2"
                />
                <button
                  type="button"
                  ref={el => { colorDotRefs.current[opt.value] = el; }}
                  className="w-3 h-3 rounded-full mr-2 border-2 border-white dark:border-gray-700 shadow focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500"
                  style={{ background: getCalendarColor(opt.value, idx), outline: calendarColors[opt.value] ? '2px solid #2563eb' : 'none' }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setColorWheelOpen(opt.value);
                  }}
                  aria-label={`Pick color for ${opt.label}`}
                  title="Change calendar color"
                />
                <span className="text-gray-900 dark:text-gray-100">{opt.label}</span>
              </div>
            ))}
            {/* Render the color wheel below the calendar list if open */}
            {colorWheelOpen && (
              <div className="flex justify-center mt-4">
                <ColorWheelPicker
                  colors={colorPalette}
                  onSelect={color => {
                    handleCalendarColorChange(colorWheelOpen, color);
                    setColorWheelOpen(null);
                  }}
                  onClose={() => setColorWheelOpen(null)}
                  anchorRef={{ current: colorDotRefs.current[colorWheelOpen] ?? null }}
                />
              </div>
            )}
          </div>
        </div>
        {/* To-Do Panel below calendar list */}
        <div className="max-h-64 overflow-y-auto pr-1">
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
          className="lg:hidden fixed bottom-20 right-3 w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-500 dark:from-blue-500 dark:to-blue-600 text-white rounded-xl shadow-lg hover:shadow-blue-500/50 hover:from-blue-700 hover:to-blue-600 dark:hover:from-blue-600 dark:hover:to-blue-700 active:scale-95 transition-all flex items-center justify-center z-[100] touch-manipulation"
          aria-label="Create event"
          type="button"
        >
          <Plus className="w-5 h-5" strokeWidth={2.5} />
        </button>
      )}

      {/* Calendars Modal (Mobile Only) */}
      {showCalendarsModal && (
        <div className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50" style={{ bottom: '64px' }}>
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 w-full rounded-t-3xl shadow-2xl flex flex-col border-t border-gray-200 dark:border-gray-700" style={{ maxHeight: 'calc(100vh - 64px)' }}>
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-5 py-4 flex items-center justify-between z-10 flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Calendars</h2>
              <button
                onClick={() => setShowCalendarsModal(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-xl w-9 h-9 flex items-center justify-center rounded-full transition-all active:scale-95 touch-manipulation"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <div className="p-5 space-y-3">
                {calendarOptions.map((opt, idx) => (
                  <div className="flex items-center gap-4 min-h-[3rem] p-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors touch-manipulation" key={opt.value}>
                    <input
                      type="checkbox"
                      id={`mobile-calendar-${opt.value}`}
                      checked={selectedCalendars.includes(opt.value)}
                      onChange={() => handleCalendarToggle(opt.value)}
                      className="w-5 h-5 rounded-md border-2 border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                    />
                    <button
                      type="button"
                      ref={el => { colorDotRefs.current[opt.value] = el; }}
                      className="w-5 h-5 rounded-full border-2 border-white dark:border-gray-800 shadow-md flex-shrink-0 ring-2 ring-gray-200 dark:ring-gray-700 hover:ring-gray-300 dark:hover:ring-gray-600 transition-all active:scale-95"
                      style={{ background: getCalendarColor(opt.value, idx) }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setColorWheelOpen(opt.value);
                      }}
                      aria-label={`Pick color for ${opt.label}`}
                    />
                    <label
                      htmlFor={`mobile-calendar-${opt.value}`}
                      className="flex-1 text-gray-900 dark:text-gray-100 cursor-pointer font-medium text-base"
                    >
                      {opt.label}
                    </label>
                  </div>
                ))}
                {colorWheelOpen && (
                  <ColorWheelPicker
                    colors={colorPalette}
                    onSelect={color => {
                      handleCalendarColorChange(colorWheelOpen, color);
                      setColorWheelOpen(null);
                    }}
                    onClose={() => setColorWheelOpen(null)}
                    anchorRef={{ current: colorDotRefs.current[colorWheelOpen] ?? null }}
                    positionRight={true}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change User Modal */}
    </div>
  );
};

export default CalendarPage; 