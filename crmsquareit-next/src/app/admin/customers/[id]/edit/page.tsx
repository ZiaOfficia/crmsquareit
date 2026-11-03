import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { CustomerForm } from "../../form";
import { updateCustomer } from "../../actions";

export default async function EditCustomer({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("customers", "edit");
  const { id } = await params;
  const customer = await db.customer.findUnique({ where: { id: Number(id) } });
  if (!customer) notFound();
  return (
    <div className="max-w-4xl">
      <PageHeader title={`Edit ${customer.company}`} back={{ href: `/admin/customers/${customer.id}`, label: customer.company }} />
      <CustomerForm action={updateCustomer.bind(null, customer.id)} customer={customer} />
    </div>
  );
}
