import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const SUPER_ADMIN_COOKIE = "saas_super_admin_session";
export const IMPERSONATION_COOKIE = "saas_impersonation_session";

export interface SuperAdminSession {
  id: string;
  email: string;
  name: string;
}

export interface ImpersonationSession {
  superAdminId: string;
  superAdminEmail: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  targetUserId?: string;
  targetUserName?: string;
  targetUserEmail?: string;
  startedAt: string;
}

// Simple base64url JSON session signing
function signSessionPayload(data: object): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const secret = process.env.NEXTAUTH_SECRET || "super-admin-hrms-platform-secret-key-2026";
  const signature = Buffer.from(
    Buffer.from(payload + ":" + secret).toString("base64url")
  ).toString("base64url").slice(0, 32);
  return `${payload}.${signature}`;
}

function verifySessionPayload<T>(token: string): T | null {
  try {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;
    const secret = process.env.NEXTAUTH_SECRET || "super-admin-hrms-platform-secret-key-2026";
    const expectedSig = Buffer.from(
      Buffer.from(payload + ":" + secret).toString("base64url")
    ).toString("base64url").slice(0, 32);
    if (signature !== expectedSig) return null;
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")) as T;
  } catch {
    return null;
  }
}

/**
 * Validates Super Admin login credentials and returns session.
 */
export async function authenticateSuperAdmin(email: string, passwordPlain: string): Promise<SuperAdminSession | null> {
  const admin = await prisma.superAdmin.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!admin) {
    // If no super admin exists yet in database, fallback check for dev/master root
    const masterEmail = (process.env.DEV_ADMIN_EMAIL || "superadmin@hrms.com").toLowerCase();
    const masterPass = process.env.SUPER_ADMIN_PASSWORD || "superadmin@123";

    if (email.toLowerCase().trim() === masterEmail && passwordPlain === masterPass) {
      // Auto-create initial superadmin record
      const hashed = await bcrypt.hash(masterPass, 10);
      const created = await prisma.superAdmin.create({
        data: {
          email: masterEmail,
          name: "Root Platform Administrator",
          password: hashed,
        },
      });
      return { id: created.id, email: created.email, name: created.name };
    }
    return null;
  }

  const isValid = await bcrypt.compare(passwordPlain, admin.password);
  if (!isValid) return null;

  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
  };
}

/**
 * Creates and sets the Super Admin session cookie.
 */
export async function setSuperAdminSessionCookie(session: SuperAdminSession) {
  const cookieStore = await cookies();
  const token = signSessionPayload(session);

  cookieStore.set(SUPER_ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

/**
 * Clears the Super Admin session cookie.
 */
export async function clearSuperAdminSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SUPER_ADMIN_COOKIE);
}

/**
 * Retrieves the current Super Admin session from cookies.
 */
export async function getSuperAdminSession(): Promise<SuperAdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SUPER_ADMIN_COOKIE)?.value;
  if (!token) return null;
  return verifySessionPayload<SuperAdminSession>(token);
}

/**
 * Sets up an active Impersonation session cookie.
 */
export async function setImpersonationSessionCookie(data: ImpersonationSession) {
  const cookieStore = await cookies();
  const token = signSessionPayload(data);

  cookieStore.set(IMPERSONATION_COOKIE, token, {
    httpOnly: false, // Accessible to client component for floating banner
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 4 * 60 * 60, // 4 hours
  });
}

/**
 * Clears the Impersonation session cookie.
 */
export async function clearImpersonationSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATION_COOKIE);
}

/**
 * Retrieves the current Impersonation session from cookies.
 */
export async function getImpersonationSession(): Promise<ImpersonationSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(IMPERSONATION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionPayload<ImpersonationSession>(token);
}
