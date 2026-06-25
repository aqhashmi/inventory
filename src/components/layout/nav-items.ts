import {
  FileText,
  LayoutDashboard,
  Package,
  Settings,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Invoices", href: "/invoices", icon: FileText },
  { title: "Customers", href: "/customers", icon: Users },
  { title: "Inventory", href: "/inventory", icon: Package },
  { title: "Categories", href: "/categories", icon: Tags },
  { title: "Settings", href: "/settings", icon: Settings },
];
