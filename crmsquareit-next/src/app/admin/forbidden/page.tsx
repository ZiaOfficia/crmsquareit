import { ButtonLink, EmptyState, Card } from "@/components/ui";
export default function Forbidden() {
  return (
    <Card>
      <EmptyState title="You don't have access to this page" text="Ask an administrator to update your role permissions." action={<ButtonLink href="/admin">Back to dashboard</ButtonLink>} />
    </Card>
  );
}
