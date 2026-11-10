/** Organisation hierarchy: departments, sub-departments and team roles.
 *  Safe to import from client and server code (no DB access here). */

export const TEAM_ROLES = [
  { key: "TL", label: "Team Lead (TL)" },
  { key: "EXECUTIVE", label: "Executive" },
] as const;
export type TeamRole = (typeof TEAM_ROLES)[number]["key"];
export const isTeamRole = (v: unknown): v is TeamRole => TEAM_ROLES.some((r) => r.key === v);
export const teamRoleLabel = (v: string) => (v === "TL" ? "TL" : v === "EXECUTIVE" ? "Executive" : v);

/** The initial structure. `code` is the stable key; names can be renamed in the DB.
 *  Seeded by prisma/seed.ts (create-if-missing, never overwrites). */
export const ORG_STRUCTURE: { code: string; name: string; children?: { code: string; name: string }[] }[] = [
  { code: "HR", name: "HR" },
  { code: "BDE", name: "BDE" },
  { code: "WEB_DEV", name: "Website Development" },
  { code: "SEO", name: "SEO" },
  { code: "GBP", name: "GBP" },
  {
    code: "PAID_ADS",
    name: "Paid Advertising",
    children: [
      { code: "SMM", name: "SMM" },
      { code: "SEM", name: "SEM" },
    ],
  },
  { code: "SMO", name: "SMO" },
];

export type Membership = { departmentId: number; departmentCode: string; departmentName: string; parentId: number | null; parentName: string | null; teamRole: TeamRole };

/** "SEO · TL" or "Paid Advertising › SMM · Executive" */
export const membershipLabel = (m: Pick<Membership, "departmentName" | "parentName" | "teamRole">) =>
  `${m.parentName ? `${m.parentName} › ` : ""}${m.departmentName} · ${teamRoleLabel(m.teamRole)}`;

/* ── Access helpers ────────────────────────────────────────────────────
   Super Admin is never limited by department rules: every helper below
   returns true for isAdmin. HR is the only department with extra access so
   far (see HR_PERMISSIONS in permissions.ts). TL / Executive permissions for
   other departments are NOT defined yet (pending sign-off). */
type OrgUser = { isAdmin: boolean; memberships: Membership[] };

export const isSuperAdmin = (u: { isAdmin: boolean } | null | undefined) => !!u?.isAdmin;

/** Code of the HR department. Anyone placed in it (TL or Executive) gets HR access. */
export const HR_CODE = "HR";
/** Code of the BDE (business development) department: leads, customers, quotations. */
export const BDE_CODE = "BDE";

/** In the HR department (any team role). Super Admins are not "HR" — they already have everything. */
export const isHR = (u: { memberships: Pick<Membership, "departmentCode">[] } | null | undefined) =>
  !!u?.memberships.some((m) => m.departmentCode === HR_CODE);

/** Super Admin and HR manage who sits where (departments, team roles). */
export const canManageOrg = (u: OrgUser | null | undefined) => isSuperAdmin(u) || isHR(u);

/** Super Admin and HR can send announcements. */
export const canAnnounce = canManageOrg;

export function isMemberOf(u: OrgUser | null | undefined, departmentId: number) {
  if (!u) return false;
  return u.isAdmin || u.memberships.some((m) => m.departmentId === departmentId);
}

export function isTeamLeadOf(u: OrgUser | null | undefined, departmentId: number) {
  if (!u) return false;
  return u.isAdmin || u.memberships.some((m) => m.departmentId === departmentId && m.teamRole === "TL");
}
