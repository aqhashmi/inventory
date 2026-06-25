"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { formatCurrency } from "@/lib/utils";
import { deleteProduct } from "@/lib/actions/products";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ProductFormDialog } from "@/components/inventory/product-form-dialog";
import { StockAdjustDialog } from "@/components/inventory/stock-adjust-dialog";
import { CsvImportDialog } from "@/components/inventory/csv-import-dialog";

export interface ProductRow {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  unitPrice: number;
  costPrice: number;
  quantityOnHand: number;
  reorderLevel: number;
  unitOfMeasure: string;
  taxRate: number;
  isActive: boolean;
}

interface ProductsClientProps {
  products: ProductRow[];
  categories: { id: string; name: string }[];
  currency: string;
}

const ALL = "__all__";
const LOW = "__low__";

export function ProductsClient({
  products,
  categories,
  currency,
}: ProductsClientProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL);
  const [sorting, setSorting] = useState<SortingState>([]);

  // Dialog state.
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | undefined>(undefined);
  const [stockFor, setStockFor] = useState<ProductRow | null>(null);
  const [deleting, setDeleting] = useState<ProductRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (q && !`${p.sku} ${p.name}`.toLowerCase().includes(q)) return false;
      if (categoryFilter === LOW) {
        return p.quantityOnHand <= p.reorderLevel;
      }
      if (categoryFilter !== ALL && p.categoryId !== categoryFilter) {
        return false;
      }
      return true;
    });
  }, [products, search, categoryFilter]);

  const columns = useMemo<ColumnDef<ProductRow>[]>(
    () => [
      {
        accessorKey: "sku",
        header: ({ column }) => (
          <SortHeader column={column} label="SKU" />
        ),
        cell: ({ row }) => (
          <Link
            href={`/inventory/${row.original.id}`}
            className="font-medium text-primary hover:underline"
          >
            {row.original.sku}
          </Link>
        ),
      },
      {
        accessorKey: "name",
        header: ({ column }) => <SortHeader column={column} label="Name" />,
      },
      {
        accessorKey: "categoryName",
        header: "Category",
        cell: ({ row }) =>
          row.original.categoryName ?? (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "unitPrice",
        header: ({ column }) => <SortHeader column={column} label="Price" />,
        cell: ({ row }) => formatCurrency(row.original.unitPrice, currency),
      },
      {
        accessorKey: "quantityOnHand",
        header: ({ column }) => <SortHeader column={column} label="Stock" />,
        cell: ({ row }) => <StockCell product={row.original} />,
      },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) =>
          row.original.isActive ? (
            <Badge variant="success">Active</Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          ),
      },
      {
        id: "actions",
        cell: ({ row }) => (
          <RowActions
            product={row.original}
            onEdit={() => {
              setEditing(row.original);
              setFormOpen(true);
            }}
            onStock={() => setStockFor(row.original)}
            onDelete={() => setDeleting(row.original)}
          />
        ),
      },
    ],
    [currency],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  async function confirmDelete() {
    if (!deleting) return;
    setDeletePending(true);
    const result = await deleteProduct(deleting.id);
    setDeletePending(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? "Deleted.");
    setDeleting(null);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search SKU or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              <SelectItem value={LOW}>Low stock only</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
          <Button
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            New product
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={products.length === 0 ? "No products yet" : "No matches"}
          description={
            products.length === 0
              ? "Add your first product or import a CSV to get started."
              : "Try adjusting your search or filters."
          }
        >
          {products.length === 0 && (
            <Button
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              New product
            </Button>
          )}
        </EmptyState>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden rounded-lg border bg-card md:block">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((p) => (
              <Card key={p.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <Link
                        href={`/inventory/${p.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {p.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{p.sku}</p>
                    </div>
                    <RowActions
                      product={p}
                      onEdit={() => {
                        setEditing(p);
                        setFormOpen(true);
                      }}
                      onStock={() => setStockFor(p)}
                      onDelete={() => setDeleting(p)}
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {p.categoryName ?? "Uncategorized"}
                    </span>
                    <span className="font-medium">
                      {formatCurrency(p.unitPrice, currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <StockCell product={p} />
                    {p.isActive ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Dialogs */}
      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        categories={categories}
        product={editing}
      />
      {stockFor && (
        <StockAdjustDialog
          open={Boolean(stockFor)}
          onOpenChange={(o) => !o && setStockFor(null)}
          product={stockFor}
        />
      )}
      <CsvImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete product?"
        description={`This permanently removes “${deleting?.name}” and its stock history. Invoices referencing it keep their line items.`}
        confirmLabel="Delete"
        loading={deletePending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function SortHeader({
  column,
  label,
}: {
  column: {
    toggleSorting: (desc?: boolean) => void;
    getIsSorted: () => false | "asc" | "desc";
  };
  label: string;
}) {
  return (
    <button
      className="flex items-center gap-1 font-medium hover:text-foreground"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label}
      <ArrowUpDown className="h-3.5 w-3.5" />
    </button>
  );
}

function StockCell({ product }: { product: ProductRow }) {
  const low = product.quantityOnHand <= product.reorderLevel;
  return (
    <div className="flex items-center gap-2">
      <span className={low ? "font-medium text-destructive" : ""}>
        {product.quantityOnHand} {product.unitOfMeasure}
      </span>
      {low && <Badge variant="warning">Low</Badge>}
    </div>
  );
}

function RowActions({
  product,
  onEdit,
  onStock,
  onDelete,
}: {
  product: ProductRow;
  onEdit: () => void;
  onStock: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil className="h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onStock}>
          <TrendingUp className="h-4 w-4" />
          Adjust stock
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/inventory/${product.id}`}>
            <Package className="h-4 w-4" />
            View details
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={onDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
