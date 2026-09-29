import { Prisma } from "@prisma/client";
import { appConfig } from "./app-config";

export interface PayrollEligibleOptions {
  includePastPersonnel?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * Returns a Prisma `UserWhereInput` filter that identifies workforce personnel
 * who are eligible for attendance ledger tracking, leave balances, and monthly payroll processing.
 * 
 * Dynamic Logic:
 * 1. For live operations: User must have status: "ACTIVE"
 * 2. For historical accounting/audit: Allows users active during the target date range or with past attendance/payroll.
 * 3. Explicitly excludes Developer / SYSTEM_ADMIN accounts and dummy dev emails.
 * 4. If assigned a RoleDefinition, roleDefinition.isPayrollEligible must be true AND code != "SYSTEM_ADMIN".
 * 5. Fallback for unassigned/legacy users: role is not in SYSTEM_ADMIN, ADMIN, or EXTERNAL_USER.
 */
export function getPayrollEligibleUserWhere(
  extraWhere?: Prisma.UserWhereInput,
  options?: PayrollEligibleOptions
): Prisma.UserWhereInput {
  let statusCondition: Prisma.UserWhereInput;

  if (options?.includePastPersonnel) {
    if (options.dateRange) {
      statusCondition = {
        AND: [
          // 1. Employee must have joined on or before the end of the evaluated month
          {
            OR: [
              { joiningDate: null },
              { joiningDate: { lte: options.dateRange.end } },
            ],
          },
          // 2. Resignation & status boundary
          {
            OR: [
              // Active employees who have not resigned prior to this month
              {
                status: "ACTIVE",
                OR: [
                  { resignationDate: null },
                  { resignationDate: { gte: options.dateRange.start } },
                ],
              },
              // Inactive/Resigned/Terminated employees: included if they were present in this month or resigned in/after this month
              {
                status: { in: ["RESIGNED", "INACTIVE", "TERMINATED"] },
                OR: [
                  { resignationDate: { gte: options.dateRange.start } },
                  { attendances: { some: { date: { gte: options.dateRange.start, lte: options.dateRange.end } } } },
                ],
              },
            ],
          },
        ],
      };
    } else {
      statusCondition = {
        status: { in: ["ACTIVE", "RESIGNED", "INACTIVE", "TERMINATED"] },
      };
    }
  } else {
    statusCondition = {
      status: "ACTIVE",
    };
  }

  return {
    ...statusCondition,
    isExternal: false,
    NOT: [
      { isExternal: true },
      { email: { in: [appConfig.devAdminEmail, "dev@sigma.com"] } },
      { roleDefinition: { code: "SYSTEM_ADMIN" } },
      { roleDefinition: { code: "EXTERNAL_USER" } },
      { roleDefinition: { isExternal: true } },
      { roleDefinition: { isPayrollEligible: false } },
    ],
    OR: [
      {
        roleDefinition: {
          isPayrollEligible: true,
          isExternal: false,
          code: { notIn: ["SYSTEM_ADMIN", "EXTERNAL_USER"] },
        },
      },
      {
        roleDefinitionId: null,
        role: { not: "ADMIN" },
        isExternal: false,
      },
    ],
    ...extraWhere,
  };
}

