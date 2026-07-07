import React from 'react';
import DOMPurify from 'dompurify';

interface SanitizedHtmlProps {
  html: string;
  className?: string;
}

/**
 * Renders trusted HTML through DOMPurify before injection.
 * Centralizes dangerouslySetInnerHTML so security scanners can audit one place.
 */
const SanitizedHtml: React.FC<SanitizedHtmlProps> = ({ html, className }) => {
  const safeHtml = DOMPurify.sanitize(html || '', { USE_PROFILES: { html: true } });
  // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
  return <div className={className} dangerouslySetInnerHTML={{ __html: safeHtml }} />;
};

export default SanitizedHtml;
