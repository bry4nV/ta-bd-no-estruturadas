import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getCustomersSummary,
  getOperationalSummary,
  getOutboxEvents,
  getProductsAtRisk,
  getRecurringIncidents,
  getSellersAtRisk,
} from "@/api/client";
import { OutboxStatusBadge } from "@/components/Badges";
import { CHANNEL_LABELS, CLAIM_TYPE_LABELS, STATUS_LABELS } from "@/data/labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  CustomerSummaryDoc,
  OperationalSummary,
  OutboxEvent,
  ProductSummaryDoc,
  RecurringEntity,
  SellerSummaryDoc,
} from "@/types/domain";

export default function Analytics() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold">Analitica</h2>
        <p className="text-sm text-muted-foreground">
          Indicadores agregados sobre documentos resumen (MongoDB) y relaciones agregadas (Neo4j).
        </p>
      </div>

      <Tabs defaultValue="operational">
        <TabsList>
          <TabsTrigger value="operational">Resumen operativo</TabsTrigger>
          <TabsTrigger value="customers">Clientes</TabsTrigger>
          <TabsTrigger value="products">Productos en riesgo</TabsTrigger>
          <TabsTrigger value="sellers">Vendedores en riesgo</TabsTrigger>
          <TabsTrigger value="recurring">Incidencias recurrentes</TabsTrigger>
          <TabsTrigger value="outbox">Outbox</TabsTrigger>
        </TabsList>

        <TabsContent value="operational"><OperationalTab /></TabsContent>
        <TabsContent value="customers"><CustomersTab /></TabsContent>
        <TabsContent value="products"><ProductsTab /></TabsContent>
        <TabsContent value="sellers"><SellersTab /></TabsContent>
        <TabsContent value="recurring"><RecurringTab /></TabsContent>
        <TabsContent value="outbox"><OutboxTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function useLoad<T>(loader: () => Promise<T>, errorMessage: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    loader()
      .then(setData)
      .catch((err) => toast.error(errorMessage, { description: err.message }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading };
}

function BarList({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.label} className="grid grid-cols-[140px_1fr_2.5rem] items-center gap-2 text-sm">
          <span className="truncate text-muted-foreground capitalize">{item.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </span>
          <span className="text-right font-medium">{item.value}</span>
        </li>
      ))}
    </ul>
  );
}

