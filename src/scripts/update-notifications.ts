import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Updating existing leave notifications for admins...');

  const notifications = await prisma.notification.findMany({
    where: {
      link: '/dashboard/admin',
      title: { startsWith: 'Leave Application:' }
    },
    include: {
      user: true
    }
  });

  console.log(`Found ${notifications.length} notifications to update.`);

  let updatedCount = 0;
  for (const n of notifications) {
    if (n.user.role === 'ADMIN' || n.user.role === 'SYSTEM_ADMIN' || n.user.role === 'ACCOUNTANT') {
      await prisma.notification.update({
        where: { id: n.id },
        data: { link: '/dashboard/accountant?tab=approvals' }
      });
      updatedCount++;
    }
  }

  console.log(`Successfully updated ${updatedCount} notifications.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
