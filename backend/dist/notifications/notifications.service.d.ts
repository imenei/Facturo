import { Repository } from 'typeorm';
import { Invoice } from '../invoices/invoice.entity';
export declare class NotificationsService {
    private invoicesRepo;
    private readonly logger;
    constructor(invoicesRepo: Repository<Invoice>);
    private getMailConfig;
    private createTransporter;
    private formatAmount;
    private buildEmailHtml;
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
    }): Promise<Record<string, {
        success: boolean;
        message: string;
    }>>;
}
