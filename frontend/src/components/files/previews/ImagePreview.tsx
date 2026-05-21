import React from 'react';
import { LoadingInline } from '../../../design-system';

interface ImagePreviewProps {
  url: string;
  alt: string;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({ url, alt }) => {
  if (!url.startsWith('blob:') && !url.startsWith('data:')) {
    return <LoadingInline label="Loading image…" />;
  }
  return <img src={url} alt={alt} className="max-h-[70vh] max-w-full mx-auto object-contain" />;
};

export default ImagePreview;
