import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { createClaim } from "@/api/client";
import { CLAIM_TEMPLATES } from "@/data/claimTemplates";
import { CHANNEL_LABELS, CLAIM_TYPE_LABELS, EVIDENCE_TYPE_LABELS, PRIORITY_LABELS } from "@/data/labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Channel, ClaimCreate, ClaimType, Evidence, EvidenceType, Priority } from "@/types/domain";

const CHANNELS: Channel[] = ["web", "mobile_app", "store", "whatsapp", "call_center", "email"];
const EVIDENCE_TYPES: EvidenceType[] = ["image", "video", "audio", "document", "receipt", "conversation"];

interface DetailRow {
  key: string;
  value: string;
}

function detailsToRows(details: Record<string, unknown>): DetailRow[] {
  return Object.entries(details).map(([key, value]) => ({ key, value: String(value) }));
}

export default function NewClaim() {
  const navigate = useNavigate();
  const [form, setForm] = useState<ClaimCreate>(structuredClone(CLAIM_TEMPLATES.defective_product));
  const [detailRows, setDetailRows] = useState<DetailRow[]>(detailsToRows(form.details));
  const [includeLogistics, setIncludeLogistics] = useState(!!form.logistics);
  const [submitting, setSubmitting] = useState(false);

  function applyTemplate(claimType: ClaimType) {
    const template = structuredClone(CLAIM_TEMPLATES[claimType]);
    setForm(template);
    setDetailRows(detailsToRows(template.details));
    setIncludeLogistics(!!template.logistics);
  }

  function updateDetailRow(index: number, patch: Partial<DetailRow>) {
    setDetailRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addDetailRow() {
    setDetailRows((rows) => [...rows, { key: "", value: "" }]);
  }

  function removeDetailRow(index: number) {
    setDetailRows((rows) => rows.filter((_, i) => i !== index));
  }

  function updateEvidence(index: number, patch: Partial<Evidence>) {
    setForm((f) => ({
      ...f,
      evidence: f.evidence.map((ev, i) => (i === index ? { ...ev, ...patch } : ev)),
    }));
  }

  function addEvidence() {
    setForm((f) => ({
      ...f,
      evidence: [...f.evidence, { type: "image", url: "", description: "" }],
    }));
  }

  function removeEvidence(index: number) {
    setForm((f) => ({ ...f, evidence: f.evidence.filter((_, i) => i !== index) }));
  }

  function updateLogistics(patch: {
    carrier?: Partial<NonNullable<ClaimCreate["logistics"]>["carrier"]>;
    zone?: Partial<NonNullable<ClaimCreate["logistics"]>["zone"]>;
    promised_date?: string;
    tracking_code?: string;
  }) {
    setForm((f) => {
      const current = f.logistics ?? {};
      return {
        ...f,
        logistics: {
          ...current,
          ...patch,
          carrier: patch.carrier
            ? { carrier_id: "", name: "", ...current.carrier, ...patch.carrier }
            : current.carrier,
          zone: patch.zone ? { name: "", ...current.zone, ...patch.zone } : current.zone,
        },
      };
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const details = Object.fromEntries(
      detailRows.filter((row) => row.key.trim() !== "").map((row) => [row.key.trim(), row.value])
    );

    const payload: ClaimCreate = {
      ...form,
      details,
      logistics: includeLogistics ? form.logistics : null,
    };

    setSubmitting(true);
    try {
      const res = await createClaim(payload);
      toast.success(res.message, { description: res.claim_id });
      setTimeout(() => navigate(`/claims/${res.claim_id}`), 700);
    } catch (err) {
      toast.error("No se pudo registrar el reclamo", { description: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold">Registrar reclamo</h2>
        <p className="text-sm text-muted-foreground">
          Completa los datos del reclamo. Cambiar el tipo precarga una plantilla de ejemplo.
        </p>
      </div>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <Card>
          <CardHeader><CardTitle>Datos generales</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label>Tipo de reclamo</Label>
                <Select value={form.claim_type} onValueChange={(v) => applyTemplate(v as ClaimType)} items={CLAIM_TYPE_LABELS}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CLAIM_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Canal</Label>
                <Select value={form.channel} onValueChange={(v) => setForm((f) => ({ ...f, channel: v as Channel }))} items={CHANNEL_LABELS}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((c) => (
                      <SelectItem key={c} value={c}>{CHANNEL_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Prioridad</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v as Priority }))} items={PRIORITY_LABELS}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{PRIORITY_LABELS.low}</SelectItem>
                    <SelectItem value="medium">{PRIORITY_LABELS.medium}</SelectItem>
                    <SelectItem value="high">{PRIORITY_LABELS.high}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Cliente</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label>ID de cliente</Label>
              <Input value={form.customer.customer_id} onChange={(e) => setForm((f) => ({ ...f, customer: { ...f.customer, customer_id: e.target.value } }))} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Nombre</Label>
              <Input value={form.customer.name} onChange={(e) => setForm((f) => ({ ...f, customer: { ...f.customer, name: e.target.value } }))} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Email</Label>
              <Input value={form.customer.email ?? ""} onChange={(e) => setForm((f) => ({ ...f, customer: { ...f.customer, email: e.target.value } }))} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Pedido</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label>ID de pedido</Label>
              <Input value={form.order.order_id} onChange={(e) => setForm((f) => ({ ...f, order: { ...f.order, order_id: e.target.value } }))} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Fecha de compra</Label>
              <Input type="date" value={form.order.purchase_date ?? ""} onChange={(e) => setForm((f) => ({ ...f, order: { ...f.order, purchase_date: e.target.value } }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Monto</Label>
              <Input type="number" step="0.01" value={form.order.amount ?? ""} onChange={(e) => setForm((f) => ({ ...f, order: { ...f.order, amount: Number(e.target.value) } }))} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Producto</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label>ID de producto</Label>
              <Input value={form.product.product_id} onChange={(e) => setForm((f) => ({ ...f, product: { ...f.product, product_id: e.target.value } }))} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Nombre</Label>
              <Input value={form.product.name} onChange={(e) => setForm((f) => ({ ...f, product: { ...f.product, name: e.target.value } }))} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Categoria</Label>
              <Input value={form.product.category ?? ""} onChange={(e) => setForm((f) => ({ ...f, product: { ...f.product, category: e.target.value } }))} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Vendedor</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>ID de vendedor</Label>
              <Input value={form.seller.seller_id} onChange={(e) => setForm((f) => ({ ...f, seller: { ...f.seller, seller_id: e.target.value } }))} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Nombre</Label>
              <Input value={form.seller.name} onChange={(e) => setForm((f) => ({ ...f, seller: { ...f.seller, name: e.target.value } }))} required />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <Label className="text-sm font-normal text-foreground">
                <Checkbox checked={includeLogistics} onCheckedChange={(v) => setIncludeLogistics(v === true)} />
                Incluir componente logistico
              </Label>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {includeLogistics ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label>ID de operador logistico</Label>
                  <Input value={form.logistics?.carrier?.carrier_id ?? ""} onChange={(e) => updateLogistics({ carrier: { carrier_id: e.target.value } })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Operador (nombre)</Label>
                  <Input value={form.logistics?.carrier?.name ?? ""} onChange={(e) => updateLogistics({ carrier: { name: e.target.value } })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Zona</Label>
                  <Input value={form.logistics?.zone?.name ?? ""} onChange={(e) => updateLogistics({ zone: { name: e.target.value } })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Region</Label>
                  <Input value={form.logistics?.zone?.region ?? ""} onChange={(e) => updateLogistics({ zone: { region: e.target.value } })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Fecha prometida</Label>
                  <Input type="date" value={form.logistics?.promised_date ?? ""} onChange={(e) => updateLogistics({ promised_date: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Tracking code</Label>
                  <Input value={form.logistics?.tracking_code ?? ""} onChange={(e) => updateLogistics({ tracking_code: e.target.value })} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sin logistica (ej. reclamos de customer_service).</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Detalles del reclamo</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              Agrega los campos que necesites segun el tipo de reclamo.
            </p>
            {detailRows.map((row, idx) => (
              <div className="flex flex-wrap items-center gap-2" key={idx}>
                <Input
                  placeholder="Campo (ej. descripcion)"
                  value={row.key}
                  onChange={(e) => updateDetailRow(idx, { key: e.target.value })}
                  className="w-48"
                />
                <Input
                  placeholder="Valor"
                  value={row.value}
                  onChange={(e) => updateDetailRow(idx, { value: e.target.value })}
                  className="min-w-52 flex-1"
                />
                <Button type="button" variant="destructive" onClick={() => removeDetailRow(idx)}>Quitar</Button>
              </div>
            ))}
            <Button type="button" variant="outline" className="w-fit" onClick={addDetailRow}>+ Agregar campo</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Evidencia</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            {form.evidence.map((ev, idx) => (
              <div className="flex flex-wrap items-center gap-2" key={idx}>
                <Select value={ev.type} onValueChange={(v) => updateEvidence(idx, { type: v as EvidenceType })} items={EVIDENCE_TYPE_LABELS}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVIDENCE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{EVIDENCE_TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input placeholder="URL" value={ev.url} onChange={(e) => updateEvidence(idx, { url: e.target.value })} className="min-w-52 flex-1" />
                <Input placeholder="Descripcion" value={ev.description ?? ""} onChange={(e) => updateEvidence(idx, { description: e.target.value })} className="min-w-52 flex-1" />
                <Button type="button" variant="destructive" onClick={() => removeEvidence(idx)}>Quitar</Button>
              </div>
            ))}
            <Button type="button" variant="outline" className="w-fit" onClick={addEvidence}>+ Agregar evidencia</Button>
          </CardContent>
        </Card>

        <div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Registrando..." : "Registrar reclamo"}
          </Button>
        </div>
      </form>
    </div>
  );
}
