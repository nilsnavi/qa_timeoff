import type { BalanceOperation, RequestStatus, Role, VacationType } from '../types';

const statusLabels: Record<RequestStatus, string> = {
  DRAFT: 'Черновик',
  PENDING: 'Ожидает',
  APPROVED: 'Согласовано',
  REJECTED: 'Отклонено',
  CANCELLED: 'Отменено',
};

const roleLabels: Record<Role, string> = {
  EMPLOYEE: 'Сотрудник',
  LEAD: 'Лид',
  MANAGER: 'Руководитель',
  ADMIN: 'Администратор',
};

const vacationTypeLabels: Record<VacationType, string> = {
  ANNUAL: 'Ежегодный оплачиваемый',
  UNPAID: 'Без сохранения',
  SICK_LEAVE: 'Больничный',
  OTHER: 'Другое',
};

const operationTypeLabels: Record<BalanceOperation['operationType'], string> = {
  ADD: 'Начисление',
  WRITE_OFF: 'Списание',
  MANUAL_CORRECTION: 'Корректировка',
  EXPIRED: 'Сгорание часов',
};

export function getStatusLabel(status: string) {
  return statusLabels[status as RequestStatus] ?? status;
}

export function getRoleLabel(role: Role) {
  return roleLabels[role] ?? role;
}

export function getVacationTypeLabel(type: VacationType) {
  return vacationTypeLabels[type] ?? type;
}

export function getOperationTypeLabel(type: BalanceOperation['operationType']) {
  return operationTypeLabels[type] ?? type;
}
