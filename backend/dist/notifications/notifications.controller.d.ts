import { NotificationsService } from './notifications.service';
export declare class NotificationsController {
    private readonly notificationsService;
    constructor(notificationsService: NotificationsService);
    sendReminder(invoiceId: string, body: {
        channels?: {
            email?: boolean;
            whatsapp?: boolean;
            sms?: boolean;
        };
    }): Promise<any>;
    sendEmail(invoiceId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    sendWhatsApp(invoiceId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    sendSms(invoiceId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getEmailTemplate(): {
        subject: string;
        body: string;
    };
    saveEmailTemplate(body: {
        subject: string;
        body: string;
    }): {
        success: boolean;
        message: string;
    };
    resetEmailTemplate(): {
        success: boolean;
        message: string;
    };
}
