import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  DollarSign,
  FileClock,
  Package,
  TrendingUp,
} from "lucide-react";

import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/session";
import { formatCurrency, formatDate, toNumber } from "@/lib/utils";
import { effectiveStatus } from "@/lib/invoice-utils";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InvoiceStatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import {
  RevenueChart,
  type RevenuePoint,
} from "@/components/dashboard/revenue-chart";

export const metadata: Metadata = { title: "Dashboard — InvoFlow" };

export default async function DashboardPage() {
  const { organizationId, name } = await requireOrg();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [
    org,
    paymentsAgg,
    paidThisMonthAgg,
    openInvoices,
    products,
    recentPayments,
    recentInvoices,
    recentMovements,
    topProductsRaw,
  ] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { currency: true },
    }),
    prisma.payment.aggregate({
      where: { organizationId },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { organizationId, paidAt: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.invoice.findMany({
      where: { organizationId, status: { in: ["SENT", "OVERDUE"] } },
      select: { total: true, amountPaid: true },
    }),
    prisma.product.findMany({
      where: { organizationId },
      select: { quantityOnHand: true, reorderLevel: true },
    }),
    prisma.payment.findMany({
      where: { organizationId, paidAt: { gte: sixMonthsAgo } },
      select: { amount: true, paidAt: true },
    }),
    prisma.invoice.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { customer: { select: { name: true } } },
    }),
    prisma.stockAdjustment.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { product: { select: { name: true } } },
    }),
    prisma.invoiceLineItem.groupBy({
      by: ["productId"],
      where: {
        productId: { not: null },
        invoice: {
          organizationId,
          status: { in: ["SENT", "OVERDUE", "PAID"] },
        },
      },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { lineTotal: "desc" } },
      take: 5,
    }),
  ]);

  const currency = org?.currency ?? "USD";

  const totalRevenue = toNumber(paymentsAgg._sum.amount);
  const paidThisMonth = toNumber(paidThisMonthAgg._sum.amount);
  const outstanding = openInvoices.reduce(
    (sum, inv) => sum + (toNumber(inv.total) - toNumber(inv.amountPaid)),
    0,
  );
  const lowStockCount = products.filter(
    (p) => p.quantityOnHand <= p.reorderLevel,
  ).length;

  // Build the trailing 6-month revenue series.
  const months: RevenuePoint[] = [];
  const buckets = new Map<string, number>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    buckets.set(key, 0);
    months.push({
      month: d.toLocaleString("en-US", { month: "short" }),
      revenue: 0,
    });
  }
  for (const p of recentPayments) {
    const d = new Date(p.paidAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (buckets.has(key)) {
      buckets.set(key, buckets.get(key)! + toNumber(p.amount));
    }
  }
  let idx = 0;
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    months[idx].revenue = Math.round((buckets.get(key) ?? 0) * 100) / 100;
    idx++;
  }

  // Resolve top product names.
  const topProductIds = topProductsRaw
    .map((t) => t.productId)
    .filter((id): id is string => Boolean(id));
  const topProductNames = await prisma.product.findMany({
    where: { id: { in: topProductIds } },
    select: { id: true, name: true, sku: true },
  });
  const nameById = new Map(topProductNames.map((p) => [p.id, p]));
  const topProducts = topProductsRaw.map((t) => ({
    id: t.productId!,
    name: nameById.get(t.productId!)?.name ?? "Unknown",
    sku: nameById.get(t.productId!)?.sku ?? "",
    quantity: t._sum.quantity ?? 0,
    revenue: toNumber(t._sum.lineTotal),
  }));

  return (
    <>
      <PageHeader
        title={`Welcome back${name ? `, ${name.split(" ")[0]}` : ""}`}
        description="Here's how your business is doing."
      />

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total revenue"
          value={formatCurrency(totalRevenue, currency)}
          icon={DollarSign}
          hint="All payments received"
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(outstanding, currency)}
          icon={FileClock}
          hint="Unpaid sent invoices"
        />
        <StatCard
          label="Paid this month"
          value={formatCurrency(paidThisMonth, currency)}
          icon={TrendingUp}
          hint={now.toLocaleString("en-US", { month: "long" })}
        />
        <StatCard
          label="Low-stock items"
          value={String(lowStockCount)}
          icon={AlertTriangle}
          hint="At or below reorder level"
          highlight={lowStockCount > 0}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Revenue (last 6 months)</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={months} currency={currency} />
          </CardContent>
        </Card>

        {/* Top products */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top-selling products</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No sales recorded yet.
              </p>
            ) : (
              <div className="space-y-3">
                {topProducts.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.quantity} sold
                      </p>
                    </div>
                    <span className="text-sm font-medium">
                      {formatCurrency(p.revenue, currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent invoices */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Recent invoices</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/invoices">
                View all
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentInvoices.length === 0 ? (
              <EmptyState
                icon={FileClock}
                title="No invoices yet"
                description="Create your first invoice to see it here."
              />
            ) : (
              <div className="divide-y">
                {recentInvoices.map((inv) => (
                  <Link
                    key={inv.id}
                    href={`/invoices/${inv.id}`}
                    className="flex items-center justify-between py-3 hover:bg-muted/40"
                  >
                    <div>
                      <p className="text-sm font-medium">{inv.number}</p>
                      <p className="text-xs text-muted-foreground">
                        {inv.customer.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <InvoiceStatusBadge
                        status={effectiveStatus(inv.status, inv.dueDate)}
                      />
                      <span className="text-sm font-medium">
                        {formatCurrency(toNumber(inv.total), currency)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent stock movements */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Recent stock movements</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/inventory">
                Inventory
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentMovements.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No stock movements"
                description="Stock changes will appear here."
              />
            ) : (
              <div className="divide-y">
                {recentMovements.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{m.product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(m.createdAt)} · {m.reason ?? m.type}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{m.type}</Badge>
                      <span
                        className={`text-sm font-medium ${
                          m.quantityChange >= 0
                            ? "text-emerald-600"
                            : "text-destructive"
                        }`}
                      >
                        {m.quantityChange >= 0 ? "+" : ""}
                        {m.quantityChange}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  icon: typeof DollarSign;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <Icon
            className={`h-4 w-4 ${
              highlight ? "text-destructive" : "text-muted-foreground"
            }`}
          />
        </div>
        <p
          className={`mt-2 text-2xl font-bold ${
            highlight ? "text-destructive" : ""
          }`}
        >
          {value}
        </p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
