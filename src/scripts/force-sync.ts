import 'dotenv/config';
import prisma from "@/lib/prisma";
import { CASUAL_ACCRUAL, MAX_TOTAL_CASUAL } from "@/actions/leave/utils";

async function forceSync() {
  console.log("--- FORCE SYNC START ---");
  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  
  for (const user of users) {
    const balances = await prisma.leaveBalance.findMany({
      where: { userId: user.id },
      orderBy: [{ year: 'asc' }, { month: 'asc' }]
    });

    for (let i = 0; i < balances.length - 1; i++) {
        const curr = balances[i];
        const next = balances[i+1];

        // Recalculate what Carry Forward SHOULD be from curr
        const rem = Number(curr.remainingFull.toFixed(2));
        const expectedCF = Math.min(rem, 1.0);
        const expectedEncash = Number((rem - expectedCF).toFixed(2));

        if (Math.abs(curr.carriedForward - expectedCF) > 0.01 || Math.abs(curr.encashed - expectedEncash) > 0.01) {
            console.log(`  [FIX] Updating ${curr.month}/${curr.year} CF for ${user.name}`);
            await prisma.leaveBalance.update({
                where: { id: curr.id },
                data: { carriedForward: expectedCF, encashed: expectedEncash }
            });
            curr.carriedForward = expectedCF; // update in memory for next iteration
        }

        // Now strictly verify next's remainingFull
        const expectedNextRemaining = Math.max(0, Math.min(MAX_TOTAL_CASUAL, CASUAL_ACCRUAL + curr.carriedForward) - next.fullTaken);
        
        if (Math.abs(next.remainingFull - expectedNextRemaining) > 0.01) {
            console.log(`  [FIX] Adjusting ${next.month}/${next.year} remainingFull for ${user.name}: Was ${next.remainingFull}, Expected ${expectedNextRemaining}`);
            await prisma.leaveBalance.update({
                where: { id: next.id },
                data: { remainingFull: expectedNextRemaining }
            });
            next.remainingFull = expectedNextRemaining; // update in memory for next iteration
        }
    }
  }
  console.log("--- FORCE SYNC END ---");
}

forceSync().catch(console.error).finally(() => prisma.$disconnect());
