import { InvoiceType } from '../invoice.entity';
declare class InvoiceItemDto {
    description: string;
    quantity: number;
    unitPrice: number;
}
export declare class CreateInvoiceDto {
    type: InvoiceType;
    clientName: string;
    clientEmail?: string;
    clientPhone?: string;
    clientAddress?: string;
    clientNif?: string;
    clientNis?: string;
    clientLogoUrl?: string;
    items: InvoiceItemDto[];
    hasTva: boolean;
    tvaRate?: number;
    notes?: string;
    dueDate?: Date;
}
export {};
