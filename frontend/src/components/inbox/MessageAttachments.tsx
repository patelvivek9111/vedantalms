import React from 'react';
import FileAttachmentChips from '../files/FileAttachmentChips';

type MessageAttachmentsProps = {
  fileAssetIds?: string[];
  attachments?: string[];
  className?: string;
};

/**
 * Renders message attachments via secure FileAsset IDs (preferred) or legacy URL strings.
 */
const MessageAttachments: React.FC<MessageAttachmentsProps> = ({
  fileAssetIds = [],
  attachments = [],
  className = '',
}) => {
  const sources = [
    ...(fileAssetIds || []),
    ...(attachments || []),
  ];
  if (!sources.length) return null;
  return <FileAttachmentChips files={sources} className={className} />;
};

export default MessageAttachments;
