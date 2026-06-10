import {
  isInboxWebSocketEnabled,
  isMessagingSocketConnected,
} from '../../utils/messagingSocket';

/** Poll interval when inbox websocket is off or disconnected (ms). */
export const INBOX_POLL_MS = 30_000;
/** Slower safety-net poll while messaging websocket is connected (ms). */
export const INBOX_POLL_CONNECTED_MS = 60_000;

/** Shared inbox poll interval — React Query dedupes across nav + page. */
export function getInboxQueryPollMs(): number {
  if (!isInboxWebSocketEnabled()) {
    return INBOX_POLL_MS;
  }
  return isMessagingSocketConnected() ? INBOX_POLL_CONNECTED_MS : INBOX_POLL_MS;
}
