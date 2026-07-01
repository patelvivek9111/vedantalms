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
    <div className="flex h-full min-h-0 flex-1 flex-col bg-white dark:bg-gray-800">
      <header className="shrink-0 border-b border-gray-100 bg-white/95 backdrop-blur-sm safe-area-inset-top dark:border-gray-700/80 dark:bg-gray-800/95 lg:rounded-t-2xl">
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

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 sm:px-4 lg:px-6">
        {messagesLoading && (
          <div className="py-4 text-xs text-gray-600 dark:text-gray-400 sm:text-sm">
            Loading messages...
          </div>
        )}
        {messagesError && (
          <div className="py-4 text-xs text-red-500 dark:text-red-400 sm:text-sm">{messagesError}</div>
        )}
        {!messagesLoading && !messagesError && messages.length === 0 && (
          <div className="py-4 text-xs text-gray-400 dark:text-gray-500 sm:text-sm">No messages yet.</div>
        )}
        <div className="pb-4 sm:pb-6">
          {messages.map((msg, index) => {
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
                className={`py-4 sm:py-6 ${index > 0 ? 'border-t border-gray-200 dark:border-gray-700' : ''}`}
              >
                <div className="mb-3 flex items-start justify-between gap-2 sm:mb-4">
                  <div className="flex min-w-0 flex-1 items-center space-x-2 sm:space-x-3">
                    <div className="relative shrink-0">
                      <div
                        className={`flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white sm:h-10 sm:w-10 sm:text-lg ${getAvatarColor(msg.senderId?._id)} ${isUserOnline(msg.senderId?._id) ? 'online-pulse' : 'border-2 border-transparent'}`}
                      >
                        {msg.senderId?.profilePicture ? (
                          <img
                            src={
                              msg.senderId.profilePicture.startsWith('http')
                                ? msg.senderId.profilePicture
                                : getImageUrl(msg.senderId.profilePicture)
                            }
                            alt={senderName}
                            className="h-8 w-8 rounded-full object-cover sm:h-10 sm:w-10"
                          />
                        ) : (
                          getInitials(msg.senderId)
                        )}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100 sm:text-base">
                        {senderName || 'Unknown User'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
                        {capitalizeFirst(
                          format(new Date(msg.createdAt), "MMM d, yyyy 'at' h:mmaaa")
                        )}
                      </div>
                    </div>
                  </div>
                  {isMe && (
                    <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-400 dark:bg-gray-700 dark:text-gray-500 sm:px-2 sm:py-1 sm:text-xs">
                      Sent
                    </span>
                  )}
                </div>
                <div className="pl-0 sm:pl-13">
                  <div
                    className="prose prose-sm max-w-none break-words text-xs leading-relaxed text-gray-900 dark:text-gray-100 sm:text-sm"
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
        <footer className="shrink-0 border-t border-gray-200 bg-white safe-area-inset-bottom dark:border-gray-700 dark:bg-gray-800">
          <form className="flex flex-col gap-2 px-3 py-3 sm:px-4 lg:px-6" onSubmit={onSendReply}>
            <label htmlFor="reply-message" className="sr-only">
              Reply
            </label>
            <RichTextEditor
              id="reply-message"
              content={reply}
              onChange={onReplyChange}
              placeholder="Type your reply..."
              className="min-h-[100px] flex-1 rounded border border-gray-200 bg-white p-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 sm:min-h-[120px] sm:text-base"
            />
            <FileAttachmentPanel
              files={replyAttachments}
              onChange={onReplyAttachmentsChange}
              category="temporary"
              label="Attach files to reply"
              accept="image/*,application/pdf,.doc,.docx"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                className="touch-manipulation rounded bg-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 sm:px-4 sm:py-2 sm:text-sm"
                onClick={onHideReply}
                disabled={sending}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="touch-manipulation rounded bg-blue-600 px-3 py-1.5 text-xs text-white shadow disabled:opacity-50 sm:px-4 sm:py-2 sm:text-sm"
                disabled={sending || !reply.trim()}
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
            {sendError && (
              <div className="text-xs text-red-500 dark:text-red-400 sm:text-sm">{sendError}</div>
            )}
          </form>
        </footer>
      ) : (
        <footer className="shrink-0 border-t border-gray-200 bg-white safe-area-inset-bottom dark:border-gray-700 dark:bg-gray-800 lg:pb-2">
          <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3 lg:px-6">
            {restoreAction && (
              <button
                type="button"
                onClick={restoreAction.onRestore}
                disabled={restoreAction.loading}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 touch-manipulation dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 sm:flex-none sm:px-4"
              >
                <ArchiveRestore className="h-4 w-4 shrink-0" />
                {restoreAction.loading ? `${restoreAction.label}…` : restoreAction.label}
              </button>
            )}
            <button
              type="button"
              onClick={onForward}
              disabled={!canForward}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 sm:flex-none sm:px-4"
            >
              <Forward className="h-4 w-4 shrink-0" />
              Forward
            </button>
            <button
              type="button"
              onClick={onShowReply}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-medium text-blue-700 shadow-sm hover:bg-blue-100 touch-manipulation dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950 sm:flex-none sm:px-4"
            >
              <Reply className="h-4 w-4 shrink-0" />
              Reply
            </button>
          </div>
        </footer>
      )}
    </div>
  );
};

export default MessageThread;
