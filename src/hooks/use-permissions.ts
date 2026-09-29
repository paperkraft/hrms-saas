"use client"

import { useSession } from "next-auth/react"
import { getPermissions } from "@/lib/permissions"

/**
 * React hook for client-side permission checks.
 * Synchronizes with the Next-Auth session.
 */
export function usePermissions() {
  const { data: session, status } = useSession()
  const permissions = getPermissions(session?.user as any)
  
  return {
    ...permissions,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated"
  }
}
