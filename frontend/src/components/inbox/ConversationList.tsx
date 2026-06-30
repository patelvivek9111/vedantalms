import React from 'react';
import { format } from 'date-fns';
import { Star } from 'lucide-react';
import { getImageUrl } from '../../services/api';
import {
  getInitials,
  getAvatarColor,
  groupConversationsByDate,
  formatDateHeader,
  formatMessagePreview,
} from './inboxUtils';

type ConversationListProps = {
  conversations: any[];
  filteredConversations: any[];
  loading: boolean;
  error: string | null;
  currentUserId: string;
  selectedConversationId?: string;
  selectedConversations: string[];
  bulkActionLoading: boolean;
  isUserOnline: (userId: string) => boolean;
  onSelectConversation: (conv: any) => void;
  onToggleStar: (conv: any) => void;
  onSelectionChange: (ids: string[]) => void;
};

const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  filteredConversations,
  loading,
  error,
  currentUserId,
  selectedConversationId,
  selectedConversations,
  bulkActionLoading,
  isUserOnline,
  onSelectConversation,
  onToggleStar,
  onSelectionChange,
}) => {
  const grouped = groupConversationsByDate(filteredConversations);
  const dateKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
  const hiddenOnMobile = Boolean(selectedConversationId);
  const selectionActive = selectedConversations.length > 0;

  return (
    <div
      className={`mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col lg:mx-0 lg:h-full lg:max-w-none lg:w-80 lg:shrink-0 lg:overflow-hidden lg:rounded-xl lg:border lg:border-gray-200/80 lg:bg-white lg:shadow-sm dark:lg:border-gray-700 dark:lg:bg-gray-800 xl:w-96 ${hiddenOnMobile ? 'hidden lg:flex' : 'flex'}`}
    >
      {!loading && !error && conversations.length > 0 && (
        <div className="flex items-center gap-2.5 px-4 py-2 lg:border-b lg:border-gray-100 lg:dark:border-gray-700/80">
          <input
            type="checkbox"
            id="select-all-conversations"
            name="selectAllConversations"
            checked={
              selectedConversations.length === filteredConversations.length &&
              filteredConversations.length > 0
            }
            onChange={(e) => {
              if (e.target.checked) {
                onSelectionChange(filteredConversations.map((conv) => conv._id));
              } else {
                onSelectionChange([]);
              }
            }}
            className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-gray-300 dark:border-gray-600 accent-blue-600 touch-manipulation"
          />
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {bulkActionLoading ? (
              <span className="text-blue-600 dark:text-blue-400">Processing…</span>
            ) : selectionActive ? (
              <span className="text-gray-700 dark:text-gray-200">
                {selectedConversations.length} selected
              </span>
            ) : (
              `${filteredConversations.length} conversation${filteredConversations.length !== 1 ? 's' : ''}`
            )}
          </span>
        </div>
      )}

      {loading && (
        <div className="space-y-2 px-4 py-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[72px] animate-pulse rounded-xl bg-gray-200/60 dark:bg-gray-700/50"
            />
          ))}
        </div>
      )}

      {error && (
        <div className="mx-4 my-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && conversations.length === 0 && (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800">
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" className="text-gray-400">
              <path
                d="M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6Zm2 0 8 7 8-7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">No messages yet</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Start a conversation to see it here.
          </p>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-0 lg:px-0 lg:pb-0">
        {dateKeys.map((dateKey) => (
          <div key={dateKey} className="mb-3 last:mb-0">
            <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 lg:px-4">
              {formatDateHeader(dateKey)}
            </div>
            <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200/70 dark:bg-gray-800/90 dark:ring-gray-700/60 lg:rounded-none lg:bg-transparent lg:shadow-none lg:ring-0">
              {grouped[dateKey].map((conv: any, index: number) => {
                const unread = conv.unreadCount > 0;
                const participant =
                  conv.participants.find(
                    (p: any) => p._id?.toString() === currentUserId?.toString()
                  ) || conv.participants[0];
                const starred = participant?.starred;
                const otherParticipants = conv.participants.filter(
                  (p: any) => p._id?.toString() !== currentUserId?.toString()
                );
                const participantNames = otherParticipants
                  .map((p: any) =>
                    p.firstName && p.lastName
                      ? `${p.firstName} ${p.lastName}`.trim()
                      : p.firstName || p.lastName || p.email || 'Unknown'
                  )
                  .join(', ');
                const isSelected = selectedConversationId === conv._id;
                const isChecked = selectedConversations.includes(conv._id);
                const preview = formatMessagePreview(conv.lastMessage?.body, 72);
                const isLast = index === grouped[dateKey].length - 1;

                return (
                  <div
                    key={conv._id}
                    className={`group relative flex cursor-pointer items-center gap-3 px-3.5 py-3 transition-colors touch-manipulation lg:px-4 ${
                      !isLast ? 'border-b border-gray-100 dark:border-gray-700/50' : ''
                    } ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/40 lg:border-l-[3px] lg:border-l-blue-500 lg:pl-[13px]'
                        : unread
                          ? 'bg-blue-50/30 hover:bg-blue-50/60 dark:bg-blue-950/20 dark:hover:bg-blue-950/35'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                    } ${isChecked ? 'bg-blue-50/50 dark:bg-blue-950/30' : ''}`}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).tagName === 'INPUT') return;
                      onSelectConversation(conv);
                    }}
                  >
                    {unread && !isSelected && (
                      <span className="absolute bottom-3 left-0 top-3 w-0.5 rounded-full bg-blue-500" />
                    )}

                    <input
                      type="checkbox"
                      id={`select-conv-${conv._id}`}
                      name="selectConversation"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          onSelectionChange(
                            Array.from(new Set([...selectedConversations, conv._id]))
                          );
                        } else {
                          onSelectionChange(
                            selectedConversations.filter((id) => id !== conv._id)
                          );
                        }
                      }}
                      className={`h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 dark:border-gray-600 accent-blue-600 touch-manipulation transition-opacity lg:h-3.5 lg:w-3.5 ${
                        selectionActive || isChecked
                          ? 'opacity-100'
                          : 'opacity-100 lg:opacity-0 lg:group-hover:opacity-70 lg:focus:opacity-100'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    />

                    <div className="relative shrink-0">
                      <div
                        className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-[11px] font-semibold text-white ring-2 ring-white dark:ring-gray-800 ${getAvatarColor(conv._id)} ${
                          otherParticipants[0]?._id && isUserOnline(otherParticipants[0]._id)
                            ? 'online-pulse'
                            : ''
                        }`}
                      >
                        {otherParticipants[0]?.profilePicture ? (
                          <img
                            src={
                              otherParticipants[0].profilePicture.startsWith('http')
                                ? otherParticipants[0].profilePicture
                                : getImageUrl(otherParticipants[0].profilePicture)
                            }
                            alt={participantNames}
                            className="h-9 w-9 rounded-full object-cover"
                          />
                        ) : (
                          getInitials(otherParticipants[0])
                        )}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`min-w-0 truncate text-sm leading-5 ${
                            unread
                              ? 'font-semibold text-gray-900 dark:text-gray-50'
                              : 'font-medium text-gray-800 dark:text-gray-100'
                          }`}
                        >
                          {participantNames || 'Unknown'}
                        </span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {unread && (
                            <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white dark:bg-blue-500">
                              {conv.unreadCount}
                            </span>
                          )}
                          <button
                            type="button"
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-all touch-manipulation lg:h-5 lg:w-5 ${
                              starred
                                ? 'text-amber-400'
                                : 'text-gray-400 opacity-100 hover:text-amber-400 lg:opacity-0 lg:group-hover:opacity-100 dark:text-gray-500'
                            }`}
                            title={starred ? 'Unstar' : 'Star'}
                            aria-label={starred ? 'Unstar conversation' : 'Star conversation'}
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleStar(conv);
                            }}
                          >
                            <Star
                              className={`h-3.5 w-3.5 lg:h-3 lg:w-3 ${starred ? 'fill-amber-400 text-amber-400' : ''}`}
                              aria-hidden="true"
                            />
                          </button>
                          <span className="text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                            {conv.lastMessage
                              ? format(new Date(conv.lastMessage.createdAt), 'p')
                              : ''}
                          </span>
                        </div>
                      </div>

                      <p className="mt-0.5 truncate text-xs leading-4 text-gray-500 dark:text-gray-400">
                        {preview ? (
                          <>
                            <span
                              className={
                                unread
                                  ? 'font-medium text-gray-800 dark:text-gray-200'
                                  : 'text-gray-600 dark:text-gray-300'
                              }
                            >
                              {conv.subject}
                            </span>
                            <span className="text-gray-400 dark:text-gray-500"> — {preview}</span>
                          </>
                        ) : (
                          <span
                            className={
                              unread
                                ? 'font-medium text-gray-800 dark:text-gray-200'
                                : 'text-gray-600 dark:text-gray-300'
                            }
                          >
                            {conv.subject}
                          </span>
                        )}
                      </p>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConversationList;
