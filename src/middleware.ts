import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api/auth (NextAuth endpoints)
     * - _next/static (static assets)
     * - _next/image (image optimization files)
     * - favicon.ico, images, fonts, robots.txt, etc.
     */
    "/((?!api/auth|_next/static|_next/image|manifest.json|sw.js|favicon.ico|icon-.*\\.png|.*\\.svg|.*\\.webp|.*\\.png|.*\\.jpg|.*\\.ico).*)",
  ],
};

const PUBLIC_PATH_PREFIXES = [
  "/api/auth",
  "/api/cron",
  "/api/avatar",
  "/api/p",
  "/share",
  "/login",
  "/super-admin/login",
];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const requestHeaders = new Headers(req.headers);

  // Set current pathname header for server components and layout checks
  requestHeaders.set("x-pathname", pathname);

  // 1. Check for active Super Admin Session & Impersonation Cookies
  const superAdminCookie = req.cookies.get("saas_super_admin_session")?.value;
  const impersonationCookie = req.cookies.get("saas_impersonation_session")?.value;

  if (superAdminCookie) {
    requestHeaders.set("x-is-super-admin", "true");
  }

  if (impersonationCookie) {
    requestHeaders.set("x-impersonating", "true");
  }

  // 2. Handle Super Admin Portal Routes (/super-admin/*)
  if (pathname.startsWith("/super-admin")) {
    if (pathname === "/super-admin/login") {
      // If already logged in as super admin, redirect to /super-admin
      if (superAdminCookie) {
        return NextResponse.redirect(new URL("/super-admin", req.url));
      }
      return NextResponse.next({ request: { headers: requestHeaders } });
    }

    // Protect all other /super-admin/* sub-paths
    if (!superAdminCookie) {
      const loginUrl = new URL("/super-admin/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // 3. Check for Tenant-Prefixed Paths (e.g. /{tenantSlug}/dashboard/* or /{tenantSlug}/login)
  // Format: /{tenantSlug}/dashboard/... or /{tenantSlug}/login
  const segments = pathname.split("/").filter(Boolean);
  const firstSegment = segments[0];

  // List of reserved top-level non-tenant routes
  const reservedTopRoutes = [
    "api",
    "dashboard",
    "super-admin",
    "login",
    "share",
    "_next",
    "favicon.ico",
  ];

  let tenantSlug: string | null = null;
  let isTenantScopedRoute = false;

  if (firstSegment && !reservedTopRoutes.includes(firstSegment)) {
    // We have a candidate tenant slug: e.g. /sigma/dashboard, /infra/login, etc.
    tenantSlug = firstSegment.toLowerCase();
    requestHeaders.set("x-tenant-slug", tenantSlug);
    isTenantScopedRoute = true;
  }

  // 4. Public API & Asset pass-through
  const isPublicPath = PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  // If path is a tenant-scoped login (e.g. /sigma/login)
  if (isTenantScopedRoute && segments[1] === "login") {
    // Rewrite internally to /login while maintaining URL in browser
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    });
  }

  if (isPublicPath) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // 5. If path is a tenant-scoped dashboard: e.g. /{tenantSlug}/dashboard/...
  if (isTenantScopedRoute && segments[1] === "dashboard") {
    const nextAuthToken = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    // If not authenticated and not impersonating, redirect to tenant login or root login
    if (!nextAuthToken && !impersonationCookie) {
      const loginUrl = new URL(`/${tenantSlug}/login`, req.url);
      return NextResponse.redirect(loginUrl);
    }

    // Rewrite internally: e.g. /sigma/dashboard/admin -> /dashboard/admin
    const internalPath = "/" + segments.slice(1).join("/");
    const url = req.nextUrl.clone();
    url.pathname = internalPath;

    return NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    });
  }

  // 6. Root `/` and legacy `/dashboard` Redirection
  const nextAuthToken = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (pathname === "/" || pathname === "/dashboard") {
    if (!nextAuthToken && !impersonationCookie) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const role = (nextAuthToken?.role as string) || "EMPLOYEE";

    // Direct to proper role dashboard
    switch (role) {
      case "SYSTEM_ADMIN":
      case "ADMIN":
        return NextResponse.redirect(new URL("/dashboard/admin", req.url));
      case "EXTERNAL_USER":
        return NextResponse.redirect(new URL("/dashboard/external", req.url));
      case "EMPLOYEE":
      default:
        return NextResponse.redirect(new URL("/dashboard/employee", req.url));
    }
  }

  // 7. Base `/dashboard/*` access verification
  if (pathname.startsWith("/dashboard")) {
    if (!nextAuthToken && !impersonationCookie) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // Developer tools: SYSTEM_ADMIN only
    if (pathname.startsWith("/dashboard/admin/developer")) {
      if (nextAuthToken?.role !== "SYSTEM_ADMIN" && !superAdminCookie) {
        return NextResponse.redirect(new URL("/dashboard/admin", req.url));
      }
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}
