import "server-only";
import { db } from "./db";

export async function logActivity(relType: string, relId: number, description: string, staffId?: number | null) {
  await db.activity.create({ data: { relType, relId, description, staffId: staffId ?? null } });
}
