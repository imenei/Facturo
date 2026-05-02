"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var NotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const invoice_entity_1 = require("../invoices/invoice.entity");
const nodemailer = require("nodemailer");
let customEmailTemplate = null;
let NotificationsService = NotificationsService_1 = class NotificationsService {
    constructor(invoicesRepo) {
        this.invoicesRepo = invoicesRepo;
        this.logger = new common_1.Logger(NotificationsService_1.name);
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
    formatAmount(amount) {
        return `${Number(amount).toLocaleString('fr-DZ')} DZD`;
    }
    getEmailTemplate() {
        if (customEmailTemplate?.subject && customEmailTemplate?.body) {
            return { subject: customEmailTemplate.subject, body: customEmailTemplate.body };
        }
        return {
            subject: 'Rappel de paiement — Facture {{invoiceNumber}}',
            body: `Bonjour {{clientName}},\n\nNous vous rappelons que la facture {{invoiceNumber}} d'un montant de {{amount}} est en attente de règlement.\n\nDate d'échéance : {{dueDate}}\n\nMerci de bien vouloir procéder au règlement dans les meilleurs délais.\n\nCordialement,\n{{companyName}}`,
        };
    }
    saveEmailTemplate(subject, body) {
        customEmailTemplate = { subject, body };
        this.logger.log('Email template updated');
    }
    resetEmailTemplate() {
        customEmailTemplate = null;
        this.logger.log('Email template reset to default');
    }
    buildEmailHtml(invoice, companyName) {
        const due = invoice.dueDate
            ? new Date(invoice.dueDate).toLocaleDateString('fr-DZ')
            : 'non définie';
        const tmpl = this.getEmailTemplate();
        const bodyContent = tmpl.body
            .replace(/{{clientName}}/g, invoice.clientName || '')
            .replace(/{{invoiceNumber}}/g, invoice.number || '')
            .replace(/{{amount}}/g, this.formatAmount(invoice.total))
            .replace(/{{dueDate}}/g, due)
            .replace(/{{companyName}}/g, companyName)
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
    buildEmailSubject(invoice, companyName) {
        const tmpl = this.getEmailTemplate();
        return tmpl.subject
            .replace(/{{clientName}}/g, invoice.clientName || '')
            .replace(/{{invoiceNumber}}/g, invoice.number || '')
            .replace(/{{amount}}/g, this.formatAmount(invoice.total))
            .replace(/{{companyName}}/g, companyName);
    }
    async sendEmailReminder(invoiceId) {
        const invoice = await this.invoicesRepo.findOne({ where: { id: invoiceId } });
        if (!invoice)
            throw new common_1.NotFoundException('Facture non trouvée');
        if (!invoice.clientEmail) {
            return { success: false, message: 'Aucun email client renseigné' };
        }
        const companyName = process.env.COMPANY_NAME || 'Mon Entreprise';
        try {
            await this.transporter.sendMail({
                from: `"${companyName}" <${process.env.SMTP_USER}>`,
                to: invoice.clientEmail,
                subject: this.buildEmailSubject(invoice, companyName),
                html: this.buildEmailHtml(invoice, companyName),
            });
            this.logger.log(`Email reminder sent for invoice ${invoice.number} to ${invoice.clientEmail}`);
            return { success: true, message: `Email envoyé à ${invoice.clientEmail}` };
        }
        catch (err) {
            this.logger.error('Email send failed', err);
            return { success: false, message: `Échec envoi email: ${err.message}` };
        }
    }
    async sendWhatsAppReminder(invoiceId) {
        const invoice = await this.invoicesRepo.findOne({ where: { id: invoiceId } });
        if (!invoice)
            throw new common_1.NotFoundException('Facture non trouvée');
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
            const twilio = await Promise.resolve().then(() => require('twilio')).then((m) => m.default || m).catch(() => null);
            if (!twilio)
                return { success: false, message: 'Module twilio non installé. Exécutez: npm install twilio' };
            const client = twilio(accountSid, authToken);
            const phone = invoice.clientPhone.replace(/\s/g, '').startsWith('+')
                ? invoice.clientPhone.replace(/\s/g, '')
                : `+213${invoice.clientPhone.replace(/\s/g, '').replace(/^0/, '')}`;
            await client.messages.create({ from: fromNumber, to: `whatsapp:${phone}`, body });
            this.logger.log(`WhatsApp reminder sent for ${invoice.number} to ${phone}`);
            return { success: true, message: `WhatsApp envoyé à ${phone}` };
        }
        catch (err) {
            this.logger.error('WhatsApp send failed', err);
            return { success: false, message: `Échec WhatsApp: ${err.message}` };
        }
    }
    async sendSmsReminder(invoiceId) {
        const invoice = await this.invoicesRepo.findOne({ where: { id: invoiceId } });
        if (!invoice)
            throw new common_1.NotFoundException('Facture non trouvée');
        if (!invoice.clientPhone)
            return { success: false, message: 'Aucun téléphone client' };
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_SMS_FROM;
        if (!accountSid || !authToken || !fromNumber) {
            return { success: false, message: 'Twilio SMS non configuré (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM)' };
        }
        const companyName = process.env.COMPANY_NAME || 'Mon Entreprise';
        const body = `${companyName}: Rappel facture ${invoice.number} — Montant: ${this.formatAmount(invoice.total)}. Merci de régler dans les meilleurs délais.`;
        try {
            const twilio = await Promise.resolve().then(() => require('twilio')).then((m) => m.default || m).catch(() => null);
            if (!twilio)
                return { success: false, message: 'Module twilio non installé' };
            const client = twilio(accountSid, authToken);
            const phone = invoice.clientPhone.replace(/\s/g, '').startsWith('+')
                ? invoice.clientPhone.replace(/\s/g, '')
                : `+213${invoice.clientPhone.replace(/\s/g, '').replace(/^0/, '')}`;
            await client.messages.create({ from: fromNumber, to: phone, body });
            return { success: true, message: `SMS envoyé à ${phone}` };
        }
        catch (err) {
            return { success: false, message: `Échec SMS: ${err.message}` };
        }
    }
    async sendAllReminders(invoiceId, channels) {
        const results = {};
        if (channels.email)
            results.email = await this.sendEmailReminder(invoiceId);
        if (channels.whatsapp)
            results.whatsapp = await this.sendWhatsAppReminder(invoiceId);
        if (channels.sms)
            results.sms = await this.sendSmsReminder(invoiceId);
        return results;
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = NotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(invoice_entity_1.Invoice)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map