function OperationalTab() {
  const { data: summary, loading } = useLoad<OperationalSummary>(
    getOperationalSummary,
    "No se pudo cargar el resumen operativo"
  );

  if (loading) return <p className="pt-4 text-sm text-muted-foreground">Cargando resumen operativo...</p>;
  if (!summary) return null;

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col gap-1 pt-4">
            <span className="text-2xl font-bold">{summary.total_claims}</span>
            <span className="text-xs text-muted-foreground">Reclamos totales</span>
          </CardContent>
        </Card>
        {summary.by_status.slice(0, 3).map((s) => (
          <Card key={s.current_status}>
            <CardContent className="flex flex-col gap-1 pt-4">
              <span className="text-2xl font-bold">{s.total}</span>
              <span className="text-xs text-muted-foreground">
                {STATUS_LABELS[s.current_status as keyof typeof STATUS_LABELS] ?? s.current_status}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Por estado</CardTitle></CardHeader>
          <CardContent>
            <BarList
              items={summary.by_status.map((s) => ({
                label: STATUS_LABELS[s.current_status as keyof typeof STATUS_LABELS] ?? s.current_status,
                value: s.total,
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Por tipo de reclamo</CardTitle></CardHeader>
          <CardContent>
            <BarList
              items={summary.by_claim_type.map((s) => ({
                label: CLAIM_TYPE_LABELS[s.claim_type as keyof typeof CLAIM_TYPE_LABELS] ?? s.claim_type,
                value: s.total,
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Por canal</CardTitle></CardHeader>
          <CardContent>
            <BarList
              items={summary.by_channel.map((s) => ({
                label: CHANNEL_LABELS[s.channel as keyof typeof CHANNEL_LABELS] ?? s.channel,
                value: s.total,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Top productos con mas reclamos</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Producto</TableHead><TableHead className="text-right">Total</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {summary.top_products.map((p) => (
                  <TableRow key={p.product_id}>
                    <TableCell>{p.name} <span className="text-muted-foreground">({p.product_id})</span></TableCell>
                    <TableCell className="text-right">{p.total}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Top vendedores con mas reclamos</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Vendedor</TableHead><TableHead className="text-right">Total</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {summary.top_sellers.map((s) => (
                  <TableRow key={s.seller_id}>
                    <TableCell>{s.name} <span className="text-muted-foreground">({s.seller_id})</span></TableCell>
                    <TableCell className="text-right">{s.total}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Entidades recurrentes (Neo4j)</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-2 text-xs text-muted-foreground">
            Equivalente a un GROUP BY + COUNT, calculado como traversal de 1 salto en el grafo.
          </p>
          <pre className="max-h-80 overflow-auto rounded-lg border bg-muted/40 p-3 text-xs">
            {JSON.stringify(summary.recurring_entities_neo4j, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

function CustomersTab() {
  const { data, loading } = useLoad(() => getCustomersSummary(10), "No se pudieron cargar los clientes");
  if (loading) return <p className="pt-4 text-sm text-muted-foreground">Cargando...</p>;
  const customers = (data?.customers ?? []) as CustomerSummaryDoc[];
  return (
    <Card className="mt-4">
      <CardContent className="pt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Abiertos</TableHead>
              <TableHead>Ultimo reclamo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => (
              <TableRow key={c.customer_id}>
                <TableCell>{c.name} <span className="text-muted-foreground">({c.customer_id})</span></TableCell>
                <TableCell>{c.email ?? "-"}</TableCell>
                <TableCell className="text-right">{c.claim_summary?.total_claims ?? 0}</TableCell>
                <TableCell className="text-right">{c.claim_summary?.open_claims ?? 0}</TableCell>
                <TableCell>{c.claim_summary?.last_claim_at ? new Date(c.claim_summary.last_claim_at).toLocaleString() : "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ProductsTab() {
  const { data, loading } = useLoad(() => getProductsAtRisk(10), "No se pudieron cargar los productos");
  if (loading) return <p className="pt-4 text-sm text-muted-foreground">Cargando...</p>;
  const products = (data?.products ?? []) as ProductSummaryDoc[];
  return (
    <Card className="mt-4">
      <CardContent className="pt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Abiertos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.product_id}>
                <TableCell>{p.name} <span className="text-muted-foreground">({p.product_id})</span></TableCell>
                <TableCell>{p.category ?? "-"}</TableCell>
                <TableCell className="text-right">{p.claim_summary?.total_claims ?? 0}</TableCell>
                <TableCell className="text-right">{p.claim_summary?.open_claims ?? 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function SellersTab() {
  const { data, loading } = useLoad(() => getSellersAtRisk(10), "No se pudieron cargar los vendedores");
  if (loading) return <p className="pt-4 text-sm text-muted-foreground">Cargando...</p>;
  const sellers = (data?.sellers ?? []) as SellerSummaryDoc[];
  return (
    <Card className="mt-4">
      <CardContent className="pt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendedor</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Abiertos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sellers.map((s) => (
              <TableRow key={s.seller_id}>
                <TableCell>{s.name} <span className="text-muted-foreground">({s.seller_id})</span></TableCell>
                <TableCell className="text-right">{s.claim_summary?.total_claims ?? 0}</TableCell>
                <TableCell className="text-right">{s.claim_summary?.open_claims ?? 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RecurringTab() {
  const { data, loading } = useLoad(() => getRecurringIncidents(10), "No se pudieron cargar las incidencias recurrentes");
  if (loading) return <p className="pt-4 text-sm text-muted-foreground">Cargando...</p>;
  const entities = (data?.entities ?? []) as RecurringEntity[];
  return (
    <Card className="mt-4">
      <CardContent className="pt-4">
        <p className="mb-2 text-xs text-muted-foreground">
          Traversal de 1 salto en Neo4j (equivalente a GROUP BY + COUNT).
        </p>
        <pre className="max-h-96 overflow-auto rounded-lg border bg-muted/40 p-3 text-xs">
          {JSON.stringify(entities, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}

function OutboxTab() {
  const { data, loading } = useLoad(() => getOutboxEvents(undefined, 20), "No se pudo cargar el outbox");
  if (loading) return <p className="pt-4 text-sm text-muted-foreground">Cargando...</p>;
  const events = (data?.events ?? []) as OutboxEvent[];
  return (
    <Card className="mt-4">
      <CardContent className="pt-4">
        <p className="mb-2 text-xs text-muted-foreground">
          Estado de la sincronizacion asincrona hacia Neo4j y los documentos resumen.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event ID</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Claim ID</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Reintentos</TableHead>
              <TableHead>Creado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((e) => (
              <TableRow key={e.event_id}>
                <TableCell className="font-mono text-xs">{e.event_id}</TableCell>
                <TableCell>{e.event_type}</TableCell>
                <TableCell className="font-mono text-xs">{e.aggregate_id}</TableCell>
                <TableCell><OutboxStatusBadge status={e.status} /></TableCell>
                <TableCell className="text-right">{e.retry_count}</TableCell>
                <TableCell>{new Date(e.created_at).toLocaleString()}</TableCell>
              </TableRow>
            ))}
            {events.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">No hay eventos.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
