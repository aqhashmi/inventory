"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/session";
import { categorySchema } from "@/lib/validations/category";
import { type ActionResult, zodFieldErrors } from "@/lib/actions/types";

export async function createCategory(values: unknown): Promise<ActionResult> {
  const { organizationId } = await requireOrg();
  const parsed = categorySchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  try {
    await prisma.category.create({
      data: {
        organizationId,
        name: parsed.data.name,
        description: parsed.data.description || null,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        error: "A category with that name already exists.",
        fieldErrors: { name: ["Name already in use"] },
      };
    }
    throw error;
  }

  revalidatePath("/categories");
  revalidatePath("/inventory");
  return { success: true, message: "Category created." };
}

export async function updateCategory(
  id: string,
  values: unknown,
): Promise<ActionResult> {
  const { organizationId } = await requireOrg();
  const parsed = categorySchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  // Scope the update by organizationId so tenants can't touch each other's rows.
  const result = await prisma.category.updateMany({
    where: { id, organizationId },
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
    },
  });
  if (result.count === 0) {
    return { success: false, error: "Category not found." };
  }

  revalidatePath("/categories");
  revalidatePath("/inventory");
  return { success: true, message: "Category updated." };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const { organizationId } = await requireOrg();

  // Products keep existing; their categoryId is set null via the relation rule.
  const result = await prisma.category.deleteMany({
    where: { id, organizationId },
  });
  if (result.count === 0) {
    return { success: false, error: "Category not found." };
  }

  revalidatePath("/categories");
  revalidatePath("/inventory");
  return { success: true, message: "Category deleted." };
}
