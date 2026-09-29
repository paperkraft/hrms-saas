import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardRootPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const role = session.user.role;
  const isExternal = session.user.isExternal;

  if (role === "SUPER_ADMIN") {
    redirect("/super-admin");
  }

  if (role === "ADMIN") {
    redirect("/dashboard/admin");
  }

  if (role === "ACCOUNTANT") {
    redirect("/dashboard/accountant");
  }

  if (isExternal || role === "EXTERNAL_USER") {
    redirect("/dashboard/external");
  }

  redirect("/dashboard/employee");
}
