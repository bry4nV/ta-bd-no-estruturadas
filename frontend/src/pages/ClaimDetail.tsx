import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Clock,
  ExternalLink,
  FileText,
  History,
  Package,
  Paperclip,
  Receipt,
  Share2,
  Store,
  Truck,
  User,
  type LucideIcon,
} from "lucide-react";
import { getClaim, getClaimAttachments, getRelatedClaims, updateClaimStatus } from "@/api/client";
import { PriorityBadge, SlaBadge, StatusBadge } from "@/components/Badges";
import { RelatedPathDialog } from "@/components/RelatedPathDialog";
import { CHANNEL_LABELS, CLAIM_TYPE_LABELS, EVIDENCE_TYPE_LABELS, STATUS_LABELS } from "@/data/labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Attachment, Channel, ClaimDocument, ClaimStatus, ClaimType, RelatedClaim } from "@/types/domain";

const STATUS_OPTIONS = Object.keys(STATUS_LABELS) as ClaimStatus[];
const HOPS_ITEMS = { "2": "2 (solo directos)", "4": "4", "6": "6" };

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function humanize(key: string): string {
  const spaced = key.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function SectionHeading({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div>
        <h3 className="text-base font-semibold leading-tight">{title}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}

export default function ClaimDetail() {
  const { claimId } = useParams<{ claimId: string }>();
  const [claim, setClaim] = useState<ClaimDocument | null>(null);
  const [loading, setLoading] = useState(true);

  const [attachments, setAttachments] = useState<Attachment[] | null>(null);

  const [newStatus, setNewStatus] = useState<ClaimStatus>("in_review");
  const [comment, setComment] = useState("");
  const [actorId, setActorId] = useState("AGT-001");
  const [saving, setSaving] = useState(false);

  const [related, setRelated] = useState<RelatedClaim[] | null>(null);
  const [maxHops, setMaxHops] = useState("4");
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [selectedRelated, setSelectedRelated] = useState<RelatedClaim | null>(null);

  function loadClaim() {
    if (!claimId) return;
    setLoading(true);
    getClaim(claimId)
      .then((doc) => {
        setClaim(doc);
        setNewStatus(doc.current_status === "created" ? "in_review" : doc.current_status);
      })
      .catch((err) => toast.error("No se pudo cargar el reclamo", { description: err.message }))
      .finally(() => setLoading(false));
  }

  function loadAttachments() {
    if (!claimId) return;
    getClaimAttachments(claimId)
      .then((res) => setAttachments(res.attachments))
      .catch((err) => toast.error("No se pudo cargar la evidencia", { description: err.message }));
  }

  function loadRelated(hops = maxHops) {
    if (!claimId) return;
    setRelatedLoading(true);
    getRelatedClaims(claimId, Number(hops), 10)
      .then((res) => setRelated(res.related))
      .catch((err) => toast.error("No se pudieron cargar los relacionados", { description: err.message }))
      .finally(() => setRelatedLoading(false));
  }

  useEffect(() => {
    loadClaim();
    loadAttachments();
    loadRelated();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimId]);

  async function handleStatusSubmit(e: FormEvent) {
    e.preventDefault();
    if (!claimId) return;
    setSaving(true);
    try {
      const res = await updateClaimStatus(claimId, {
        current_status: newStatus,
        comment: comment || undefined,
        actor_id: actorId || undefined,
      });
      toast.success(res.message);
      setComment("");
      loadClaim();
    } catch (err) {
      toast.error("No se pudo actualizar el estado", { description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Cargando reclamo...</p>;
  if (!claim) return null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="font-mono text-lg font-semibold tracking-tight">{claim.claim_id}</h2>
        <div className="my-2 flex gap-2">
          <StatusBadge status={claim.current_status} />
          <PriorityBadge priority={claim.priority} />
          <SlaBadge breached={claim.sla.breached} />
        </div>
        <p className="text-sm text-muted-foreground">
          {CLAIM_TYPE_LABELS[claim.claim_type as ClaimType] ?? claim.claim_type} - canal{" "}
          {CHANNEL_LABELS[claim.channel as Channel] ?? claim.channel} - creado{" "}
          {new Date(claim.created_at).toLocaleString()}
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <SectionHeading
          icon={Package}
          title="Snapshot del reclamo"
          description="Datos del cliente, pedido, producto, vendedor y logistica al momento del registro."
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><User className="size-4 text-muted-foreground" />Cliente</CardTitle></CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-1.5">
                <Field label="ID" value={claim.customer.customer_id} />
                <Field label="Nombre" value={claim.customer.name} />
                <Field label="Email" value={claim.customer.email ?? "-"} />
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Receipt className="size-4 text-muted-foreground" />Pedido</CardTitle></CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-1.5">
                <Field label="ID" value={claim.order.order_id} />
                <Field label="Fecha compra" value={claim.order.purchase_date ?? "-"} />
                <Field label="Monto" value={claim.order.amount != null ? `S/ ${claim.order.amount}` : "-"} />
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Package className="size-4 text-muted-foreground" />Producto</CardTitle></CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-1.5">
                <Field label="ID" value={claim.product.product_id} />
                <Field label="Nombre" value={claim.product.name} />
                <Field label="Categoria" value={claim.product.category ?? "-"} />
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Store className="size-4 text-muted-foreground" />Vendedor</CardTitle></CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-1.5">
                <Field label="ID" value={claim.seller.seller_id} />
                <Field label="Nombre" value={claim.seller.name} />
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Truck className="size-4 text-muted-foreground" />Logistica</CardTitle></CardHeader>
            <CardContent>
              {claim.logistics ? (
                <dl className="flex flex-col gap-1.5">
                  <Field label="Operador" value={claim.logistics.carrier?.name ?? "-"} />
                  <Field label="Zona" value={claim.logistics.zone?.name ?? "-"} />
                  <Field label="Fecha prometida" value={claim.logistics.promised_date ?? "-"} />
                  <Field label="Tracking" value={claim.logistics.tracking_code ?? "-"} />
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Sin componente logistico (reclamo tipo {CLAIM_TYPE_LABELS[claim.claim_type as ClaimType] ?? claim.claim_type}).
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="size-4 text-muted-foreground" />SLA</CardTitle></CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-1.5">
                <Field label="Vence" value={new Date(claim.sla.due_at).toLocaleString()} />
                <Field label="Estado" value={<SlaBadge breached={claim.sla.breached} />} />
              </dl>
            </CardContent>
          </Card>
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-4">
        <SectionHeading
          icon={FileText}
          title="Contenido del reclamo"
          description="Campos propios del tipo de reclamo y evidencia adjunta."
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Detalles</CardTitle></CardHeader>
            <CardContent>
              {Object.keys(claim.details).length > 0 ? (
                <dl className="flex flex-col gap-1.5">
                  {Object.entries(claim.details).map(([key, value]) => (
                    <Field key={key} label={humanize(key)} value={String(value)} />
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">Sin detalles adicionales.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Paperclip className="size-4 text-muted-foreground" />Evidencia</CardTitle></CardHeader>
            <CardContent>
              {attachments === null && <p className="text-sm text-muted-foreground">Cargando evidencia...</p>}
              {attachments && attachments.length === 0 && (
                <p className="text-sm text-muted-foreground">Sin evidencia adjunta.</p>
              )}
              {attachments && attachments.length > 0 && (
                <ul className="flex flex-col gap-3">
                  {attachments.map((a) => (
                    <li key={a.attachment_id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {EVIDENCE_TYPE_LABELS[a.type] ?? a.type}
                        </span>
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          Ver evidencia <ExternalLink className="size-3" />
                        </a>
                      </div>
                      {a.description && <p className="mt-2 text-sm">{a.description}</p>}
                      <p className="mt-1 text-xs text-muted-foreground">
                        Subido {new Date(a.uploaded_at).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-4">
        <SectionHeading
          icon={History}
          title="Trazabilidad y estado"
          description="Historial de cambios del reclamo y transicion de estado."
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Historial de estado</CardTitle></CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-3">
                {claim.status_history.map((h, idx) => (
                  <li key={idx} className="border-l-2 pl-3">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={h.current_status} />
                      <span className="text-xs text-muted-foreground">
                        {new Date(h.event_at).toLocaleString()} - {h.actor_type} {h.actor_id ?? ""}
                      </span>
                    </div>
                    {h.comment && <p className="mt-1 text-sm">{h.comment}</p>}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Actualizar estado</CardTitle></CardHeader>
            <CardContent>
              <form className="flex flex-wrap items-center gap-2" onSubmit={handleStatusSubmit}>
                <Select value={newStatus} onValueChange={(v) => setNewStatus(v as ClaimStatus)} items={STATUS_LABELS}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input className="w-32" placeholder="actor_id" value={actorId} onChange={(e) => setActorId(e.target.value)} />
                <Input
                  placeholder="Comentario"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="min-w-40 flex-1"
                />
                <Button type="submit" disabled={saving}>
                  {saving ? "Guardando..." : "Actualizar"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-4">
        <SectionHeading
          icon={Share2}
          title="Reclamos relacionados"
          description="Reclamos conectados por entidades compartidas, calculado on-demand en Neo4j."
        />
        <Card>
          <CardContent className="flex flex-col gap-4 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Profundidad maxima:</span>
              <Select value={maxHops} onValueChange={(v) => setMaxHops(v ?? "4")} items={HOPS_ITEMS}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 (solo directos)</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="6">6</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => loadRelated(maxHops)} disabled={relatedLoading}>
                {relatedLoading ? "Buscando..." : "Buscar relacionados"}
              </Button>
            </div>
            {related && related.length === 0 && (
              <p className="text-sm text-muted-foreground">No se encontraron reclamos relacionados.</p>
            )}
            {related && related.length > 0 && (
              <div className="rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Claim ID</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Hops</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {related.map((r) => (
                      <TableRow key={r.claim_id}>
                        <TableCell>
                          <Link to={`/claims/${r.claim_id}`} title={r.claim_id} className="font-mono text-xs font-medium text-primary hover:underline">
                            {r.claim_id}
                          </Link>
                        </TableCell>
                        <TableCell>{r.claim_type ? CLAIM_TYPE_LABELS[r.claim_type as ClaimType] ?? r.claim_type : "-"}</TableCell>
                        <TableCell>{r.current_status ? <StatusBadge status={r.current_status} /> : "-"}</TableCell>
                        <TableCell>{r.hops}</TableCell>
                        <TableCell>{r.score.toFixed(2)}</TableCell>
                        <TableCell className="whitespace-normal">{r.motivo}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => setSelectedRelated(r)}>
                            Ver relacion
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {claim && (
        <RelatedPathDialog
          related={selectedRelated}
          currentClaimId={claim.claim_id}
          onOpenChange={(open) => !open && setSelectedRelated(null)}
        />
      )}
    </div>
  );
}
