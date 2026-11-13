export const MODULES = [
  { key: "customers", label: "Customers" },
  { key: "leads", label: "Leads" },
  { key: "invoices", label: "Invoices" },
  { key: "estimates", label: "Estimates" },
  { key: "quotations", label: "Quotations" },
  { key: "payments", label: "Payments" },
  { key: "expenses", label: "Expenses" },
  { key: "office_expenses", label: "Office expenses" },
  { key: "projects", label: "Projects" },
  { key: "tasks", label: "Tasks" },
  { key: "tickets", label: "Support" },
  { key: "reports", label: "Reports" },
  { key: "staff", label: "Staff" },
  { key: "hr", label: "HR portal" },
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

/** What everyone in the HR department can do, on top of their role.
 *  Roles & permissions, Settings and the Super Admin flag stay Super Admin only. */
export const HR_PERMISSIONS: PermissionMap = {
  staff: ["view", "create", "edit", "delete"],
  hr: ["view", "create", "edit", "delete"],
  tasks: ["view", "create", "edit", "delete"],
  expenses: ["view", "create", "edit", "delete"],
  office_expenses: ["view", "create", "edit", "delete"],
  invoices: ["view", "create", "edit"],
  payments: ["view", "create"],
  customers: ["view", "create"],
  projects: ["view"],
};

/** What everyone in the BDE department can do, on top of their role. */
export const BDE_PERMISSIONS: PermissionMap = {
  leads: ["view", "create", "edit"],
  customers: ["view", "create", "edit"],
  quotations: ["view", "create", "edit", "delete"],
};

/** Extra access by department code. Departments not listed get nothing extra (yet). */
export const DEPARTMENT_PERMISSIONS: Record<string, PermissionMap> = {
  HR: HR_PERMISSIONS,
  BDE: BDE_PERMISSIONS,
};

/** Union of two permission maps. */
export function mergePermissions(a: PermissionMap, b: PermissionMap): PermissionMap {
  const out: PermissionMap = { ...a };
  for (const [k, acts] of Object.entries(b) as [ModuleKey, Action[]][]) out[k] = [...new Set([...(out[k] ?? []), ...acts])];
  return out;
}

export type PermUser = { isAdmin: boolean; permissions: PermissionMap };

export function can(user: PermUser | null | undefined, module: ModuleKey, action: Action = "view") {
  if (!user) return false;
  if (user.isAdmin) return true;
  return !!user.permissions[module]?.includes(action);
}
