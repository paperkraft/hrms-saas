import { DepartmentsPageClient } from "@/components/features/admin/departments-page-client"
import { PageContainer } from "@/components/ui"
import { getAdminDepartmentsData } from "@/actions/department"
import { getOrgData } from "@/actions/org-chart"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export const dynamic = 'force-dynamic'

export default async function DepartmentsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  
  const user = session.user
  const isAdminOrSystemAdmin = user.role === 'ADMIN' || user.role === 'SYSTEM_ADMIN'
  const hasAllMenu = Boolean(user.allowedMenus?.includes("all"))
  const hasAdminMenu = Boolean(user.allowedMenus?.some((m: string) => m === "/dashboard/admin" || m.startsWith("/dashboard/admin/")))
  const hasDeptManagePermission = Boolean(user.permissions?.includes("departments.manage") || user.permissions?.includes("admin"))
  const canEdit = Boolean(isAdminOrSystemAdmin || hasAllMenu || hasAdminMenu || hasDeptManagePermission)

  const [result, orgData] = await Promise.all([
    getAdminDepartmentsData(),
    getOrgData()
  ])

  if (!result.success || !result.data) return <div>Error loading departments</div>
  const { departments, users } = result.data

  return (
    <PageContainer maxWidth="full" className="py-6 animate-fade-in space-y-4">
      <DepartmentsPageClient
        departments={departments}
        users={users}
        canEdit={canEdit}
        orgData={orgData}
      />
    </PageContainer>
  )
}

