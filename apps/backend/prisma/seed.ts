import { BalanceOperationType, PrismaClient, RequestStatus, Role, VacationType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const seedTelegramIds = ['100000001', '100000002', '100000003', '100000004', '100000005', '100000006'];

const ORG_ID = 'default-org';

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  await prisma.organization.upsert({
    where: { slug: 'default' },
    update: {},
    create: { id: ORG_ID, name: 'QA TimeOff', slug: 'default', plan: 'ENTERPRISE', seatsLimit: 1000, subscriptionStatus: 'ACTIVE' },
  });

  // ── RBAC: Roles, Permissions, RolePermissions ──────────────────────
  const { roleIds, permissionIds } = await seedRbac();

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
    passwordHash,
    roleId: roleIds.ADMIN,
  });

  const webAdmin = await upsertUser({
    fullName: 'Eduard Kancer',
    email: 'ekancer@detmir.ru',
    position: 'System Administrator',
    hourlyRate: 2000,
    role: Role.ADMIN,
    teamId: qaTeam.id,
    passwordHash: '$2b$10$IEsRJ2m00CPRy5eEzbD0KuFdXf6VH1HuzUoPAjRnwRnL1zAssTEsO',
    roleId: roleIds.ADMIN,
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
    passwordHash,
    roleId: roleIds.MANAGER,
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
    passwordHash,
    roleId: roleIds.LEAD,
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
    passwordHash,
    roleId: roleIds.EMPLOYEE,
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
    passwordHash,
    roleId: roleIds.EMPLOYEE,
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
    passwordHash,
    roleId: roleIds.EMPLOYEE,
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
    where: { organizationId_name: { organizationId: ORG_ID, name } },
    update: { description },
    create: { organizationId: ORG_ID, name, description },
  });
}

