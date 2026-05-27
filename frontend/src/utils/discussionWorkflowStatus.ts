export type DiscussionReleaseMode = 'immediate' | 'manual' | 'hidden';

export interface DiscussionWorkflowInput {
  published?: boolean;
  availableFrom?: string | Date | null;
  dueDate?: string | Date | null;
  locked?: boolean;
  lockAfterDue?: boolean;
  archivedAt?: string | Date | null;
  isGraded?: boolean;
  discussionReleaseMode?: DiscussionReleaseMode;
  gradesReleasedAt?: string | Date | null;
  gradeHidden?: boolean;
  workflowState?: Partial<DiscussionWorkflowState>;
}

export interface DiscussionWorkflowState {
  draft: boolean;
  published: boolean;
  available: boolean;
  locked: boolean;
  due: boolean;
  graded: boolean;
  released: boolean;
  archived: boolean;
}

function toDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function deriveDiscussionWorkflowState(
  discussion: DiscussionWorkflowInput,
  now: Date = new Date()
): DiscussionWorkflowState {
  if (discussion.workflowState) {
    return {
      draft: discussion.workflowState.draft ?? (discussion.published === false),
      published: discussion.workflowState.published ?? (discussion.published !== false),
      available: discussion.workflowState.available ?? true,
      locked: discussion.workflowState.locked ?? false,
      due: discussion.workflowState.due ?? false,
      graded: discussion.workflowState.graded ?? discussion.isGraded === true,
      released: discussion.workflowState.released ?? false,
      archived: discussion.workflowState.archived ?? Boolean(discussion.archivedAt),
    };
  }

  const availableFrom = toDate(discussion.availableFrom);
  const dueDate = toDate(discussion.dueDate);
  const mode = discussion.discussionReleaseMode || 'immediate';
  return {
    draft: discussion.published === false,
    published: discussion.published !== false,
    available: discussion.published !== false && (!availableFrom || now >= availableFrom),
    locked:
      discussion.locked === true ||
      Boolean(discussion.archivedAt) ||
      Boolean(discussion.lockAfterDue && dueDate && now > dueDate),
    due: Boolean(dueDate && now > dueDate),
    graded: discussion.isGraded === true,
    released: discussion.gradeHidden !== true && (Boolean(discussion.gradesReleasedAt) || mode === 'immediate'),
    archived: Boolean(discussion.archivedAt),
  };
}

export function sanitizeDiscussionHtml(html: string = ''): string {
  return String(html)
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/?(script|style)[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/\s(href|src)\s*=\s*"javascript:[^"]*"/gi, ' $1="#"')
    .replace(/\s(href|src)\s*=\s*'javascript:[^']*'/gi, " $1='#'")
    .replace(/\s(href|src)\s*=\s*javascript:[^\s>]+/gi, ' $1="#"');
}
