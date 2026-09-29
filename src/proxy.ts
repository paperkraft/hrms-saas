import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Set x-pathname header so Server Components and DashboardLayout can read the live request route
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-pathname", path);

    // 1. Root and Base Dashboard Redirection
    if (path === "/" || path === "/dashboard") {
      if (!token) return NextResponse.redirect(new URL("/login", req.url));

      switch (token.role) {
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

    // Explicitly allow API routes to pass through
    if (path.startsWith("/api/")) {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }

    const isAdmin = token?.role === "ADMIN" || token?.role === "SYSTEM_ADMIN";
    const allowedMenus = token?.allowedMenus as string[] | undefined;
    const hasFullAccess = isAdmin || (allowedMenus && allowedMenus.includes("all"));

    // Developer tools: SYSTEM_ADMIN only
    if (path.startsWith("/dashboard/admin/developer")) {
      if (token?.role !== "SYSTEM_ADMIN") {
        return NextResponse.redirect(new URL("/dashboard/admin", req.url));
      }
      return NextResponse.next({ request: { headers: requestHeaders } });
    }

    // Full access admins can access all dashboard routes
    if (hasFullAccess) {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }

    // Forward request with x-pathname header to DashboardLayout for live DB-backed route verification
    return NextResponse.next({ request: { headers: requestHeaders } });
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        // Public paths
        if (
          path.startsWith("/api/auth") ||
          path.startsWith("/api/cron") ||
          path.startsWith("/api/avatar") ||
          path.startsWith("/api/p") ||
          path.startsWith("/share") ||
          path === "/login"
        ) {
          return true;
        }
        return !!token;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api/auth|_next/static|_next/image|manifest.json|sw.js|favicon.ico|icon-.*\\.png|.*\\.svg|.*\\.webpx).*)",
  ],
};
