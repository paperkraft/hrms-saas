/**
 * Centralized Application & Company Configuration
 * 
 * Provides instance-specific branding, metadata, and configuration
 * driven by environment variables with backward-compatible defaults for Sigma.
 */

export const appConfig = {
  // Brand & Identity
  appName: process.env.NEXT_PUBLIC_APP_NAME || "Sigma HRMS",
  companyName: process.env.NEXT_PUBLIC_COMPANY_NAME || "Sigma",
  companyFullName: process.env.COMPANY_FULL_NAME || process.env.NEXT_PUBLIC_COMPANY_FULL_NAME || "SIGMA INFRAPLAN ENGINEERING PVT. LTD.",
  companyAddress: process.env.COMPANY_ADDRESS || process.env.NEXT_PUBLIC_COMPANY_ADDRESS || "C.S. No.2101, Plot No.13, Laxmi Nagar, E Ward, Kolhapur 416005, Maharashtra, India.",
  companyTagline: process.env.NEXT_PUBLIC_COMPANY_TAGLINE || "Advanced human resources and attendance tracking for modern distributed teams.",

  // Logos
  logoUrl: process.env.NEXT_PUBLIC_LOGO_URL || "/logo.svg",
  appLogoUrl: process.env.NEXT_PUBLIC_APP_LOGO_URL || "/app-logo.svg",

  // Developer & System Administration
  devAdminEmail: (process.env.DEV_ADMIN_EMAIL || "dev@sigma.com").toLowerCase(),

  // Dummy / Test email domain filtering (emails matching this suffix won't be sent actual emails in production/testing)
  dummyEmailDomain: (process.env.DUMMY_EMAIL_DOMAIN || process.env.NEXT_PUBLIC_DUMMY_EMAIL_DOMAIN || "@sigma.com").toLowerCase(),

  // Storage Bucket
  get storageBucket() {
    const prefix = process.env.MINIO_BUCKET_PREFIX?.trim();
    if (prefix) {
      return `${prefix}-hrms`;
    }
    return process.env.MINIO_BUCKET || "hrms";
  },
} as const;

/**
 * Checks whether an email belongs to the dummy/test domain or is the dev admin
 */
export function isDummyOrDevEmail(email?: string | null): boolean {
  if (!email) return false;
  const lower = email.toLowerCase().trim();
  if (lower === appConfig.devAdminEmail) return true;
  if (appConfig.dummyEmailDomain && lower.endsWith(appConfig.dummyEmailDomain)) return true;
  return false;
}
