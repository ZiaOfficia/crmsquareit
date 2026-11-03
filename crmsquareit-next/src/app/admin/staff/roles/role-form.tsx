import type { Role } from "@prisma/client";
import { ACTIONS, MODULES, parsePermissions } from "@/lib/permissions";
import type { ActionState } from "@/lib/forms";
import { ActionForm, SubmitButton } from "@/components/client";
import { Card, Field } from "@/components/ui";

export function RoleForm({ action, role }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; role?: Role }) {
  const p = parsePermissions(role?.permissions);
  return (
    <ActionForm action={action}>
      <Card>
        <div className="p-5"><Field label="Role name *"><input name="name" required defaultValue={role?.name} className="input max-w-sm" /></Field></div>
        <table className="min-w-full border-t border-slate-100">
          <thead className="bg-slate-50/70">
            <tr><th className="th">Module</th>{ACTIONS.map((a) => <th key={a} className="th text-center capitalize">{a}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {MODULES.map((m) => (
              <tr key={m.key}>
                <td className="td font-medium">{m.label}</td>
                {ACTIONS.map((a) => (
                  <td key={a} className="td text-center"><input type="checkbox" name={`${m.key}:${a}`} defaultChecked={p[m.key]?.includes(a)} className="h-4 w-4" /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-end border-t border-slate-100 p-4"><SubmitButton>Save role</SubmitButton></div>
      </Card>
    </ActionForm>
  );
}
