import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "sq_session";
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me");

export async function signSession(staffId: number) {
  return new SignJWT({ sid: staffId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

export async function verifySession(token?: string): Promise<number | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.sid === "number" ? payload.sid : null;
  } catch {
    return null;
  }
}
