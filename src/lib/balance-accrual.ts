import prisma from "@/lib/prisma";
import { ensureBalance } from "@/actions/leave/core";

/**
 * Deep synchronization of all leave balances.
 * This function iterates through every user's historical records and re-calculates 
 * their carry-forward and encashment distributions based on current policy rules.
 */
function checkIsProbation(joiningDate: Date | null | string, month: number, year: number): boolean {
  if (!joiningDate) return false;
  const probationEndDate = new Date(joiningDate);
  probationEndDate.setDate(probationEndDate.getDate() + 90);
  const targetMonthDate = new Date(year, month - 1, 1);
  return targetMonthDate < probationEndDate;
}

export async function syncAllBalances() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, joiningDate: true }
  });

  let fixCount = 0;

  for (const user of users) {
    // Fetch all balances for this user chronologically
    const userBalances = await prisma.leaveBalance.findMany({
      where: { userId: user.id },
      orderBy: [{ year: 'asc' }, { month: 'asc' }]
    });

    // We process every month to ensure CF/Encash are up to date
    for (let i = 0; i < userBalances.length; i++) {
      const current = userBalances[i];
      const next = userBalances[i + 1];

      const isCurrentProbation = checkIsProbation(user.joiningDate, current.month, current.year);

      let expectedCF = 0.0;
      let expectedEncash = 0.0;
      let expectedCurrentSemiAnnual = current.semiAnnualRemaining;

      if (isCurrentProbation) {
        expectedCF = 0.0;
        expectedEncash = 0.0;
        expectedCurrentSemiAnnual = 0.0;
      } else {
        expectedCF = Math.min(Number(current.remainingFull.toFixed(2)), 1.0);
        expectedEncash = Number(Math.max(0, current.remainingFull - expectedCF).toFixed(2));
      }

      // Precision-safe comparison (0.01 tolerance)
      const hasCfDiff = Math.abs(current.carriedForward - expectedCF) > 0.01;
      const hasEncashDiff = Math.abs(current.encashed - expectedEncash) > 0.01;
      const hasSemiDiff = Math.abs(current.semiAnnualRemaining - expectedCurrentSemiAnnual) > 0.01;

      let nextRemainingFullDiffers = false;
      let expectedNextRemainingFull = 0;
      const expectedNextMonth = current.month === 12 ? 1 : current.month + 1;
      const expectedNextYear = current.month === 12 ? current.year + 1 : current.year;

      if (next && next.month === expectedNextMonth && next.year === expectedNextYear) {
        const isNextProbation = checkIsProbation(user.joiningDate, next.month, next.year);
        if (isNextProbation) {
          expectedNextRemainingFull = Math.min(2.0, Math.max(0, 2.0 - next.fullTaken));
        } else {
          // The mathematical truth for non-probation: remainingFull = min(3.0, 2.0 + expectedCF) - fullTaken
          expectedNextRemainingFull = Math.min(3.0, Number((2.0 + expectedCF).toFixed(2))) - next.fullTaken;
        }

        if (Math.abs(next.remainingFull - expectedNextRemainingFull) > 0.01) {
          nextRemainingFullDiffers = true;
        }
      }

      if (hasCfDiff || hasEncashDiff || hasSemiDiff || nextRemainingFullDiffers) {
        console.log(`[SYNC] Correcting ${user.name} (${current.month}/${current.year}): Encash ${current.encashed}->${expectedEncash}, CF ${current.carriedForward}->${expectedCF}, Semi ${current.semiAnnualRemaining}->${expectedCurrentSemiAnnual}`);

        if (hasCfDiff || hasEncashDiff || hasSemiDiff) {
          await prisma.leaveBalance.update({
            where: { id: current.id },
            data: {
              carriedForward: expectedCF,
              encashed: expectedEncash,
              semiAnnualRemaining: expectedCurrentSemiAnnual
            }
          });
        }

        if (nextRemainingFullDiffers) {
          const isNextProbation = checkIsProbation(user.joiningDate, next.month, next.year);
          await prisma.leaveBalance.update({
            where: { id: next.id },
            data: {
              remainingFull: expectedNextRemainingFull,
              ...(isNextProbation ? { carriedForward: 0.0, encashed: 0.0, semiAnnualRemaining: 0.0 } : {})
            }
          });
          // Update in-memory array to prevent stale data in the next iteration
          next.remainingFull = expectedNextRemainingFull;
          if (isNextProbation) {
            next.carriedForward = 0.0;
            next.encashed = 0.0;
            next.semiAnnualRemaining = 0.0;
          }
        }

        // Update in-memory array for current item
        current.carriedForward = expectedCF;
        current.encashed = expectedEncash;
        current.semiAnnualRemaining = expectedCurrentSemiAnnual;

        fixCount++;
      }
    }
  }
  return fixCount;
}

/**
 * Proactively ensures that all active staff members have a LeaveBalance record
 */
export async function generateAllMonthlyBalances() {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();



  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE"
    },
    select: { id: true }
  });

  const config = await prisma.systemConfig.findUnique({
    where: { id: "GLOBAL_CONFIG" }
  });
  const startMonth = (config as any)?.semiAnnualCycleStartMonth ?? 4;

  let processedCount = 0;
  for (const user of users) {
    try {
      // Ensure current month exists
      await ensureBalance(user.id, currentMonth, currentYear, startMonth);

      processedCount++;
    } catch (error) {
      console.error(`Failed to ensure balance for user ${user.id}:`, error);
    }
  }

  return processedCount;
}
