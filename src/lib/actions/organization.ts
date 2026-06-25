"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/session";
import { organizationSchema } from "@/lib/validations/organization";
import { type ActionResult, zodFieldErrors } from "@/lib/actions/types";

export async function updateOrganization(
  values: unknown,
): Promise<ActionResult> {
  const { organizationId } = await requireOrg();
  const parsed = organizationSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const d = parsed.data;
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      name: d.name,
      email: d.email || null,
      phone: d.phone || null,
      website: d.website || null,
      taxId: d.taxId || null,
      logoUrl: d.logoUrl || null,
      addressLine1: d.addressLine1 || null,
      addressLine2: d.addressLine2 || null,
      city: d.city || null,
      state: d.state || null,
      postalCode: d.postalCode || null,
      country: d.country || null,
      currency: d.currency,
      invoicePrefix: d.invoicePrefix,
      defaultTaxRate: d.defaultTaxRate,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: true, message: "Settings saved." };
}