async function upsertUser({
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
  roleId,
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
  roleId?: string;
}) {
  const data = {
    organizationId: ORG_ID,
    fullName,
    username,
    email,
    position,
    hourlyRate,
    role,
    teamId,
    managerId,
    isActive: true,
    ...(roleId ? { roleId } : {}),
    ...(passwordHash ? { passwordHash } : {}),
    ...(telegramId ? { telegramId } : {}),
  };

  if (telegramId) {
    const existing = await prisma.user.findFirst({ where: { telegramId, organizationId: ORG_ID } });
    if (existing) {
      return prisma.user.update({ where: { id: existing.id }, data });
    }
    return prisma.user.create({ data: { ...data, timeBalance: { create: {} } } });
  }

  const existing = await prisma.user.findFirst({ where: { email, organizationId: ORG_ID } });
  if (existing) {
    return prisma.user.update({ where: { id: existing.id }, data });
  }
  return prisma.user.create({ data: { ...data, timeBalance: { create: {} } } });
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

// ── RBAC Seed ────────────────────────────────────────────────────────

const PERMISSION_DEFS: { code: string; name: string; group: string; description: string }[] = [
  { code: 'dashboard.view', name: 'Просмотр дашборда', group: 'Дашборд', description: 'Доступ к главному дашборду' },

  { code: 'requests.own.view', name: 'Просмотр своих заявок', group: 'Заявки', description: 'Видеть свои заявки' },
  { code: 'requests.own.create', name: 'Создание своих заявок', group: 'Заявки', description: 'Создавать заявки' },
  { code: 'requests.own.edit', name: 'Редактирование своих заявок', group: 'Заявки', description: 'Редактировать свои заявки' },
  { code: 'requests.own.cancel', name: 'Отмена своих заявок', group: 'Заявки', description: 'Отменять свои заявки' },
  { code: 'requests.team.view', name: 'Просмотр заявок команды', group: 'Заявки', description: 'Видеть заявки своей команды' },
  { code: 'requests.all.view', name: 'Просмотр всех заявок', group: 'Заявки', description: 'Видеть все заявки' },

  { code: 'approvals.team.approve', name: 'Согласование заявок команды', group: 'Согласование', description: 'Согласовывать заявки своей команды' },
  { code: 'approvals.team.reject', name: 'Отклонение заявок команды', group: 'Согласование', description: 'Отклонять заявки своей команды' },
  { code: 'approvals.all.approve', name: 'Согласование всех заявок', group: 'Согласование', description: 'Согласовывать любые заявки' },
  { code: 'approvals.all.reject', name: 'Отклонение всех заявок', group: 'Согласование', description: 'Отклонять любые заявки' },

  { code: 'balance.own.view', name: 'Просмотр своего баланса', group: 'Баланс', description: 'Видеть свой баланс' },
  { code: 'balance.team.view', name: 'Просмотр баланса команды', group: 'Баланс', description: 'Видеть баланс команды' },
  { code: 'balance.all.view', name: 'Просмотр всех балансов', group: 'Баланс', description: 'Видеть баланс всех сотрудников' },
  { code: 'balance.adjust', name: 'Управление балансом', group: 'Баланс', description: 'Начислять и списывать часы' },

  { code: 'calendar.own.view', name: 'Просмотр своего календаря', group: 'Календарь', description: 'Видеть свой календарь' },
  { code: 'calendar.team.view', name: 'Просмотр календаря команды', group: 'Календарь', description: 'Видеть календарь команды' },
  { code: 'calendar.all.view', name: 'Просмотр всех календарей', group: 'Календарь', description: 'Видеть календари всех' },

  { code: 'analytics.team.view', name: 'Просмотр аналитики команды', group: 'Аналитика', description: 'Видеть аналитику команды' },
  { code: 'analytics.all.view', name: 'Просмотр всей аналитики', group: 'Аналитика', description: 'Видеть всю аналитику' },
  { code: 'analytics.export', name: 'Экспорт аналитики', group: 'Аналитика', description: 'Экспортировать аналитические данные' },

  { code: 'reports.team.view', name: 'Просмотр отчётов команды', group: 'Отчёты', description: 'Видеть отчёты команды' },
  { code: 'reports.all.view', name: 'Просмотр всех отчётов', group: 'Отчёты', description: 'Видеть все отчёты' },
  { code: 'reports.export', name: 'Экспорт отчётов', group: 'Отчёты', description: 'Экспортировать отчёты' },

  { code: 'employees.view', name: 'Просмотр сотрудников', group: 'Сотрудники', description: 'Видеть список сотрудников' },
  { code: 'employees.create', name: 'Создание сотрудников', group: 'Сотрудники', description: 'Создавать новых сотрудников' },
  { code: 'employees.edit', name: 'Редактирование сотрудников', group: 'Сотрудники', description: 'Редактировать данные сотрудников' },
  { code: 'employees.deactivate', name: 'Деактивация сотрудников', group: 'Сотрудники', description: 'Деактивировать сотрудников' },
  { code: 'employees.import', name: 'Импорт сотрудников', group: 'Сотрудники', description: 'Импортировать сотрудников из CSV' },

  { code: 'teams.view', name: 'Просмотр команд', group: 'Команды', description: 'Видеть список команд' },
  { code: 'teams.create', name: 'Создание команд', group: 'Команды', description: 'Создавать новые команды' },
  { code: 'teams.edit', name: 'Редактирование команд', group: 'Команды', description: 'Редактировать команды' },
  { code: 'teams.delete', name: 'Удаление команд', group: 'Команды', description: 'Удалять команды' },

  { code: 'settings.company.view', name: 'Просмотр настроек', group: 'Настройки', description: 'Видеть настройки организации' },
  { code: 'settings.company.edit', name: 'Редактирование настроек', group: 'Настройки', description: 'Редактировать настройки организации' },

  { code: 'users.view', name: 'Просмотр пользователей', group: 'Пользователи', description: 'Видеть список пользователей' },
  { code: 'users.create', name: 'Создание пользователей', group: 'Пользователи', description: 'Создавать пользователей' },
  { code: 'users.edit', name: 'Редактирование пользователей', group: 'Пользователи', description: 'Редактировать пользователей' },
  { code: 'users.deactivate', name: 'Деактивация пользователей', group: 'Пользователи', description: 'Деактивировать пользователей' },
  { code: 'users.reset_password', name: 'Сброс пароля', group: 'Пользователи', description: 'Сбрасывать пароль пользователя' },

  { code: 'roles.view', name: 'Просмотр ролей', group: 'Роли', description: 'Видеть список ролей' },
  { code: 'roles.create', name: 'Создание ролей', group: 'Роли', description: 'Создавать новые роли' },
  { code: 'roles.edit', name: 'Редактирование ролей', group: 'Роли', description: 'Редактировать роли и права' },
  { code: 'roles.delete', name: 'Удаление ролей', group: 'Роли', description: 'Удалять роли' },
  { code: 'roles.assign', name: 'Назначение ролей', group: 'Роли', description: 'Назначать роли пользователям' },

  { code: 'audit.view', name: 'Просмотр журналов', group: 'Журналы', description: 'Видеть аудит-лог' },
  { code: 'audit.export', name: 'Экспорт журналов', group: 'Журналы', description: 'Экспортировать аудит-лог' },

  { code: 'notifications.own.view', name: 'Просмотр своих уведомлений', group: 'Уведомления', description: 'Видеть свои уведомления' },
  { code: 'notifications.all.view', name: 'Просмотр всех уведомлений', group: 'Уведомления', description: 'Видеть все уведомления' },
];

const ADMIN_PERMISSIONS = PERMISSION_DEFS.map(p => p.code);

const MANAGER_PERMISSIONS = [
  'dashboard.view',
  'requests.own.view', 'requests.own.create', 'requests.own.edit', 'requests.own.cancel',
  'requests.team.view',
  'approvals.team.approve', 'approvals.team.reject',
  'balance.own.view', 'balance.team.view',
  'calendar.own.view', 'calendar.team.view',
  'analytics.team.view', 'analytics.export',
  'reports.team.view', 'reports.export',
  'employees.view',
  'teams.view',
  'notifications.own.view', 'notifications.all.view',
];

const LEAD_PERMISSIONS = [
  'dashboard.view',
  'requests.own.view', 'requests.own.create', 'requests.own.edit', 'requests.own.cancel',
  'requests.team.view',
  'approvals.team.approve', 'approvals.team.reject',
  'balance.own.view', 'balance.team.view',
  'calendar.own.view', 'calendar.team.view',
  'analytics.team.view',
  'reports.team.view',
  'notifications.own.view',
];

const EMPLOYEE_PERMISSIONS = [
  'dashboard.view',
  'requests.own.view', 'requests.own.create', 'requests.own.edit', 'requests.own.cancel',
  'balance.own.view',
  'calendar.own.view',
  'notifications.own.view',
];

async function seedRbac() {
  const roleDefs = [
    { code: 'ADMIN', name: 'Администратор', isSystem: true, description: 'Полный доступ ко всем разделам системы', perms: ADMIN_PERMISSIONS },
    { code: 'MANAGER', name: 'Руководитель', isSystem: true, description: 'Управление командами, аналитика и согласование', perms: MANAGER_PERMISSIONS },
    { code: 'LEAD', name: 'Лид', isSystem: true, description: 'Своя команда, согласование заявок и аналитика', perms: LEAD_PERMISSIONS },
    { code: 'EMPLOYEE', name: 'Сотрудник', isSystem: true, description: 'Только свои заявки и баланс', perms: EMPLOYEE_PERMISSIONS },
  ];

  const permMap = new Map<string, string>();
  for (const def of PERMISSION_DEFS) {
    const perm = await prisma.permission.upsert({
      where: { code: def.code },
      update: { name: def.name, description: def.description, groupName: def.group },
      create: { code: def.code, name: def.name, description: def.description, groupName: def.group },
    });
    permMap.set(def.code, perm.id);
  }

  const roleIds: Record<string, string> = {};
  for (const def of roleDefs) {
    const role = await prisma.roleModel.upsert({
      where: { code: def.code },
      update: { name: def.name, description: def.description, isSystem: def.isSystem },
      create: { code: def.code, name: def.name, description: def.description, isSystem: def.isSystem, isActive: true },
    });
    roleIds[def.code] = role.id;

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const permIds = def.perms.map(code => permMap.get(code)).filter(Boolean) as string[];
    if (permIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permIds.map(pid => ({ roleId: role.id, permissionId: pid })),
        skipDuplicates: true,
      });
    }
  }

  return { roleIds, permissionIds: Object.fromEntries(permMap) };
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
