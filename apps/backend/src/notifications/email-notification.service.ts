import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailNotificationService {
  private transporter: nodemailer.Transporter | null = null;
  private readonly logger = new Logger(EmailNotificationService.name);

  constructor(private readonly config: ConfigService) {
    const host = this.config.get('SMTP_HOST');
    if (!host) {
      this.logger.warn('SMTP not configured — email notifications disabled');
      return;
    }
    this.transporter = nodemailer.createTransport({
      host,
      port: Number(this.config.get('SMTP_PORT') ?? 465),
      secure: this.config.get('SMTP_SECURE') === 'true',
      auth: {
        user: this.config.get('SMTP_USER'),
        pass: this.config.get('SMTP_PASS'),
      },
    });
  }

  async sendRequestApproved(email: string, fullName: string, requestType: string, date: string) {
    if (!this.transporter || !email) return;
    try {
      await this.transporter.sendMail({
        from: this.config.get('EMAIL_FROM'),
        to: email,
        subject: `QA TimeOff: заявка одобрена`,
        text: `${fullName}, ваша заявка на ${requestType} (${date}) одобрена.`,
        html: `<p>${fullName}, ваша заявка на <b>${requestType}</b> (${date}) <span style="color:green">одобрена</span>.</p>`,
      });
    } catch (err) {
      this.logger.error(`Failed to send approval email to ${email}: ${err}`);
    }
  }

  async sendRequestRejected(email: string, fullName: string, requestType: string, date: string, comment?: string) {
    if (!this.transporter || !email) return;
    try {
      const text = `${fullName}, ваша заявка на ${requestType} (${date}) отклонена.${comment ? ` Комментарий: ${comment}` : ''}`;
      await this.transporter.sendMail({
        from: this.config.get('EMAIL_FROM'),
        to: email,
        subject: `QA TimeOff: заявка отклонена`,
        text,
        html: `<p>${fullName}, ваша заявка на <b>${requestType}</b> (${date}) <span style="color:red">отклонена</span>.${comment ? `<br/>Комментарий: ${comment}` : ''}</p>`,
      });
    } catch (err) {
      this.logger.error(`Failed to send rejection email to ${email}: ${err}`);
    }
  }
}
