import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { Invoice } from '../invoices/invoice.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Invoice)
    private invoicesRepo: Repository<Invoice>,
  ) {}

  private getMailConfig() {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASS || '';
    const secure =
      process.env.SMTP_SECURE === 'true' ||
      process.env.SMTP_PORT === '465' ||
      port === 465;
    const companyName = process.env.COMPANY_NAME || 'Facturo';
    const from = process.env.MAIL_FROM || (user ? `"${companyName}" <${user}>` : '');

    return { host, port, user, pass, secure, from, companyName };
  }

  private createTransporter(): nodemailer.Transporter | null {
    const { host, port, user, pass, secure } = this.getMailConfig();

    if (!user || !pass) {
      return null;
    }

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }

  private formatAmount(amount: number): string {
    return `${Number(amount).toLocaleString('fr-FR')} DZD`;
  }

  private buildEmailHtml(invoice: Invoice, companyName: string): string {
    const due = invoice.dueDate
      ? new Date(invoice.dueDate).toLocaleDateString('fr-FR')
      : 'non definie';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
        </head>
        <body style="font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="background: #1a54ff; padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 22px;">${companyName}</h1>
              <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">Rappel de paiement</p>
            </div>
            <div style="padding: 30px;">
              <p style="color: #374151; font-size: 16px;">Bonjour <strong>${invoice.clientName}</strong>,</p>
              <p style="color: #6b7280;">Nous vous rappelons que la facture suivante est en attente de reglement :</p>
              <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #1a54ff;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span style="color: #6b7280;">No Facture</span>
                  <strong>${invoice.number}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span style="color: #6b7280;">Montant</span>
                  <strong style="color: #1a54ff;">${this.formatAmount(Number(invoice.total))}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #6b7280;">Date d'echeance</span>
                  <strong>${due}</strong>
                </div>
              </div>
              <p style="color: #6b7280; font-size: 14px;">Merci de bien vouloir proceder au reglement dans les meilleurs delais.</p>
              <p style="color: #374151; margin-top: 30px;">Cordialement,<br /><strong>${companyName}</strong></p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  async sendEmailReminder(invoiceId: string): Promise<{ success: boolean; message: string }> {
    const invoice = await this.invoicesRepo.findOne({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Facture non trouvee');
    if (!invoice.clientEmail) {
      return { success: false, message: 'Aucun email client renseigne' };
    }

    const transporter = this.createTransporter();
    const { companyName, from } = this.getMailConfig();

    if (!transporter) {
      return {
        success: false,
        message: 'Email non configure. Ajoutez SMTP_USER et SMTP_PASS dans backend/.env.',
      };
    }

    try {
      await transporter.sendMail({
        from,
        to: invoice.clientEmail,
        subject: `Rappel de paiement - Facture ${invoice.number}`,
        html: this.buildEmailHtml(invoice, companyName),
      });

      this.logger.log(`Email reminder sent for invoice ${invoice.number} to ${invoice.clientEmail}`);
      return { success: true, message: `Email envoye a ${invoice.clientEmail}` };
    } catch (err: any) {
      this.logger.error('Email send failed', err);
      return { success: false, message: `Echec envoi email: ${err?.message || 'Erreur inconnue'}` };
    }
  }

  async sendWhatsAppReminder(invoiceId: string): Promise<{ success: boolean; message: string }> {
    const invoice = await this.invoicesRepo.findOne({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Facture non trouvee');
    if (!invoice.clientPhone) {
      return { success: false, message: 'Aucun numero de telephone client renseigne' };
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

    if (!accountSid || !authToken) {
      return {
        success: false,
        message: 'Twilio non configure. Ajoutez TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN dans .env',
      };
    }

    const companyName = process.env.COMPANY_NAME || 'Facturo';
    const due = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('fr-FR') : 'non definie';
    const body = `*${companyName} - Rappel de paiement*\n\nBonjour ${invoice.clientName},\n\nVotre facture *${invoice.number}* d'un montant de *${this.formatAmount(Number(invoice.total))}* est en attente de reglement.\n\nDate d'echeance : ${due}\n\nMerci de proceder au paiement dans les meilleurs delais.`;

    try {
      const twilio = await import('twilio').then((m) => m.default || m).catch(() => null);
      if (!twilio) {
        return { success: false, message: 'Module twilio non installe. Executez: npm install twilio' };
      }

      const client = (twilio as any)(accountSid, authToken);
      const phone = invoice.clientPhone.replace(/\s/g, '').startsWith('+')
        ? invoice.clientPhone.replace(/\s/g, '')
        : `+213${invoice.clientPhone.replace(/\s/g, '').replace(/^0/, '')}`;

      await client.messages.create({ from: fromNumber, to: `whatsapp:${phone}`, body });
      this.logger.log(`WhatsApp reminder sent for ${invoice.number} to ${phone}`);
      return { success: true, message: `WhatsApp envoye a ${phone}` };
    } catch (err: any) {
      this.logger.error('WhatsApp send failed', err);
      return { success: false, message: `Echec WhatsApp: ${err?.message || 'Erreur inconnue'}` };
    }
  }

  async sendSmsReminder(invoiceId: string): Promise<{ success: boolean; message: string }> {
    const invoice = await this.invoicesRepo.findOne({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Facture non trouvee');
    if (!invoice.clientPhone) {
      return { success: false, message: 'Aucun telephone client' };
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_SMS_FROM;

    if (!accountSid || !authToken || !fromNumber) {
      return {
        success: false,
        message: 'Twilio SMS non configure (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM)',
      };
    }

    const companyName = process.env.COMPANY_NAME || 'Facturo';
    const body = `${companyName}: Rappel facture ${invoice.number} - Montant: ${this.formatAmount(Number(invoice.total))}. Merci de regler dans les meilleurs delais.`;

    try {
      const twilio = await import('twilio').then((m) => m.default || m).catch(() => null);
      if (!twilio) return { success: false, message: 'Module twilio non installe' };

      const client = (twilio as any)(accountSid, authToken);
      const phone = invoice.clientPhone.replace(/\s/g, '').startsWith('+')
        ? invoice.clientPhone.replace(/\s/g, '')
        : `+213${invoice.clientPhone.replace(/\s/g, '').replace(/^0/, '')}`;

      await client.messages.create({ from: fromNumber, to: phone, body });
      return { success: true, message: `SMS envoye a ${phone}` };
    } catch (err: any) {
      return { success: false, message: `Echec SMS: ${err?.message || 'Erreur inconnue'}` };
    }
  }

  async sendAllReminders(
    invoiceId: string,
    channels: { email?: boolean; whatsapp?: boolean; sms?: boolean },
  ) {
    const results: Record<string, { success: boolean; message: string }> = {};
    if (channels.email) results.email = await this.sendEmailReminder(invoiceId);
    if (channels.whatsapp) results.whatsapp = await this.sendWhatsAppReminder(invoiceId);
    if (channels.sms) results.sms = await this.sendSmsReminder(invoiceId);
    return results;
  }
}
