import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/session";
import { formatCurrency, formatDate, toNumber } from "@/lib/utils";
import { effectiveStatus, formatAddress } from "@/lib/invoice-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InvoiceStatusBadge } from "@/components/status-badge";
import { InvoiceDetailActions } from "@/components/invoices/invoice-detail-actions";
import { PaymentsList } from "@/components/invoices/payments-list";

export default async function InvoiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { organizationId } = await requireOrg();

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, organizationId },
    include: {
      customer: true,
      lineItems: { orderBy: { sortOrder: "asc" } },
      payments: { orderBy: { paidAt: "desc" } },
      organization: true,
    },
  });
  if (!invoice) notFound();

  const currency = invoice.currency;
  const total = toNumber(invoice.total);
  const amountPaid = toNumber(invoice.amountPaid);
  const balance = total - amountPaid;
  const display = effectiveStatus(invoice.status, invoice.dueDate);
  const org = invoice.organization;
  const c = invoice.customer;

  return (
    <div className="space-y-6">
      <Link
        href="/invoices"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to invoices
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {invoice.number}
            </h1>
            <InvoiceStatusBadge status={display} />
          </div>
          <p className="text-sm text-muted-foreground">
            Issued {formatDate(invoice.issueDate)} · Due{" "}
            {formatDate(invoice.dueDate)}
          </p>
        </div>
        <InvoiceDetailActions
          invoiceId={invoice.id}
          status={invoice.status}
          balance={balance}
          currency={currency}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Parties */}
          <Card>
            <CardContent className="grid gap-6 p-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  From
                </p>
                <p className="mt-1 font-medium">{org.name}</p>
                {org.email && (
                  <p className="text-sm text-muted-foreground">{org.email}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  {formatAddress([
                    org.addressLine1,
                    org.city,
                    org.state,
                    org.postalCode,
                    org.country,
                  ])}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Bill to
                </p>
                <p className="mt-1 font-medium">{c.name}</p>
                {c.email && (
                  <p className="text-sm text-muted-foreground">{c.email}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  {formatAddress([
                    c.billingAddressLine1,
                    c.billingCity,
                    c.billingState,
                    c.billingPostalCode,
                    c.billingCountry,
                  ])}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Line items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Line items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit price</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.lineItems.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">
                        {l.description}
                      </TableCell>
                      <TableCell className="text-right">{l.quantity}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(toNumber(l.unitPrice), currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {toNumber(l.taxRate)}%
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(toNumber(l.lineTotal), currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 flex justify-end">
                <div className="w-full max-w-xs space-y-1 text-sm">
                  <Row
                    label="Subtotal"
                    value={formatCurrency(toNumber(invoice.subtotal), currency)}
                  />
                  {toNumber(invoice.discountTotal) > 0 && (
                    <Row
                      label="Discount"
                      value={`− ${formatCurrency(toNumber(invoice.discountTotal), currency)}`}
                    />
                  )}
                  <Row
                    label="Tax"
                    value={formatCurrency(toNumber(invoice.taxTotal), currency)}
                  />
                  <Separator className="my-2" />
                  <div className="flex justify-between text-base font-semibold">
                    <span>Total</span>
                    <span>{formatCurrency(total, currency)}</span>
                  </div>
                  <Row
                    label="Paid"
                    value={formatCurrency(amountPaid, currency)}
                  />
                  <div className="flex justify-between font-medium">
                    <span>Balance due</span>
                    <span>{formatCurrency(balance, currency)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {(invoice.notes || invoice.terms) && (
            <Card>
              <CardContent className="space-y-3 p-6 text-sm">
                {invoice.notes && (
                  <div>
                    <p className="font-medium">Notes</p>
                    <p className="text-muted-foreground">{invoice.notes}</p>
                  </div>
                )}
                {invoice.terms && (
                  <div>
                    <p className="font-medium">Terms</p>
                    <p className="text-muted-foreground">{invoice.terms}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar: payments */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <PaymentsList
                payments={invoice.payments.map((p) => ({
                  id: p.id,
                  amount: toNumber(p.amount),
                  method: p.method,
                  reference: p.reference,
                  paidAt: p.paidAt.toISOString(),
                }))}
                currency={currency}
                canEdit={invoice.status !== "CANCELLED"}
              />
            </CardContent>
          </Card>

          {invoice.paymentTerms && (
            <Card>
              <CardContent className="p-6 text-sm">
                <p className="font-medium">Payment terms</p>
                <p className="text-muted-foreground">{invoice.paymentTerms}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
