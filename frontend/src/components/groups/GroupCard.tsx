import React from 'react';
import { Users } from 'lucide-react';

export interface GroupCardMember {
  firstName: string;
  lastName: string;
  _id?: string;
}

export interface GroupCardData {
  _id: string;
  name: string;
  members?: GroupCardMember[];
  leader?: GroupCardMember;
}

interface GroupCardProps {
  group: GroupCardData;
  subtitle: string;
  accentColor: string;
  onClick: () => void;
  className?: string;
}

const GroupCard: React.FC<GroupCardProps> = ({
  group,
  subtitle,
  accentColor,
  onClick,
  className = '',
}) => (
  <div
    className={`cursor-pointer overflow-hidden rounded-xl border border-gray-200/90 bg-white shadow-sm transition-shadow duration-200 hover:border-gray-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-900/40 dark:hover:border-gray-600 ${className}`}
    onClick={onClick}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    }}
  >
    <div className="relative h-20" style={{ backgroundColor: accentColor }}>
      <div className="absolute right-2 top-2">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
          <Users className="h-3 w-3 text-white" />
        </div>
      </div>
    </div>

    <div className="p-4">
      <div className="mb-3">
        <h3 className="mb-1 text-base font-bold" style={{ color: accentColor }}>
          {group.name}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
      </div>

      {group.members && group.members.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Members ({group.members.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {group.members.slice(0, 2).map((member, index) => (
              <span
                key={member._id ?? index}
                className="inline-flex items-center rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300"
              >
                {member.firstName} {member.lastName}
              </span>
            ))}
            {group.members.length > 2 && (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                +{group.members.length - 2} more
              </span>
            )}
          </div>
        </div>
      )}

      {group.leader && (
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Leader</p>
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {group.leader.firstName} {group.leader.lastName}
          </p>
        </div>
      )}
    </div>
  </div>
);

export default GroupCard;
