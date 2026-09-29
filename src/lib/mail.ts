import nodemailer from "nodemailer";
import prisma from "@/lib/prisma";
import { appConfig, isDummyOrDevEmail } from "./app-config";

export interface TenantBranding {
  id?: string;
  name: string;
  slug: string;
  legalName?: string;
  logoUrl?: string | null;
  primaryColor: string;
  fromAddress: string;
  baseUrl: string;
}

// Global cached Centralized Master Transporter
const centralizedTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "mail.infraplan.co.in",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

// Cache for custom per-tenant SMTP transporters
const tenantTransporterCache = new Map<string, nodemailer.Transporter>();

/**
 * Resolves the appropriate SMTP transporter, from address, and branding
 * for a specific tenant (or falls back to centralized platform defaults).
 */
export async function resolveTenantMailer(tenantId?: string | null): Promise<{
  transporter: nodemailer.Transporter;
  fromAddress: string;
  branding: TenantBranding;
}> {
  const defaultBaseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  // Fallback centralized branding
  const defaultBranding: TenantBranding = {
    name: appConfig.appName,
    slug: "",
    legalName: appConfig.companyFullName,
    logoUrl: appConfig.logoUrl,
    primaryColor: "#4f46e5",
    fromAddress:
      process.env.SMTP_FROM ||
      `"${appConfig.appName}" <noreply@${appConfig.companyName.toLowerCase().replace(/\s+/g, "")}.com>`,
    baseUrl: defaultBaseUrl,
  };

  if (!tenantId) {
    return {
      transporter: centralizedTransporter,
      fromAddress: defaultBranding.fromAddress,
      branding: defaultBranding,
    };
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        slug: true,
        name: true,
        legalName: true,
        logoUrl: true,
        primaryColor: true,
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        smtpPass: true,
        smtpFrom: true,
      },
    });

    if (!tenant) {
      return {
        transporter: centralizedTransporter,
        fromAddress: defaultBranding.fromAddress,
        branding: defaultBranding,
      };
    }

    const branding: TenantBranding = {
      id: tenant.id,
      name: tenant.name || appConfig.appName,
      slug: tenant.slug,
      legalName: tenant.legalName || tenant.name,
      logoUrl: tenant.logoUrl || appConfig.logoUrl,
      primaryColor: tenant.primaryColor || "#4f46e5",
      fromAddress:
        tenant.smtpFrom ||
        process.env.SMTP_FROM ||
        `"${tenant.name} HRMS" <noreply@${tenant.slug}.hrms.com>`,
      baseUrl: defaultBaseUrl,
    };

    // If tenant has dedicated custom SMTP configured
    if (tenant.smtpHost && tenant.smtpUser && tenant.smtpPass) {
      if (tenantTransporterCache.has(tenant.id)) {
        return {
          transporter: tenantTransporterCache.get(tenant.id)!,
          fromAddress: branding.fromAddress,
          branding,
        };
      }

      const customTransporter = nodemailer.createTransport({
        host: tenant.smtpHost,
        port: tenant.smtpPort || 587,
        secure: tenant.smtpPort === 465,
        auth: {
          user: tenant.smtpUser,
          pass: tenant.smtpPass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      tenantTransporterCache.set(tenant.id, customTransporter);
      return {
        transporter: customTransporter,
        fromAddress: branding.fromAddress,
        branding,
      };
    }

    // Default to Centralized HRMS Transporter with dynamic Tenant Branding
    return {
      transporter: centralizedTransporter,
      fromAddress: branding.fromAddress,
      branding,
    };
  } catch (error) {
    console.error("[MailUtility] Failed to resolve tenant mailer, using default:", error);
    return {
      transporter: centralizedTransporter,
      fromAddress: defaultBranding.fromAddress,
      branding: defaultBranding,
    };
  }
}

/**
 * Filter dummy test emails or dev admin emails
 */
function filterEmails(emails: string | string[] | undefined): string | string[] | undefined {
  if (!emails) return undefined;

  if (Array.isArray(emails)) {
    const filtered = emails.filter((email) => !isDummyOrDevEmail(email));
    return filtered.length > 0 ? filtered : undefined;
  }
  return isDummyOrDevEmail(emails) ? undefined : emails;
}

export function formatLeaveDurationText(
  duration: string,
  halfDayType?: string | null,
  startTime?: string | null,
  endTime?: string | null
): string {
  if (duration === "HALF" || duration === "HALF_DAY" || duration.toLowerCase().includes("half")) {
    if (halfDayType === "FIRST_HALF" || halfDayType === "1st Half") return "Half Day (1st Half)";
    if (halfDayType === "SECOND_HALF" || halfDayType === "2nd Half") return "Half Day (2nd Half)";
    return "Half Day";
  }
  if (duration === "SHORT" || duration === "SHORT_LEAVE" || duration.toLowerCase().includes("short")) {
    if (startTime && endTime) return `Short Leave (${startTime} - ${endTime})`;
    return "Short Leave";
  }
  if (duration === "FULL" || duration === "FULL_DAY" || duration.toLowerCase().includes("full")) {
    return "Full Day";
  }
  return duration;
}

/**
 * Master HTML Email Wrapper with Tenant Branding
 */
function renderTenantEmailTemplate({
  branding,
  headerTitle,
  bodyHtml,
  actionButton,
}: {
  branding: TenantBranding;
  headerTitle: string;
  bodyHtml: string;
  actionButton?: { label: string; url: string };
}) {
  const brandColor = branding.primaryColor || "#4f46e5";
  const workspaceUrl = branding.slug
    ? `${branding.baseUrl}/${branding.slug}/dashboard`
    : `${branding.baseUrl}/dashboard`;

  return `
    <div style="background-color: #f8fafc; padding: 30px 15px; font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        
        <!-- Header Banner -->
        <div style="background: ${brandColor}; padding: 24px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.025em; text-transform: uppercase;">
            ${branding.name}
          </h1>
          <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.85; letter-spacing: 0.05em;">
            Human Resources Management System
          </p>
        </div>

        <!-- Inner Content Area -->
        <div style="padding: 28px 24px;">
          <h2 style="font-size: 18px; font-weight: 600; color: #0f172a; margin: 0 0 16px 0; border-bottom: 2px solid ${brandColor}20; padding-bottom: 10px;">
            ${headerTitle}
          </h2>

          ${bodyHtml}

          ${
            actionButton
              ? `
            <div style="margin-top: 28px; text-align: center;">
              <a href="${actionButton.url}" style="background-color: ${brandColor}; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                ${actionButton.label}
              </a>
            </div>
          `
              : ""
          }
        </div>

        <!-- Footer -->
        <div style="background-color: #f1f5f9; padding: 16px 24px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0 0 4px 0; font-weight: 600; color: #475569;">
            ${branding.legalName || branding.name}
          </p>
          <p style="margin: 0;">
            This is an automated operational notification. Visit your portal at: <a href="${workspaceUrl}" style="color: ${brandColor}; text-decoration: none;">${workspaceUrl}</a>
          </p>
        </div>

      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. LEAVE APPLICATION EMAIL
// ─────────────────────────────────────────────────────────────────────────────

export interface LeaveEmailProps {
  tenantId?: string | null;
  applicantName: string;
  startDate: Date;
  endDate: Date;
  duration: string;
  halfDayType?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  reason?: string | null;
  leaveType?: string | null;
  toEmail: string | string[];
}

export async function sendLeaveApplicationEmail({
  tenantId,
  applicantName,
  startDate,
  endDate,
  duration,
  halfDayType,
  startTime,
  endTime,
  reason,
  leaveType,
  toEmail,
}: LeaveEmailProps) {
  const { transporter, fromAddress, branding } = await resolveTenantMailer(tenantId);

  const startStr = new Date(startDate).toLocaleDateString();
  const endStr = new Date(endDate).toLocaleDateString();
  const dateRange = startStr === endStr ? `on ${startStr}` : `from ${startStr} to ${endStr}`;
  const displayDuration = formatLeaveDurationText(duration, halfDayType, startTime, endTime);

  const subject = `[${branding.name}] Leave Application: ${applicantName} - ${displayDuration}`;

  const bodyHtml = `
    <p style="font-size: 15px; color: #334155; margin-bottom: 16px;">
      <strong>${applicantName}</strong> has submitted a new leave application awaiting review.
    </p>

    <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px;">
      <tr>
        <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; width: 30%; background-color: #f8fafc;">Duration</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: 600; color: #0f172a;">${displayDuration}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; background-color: #f8fafc;">Dates</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0;">${dateRange}</td>
      </tr>
      ${
        leaveType
          ? `
      <tr>
        <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; background-color: #f8fafc;">Leave Type</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0;">${leaveType}</td>
      </tr>
      `
          : ""
      }
      <tr>
        <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; background-color: #f8fafc;">Reason</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0;">${reason || "Not specified"}</td>
      </tr>
    </table>
  `;

  const actionUrl = branding.slug
    ? `${branding.baseUrl}/${branding.slug}/dashboard/leaves`
    : `${branding.baseUrl}/dashboard/leaves`;

  const html = renderTenantEmailTemplate({
    branding,
    headerTitle: "New Leave Application",
    bodyHtml,
    actionButton: {
      label: "Review Leave in Portal",
      url: actionUrl,
    },
  });

  const filteredTo = filterEmails(toEmail);
  if (!filteredTo) return { success: true, message: "Skipped (test domain)" };

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: filteredTo,
      subject,
      html,
    });
    console.log(`[MailUtility] Leave application email dispatched for tenant ${branding.name} to ${filteredTo}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[MailUtility] Leave application email failed:", error);
    return { success: false, error };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. LEAVE STATUS UPDATE EMAIL (APPROVED / REJECTED)
// ─────────────────────────────────────────────────────────────────────────────

export interface LeaveStatusEmailProps extends LeaveEmailProps {
  status: "APPROVED" | "REJECTED" | "CANCELLED";
  managerNote?: string | null;
}

export async function sendLeaveStatusUpdateEmail({
  tenantId,
  applicantName,
  startDate,
  endDate,
  duration,
  halfDayType,
  startTime,
  endTime,
  status,
  managerNote,
  toEmail,
}: LeaveStatusEmailProps) {
  const { transporter, fromAddress, branding } = await resolveTenantMailer(tenantId);

  const startStr = new Date(startDate).toLocaleDateString();
  const endStr = new Date(endDate).toLocaleDateString();
  const dateRange = startStr === endStr ? `on ${startStr}` : `from ${startStr} to ${endStr}`;
  const displayDuration = formatLeaveDurationText(duration, halfDayType, startTime, endTime);

  const isApproved = status === "APPROVED";
  const statusColor = isApproved ? "#10b981" : status === "REJECTED" ? "#ef4444" : "#f59e0b";

  const subject = `[${branding.name}] Leave Request ${status}: ${applicantName} - ${displayDuration}`;

  const bodyHtml = `
    <div style="padding: 12px 16px; border-radius: 8px; background-color: ${statusColor}15; border-left: 4px solid ${statusColor}; margin-bottom: 20px;">
      <p style="margin: 0; font-size: 15px; font-weight: 600; color: ${statusColor};">
        Your leave application has been ${status.toLowerCase()}.
      </p>
    </div>

    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <tr>
        <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; width: 30%; background-color: #f8fafc;">Status</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; color: ${statusColor};">${status}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; background-color: #f8fafc;">Duration</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0;">${displayDuration}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; background-color: #f8fafc;">Dates</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0;">${dateRange}</td>
      </tr>
      ${
        managerNote
          ? `
      <tr>
        <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; background-color: #f8fafc;">Reviewer Note</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0;">${managerNote}</td>
      </tr>
      `
          : ""
      }
    </table>
  `;

  const actionUrl = branding.slug
    ? `${branding.baseUrl}/${branding.slug}/dashboard/leaves`
    : `${branding.baseUrl}/dashboard/leaves`;

  const html = renderTenantEmailTemplate({
    branding,
    headerTitle: `Leave Request ${status.charAt(0) + status.slice(1).toLowerCase()}`,
    bodyHtml,
    actionButton: {
      label: "View Leave History",
      url: actionUrl,
    },
  });

  const filteredTo = filterEmails(toEmail);
  if (!filteredTo) return { success: true, message: "Skipped" };

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: filteredTo,
      subject,
      html,
    });
    console.log(`[MailUtility] Leave status update email sent for ${branding.name} to ${filteredTo}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[MailUtility] Failed to send leave status email:", error);
    return { success: false, error };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CELEBRATION EMAIL (BIRTHDAY & WORK ANNIVERSARY)
// ─────────────────────────────────────────────────────────────────────────────

export interface CelebrationEmailProps {
  tenantId?: string | null;
  employeeName: string;
  type: "BIRTHDAY" | "ANNIVERSARY";
  yearsCount?: number;
  toEmail: string;
}

export async function sendCelebrationEmail({
  tenantId,
  employeeName,
  type,
  yearsCount,
  toEmail,
}: CelebrationEmailProps) {
  const { transporter, fromAddress, branding } = await resolveTenantMailer(tenantId);

  const isBirthday = type === "BIRTHDAY";
  const icon = isBirthday ? "🎂" : "🎉";
  const subject = isBirthday
    ? `🎂 Happy Birthday from ${branding.name}, ${employeeName}! ✨`
    : `🎉 Happy Work Anniversary, ${employeeName}! 🌟`;

  const bodyHtml = `
    <div style="text-align: center; margin-bottom: 20px;">
      <span style="font-size: 54px;">${icon}</span>
    </div>

    <p style="font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 12px;">
      Dear ${employeeName},
    </p>

    ${
      isBirthday
        ? `
      <p style="font-size: 14px; line-height: 1.7; color: #334155; margin-bottom: 16px;">
        On behalf of everyone at <strong>${branding.name}</strong>, we wish you a very Happy Birthday! We hope your day is filled with celebration, joy, and wonderful moments.
      </p>
      <p style="font-size: 14px; line-height: 1.7; color: #334155; margin-bottom: 16px;">
        Thank you for being a vital member of our team. Wishing you remarkable success, great health, and happiness in the year ahead!
      </p>
    `
        : `
      <p style="font-size: 14px; line-height: 1.7; color: #334155; margin-bottom: 16px;">
        Congratulations on reaching your <strong>${yearsCount ? `${yearsCount}-Year` : ""} Work Anniversary</strong> with <strong>${branding.name}</strong>!
      </p>
      <p style="font-size: 14px; line-height: 1.7; color: #334155; margin-bottom: 16px;">
        Thank you for your tireless dedication, expertise, and contribution to our shared milestones. We are truly proud to work alongside you!
      </p>
    `
    }
  `;

  const html = renderTenantEmailTemplate({
    branding,
    headerTitle: isBirthday ? "Wishing You a Happy Birthday!" : "Happy Work Anniversary!",
    bodyHtml,
  });

  const filteredTo = filterEmails(toEmail);
  if (!filteredTo) return { success: true, message: "Skipped" };

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: filteredTo,
      subject,
      html,
    });
    console.log(`[MailUtility] Celebration email dispatched for ${branding.name} to ${filteredTo}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[MailUtility] Failed to send celebration email:", error);
    return { success: false, error };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. SALARY SLIP EMAIL
// ─────────────────────────────────────────────────────────────────────────────

export interface SalarySlipEmailProps {
  tenantId?: string | null;
  employeeName: string;
  monthName: string;
  year: number;
  pdfBuffer: Buffer;
  toEmail: string;
}

export async function sendSalarySlipEmail({
  tenantId,
  employeeName,
  monthName,
  year,
  pdfBuffer,
  toEmail,
}: SalarySlipEmailProps) {
  const { transporter, fromAddress, branding } = await resolveTenantMailer(tenantId);

  const subject = `[${branding.name}] Salary Slip - ${monthName} ${year}`;

  const bodyHtml = `
    <p style="font-size: 15px; color: #334155; margin-bottom: 14px;">
      Dear <strong>${employeeName}</strong>,
    </p>
    <p style="font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 16px;">
      Please find attached your confidential salary payslip for the month of <strong>${monthName} ${year}</strong>.
    </p>
    <div style="background-color: #f1f5f9; padding: 12px 16px; border-radius: 8px; font-size: 12px; color: #64748b;">
      📄 Attached file: <strong>Salary_Slip_${monthName}_${year}.pdf</strong>
    </div>
  `;

  const html = renderTenantEmailTemplate({
    branding,
    headerTitle: `Salary Payslip: ${monthName} ${year}`,
    bodyHtml,
  });

  const filteredTo = filterEmails(toEmail);
  if (!filteredTo) return { success: true, message: "Skipped (test email)" };

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: filteredTo,
      subject,
      html,
      attachments: [
        {
          filename: `Salary_Slip_${monthName}_${year}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });
    console.log(`[MailUtility] Salary slip dispatched for ${branding.name} to ${filteredTo}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[MailUtility] Failed to send salary slip email:", error);
    return { success: false, error };
  }
}
