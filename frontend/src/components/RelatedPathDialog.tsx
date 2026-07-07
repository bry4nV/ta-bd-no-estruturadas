import { ArrowRight, MapPin, Package, Store, Truck, User, Waypoints, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/Badges";
import { CLAIM_TYPE_LABELS, ENTITY_KIND_LABELS } from "@/data/labels";
import type { ClaimType, PathNode, RelatedClaim } from "@/types/domain";

const ENTITY_ICONS: Record<string, LucideIcon> = {
  Customer: User,
  Product: Package,
  Seller: Store,
  Carrier: Truck,
  Zone: MapPin,
};

const ENTITY_ARTICLE: Record<string, string> = {
  Customer: "el cliente",
  Product: "el producto",
  Seller: "el vendedor",
  Carrier: "el operador logistico",
  Zone: "la zona",
};

interface PathStep {
  from: PathNode;
  entity: PathNode;
  to: PathNode;
}

function pathSteps(path: PathNode[]): PathStep[] {
  const steps: PathStep[] = [];
  for (let i = 0; i + 2 < path.length; i += 2) {
    steps.push({ from: path[i], entity: path[i + 1], to: path[i + 2] });
  }
  return steps;
}

function StepList({ path }: { path: PathNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm">
      {pathSteps(path).map((step, idx) => (
        <li key={idx}>
          <span className="font-mono text-xs">{step.from.id}</span> y{" "}
          <span className="font-mono text-xs">{step.to.id}</span> comparten{" "}
          {ENTITY_ARTICLE[step.entity.kind] ?? "la entidad"} <strong>&quot;{step.entity.label}&quot;</strong>
        </li>
      ))}
    </ul>
  );
}

function NodeChip({ node, currentClaimId }: { node: PathNode; currentClaimId: string }) {
  if (node.kind === "Claim") {
    const label = node.claim_type ? CLAIM_TYPE_LABELS[node.claim_type as ClaimType] ?? node.claim_type : null;
    const content = (
      <div className="flex flex-col items-center gap-0.5 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-center">
        <span className="font-mono text-[11px] font-medium text-primary">{node.id}</span>
        {label && <span className="text-[10px] text-muted-foreground">{label}</span>}
      </div>
    );
    if (node.id === currentClaimId) return content;
    return (
      <Link to={`/claims/${node.id}`} className="transition-opacity hover:opacity-70">
        {content}
      </Link>
    );
  }

  const Icon = ENTITY_ICONS[node.kind] ?? Waypoints;
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg border bg-muted/50 px-2.5 py-1.5 text-center">
      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Icon className="size-3" />
        {ENTITY_KIND_LABELS[node.kind] ?? node.kind}
      </span>
      <span className="text-xs font-medium">{node.label}</span>
    </div>
  );
}

function PathRow({ path, currentClaimId }: { path: PathNode[]; currentClaimId: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3">
      <StepList path={path} />
      <div className="flex flex-wrap items-center gap-1.5">
        {path.map((node, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <NodeChip node={node} currentClaimId={currentClaimId} />
            {idx < path.length - 1 && <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />}
          </div>
        ))}
      </div>
    </div>
  );
}

export function RelatedPathDialog({
  related,
  currentClaimId,
  onOpenChange,
}: {
  related: RelatedClaim | null;
  currentClaimId: string;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={related !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Como se relaciona con {related?.claim_id}
            {related && <StatusBadge status={related.current_status ?? ""} />}
          </DialogTitle>
          <DialogDescription>
            {related?.motivo}
            {related && related.paths.length > 1 && ` - ${related.paths.length} conexiones encontradas`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 overflow-x-auto py-1">
          {related?.paths.map((path, idx) => (
            <PathRow key={idx} path={path} currentClaimId={currentClaimId} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
