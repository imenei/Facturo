import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Invoice } from '../invoices/invoice.entity';
import { ReminderHistory } from './reminder-history.entity';
import { NotificationSetting } from './notification-setting.entity';
import { formatMoney } from '../common/money';
import * as nodemailer from 'nodemailer';

const EMAIL_TEMPLATE_ID = 'payment-reminder';
const EMAIL_HEADER_ID = 'payment-reminder-header';
const DEFAULT_EMAIL_TEMPLATE = {
  subject: 'Rappel de paiement — Facture {{invoiceNumber}}',
  body: `Bonjour {{clientName}},\n\nNous vous rappelons que la facture {{invoiceNumber}} d'un montant de {{amount}} est en attente de règlement.\n\nDate d'échéance : {{dueDate}}\n\nMerci de bien vouloir procéder au règlement dans les meilleurs délais.\n\nCordialement,\n{{companyName}}`,
};

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter: nodemailer.Transporter;
  private cleanupTimer: NodeJS.Timeout;

  constructor(
    @InjectRepository(Invoice)
    private invoicesRepo: Repository<Invoice>,
    @InjectRepository(ReminderHistory)
    private reminderHistoryRepo: Repository<ReminderHistory>,
    @InjectRepository(NotificationSetting)
    private notificationSettingsRepo: Repository<NotificationSetting>,
  ) {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number.parseInt(process.env.SMTP_PORT || '', 10) || 587,
      secure: Number.parseInt(process.env.SMTP_PORT || '', 10) === 465,
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    });
  }

  onModuleInit() {
    void this.cleanupReminderHistory();
    this.cleanupTimer = setInterval(() => void this.cleanupReminderHistory(), 24 * 60 * 60 * 1000);
    this.cleanupTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  private async cleanupReminderHistory() {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    try {
      await this.reminderHistoryRepo.delete({ createdAt: LessThan(cutoff) });
    } catch (error) {
      this.logger.error('Reminder history cleanup failed', error);
    }
  }

  private formatAmount(amount: number): string {
    return `${formatMoney(amount)} DZD`;
  }

  async getEmailTemplate(): Promise<{ subject: string; body: string; headerName: string }> {
    const [saved, savedHeader] = await Promise.all([
      this.notificationSettingsRepo.findOne({ where: { id: EMAIL_TEMPLATE_ID } }),
      this.notificationSettingsRepo.findOne({ where: { id: EMAIL_HEADER_ID } }),
    ]);
    return {
      ...(saved ? { subject: saved.subject, body: saved.body } : DEFAULT_EMAIL_TEMPLATE),
      headerName: savedHeader?.subject || process.env.SMTP_FROM_NAME || 'HelpDZ',
    };
  }

  async saveEmailTemplate(subject: string, body: string, headerName?: string): Promise<void> {
    if (headerName !== undefined && !headerName.trim()) {
      throw new BadRequestException('Le nom affiché dans l’en-tête est obligatoire');
    }
    await this.notificationSettingsRepo.save({ id: EMAIL_TEMPLATE_ID, subject, body });
    if (headerName !== undefined) {
      await this.notificationSettingsRepo.save({ id: EMAIL_HEADER_ID, subject: headerName.trim(), body: '' });
    }
    this.logger.log('Email template updated');
  }

  async resetEmailTemplate(): Promise<void> {
    await this.notificationSettingsRepo.delete([EMAIL_TEMPLATE_ID, EMAIL_HEADER_ID]);
    this.logger.log('Email template reset to default');
  }

  private buildEmailHtml(invoice: any, companyName: string, template: { subject: string; body: string; headerName: string }): string {
    const due = invoice.dueDate
      ? new Date(invoice.dueDate).toLocaleDateString('fr-DZ')
      : 'non définie';

    const brandName = template.headerName.replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character] || character);

    // Replace variables in body
    const bodyContent = template.body
      .replace(/{{clientName}}/g, invoice.clientName || '')
      .replace(/{{invoiceNumber}}/g, invoice.number || '')
      .replace(/{{amount}}/g, this.formatAmount(invoice.total))
      .replace(/{{dueDate}}/g, due)
      .replace(/{{companyName}}/g, companyName)
      // Convert newlines to <br> for HTML if body is plain text
      .replace(/\n/g, '<br>');

    return `
      <!DOCTYPE html><html><head><meta charset="utf-8"></head>
      <body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px">
      <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
        <div style="background:#1a54ff;padding:30px;text-align:center">
          <h1 style="color:white;margin:0;font-size:22px">${brandName}</h1>
          <p style="color:rgba(255,255,255,0.8);margin:8px 0 0">Rappel de paiement — ${companyName}</p>
        </div>
        <div style="padding:30px;color:#374151;font-size:15px;line-height:1.6">
          ${bodyContent}
        </div>
        <div style="background:#f9fafb;padding:16px 30px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#9ca3af">
          Rappel automatique envoyé par <strong>${brandName}</strong>. Merci de ne pas répondre à cet email.
        </div>
      </div>
      </body></html>
    `;
  }

  private buildEmailText(invoice: any, companyName: string, template: { subject: string; body: string }): string {
    const due = invoice.dueDate
      ? new Date(invoice.dueDate).toLocaleDateString('fr-DZ')
      : 'non définie';

    return template.body
      .replace(/{{clientName}}/g, invoice.clientName || '')
      .replace(/{{invoiceNumber}}/g, invoice.number || '')
      .replace(/{{amount}}/g, this.formatAmount(invoice.total))
      .replace(/{{dueDate}}/g, due)
      .replace(/{{companyName}}/g, companyName)
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // MOD 8b: build email subject from template
  private buildEmailSubject(invoice: any, companyName: string, template: { subject: string; body: string }): string {
    return template.subject
      .replace(/{{clientName}}/g, invoice.clientName || '')
      .replace(/{{invoiceNumber}}/g, invoice.number || '')
      .replace(/{{amount}}/g, this.formatAmount(invoice.total))
      .replace(/{{companyName}}/g, companyName);
  }

  async sendEmailReminder(invoiceId: string, requestedRecipient?: string): Promise<{ success: boolean; message: string; recipientEmail: string; sentCount: number }> {
    const invoice = await this.invoicesRepo.findOne({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Facture non trouvée');
    const recipientEmail = (requestedRecipient || invoice.clientEmail || '').trim();
    if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      throw new BadRequestException('Adresse e-mail du destinataire invalide');
    }

    const companyName = process.env.COMPANY_NAME || 'Mon Entreprise';
    const senderName = process.env.SMTP_FROM_NAME || 'HelpDZ';
    const senderAddress = process.env.SMTP_FROM || process.env.SMTP_USER || '';
    const template = await this.getEmailTemplate();
    let success = false;
    let message: string;

    try {
      await this.transporter.sendMail({
        from: { name: senderName, address: senderAddress },
        to: recipientEmail,
        replyTo: { name: senderName, address: senderAddress },
        headers: {
          'X-Auto-Response-Suppress': 'OOF, AutoReply',
        },
        subject: this.buildEmailSubject(invoice, companyName, template),
        html: this.buildEmailHtml(invoice, companyName, template),
        text: this.buildEmailText(invoice, companyName, template),
      });
      success = true;
      message = `Email envoyé à ${recipientEmail}`;
      this.logger.log(`Email reminder sent for invoice ${invoice.number} to ${recipientEmail}`);
    } catch (err) {
      this.logger.error('Email send failed', err);
      message = `Échec envoi email: ${err instanceof Error ? err.message : 'erreur inconnue'}`;
    }

    await this.reminderHistoryRepo.save({
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      recipientEmail,
      success,
      message,
    });
    const sentCount = await this.reminderHistoryRepo.count({ where: { invoiceId: invoice.id, success: true } });
    return { success, message, recipientEmail, sentCount };
  }

  async getReminderHistory(): Promise<ReminderHistory[]> {
    await this.cleanupReminderHistory();
    return this.reminderHistoryRepo.find({ order: { createdAt: 'DESC' } });
  }

  async sendAllReminders(invoiceId: string, recipientEmail?: string) {
    return { email: await this.sendEmailReminder(invoiceId, recipientEmail) };
  }
}
