import React, { useState } from 'react';
import { LoadingInline } from '../../../design-system';

interface PdfPreviewProps {
  url: string;
  title: string;
}

const PdfPreview: React.FC<PdfPreviewProps> = ({ url, title }) => {
  const [broken, setBroken] = useState(false);

  if (!url.startsWith('blob:') && !url.startsWith('data:')) {
    return <LoadingInline label="Loading PDF…" />;
  }
  if (broken) {
    return (
      <p className="text-sm text-amber-700 dark:text-amber-300 text-center" role="status">
        PDF preview could not be rendered. Use Download to open the file.
      </p>
    );
  }
  return (
    <iframe
      title={title}
      src={url}
      className="w-full h-[70vh] rounded border border-gray-200 dark:border-gray-700 bg-white"
      onError={() => setBroken(true)}
    />
  );
};

export default PdfPreview;
