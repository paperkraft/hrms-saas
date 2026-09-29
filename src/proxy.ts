import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Reserved root keywords that are NOT tenant slugs
const RESERVED_PREFIXES = new Set([
  "api",
  "super-admin",
  "dashboard",
  "login",
  "share",
  "_next",
  "static",
  "icons",
  "images",
  "fonts",
  "favicon.ico",
  "manifest.json",
  "sw.js",
  "robots.txt",
  "sitemap.xml",
  "version.json",
]);

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // 1. Skip Next.js internal static assets and public API endpoints
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/avatar") ||
    pathname.startsWith("/api/p") ||
    pathname.startsWith("/share") ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|json|js|css|map)$/)
  ) {
    return NextResponse.next();
  }

  // 2. Fetch JWT token and SuperAdmin / Impersonation cookies
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET || "super-admin-hrms-platform-secret-key-2026",
  });
  const superAdminCookie = req.cookies.get("saas_super_admin_session")?.value;
  const impersonationCookie = req.cookies.get("saas_impersonation_session")?.value;

  // 3. Super Admin Route Protection (/super-admin/*)
  if (pathname.startsWith("/super-admin")) {
    if (pathname === "/super-admin/login") {
      if (superAdminCookie || token?.role === "SUPER_ADMIN") {
        return NextResponse.redirect(new URL("/super-admin", req.url));
      }
      return NextResponse.next();
    }

    if (!superAdminCookie && token?.role !== "SUPER_ADMIN") {
      const loginUrl = new URL("/super-admin/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }

  // 4. Extract possible tenant slug from path
  const segments = pathname.split("/").filter(Boolean);
  const firstSegment = segments[0];

  const isTenantPrefixed = firstSegment && !RESERVED_PREFIXES.has(firstSegment.toLowerCase());
  const tenantSlug = isTenantPrefixed ? firstSegment.toLowerCase() : null;
  const subSegments = isTenantPrefixed ? segments.slice(1) : segments;
  const subPath = "/" + subSegments.join("/"); // e.g. "/login", "/dashboard", "/dashboard/admin"

  // 5. Tenant-Scoped Login (e.g. /:tenantSlug/login)
  if (isTenantPrefixed && subPath === "/login") {
    if (token) {
      const targetSlug = (token.tenantSlug as string) || tenantSlug;
      return NextResponse.redirect(new URL(`/${targetSlug}/dashboard`, req.url));
    }
    return NextResponse.next();
  }

  // 6. Universal Root & Login (/ or /login)
  if (pathname === "/" || pathname === "/login") {
    if (token) {
      if (token.role === "SUPER_ADMIN") {
        return NextResponse.redirect(new URL("/super-admin", req.url));
      }
      const targetSlug = (token.tenantSlug as string) || "sigma";
      return NextResponse.redirect(new URL(`/${targetSlug}/dashboard`, req.url));
    }
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
  }

  // 7. Tenant-Prefixed Routes (e.g. /:tenantSlug, /:tenantSlug/dashboard, etc.)
  if (isTenantPrefixed) {
    if (!token && !superAdminCookie) {
      const loginUrl = new URL(`/${tenantSlug}/login`, req.url);
      return NextResponse.redirect(loginUrl);
    }

    // Check Impersonation session validity for target tenant
    let isImpersonatingThisTenant = false;
    if (impersonationCookie) {
      try {
        const payloadStr = Buffer.from(impersonationCookie.split(".")[0], "base64url").toString();
        const payload = JSON.parse(payloadStr);
        if (payload.tenantSlug === tenantSlug) {
          isImpersonatingThisTenant = true;
        }
      } catch {}
    }

    // Cross-Tenant Route Protection Check
    const userTenantSlug = token?.tenantSlug as string | undefined;
    const isSuperAdmin = token?.role === "SUPER_ADMIN" || !!superAdminCookie;

    if (!isSuperAdmin && !isImpersonatingThisTenant && userTenantSlug && userTenantSlug !== tenantSlug) {
      // Prevent cross-tenant boundary breach! Redirect strictly to user's assigned workspace
      return NextResponse.redirect(new URL(`/${userTenantSlug}/dashboard`, req.url));
    }

    // Inject request headers for Server Components
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-tenant-slug", tenantSlug!);
    requestHeaders.set("x-pathname", subPath);

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  // 8. Canonicalize legacy unprefixed /dashboard routes to slug-prefixed URL
  if (pathname.startsWith("/dashboard")) {
    if (!token && !superAdminCookie) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    if (token?.role === "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/super-admin", req.url));
    }

    const userSlug = (token?.tenantSlug as string) || "sigma";
    return NextResponse.redirect(new URL(`/${userSlug}${pathname}${search}`, req.url));
  }

  return NextResponse.next();
}

export default proxy;

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|manifest.json|sw.js|favicon.ico|icon-.*\\.png|.*\\.svg|.*\\.webpx).*)",
  ],
};
