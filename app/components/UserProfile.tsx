import { RobloxUser } from '@/types';
import { Calendar, ExternalLink, Shield, User } from 'lucide-react';

interface UserProfileProps {
  user: RobloxUser;
  headshotUrl: string;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function UserProfile({ user, headshotUrl }: UserProfileProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <img
          src={headshotUrl}
          alt={user.displayName}
          className="size-14 rounded-full ring-2 ring-border object-cover bg-muted"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight truncate">{user.displayName}</h2>
            {user.hasVerifiedBadge && (
              <Shield className="size-4 shrink-0 fill-blue-500 text-white" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">@{user.name}</p>
        </div>
      </div>

      {user.description && (
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{user.description}</p>
      )}

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <User className="size-3.5" />
          <span>ID: {user.id}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="size-3.5" />
          <span>Joined {formatDate(user.created)}</span>
        </div>
      </div>

      <a
        href={`https://www.roblox.com/users/${user.id}/profile`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
      >
        View on Roblox <ExternalLink className="size-3" />
      </a>
    </div>
  );
}
