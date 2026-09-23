import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { invitationTemplate } from './templates/invitation';
import { taskAssignedTemplate } from './templates/task-assigned';
import { verifyEmailTemplate } from './templates/verify-email';
import { passwordResetTemplate } from './templates/password-reset';

export interface InvitationEmailData {
  recipientEmail: string;
  recipientName?: string;
  organizationName: string;
  inviterName?: string;
  role: string;
  inviteToken: string;
}

export interface TaskAssignedEmailData {
  recipientEmail: string;
  recipientName?: string;
  taskTitle: string;
  taskDescription?: string;
  projectName?: string;
  dueDate?: string;
  priority: string;
  assignerName?: string;
  organizationName: string;
  taskId: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly frontendUrl: string;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('mail.host', 'localhost');
    const port = this.configService.get<number>('mail.port', 587);
    const secure = this.configService.get<boolean>('mail.secure', false);
    const user = this.configService.get<string>('mail.user', '');
    const pass = this.configService.get<string>('mail.pass', '');
    this.from = this.configService.get<string>('mail.from', 'Connect <noreply@connect.io>');
    this.frontendUrl = this.configService.get<string>('mail.frontendUrl', 'http://localhost:3001');

    this.enabled = !!user && !!pass;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      pool: true,
      maxConnections: 3,
      ...(this.enabled ? { auth: { user, pass } } : {}),
    });

    if (!this.enabled) {
      this.logger.warn('SMTP credentials not configured — emails will be logged but not sent');
    }
  }

  getFrontendUrl(): string {
    return this.frontendUrl;
  }

  async sendInvitationEmail(data: InvitationEmailData): Promise<void> {
    const inviteUrl = `${this.frontendUrl}/invite/${data.inviteToken}`;
    const { html, text } = invitationTemplate({
      ...data,
      inviteUrl,
    });

    await this.send({
      to: data.recipientEmail,
      subject: `You've been invited to ${data.organizationName} on Connect`,
      html,
      text,
    });
  }

  async sendVerifyEmail(data: {
    to: string;
    firstName: string;
    token: string;
    otp?: string;
  }): Promise<void> {
    const otpCode = data.otp || data.token;
    const verifyUrl = `${this.frontendUrl}/auth/verify-email?token=${encodeURIComponent(data.token)}`;
    const { html, text } = verifyEmailTemplate({
      firstName: data.firstName,
      otp: otpCode,
      verifyUrl,
    });
    await this.send({
      to: data.to,
      subject: `Your Connect verification code: ${otpCode}`,
      html,
      text,
      actionUrl: verifyUrl,
      otp: otpCode,
    });
  }

  async sendPasswordResetEmail(data: { to: string; token: string }): Promise<void> {
    const resetUrl = `${this.frontendUrl}/auth/reset-password?token=${encodeURIComponent(data.token)}`;
    const { html, text } = passwordResetTemplate({ resetUrl });
    await this.send({
      to: data.to,
      subject: 'Reset your Connect password',
      html,
      text,
      actionUrl: resetUrl,
    });
  }

  async sendTaskAssignedEmail(data: TaskAssignedEmailData): Promise<void> {
    const taskUrl = `${this.frontendUrl}/tasks`;
    const { html, text } = taskAssignedTemplate({
      ...data,
      taskUrl,
    });

    await this.send({
      to: data.recipientEmail,
      subject: `Task assigned: ${data.taskTitle}`,
      html,
      text,
      actionUrl: taskUrl,
    });
  }

  private async send(options: {
    to: string;
    subject: string;
    html: string;
    text: string;
    actionUrl?: string;
    otp?: string;
  }): Promise<void> {
    try {
      if (!this.enabled) {
        this.logger.log(`[Email Preview] To: ${options.to} | Subject: ${options.subject}`);
        console.log('\n' + '='.repeat(70));
        console.log('📬  [CONNECT EMAIL - LOCAL DEVELOPMENT MODE]');
        console.log(`To:      ${options.to}`);
        console.log(`Subject: ${options.subject}`);
        if (options.otp) {
          console.log('----------------------------------------------------------------------');
          console.log('🔢  YOUR 6-DIGIT VERIFICATION CODE (Valid for 10 minutes):');
          console.log(`\x1b[32m\x1b[1m   >>> ${options.otp} <<<   \x1b[0m`);
          console.log('----------------------------------------------------------------------');
        }
        if (options.actionUrl) {
          console.log(`👉  Direct link: ${options.actionUrl}`);
        }
        console.log('💡  Note: To send REAL emails to real inboxes, configure SMTP in backend/.env:');
        console.log('    SMTP_HOST=smtp.gmail.com  SMTP_PORT=465  SMTP_SECURE=true');
        console.log('    SMTP_USER=your_email@gmail.com  SMTP_PASS=your_app_password');
        console.log('='.repeat(70) + '\n');
        return;
      }

      await this.transporter.sendMail({
        from: this.from,
        ...options,
      });

      this.logger.log(`Email sent to ${options.to}: ${options.subject}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to send email to ${options.to}: ${err.message}`, err.stack);
      throw err;
    }
  }
}
