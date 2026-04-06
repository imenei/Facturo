"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const nodemailer = __importStar(require("nodemailer"));
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
    buildEmailHtml(invoice, companyName) {
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
                subject: `Rappel de paiement — Facture ${invoice.number}`,
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
            const twilio = await Promise.resolve().then(() => __importStar(require('twilio'))).then((m) => m.default || m).catch(() => null);
            if (!twilio)
                return { success: false, message: 'Module twilio non installé. Exécutez: npm install twilio' };
            const client = twilio(accountSid, authToken);
            const phone = invoice.clientPhone.replace(/\s/g, '').startsWith('+') ? invoice.clientPhone.replace(/\s/g, '') : `+213${invoice.clientPhone.replace(/\s/g, '').replace(/^0/, '')}`;
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
            const twilio = await Promise.resolve().then(() => __importStar(require('twilio'))).then((m) => m.default || m).catch(() => null);
            if (!twilio)
                return { success: false, message: 'Module twilio non installé' };
            const client = twilio(accountSid, authToken);
            const phone = invoice.clientPhone.replace(/\s/g, '').startsWith('+') ? invoice.clientPhone.replace(/\s/g, '') : `+213${invoice.clientPhone.replace(/\s/g, '').replace(/^0/, '')}`;
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