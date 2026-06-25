"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/session";
import { stockAdjustmentSchema } from "@/lib/validations/stock";
import { type ActionResult, zodFieldErrors } from "@/lib/actions/types";

export async function adjustStock(values: unknown): Promise<ActionResult> {
  const { organizationId, userId } = await requireOrg();
  const parsed = stockAdjustmentSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const { productId, type, quantityChange, reason } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: productId, organizationId },
        select: { quantityOnHand: true },
      });
      if (!product) {
        throw new Error("Product not found");
      }

      const newQuantity = product.quantityOnHand + quantityChange;
      if (newQuantity < 0) {
        throw new Error(
          `Adjustment would drop stock below zero (current: ${product.quantityOnHand}).`,
        );
      }

      await tx.product.update({
        where: { id: productId },
        data: { quantityOnHand: newQuantity },
      });

      await tx.stockAdjustment.create({
        data: {
          organizationId,
          productId,
          type,
          quantityChange,
          previousQuantity: product.quantityOnHand,
          newQuantity,
          reason: reason || null,
          createdById: userId,
        },
      });
    });
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Could not adjust stock.",
    };
  }

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${productId}`);
  revalidatePath("/dashboard");
  return { success: true, message: "Stock adjusted." };
}
