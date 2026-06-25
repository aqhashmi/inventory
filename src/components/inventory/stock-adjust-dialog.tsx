"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { adjustStock } from "@/lib/actions/stock";
import {
  stockAdjustmentSchema,
  stockChangeTypes,
  type StockAdjustmentInput,
} from "@/lib/validations/stock";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const typeLabels: Record<(typeof stockChangeTypes)[number], string> = {
  PURCHASE: "Purchase / received (+)",
  RETURN: "Customer return (+)",
  ADJUSTMENT: "Manual adjustment (±)",
  DAMAGE: "Damage / loss (−)",
  INITIAL: "Set opening stock (±)",
};

interface StockAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: { id: string; name: string; quantityOnHand: number };
}

export function StockAdjustDialog({
  open,
  onOpenChange,
  product,
}: StockAdjustDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<StockAdjustmentInput>({
    resolver: zodResolver(stockAdjustmentSchema),
    defaultValues: {
      productId: product.id,
      type: "PURCHASE",
      quantityChange: 1,
      reason: "",
    },
  });

  useEffect(() => {
    if (open) {
      setServerError(null);
      reset({ productId: product.id, type: "PURCHASE", quantityChange: 1, reason: "" });
    }
  }, [open, product.id, reset]);

  const type = watch("type");
  const quantityChange = watch("quantityChange");
  const projected = product.quantityOnHand + (Number(quantityChange) || 0);

  async function onSubmit(values: StockAdjustmentInput) {
    setServerError(null);
    const result = await adjustStock(values);
    if (!result.success) {
      setServerError(result.error);
      return;
    }
    toast.success(result.message ?? "Stock adjusted.");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            {product.name} — current on hand: {product.quantityOnHand}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </div>
          )}
          <input type="hidden" {...register("productId")} />

          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={type}
              onValueChange={(v) =>
                setValue("type", v as StockAdjustmentInput["type"])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stockChangeTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {typeLabels[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Quantity change (use negative to remove)</Label>
            <Input
              type="number"
              {...register("quantityChange", { valueAsNumber: true })}
            />
            {errors.quantityChange && (
              <p className="text-xs text-destructive">
                {errors.quantityChange.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              New quantity on hand will be{" "}
              <span className="font-medium text-foreground">{projected}</span>.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Input {...register("reason")} placeholder="e.g. stock count" />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Apply adjustment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
