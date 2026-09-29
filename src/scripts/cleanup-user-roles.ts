import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Sanitizing user assignedRoleIds and allowedMenus...");
  const users = await prisma.user.findMany({
    include: { roleDefinition: true }
  });

  for (const user of users) {
    const roleIds = (user.assignedRoleIds && user.assignedRoleIds.length > 0)
      ? user.assignedRoleIds
      : (user.roleDefinitionId ? [user.roleDefinitionId] : []);

    let roleDefs: any[] = [];
    if (roleIds.length > 0) {
      roleDefs = await prisma.roleDefinition.findMany({
        where: { id: { in: roleIds } }
      });
    }

    const mergedMenus = Array.from(new Set(roleDefs.flatMap(r => r.allowedMenus || [])));

    await prisma.user.update({
      where: { id: user.id },
      data: {
        assignedRoleIds: roleIds,
        allowedMenus: mergedMenus
      }
    });
    console.log(`Cleaned user: ${user.name || user.email} -> assignedRoleIds: ${JSON.stringify(roleIds)}, menus count: ${mergedMenus.length}`);
  }
  console.log("Cleanup complete!");
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
