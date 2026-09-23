import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { randomBytes, createHash } from 'crypto';
import { InvitesRepository } from '../repositories/invites.repository';
import { MembershipsService } from './memberships.service';
import { OrganizationsRepository } from '../repositories/organizations.repository';
import { CreateInviteDto, AcceptInviteDto } from '../dto';
import { Membership } from '../entities/membership.entity';
import { Invite } from '../entities/invite.entity';
import { RequestContext } from '../../../shared/interfaces';
import { AppError } from '../../../shared/errors/app-error';
import { ErrorCodes } from '../../../shared/errors/error-codes';
import { EventType, Role } from '../../../shared/enums';
import { DomainEvent } from '../../../shared/interfaces';
import { INVITE_TOKEN_TTL_HOURS } from '../../../shared/constants';
import { UsersService } from '../../users/services/users.service';
import { MailService } from '../../mail/mail.service';

@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name);

  constructor(
    private readonly invitesRepository: InvitesRepository,
    private readonly membershipsService: MembershipsService,
    private readonly organizationsRepository: OrganizationsRepository,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    private readonly eventEmitter: EventEmitter2,
    private readonly dataSource: DataSource,
  ) {}

  async listPendingInvites(organizationId: string) {
    const rows = await this.invitesRepository.findPendingByOrganization(
      organizationId,
    );
    return rows.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      expiresAt: inv.expiresAt.toISOString(),
      createdAt: inv.createdAt.toISOString(),
    }));
  }

  async createInvite(
    ctx: RequestContext,
    dto: CreateInviteDto,
  ): Promise<{ emailSent: boolean; inviteUrl: string }> {
    const email = dto.email.trim().toLowerCase();
    const role = dto.role ?? Role.MEMBER;

    // Check if user is already a member of this organization
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      const isMember = await this.membershipsService.getMembership(
        existingUser.id,
        ctx.organizationId!,
      );
      if (isMember) {
        throw new AppError(
          ErrorCodes.ALREADY_MEMBER,
          'This user is already a member of the organization',
          409,
        );
      }
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(
      Date.now() + INVITE_TOKEN_TTL_HOURS * 60 * 60 * 1000,
    );

    const existingInvite = await this.invitesRepository.findActiveByEmailAndOrg(
      email,
      ctx.organizationId!,
    );

    if (existingInvite) {
      // Refresh the existing active invite's token and expiration
      await this.invitesRepository.updateInviteToken(existingInvite.id, {
        tokenHash,
        expiresAt,
      });
      this.logger.log(
        `Refreshed active invite for ${email} in org ${ctx.organizationId}`,
      );
    } else {
      await this.invitesRepository.create({
        organizationId: ctx.organizationId!,
        email,
        tokenHash,
        role,
        expiresAt,
        createdBy: ctx.userId,
      });

      this.logger.log(
        `Invite created for org ${ctx.organizationId} by ${ctx.userId}`,
      );

      this.eventEmitter.emit(EventType.INVITE_CREATED, {
        type: EventType.INVITE_CREATED,
        payload: { email, role },
        occurredAt: new Date(),
        organizationId: ctx.organizationId!,
        triggeredBy: ctx.userId,
      } satisfies DomainEvent);
    }

    const [creator, org] = await Promise.all([
      this.usersService.findById(ctx.userId),
      this.organizationsRepository.findById(ctx.organizationId!),
    ]);

    const inviteUrl = `${this.mailService.getFrontendUrl()}/invite/${rawToken}`;

    // Send email asynchronously in the background so the request completes immediately
    this.mailService
      .sendInvitationEmail({
        recipientEmail: email,
        organizationName: org?.name || 'your workspace',
        inviterName: creator ? `${creator.firstName} ${creator.lastName}` : undefined,
        role,
        inviteToken: rawToken,
      })
      .then(() => {
        this.logger.log(`Invite email successfully delivered to ${email}`);
      })
      .catch((err) => {
        this.logger.error(
          `Failed to send invite email to ${email}: ${err instanceof Error ? err.message : err}`,
        );
      });

    return { emailSent: true, inviteUrl };
  }

  /** Same invite row: refresh token + expiry and send email again (no new DB row). */
  async resendInvite(
    ctx: RequestContext,
    inviteId: string,
  ): Promise<{ emailSent: boolean; inviteUrl: string }> {
    const orgId = ctx.organizationId!;
    const invite = await this.invitesRepository.findByIdAndOrganization(
      inviteId,
      orgId,
    );

    if (!invite) {
      throw new AppError(ErrorCodes.INVITE_NOT_FOUND, 'Invite not found', 404);
    }

    if (invite.usedAt) {
      throw new AppError(
        ErrorCodes.INVITE_ALREADY_USED,
        'This invite has already been accepted',
        409,
      );
    }

    if (!invite.email) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        'Cannot resend an invite without an email address',
        400,
      );
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(
      Date.now() + INVITE_TOKEN_TTL_HOURS * 60 * 60 * 1000,
    );

    await this.invitesRepository.updateInviteToken(invite.id, {
      tokenHash,
      expiresAt,
    });

    const [creator, org] = await Promise.all([
      this.usersService.findById(ctx.userId),
      this.organizationsRepository.findById(orgId),
    ]);

    const inviteUrl = `${this.mailService.getFrontendUrl()}/invite/${rawToken}`;

    // Send email asynchronously in the background
    this.mailService
      .sendInvitationEmail({
        recipientEmail: invite.email,
        organizationName: org?.name || 'your workspace',
        inviterName: creator ? `${creator.firstName} ${creator.lastName}` : undefined,
        role: invite.role,
        inviteToken: rawToken,
      })
      .then(() => {
        this.logger.log(`Resend invite email successfully delivered to ${invite.email}`);
      })
      .catch((err) => {
        this.logger.error(
          `Failed to resend invite email to ${invite.email}: ${err instanceof Error ? err.message : err}`,
        );
      });

    return { emailSent: true, inviteUrl };
  }

  async validateInvite(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    const invite = await this.invitesRepository.findValidByTokenHash(tokenHash);

    if (!invite) {
      throw new AppError(
        ErrorCodes.INVITE_NOT_FOUND,
        'Invalid, expired, or already used invite token',
        400,
      );
    }

    return {
      organizationName: invite.organization?.name ?? 'Unknown',
      email: invite.email ?? null,
      role: invite.role,
    };
  }

  async acceptInvite(
    userId: string,
    userEmail: string,
    dto: AcceptInviteDto,
  ): Promise<Membership> {
    const tokenHash = this.hashToken(dto.token);
    const invite = await this.invitesRepository.findValidByTokenHash(tokenHash);

    if (!invite) {
      throw new AppError(
        ErrorCodes.INVITE_NOT_FOUND,
        'Invalid, expired, or already used invite token',
        400,
      );
    }

    // If invite targets a specific email, enforce match
    if (invite.email && invite.email !== userEmail.toLowerCase()) {
      throw new AppError(
        ErrorCodes.INVITE_NOT_FOUND,
        'This invite was not issued to your email address',
        403,
      );
    }

    // Atomic: create membership + mark invite used in a single transaction
    // Prevents partial state (membership without invite consumed, or vice versa)
    const membership = await this.dataSource.transaction(async (manager) => {
      // Check for existing membership inside transaction to prevent race condition
      const existing = await manager.findOne(Membership, {
        where: { userId, organizationId: invite.organizationId },
      });

      if (existing) {
        throw new AppError(
          ErrorCodes.ALREADY_MEMBER,
          'User is already a member of this organization',
          409,
        );
      }

      const newMembership = manager.create(Membership, {
        userId,
        organizationId: invite.organizationId,
        role: invite.role,
      });

      const saved = await manager.save(newMembership);

      // Mark invite as used within the same transaction
      await manager.update(Invite, invite.id, { usedAt: new Date() });

      return saved;
    });

    this.logger.log(
      `Invite accepted: user ${userId} joined org ${invite.organizationId}`,
    );

    this.eventEmitter.emit(EventType.MEMBER_JOINED, {
      type: EventType.MEMBER_JOINED,
      payload: { userId, role: invite.role },
      occurredAt: new Date(),
      organizationId: invite.organizationId,
      triggeredBy: userId,
    } satisfies DomainEvent);

    return membership;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
