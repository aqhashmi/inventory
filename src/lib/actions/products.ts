"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/session";
import {
  csvProductRowSchema,
  productSchema,
  productUpdateSchema,
} from "@/lib/validations/product";
import { type ActionResult, zodFieldErrors } from "@/lib/actions/types";

export async function createProduct(values: unknown): Promise<ActionResult> {
  const { organizationId, userId } = await requireOrg();
  const parsed = productSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const data = parsed.data;
  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          organizationId,
          sku: data.sku,
          name: data.name,
          description: data.description || null,
          categoryId: data.categoryId || null,
          unitPrice: data.unitPrice,
          costPrice: data.costPrice,
          quantityOnHand: data.quantityOnHand,
          reorderLevel: data.reorderLevel,
          unitOfMeasure: data.unitOfMeasure,
          taxRate: data.taxRate,
          isActive: data.isActive,
        },
      });

      // Record opening stock as an audit entry.
      if (data.quantityOnHand !== 0) {
        await tx.stockAdjustment.create({
          data: {
            organizationId,
            productId: product.id,
            type: "INITIAL",
            quantityChange: data.quantityOnHand,
            previousQuantity: 0,
            newQuantity: data.quantityOnHand,
            reason: "Opening stock",
            createdById: userId,
          },
        });
      }
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        error: "A product with that SKU already exists.",
        fieldErrors: { sku: ["SKU already in use"] },
      };
    }
    throw error;
  }

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { success: true, message: "Product created." };
}

export async function updateProduct(
  id: string,
  values: unknown,
): Promise<ActionResult> {
  const { organizationId } = await requireOrg();
  const parsed = productUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const data = parsed.data;
  try {
    const result = await prisma.product.updateMany({
      where: { id, organizationId },
      data: {
        sku: data.sku,
        name: data.name,
        description: data.description || null,
        categoryId: data.categoryId || null,
        unitPrice: data.unitPrice,
        costPrice: data.costPrice,
        reorderLevel: data.reorderLevel,
        unitOfMeasure: data.unitOfMeasure,
        taxRate: data.taxRate,
        isActive: data.isActive,
      },
    });
    if (result.count === 0) {
      return { success: false, error: "Product not found." };
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        error: "A product with that SKU already exists.",
        fieldErrors: { sku: ["SKU already in use"] },
      };
    }
    throw error;
  }

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${id}`);
  return { success: true, message: "Product updated." };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const { organizationId } = await requireOrg();
  const result = await prisma.product.deleteMany({
    where: { id, organizationId },
  });
  if (result.count === 0) {
    return { success: false, error: "Product not found." };
  }

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return { success: true, message: "Product deleted." };
}

interface ImportResult {
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
}

/**
 * Bulk import products from parsed CSV rows. Rows are matched to existing
 * products by SKU (upsert). Unknown categories are created on the fly.
 */
export async function importProducts(
  rows: unknown[],
): Promise<ActionResult<ImportResult>> {
  const { organizationId } = await requireOrg();

  const summary: ImportResult = { created: 0, updated: 0, errors: [] };
  const categoryCache = new Map<string, string>();

  for (let i = 0; i < rows.length; i++) {
    const parsed = csvProductRowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      summary.errors.push({
        row: i + 2, // +2 accounts for header row + 1-based index
        message: parsed.error.issues.map((issue) => issue.message).join(", "),
      });
      continue;
    }

    const row = parsed.data;
    try {
      let categoryId: string | null = null;
      if (row.category) {
        const key = row.category.toLowerCase();
        if (categoryCache.has(key)) {
          categoryId = categoryCache.get(key)!;
        } else {
          const category = await prisma.category.upsert({
            where: {
              organizationId_name: {
                organizationId,
                name: row.category,
              },
            },
            update: {},
            create: { organizationId, name: row.category },
          });
          categoryId = category.id;
          categoryCache.set(key, categoryId);
        }
      }

      const existing = await prisma.product.findUnique({
        where: { organizationId_sku: { organizationId, sku: row.sku } },
        select: { id: true },
      });

      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            name: row.name,
            description: row.description || null,
            categoryId,
            unitPrice: row.unitPrice,
            costPrice: row.costPrice,
            reorderLevel: row.reorderLevel,
            unitOfMeasure: row.unitOfMeasure,
            taxRate: row.taxRate,
          },
        });
        summary.updated += 1;
      } else {
        await prisma.$transaction(async (tx) => {
          const product = await tx.product.create({
            data: {
              organizationId,
              sku: row.sku,
              name: row.name,
              description: row.description || null,
              categoryId,
              unitPrice: row.unitPrice,
              costPrice: row.costPrice,
              quantityOnHand: row.quantityOnHand,
              reorderLevel: row.reorderLevel,
              unitOfMeasure: row.unitOfMeasure,
              taxRate: row.taxRate,
            },
          });
          if (row.quantityOnHand !== 0) {
            await tx.stockAdjustment.create({
              data: {
                organizationId,
                productId: product.id,
                type: "INITIAL",
                quantityChange: row.quantityOnHand,
                previousQuantity: 0,
                newQuantity: row.quantityOnHand,
                reason: "CSV import — opening stock",
              },
            });
          }
        });
        summary.created += 1;
      }
    } catch (error) {
      summary.errors.push({
        row: i + 2,
        message:
          error instanceof Error ? error.message : "Unknown error importing row",
      });
    }
  }

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  return {
    success: true,
    data: summary,
    message: `Imported ${summary.created} new and updated ${summary.updated} products.`,
  };
}
