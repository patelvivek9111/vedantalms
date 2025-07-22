import React, { useEffect, useState, useRef } from 'react';
// Make sure to run: npm install react-big-calendar date-fns
import { Calendar, dateFnsLocalizer, Event as RBCEvent, SlotInfo, NavigateAction, Views } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { parse, startOfWeek, getDay, format, addMonths, subMonths, getDaysInMonth, startOfMonth, endOfMonth, isSameMonth, isSameDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import { useCourse } from '../contexts/CourseContext';
import api from '../services/api';
import { ToDoPanel } from './ToDoPanel';
import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';

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
    return (
      (eventStart.getTime() < eEnd.getTime() && eventEnd.getTime() > eStart.getTime()) ||
      (eStart.getTime() < eventEnd.getTime() && eEnd.getTime() > eventStart.getTime())
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
    // Same day, and overlap
    return (
      eStart.toDateString() === start.toDateString() &&
      ((start.getTime() < eEnd.getTime() && end.getTime() > eStart.getTime()) ||
        (eStart.getTime() < end.getTime() && eEnd.getTime() > start.getTime()))
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
  return (
    <div
      className={`relative px-1 py-0.5 rounded h-full flex flex-col justify-center shadow-sm transition-all duration-150 ${overlappingEvents.length > 1 ? 'border-l-4 border-pink-400 shadow' : 'border-l-4 border-transparent'} hover:ring-2 hover:ring-blue-400 ${isAssignment ? 'font-bold border-l-4 border-yellow-400' : ''}`}
      style={{ background: color, color: '#222', minHeight: 28, fontSize: 13, cursor: 'pointer' }}
      title={String(tooltip)}
    >
      <div className="flex items-center gap-1">
        {isAssignment && <FileText className="w-3 h-3 mr-1" />}
        <span className="font-semibold truncate" style={{ maxWidth: 80 }}>{title}</span>
      </div>
      {start && end && (
        isAssignment && start.getTime() === end.getTime() ? (
          <span className="text-xs text-gray-700">Due: {format(start, 'h:mm a')}</span>
        ) : start.getTime() === end.getTime() ? (
          <span className="text-xs text-gray-700">{format(start, 'h:mm a')}</span>
        ) : (event.allDay ? (
          <span className="text-xs text-gray-700">All Day</span>
        ) : (
          <span className="text-xs text-gray-700">{format(start, 'h:mm a')} – {format(end, 'h:mm a')}</span>
        ))
      )}
      {/* Show +N more only on the second overlapping event in the cell (month view only) */}
      {isSecondOverlap && (
        <span className="absolute bottom-0 right-1 text-xs text-blue-700 bg-white bg-opacity-80 rounded px-1">+{overlappingEvents.length - 1} more</span>
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
}> = ({ colors, onSelect, onClose, anchorRef }) => {
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
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, anchorRef]);

  // Position the wheel near the anchor
  const [style, setStyle] = useState<React.CSSProperties>({});
  useEffect(() => {
    if (anchorRef.current && pickerRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setStyle({
        position: 'absolute',
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX - 40,
        zIndex: 1000,
      });
    }
  }, [anchorRef]);

  // Arrange colors in a wheel
  const radius = 48;
  const center = 56;
  const angleStep = (2 * Math.PI) / colors.length;

  return (
    <div ref={pickerRef} style={style} className="bg-white rounded-full shadow-lg p-2 border border-gray-200" >
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
              r={14}
              fill={color}
              stroke="#fff"
              strokeWidth={2}
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
  const { user } = useAuth();
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
  const [calendarColors, setCalendarColors] = useState<Record<string, string>>({});
  // For color wheel popover
  const [colorWheelOpen, setColorWheelOpen] = useState<string | null>(null); // calendarId or null
  const colorDotRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const navigate = useNavigate();

  // Only show for teachers/admins
  const isTeacherOrAdmin = user && (user.role === 'teacher' || user.role === 'admin');

  // Build calendar options: teacher's name, then all their courses
  const calendarOptions = user ? [
    { label: `${user.firstName} ${user.lastName}`, value: user._id },
    ...courses.map((course: any) => ({ label: course.title, value: course._id, course }))
  ] : [];

  // Update: Multi-calendar selection logic
  const handleCalendarToggle = (calendarId: string) => {
    setSelectedCalendars(prev =>
      prev.includes(calendarId)
        ? prev.filter(id => id !== calendarId)
        : [...prev, calendarId]
    );
  };

  // Helper to get a calendar's color, fallback to palette or blue/green
  const getCalendarColor = (calendarId: string, idx: number) =>
    calendarColors[calendarId] || colorPalette[idx % colorPalette.length] || '#60a5fa';

  // Handler to change a calendar's color
  const handleCalendarColorChange = (calendarId: string, color: string) => {
    setCalendarColors(prev => ({ ...prev, [calendarId]: color }));
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
          allEvents.push(...data
            .filter((event: any) => event.calendar === user._id)
            .map((event: any) => ({
              ...event,
              start: new Date(event.start),
              end: new Date(event.end),
              title: event.title,
              allDay: false,
              resource: event,
            })));
        } catch (error) {
          console.error('Error fetching personal events:', error);
        }
        continue;
      }
      // Else, course calendar: fetch events for course and assignments as events
      try {
        const res = await api.get('/events?calendar=' + calId);
        const data = res.data.data || res.data; // Handle both new and old response formats
        let courseEvents = data
          .filter((event: any) => event.calendar === calId)
          .map((event: any) => ({
            ...event,
            start: new Date(event.start),
            end: new Date(event.end),
            title: event.title,
            allDay: false,
            resource: event,
          }));
        
        // Fetch assignments for all modules in this course
        let assignmentEvents: RBCEvent[] = [];
        
        console.log(`[Calendar] Fetching assignments for course: ${calId}`);
        
        try {
          const courseObj = courses.find((c: any) => c._id === calId);
          if (courseObj && Array.isArray((courseObj as any).modules)) {
            for (const module of (courseObj as any).modules) {
              try {
                const response = await api.get(`/assignments/module/${module._id}`);
                const assignments = response.data;
                console.log(`[Calendar] Found ${assignments.length} assignments in module ${module._id}:`, assignments.map((a: any) => ({ id: a._id, title: a.title, dueDate: a.dueDate })));
                
                assignments.forEach((a: any) => {
                  // Only add if we haven't seen this assignment before globally
                  if (!globalSeenAssignmentIds.has(a._id)) {
                    globalSeenAssignmentIds.add(a._id);
                    console.log(`[Calendar] Adding assignment: ${a.title} (${a._id}) due on ${a.dueDate}`);
                    assignmentEvents.push({
                      _id: a._id,
                      title: a.title,
                      start: new Date(a.dueDate),
                      end: new Date(a.dueDate),
                      type: 'Assignment',
                      color: getCalendarColor(calId, idx),
                      allDay: false,
                      resource: { ...a, readOnly: true, courseId: calId },
                    } as RBCEvent);
                  } else {
                    console.log(`[Calendar] Skipping duplicate assignment: ${a.title} (${a._id})`);
                  }
                });
              } catch (error) {
                console.error(`Error fetching assignments for module ${module._id}:`, error);
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
                    console.log(`[Calendar] Found ${assignments.length} assignments in module ${module._id}:`, assignments.map((a: any) => ({ id: a._id, title: a.title, dueDate: a.dueDate })));
                    
                    assignments.forEach((a: any) => {
                      // Only add if we haven't seen this assignment before globally
                      if (!globalSeenAssignmentIds.has(a._id)) {
                        globalSeenAssignmentIds.add(a._id);
                        console.log(`[Calendar] Adding assignment: ${a.title} (${a._id}) due on ${a.dueDate}`);
                        assignmentEvents.push({
                          _id: a._id,
                          title: a.title,
                          start: new Date(a.dueDate),
                          end: new Date(a.dueDate),
                          type: 'Assignment',
                          color: getCalendarColor(calId, idx),
                          allDay: false,
                          resource: { ...a, readOnly: true, courseId: calId },
                        } as RBCEvent);
                      } else {
                        console.log(`[Calendar] Skipping duplicate assignment: ${a.title} (${a._id})`);
                      }
                    });
                  } catch (error) {
                    console.error(`Error fetching assignments for module ${module._id}:`, error);
                  }
                }
              }
            } catch (error) {
              console.error(`Error fetching modules for course ${calId}:`, error);
            }
          }
        } catch (e) {
          console.error('Error processing assignments:', e);
        }
        
        console.log(`[Calendar] Final assignment events for course ${calId}:`, assignmentEvents.map(e => ({ id: (e as any)._id, title: e.title, start: e.start })));
        allEvents.push(...courseEvents, ...assignmentEvents);
      } catch (error) {
        console.error(`Error fetching course events for ${calId}:`, error);
      }
    }
    setEvents(allEvents);
  };

  useEffect(() => {
    if (selectedCalendars.length) {
      fetchEvents();
    }
  }, [selectedCalendars]);

  // On mount, select teacher calendar by default
  useEffect(() => {
    if (user && selectedCalendars.length === 0 && calendarOptions.length > 0) {
      setSelectedCalendars(calendarOptions.map(opt => opt.value));
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
    console.log('Event clicked:', event); // DEBUG: Log event object
    console.log('Current user:', user); // DEBUG: Log current user
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
    console.log('Setting editing event:', editingEventData); // DEBUG: Log editing event data
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
      console.error('Error saving event:', error);
      // You might want to show an error message to the user here
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (editingEvent && editingEvent._id) {
      try {
        console.log('Attempting to delete event:', editingEvent._id);
        // Check if the event is an assignment
        const type = editingEvent.type || (editingEvent as any).type;
        const isAssignment = typeof type === 'string' && type.toLowerCase() === 'assignment';
        if (isAssignment) {
          await api.delete(`/assignments/${editingEvent._id}`);
        } else {
          await api.delete(`/events/${editingEvent._id}`);
        }
        console.log('Event deleted successfully');
        setModalOpen(false);
        setEditingEvent(null);
        fetchEvents();
      } catch (error: any) {
        console.error('Error deleting event:', error);
        console.error('Error response:', error.response?.data);
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
        <button type="button" className="rbc-btn px-3 py-1 rounded-lg bg-gray-100 hover:bg-blue-100 active:bg-blue-200 transition" onClick={() => toolbarProps.onNavigate('TODAY')}>Today</button>
        <button type="button" className="rbc-btn px-3 py-1 rounded-lg bg-gray-100 hover:bg-blue-100 active:bg-blue-200 transition" onClick={() => toolbarProps.onNavigate('PREV')}>Back</button>
        <button type="button" className="rbc-btn px-3 py-1 rounded-lg bg-gray-100 hover:bg-blue-100 active:bg-blue-200 transition" onClick={() => toolbarProps.onNavigate('NEXT')}>Next</button>
      </div>
      <span className="rbc-toolbar-label text-lg font-semibold">{toolbarProps.label}</span>
      <div className="flex gap-2 items-center">
        {['month', 'week', 'day', 'agenda'].map(view => (
          <button
            key={view}
            type="button"
            className={`px-3 py-1 rounded-lg transition font-medium capitalize ${toolbarProps.view === view ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 hover:bg-blue-100 active:bg-blue-200 text-gray-700'}`}
            onClick={() => toolbarProps.onView(view)}
          >
            {view.charAt(0).toUpperCase() + view.slice(1)}
          </button>
        ))}
        <button
          type="button"
          className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xl ml-2 shadow hover:bg-blue-700 transition"
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
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm z-50">
        <form
          className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-lg"
          onSubmit={handleLocalSubmit}
          style={{ minWidth: 400 }}
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">{isEdit ? 'Edit Event' : 'Create Event'}</h2>
            <button type="button" className="text-gray-400 hover:text-gray-700 text-2xl" onClick={() => { setModalOpen(false); setEditingEvent(null); }}>&times;</button>
          </div>
          <div className="flex border-b mb-4">
            {eventTypes.map(tab => (
              <button
                key={tab.value}
                type="button"
                className={`px-4 py-2 font-semibold ${activeTab === tab.value ? 'border-b-4 border-purple-600 text-purple-700' : 'text-gray-500'}`}
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
          <div className="mb-3">
            <label htmlFor="event-title" className="block text-sm font-medium mb-1">Title:</label>
            <input
              id="event-title"
              name="title"
              className="border p-2 w-full rounded"
              placeholder="Enter event title"
              type="text"
              value={localTitle}
              onChange={e => setLocalTitle(e.target.value)}
              required
            />
          </div>
          {activeTab !== 'My To Do' && (
            <div className="mb-3">
              <label htmlFor="event-color" className="block text-sm font-medium mb-1">Color:</label>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  id="event-color"
                  name="color"
                  type="color"
                  className="w-10 h-10 p-0 border-none bg-transparent cursor-pointer"
                  value={localColor}
                  onChange={e => { setLocalColor(e.target.value); setColorManuallySet(true); }}
                  style={{ background: 'none' }}
                />
                <button
                  type="button"
                  className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
                  onClick={() => {
                    const randomColor = colorPalette[Math.floor(Math.random() * colorPalette.length)];
                    setLocalColor(randomColor);
                    setColorManuallySet(true);
                  }}
                >
                  Random
                </button>
                {/* Palette for event color */}
                {colorPalette.map((color, i) => (
                  <button
                    key={color + '-' + i}
                    type="button"
                    className="w-6 h-6 rounded-full border-2 border-white shadow mx-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    style={{ background: color, outline: localColor === color ? '2px solid #2563eb' : 'none' }}
                    onClick={() => { setLocalColor(color); setColorManuallySet(true); }}
                    aria-label={`Pick color ${color}`}
                  />
                ))}
              </div>
            </div>
          )}
          <div className="mb-3">
            <label htmlFor="event-date" className="block text-sm font-medium mb-1">Date:</label>
            <input
              id="event-date"
              name="date"
              className="border p-2 w-full rounded"
              type="date"
              value={localDate}
              onChange={e => setLocalDate(e.target.value)}
              required
            />
          </div>
          {activeTab !== 'My To Do' && (
            <div className="flex gap-2 mb-3">
              <div className="flex-1">
                <label htmlFor="event-time-from" className="block text-sm font-medium mb-1">From:</label>
                <select
                  id="event-time-from"
                  name="startTime"
                  className="border p-2 w-full rounded"
                  value={localStartTime}
                  onChange={e => setLocalStartTime(e.target.value)}
                  required
                >
                  {timeOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label htmlFor="event-time-to" className="block text-sm font-medium mb-1">To:</label>
                <select
                  id="event-time-to"
                  name="endTime"
                  className="border p-2 w-full rounded"
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
          )}
          {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
          {activeTab !== 'My To Do' && (
            <div className="mb-3">
              <label htmlFor="event-location" className="block text-sm font-medium mb-1">Location:</label>
              <input
                id="event-location"
                name="location"
                className="border p-2 w-full rounded"
                placeholder="Location"
                type="text"
                value={localLocation}
                onChange={e => setLocalLocation(e.target.value)}
              />
            </div>
          )}
          {activeTab !== 'My To Do' && (
            isTeacherOrAdmin ? (
              <div className="mb-3">
                <label htmlFor="event-calendar" className="block text-sm font-medium mb-1">Calendar:</label>
                <select
                  id="event-calendar"
                  name="calendar"
                  className="border p-2 w-full rounded"
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
            ) : null
          )}
          <div className="flex justify-between mt-6">
            <button type="button" className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300">More Options</button>
            <div className="flex gap-2">
              {(() => {
                const canDelete = isEdit && (isTeacherOrAdmin || (user && editingEvent?.calendar === user._id));
                console.log('Delete button visibility check:', {
                  isEdit,
                  isTeacherOrAdmin,
                  userRole: user?.role,
                  userCalendar: user?._id,
                  eventCalendar: editingEvent?.calendar,
                  canDelete
                });
                return canDelete ? (
                  <button
                    type="button"
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
                    onClick={handleDelete}
                  >
                    Delete
                  </button>
                ) : null;
              })()}
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Submit</button>
            </div>
          </div>
        </form>
      </div>
    );
  };

  // Before rendering Calendar, set all events globally for overlap detection
  (window as any).allCalendarEvents = events;
  return (
    <div className="flex p-8 gap-8">
      {/* Main Calendar */}
      <div className="flex-1">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 600, borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}
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
      {/* Right Panel */}
      <div className="w-80 flex flex-col gap-4">
        {/* Mini Month Picker */}
        <div className="bg-white border rounded-xl shadow-md p-4 mb-2">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setMiniSelectedDate(prev => subMonths(prev, 1))} className="px-2 py-1 rounded-full bg-gray-100 hover:bg-blue-100 text-lg font-bold transition">{'<'}</button>
            <div className="text-center font-semibold text-lg">{format(miniSelectedDate, 'MMMM yyyy')}</div>
            <button onClick={() => setMiniSelectedDate(prev => addMonths(prev, 1))} className="px-2 py-1 rounded-full bg-gray-100 hover:bg-blue-100 text-lg font-bold transition">{'>'}</button>
          </div>
          <table className="w-full text-xs select-none">
            <thead>
              <tr>
                <th className="font-semibold text-gray-500">Su</th><th className="font-semibold text-gray-500">Mo</th><th className="font-semibold text-gray-500">Tu</th><th className="font-semibold text-gray-500">We</th><th className="font-semibold text-gray-500">Th</th><th className="font-semibold text-gray-500">Fr</th><th className="font-semibold text-gray-500">Sa</th>
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
                            ? `cursor-pointer rounded-full w-8 h-8 text-center align-middle transition ${isSameDay(date, miniSelectedDate) ? 'bg-blue-200 text-blue-900 font-bold shadow' : 'hover:bg-blue-100 hover:text-blue-700'}`
                            : 'text-gray-300'
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
        <div className="bg-white border rounded p-4 relative">
          <div className="max-h-44 overflow-y-auto pr-1">
            <div className="font-semibold mb-2">CALENDARS</div>
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
                  ref={el => (colorDotRefs.current[opt.value] = el)}
                  className="w-3 h-3 rounded-full mr-2 border-2 border-white shadow focus:outline-none focus:ring-2 focus:ring-blue-400"
                  style={{ background: getCalendarColor(opt.value, idx), outline: calendarColors[opt.value] ? '2px solid #2563eb' : 'none' }}
                  onClick={() => setColorWheelOpen(opt.value)}
                  aria-label={`Pick color for ${opt.label}`}
                  title="Change calendar color"
                />
                <span>{opt.label}</span>
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
                  anchorRef={{ current: null }}
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
      {/* Modal for create/edit */}
      {modalOpen && editingEvent && user && (
        <EventModal isEdit={!!editingEvent._id} />
      )}
    </div>
  );
};

export default CalendarPage; 