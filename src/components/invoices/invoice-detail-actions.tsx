"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Ban,
  CheckCircle2,
  CreditCard,
  Download,
  MoreHorizontal,
  Pencil,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { InvoiceStatus } from "@prisma/client";

import {
  deleteInvoice,
  finalizeInvoice,
  updateInvoiceStatus,
} from "@/lib/actions/invoices";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RecordPaymentDialog } from "@/components/invoices/record-payment-dialog";

interface InvoiceDetailActionsProps {
  invoiceId: string;
  status: InvoiceStatus;
  balance: number;
  currency: string;
}

export function InvoiceDetailActions({
  invoiceId,
  status,
  balance,
  currency,
}: InvoiceDetailActionsProps) {
  const router = useRouter();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | "delete" | "cancel">(null);
  const [pending, setPending] = useState(false);

  const isDraft = status === "DRAFT";
  const isCancelled = status === "CANCELLED";
  const isPaid = status === "PAID";
  const canPay = !isDraft && !isCancelled && balance > 0.005;

  async function run(
    fn: () => Promise<{ success: boolean; error?: string; message?: string }>,
  ) {
    setPending(true);
    const result = await fn();
    setPending(false);
    if (!result.success) {
      toast.error(result.error ?? "Something went wrong.");
      return false;
    }
    toast.success(result.message ?? "Done.");
    router.refresh();
    return true;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" asChild>
        <a href={`/api/invoices/${invoiceId}/pdf`} target="_blank" rel="noreferrer">
          <Download className="h-4 w-4" />
          PDF
        </a>
      </Button>

      {isDraft && (
        <>
          <Button variant="outline" asChild>
            <Link href={`/invoices/${invoiceId}/edit`}>
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          </Button>
          <Button
            onClick={() => run(() => finalizeInvoice(invoiceId))}
            disabled={pending}
          >
            <Send className="h-4 w-4" />
            Finalize
          </Button>
        </>
      )}

      {canPay && (
        <Button onClick={() => setPaymentOpen(true)}>
          <CreditCard className="h-4 w-4" />
          Record payment
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!isDraft && !isCancelled && !isPaid && (
            <DropdownMenuItem
              onSelect={() =>
                run(() =>
                  updateInvoiceStatus({ invoiceId, status: "PAID" }),
                )
              }
            >
              <CheckCircle2 className="h-4 w-4" />
              Mark as paid
            </DropdownMenuItem>
          )}
          {!isDraft && !isCancelled && (
            <DropdownMenuItem onSelect={() => setConfirm("cancel")}>
              <Ban className="h-4 w-4" />
              Cancel invoice
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setConfirm("delete")}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RecordPaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        invoiceId={invoiceId}
        balance={balance}
        currency={currency}
      />

      <ConfirmDialog
        open={confirm === "cancel"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Cancel this invoice?"
        description="The invoice will be marked cancelled and any deducted stock will be restored."
        confirmLabel="Cancel invoice"
        loading={pending}
        onConfirm={async () => {
          const ok = await run(() =>
            updateInvoiceStatus({ invoiceId, status: "CANCELLED" }),
          );
          if (ok) setConfirm(null);
        }}
      />

      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Delete this invoice?"
        description="This permanently removes the invoice. If it was finalized, deducted stock is restored."
        confirmLabel="Delete"
        loading={pending}
        onConfirm={async () => {
          const ok = await run(() => deleteInvoice(invoiceId));
          if (ok) {
            setConfirm(null);
            router.push("/invoices");
          }
        }}
      />
    </div>
  );
}
