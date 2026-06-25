import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/session";
import { toNumber } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import {
  InvoiceForm,
  type ProductOption,
} from "@/components/invoices/invoice-form";

export const metadata: Metadata = { title: "New invoice — InvoFlow" };

export default async function NewInvoicePage() {
  const { organizationId } = await requireOrg();

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

  return (
    <>
      <Link
        href="/invoices"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to invoices
      </Link>
      <PageHeader
        title="New invoice"
        description="Add line items from inventory or enter custom items."
      />
      <InvoiceForm
        mode="create"
        customers={customers}
        products={productOptions}
        currency={org?.currency ?? "USD"}
      />
    </>
  );
}
