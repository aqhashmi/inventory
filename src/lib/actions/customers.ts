"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/session";
import { customerSchema } from "@/lib/validations/customer";
import { type ActionResult, zodFieldErrors } from "@/lib/actions/types";

function normalize(values: Record<string, unknown>) {
  // Convert "" to null for all optional fields.
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    out[k] = v === "" ? null : v;
  }
  return out;
}

export async function createCustomer(
  values: unknown,
): Promise<ActionResult<{ id: string }>> {
  const { organizationId } = await requireOrg();
  const parsed = customerSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const customer = await prisma.customer.create({
    data: {
      ...(normalize(parsed.data) as Prisma.CustomerUncheckedCreateInput),
      organizationId,
      name: parsed.data.name,
    },
  });

  revalidatePath("/customers");
  revalidatePath("/invoices");
  return { success: true, data: { id: customer.id }, message: "Customer created." };
}

export async function updateCustomer(
  id: string,
  values: unknown,
): Promise<ActionResult> {
  const { organizationId } = await requireOrg();
  const parsed = customerSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const result = await prisma.customer.updateMany({
    where: { id, organizationId },
    data: {
      ...(normalize(parsed.data) as Prisma.CustomerUncheckedUpdateManyInput),
      name: parsed.data.name,
    },
  });
  if (result.count === 0) {
    return { success: false, error: "Customer not found." };
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { success: true, message: "Customer updated." };
}

export async function deleteCustomer(id: string): Promise<ActionResult> {
  const { organizationId } = await requireOrg();

  // Block deletion when invoices reference the customer (FK is Restrict).
  const invoiceCount = await prisma.invoice.count({
    where: { customerId: id, organizationId },
  });
  if (invoiceCount > 0) {
    return {
      success: false,
      error: `Cannot delete: ${invoiceCount} invoice(s) reference this customer.`,
    };
  }

  const result = await prisma.customer.deleteMany({
    where: { id, organizationId },
  });
  if (result.count === 0) {
    return { success: false, error: "Customer not found." };
  }

  revalidatePath("/customers");
  return { success: true, message: "Customer deleted." };
}
