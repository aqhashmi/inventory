import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";

import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/session";
import { formatCurrency, formatDate, toNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { ProductDetailActions } from "@/components/inventory/product-detail-actions";
import type { ProductRow } from "@/components/inventory/products-client";

export default async function ProductDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { organizationId } = await requireOrg();

  const product = await prisma.product.findFirst({
    where: { id: params.id, organizationId },
    include: {
      category: { select: { name: true } },
      stockAdjustments: {
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { createdBy: { select: { name: true } } },
      },
      organization: { select: { currency: true } },
    },
  });

  if (!product) notFound();

  const categories = await prisma.category.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const currency = product.organization.currency;
  const low = product.quantityOnHand <= product.reorderLevel;

  const productRow: ProductRow = {
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    categoryId: product.categoryId,
    categoryName: product.category?.name ?? null,
    unitPrice: toNumber(product.unitPrice),
    costPrice: toNumber(product.costPrice),
    quantityOnHand: product.quantityOnHand,
    reorderLevel: product.reorderLevel,
    unitOfMeasure: product.unitOfMeasure,
    taxRate: toNumber(product.taxRate),
    isActive: product.isActive,
  };

  return (
    <div className="space-y-6">
      <Link
        href="/inventory"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to inventory
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
            {product.isActive ? (
              <Badge variant="success">Active</Badge>
            ) : (
              <Badge variant="secondary">Inactive</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            SKU {product.sku}
            {product.category && ` · ${product.category.name}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ProductDetailActions product={productRow} categories={categories} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="On hand"
          value={`${product.quantityOnHand} ${product.unitOfMeasure}`}
          highlight={low}
          sub={low ? `At/below reorder (${product.reorderLevel})` : undefined}
        />
        <StatCard
          label="Unit price"
          value={formatCurrency(toNumber(product.unitPrice), currency)}
        />
        <StatCard
          label="Cost price"
          value={formatCurrency(toNumber(product.costPrice), currency)}
        />
        <StatCard label="Tax rate" value={`${toNumber(product.taxRate)}%`} />
      </div>

      {product.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Description</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {product.description}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Stock movement log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {product.stockAdjustments.length === 0 ? (
            <EmptyState
              icon={History}
              title="No stock movements yet"
              description="Adjustments and sales will appear here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {product.stockAdjustments.map((adj) => (
                  <TableRow key={adj.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(adj.createdAt, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{adj.type}</Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        adj.quantityChange >= 0
                          ? "text-emerald-600"
                          : "text-destructive"
                      }`}
                    >
                      {adj.quantityChange >= 0 ? "+" : ""}
                      {adj.quantityChange}
                    </TableCell>
                    <TableCell className="text-right">
                      {adj.newQuantity}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {adj.reason ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {adj.createdBy?.name ?? "System"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p
          className={`mt-1 text-2xl font-bold ${
            highlight ? "text-destructive" : ""
          }`}
        >
          {value}
        </p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
