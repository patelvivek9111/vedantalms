import React, { useState } from 'react';
import { LoadingInline } from '../../../design-system';

interface ImagePreviewProps {
  url: string;
  alt: string;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({ url, alt }) => {
  const [broken, setBroken] = useState(false);

  if (!url.startsWith('blob:') && !url.startsWith('data:')) {
    return <LoadingInline label="Loading image…" />;
  }
  if (broken) {
    return (
      <p className="text-sm text-amber-700 dark:text-amber-300 text-center" role="status">
        Image preview could not be rendered. Use Download to open the file.
      </p>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      className="max-h-[70vh] max-w-full mx-auto object-contain"
      onError={() => setBroken(true)}
    />
  );
};

export default ImagePreview;
