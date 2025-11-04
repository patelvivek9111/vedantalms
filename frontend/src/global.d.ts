/// <reference types="vite/client" />

declare module 'react-big-calendar' {
  export interface Event {
    title: string;
    start?: Date | string;
    end?: Date | string;
    resource?: any;
    allDay?: boolean;
  }
  export interface CalendarProps {
    localizer: any;
    events: Event[];
    startAccessor: string | ((event: Event) => Date);
    endAccessor: string | ((event: Event) => Date);
    style?: React.CSSProperties;
    onSelectEvent?: (event: Event) => void;
    onSelectSlot?: (slotInfo: any) => void;
    defaultDate?: Date;
    defaultView?: string;
    views?: any;
    components?: any;
    eventPropGetter?: (event: Event) => any;
    dayPropGetter?: (date: Date) => any;
    slotPropGetter?: (date: Date) => any;
    popup?: boolean;
    selectable?: boolean;
    onNavigate?: (date: Date, view: string, action: NavigateAction) => void;
    onView?: (view: string) => void;
    view?: string;
    date?: Date;
    [key: string]: any; // Allow any additional props
  }
  export class Calendar extends React.Component<CalendarProps> {}
  export function dateFnsLocalizer(config: any): any;
  export type NavigateAction = 'PREV' | 'NEXT' | 'TODAY' | 'DATE';
  export type Views = 'month' | 'week' | 'day' | 'agenda';
  export interface SlotInfo {
    start: Date;
    end: Date;
    slots: Date[];
    action: NavigateAction;
  }
  export type Event = Event;
} 