import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from '../invoices/invoice.entity';
import * as nodemailer from 'nodemailer';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectRepository(Invoice)
    private invoicesRepo: Repository<Invoice>,
  ) {
    // Configure Nodemailer — replace with real SMTP in .env
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

  private buildEmailHtml(invoice: any, companyName: string): string {
    const due = invoice.dueDate
      ? new Date(invoice.dueDate).toLocaleDateString('fr-DZ')
      : 'non définie';

    return `
      <!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px">
      <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
        <div style="background:#1a54ff;padding:30px;text-align:center">
          <h1 style="color:white;margin:0;font-size:22px">${companyName}</h1>
          <p style="color:rgba(255,255,255,0.8);margin:8px 0 0">Rappel de paiement</p>
        </div>
        <div style="padding:30px">
          <p style="color:#374151;font-size:16px">Bonjour <strong>${invoice.clientName}</strong>,</p>
          <p style="color:#6b7280">Nous vous rappelons que la facture suivante est en attente de règlement :</p>
          <div style="background:#f9fafb;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid #1a54ff">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <span style="color:#6b7280">N° Facture</span><strong>${invoice.number}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <span style="color:#6b7280">Montant</span><strong style="color:#1a54ff">${this.formatAmount(invoice.total)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between">
              <span style="color:#6b7280">Date d'échéance</span><strong>${due}</strong>
            </div>
          </div>
          <p style="color:#6b7280;font-size:14px">Merci de bien vouloir procéder au règlement dans les meilleurs délais.</p>
          <p style="color:#374151;margin-top:30px">Cordialement,<br><strong>${companyName}</strong></p>
        </div>
      </div>
      </body></html>
    `;
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
        subject: `Rappel de paiement — Facture ${invoice.number}`,
        html: this.buildEmailHtml(invoice, companyName),
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
      // Dynamic import of twilio to avoid crash if not installed
      const twilio = await import('twilio').then((m) => m.default || m).catch(() => null);
      if (!twilio) return { success: false, message: 'Module twilio non installé. Exécutez: npm install twilio' };

      const client = (twilio as any)(accountSid, authToken);
      const phone = invoice.clientPhone.replace(/\s/g, '').startsWith('+') ? invoice.clientPhone.replace(/\s/g, '') : `+213${invoice.clientPhone.replace(/\s/g, '').replace(/^0/, '')}`;

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
      const phone = invoice.clientPhone.replace(/\s/g, '').startsWith('+') ? invoice.clientPhone.replace(/\s/g, '') : `+213${invoice.clientPhone.replace(/\s/g, '').replace(/^0/, '')}`;

      await client.messages.create({ from: fromNumber, to: phone, body });
      return { success: true, message: `SMS envoyé à ${phone}` };
    } catch (err) {
      return { success: false, message: `Échec SMS: ${err.message}` };
    }
  }

  // Send all enabled reminders at once
  async sendAllReminders(invoiceId: string, channels: { email?: boolean; whatsapp?: boolean; sms?: boolean }) {
    const results: any = {};
    if (channels.email) results.email = await this.sendEmailReminder(invoiceId);
    if (channels.whatsapp) results.whatsapp = await this.sendWhatsAppReminder(invoiceId);
    if (channels.sms) results.sms = await this.sendSmsReminder(invoiceId);
    return results;
  }
}
