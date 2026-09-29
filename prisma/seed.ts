import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { Role, WorkMode } from '@prisma/client';
import prisma from '../src/lib/prisma';

async function main() {
  console.log('🗑️ Cleaning up existing data...');
  await prisma.pushSubscription.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.allowance.deleteMany();
  await prisma.publicHoliday.deleteMany();
  await prisma.leaveBalance.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
  await prisma.location.deleteMany();
  await prisma.systemConfig.deleteMany();

  console.log('🌱 Starting comprehensive database seed...');

  const developerPassword = await bcrypt.hash('dev@123', 10);
  const adminPassword = await bcrypt.hash('admin@123', 10);
  const defaultPassword = await bcrypt.hash('123123', 10);

  // 1. Create SYSTEM ADMIN (Developer)
  await prisma.user.create({
    data: {
      name: 'Developer Account',
      email: 'dev@sigma.com',
      password: developerPassword,
      role: Role.SYSTEM_ADMIN,
    },
  });
  console.log('✅ Created SYSTEM ADMIN (Developer)');

  // 2. Create Location
  const kolhapurOffice = await prisma.location.create({
    data: {
      name: 'Kolhapur',
      startTime: '09:30',
      endTime: '18:00',
      graceTimeMinutes: 10,
      lat: 16.703244,
      lng: 74.253469,
    },
  });
  console.log('✅ Created Office Location: Kolhapur');

  // 3. Create Departments
  const civilDept = await prisma.department.create({ data: { name: 'Civil' } });
  const softwareDept = await prisma.department.create({ data: { name: 'Software' } });
  const adminDept = await prisma.department.create({ data: { name: 'Administration' } });
  console.log('✅ Created Departments: Civil, Software, Administration');

  // 3. Create Managers and Specialized Roles
  const ashish = await prisma.user.create({
    data: {
      name: 'Ashish Doshi',
      email: 'ashishdoshi@infraplan.in',
      password: adminPassword,
      role: Role.ADMIN,
    },
  });

  await prisma.user.create({
    data: {
      name: 'Anuradha Patil',
      email: 'sigma@infraplan.in',
      password: defaultPassword,
      role: Role.ACCOUNTANT,
      departmentId: adminDept.id,
      managerId: ashish.id,
      locationId: kolhapurOffice.id,
    },
  });

  const snehal = await prisma.user.create({
    data: {
      name: 'Snehal Sutar',
      email: 'snehalsutar@infraplan.in',
      password: defaultPassword,
      role: Role.EMPLOYEE,
      departmentId: civilDept.id,
      managerId: ashish.id,
      locationId: kolhapurOffice.id,
    },
  });

  const amruta = await prisma.user.create({
    data: {
      name: 'Amruta Kale',
      email: 'amruta@infraplan.in',
      password: defaultPassword,
      role: Role.EMPLOYEE,
      departmentId: civilDept.id,
      managerId: ashish.id,
      locationId: kolhapurOffice.id,
      workMode: WorkMode.HYBRID,
    },
  });

  const vishal = await prisma.user.create({
    data: {
      name: 'Vishal Sannake',
      email: 'vishal.sannake@infraplan.co.in',
      password: defaultPassword,
      role: Role.EMPLOYEE,
      departmentId: softwareDept.id,
      managerId: ashish.id,
      locationId: kolhapurOffice.id,
    },
  });
  console.log('✅ Created Managers and Specialized Roles');

  // 4. Bulk Create Employees
  const employeesToCreate = [
    // Software Team (reporting to Vishal)
    { name: 'Prathamesh Patil', email: 'prathamesh.patil@infraplan.co.in', departmentId: softwareDept.id, managerId: vishal.id, workMode: WorkMode.HYBRID },
    { name: 'Kirti Patil', email: 'kirti.patil@infraplan.co.in', departmentId: softwareDept.id, managerId: vishal.id },
    { name: 'Ganesh Patil', email: 'ganesh.patil@infraplan.co.in', departmentId: softwareDept.id, managerId: vishal.id },

    // Civil Team (reporting to Amruta)
    { name: 'Shital Nadagire', email: 'shitalnadagire@infraplan.in', departmentId: civilDept.id, managerId: amruta.id },
    { name: 'Karansinh Magadum', email: 'karansinhmagadum@infraplan.in', departmentId: civilDept.id, managerId: amruta.id, workMode: WorkMode.HYBRID },
    { name: 'Komal Kamble', email: 'komal@sigma.com', departmentId: civilDept.id, managerId: amruta.id },

    // Civil Team (reporting to Snehal)
    { name: 'Gouri Wadkar', email: 'gouriwadkar@infraplan.in', departmentId: civilDept.id, managerId: snehal.id },
    { name: 'Neha Nandiwale', email: 'nehanandiwale@infraplan.in', departmentId: civilDept.id, managerId: snehal.id },
    { name: 'Pranil Chavan', email: 'pranilchavan@infraplan.in', departmentId: civilDept.id, managerId: snehal.id },

    // Civil Team (reporting to Ashish)
    { name: 'Abhishek Yadav', email: 'abhishekyadav@sigma.com', departmentId: adminDept.id, managerId: ashish.id },
    // Pune
    { name: 'Saikat Mandal', email: 'saikatmandal@infraplan.in', departmentId: civilDept.id, managerId: ashish.id },
    { name: 'Anirudha Kshirsagar', email: 'aniruddhakshirsagar@infraplan.in', departmentId: civilDept.id, managerId: ashish.id },

    // Personal Email
    { name: 'Dnyandeep Shitole', email: 'dnyandeepshitole@gmail.com', departmentId: civilDept.id, managerId: ashish.id },
    { name: 'Nagesh Shinde', email: 'nageshshinde9444@gmail.com', departmentId: civilDept.id, managerId: ashish.id },
    { name: 'Pawan Hiralkar', email: 'pawanhiralkar7@gmail.com', departmentId: civilDept.id, managerId: ashish.id },

    // Unkonwn
    { name: 'Vaibhav Pawar', email: 'vaibhav@sigma.com', departmentId: civilDept.id, managerId: ashish.id },
  ];

  for (const emp of employeesToCreate) {
    await prisma.user.create({
      data: {
        ...emp,
        password: defaultPassword,
        role: Role.EMPLOYEE,
        locationId: kolhapurOffice.id,
      },
    });
    console.log(`✅ Created Employee: ${emp.name}`);
  }

  console.log('✅ Finished creating bulk employees');
  console.log('🎉 Seeding completed successfully!');
  console.log('👉 Developer Login: dev@sigma.com | Password: dev@123');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seeding failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });