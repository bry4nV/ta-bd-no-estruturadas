import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/data/labels";
import type { ClaimStatus, Priority } from "@/types/domain";

const STATUS_VARS: Record<ClaimStatus, string> = {
  created: "--claim-status-created",
  in_review: "--claim-status-in-review",
  pending_customer: "--claim-status-pending-customer",
  resolved: "--claim-status-resolved",
  closed: "--claim-status-closed",
  rejected: "--claim-status-rejected",
};

const PRIORITY_VARS: Record<Priority, string> = {
  low: "--claim-priority-low",
  medium: "--claim-priority-medium",
  high: "--claim-priority-high",
};

function toneStyle(varName: string): CSSProperties {
  return {
    color: `var(${varName})`,
    backgroundColor: `color-mix(in oklch, var(${varName}) 14%, transparent)`,
    borderColor: `color-mix(in oklch, var(${varName}) 35%, transparent)`,
  };
}

export function StatusBadge({ status }: { status: string }) {
  const cssVar = STATUS_VARS[status as ClaimStatus];
  return (
    <Badge variant="outline" style={cssVar ? toneStyle(cssVar) : undefined}>
      {STATUS_LABELS[status as ClaimStatus] ?? status}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const cssVar = PRIORITY_VARS[priority as Priority];
  return (
    <Badge variant="outline" style={cssVar ? toneStyle(cssVar) : undefined}>
      {PRIORITY_LABELS[priority as Priority]?.replace(/\s*\(.*\)/, "") ?? priority}
    </Badge>
  );
}

export function SlaBadge({ breached }: { breached: boolean }) {
  return (
    <Badge variant="outline" style={toneStyle(breached ? "--claim-sla-breached" : "--claim-sla-ok")}>
      {breached ? "SLA vencido" : "SLA en plazo"}
    </Badge>
  );
}

const OUTBOX_VARS: Record<string, string> = {
  PENDING: "--claim-priority-medium",
  PROCESSED: "--claim-status-resolved",
  FAILED: "--claim-status-rejected",
};

export function OutboxStatusBadge({ status }: { status: string }) {
  const cssVar = OUTBOX_VARS[status];
  return (
    <Badge variant="outline" style={cssVar ? toneStyle(cssVar) : undefined}>
      {status}
    </Badge>
  );
}
