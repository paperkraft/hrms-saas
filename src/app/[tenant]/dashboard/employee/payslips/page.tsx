import { getMyPayslips } from "@/actions/payroll/payslip";
import { PayslipViewer } from "@/components/features/employee/payslip-viewer";
import { PageContainer } from "@/components/ui";

export const dynamic = 'force-dynamic';

export default async function PayslipsPage() {
  const { payslips, error } = await getMyPayslips();

  if (error) {
    return (
      <PageContainer maxWidth="full">
        <div className="p-8 text-center bg-card border border-border rounded-sm">
          <p className="text-red-500 font-bold uppercase tracking-widest text-[10px]">{error}</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="full">
      <PayslipViewer payslips={payslips || []} />
    </PageContainer>
  );
}
