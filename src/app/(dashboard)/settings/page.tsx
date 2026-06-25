import type { Metadata } from "next";

import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/session";
import { toNumber } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import type { OrganizationInput } from "@/lib/validations/organization";

export const metadata: Metadata = { title: "Settings — InvoFlow" };

export default async function SettingsPage() {
  const { organizationId } = await requireOrg();
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
  });

  const defaultValues: OrganizationInput = {
    name: org.name,
    email: org.email ?? "",
    phone: org.phone ?? "",
    website: org.website ?? "",
    taxId: org.taxId ?? "",
    logoUrl: org.logoUrl ?? "",
    addressLine1: org.addressLine1 ?? "",
    addressLine2: org.addressLine2 ?? "",
    city: org.city ?? "",
    state: org.state ?? "",
    postalCode: org.postalCode ?? "",
    country: org.country ?? "",
    currency: org.currency,
    invoicePrefix: org.invoicePrefix,
    defaultTaxRate: toNumber(org.defaultTaxRate),
  };

  return (
    <>
      <PageHeader
        title="Settings"
        description="Company details shown on invoices and PDF exports."
      />
      <SettingsForm defaultValues={defaultValues} />
    </>
  );
}
