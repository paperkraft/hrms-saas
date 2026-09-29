import { redirect } from "next/navigation";

export default function AdminReportsPage() {
  redirect("/dashboard/admin?tab=reports");
}
