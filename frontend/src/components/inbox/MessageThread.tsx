import React from 'react';
import { format } from 'date-fns';
import { ChevronLeft, Reply, Forward, ArchiveRestore } from 'lucide-react';
import { getImageUrl } from '../../services/api';
import RichTextEditor from '../common/RichTextEditor';
import FileAttachmentPanel from '../files/FileAttachmentPanel';
import MessageAttachments from './MessageAttachments';
import { messageHtmlForRender } from '../../utils/messageSanitizer';
import type { NormalizedFile } from '../../utils/fileTypes';
import {
  capitalizeFirst,
  getInitials,
  getAvatarColor,
  parseThreadSubject,
  getOtherParticipantNames,
} from './inboxUtils';

type MessageThreadProps = {
  conversation: any;
  messages: any[];
  messagesLoading: boolean;
  messagesError: string | null;
  currentUserId: string;
  showReplyBox: boolean;
  reply: string;
  replyAttachments: NormalizedFile[];
  sending: boolean;
  sendError: string | null;
  isUserOnline: (userId: string) => boolean;
  onBack: () => void;
  onShowReply: () => void;
  onHideReply: () => void;
  onForward: () => void;
  canForward: boolean;
  onReplyChange: (value: string) => void;
  onReplyAttachmentsChange: (files: NormalizedFile[]) => void;
  onSendReply: (e: React.FormEvent) => void;
  restoreAction?: {
    label: string;
    loading?: boolean;
    onRestore: () => void;
  };
};

