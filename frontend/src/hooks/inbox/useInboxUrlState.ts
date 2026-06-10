import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export type InboxFolder = 'inbox' | 'sent' | 'archived' | 'favorite' | 'deleted';

const FOLDERS: InboxFolder[] = ['inbox', 'sent', 'archived', 'favorite', 'deleted'];

function parseFolder(value: string | null): InboxFolder {
  if (value && FOLDERS.includes(value as InboxFolder)) return value as InboxFolder;
  return 'inbox';
}

export type InboxUrlPatch = {
  folder?: InboxFolder;
  course?: string;
  conversationId?: string | null;
  search?: string;
  compose?: boolean;
};

export function useInboxUrlState() {
  const [searchParams, setSearchParams] = useSearchParams();

  const folder = parseFolder(searchParams.get('folder'));
  const course = searchParams.get('course') || 'all';
  const conversationId = searchParams.get('c') || '';
  const search = searchParams.get('q') || '';
  const composeOpen = searchParams.get('compose') === '1';

  const patchUrl = useCallback(
    (patch: InboxUrlPatch) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (patch.folder !== undefined) {
            if (patch.folder === 'inbox') next.delete('folder');
            else next.set('folder', patch.folder);
          }
          if (patch.course !== undefined) {
            if (!patch.course || patch.course === 'all') next.delete('course');
            else next.set('course', patch.course);
          }
          if (patch.conversationId !== undefined) {
            if (!patch.conversationId) next.delete('c');
            else next.set('c', patch.conversationId);
          }
          if (patch.search !== undefined) {
            const q = patch.search.trim();
            if (!q) next.delete('q');
            else next.set('q', q);
          }
          if (patch.compose !== undefined) {
            if (patch.compose) next.set('compose', '1');
            else next.delete('compose');
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const setFolder = useCallback((f: InboxFolder) => patchUrl({ folder: f }), [patchUrl]);
  const setCourse = useCallback((c: string) => patchUrl({ course: c }), [patchUrl]);
  const setConversationId = useCallback(
    (id: string | null) => patchUrl({ conversationId: id }),
    [patchUrl]
  );
  const setSearch = useCallback((q: string) => patchUrl({ search: q }), [patchUrl]);
  const setComposeOpen = useCallback((open: boolean) => patchUrl({ compose: open }), [patchUrl]);

  return useMemo(
    () => ({
      folder,
      course,
      conversationId,
      search,
      composeOpen,
      patchUrl,
      setFolder,
      setCourse,
      setConversationId,
      setSearch,
      setComposeOpen,
    }),
    [
      folder,
      course,
      conversationId,
      search,
      composeOpen,
      patchUrl,
      setFolder,
      setCourse,
      setConversationId,
      setSearch,
      setComposeOpen,
    ]
  );
}
