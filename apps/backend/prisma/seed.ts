import { BalanceOperationType, PrismaClient, Role, VacationType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const qaTeam = await prisma.team.upsert({
    where: { name: 'QA Team' },
    update: {
      description: 'Core quality assurance team',
    },
    create: {
      name: 'QA Team',
      description: 'Core quality assurance team',
    },
  });

  const admin = await prisma.user.upsert({
    where: { telegramId: '100000001' },
    update: {
      fullName: 'Admin User',
      username: 'qa_admin',
      email: 'admin@qa-timeoff.local',
      position: 'QA Admin',
      role: Role.ADMIN,
      teamId: qaTeam.id,
      isActive: true,
    },
    create: {
      telegramId: '100000001',
      fullName: 'Admin User',
      username: 'qa_admin',
      email: 'admin@qa-timeoff.local',
      position: 'QA Admin',
      role: Role.ADMIN,
      teamId: qaTeam.id,
      isActive: true,
      timeBalance: {
        create: {
          balanceHours: 40,
          totalAddedHours: 40,
          totalUsedHours: 0,
        },
      },
    },
  });

  const lead = await prisma.user.upsert({
    where: { telegramId: '100000002' },
    update: {
      fullName: 'QA Lead',
      username: 'qa_lead',
      email: 'lead@qa-timeoff.local',
      position: 'QA Lead',
      role: Role.LEAD,
      teamId: qaTeam.id,
      managerId: admin.id,
      isActive: true,
    },
    create: {
      telegramId: '100000002',
      fullName: 'QA Lead',
      username: 'qa_lead',
      email: 'lead@qa-timeoff.local',
      position: 'QA Lead',
      role: Role.LEAD,
      teamId: qaTeam.id,
      managerId: admin.id,
      isActive: true,
      timeBalance: {
        create: {
          balanceHours: 24,
          totalAddedHours: 32,
          totalUsedHours: 8,
        },
      },
    },
  });

  const employees = await Promise.all([
    prisma.user.upsert({
      where: { telegramId: '100000003' },
      update: {
        fullName: 'Anna Tester',
        username: 'anna_tester',
        email: 'anna@qa-timeoff.local',
        position: 'QA Engineer',
        role: Role.EMPLOYEE,
        teamId: qaTeam.id,
        managerId: lead.id,
        isActive: true,
      },
      create: {
        telegramId: '100000003',
        fullName: 'Anna Tester',
        username: 'anna_tester',
        email: 'anna@qa-timeoff.local',
        position: 'QA Engineer',
        role: Role.EMPLOYEE,
        teamId: qaTeam.id,
        managerId: lead.id,
        isActive: true,
        timeBalance: {
          create: {
            balanceHours: 16,
            totalAddedHours: 24,
            totalUsedHours: 8,
          },
        },
      },
    }),
    prisma.user.upsert({
      where: { telegramId: '100000004' },
      update: {
        fullName: 'Ivan Automation',
        username: 'ivan_auto',
        email: 'ivan@qa-timeoff.local',
        position: 'Automation QA Engineer',
        role: Role.EMPLOYEE,
        teamId: qaTeam.id,
        managerId: lead.id,
        isActive: true,
      },
      create: {
        telegramId: '100000004',
        fullName: 'Ivan Automation',
        username: 'ivan_auto',
        email: 'ivan@qa-timeoff.local',
        position: 'Automation QA Engineer',
        role: Role.EMPLOYEE,
        teamId: qaTeam.id,
        managerId: lead.id,
        isActive: true,
        timeBalance: {
          create: {
            balanceHours: 8,
            totalAddedHours: 16,
            totalUsedHours: 8,
          },
        },
      },
    }),
  ]);

  await prisma.balanceOperation.createMany({
    data: [
      {
        userId: admin.id,
        operationType: BalanceOperationType.ADD,
        hours: 40,
        reason: 'Initial admin balance',
        createdById: admin.id,
      },
      {
        userId: lead.id,
        operationType: BalanceOperationType.ADD,
        hours: 32,
        reason: 'Initial lead balance',
        createdById: admin.id,
      },
      {
        userId: employees[0].id,
        operationType: BalanceOperationType.ADD,
        hours: 24,
        reason: 'Initial employee balance',
        createdById: admin.id,
      },
    ],
  });

  await prisma.timeOffRequest.create({
    data: {
      userId: employees[0].id,
      date: new Date('2026-05-22T00:00:00.000Z'),
      hours: 8,
      reason: 'Personal time off',
      comment: 'Seed request',
      status: 'PENDING',
      approverId: lead.id,
    },
  });

  await prisma.vacationRequest.create({
    data: {
      userId: employees[1].id,
      startDate: new Date('2026-06-03T00:00:00.000Z'),
      endDate: new Date('2026-06-10T00:00:00.000Z'),
      daysCount: 6,
      vacationType: VacationType.ANNUAL,
      status: 'PENDING',
      comment: 'Seed vacation request',
      approverId: lead.id,
    },
  });

  await prisma.notification.create({
    data: {
      userId: admin.id,
      title: 'Seed completed',
      message: 'QA Team, admin and test users were created',
      type: 'SYSTEM',
    },
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
