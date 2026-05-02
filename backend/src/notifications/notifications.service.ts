import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from '../invoices/invoice.entity';
import * as nodemailer from 'nodemailer';

// MOD 8b: in-memory template store (use DB entity in production with TypeORM)
// This avoids needing a migration right away while keeping the feature functional
let customEmailTemplate: { subject?: string; body?: string } | null = null;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectRepository(Invoice)
    private invoicesRepo: Repository<Invoice>,
  ) {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    });
  }

  private formatAmount(amount: number): string {
    return `${Number(amount).toLocaleString('fr-DZ')} DZD`;
  }

  // MOD 8b: get current email template (custom or default)
  getEmailTemplate(): { subject: string; body: string } {
    if (customEmailTemplate?.subject && customEmailTemplate?.body) {
      return { subject: customEmailTemplate.subject, body: customEmailTemplate.body };
    }
    return {
      subject: 'Rappel de paiement — Facture {{invoiceNumber}}',
      body: `Bonjour {{clientName}},\n\nNous vous rappelons que la facture {{invoiceNumber}} d'un montant de {{amount}} est en attente de règlement.\n\nDate d'échéance : {{dueDate}}\n\nMerci de bien vouloir procéder au règlement dans les meilleurs délais.\n\nCordialement,\n{{companyName}}`,
    };
  }

  // MOD 8b: save custom template
  saveEmailTemplate(subject: string, body: string): void {
    customEmailTemplate = { subject, body };
    this.logger.log('Email template updated');
  }

  // MOD 8b: reset template to default
  resetEmailTemplate(): void {
    customEmailTemplate = null;
    this.logger.log('Email template reset to default');
  }

  // MOD 8b: build HTML from template variables
  private buildEmailHtml(invoice: any, companyName: string): string {
    const due = invoice.dueDate
      ? new Date(invoice.dueDate).toLocaleDateString('fr-DZ')
      : 'non définie';

    const tmpl = this.getEmailTemplate();

    // Replace variables in body
    const bodyContent = tmpl.body
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
          <h1 style="color:white;margin:0;font-size:22px">${companyName}</h1>
          <p style="color:rgba(255,255,255,0.8);margin:8px 0 0">Rappel de paiement</p>
        </div>
        <div style="padding:30px;color:#374151;font-size:15px;line-height:1.6">
          ${bodyContent}
        </div>
        <div style="background:#f9fafb;padding:16px 30px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#9ca3af">
          Ce message a été envoyé automatiquement. Merci de ne pas y répondre.
        </div>
      </div>
      </body></html>
    `;
  }

  // MOD 8b: build email subject from template
  private buildEmailSubject(invoice: any, companyName: string): string {
    const tmpl = this.getEmailTemplate();
    return tmpl.subject
      .replace(/{{clientName}}/g, invoice.clientName || '')
      .replace(/{{invoiceNumber}}/g, invoice.number || '')
      .replace(/{{amount}}/g, this.formatAmount(invoice.total))
      .replace(/{{companyName}}/g, companyName);
  }

  async sendEmailReminder(invoiceId: string): Promise<{ success: boolean; message: string }> {
    const invoice = await this.invoicesRepo.findOne({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Facture non trouvée');
    if (!invoice.clientEmail) {
      return { success: false, message: 'Aucun email client renseigné' };
    }

    const companyName = process.env.COMPANY_NAME || 'Mon Entreprise';

    try {
      await this.transporter.sendMail({
        from: `"${companyName}" <${process.env.SMTP_USER}>`,
        to: invoice.clientEmail,
        subject: this.buildEmailSubject(invoice, companyName), // MOD 8b: uses custom template subject
        html: this.buildEmailHtml(invoice, companyName),        // MOD 8b: uses custom template body
      });
      this.logger.log(`Email reminder sent for invoice ${invoice.number} to ${invoice.clientEmail}`);
      return { success: true, message: `Email envoyé à ${invoice.clientEmail}` };
    } catch (err) {
      this.logger.error('Email send failed', err);
      return { success: false, message: `Échec envoi email: ${err.message}` };
    }
  }

  async sendWhatsAppReminder(invoiceId: string): Promise<{ success: boolean; message: string }> {
    const invoice = await this.invoicesRepo.findOne({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Facture non trouvée');
    if (!invoice.clientPhone) {
      return { success: false, message: 'Aucun numéro de téléphone client renseigné' };
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

    if (!accountSid || !authToken) {
      return { success: false, message: 'Twilio non configuré. Ajoutez TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN dans .env' };
    }

    const companyName = process.env.COMPANY_NAME || 'Mon Entreprise';
    const due = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('fr-DZ') : 'non définie';
    const body = `*${companyName} — Rappel de paiement*\n\nBonjour ${invoice.clientName},\n\nVotre facture *${invoice.number}* d'un montant de *${this.formatAmount(invoice.total)}* est en attente de règlement.\n\nDate d'échéance : ${due}\n\nMerci de procéder au paiement dans les meilleurs délais.`;

    try {
      const twilio = await import('twilio').then((m) => m.default || m).catch(() => null);
      if (!twilio) return { success: false, message: 'Module twilio non installé. Exécutez: npm install twilio' };

      const client = (twilio as any)(accountSid, authToken);
      const phone = invoice.clientPhone.replace(/\s/g, '').startsWith('+')
        ? invoice.clientPhone.replace(/\s/g, '')
        : `+213${invoice.clientPhone.replace(/\s/g, '').replace(/^0/, '')}`;

      await client.messages.create({ from: fromNumber, to: `whatsapp:${phone}`, body });
      this.logger.log(`WhatsApp reminder sent for ${invoice.number} to ${phone}`);
      return { success: true, message: `WhatsApp envoyé à ${phone}` };
    } catch (err) {
      this.logger.error('WhatsApp send failed', err);
      return { success: false, message: `Échec WhatsApp: ${err.message}` };
    }
  }

  async sendSmsReminder(invoiceId: string): Promise<{ success: boolean; message: string }> {
    const invoice = await this.invoicesRepo.findOne({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Facture non trouvée');
    if (!invoice.clientPhone) return { success: false, message: 'Aucun téléphone client' };

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_SMS_FROM;

    if (!accountSid || !authToken || !fromNumber) {
      return { success: false, message: 'Twilio SMS non configuré (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM)' };
    }

    const companyName = process.env.COMPANY_NAME || 'Mon Entreprise';
    const body = `${companyName}: Rappel facture ${invoice.number} — Montant: ${this.formatAmount(invoice.total)}. Merci de régler dans les meilleurs délais.`;

    try {
      const twilio = await import('twilio').then((m) => m.default || m).catch(() => null);
      if (!twilio) return { success: false, message: 'Module twilio non installé' };

      const client = (twilio as any)(accountSid, authToken);
      const phone = invoice.clientPhone.replace(/\s/g, '').startsWith('+')
        ? invoice.clientPhone.replace(/\s/g, '')
        : `+213${invoice.clientPhone.replace(/\s/g, '').replace(/^0/, '')}`;

      await client.messages.create({ from: fromNumber, to: phone, body });
      return { success: true, message: `SMS envoyé à ${phone}` };
    } catch (err) {
      return { success: false, message: `Échec SMS: ${err.message}` };
    }
  }

  async sendAllReminders(invoiceId: string, channels: { email?: boolean; whatsapp?: boolean; sms?: boolean }) {
    const results: any = {};
    if (channels.email) results.email = await this.sendEmailReminder(invoiceId);
    if (channels.whatsapp) results.whatsapp = await this.sendWhatsAppReminder(invoiceId);
    if (channels.sms) results.sms = await this.sendSmsReminder(invoiceId);
    return results;
  }
}
