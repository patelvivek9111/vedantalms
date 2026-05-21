import React from 'react';
import { LoadingInline } from '../../../design-system';

interface MediaPreviewProps {
  url: string;
  kind: 'audio' | 'video';
  title: string;
}

const MediaPreview: React.FC<MediaPreviewProps> = ({ url, kind, title }) => {
  if (!url.startsWith('blob:') && !url.startsWith('data:')) {
    return <LoadingInline label="Loading media…" />;
  }
  if (kind === 'audio') {
    return <audio controls className="w-full" src={url} title={title} />;
  }
  return <video controls className="max-h-[70vh] w-full" src={url} title={title} />;
};

export default MediaPreview;
