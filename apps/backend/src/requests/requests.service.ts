import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BalanceOperationType, RequestStatus } from '@prisma/client';
import { NotificationType } from '../notifications/notification-types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRequestDto } from './dto/create-request.dto';

@Injectable()
export class RequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateRequestDto) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.timeOffRequest.create({
        data: {
          userId,
          date: new Date(dto.date ?? dto.startDate),
          hours: dto.hours,
          reason: dto.reason || 'Time off',
          comment: dto.comment,
        },
        include: { user: true },
      });

      const reviewers = await tx.user.findMany({
        where: { role: { in: ['LEAD', 'MANAGER', 'ADMIN'] } },
        select: { id: true },
      });

      await tx.notification.createMany({
        data: reviewers
          .filter((reviewer) => reviewer.id !== userId)
          .map((reviewer) => ({
            userId: reviewer.id,
            title: 'New time off request',
            message: `${request.user.fullName} created a time off request`,
            type: NotificationType.REQUEST_CREATED,
          })),
      });

      return request;
    });
  }

  async review(approverId: string, requestId: string, status: 'APPROVED' | 'REJECTED') {
    const request = await this.prisma.timeOffRequest.findUnique({
      where: { id: requestId },
      include: { user: true },
    });

    if (!request) {
      throw new NotFoundException('Request not found');
    }
    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be reviewed');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.timeOffRequest.update({
        where: { id: requestId },
        data: { status, approverId, approvedAt: status === RequestStatus.APPROVED ? new Date() : null },
        include: { user: true, approver: true },
      });

      if (status === RequestStatus.APPROVED && request.hours > 0) {
        await tx.timeBalance.update({
          where: { userId: request.userId },
          data: {
            balanceHours: { decrement: request.hours },
            totalUsedHours: { increment: request.hours },
          },
        });
      }

      await tx.balanceOperation.create({
        data: {
          userId: request.userId,
          operationType:
            status === RequestStatus.APPROVED
              ? BalanceOperationType.WRITE_OFF
              : BalanceOperationType.MANUAL_CORRECTION,
          hours: status === RequestStatus.APPROVED ? -request.hours : 0,
          reason: `Time off request ${status.toLowerCase()}`,
          createdById: approverId,
        },
      });

      await tx.notification.create({
        data: {
          userId: request.userId,
          title: status === RequestStatus.APPROVED ? 'Request approved' : 'Request rejected',
          message: `Time off request was ${status.toLowerCase()}`,
          type: status === RequestStatus.APPROVED ? NotificationType.REQUEST_APPROVED : NotificationType.REQUEST_REJECTED,
        },
      });

      return updated;
    });
  }
}
