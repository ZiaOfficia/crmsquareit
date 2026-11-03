"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";

export async function respondEstimate(f: FormData) {
  const hash = String(f.get("hash"));
  const decision = f.get("decision") === "accept" ? "ACCEPTED" : "DECLINED";
  const est = await db.estimate.findUnique({ where: { hash } });
  if (!est || est.status !== "SENT") return;
  await db.estimate.update({ where: { id: est.id }, data: { status: decision } });
  await logActivity("estimate", est.id, `received client response: estimate #${est.number} ${decision.toLowerCase()}`);
  revalidatePath(`/estimate/${hash}`);
}
