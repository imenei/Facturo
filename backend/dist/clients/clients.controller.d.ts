import { Repository } from 'typeorm';
import { Invoice } from '../invoices/invoice.entity';
export declare class ClientsController {
    private invoicesRepo;
    constructor(invoicesRepo: Repository<Invoice>);
    getClients(name?: string): Promise<any[]>;
    getClientDocuments(clientId: string, type?: string, status?: string): Promise<{
        clientId: string;
        clientName: string;
        clientEmail: string;
        clientPhone: string;
        clientAddress: string;
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
}
