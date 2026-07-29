import crypto from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const SESSION_COOKIE = "session";
const SECRET = process.env.SESSION_SECRET!;

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

// A session cookie is just "<userId>.<signature>". The signature is an
// HMAC of the userId using our server-only secret, so a visitor can read
// their own userId but can't forge one for someone else without the secret.
function sign(value: string) {
  const signature = crypto.createHmac("sha256", SECRET).update(value).digest("hex");
  return `${value}.${signature}`;
}

function verify(signed: string): string | null {
  const separatorIndex = signed.lastIndexOf(".");
  if (separatorIndex === -1) return null;

  const value = signed.slice(0, separatorIndex);
  const signature = signed.slice(separatorIndex + 1);
  const expected = crypto.createHmac("sha256", SECRET).update(value).digest("hex");

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  return value;
}

export async function createSession(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sign(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 1 week
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const userId = verify(raw);
  if (!userId) return null;

  return prisma.user.findUnique({ where: { id: userId } });
}
