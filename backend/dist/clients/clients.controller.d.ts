import { Repository } from 'typeorm';
import { Invoice } from '../invoices/invoice.entity';
export declare class ClientsController {
    private invoicesRepo;
    constructor(invoicesRepo: Repository<Invoice>);
    getClients(name?: string): Promise<any[]>;
    getClientDetails(clientId: string, type?: string, paymentStatus?: string): Promise<{
        clientId: string;
        clientName: string;
        clientEmail: string;
        clientPhone: string;
        clientAddress: string;
        clientLogoUrl: string;
        summary: {
            totalDocuments: number;
            totalRevenue: number;
            totalPaid: number;
            totalUnpaid: number;
            facturesCount: number;
            proformasCount: number;
            bonsCount: number;
            averageInvoice: number;
            firstOrder: Date;
            lastOrder: Date;
        };
        factures: Invoice[];
        proformas: Invoice[];
        bonsLivraison: Invoice[];
        products: {
            name: string;
            qty: number;
            revenue: number;
            lastDate: string;
        }[];
        monthlyRevenue: {
            month: string;
            revenue: number;
        }[];
    }>;
    getClientDocuments(clientId: string, type?: string, status?: string): Promise<{
        clientId: string;
        clientName: string;
        clientEmail: string;
        clientPhone: string;
        clientAddress: string;
        clientLogoUrl: string;
        summary: {
            totalDocuments: number;
            totalPaid: number;
            totalUnpaid: number;
            facturesCount: number;
            proformasCount: number;
            bonsCount: number;
        };
        factures: Invoice[];
        proformas: Invoice[];
        bonsLivraison: Invoice[];
    }>;
    uploadLogo(clientId: string, file: Express.Multer.File): Promise<{
        success: boolean;
        clientLogoUrl: string;
    }>;
    removeLogo(clientId: string): Promise<{
        success: boolean;
    }>;
}
