import { getProjects } from "@/actions/projects/core"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ProjectPortfolioClient } from "@/components/features/projects/project-portfolio-client"
import { redirect } from "next/navigation"
import { isExternalUser } from "@/lib/permissions"

export const dynamic = "force-dynamic"

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect("/login")
  }

  const isExternal = isExternalUser(session.user)
  const isAdmin = (session?.user.role === "ADMIN" || session?.user.role === "SYSTEM_ADMIN") && !isExternal
  const canManageProjects = (isAdmin || session?.user.role === "ACCOUNTANT") && !isExternal

  const [projectsResult] = await Promise.all([getProjects()])
  const projects = projectsResult.success ? projectsResult.data : []

  return (
    <ProjectPortfolioClient
      initialProjects={projects || []}
      canManageProjects={canManageProjects}
      isAdmin={isAdmin}
      isExternal={isExternal}
    />
  )
}