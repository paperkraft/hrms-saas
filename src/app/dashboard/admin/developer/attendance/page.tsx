import { AttendanceAdjustmentClient } from "./AttendanceAdjustmentClient";
import { PageContainer } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Attendance Adjustments | Developer Tools",
  description: "Developer tool to adjust attendance entries manually.",
};

export default function AttendanceAdjustmentPage() {
  return (
    <PageContainer maxWidth="full" className="py-6 animate-fade-in">
      <AttendanceAdjustmentClient />
    </PageContainer>
  );
}

