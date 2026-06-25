import type { Metadata } from "next";

import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import {
  CustomersClient,
  type CustomerRow,
} from "@/components/customers/customers-client";

export const metadata: Metadata = { title: "Customers — InvoFlow" };

export default async function CustomersPage() {
  const { organizationId } = await requireOrg();

  const customers = await prisma.customer.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    include: { _count: { select: { invoices: true } } },
  });

  const rows: CustomerRow[] = customers.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    billingAddressLine1: c.billingAddressLine1,
    billingAddressLine2: c.billingAddressLine2,
    billingCity: c.billingCity,
    billingState: c.billingState,
    billingPostalCode: c.billingPostalCode,
    billingCountry: c.billingCountry,
    shippingAddressLine1: c.shippingAddressLine1,
    shippingAddressLine2: c.shippingAddressLine2,
    shippingCity: c.shippingCity,
    shippingState: c.shippingState,
    shippingPostalCode: c.shippingPostalCode,
    shippingCountry: c.shippingCountry,
    notes: c.notes,
    invoiceCount: c._count.invoices,
  }));

  return (
    <>
      <PageHeader
        title="Customers"
        description="Manage the people and companies you invoice."
      />
      <CustomersClient customers={rows} />
    </>
  );
}
