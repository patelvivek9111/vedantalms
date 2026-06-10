/** Legacy bridge for sidebar/nav until Phase 8 websocket invalidation is wired. */
export const INBOX_MESSAGE_READ_EVENT = 'inboxMessageRead';

export function dispatchInboxMessageRead(): void {
  window.dispatchEvent(new CustomEvent(INBOX_MESSAGE_READ_EVENT));
}
