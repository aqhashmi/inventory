"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  MoreHorizontal,
  Pencil,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { InvoiceStatus } from "@prisma/client";

import { deleteInvoice, finalizeInvoice } from "@/lib/actions/invoices";
import { effectiveStatus } from "@/lib/invoice-utils";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { InvoiceStatusBadge } from "@/components/status-badge";

export interface InvoiceRow {
  id: string;
  number: string;
  customerName: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  total: number;
  amountPaid: number;
  currency: string;
}

const ALL = "__all__";

export function InvoicesClient({ invoices }: { invoices: InvoiceRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [deleting, setDeleting] = useState<InvoiceRow | null>(null);
  const [pending, setPending] = useState(false);

  const rows = useMemo(
    () =>
      invoices.map((inv) => ({
        ...inv,
        display: effectiveStatus(inv.status, inv.dueDate),
      })),
    [invoices],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((inv) => {
      if (q && !`${inv.number} ${inv.customerName}`.toLowerCase().includes(q))
        return false;
      if (statusFilter !== ALL && inv.display !== statusFilter) return false;
      return true;
    });
  }, [rows, search, statusFilter]);

  async function handleFinalize(id: string) {
    setPending(true);
    const result = await finalizeInvoice(id);
    setPending(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? "Finalized.");
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleting) return;
    setPending(true);
    const result = await deleteInvoice(deleting.id);
    setPending(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? "Deleted.");
    setDeleting(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search number or customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="SENT">Sent</SelectItem>
              <SelectItem value="OVERDUE">Overdue</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button asChild>
          <Link href="/invoices/new">
            <FileText className="h-4 w-4" />
            New invoice
          </Link>
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={invoices.length === 0 ? "No invoices yet" : "No matches"}
          description={
            invoices.length === 0
              ? "Create your first invoice to get paid."
              : "Try adjusting your search or filters."
          }
        >
          {invoices.length === 0 && (
            <Button asChild>
              <Link href="/invoices/new">
                <FileText className="h-4 w-4" />
                New invoice
              </Link>
            </Button>
          )}
        </EmptyState>
      ) : (
        <>
          <div className="hidden rounded-lg border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {inv.number}
                      </Link>
                    </TableCell>
                    <TableCell>{inv.customerName}</TableCell>
                    <TableCell>
                      <InvoiceStatusBadge status={inv.display} />
                    </TableCell>
                    <TableCell>{formatDate(inv.issueDate)}</TableCell>
                    <TableCell>{formatDate(inv.dueDate)}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(inv.total, inv.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(inv.total - inv.amountPaid, inv.currency)}
                    </TableCell>
                    <TableCell>
                      <RowMenu
                        invoice={inv}
                        onFinalize={() => handleFinalize(inv.id)}
                        onDelete={() => setDeleting(inv)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {filtered.map((inv) => (
              <Card key={inv.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {inv.number}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {inv.customerName}
                      </p>
                    </div>
                    <RowMenu
                      invoice={inv}
                      onFinalize={() => handleFinalize(inv.id)}
                      onDelete={() => setDeleting(inv)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <InvoiceStatusBadge status={inv.display} />
                    <span className="font-medium">
                      {formatCurrency(inv.total, inv.currency)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Due {formatDate(inv.dueDate)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete invoice?"
        description={`This permanently removes ${deleting?.number}. If it was finalized, the deducted stock is restored.`}
        confirmLabel="Delete"
        loading={pending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function RowMenu({
  invoice,
  onFinalize,
  onDelete,
}: {
  invoice: InvoiceRow;
  onFinalize: () => void;
  onDelete: () => void;
}) {
  const isDraft = invoice.status === "DRAFT";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/invoices/${invoice.id}`}>
            <FileText className="h-4 w-4" />
            View
          </Link>
        </DropdownMenuItem>
        {isDraft && (
          <>
            <DropdownMenuItem asChild>
              <Link href={`/invoices/${invoice.id}/edit`}>
                <Pencil className="h-4 w-4" />
                Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onFinalize}>
              <Send className="h-4 w-4" />
              Finalize
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={onDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
