import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/ui";
import { ProfilePageClient } from "@/components/features/profile/profile-page-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Profile",
  description: "View and update your personal information, emergency contacts and security settings.",
};

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      dateOfBirth: true,
      joiningDate: true,
      designation: true,
      phoneNumber: true,
      bloodGroup: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      emergencyContactRelation: true,
      avatarUrl: true,
      workMode: true,
      location: {
        select: { id: true, name: true }
      },
      additionalLocations: {
        select: { id: true, name: true }
      },
      departments: {
        select: {
          isPrimary: true,
          isLeader: true,
          department: { select: { id: true, name: true } }
        }
      }
    }
  });

  if (!user) redirect("/dashboard");

  // Serialize dates and relationships for the client component
  const serialized = {
    id: user.id,
    name: user.name,
    email: user.email,
    designation: user.designation ?? null,
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString() : null,
    joiningDate: user.joiningDate ? user.joiningDate.toISOString() : null,
    phoneNumber: user.phoneNumber ?? null,
    bloodGroup: user.bloodGroup ?? null,
    emergencyContactName: user.emergencyContactName ?? null,
    emergencyContactPhone: user.emergencyContactPhone ?? null,
    emergencyContactRelation: user.emergencyContactRelation ?? null,
    avatarUrl: (user as any).avatarUrl ?? null,
    workMode: user.workMode ?? "OFFICE",
    location: user.location ? { id: user.location.id, name: user.location.name } : null,
    additionalLocations: (user.additionalLocations || []).map(l => ({ id: l.id, name: l.name })),
    departments: (user.departments || []).map(d => ({
      isPrimary: d.isPrimary,
      isLeader: d.isLeader,
      department: { id: d.department.id, name: d.department.name }
    }))
  };

  // Calculate profile completion
  const requiredFields = [
    serialized.phoneNumber,
    serialized.dateOfBirth,
    serialized.bloodGroup,
    serialized.emergencyContactName,
    serialized.emergencyContactPhone,
    serialized.emergencyContactRelation,
  ];
  const filledFields = requiredFields.filter(Boolean).length;
  const completionPct = Math.round((filledFields / requiredFields.length) * 100);

  return (
    <PageContainer maxWidth="full" className="py-6 animate-fade-in space-y-4">
      <ProfilePageClient user={serialized} completionPct={completionPct} />
    </PageContainer>
  );
}
