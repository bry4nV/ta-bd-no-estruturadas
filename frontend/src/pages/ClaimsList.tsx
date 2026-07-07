import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { searchClaims } from "@/api/client";
import { PriorityBadge, StatusBadge } from "@/components/Badges";
import { CHANNEL_LABELS, CLAIM_TYPE_LABELS, STATUS_LABELS } from "@/data/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
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
import type { Channel, ClaimDocument, ClaimStatus, ClaimType } from "@/types/domain";

const PAGE_SIZE = 20;
const ALL = "__all__";
const STATUS_SELECT_ITEMS = { [ALL]: "Todos los estados", ...STATUS_LABELS };
const CLAIM_TYPE_SELECT_ITEMS = { [ALL]: "Todos los tipos", ...CLAIM_TYPE_LABELS };

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "ellipsis")[] = [1];
  if (current > 3) pages.push("ellipsis");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let p = start; p <= end; p++) pages.push(p);
  if (current < total - 2) pages.push("ellipsis");
  pages.push(total);
  return pages;
}

export default function ClaimsList() {
  const [claims, setClaims] = useState<ClaimDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const [currentStatus, setCurrentStatus] = useState(ALL);
  const [claimType, setClaimType] = useState(ALL);
  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [sellerId, setSellerId] = useState("");

  function load(nextOffset = offset) {
    setLoading(true);
    searchClaims({
      current_status: currentStatus === ALL ? undefined : currentStatus,
      claim_type: claimType === ALL ? undefined : claimType,
      customer_id: customerId || undefined,
      product_id: productId || undefined,
      seller_id: sellerId || undefined,
      limit: PAGE_SIZE,
      offset: nextOffset,
    })
      .then((res) => {
        setClaims(res.claims);
        setTotal(res.total_coincidencias);
        setOffset(nextOffset);
      })
      .catch((err) => toast.error("No se pudieron cargar los reclamos", { description: err.message }))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    load(0);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Reclamos</h2>
          <p className="text-sm text-muted-foreground">
            Busca y filtra los reclamos registrados en el sistema.
          </p>
        </div>
        <Button render={<Link to="/claims/new">Registrar reclamo</Link>} nativeButton={false} />
      </div>

      <form className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3" onSubmit={handleSearch}>
        <Select value={currentStatus} onValueChange={(v) => setCurrentStatus(v ?? ALL)} items={STATUS_SELECT_ITEMS}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los estados</SelectItem>
            {(Object.keys(STATUS_LABELS) as ClaimStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={claimType} onValueChange={(v) => setClaimType(v ?? ALL)} items={CLAIM_TYPE_SELECT_ITEMS}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los tipos</SelectItem>
            {Object.entries(CLAIM_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input className="w-36" placeholder="ID cliente" value={customerId} onChange={(e) => setCustomerId(e.target.value)} />
        <Input className="w-36" placeholder="ID producto" value={productId} onChange={(e) => setProductId(e.target.value)} />
        <Input className="w-36" placeholder="ID vendedor" value={sellerId} onChange={(e) => setSellerId(e.target.value)} />
        <Button type="submit">Buscar</Button>
      </form>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando reclamos...</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{total} coincidencias</p>
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claim ID</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Creado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.map((c) => (
                  <TableRow key={c.claim_id}>
                    <TableCell>
                      <Link
                        to={`/claims/${c.claim_id}`}
                        title={c.claim_id}
                        className="font-mono text-xs font-medium text-primary hover:underline"
                      >
                        {c.claim_id}
                      </Link>
                    </TableCell>
                    <TableCell>{CLAIM_TYPE_LABELS[c.claim_type as ClaimType] ?? c.claim_type}</TableCell>
                    <TableCell>{CHANNEL_LABELS[c.channel as Channel] ?? c.channel}</TableCell>
                    <TableCell><PriorityBadge priority={c.priority} /></TableCell>
                    <TableCell><StatusBadge status={c.current_status} /></TableCell>
                    <TableCell>{c.customer.name}</TableCell>
                    <TableCell>{c.product.name}</TableCell>
                    <TableCell>{new Date(c.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {claims.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No hay reclamos con esos filtros.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {(() => {
            const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
            const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
            const goToPage = (page: number) => load((page - 1) * PAGE_SIZE);

            return (
              <div className="flex flex-col items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {Math.min(offset + 1, total)}-{Math.min(offset + PAGE_SIZE, total)} de {total}
                </span>
                {totalPages > 1 && (
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          text="Anterior"
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage > 1) goToPage(currentPage - 1);
                          }}
                        />
                      </PaginationItem>
                      {getPageNumbers(currentPage, totalPages).map((p, idx) =>
                        p === "ellipsis" ? (
                          <PaginationItem key={`ellipsis-${idx}`}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        ) : (
                          <PaginationItem key={p}>
                            <PaginationLink
                              href="#"
                              isActive={p === currentPage}
                              onClick={(e) => {
                                e.preventDefault();
                                goToPage(p);
                              }}
                            >
                              {p}
                            </PaginationLink>
                          </PaginationItem>
                        )
                      )}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          text="Siguiente"
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage < totalPages) goToPage(currentPage + 1);
                          }}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
