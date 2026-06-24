import { BalanceOperationType, PrismaClient, RequestStatus, Role, VacationType } from '@prisma/client';

const prisma = new PrismaClient();

const seedTelegramIds = ['100000001', '100000002', '100000003', '100000004', '100000005', '100000006'];

async function main() {
  const [qaTeam, sapEwmTeam, automationTeam] = await Promise.all([
    upsertTeam('QA Team', 'Core quality assurance team'),
    upsertTeam('SAP EWM Team', 'Warehouse management testing team'),
    upsertTeam('Automation Team', 'Test automation and tooling team'),
  ]);

  const admin = await upsertUser({
    telegramId: '100000001',
    fullName: 'Admin',
    username: 'admin',
    email: 'admin@qa-timeoff.local',
    position: 'System Administrator',
    hourlyRate: 2000,
    role: Role.ADMIN,
    teamId: qaTeam.id,
  });

  const webAdmin = await upsertUser({
    fullName: 'Eduard Kancer',
    email: 'ekancer@detmir.ru',
    position: 'System Administrator',
    hourlyRate: 2000,
    role: Role.ADMIN,
    teamId: qaTeam.id,
    passwordHash: '$2b$10$IEsRJ2m00CPRy5eEzbD0KuFdXf6VH1HuzUoPAjRnwRnL1zAssTEsO',
  });

  const manager = await upsertUser({
    telegramId: '100000002',
    fullName: 'Manager',
    username: 'manager',
    email: 'manager@qa-timeoff.local',
    position: 'QA Manager',
    hourlyRate: 1500,
    role: Role.MANAGER,
    teamId: qaTeam.id,
    managerId: admin.id,
  });

  const lead = await upsertUser({
    telegramId: '100000003',
    fullName: 'Lead',
    username: 'lead',
    email: 'lead@qa-timeoff.local',
    position: 'QA Lead',
    hourlyRate: 1200,
    role: Role.LEAD,
    teamId: qaTeam.id,
    managerId: manager.id,
  });

  const employee1 = await upsertUser({
    telegramId: '100000004',
    fullName: 'Employee 1',
    username: 'employee_1',
    email: 'employee1@qa-timeoff.local',
    position: 'QA Engineer',
    hourlyRate: 800,
    role: Role.EMPLOYEE,
    teamId: qaTeam.id,
    managerId: lead.id,
  });

  const employee2 = await upsertUser({
    telegramId: '100000005',
    fullName: 'Employee 2',
    username: 'employee_2',
    email: 'employee2@qa-timeoff.local',
    position: 'SAP EWM QA Engineer',
    hourlyRate: 850,
    role: Role.EMPLOYEE,
    teamId: sapEwmTeam.id,
    managerId: manager.id,
  });

  const employee3 = await upsertUser({
    telegramId: '100000006',
    fullName: 'Employee 3',
    username: 'employee_3',
    email: 'employee3@qa-timeoff.local',
    position: 'Automation QA Engineer',
    hourlyRate: 900,
    role: Role.EMPLOYEE,
    teamId: automationTeam.id,
    managerId: lead.id,
  });

  const users = [admin, webAdmin, manager, lead, employee1, employee2, employee3];
  const userIds = users.map((user) => user.id);

  await cleanSeedData(userIds);

  await Promise.all([
    upsertBalance(admin.id, 80, 96, 16),
    upsertBalance(manager.id, 56, 72, 16),
    upsertBalance(lead.id, 40, 56, 16),
    upsertBalance(employee1.id, 32, 48, 16),
    upsertBalance(employee2.id, 24, 40, 16),
    upsertBalance(employee3.id, 16, 32, 16),
  ]);

  await prisma.balanceOperation.createMany({
    data: [
      operation(admin.id, admin.id, BalanceOperationType.ADD, 96, 'Initial admin balance'),
      operation(admin.id, admin.id, BalanceOperationType.WRITE_OFF, -16, 'Approved time off'),
      operation(manager.id, admin.id, BalanceOperationType.ADD, 72, 'Initial manager balance'),
      operation(manager.id, admin.id, BalanceOperationType.WRITE_OFF, -16, 'Approved vacation support day'),
      operation(lead.id, admin.id, BalanceOperationType.ADD, 56, 'Initial lead balance'),
      operation(lead.id, manager.id, BalanceOperationType.WRITE_OFF, -16, 'Approved time off'),
      operation(employee1.id, admin.id, BalanceOperationType.ADD, 48, 'Initial employee balance'),
      operation(employee1.id, lead.id, BalanceOperationType.WRITE_OFF, -16, 'Approved time off'),
      operation(employee2.id, admin.id, BalanceOperationType.ADD, 40, 'Initial employee balance'),
      operation(employee2.id, manager.id, BalanceOperationType.WRITE_OFF, -16, 'Approved time off'),
      operation(employee3.id, admin.id, BalanceOperationType.ADD, 32, 'Initial employee balance'),
      operation(employee3.id, lead.id, BalanceOperationType.WRITE_OFF, -16, 'Approved time off'),
    ],
  });

  await prisma.timeOffRequest.createMany({
    data: [
      {
        userId: employee1.id,
        date: date('2026-05-22'),
        hours: 8,
        reason: 'Personal appointment',
        comment: 'Need the afternoon for personal matters',
        status: RequestStatus.PENDING,
      },
      {
        userId: employee2.id,
        date: date('2026-05-27'),
        hours: 4,
        reason: 'Family matters',
        comment: 'Short absence in the morning',
        status: RequestStatus.PENDING,
      },
      {
        userId: employee3.id,
        date: date('2026-05-15'),
        hours: 8,
        reason: 'Release recovery day',
        comment: 'Worked late during release',
        status: RequestStatus.APPROVED,
        approverId: lead.id,
        approvedAt: date('2026-05-10'),
      },
      {
        userId: lead.id,
        date: date('2026-05-12'),
        hours: 8,
        reason: 'Overtime compensation',
        status: RequestStatus.APPROVED,
        approverId: manager.id,
        approvedAt: date('2026-05-07'),
      },
      {
        userId: manager.id,
        date: date('2026-06-02'),
        hours: 4,
        reason: 'Medical appointment',
        status: RequestStatus.PENDING,
      },
    ],
  });

  await prisma.vacationRequest.createMany({
    data: [
      {
        userId: employee1.id,
        startDate: date('2026-06-03'),
        endDate: date('2026-06-07'),
        daysCount: 5,
        vacationType: VacationType.ANNUAL,
        status: RequestStatus.PENDING,
        comment: 'Planned family trip',
      },
      {
        userId: employee2.id,
        startDate: date('2026-06-10'),
        endDate: date('2026-06-14'),
        daysCount: 5,
        vacationType: VacationType.ANNUAL,
        status: RequestStatus.APPROVED,
        approverId: manager.id,
        approvedAt: date('2026-05-18'),
        comment: 'Approved summer vacation',
      },
      {
        userId: employee3.id,
        startDate: date('2026-05-29'),
        endDate: date('2026-05-30'),
        daysCount: 2,
        vacationType: VacationType.SICK_LEAVE,
        status: RequestStatus.APPROVED,
        approverId: lead.id,
        approvedAt: date('2026-05-20'),
        comment: 'Medical certificate provided',
      },
      {
        userId: lead.id,
        startDate: date('2026-07-01'),
        endDate: date('2026-07-05'),
        daysCount: 5,
        vacationType: VacationType.ANNUAL,
        status: RequestStatus.PENDING,
        comment: 'Planning ahead for July',
      },
      {
        userId: manager.id,
        startDate: date('2026-06-17'),
        endDate: date('2026-06-18'),
        daysCount: 2,
        vacationType: VacationType.UNPAID,
        status: RequestStatus.APPROVED,
        approverId: admin.id,
        approvedAt: date('2026-05-19'),
        comment: 'Personal unpaid leave',
      },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: admin.id,
        title: 'Seed completed',
        message: 'Demo teams, users, balances and requests were created',
        type: 'SYSTEM',
      },
      {
        userId: lead.id,
        title: 'Pending request',
        message: 'Employee 1 requested time off',
        type: 'REQUEST_CREATED',
      },
      {
        userId: manager.id,
        title: 'Pending vacation',
        message: 'Lead requested annual vacation',
        type: 'REQUEST_CREATED',
      },
    ],
  });

  console.log('Seed completed');
}

