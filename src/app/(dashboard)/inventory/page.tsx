import type { Metadata } from "next";

import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/session";
import { toNumber } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import {
  ProductsClient,
  type ProductRow,
} from "@/components/inventory/products-client";

export const metadata: Metadata = { title: "Inventory — InvoFlow" };

export default async function InventoryPage() {
  const { organizationId } = await requireOrg();

  const [products, categories, org] = await Promise.all([
    prisma.product.findMany({
      where: { organizationId },
      include: { category: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.category.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { currency: true },
    }),
  ]);

  const rows: ProductRow[] = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    description: p.description,
    categoryId: p.categoryId,
    categoryName: p.category?.name ?? null,
    unitPrice: toNumber(p.unitPrice),
    costPrice: toNumber(p.costPrice),
    quantityOnHand: p.quantityOnHand,
    reorderLevel: p.reorderLevel,
    unitOfMeasure: p.unitOfMeasure,
    taxRate: toNumber(p.taxRate),
    isActive: p.isActive,
  }));

  const lowStock = rows.filter(
    (p) => p.quantityOnHand <= p.reorderLevel,
  ).length;

  return (
    <>
      <PageHeader
        title="Inventory"
        description={
          lowStock > 0
            ? `${rows.length} products · ${lowStock} at or below reorder level`
            : `${rows.length} products`
        }
      />
      <ProductsClient
        products={rows}
        categories={categories}
        currency={org?.currency ?? "USD"}
      />
    </>
  );
}
