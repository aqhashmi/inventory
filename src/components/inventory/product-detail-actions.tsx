"use client";

import { useState } from "react";
import { Pencil, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProductFormDialog } from "@/components/inventory/product-form-dialog";
import { StockAdjustDialog } from "@/components/inventory/stock-adjust-dialog";
import type { ProductRow } from "@/components/inventory/products-client";

interface ProductDetailActionsProps {
  product: ProductRow;
  categories: { id: string; name: string }[];
}

export function ProductDetailActions({
  product,
  categories,
}: ProductDetailActionsProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setStockOpen(true)}>
        <TrendingUp className="h-4 w-4" />
        Adjust stock
      </Button>
      <Button onClick={() => setEditOpen(true)}>
        <Pencil className="h-4 w-4" />
        Edit
      </Button>

      <ProductFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        categories={categories}
        product={product}
      />
      <StockAdjustDialog
        open={stockOpen}
        onOpenChange={setStockOpen}
        product={product}
      />
    </>
  );
}
