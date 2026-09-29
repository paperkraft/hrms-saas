"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateSalarySlip } from "@/lib/pdf/generate-salary-slip";
import { sendSalarySlipEmail } from "@/lib/mail";
import { hasMenuAccess } from "@/lib/permissions";

export async function emailSalarySlipAction(recordId: string, monthName: string, year: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasMenuAccess(session.user, "/dashboard/accountant", "/dashboard/admin")) {
    return { success: false, message: "Unauthorized" };
  }

  try {
    const record = await prisma.payrollRecord.findUnique({
      where: { id: recordId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            designation: true,
            employeeCode: true,
            department: { select: { name: true } },
            salaryStructure: {
              select: {
                pfAccountNumber: true,
                basic: true,
                bankName: true,
                accountNumber: true,
                panNumber: true
              }
            }
          }
        }
      }
    });

    if (!record || !record.user) {
      return { success: false, message: "Record not found" };
    }

    if (!record.user.email) {
      return { success: false, message: "Employee has no email address" };
    }

    // Generate the PDF
    const doc = await generateSalarySlip(record, monthName, year);
    
    // Output as array buffer and convert to Node Buffer
    const arrayBuffer = doc.output('arraybuffer');
    const pdfBuffer = Buffer.from(arrayBuffer);

    const emailResult = await sendSalarySlipEmail({
      tenantId: record.tenantId,
      employeeName: record.user.name || "Employee",
      monthName,
      year,
      pdfBuffer,
      toEmail: record.user.email,
    });

    if (emailResult.success) {
      return { success: true, message: "Salary slip sent successfully" };
    } else {
      return { success: false, message: "Failed to send email" };
    }
  } catch (error: any) {
    console.error("Error sending salary slip:", error);
    return { success: false, message: "An error occurred while sending the email" };
  }
}


export async function getMyPayslips() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  try {
    const payslips = await prisma.payrollRecord.findMany({
      where: {
        userId: session.user.id,
        status: { in: ["FINALIZED", "PAID"] },
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
      ],
      include: {
        user: {
          select: {
            name: true,
            employeeCode: true,
            designation: true,
            salaryStructure: true
          }
        }
      }
    });
    return { payslips };
  } catch (error) {
    console.error("Error fetching payslips:", error);
    return { error: "Failed to fetch payslips" };
  }
}

export async function generatePayslipPDFBase64(recordId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  try {
    const record = await prisma.payrollRecord.findUnique({
      where: { id: recordId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            employeeCode: true,
            designation: true,
            salaryStructure: true,
          }
        }
      }
    });

    if (!record) {
      return { error: "Record not found" };
    }

    if (record.userId !== session.user.id) {
      return { error: "Unauthorized access to this payslip" };
    }

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthName = monthNames[record.month - 1];

    const doc = await generateSalarySlip(record, monthName, record.year);
    const base64 = doc.output('datauristring');
    
    return { base64, filename: `Payslip_${monthName}_${record.year}.pdf` };

  } catch (error) {
    console.error("Failed to generate payslip PDF:", error);
    return { error: "Failed to generate PDF" };
  }
}
