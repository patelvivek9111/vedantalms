import React from 'react';
import { LoadingInline } from '../../../design-system';

interface PdfPreviewProps {
  url: string;
  title: string;
}

const PdfPreview: React.FC<PdfPreviewProps> = ({ url, title }) => {
  if (!url.startsWith('blob:') && !url.startsWith('data:')) {
    return <LoadingInline label="Loading PDF…" />;
  }
  return (
    <iframe
      title={title}
      src={url}
      className="w-full h-[70vh] rounded border border-gray-200 dark:border-gray-700 bg-white"
    />
  );
};

export default PdfPreview;