const MessageThread: React.FC<MessageThreadProps> = ({
  conversation,
  messages,
  messagesLoading,
  messagesError,
  currentUserId,
  showReplyBox,
  reply,
  replyAttachments,
  sending,
  sendError,
  isUserOnline,
  onBack,
  onShowReply,
  onHideReply,
  onForward,
  canForward,
  onReplyChange,
  onReplyAttachmentsChange,
  onSendReply,
  restoreAction,
}) => {
  const { context: subjectContext, title: subjectTitle } = parseThreadSubject(
    conversation.subject || ''
  );
  const participantNames = getOtherParticipantNames(conversation, currentUserId);

  return (
  <div className="flex h-full min-h-0 flex-1 flex-col bg-white p-0 dark:bg-gray-800">
    <div className="flex flex-col h-full">
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 backdrop-blur-sm safe-area-inset-top dark:border-gray-700/80 dark:bg-gray-800/95 lg:rounded-t-2xl">
        <div className="flex items-center gap-1 px-2 py-2.5 sm:gap-2 sm:px-4 sm:py-3 lg:px-6 lg:py-4">
          <button
            type="button"
            onClick={onBack}
            className="icon-only lg:hidden flex h-9 w-9 shrink-0 items-center justify-center rounded-full p-0 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 touch-manipulation dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            aria-label="Back to conversations"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            {subjectContext && (
              <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {subjectContext}
              </p>
            )}
            <h1 className="truncate text-[15px] font-semibold leading-snug tracking-tight text-slate-900 dark:text-slate-50 sm:text-base lg:text-lg">
              {subjectTitle}
            </h1>
            {participantNames && (
              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                {participantNames}
              </p>
            )}
          </div>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 lg:px-6 pb-4 sm:pb-6">
        {messagesLoading && (
          <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 py-4">Loading messages...</div>
        )}
        {messagesError && (
          <div className="text-xs sm:text-sm text-red-500 dark:text-red-400 py-4">{messagesError}</div>
        )}
        {!messagesLoading && !messagesError && messages.length === 0 && (
          <div className="text-xs sm:text-sm text-gray-400 dark:text-gray-500 py-4">No messages yet.</div>
        )}
        <div className="space-y-4 sm:space-y-6 mb-4 sm:mb-6">
          {messages.map((msg) => {
            const hasName =
              (msg.senderId?.firstName && msg.senderId?.firstName.trim()) ||
              (msg.senderId?.lastName && msg.senderId?.lastName.trim());
            const senderName = hasName
              ? `${msg.senderId?.firstName || ''} ${msg.senderId?.lastName || ''}`.trim()
              : msg.senderId?.email || 'Unknown User';
            const isMe = msg.senderId?._id === currentUserId;

            return (
              <div
                key={msg._id}
                className="border-b border-gray-200 dark:border-gray-700 pb-4 sm:pb-6 last:border-b-0"
              >
                <div className="flex items-start justify-between mb-3 sm:mb-4 gap-2">
                  <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                    <div className="relative flex-shrink-0">
                      <div
                        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-lg overflow-hidden ${getAvatarColor(msg.senderId?._id)} ${isUserOnline(msg.senderId?._id) ? 'online-pulse' : 'border-2 border-transparent'}`}
                      >
                        {msg.senderId?.profilePicture ? (
                          <img
                            src={
                              msg.senderId.profilePicture.startsWith('http')
                                ? msg.senderId.profilePicture
                                : getImageUrl(msg.senderId.profilePicture)
                            }
                            alt={senderName}
                            className="w-8 h-8 sm:w-10 sm:h-10 object-cover rounded-full"
                          />
                        ) : (
                          getInitials(msg.senderId)
                        )}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-100 truncate">
                        {senderName || 'Unknown User'}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {capitalizeFirst(
                          format(new Date(msg.createdAt), "MMM d, yyyy 'at' h:mmaaa")
                        )}
                      </div>
                    </div>
                  </div>
                  {isMe && (
                    <span className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded flex-shrink-0">
                      Sent
                    </span>
                  )}
                </div>
                <div className="pl-0 sm:pl-13">
                  <div
                    className="text-xs sm:text-sm text-gray-900 dark:text-gray-100 break-words leading-relaxed prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: messageHtmlForRender(msg) }}
                  />
                  <MessageAttachments
                    fileAssetIds={msg.fileAssetIds}
                    attachments={msg.attachments}
                    className="mt-2"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {showReplyBox ? (
        <form
          className="flex flex-col gap-2 mt-2 px-3 sm:px-4 lg:px-6 pb-3 sm:pb-4 lg:pb-6"
          onSubmit={onSendReply}
        >
          <label htmlFor="reply-message" className="sr-only">
            Reply
          </label>
          <RichTextEditor
            id="reply-message"
            content={reply}
            onChange={onReplyChange}
            placeholder="Type your reply..."
            className="flex-1 border border-gray-200 dark:border-gray-700 rounded p-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm sm:text-base min-h-[100px] sm:min-h-[120px]"
          />
          <FileAttachmentPanel
            files={replyAttachments}
            onChange={onReplyAttachmentsChange}
            category="temporary"
            label="Attach files to reply"
            accept="image/*,application/pdf,.doc,.docx"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 text-xs sm:text-sm touch-manipulation"
              onClick={onHideReply}
              disabled={sending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded disabled:opacity-50 shadow text-xs sm:text-sm touch-manipulation"
              disabled={sending || !reply.trim()}
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex justify-end gap-2 px-3 pb-3 sm:px-4 sm:pb-4 lg:px-6 lg:pb-6">
          {restoreAction && (
            <button
              type="button"
              onClick={restoreAction.onRestore}
              disabled={restoreAction.loading}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 touch-manipulation sm:px-4 sm:py-2 sm:text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:focus:ring-blue-400"
            >
              <ArchiveRestore className="mr-1.5 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
              {restoreAction.loading ? `${restoreAction.label}…` : restoreAction.label}
            </button>
          )}
          <button
            type="button"
            onClick={onForward}
            disabled={!canForward}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 touch-manipulation disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:py-2 sm:text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:focus:ring-blue-400"
          >
            <Forward className="mr-1.5 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
            Forward
          </button>
          <button
            type="button"
            onClick={onShowReply}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 touch-manipulation sm:px-4 sm:py-2 sm:text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:focus:ring-blue-400"
          >
            <Reply className="mr-1.5 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
            Reply
          </button>
        </div>
      )}
      {sendError && (
        <div className="text-red-500 dark:text-red-400 mt-2 px-3 sm:px-4 lg:px-6 text-xs sm:text-sm">
          {sendError}
        </div>
      )}
    </div>
  </div>
  );
};

export default MessageThread;
