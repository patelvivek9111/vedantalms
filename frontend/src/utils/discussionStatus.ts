import { deriveDiscussionWorkflowState, type DiscussionWorkflowInput } from './discussionWorkflowStatus';

export type DiscussionStatus =
  | 'unpublished'
  | 'available'
  | 'locked'
  | 'graded_pending_release'
  | 'graded_released'
  | 'excused'
  | 'archived'
  | 'deleted';

export interface DiscussionStatusInput extends DiscussionWorkflowInput {
  deletedAt?: string | Date | null;
  discussionStatus?: DiscussionStatus;
  gradeVisibility?: { scoreVisible?: boolean };
  currentUserParticipation?: {
    unreadCount?: number;
    hasPosted?: boolean;
    hasInstructorReply?: boolean;
    lastViewedAt?: string | Date | null;
  };
}

export function resolveDiscussionStatus(discussion: DiscussionStatusInput): DiscussionStatus {
  if (discussion.discussionStatus) return discussion.discussionStatus;
  if (discussion.deletedAt) return 'deleted';
  const workflow = deriveDiscussionWorkflowState(discussion);
  if (workflow.archived) return 'archived';
  if (!workflow.published) return 'unpublished';
  if (workflow.locked) return 'locked';
  if (discussion.isGraded) {
    if (discussion.gradeVisibility?.scoreVisible || workflow.released) return 'graded_released';
    return 'graded_pending_release';
  }
  return 'available';
}
