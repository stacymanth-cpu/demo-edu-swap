import { BadgeCheck } from 'lucide-react';

/** Seal shown next to the name of a student whose registration an admin has approved. */
export function VerifiedBadge({ size = 18 }: { size?: number }) {
  return (
    <span className="verified-badge" role="img" aria-label="Verified student" title="Verified student: registration approved by EduSwap">
      <BadgeCheck size={size} strokeWidth={2.25} aria-hidden="true" />
    </span>
  );
}
