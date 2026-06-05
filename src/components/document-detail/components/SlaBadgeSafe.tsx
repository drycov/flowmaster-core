// components/SlaBadgeSafe.tsx

import { SlaBadge } from "@/components/StatusBadge";

interface SlaBadgeSafeProps {
  sla?: string;
  fallback?: string;
}

export function SlaBadgeSafe({ sla, fallback = "—" }: SlaBadgeSafeProps) {
  if (!sla) {
    return <span className="text-xs text-muted-foreground">{fallback}</span>;
  }
  return <SlaBadge sla={sla} />;
}

// Использование в MetadataCard:
// <SlaBadgeSafe sla={document.sla_status} />