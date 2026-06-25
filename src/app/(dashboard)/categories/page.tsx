import type { Metadata } from "next";

import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import {
  CategoriesClient,
  type CategoryRow,
} from "@/components/inventory/categories-client";

export const metadata: Metadata = { title: "Categories — InvoFlow" };

export default async function CategoriesPage() {
  const { organizationId } = await requireOrg();

  const categories = await prisma.category.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });

  const rows: CategoryRow[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    productCount: c._count.products,
  }));

  return (
    <>
      <PageHeader
        title="Categories"
        description="Organize your inventory into categories."
      />
      <CategoriesClient categories={rows} />
    </>
  );
}
