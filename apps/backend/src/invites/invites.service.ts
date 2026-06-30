import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Prisma, Role, User } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { EmailNotificationService } from '../notifications/email-notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { CreateInviteDto } from './dto/create-invite.dto';

@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly emailNotification?: EmailNotificationService,
  ) {}

  async findAll(currentUser: User) {
    const where: Prisma.InviteWhereInput = {};
    if (currentUser.role !== Role.ADMIN) {
      where.invitedById = currentUser.id;
    }
    return this.prisma.invite.findMany({
      where,
      include: { team: { select: { id: true, name: true } }, invitedBy: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(currentUser: User, dto: CreateInviteDto) {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const invite = await this.prisma.invite.create({
      data: {
        email: dto.email,
        role: (dto.role as Role) ?? Role.EMPLOYEE,
        teamId: dto.teamId ?? null,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        invitedById: currentUser.id,
      },
      include: { team: { select: { id: true, name: true } } },
    });

    this.audit.log({ actorId: currentUser.id, action: 'INVITE_CREATED', entityType: 'invite', entityId: invite.id });

    const link = `${this.getBaseUrl()}/invite/accept?token=${token}`;
    return { ...invite, link, token };
  }

  async accept(token: string, acceptDto: AcceptInviteDto) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const invite = await this.prisma.invite.findUnique({ where: { tokenHash } });
    if (!invite) throw new NotFoundException('Invalid invite token');
    if (invite.status !== 'PENDING') throw new BadRequestException('Invite is already ' + invite.status.toLowerCase());
    if (invite.expiresAt < new Date()) throw new BadRequestException('Invite has expired');

    const existingUser = await this.prisma.user.findFirst({ where: { email: invite.email } });
    if (existingUser) {
      await this.prisma.user.update({
        where: { id: existingUser.id },
        data: { teamId: invite.teamId, role: invite.role, isActive: true },
      });
    } else {
      const passwordHash = await bcrypt.hash(acceptDto.password, 10);
      await this.prisma.user.create({
        data: {
          organizationId: 'default-org',
          fullName: acceptDto.fullName,
          email: invite.email,
          passwordHash,
          role: invite.role,
          teamId: invite.teamId,
          isActive: true,
          mustChangePassword: false,
          timeBalance: { create: {} },
        },
      });
    }

    await this.prisma.invite.update({
      where: { id: invite.id },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });

    this.audit.log({ actorId: invite.invitedById, action: 'INVITE_ACCEPTED', entityType: 'invite', entityId: invite.id });
    return { success: true };
  }

  async cancel(currentUser: User, id: string) {
    const invite = await this.prisma.invite.findUnique({ where: { id } });
    if (!invite) throw new NotFoundException('Invite not found');
    if (currentUser.role !== Role.ADMIN && invite.invitedById !== currentUser.id) {
      throw new ForbiddenException('Access denied');
    }
    await this.prisma.invite.update({ where: { id }, data: { status: 'CANCELLED' } });
    this.audit.log({ actorId: currentUser.id, action: 'INVITE_CANCELLED', entityType: 'invite', entityId: id });
    return { success: true };
  }

  private getBaseUrl(): string {
    return process.env.FRONTEND_URL ?? 'http://localhost:5173';
  }
}
