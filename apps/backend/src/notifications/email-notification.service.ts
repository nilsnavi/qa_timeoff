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

  async sendTempPassword(email: string, fullName: string, tempPassword: string, isReset = false) {
    if (!this.transporter || !email) return;
    const subject = isReset ? 'QA TimeOff: пароль сброшен' : 'QA TimeOff: добро пожаловать';
    const action = isReset ? 'Администратор сбросил ваш пароль' : 'Для вас создана учётная запись в QA TimeOff';
    const frontendUrl = this.config.get('FRONTEND_URL') ?? 'http://localhost:5173';
    try {
      await this.transporter.sendMail({
        from: this.config.get('EMAIL_FROM'),
        to: email,
        subject,
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
<h2 style="color:#1a1a2e">${subject}</h2>
<p>${fullName}, ${action}.</p>
<p>Ваш временный пароль для входа:</p>
<div style="background:#f0f4ff;border:1px solid #c7d7fd;border-radius:8px;padding:16px 24px;margin:16px 0;text-align:center">
<code style="font-size:24px;font-weight:bold;letter-spacing:4px;color:#2d5be3">${tempPassword}</code>
</div>
<p>После входа система попросит сменить пароль на постоянный.</p>
<p style="color:#888;font-size:13px">Войти: <a href="${frontendUrl}/login">${frontendUrl}/login</a></p>
</div>`,
        text: `${fullName}, ${action}.\n\nВременный пароль: ${tempPassword}\n\nПосле входа смените пароль.`,
      });
    } catch (err) {
      this.logger.error(`Failed to send temp password email to ${email}: ${err}`);
    }
  }
}