function upsertTeam(name: string, description: string) {
  return prisma.team.upsert({
    where: { name },
    update: { description },
    create: { name, description },
  });
}

function upsertUser({
  telegramId,
  fullName,
  username,
  email,
  position,
  hourlyRate,
  role,
  teamId,
  managerId,
  passwordHash,
}: {
  telegramId?: string;
  fullName: string;
  username?: string;
  email: string;
  position: string;
  hourlyRate: number;
  role: Role;
  teamId: string;
  managerId?: string;
  passwordHash?: string;
}) {
  const data = {
    fullName,
    username,
    email,
    position,
    hourlyRate,
    role,
    teamId,
    managerId,
    isActive: true,
    ...(passwordHash ? { passwordHash } : {}),
    ...(telegramId ? { telegramId } : {}),
  };

  if (telegramId) {
    return prisma.user.upsert({
      where: { telegramId },
      update: data,
      create: {
        ...data,
        timeBalance: { create: {} },
      },
    });
  }

  return prisma.user.upsert({
    where: { email },
    update: data,
    create: {
      ...data,
      timeBalance: { create: {} },
    },
  });
}

function upsertBalance(userId: string, balanceHours: number, totalAddedHours: number, totalUsedHours: number) {
  return prisma.timeBalance.upsert({
    where: { userId },
    update: {
      balanceHours,
      totalAddedHours,
      totalUsedHours,
    },
    create: {
      userId,
      balanceHours,
      totalAddedHours,
      totalUsedHours,
    },
  });
}

async function cleanSeedData(userIds: string[]) {
  await prisma.notification.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.timeOffRequest.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.vacationRequest.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.balanceOperation.deleteMany({
    where: { userId: { in: userIds } },
  });
}

function operation(userId: string, createdById: string, operationType: BalanceOperationType, hours: number, reason: string) {
  return {
    userId,
    createdById,
    operationType,
    hours,
    reason,
  };
}

function date(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
