import { getRoles } from "@/actions/roles"
import { RolesManagement } from "@/components/features/admin/roles-management"
import { PageContainer } from "@/components/ui"
import { Metadata } from "next"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { hasMenuAccess } from "@/lib/permissions"

export const metadata: Metadata = {
  title: "Role Management",
  description: "Manage system and custom roles with granular menu and feature access permissions.",
}

export const dynamic = "force-dynamic"

export default async function AdminRolesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user || !hasMenuAccess(session.user, "/dashboard/admin/roles")) {
    redirect(session?.user?.role === "EXTERNAL_USER" ? "/dashboard/external" : "/dashboard/employee")
  }
  const result = await getRoles()

  if (!result.success || !result.data) {
    return <div>Error loading roles: {result.error}</div>
  }

  return (
    <PageContainer maxWidth="full" className="py-6 animate-fade-in space-y-4">
      <RolesManagement initialRoles={result.data as any} />
    </PageContainer>
  )
}
