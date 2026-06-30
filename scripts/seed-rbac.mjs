import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PERMISSION_DEFS = [
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

async function main() {
  console.log('Seeding permissions...');
  const permMap = new Map();
  for (const def of PERMISSION_DEFS) {
    const perm = await prisma.permission.upsert({
      where: { code: def.code },
      update: { name: def.name, description: def.description, groupName: def.group },
      create: { code: def.code, name: def.name, description: def.description, groupName: def.group },
    });
    permMap.set(def.code, perm.id);
  }
  console.log(`  Created ${permMap.size} permissions`);

  const ALL_PERMS = PERMISSION_DEFS.map(p => p.code);
  const roleDefs = [
    { code: 'ADMIN', name: 'Администратор', isSystem: true, description: 'Полный доступ ко всем разделам системы', perms: ALL_PERMS },
    { code: 'MANAGER', name: 'Руководитель', isSystem: true, description: 'Управление командами, аналитика и согласование', perms: [
      'dashboard.view', 'requests.own.view', 'requests.own.create', 'requests.own.edit', 'requests.own.cancel',
      'requests.team.view', 'approvals.team.approve', 'approvals.team.reject', 'balance.own.view', 'balance.team.view',
      'calendar.own.view', 'calendar.team.view', 'analytics.team.view', 'analytics.export', 'reports.team.view',
      'reports.export', 'employees.view', 'teams.view', 'notifications.own.view', 'notifications.all.view',
    ]},
    { code: 'LEAD', name: 'Лид', isSystem: true, description: 'Своя команда, согласование заявок и аналитика', perms: [
      'dashboard.view', 'requests.own.view', 'requests.own.create', 'requests.own.edit', 'requests.own.cancel',
      'requests.team.view', 'approvals.team.approve', 'approvals.team.reject', 'balance.own.view', 'balance.team.view',
      'calendar.own.view', 'calendar.team.view', 'analytics.team.view', 'reports.team.view', 'notifications.own.view',
    ]},
    { code: 'EMPLOYEE', name: 'Сотрудник', isSystem: true, description: 'Только свои заявки и баланс', perms: [
      'dashboard.view', 'requests.own.view', 'requests.own.create', 'requests.own.edit', 'requests.own.cancel',
      'balance.own.view', 'calendar.own.view', 'notifications.own.view',
    ]},
  ];

  console.log('Seeding roles...');
  for (const def of roleDefs) {
    const role = await prisma.roleModel.upsert({
      where: { code: def.code },
      update: { name: def.name, description: def.description, isSystem: def.isSystem },
      create: { code: def.code, name: def.name, description: def.description, isSystem: def.isSystem, isActive: true },
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const permIds = def.perms.map(code => permMap.get(code)).filter(Boolean);
    if (permIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permIds.map(pid => ({ roleId: role.id, permissionId: pid })),
        skipDuplicates: true,
      });
    }
    console.log(`  Role ${def.code} — ${permIds.length} permissions`);
  }

  console.log('Assigning ADMIN role to existing admin users...');
  const adminRole = await prisma.roleModel.findUnique({ where: { code: 'ADMIN' } });
  if (adminRole) {
    const result = await prisma.user.updateMany({
      where: { role: 'ADMIN', roleId: null },
      data: { roleId: adminRole.id },
    });
    console.log(`  Updated ${result.count} admin users`);
  }

  console.log('RBAC seed completed');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
