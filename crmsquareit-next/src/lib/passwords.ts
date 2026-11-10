import "server-only";
import bcrypt from "bcryptjs";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/* Passwords are stored twice:
   - `password`: bcrypt hash, used to log in (one-way).
   - `passwordView`: AES-256-GCM ciphertext so Super Admin and HR can look the
     password up. The key comes from PASSWORD_VIEW_KEY (falls back to
     AUTH_SECRET). Changing that key makes old values unreadable, they then
     show as "not available" until the person logs in or the password is set again. */

const key = () => createHash("sha256").update(process.env.PASSWORD_VIEW_KEY || process.env.AUTH_SECRET || "dev-secret-change-me").digest();

export function encryptPassword(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

export function decryptPassword(stored: string | null | undefined): string | null {
  if (!stored) return null;
  try {
    const [v, iv, tag, data] = stored.split(":");
    if (v !== "v1") return null;
    const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Fields to write on Staff whenever a password is set. */
export async function passwordFields(plain: string) {
  return { password: await bcrypt.hash(plain, 10), passwordView: encryptPassword(plain), passwordSetAt: new Date() };
}

export const MIN_PASSWORD = 6;

/** Reset tokens: the link carries the raw token, the DB keeps only its hash. */
export const newResetToken = () => randomBytes(32).toString("base64url");
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export const RESET_TTL_MINUTES = 60;
