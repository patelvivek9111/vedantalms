import React, { useEffect, useRef } from 'react';

interface ScreenReaderAnnouncementProps {
  message: string;
  priority?: 'polite' | 'assertive';
  id?: string;
}

/**
 * Component for announcing dynamic content changes to screen readers
 * Usage: <ScreenReaderAnnouncement message="Course deleted successfully" />
 */
const ScreenReaderAnnouncement: React.FC<ScreenReaderAnnouncementProps> = ({
  message,
  priority = 'polite',
  id = 'screen-reader-announcement'
}) => {
  const announcementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (message && announcementRef.current) {
      // Force screen reader to read the announcement
      announcementRef.current.textContent = message;
    }
  }, [message]);

  return (
    <div
      id={id}
      ref={announcementRef}
      role="status"
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
};

export default ScreenReaderAnnouncement;


