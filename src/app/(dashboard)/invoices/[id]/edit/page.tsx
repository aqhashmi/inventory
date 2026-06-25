import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/session";
import { toNumber } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import {
  InvoiceForm,
  type ProductOption,
} from "@/components/invoices/invoice-form";

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function EditInvoicePage({
  params,
}: {
  params: { id: string };
}) {
  const { organizationId } = await requireOrg();

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, organizationId },
    include: { lineItems: { orderBy: { sortOrder: "asc" } } },
  });
  if (!invoice) notFound();
  if (invoice.status !== "DRAFT") {
    // Finalized invoices are immutable; send the user to the detail view.
    redirect(`/invoices/${invoice.id}`);
  }

  const [customers, products, org] = await Promise.all([
    prisma.customer.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { currency: true },
    }),
  ]);

  const productOptions: ProductOption[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    unitPrice: toNumber(p.unitPrice),
    taxRate: toNumber(p.taxRate),
    quantityOnHand: p.quantityOnHand,
    unitOfMeasure: p.unitOfMeasure,
  }));

  const defaultValues = {
    customerId: invoice.customerId,
    issueDate: toDateInput(invoice.issueDate),
    dueDate: toDateInput(invoice.dueDate),
    paymentTerms: invoice.paymentTerms ?? "",
    notes: invoice.notes ?? "",
    terms: invoice.terms ?? "",
    discountType: invoice.discountType,
    discountValue: toNumber(invoice.discountValue),
    lineItems: invoice.lineItems.map((l) => ({
      productId: l.productId ?? "",
      description: l.description,
      quantity: l.quantity,
      unitPrice: toNumber(l.unitPrice),
      taxRate: toNumber(l.taxRate),
    })),
  };

  return (
    <>
      <Link
        href={`/invoices/${invoice.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to invoice
      </Link>
      <PageHeader
        title={`Edit ${invoice.number}`}
        description="Draft invoice — changes don't affect stock until finalized."
      />
      <InvoiceForm
        mode="edit"
        invoiceId={invoice.id}
        customers={customers}
        products={productOptions}
        currency={org?.currency ?? "USD"}
        defaultValues={defaultValues}
      />
    </>
  );
}
