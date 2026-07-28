import React, { useEffect, useState } from 'react';
import { LoadingInline } from '../../../design-system';

interface PdfPreviewProps {
  url: string;
  title: string;
}

const PdfPreview: React.FC<PdfPreviewProps> = ({ url, title }) => {
  const [broken, setBroken] = useState(false);
  const canEmbed = url.startsWith('blob:') || url.startsWith('data:');
  // Hide Chrome PDF toolbar so its Download button doesn't save the blob UUID name.
  const embedSrc = canEmbed ? `${url}#toolbar=0&navpanes=0` : url;

  useEffect(() => {
    setBroken(false);
  }, [url]);

  if (!canEmbed) {
    return <LoadingInline label="Loading PDF…" />;
  }
  if (broken) {
    return (
      <div className="space-y-2 text-center">
        <p className="text-sm text-amber-700 dark:text-amber-300" role="status">
          PDF preview could not be rendered in the panel.
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-indigo-600 underline"
        >
          Open in new tab
        </a>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <iframe
        key={url}
        title={title}
        src={embedSrc}
        className="w-full h-[min(70vh,800px)] min-h-[320px] rounded border border-gray-200 dark:border-gray-700 bg-white"
        onError={() => setBroken(true)}
      />
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
        Blank preview?{' '}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 underline"
        >
          Open in new tab
        </a>
      </p>
    </div>
  );
};

export default PdfPreview;
