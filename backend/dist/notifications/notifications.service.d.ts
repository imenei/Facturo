import { Repository } from 'typeorm';
import { Invoice } from '../invoices/invoice.entity';
export declare class NotificationsService {
    private invoicesRepo;
    private readonly logger;
    private transporter;
    constructor(invoicesRepo: Repository<Invoice>);
    private formatAmount;
    getEmailTemplate(): {
        subject: string;
        body: string;
    };
    saveEmailTemplate(subject: string, body: string): void;
    resetEmailTemplate(): void;
    private buildEmailHtml;
    private buildEmailSubject;
    sendEmailReminder(invoiceId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    sendWhatsAppReminder(invoiceId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    sendSmsReminder(invoiceId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    sendAllReminders(invoiceId: string, channels: {
        email?: boolean;
        whatsapp?: boolean;
        sms?: boolean;
    }): Promise<any>;
}
