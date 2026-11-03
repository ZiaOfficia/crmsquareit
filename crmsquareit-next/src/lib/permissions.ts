export const MODULES = [
  { key: "customers", label: "Customers" },
  { key: "leads", label: "Leads" },
  { key: "invoices", label: "Invoices" },
  { key: "estimates", label: "Estimates" },
  { key: "payments", label: "Payments" },
  { key: "expenses", label: "Expenses" },
  { key: "projects", label: "Projects" },
  { key: "tasks", label: "Tasks" },
  { key: "tickets", label: "Support" },
  { key: "reports", label: "Reports" },
  { key: "staff", label: "Staff" },
  { key: "settings", label: "Settings" },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];
export const ACTIONS = ["view", "create", "edit", "delete"] as const;
export type Action = (typeof ACTIONS)[number];
export type PermissionMap = Partial<Record<ModuleKey, Action[]>>;

export function parsePermissions(json?: string | null): PermissionMap {
  try {
    return json ? JSON.parse(json) : {};
  } catch {
    return {};
  }
}

export type PermUser = { isAdmin: boolean; permissions: PermissionMap };

export function can(user: PermUser | null | undefined, module: ModuleKey, action: Action = "view") {
  if (!user) return false;
  if (user.isAdmin) return true;
  return !!user.permissions[module]?.includes(action);
}
