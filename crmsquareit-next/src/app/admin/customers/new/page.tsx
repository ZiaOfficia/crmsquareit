import { requirePerm } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { CustomerForm } from "../form";
import { createCustomer } from "../actions";

export const metadata = { title: "New customer" };

export default async function NewCustomer() {
  await requirePerm("customers", "create");
  return (
    <div className="max-w-4xl">
      <PageHeader title="New customer" back={{ href: "/admin/customers", label: "Customers" }} />
      <CustomerForm action={createCustomer} />
    </div>
  );
}
